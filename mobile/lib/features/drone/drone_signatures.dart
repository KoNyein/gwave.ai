/// A ready reference database of drone / controller / RC-link radio signatures.
///
/// The live scanner matches what it hears (Wi-Fi SSIDs, MAC OUIs, BLE names,
/// Remote ID) against [kDroneSignatures] and [kVendorOui] to name a detection
/// and pull rich details. [kRfProtocols] documents every relevant radio link —
/// including the ones a phone physically cannot receive — so the "Signal
/// library" can teach the user what each technology is and whether it is
/// detectable without extra hardware.
///
/// All strings carry English + Burmese so the UI can localise with `tr`.

/// What kind of device a detection / signature is.
enum DroneKind { drone, controller, goggles, remoteId, unknown }

/// One catalogued device (a drone model, a controller, goggles…) with the
/// radio fingerprints the scanner can match on.
class DroneSignature {
  const DroneSignature({
    required this.vendor,
    required this.model,
    required this.kind,
    required this.patterns,
    required this.band,
    required this.protocol,
    required this.detectable,
    required this.noteEn,
    required this.noteMy,
  });

  final String vendor;
  final String model; // "" for a generic vendor entry
  final DroneKind kind;
  final List<String> patterns; // lowercase fragments in SSID / BLE name
  final String band; // "2.4 GHz", "2.4/5.8 GHz"…
  final String protocol; // "Wi-Fi", "OcuSync 3", "Remote ID", "ELRS"…
  final bool detectable; // can a stock phone sense this device's presence?
  final String noteEn;
  final String noteMy;

  String get title => model.isEmpty ? vendor : "$vendor $model";
}

/// A radio link / protocol reference entry (for the Signal library).
class RfProtocol {
  const RfProtocol({
    required this.name,
    required this.bands,
    required this.freq,
    required this.detectable,
    required this.descEn,
    required this.descMy,
  });

  final String name;
  final String bands; // "2.4 GHz", "900 MHz / 2.4 GHz"
  final String freq; // human freq range
  final bool detectable; // phone Wi-Fi/BLE can sense it?
  final String descEn;
  final String descMy;
}

/// Manufacturer MAC prefixes (OUI) → vendor. Best-effort; catches vendor
/// devices whose SSID doesn't say the brand.
const Map<String, String> kVendorOui = {
  "60:60:1f": "DJI",
  "34:d2:62": "DJI",
  "e4:7a:2c": "DJI",
  "48:1c:b9": "DJI",
  "90:03:b7": "Parrot",
  "a0:14:3d": "Parrot",
  "00:12:1c": "Parrot",
  "90:3a:e6": "Parrot",
  "00:12:c2": "Yuneec",
  "0c:ef:15": "Skydio",
};

/// The device signature catalogue. Order matters: more specific model patterns
/// come before generic vendor fallbacks so the first match wins.
const List<DroneSignature> kDroneSignatures = [
  // ---- DJI controllers / goggles (listed before drone fallbacks) ----------
  DroneSignature(
    vendor: "DJI",
    model: "RC Motion / FPV controller",
    kind: DroneKind.controller,
    patterns: ["rc motion", "rc-n1", "dji rc", "rc pro"],
    band: "OcuSync (2.4/5.8 GHz)",
    protocol: "OcuSync",
    detectable: false,
    noteEn: "DJI FPV/Avata controller. Links over OcuSync — not Wi-Fi/BLE.",
    noteMy: "DJI FPV/Avata ကွန်ထရိုလာ။ OcuSync နဲ့ချိတ် — Wi-Fi/BLE မဟုတ်။",
  ),
  DroneSignature(
    vendor: "DJI",
    model: "Goggles",
    kind: DroneKind.goggles,
    patterns: ["goggles", "dji-goggle"],
    band: "OcuSync (2.4/5.8 GHz)",
    protocol: "OcuSync",
    detectable: false,
    noteEn: "DJI FPV goggles. Video link is OcuSync, invisible to a phone.",
    noteMy: "DJI FPV မျက်မှန်။ ဗီဒီယို link က OcuSync၊ ဖုန်းက မမြင်နိုင်။",
  ),
  // ---- DJI drones ----------------------------------------------------------
  DroneSignature(
    vendor: "DJI",
    model: "Avata / Avata 2",
    kind: DroneKind.drone,
    patterns: ["avata"],
    band: "OcuSync 3 (2.4/5.8 GHz)",
    protocol: "OcuSync 3",
    detectable: false,
    noteEn: "Cinewhoop FPV drone. O3 link — needs an SDR to detect.",
    noteMy: "Cinewhoop FPV ဒရုန်း။ O3 link — ဖမ်းဖို့ SDR လိုသည်။",
  ),
  DroneSignature(
    vendor: "DJI",
    model: "Mavic",
    kind: DroneKind.drone,
    patterns: ["mavic"],
    band: "OcuSync (2.4/5.8 GHz)",
    protocol: "OcuSync",
    detectable: false,
    noteEn: "Folding camera drone. Broadcasts Remote ID on newer firmware.",
    noteMy: "ခေါက်သိမ်း ကင်မရာ ဒရုန်း။ firmware အသစ်မှာ Remote ID ထုတ်သည်။",
  ),
  DroneSignature(
    vendor: "DJI",
    model: "Mini",
    kind: DroneKind.drone,
    patterns: ["dji mini", "dji-mini"],
    band: "OcuSync / Wi-Fi",
    protocol: "OcuSync / Wi-Fi",
    detectable: true,
    noteEn: "Sub-250g drone. Some Mini variants use Wi-Fi and are detectable.",
    noteMy: "၂၅၀g အောက် ဒရုန်း။ Mini အချို့ Wi-Fi သုံးလို့ ဖမ်းနိုင်သည်။",
  ),
  DroneSignature(
    vendor: "DJI",
    model: "Air",
    kind: DroneKind.drone,
    patterns: ["air2", "air 2", "dji air"],
    band: "OcuSync (2.4/5.8 GHz)",
    protocol: "OcuSync",
    detectable: false,
    noteEn: "Mid-range camera drone. OcuSync link.",
    noteMy: "အလယ်တန်း ကင်မရာ ဒရုန်း။ OcuSync link။",
  ),
  DroneSignature(
    vendor: "DJI",
    model: "Phantom",
    kind: DroneKind.drone,
    patterns: ["phantom"],
    band: "Lightbridge / OcuSync",
    protocol: "OcuSync",
    detectable: false,
    noteEn: "Classic large camera drone.",
    noteMy: "ရိုးရာ ကင်မရာ ဒရုန်း ကြီး။",
  ),
  DroneSignature(
    vendor: "DJI",
    model: "Neo",
    kind: DroneKind.drone,
    patterns: ["dji neo", "dji-neo"],
    band: "Wi-Fi / OcuSync",
    protocol: "Wi-Fi / O4",
    detectable: true,
    noteEn: "Tiny selfie drone; Wi-Fi control mode is detectable.",
    noteMy: "အသေးစား selfie ဒရုန်း; Wi-Fi mode ဆို ဖမ်းနိုင်သည်။",
  ),
  DroneSignature(
    vendor: "DJI (Ryze)",
    model: "Tello",
    kind: DroneKind.drone,
    patterns: ["tello"],
    band: "2.4 GHz Wi-Fi",
    protocol: "Wi-Fi",
    detectable: true,
    noteEn: "Educational Wi-Fi drone — creates a Wi-Fi hotspot, detectable.",
    noteMy: "ပညာရေး Wi-Fi ဒရုန်း — Wi-Fi hotspot လုပ်လို့ ဖမ်းနိုင်သည်။",
  ),
  DroneSignature(
    vendor: "DJI",
    model: "FPV",
    kind: DroneKind.drone,
    patterns: ["dji-fpv", "djifpv"],
    band: "OcuSync 3 (2.4/5.8 GHz)",
    protocol: "OcuSync 3",
    detectable: false,
    noteEn: "DJI FPV racing drone. O3 link.",
    noteMy: "DJI FPV ပြိုင်ပွဲ ဒရုန်း။ O3 link။",
  ),
  DroneSignature(
    vendor: "DJI",
    model: "",
    kind: DroneKind.drone,
    patterns: ["dji"],
    band: "OcuSync / Wi-Fi",
    protocol: "DJI",
    detectable: true,
    noteEn: "DJI device. Wi-Fi models are detectable; OcuSync models are not.",
    noteMy: "DJI စက်။ Wi-Fi model ဆို ဖမ်းနိုင်၊ OcuSync model ဆို မဖမ်းနိုင်။",
  ),
  // ---- Other camera-drone vendors -----------------------------------------
  DroneSignature(
    vendor: "Parrot",
    model: "Anafi",
    kind: DroneKind.drone,
    patterns: ["anafi", "parrot", "bebop"],
    band: "2.4/5 GHz Wi-Fi",
    protocol: "Wi-Fi",
    detectable: true,
    noteEn: "Parrot drones use Wi-Fi control — detectable by SSID/OUI.",
    noteMy: "Parrot ဒရုန်းများ Wi-Fi သုံး — SSID/OUI ဖြင့် ဖမ်းနိုင်။",
  ),
  DroneSignature(
    vendor: "Autel",
    model: "EVO",
    kind: DroneKind.drone,
    patterns: ["evo", "autel"],
    band: "2.4/5.8 GHz",
    protocol: "SkyLink / Wi-Fi",
    detectable: true,
    noteEn: "Autel EVO series. Some modes are Wi-Fi detectable.",
    noteMy: "Autel EVO စီးရီး။ အချို့ mode Wi-Fi ဖြင့် ဖမ်းနိုင်။",
  ),
  DroneSignature(
    vendor: "Skydio",
    model: "",
    kind: DroneKind.drone,
    patterns: ["skydio"],
    band: "2.4/5 GHz Wi-Fi",
    protocol: "Wi-Fi",
    detectable: true,
    noteEn: "Autonomous camera drone.",
    noteMy: "အလိုအလျောက် ကင်မရာ ဒရုန်း။",
  ),
  DroneSignature(
    vendor: "Yuneec",
    model: "Typhoon",
    kind: DroneKind.drone,
    patterns: ["yuneec", "typhoon"],
    band: "2.4/5.8 GHz",
    protocol: "Wi-Fi",
    detectable: true,
    noteEn: "Yuneec camera drone.",
    noteMy: "Yuneec ကင်မရာ ဒရုန်း။",
  ),
  DroneSignature(
    vendor: "Hubsan",
    model: "",
    kind: DroneKind.drone,
    patterns: ["hubsan"],
    band: "2.4/5.8 GHz",
    protocol: "Wi-Fi",
    detectable: true,
    noteEn: "Hubsan hobby drone.",
    noteMy: "Hubsan ဝါသနာရှင် ဒရုန်း။",
  ),
  DroneSignature(
    vendor: "FIMI (Xiaomi)",
    model: "",
    kind: DroneKind.drone,
    patterns: ["fimi"],
    band: "2.4/5.8 GHz",
    protocol: "Wi-Fi",
    detectable: true,
    noteEn: "FIMI / Xiaomi camera drone.",
    noteMy: "FIMI / Xiaomi ကင်မရာ ဒရုန်း။",
  ),
  DroneSignature(
    vendor: "Holy Stone",
    model: "",
    kind: DroneKind.drone,
    patterns: ["holy stone", "holystone"],
    band: "2.4 GHz Wi-Fi",
    protocol: "Wi-Fi",
    detectable: true,
    noteEn: "Toy/hobby Wi-Fi drone.",
    noteMy: "ကစားစရာ/ဝါသနာ Wi-Fi ဒရုန်း။",
  ),
  DroneSignature(
    vendor: "Potensic",
    model: "",
    kind: DroneKind.drone,
    patterns: ["potensic"],
    band: "2.4 GHz Wi-Fi",
    protocol: "Wi-Fi",
    detectable: true,
    noteEn: "Toy/hobby Wi-Fi drone.",
    noteMy: "ကစားစရာ/ဝါသနာ Wi-Fi ဒရုန်း။",
  ),
  // ---- Custom FPV / RC control links (not phone-detectable) ----------------
  DroneSignature(
    vendor: "RadioMaster",
    model: "TX16S / EdgeTX radio",
    kind: DroneKind.controller,
    patterns: ["radiomaster", "tx16s", "edgetx", "opentx"],
    band: "depends on module (900 MHz / 2.4 GHz)",
    protocol: "ELRS / Crossfire / FrSky",
    detectable: false,
    noteEn: "Hobby radio; the RF module (ELRS/Crossfire/FrSky) is not "
        "detectable by a phone — needs an SDR.",
    noteMy: "ဝါသနာ radio; RF module (ELRS/Crossfire/FrSky) ကို ဖုန်းက "
        "မဖမ်းနိုင် — SDR လိုသည်။",
  ),
  DroneSignature(
    vendor: "Generic FPV",
    model: "Freestyle / racing quad",
    kind: DroneKind.drone,
    patterns: ["betaflight", "fpv-quad", "walksnail"],
    band: "900 MHz / 2.4 GHz control · 5.8 GHz video",
    protocol: "ELRS / Crossfire / analog FPV",
    detectable: false,
    noteEn: "Custom FPV quad. Control + video links need an SDR to detect.",
    noteMy: "Custom FPV quad။ ထိန်းချုပ်+ဗီဒီယို link ဖမ်းဖို့ SDR လိုသည်။",
  ),
];

/// Radio-link reference (Signal library). Includes links a phone CANNOT hear,
/// clearly flagged, so the user understands the whole landscape.
const List<RfProtocol> kRfProtocols = [
  RfProtocol(
    name: "Remote ID (BLE / Wi-Fi)",
    bands: "2.4 GHz",
    freq: "BLE adv. + Wi-Fi beacon/NAN",
    detectable: true,
    descEn: "ASTM F3411 / Open Drone ID — the 'licence plate' modern drones "
        "broadcast. Carries operator ID and often live GPS. This is the "
        "highest-confidence signal a phone can read.",
    descMy: "ASTM F3411 / Open Drone ID — ခေတ်သစ် ဒရုန်းများ ထုတ်လွှင့်တဲ့ "
        "'ဆိုင်းဘုတ်'။ operator ID နဲ့ GPS ပါတတ်။ ဖုန်းဖမ်းနိုင်တဲ့ "
        "အယုံကြည်ရဆုံး signal။",
  ),
  RfProtocol(
    name: "Wi-Fi control (drone hotspot)",
    bands: "2.4 / 5 GHz",
    freq: "2412–5825 MHz",
    detectable: true,
    descEn: "Tello, older DJI Mini, Parrot, Autel, Hubsan, FIMI and toy "
        "drones control over Wi-Fi. The phone sees the SSID + MAC (OUI), "
        "band and channel.",
    descMy: "Tello၊ DJI Mini အဟောင်း၊ Parrot၊ Autel၊ Hubsan၊ FIMI နဲ့ "
        "ကစားစရာ ဒရုန်းများ Wi-Fi နဲ့ ထိန်းချုပ်။ ဖုန်းက SSID + MAC (OUI)၊ "
        "band, channel မြင်သည်။",
  ),
  RfProtocol(
    name: "DJI OcuSync (O2 / O3 / O4)",
    bands: "2.4 / 5.8 GHz",
    freq: "2400–2483, 5725–5850 MHz",
    detectable: false,
    descEn: "DJI's proprietary control + HD video link (Mavic, Air, Mini 3/4, "
        "DJI FPV, Avata). Frequency-hopping and encrypted — a phone radio "
        "can't tune or demodulate it. Needs an SDR / AeroScope-class receiver.",
    descMy: "DJI ရဲ့ သီးသန့် ထိန်းချုပ်+HD ဗီဒီယို link (Mavic, Air, Mini 3/4, "
        "DJI FPV, Avata)။ frequency-hopping + encrypt — ဖုန်းလှိုင်းက "
        "မဖမ်းနိုင်။ SDR / AeroScope receiver လိုသည်။",
  ),
  RfProtocol(
    name: "ExpressLRS (ELRS)",
    bands: "2.4 GHz / 900 MHz",
    freq: "2400–2480 or 868/915 MHz",
    detectable: false,
    descEn: "Open-source long-range RC control link for FPV quads. LoRa-based "
        "fast frequency hopping — invisible to Wi-Fi/BLE. Needs an SDR.",
    descMy: "FPV quad အတွက် open-source အဝေးထိန်း RC link။ LoRa အခြေခံ "
        "မြန်ဆန် hopping — Wi-Fi/BLE မမြင်နိုင်။ SDR လိုသည်။",
  ),
  RfProtocol(
    name: "TBS Crossfire / Tracer",
    bands: "900 MHz / 2.4 GHz",
    freq: "868/915 MHz · 2.4 GHz",
    detectable: false,
    descEn: "Team BlackSheep long-range control links. Proprietary FHSS — not "
        "detectable without an SDR.",
    descMy: "TBS အဝေးထိန်း control link များ။ သီးသန့် FHSS — SDR မပါဘဲ "
        "မဖမ်းနိုင်။",
  ),
  RfProtocol(
    name: "FrSky (ACCST / ACCESS / R9)",
    bands: "2.4 GHz / 900 MHz",
    freq: "2.4 GHz · 868/915 MHz",
    detectable: false,
    descEn: "Popular hobby RC protocol family. FHSS — needs an SDR to detect.",
    descMy: "လူသုံးများ ဝါသနာ RC protocol။ FHSS — ဖမ်းဖို့ SDR လိုသည်။",
  ),
  RfProtocol(
    name: "Spektrum DSMX / Flysky",
    bands: "2.4 GHz",
    freq: "2400–2483 MHz",
    detectable: false,
    descEn: "Other 2.4 GHz hobby RC protocols. FHSS, not Wi-Fi/BLE.",
    descMy: "အခြား ၂.၄GHz ဝါသနာ RC protocol။ FHSS၊ Wi-Fi/BLE မဟုတ်။",
  ),
  RfProtocol(
    name: "Analog / digital FPV video",
    bands: "5.8 GHz (also 1.3 GHz)",
    freq: "5645–5945 MHz",
    detectable: false,
    descEn: "The live video downlink from FPV quads (analog VTX or DJI/Walksnail "
        "digital). Needs a 5.8 GHz FPV receiver or SDR — a phone cannot see it.",
    descMy: "FPV quad ရဲ့ တိုက်ရိုက် ဗီဒီယို downlink (analog VTX (သို့) "
        "DJI/Walksnail digital)။ ၅.၈GHz receiver (သို့) SDR လို — ဖုန်းက မမြင်။",
  ),
];

/// Match a Wi-Fi SSID or BLE advertised name against the catalogue.
DroneSignature? matchSignature(String name) {
  final low = name.toLowerCase();
  for (final s in kDroneSignatures) {
    for (final p in s.patterns) {
      if (low.contains(p)) return s;
    }
  }
  return null;
}

/// Vendor from a MAC / BSSID via its OUI prefix.
String? vendorForOui(String bssid) {
  final b = bssid.toLowerCase();
  if (b.length < 8) return null;
  return kVendorOui[b.substring(0, 8)];
}
