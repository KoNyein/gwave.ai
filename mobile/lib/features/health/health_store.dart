import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// On-device store for the Health module. Health data is highly personal, so it
/// stays on the phone (SharedPreferences JSON) — nothing is uploaded to the
/// server. The user can still export a PDF report to show a doctor. Cloud sync
/// could be a later opt-in; the privacy-first default is local-only.
class HealthStore {
  static const _kVitals = "gw_health_vitals";
  static const _kCycle = "gw_health_cycle";
  static const _kMeds = "gw_health_meds";
  static const _kMedId = "gw_health_medid";
  static const _kReport = "gw_health_report_prefs";

  static Future<SharedPreferences> get _p => SharedPreferences.getInstance();

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
  }

  static Future<void> deleteVital(String id) async {
    final all = await vitals()
      ..removeWhere((e) => e.id == id);
    await (await _p)
        .setString(_kVitals, jsonEncode(all.map((e) => e.toJson()).toList()));
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
  }

  // ---- Medical ID -----------------------------------------------------------

  static Future<MedicalId> medicalId() async {
    final raw = (await _p).getString(_kMedId);
    if (raw == null || raw.isEmpty) return MedicalId.empty();
    return MedicalId.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  static Future<void> saveMedicalId(MedicalId m) async {
    await (await _p).setString(_kMedId, jsonEncode(m.toJson()));
  }

  // ---- Report include/exclude prefs ----------------------------------------

  static Future<ReportPrefs> reportPrefs() async {
    final raw = (await _p).getString(_kReport);
    if (raw == null || raw.isEmpty) return ReportPrefs.all();
    return ReportPrefs.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }

  static Future<void> saveReportPrefs(ReportPrefs p) async {
    await (await _p).setString(_kReport, jsonEncode(p.toJson()));
  }
}

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

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
