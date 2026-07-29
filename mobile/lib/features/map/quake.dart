import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config.dart';
import '../../core/i18n.dart';
import '../../core/theme.dart';

/// One earthquake, as served by gwave.cc/api/quakes (USGS underneath).
class Quake {
  Quake({
    required this.id,
    required this.mag,
    required this.place,
    required this.lat,
    required this.lng,
    required this.time,
    this.depthKm,
    this.url,
    this.tsunami = false,
  });

  final String id;
  final double mag;
  final String place;
  final double lat;
  final double lng;
  final DateTime time;
  final double? depthKm;
  final String? url;
  final bool tsunami;

  LatLng get point => LatLng(lat, lng);

  factory Quake.fromJson(Map<String, dynamic> j) => Quake(
        id: "${j["id"]}",
        mag: (j["mag"] as num?)?.toDouble() ?? 0,
        place: "${j["place"] ?? ""}",
        lat: (j["lat"] as num?)?.toDouble() ?? 0,
        lng: (j["lng"] as num?)?.toDouble() ?? 0,
        depthKm: (j["depthKm"] as num?)?.toDouble(),
        time: DateTime.fromMillisecondsSinceEpoch(
            (j["time"] as num?)?.toInt() ?? 0,
            isUtc: true),
        url: j["url"]?.toString(),
        tsunami: j["tsunami"] == true,
      );

  /// Severity colour, following the convention every quake map uses:
  /// small = green/amber, damaging = orange/red, major = dark red.
  Color get color => mag >= 7
      ? const Color(0xFF8B0000)
      : mag >= 6
          ? const Color(0xFFD32F2F)
          : mag >= 5
              ? const Color(0xFFF57C00)
              : mag >= 4
                  ? const Color(0xFFF9A825)
                  : const Color(0xFF7CB342);

  /// Marker radius in px — magnitude is logarithmic, so a linear ramp with a
  /// floor reads better on a map than anything "physically correct".
  double get radius => (10 + (mag - 2.5) * 4).clamp(10, 34).toDouble();
}

/// Fetch recent quakes. gwave.cc first (one cached answer serves everyone);
/// straight-to-USGS as fallback so the layer still works if the server route
/// is unreachable — an earthquake is exactly when infrastructure fails.
Future<List<Quake>> fetchQuakes({int hours = 72, double minMag = 2.5}) async {
  try {
    final res = await http
        .get(Uri.parse(
            "${AppConfig.apiBase}/api/quakes?hours=$hours&minmag=$minMag"))
        .timeout(const Duration(seconds: 10));
    if (res.statusCode == 200) {
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      final rows = (body["quakes"] as List?) ?? [];
      return rows
          .map((r) => Quake.fromJson(Map<String, dynamic>.from(r as Map)))
          .toList();
    }
  } catch (_) {}
  // Fallback: same box the server uses, straight from USGS.
  try {
    final start = DateTime.now()
        .toUtc()
        .subtract(Duration(hours: hours))
        .toIso8601String();
    final res = await http
        .get(Uri.parse(
            "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson"
            "&orderby=time&limit=300&starttime=$start&minmagnitude=$minMag"
            "&minlatitude=-12&maxlatitude=33&minlongitude=84&maxlongitude=112"))
        .timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) return [];
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final feats = (body["features"] as List?) ?? [];
    return feats.map((f) {
      final m = Map<String, dynamic>.from(f as Map);
      final props = Map<String, dynamic>.from(m["properties"] as Map);
      final coords = ((m["geometry"] as Map?)?["coordinates"] as List?) ?? [];
      return Quake.fromJson({
        "id": m["id"],
        "mag": props["mag"],
        "place": props["place"],
        "lng": coords.isNotEmpty ? coords[0] : 0,
        "lat": coords.length > 1 ? coords[1] : 0,
        "depthKm": coords.length > 2 ? coords[2] : null,
        "time": props["time"],
        "url": props["url"],
        "tsunami": (props["tsunami"] ?? 0) != 0,
      });
    }).toList();
  } catch (_) {
    return [];
  }
}

/// Dial through the phone app — works with no internet, which is the point.
void dialNumber(String number) {
  launchUrl(Uri.parse("tel:$number"));
}

const Distance _distance = Distance();

/// The quake that should interrupt the user, or null. "Should interrupt"
/// means recent AND either strong nearby or major anywhere in the region:
/// M≥4.5 within 300 km, M≥5.5 within 700 km, or M≥6.5 regardless — all
/// within the last 24 hours. Without a GPS fix only the M≥6.5 rule applies,
/// because distance can't be known and a silent miss is worse than none.
Quake? significantQuake(List<Quake> quakes, LatLng? me) {
  final cutoff = DateTime.now().toUtc().subtract(const Duration(hours: 24));
  Quake? worst;
  for (final q in quakes) {
    if (q.time.isBefore(cutoff)) continue;
    final km =
        me == null ? double.infinity : _distance.as(LengthUnit.Kilometer, me, q.point);
    final matters = q.mag >= 6.5 ||
        (q.mag >= 5.5 && km <= 700) ||
        (q.mag >= 4.5 && km <= 300);
    if (!matters) continue;
    if (worst == null || q.mag > worst.mag) worst = q;
  }
  return worst;
}

String quakeTimeAgo(BuildContext context, DateTime t) {
  final d = DateTime.now().toUtc().difference(t);
  if (d.inMinutes < 60) {
    return tr(context, "${d.inMinutes} min ago", "လွန်ခဲ့သော ${d.inMinutes} မိနစ်");
  }
  if (d.inHours < 24) {
    return tr(context, "${d.inHours} hr ago", "လွန်ခဲ့သော ${d.inHours} နာရီ");
  }
  return tr(context, "${d.inDays} d ago", "လွန်ခဲ့သော ${d.inDays} ရက်");
}

String quakeDistanceLabel(BuildContext context, Quake q, LatLng? me) {
  if (me == null) return "";
  final km = _distance.as(LengthUnit.Kilometer, me, q.point);
  return tr(context, "${km.round()} km from you",
      "သင့်ထံမှ ${km.round()} ကီလိုမီတာ");
}

/// The earthquake safety guide: what to do before, during and after, and the
/// rescue numbers that matter here. Static on purpose — this screen must
/// render with no signal, which is the situation it exists for.
class QuakeSafetyScreen extends StatelessWidget {
  const QuakeSafetyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: Text(tr(context, "Earthquake safety", "ငလျင် ဘေးကင်းရေး"))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
        children: [
          _phase(
            context,
            icon: Icons.schedule,
            color: GwColors.primary,
            title: tr(context, "Before", "မတိုင်မီ ပြင်ဆင်ထားရန်"),
            items: [
              tr(context, "Agree a family meeting point outside.",
                  "မိသားစု ပြင်ပတွေ့ဆုံရာနေရာ ကြိုတင်သတ်မှတ်ထားပါ။"),
              tr(context, "Keep a bag ready: water, torch, first aid, copies of documents.",
                  "အရေးပေါ်အိတ် — ရေ၊ ဓာတ်မီး၊ ဆေးသေတ္တာ၊ စာရွက်စာတမ်းမိတ္တူ။"),
              tr(context, "Fix heavy shelves to walls; keep beds away from windows.",
                  "စင်လေးလံများ နံရံနှင့်ချည်ထားပါ၊ အိပ်ရာကို ပြတင်းပေါက်နှင့်ဝေးဝေးထားပါ။"),
              tr(context, "Know where gas, water and electricity cut off.",
                  "ဓာတ်ငွေ့၊ ရေ၊ လျှပ်စစ် ပိတ်တဲ့နေရာကို သိထားပါ။"),
            ],
          ),
          _phase(
            context,
            icon: Icons.warning_amber_rounded,
            color: const Color(0xFFD32F2F),
            title: tr(context, "During — Drop, Cover, Hold on",
                "လှုပ်နေစဉ် — ဝပ်၊ ကွယ်၊ ဆုပ်ကိုင်"),
            items: [
              tr(context, "Drop to the ground, take cover under a sturdy table, hold on until shaking stops.",
                  "မြေပေါ်ဝပ်ပါ၊ ခိုင်ခံ့သောစားပွဲအောက် ခိုပါ၊ ရပ်သွားသည်အထိ ဆုပ်ကိုင်ထားပါ။"),
              tr(context, "Stay away from windows, mirrors and heavy furniture.",
                  "ပြတင်းပေါက်၊ မှန်၊ လေးလံသောပရိဘောဂများနှင့် ဝေးဝေးနေပါ။"),
              tr(context, "Do NOT run outside while it shakes — most injuries are from falling debris at exits.",
                  "လှုပ်နေစဉ် အပြင်မပြေးပါနှင့် — ထွက်ပေါက်များတွင် ကျလာသောအပျက်အစီးက အန္တရာယ်အများဆုံးပါ။"),
              tr(context, "In bed: stay, cover your head with a pillow.",
                  "အိပ်ရာထဲဆိုလျှင် — ခေါင်းအုံးဖြင့် ခေါင်းကာပြီး နေပါ။"),
              tr(context, "Outdoors: move to open ground away from buildings and power lines.",
                  "အပြင်ရောက်နေလျှင် — အဆောက်အအုံ၊ ဓာတ်ကြိုးများနှင့်ဝေးသော ကွင်းပြင်သို့ သွားပါ။"),
              tr(context, "Driving: pull over away from bridges; stay inside.",
                  "ကားမောင်းနေလျှင် — တံတားများနှင့်ဝေးရာတွင် ရပ်ပြီး ကားထဲမှာပဲ နေပါ။"),
            ],
          ),
          _phase(
            context,
            icon: Icons.healing,
            color: const Color(0xFFF57C00),
            title: tr(context, "After", "လှုပ်ပြီးနောက်"),
            items: [
              tr(context, "Expect aftershocks — each one, Drop-Cover-Hold again.",
                  "နောက်ဆက်တွဲငလျင်များ လာနိုင်သည် — တစ်ခါလှုပ်တိုင်း ဝပ်-ကွယ်-ဆုပ်ကိုင် ပြန်လုပ်ပါ။"),
              tr(context, "Check for injuries; give first aid before moving anyone.",
                  "ဒဏ်ရာစစ်ပါ — မရွှေ့မီ ရှေးဦးသူနာပြုပေးပါ။"),
              tr(context, "Smell gas? Open windows, leave, cut the supply. No flames or switches.",
                  "ဓာတ်ငွေ့နံ့ရလျှင် — ပြတင်းဖွင့်၊ ထွက်၊ ပိတ်ပါ။ မီးခြစ်/ခလုတ် လုံးဝမသုံးပါနှင့်။"),
              tr(context, "Leave damaged buildings; do not re-enter for belongings.",
                  "ပျက်စီးသောအဆောက်အအုံမှ ထွက်ပါ — ပစ္စည်းယူရန် ပြန်မဝင်ပါနှင့်။"),
              tr(context, "Near the coast after a strong quake: move to high ground — don't wait for a warning.",
                  "ပင်လယ်ကမ်းနီးလျှင် — ပြင်းထန်စွာလှုပ်ပြီးလျှင် သတိပေးချက်မစောင့်ဘဲ ကုန်းမြင့်သို့ တက်ပါ။"),
              tr(context, "Use SMS/Gwave offline chat rather than calls — lines are needed for rescue.",
                  "ဖုန်းခေါ်မည့်အစား SMS/Gwave offline chat သုံးပါ — ဖုန်းလိုင်းများကို ကယ်ဆယ်ရေးအတွက် ချန်ထားပါ။"),
            ],
          ),
          const SizedBox(height: 6),
          Text(tr(context, "Emergency numbers", "အရေးပေါ် ဖုန်းနံပါတ်များ"),
              style:
                  const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 8),
          _numbers(context, "🇲🇲 Myanmar", const [
            ("ရဲ (Police)", "199"),
            ("မီးသတ် (Fire)", "191"),
            ("လူနာတင်ယာဉ် (Ambulance)", "192"),
          ]),
          _numbers(context, "🇹🇭 Thailand", const [
            ("ตำรวจ (Police)", "191"),
            ("การแพทย์ฉุกเฉิน (Medical)", "1669"),
            ("ดับเพลิง (Fire)", "199"),
          ]),
          const SizedBox(height: 10),
          Text(
            tr(
              context,
              "Numbers dial through your phone app — they work without "
                  "internet. Gwave's SOS button shares your GPS with nearby "
                  "members and falls back to SMS when data is down.",
              "နံပါတ်များသည် ဖုန်း app မှတဆင့် ခေါ်ဆိုသည် — အင်တာနက်မလိုပါ။ "
                  "Gwave ၏ SOS ခလုတ်သည် သင့် GPS ကို အနီးရှိ အသင်းဝင်များထံ "
                  "မျှဝေပြီး ဒေတာလိုင်းကျနေလျှင် SMS သို့ အလိုအလျောက် "
                  "ပြောင်းပါသည်။",
            ),
            style: TextStyle(
                color: GwColors.inkSoftOf(context), fontSize: 12.5, height: 1.45),
          ),
        ],
      ),
    );
  }

  Widget _phase(
    BuildContext context, {
    required IconData icon,
    required Color color,
    required String title,
    required List<String> items,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(title,
                      style: TextStyle(
                          color: color,
                          fontWeight: FontWeight.w800,
                          fontSize: 15)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            for (final item in items)
              Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("•  ",
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    Expanded(
                      child: Text(item,
                          style: const TextStyle(fontSize: 13.5, height: 1.4)),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _numbers(
      BuildContext context, String region, List<(String, String)> rows) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(region,
                style: const TextStyle(
                    fontWeight: FontWeight.w800, fontSize: 13.5)),
            const SizedBox(height: 4),
            for (final (label, number) in rows)
              _DialRow(label: label, number: number),
          ],
        ),
      ),
    );
  }
}

class _DialRow extends StatelessWidget {
  const _DialRow({required this.label, required this.number});
  final String label;
  final String number;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => dialNumber(number),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Expanded(child: Text(label, style: const TextStyle(fontSize: 13.5))),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: GwColors.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.phone, size: 14, color: GwColors.primary),
                  const SizedBox(width: 5),
                  Text(number,
                      style: const TextStyle(
                          color: GwColors.primary,
                          fontWeight: FontWeight.w900)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
