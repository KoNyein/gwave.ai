import 'dart:async';
import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api_client.dart';

/// On-device store for the Health module. The phone copy (SharedPreferences
/// JSON) is the fast source of truth, but every change is also mirrored to the
/// user's own row in the server table `public.health_state` (a single JSON
/// snapshot, owner-only RLS). That means health data **auto-saves, auto-updates
/// and restores**: sign out and back in — or reinstall, or switch phones — and
/// the whole history comes back instead of vanishing. Call [attachCloud] +
/// [restoreFromCloud] on sign-in and [detachCloud] on sign-out (AppState does
/// this).
class HealthStore {
  static const _kVitals = "gw_health_vitals";
  static const _kCycle = "gw_health_cycle";
  static const _kMeds = "gw_health_meds";
  static const _kMedId = "gw_health_medid";
  static const _kReport = "gw_health_report_prefs";
  static const _kEvents = "gw_health_events";
  static const _kOwner = "gw_health_owner"; // profileId the local copy belongs to

  /// Every key that is mirrored to the cloud snapshot.
  static const _syncKeys = [_kVitals, _kCycle, _kMeds, _kMedId, _kReport, _kEvents];

  static Future<SharedPreferences> get _p => SharedPreferences.getInstance();

  // ---- Cloud auto-sync ------------------------------------------------------

  static ApiClient? _cloud;
  static Timer? _syncTimer;

  /// Wire the store to the signed-in user's API client so future saves mirror
  /// to the cloud. Safe to call repeatedly.
  static void attachCloud(ApiClient api) => _cloud = api;

  /// Stop mirroring (called on sign-out). The local copy is *kept* — signing
  /// back in must never lose it — but a different account signing in later will
  /// clear it in [restoreFromCloud] and load its own snapshot instead.
  static void detachCloud() {
    _cloud = null;
    _syncTimer?.cancel();
    _syncTimer = null;
  }

  /// Debounced push of the whole snapshot — coalesces a burst of edits (e.g. a
  /// full scan saving six vitals at once) into one upload.
  static void _scheduleSync() {
    final api = _cloud;
    if (api == null) return;
    _syncTimer?.cancel();
    _syncTimer = Timer(const Duration(seconds: 3), () => _pushSnapshot(api));
  }

  /// The full local health state as a JSON-safe map (decoded per key). Only
  /// keys that hold data are included.
  static Future<Map<String, dynamic>> _rawSnapshot() async {
    final p = await _p;
    final out = <String, dynamic>{};
    for (final k in _syncKeys) {
      final raw = p.getString(k);
      if (raw != null && raw.isNotEmpty) {
        try {
          out[k] = jsonDecode(raw);
        } catch (_) {}
      }
    }
    return out;
  }

  /// Best-effort mirror of the whole store to `public.health_state`. The local
  /// copy stays authoritative, so a missing table / offline device never blocks
  /// a save.
  static Future<void> _pushSnapshot(ApiClient api) async {
    final pid = api.session?.profileId;
    if (pid == null) return;
    try {
      await api.upsert(
        "health_state",
        {
          "user_id": pid,
          "data": await _rawSnapshot(),
          "updated_at": DateTime.now().toUtc().toIso8601String(),
        },
        onConflict: "user_id",
      );
    } catch (_) {
      // Table not migrated yet / offline — the on-device copy is enough.
    }
  }

  /// Pull the signed-in user's cloud snapshot and merge it into the local copy.
  /// Call once on every sign-in. Merge policy:
  ///  * lists (vitals, events, cycle, meds) — union by identity, so nothing on
  ///    either side is lost;
  ///  * single objects (Medical ID, report prefs) — cloud fills in only when
  ///    the phone has none yet.
  /// A fresh install (empty phone) therefore gets everything back; an existing
  /// phone keeps its data and gains anything the cloud had.
  static Future<void> restoreFromCloud(ApiClient api) async {
    final pid = api.session?.profileId;
    if (pid == null) return;
    final p = await _p;

    // Different account on this shared device → drop the previous user's data
    // before loading this user's, so accounts never bleed into each other.
    final owner = p.getString(_kOwner);
    if (owner != null && owner != pid) {
      for (final k in _syncKeys) {
        await p.remove(k);
      }
    }
    await p.setString(_kOwner, pid);

    Map<String, dynamic>? cloud;
    try {
      final rows = await api.select("health_state", query: {
        "select": "data",
        "user_id": "eq.$pid",
        "limit": "1",
      });
      if (rows.isNotEmpty) {
        cloud = (rows.first["data"] as Map?)?.cast<String, dynamic>();
      }
    } catch (_) {
      return; // table not migrated / offline — keep whatever is local
    }
    if (cloud == null || cloud.isEmpty) {
      // Nothing in the cloud yet — seed it from whatever this phone holds.
      await _pushSnapshot(api);
      return;
    }

    await _mergeList(p, _kVitals, cloud, (j) => "${j["id"]}");
    await _mergeList(p, _kEvents, cloud, (j) => "${j["id"]}");
    await _mergeList(p, _kCycle, cloud, (j) => "${j["start"]}");
    await _mergeList(p, _kMeds, cloud, (j) => "${j["name"]}");
    await _adoptIfAbsent(p, _kMedId, cloud);
    await _adoptIfAbsent(p, _kReport, cloud);

    // The merge may have added local-only rows the cloud lacked; push the
    // reconciled result straight back so both sides converge.
    await _pushSnapshot(api);
  }

  /// Union a list-valued key: append every cloud item whose identity isn't
  /// already present locally.
  static Future<void> _mergeList(
    SharedPreferences p,
    String key,
    Map<String, dynamic> cloud,
    String Function(Map<String, dynamic>) idOf,
  ) async {
    final cloudList =
        (cloud[key] as List?)?.cast<Map<String, dynamic>>() ?? const [];
    if (cloudList.isEmpty) return;
    final localRaw = p.getString(key);
    final localList = (localRaw != null && localRaw.isNotEmpty)
        ? (jsonDecode(localRaw) as List).cast<Map<String, dynamic>>()
        : <Map<String, dynamic>>[];
    final seen = localList.map(idOf).toSet();
    var changed = localRaw == null;
    for (final c in cloudList) {
      if (seen.add(idOf(c))) {
        localList.add(c);
        changed = true;
      }
    }
    if (changed) await p.setString(key, jsonEncode(localList));
  }

  /// Adopt a single-object key from the cloud only when the phone has none.
  static Future<void> _adoptIfAbsent(
    SharedPreferences p,
    String key,
    Map<String, dynamic> cloud,
  ) async {
    final existing = p.getString(key);
    if (existing != null && existing.isNotEmpty) return;
    final v = cloud[key];
    if (v == null) return;
    await p.setString(key, jsonEncode(v));
  }

  // ---- Vitals ---------------------------------------------------------------

  static Future<List<VitalReading>> vitals() async {
    final raw = (await _p).getString(_kVitals);
    if (raw == null || raw.isEmpty) return [];
    final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    final out = list.map(VitalReading.fromJson).toList();
    out.sort((a, b) => b.at.compareTo(a.at)); // newest first
    return out;
  }

  static Future<void> addVital(VitalReading r) async {
    final all = await vitals();
    all.insert(0, r);
    await (await _p)
        .setString(_kVitals, jsonEncode(all.map((e) => e.toJson()).toList()));
    _scheduleSync();
  }

  static Future<void> deleteVital(String id) async {
    final all = await vitals()
      ..removeWhere((e) => e.id == id);
    await (await _p)
        .setString(_kVitals, jsonEncode(all.map((e) => e.toJson()).toList()));
    _scheduleSync();
  }

  /// The most recent reading of each vital type (for the hub summary).
  static Future<Map<String, VitalReading>> latestByType() async {
    final all = await vitals();
    final map = <String, VitalReading>{};
    for (final r in all) {
      map.putIfAbsent(r.type, () => r); // list is newest-first
    }
    return map;
  }

  // ---- Menstrual cycle ------------------------------------------------------

  static Future<List<CycleEntry>> cycles() async {
    final raw = (await _p).getString(_kCycle);
    if (raw == null || raw.isEmpty) return [];
    final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    final out = list.map(CycleEntry.fromJson).toList();
    out.sort((a, b) => b.start.compareTo(a.start));
    return out;
  }

  static Future<void> saveCycles(List<CycleEntry> list) async {
    await (await _p)
        .setString(_kCycle, jsonEncode(list.map((e) => e.toJson()).toList()));
    _scheduleSync();
  }

  static Future<void> addCycle(CycleEntry c) async {
    final all = await cycles();
    // Replace an entry that starts on the same day rather than duplicating.
    all.removeWhere((e) => _sameDay(e.start, c.start));
    all.add(c);
    await saveCycles(all);
  }

  // ---- Medications ----------------------------------------------------------

  static Future<List<Medication>> meds() async {
    final raw = (await _p).getString(_kMeds);
    if (raw == null || raw.isEmpty) return [];
    final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    return list.map(Medication.fromJson).toList();
  }

  static Future<void> saveMeds(List<Medication> list) async {
    await (await _p)
        .setString(_kMeds, jsonEncode(list.map((e) => e.toJson()).toList()));
    _scheduleSync();
  }

  // ---- Medical ID -----------------------------------------------------------

  static Future<MedicalId> medicalId() async {
    final raw = (await _p).getString(_kMedId);
    if (raw == null || raw.isEmpty) return MedicalId.empty();
    return MedicalId.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  static Future<void> saveMedicalId(MedicalId m) async {
    await (await _p).setString(_kMedId, jsonEncode(m.toJson()));
    _scheduleSync();
  }

  // ---- Report include/exclude prefs ----------------------------------------

  static Future<ReportPrefs> reportPrefs() async {
    final raw = (await _p).getString(_kReport);
    if (raw == null || raw.isEmpty) return ReportPrefs.all();
    return ReportPrefs.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  static Future<void> saveReportPrefs(ReportPrefs p) async {
    await (await _p).setString(_kReport, jsonEncode(p.toJson()));
    _scheduleSync();
  }

  // ---- Activity journal (THC / meds / meals / exercise …) -------------------

  static Future<List<HealthEvent>> events() async {
    final raw = (await _p).getString(_kEvents);
    if (raw == null || raw.isEmpty) return [];
    final list = (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    final out = list.map(HealthEvent.fromJson).toList();
    out.sort((a, b) => b.at.compareTo(a.at)); // newest first
    return out;
  }

  static Future<void> addEvent(HealthEvent e) async {
    final all = await events();
    all.insert(0, e);
    await (await _p)
        .setString(_kEvents, jsonEncode(all.map((x) => x.toJson()).toList()));
    _scheduleSync();
  }

  static Future<void> deleteEvent(String id) async {
    final all = await events()
      ..removeWhere((e) => e.id == id);
    await (await _p)
        .setString(_kEvents, jsonEncode(all.map((x) => x.toJson()).toList()));
    _scheduleSync();
  }
}

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// Mirror a vital to the user's server database (public.health_vitals) so it
/// survives a reinstall and can be reviewed from any device. Best-effort: the
/// on-device copy stays the source of truth, so a missing table / offline
/// device never blocks the save.
Future<void> pushVitalToServer(ApiClient api, VitalReading r,
    {String source = 'manual'}) async {
  final pid = api.session?.profileId;
  if (pid == null) return;
  try {
    await api.insert("health_vitals", {
      "user_id": pid,
      "type": r.type,
      "value": r.value,
      if (r.value2 != null) "value2": r.value2,
      if (r.note != null) "note": r.note,
      "source": source,
      "recorded_at": r.at.toUtc().toIso8601String(),
    });
  } catch (_) {
    // Server not reachable / table not migrated yet — local copy is enough.
  }
}

/// The user's cloud vitals (newest first), or an empty list if the table isn't
/// available yet. Used by the cloud history view.
Future<List<VitalReading>> serverVitals(ApiClient api, {int limit = 200}) async {
  final pid = api.session?.profileId;
  if (pid == null) return [];
  try {
    final rows = await api.select("health_vitals", query: {
      "select": "id,type,value,value2,note,recorded_at",
      "user_id": "eq.$pid",
      "order": "recorded_at.desc",
      "limit": "$limit",
    });
    return rows
        .map((j) => VitalReading(
              id: "${j["id"]}",
              type: "${j["type"]}",
              value: (j["value"] as num).toDouble(),
              value2: (j["value2"] as num?)?.toDouble(),
              at: DateTime.tryParse("${j["recorded_at"]}")?.toLocal() ??
                  DateTime.now(),
              note: j["note"] as String?,
            ))
        .toList();
  } catch (_) {
    return [];
  }
}

/// Mirror an activity-journal event to the server (public.health_events).
/// Best-effort, same pattern as pushVitalToServer.
Future<void> pushEventToServer(ApiClient api, HealthEvent e) async {
  final pid = api.session?.profileId;
  if (pid == null) return;
  try {
    await api.insert("health_events", {
      "user_id": pid,
      "type": e.type,
      if (e.note != null) "note": e.note,
      if (e.detail != null) "detail": e.detail,
      "occurred_at": e.at.toUtc().toIso8601String(),
    });
  } catch (_) {
    // Table not migrated / offline — local copy is enough.
  }
}

/// The user's cloud activity events (newest first), or empty if unavailable.
Future<List<HealthEvent>> serverEvents(ApiClient api, {int limit = 200}) async {
  final pid = api.session?.profileId;
  if (pid == null) return [];
  try {
    final rows = await api.select("health_events", query: {
      "select": "id,type,note,detail,occurred_at",
      "user_id": "eq.$pid",
      "order": "occurred_at.desc",
      "limit": "$limit",
    });
    return rows
        .map((j) => HealthEvent(
              id: "${j["id"]}",
              type: "${j["type"]}",
              at: DateTime.tryParse("${j["occurred_at"]}")?.toLocal() ??
                  DateTime.now(),
              note: j["note"] as String?,
              detail: j["detail"] as String?,
            ))
        .toList();
  } catch (_) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/// Catalogue of the vital signs the app can log. `value2` is only used by the
/// two-number ones (blood pressure).
class VitalType {
  const VitalType(this.key, this.en, this.my, this.unit, this.icon,
      {this.hasSecond = false});
  final String key;
  final String en;
  final String my;
  final String unit;
  final int icon; // IconData codepoint kept as int so the model stays UI-free
  final bool hasSecond;

  static const heartRate =
      VitalType("heart_rate", "Heart rate", "နှလုံးခုန်နှုန်း", "bpm", 0xe3b0);
  static const bloodPressure = VitalType(
      "bp", "Blood pressure", "သွေးဖိအား", "mmHg", 0xe3b0,
      hasSecond: true);
  static const spo2 =
      VitalType("spo2", "Oxygen (SpO₂)", "အောက်ဆီဂျင်", "%", 0xe3b0);
  static const temperature =
      VitalType("temp", "Temperature", "အပူချိန်", "°C", 0xe3b0);
  static const weight = VitalType("weight", "Weight", "ကိုယ်အလေးချိန်", "kg", 0xe3b0);
  static const glucose =
      VitalType("glucose", "Blood sugar", "သွေးတွင်းသကြားဓာတ်", "mg/dL", 0xe3b0);
  static const respiratory = VitalType(
      "respiratory", "Respiratory rate", "အသက်ရှူနှုန်း", "/min", 0xe3b0);
  static const steps = VitalType("steps", "Steps", "ခြေလှမ်း", "steps", 0xe3b0);

  static const all = <VitalType>[
    heartRate,
    bloodPressure,
    spo2,
    temperature,
    weight,
    glucose,
    respiratory,
    steps,
  ];

  static VitalType byKey(String key) =>
      all.firstWhere((t) => t.key == key, orElse: () => heartRate);
}

class VitalReading {
  VitalReading({
    required this.id,
    required this.type,
    required this.value,
    required this.at,
    this.value2,
    this.note,
  });

  final String id;
  final String type; // VitalType.key
  final double value;
  final double? value2;
  final DateTime at;
  final String? note;

  /// Human-readable value, e.g. "120/80" for BP or "72" for heart rate.
  String get display => value2 != null
      ? "${value.toStringAsFixed(0)}/${value2!.toStringAsFixed(0)}"
      : (value == value.roundToDouble()
          ? value.toStringAsFixed(0)
          : value.toStringAsFixed(1));

  Map<String, dynamic> toJson() => {
        "id": id,
        "type": type,
        "value": value,
        "value2": value2,
        "at": at.toIso8601String(),
        "note": note,
      };

  factory VitalReading.fromJson(Map<String, dynamic> j) => VitalReading(
        id: "${j["id"]}",
        type: "${j["type"]}",
        value: (j["value"] as num).toDouble(),
        value2: (j["value2"] as num?)?.toDouble(),
        at: DateTime.tryParse("${j["at"]}") ?? DateTime.now(),
        note: j["note"] as String?,
      );
}

class CycleEntry {
  CycleEntry({required this.start, this.end, this.symptoms});
  final DateTime start;
  final DateTime? end;
  final String? symptoms;

  Map<String, dynamic> toJson() => {
        "start": start.toIso8601String(),
        "end": end?.toIso8601String(),
        "symptoms": symptoms,
      };

  factory CycleEntry.fromJson(Map<String, dynamic> j) => CycleEntry(
        start: DateTime.parse("${j["start"]}"),
        end: j["end"] != null ? DateTime.tryParse("${j["end"]}") : null,
        symptoms: j["symptoms"] as String?,
      );
}

class Medication {
  Medication({
    required this.name,
    this.dose,
    this.times = const [],
    this.notes,
  });
  final String name;
  final String? dose; // "500 mg", "1 tablet"
  final List<String> times; // "08:00", "20:00"
  final String? notes;

  Map<String, dynamic> toJson() => {
        "name": name,
        "dose": dose,
        "times": times,
        "notes": notes,
      };

  factory Medication.fromJson(Map<String, dynamic> j) => Medication(
        name: "${j["name"]}",
        dose: j["dose"] as String?,
        times: (j["times"] as List?)?.map((e) => "$e").toList() ?? const [],
        notes: j["notes"] as String?,
      );
}

class MedicalId {
  MedicalId({
    this.fullName,
    this.dob,
    this.bloodType,
    this.heightCm,
    this.allergies,
    this.conditions,
    this.medications,
    this.notes,
    this.emergencyName,
    this.emergencyPhone,
    this.organDonor = false,
  });

  String? fullName;
  DateTime? dob;
  String? bloodType;
  double? heightCm;
  String? allergies;
  String? conditions;
  String? medications;
  String? notes;
  String? emergencyName;
  String? emergencyPhone;
  bool organDonor;

  factory MedicalId.empty() => MedicalId();

  Map<String, dynamic> toJson() => {
        "fullName": fullName,
        "dob": dob?.toIso8601String(),
        "bloodType": bloodType,
        "heightCm": heightCm,
        "allergies": allergies,
        "conditions": conditions,
        "medications": medications,
        "notes": notes,
        "emergencyName": emergencyName,
        "emergencyPhone": emergencyPhone,
        "organDonor": organDonor,
      };

  factory MedicalId.fromJson(Map<String, dynamic> j) => MedicalId(
        fullName: j["fullName"] as String?,
        dob: j["dob"] != null ? DateTime.tryParse("${j["dob"]}") : null,
        bloodType: j["bloodType"] as String?,
        heightCm: (j["heightCm"] as num?)?.toDouble(),
        allergies: j["allergies"] as String?,
        conditions: j["conditions"] as String?,
        medications: j["medications"] as String?,
        notes: j["notes"] as String?,
        emergencyName: j["emergencyName"] as String?,
        emergencyPhone: j["emergencyPhone"] as String?,
        organDonor: j["organDonor"] == true,
      );
}

/// Which sections the doctor report should include — the user can leave out
/// anything they'd rather not share.
class ReportPrefs {
  ReportPrefs({
    this.medicalId = true,
    this.vitals = true,
    this.cycle = true,
    this.medications = true,
  });
  bool medicalId;
  bool vitals;
  bool cycle;
  bool medications;

  factory ReportPrefs.all() => ReportPrefs();

  Map<String, dynamic> toJson() => {
        "medicalId": medicalId,
        "vitals": vitals,
        "cycle": cycle,
        "medications": medications,
      };

  factory ReportPrefs.fromJson(Map<String, dynamic> j) => ReportPrefs(
        medicalId: j["medicalId"] != false,
        vitals: j["vitals"] != false,
        cycle: j["cycle"] != false,
        medications: j["medications"] != false,
      );
}

/// A kind of activity you can journal (cannabis/THC use, a medication, a meal,
/// exercise, caffeine, a symptom…). `icon` is a Material codepoint kept as an
/// int so the model stays UI-free.
class EventType {
  const EventType(this.key, this.en, this.my, this.icon,
      {this.detailHintEn = "", this.detailHintMy = ""});
  final String key;
  final String en;
  final String my;
  final int icon;
  final String detailHintEn; // e.g. "Amount / method"
  final String detailHintMy;

  static const cannabis = EventType(
      "cannabis", "Cannabis / THC", "ဆေးခြောက် / THC", 0xe30a,
      detailHintEn: "Amount / method (e.g. 0.3g, vape)",
      detailHintMy: "ပမာဏ / နည်း (ဥပမာ ၀.၃g)");
  static const medication = EventType(
      "medication", "Medication", "ဆေးဝါး", 0xe3f3,
      detailHintEn: "Dose (e.g. 500 mg)", detailHintMy: "Dose (ဥပမာ 500 mg)");
  static const meal =
      EventType("meal", "Meal / Food", "အစားအစာ", 0xe56c,
          detailHintEn: "What you ate", detailHintMy: "ဘာစားလဲ");
  static const exercise = EventType(
      "exercise", "Exercise", "လေ့ကျင့်ခန်း", 0xe52f,
      detailHintEn: "Type / duration (e.g. 30 min run)",
      detailHintMy: "အမျိုးအစား / ကြာချိန်");
  static const caffeine = EventType(
      "caffeine", "Caffeine", "ကဖင်း", 0xe541,
      detailHintEn: "e.g. 1 coffee", detailHintMy: "ဥပမာ ကော်ဖီ ၁ ခွက်");
  static const alcohol = EventType("alcohol", "Alcohol", "အရက်", 0xe540,
      detailHintEn: "e.g. 1 beer", detailHintMy: "ဥပမာ ဘီယာ ၁ လုံး");
  static const symptom = EventType(
      "symptom", "Symptom / feeling", "လက္ခဏာ / ခံစားချက်", 0xe13b,
      detailHintEn: "What you felt", detailHintMy: "ဘာခံစားရလဲ");
  static const other = EventType("other", "Other", "အခြား", 0xe1bd,
      detailHintEn: "Note", detailHintMy: "မှတ်ချက်");

  static const all = <EventType>[
    cannabis,
    medication,
    meal,
    exercise,
    caffeine,
    alcohol,
    symptom,
    other,
  ];

  static EventType byKey(String key) =>
      all.firstWhere((t) => t.key == key, orElse: () => other);
}

/// One journalled activity at a point in time.
class HealthEvent {
  HealthEvent({
    required this.id,
    required this.type,
    required this.at,
    this.note,
    this.detail,
  });

  final String id;
  final String type; // EventType.key
  final DateTime at;
  final String? note;
  final String? detail; // dose / amount / duration

  Map<String, dynamic> toJson() => {
        "id": id,
        "type": type,
        "at": at.toIso8601String(),
        "note": note,
        "detail": detail,
      };

  factory HealthEvent.fromJson(Map<String, dynamic> j) => HealthEvent(
        id: "${j["id"]}",
        type: "${j["type"]}",
        at: DateTime.tryParse("${j["at"]}") ?? DateTime.now(),
        note: j["note"] as String?,
        detail: j["detail"] as String?,
      );
}
