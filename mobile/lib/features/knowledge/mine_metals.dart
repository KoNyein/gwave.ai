import 'package:flutter/material.dart';

/// Mineral metadata for the native mine-site map.
///
/// Mirrors `src/components/knowledge/mine-data.ts` on the web so a pin looks
/// the same in the app and in the browser — same order, same colour, same
/// emoji. When one side gains a mineral, add it to both.
class MineMetal {
  const MineMetal({
    required this.key,
    required this.emoji,
    required this.color,
    required this.en,
    required this.my,
    required this.th,
  });

  /// The value stored in `mine_sites.metal` — must match the SQL CHECK list.
  final String key;
  final String emoji;
  final Color color;
  final String en;
  final String my;
  final String th;
}

const List<MineMetal> kMineMetals = [
  MineMetal(
    key: "tin",
    emoji: "⚙️",
    color: Color(0xFF64748B),
    en: "Tin",
    my: "ခဲမဖြူ (Tin)",
    th: "ดีบุก (Tin)",
  ),
  MineMetal(
    key: "antimony",
    emoji: "🜍",
    color: Color(0xFF7C3AED),
    en: "Antimony",
    my: "ခနောက်စိမ်း (Antimony)",
    th: "พลวง (Antimony)",
  ),
  MineMetal(
    key: "rare_earth",
    emoji: "🧲",
    color: Color(0xFF0EA5E9),
    en: "Rare earth",
    my: "ရှားပါးမြေ (Rare earth)",
    th: "แร่หายาก",
  ),
  MineMetal(
    key: "tungsten",
    emoji: "🔩",
    color: Color(0xFF475569),
    en: "Tungsten",
    my: "ဝူဖရမ် (Tungsten)",
    th: "ทังสเตน",
  ),
  MineMetal(
    key: "copper",
    emoji: "🟠",
    color: Color(0xFFC2410C),
    en: "Copper",
    my: "ကြေးနီ (Copper)",
    th: "ทองแดง",
  ),
  MineMetal(
    key: "gold",
    emoji: "🥇",
    color: Color(0xFFD97706),
    en: "Gold",
    my: "ရွှေ (Gold)",
    th: "ทองคำ",
  ),
  MineMetal(
    key: "zinc_lead",
    emoji: "🔗",
    color: Color(0xFF6B7280),
    en: "Zinc / Lead",
    my: "သွပ် / ခဲ (Zinc / Lead)",
    th: "สังกะสี / ตะกั่ว",
  ),
  MineMetal(
    key: "nickel",
    emoji: "🪙",
    color: Color(0xFF0891B2),
    en: "Nickel",
    my: "နီကယ် (Nickel)",
    th: "นิกเกิล",
  ),
  MineMetal(
    key: "jade",
    emoji: "💚",
    color: Color(0xFF059669),
    en: "Jade",
    my: "ကျောက်စိမ်း (Jade)",
    th: "หยก",
  ),
  MineMetal(
    key: "ruby",
    emoji: "❤️",
    color: Color(0xFFDC2626),
    en: "Ruby",
    my: "ပတ္တမြား (Ruby)",
    th: "ทับทิม",
  ),
  MineMetal(
    key: "sapphire",
    emoji: "💙",
    color: Color(0xFF2563EB),
    en: "Sapphire",
    my: "နီလာ (Sapphire)",
    th: "ไพลิน",
  ),
  MineMetal(
    key: "amber",
    emoji: "🟡",
    color: Color(0xFFCA8A04),
    en: "Amber",
    my: "ပယင်း (Amber)",
    th: "อำพัน",
  ),
  MineMetal(
    key: "coal",
    emoji: "⬛",
    color: Color(0xFF334155),
    en: "Coal",
    my: "ကျောက်မီးသွေး (Coal)",
    th: "ถ่านหิน",
  ),
  MineMetal(
    key: "silver",
    emoji: "🥈",
    color: Color(0xFF94A3B8),
    en: "Silver",
    my: "ငွေ (Silver)",
    th: "เงิน",
  ),
  MineMetal(
    key: "iron",
    emoji: "🧱",
    color: Color(0xFF991B1B),
    en: "Iron",
    my: "သံ (Iron)",
    th: "เหล็ก",
  ),
  MineMetal(
    key: "other",
    emoji: "⛏",
    color: Color(0xFF6B7280),
    en: "Other",
    my: "အခြား (Other)",
    th: "อื่น ๆ",
  ),
];

/// Never returns null: an unknown key from a newer server build falls back to
/// "other" so the map still draws the pin instead of crashing on it.
MineMetal metalOf(String? key) {
  for (final m in kMineMetals) {
    if (m.key == key) return m;
  }
  return kMineMetals.last;
}

/// Scale and status are short enough to keep as inline tables rather than
/// their own classes; both mirror the SQL CHECK lists.
const Map<String, List<String>> kMineScales = {
  // key: [en, my, th]
  "artisanal": ["Artisanal / hand dug", "ရိုးရာ / လက်လုပ်", "ทำมือ / ดั้งเดิม"],
  "small": ["Small scale", "သေးစား", "ขนาดเล็ก"],
  "industrial": ["Industrial", "စက်မှုလုပ်ငန်း", "อุตสาหกรรม"],
  "unknown": ["Unknown", "မသိရသေး", "ไม่ทราบ"],
};

const Map<String, List<String>> kMineStatuses = {
  "active": ["Active", "လုပ်ကိုင်ဆဲ", "เปิดดำเนินการ"],
  "seasonal": ["Seasonal", "ရာသီအလိုက်", "ตามฤดูกาล"],
  "suspended": ["Suspended", "ခေတ္တရပ်", "หยุดชั่วคราว"],
  "abandoned": ["Abandoned", "စွန့်ပစ်ပြီး", "ถูกทิ้งร้าง"],
  "unknown": ["Unknown", "မသိရသေး", "ไม่ทราบ"],
};

/// Status colour: a working mine and an abandoned pit are different news, so
/// the badge carries that without the user reading the label.
Color statusColor(String? status) {
  switch (status) {
    case "active":
      return const Color(0xFF16A34A);
    case "seasonal":
      return const Color(0xFF0891B2);
    case "suspended":
      return const Color(0xFFD97706);
    case "abandoned":
      return const Color(0xFF6B7280);
    default:
      return const Color(0xFF94A3B8);
  }
}
