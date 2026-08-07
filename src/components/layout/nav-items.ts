import {
  BadgeCheck,
  Backpack,
  Boxes,
  Car,
  Earth,
  Globe2,
  LifeBuoy,
  Mountain,
  LayoutDashboard,
  BookOpen,
  Calculator,
  Clapperboard,
  Flag,
  Flower2,
  Gamepad2,
  Gem,
  GraduationCap,
  Joystick,
  ScanLine,
  HeartPulse,
  Briefcase,
  Home,
  LayoutGrid,
  Landmark,
  Leaf,
  Lightbulb,
  Map,
  MapPin,
  Music,
  Plane,
  PlayCircle,
  Presentation,
  Radio,
  Rocket,
  ShoppingCart,
  Siren,
  Trophy,
  Wallet,
  Sprout,
  Store,
  UserRound,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  /** Only shown to verified adults (18+). Hidden from minors/unknown DOB. */
  adultOnly?: boolean;
}

export interface NavSection {
  /** nav.<headingKey> i18n key for the section heading. */
  headingKey: string;
  items: NavItem[];
}

/**
 * The full menu, grouped by topic so long lists read as categories instead
 * of one flat wall of links.
 *
 * IA rules (user: "မဆိုင်မဆိုင် ခေါင်းစဉ်တွေနဲ့ မဖြစ်ပါစေနဲ့"):
 * every item sits under the heading a first-time user would guess —
 * health is not "Learning", SOS/map are not "Farm", ride is not "Home".
 * One item = one place (no duplicates across sections).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    headingKey: "sectionSocial",
    items: [
      { href: "/feed", labelKey: "home", icon: Home },
      { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
      { href: "/friends", labelKey: "friends", icon: Users },
      { href: "/groups", labelKey: "groups", icon: LayoutGrid },
      { href: "/pages", labelKey: "pages", icon: Flag },
      { href: "/live", labelKey: "live", icon: Radio },
      { href: "/talk", labelKey: "talk", icon: Radio },
      { href: "/reels", labelKey: "reels", icon: Clapperboard },
      { href: "/audio", labelKey: "audio", icon: Music },
    ],
  },
  {
    // 🌐 Metaverse & 3D — worlds, creation tools and scanners in one place
    headingKey: "sectionMetaverse",
    items: [
      // 🌍 လောက တစ်ခုတည်း — Social Metaverse ထဲက 🌏 ဂိတ်ကနေ Open World
      // ကို ကူးလို့ရ၊ Open World ကနေလည်း ပြန်ထွက်လို့ရ။ Open World ကို
      // တိုက်ရိုက်ဝင်ချင်သူအတွက် သီးခြား entry ကို ချန်ထားတယ်။
      { href: "/metaverse", labelKey: "metaverse", icon: Globe2 },
      { href: "/world", labelKey: "world", icon: Earth },
      // 🎛 One 3D workspace — Avatar + Scanner + World Builder are tabs of
      // /studio now, so the menu shows the tool, not three loose routes.
      { href: "/studio?tab=avatar", labelKey: "avatarStudio", icon: UserRound },
      { href: "/studio?tab=scan", labelKey: "scan3d", icon: ScanLine },
      { href: "/studio?tab=world", labelKey: "studio", icon: Boxes },
    ],
  },
  {
    // 🎮 Games — playing + the game economy
    headingKey: "sectionGames",
    items: [
      { href: "/games", labelKey: "games", icon: Gamepad2 },
      { href: "/drone", labelKey: "drone", icon: Plane },
      { href: "/fpv", labelKey: "fpv", icon: Joystick },
      { href: "/arcade", labelKey: "arcade", icon: GraduationCap },
      { href: "/items", labelKey: "itemshop", icon: Gem },
      { href: "/inventory", labelKey: "inventory", icon: Backpack },
    ],
  },
  {
    headingKey: "sectionLearn",
    items: [
      { href: "/learn", labelKey: "learn", icon: BookOpen },
      { href: "/leaderboard", labelKey: "leaderboard", icon: Trophy },
      // Both shipped in the app menu long before the web sidebar listed them.
      { href: "/meet", labelKey: "liveClass", icon: Presentation },
      { href: "/recordings", labelKey: "replays", icon: PlayCircle },
    ],
  },
  {
    // 🏥 Health & wellness — split out of "Learning" where it never belonged
    headingKey: "sectionHealth",
    items: [
      { href: "/health", labelKey: "health", icon: HeartPulse },
      { href: "/wellness", labelKey: "wellness", icon: Flower2 },
    ],
  },
  {
    // 🏠 Smart home & safety — devices, cameras, family location, SOS
    headingKey: "sectionHome",
    items: [
      { href: "/home", labelKey: "smartHome", icon: Lightbulb },
      { href: "/cameras", labelKey: "cameras", icon: Video },
      { href: "/family", labelKey: "family", icon: MapPin },
      { href: "/map", labelKey: "map", icon: Map },
      // Emergency SOS lives on the map; surface it directly for fast access.
      { href: "/map", labelKey: "sos", icon: Siren },
    ],
  },
  {
    // 💰 Money — wallet/banking/membership split from shopping
    headingKey: "sectionFinance",
    items: [
      { href: "/gpay", labelKey: "gpay", icon: Wallet },
      { href: "/finance", labelKey: "finance", icon: Landmark },
      { href: "/membership", labelKey: "membership", icon: BadgeCheck },
    ],
  },
  {
    // 🛍 Commerce & services
    headingKey: "sectionBusiness",
    items: [
      { href: "/shop", labelKey: "shop", icon: Store },
      { href: "/jobs", labelKey: "jobs", icon: Briefcase },
      { href: "/pos", labelKey: "pos", icon: ShoppingCart },
      { href: "/boost", labelKey: "boost", icon: Rocket },
      { href: "/ride", labelKey: "ride", icon: Car },
    ],
  },
  {
    headingKey: "sectionKnowledge",
    items: [
      { href: "/tools", labelKey: "tools", icon: Calculator },
      { href: "/minerals", labelKey: "minerals", icon: Gem },
      { href: "/metals", labelKey: "metals", icon: Mountain },
      { href: "/help", labelKey: "help", icon: LifeBuoy },
      // Grow-operation monitoring + strain database → verified adults only.
      { href: "/farm", labelKey: "farm", icon: Sprout, adultOnly: true },
      { href: "/strains", labelKey: "strains", icon: Leaf, adultOnly: true },
    ],
  },
];

/** Bottom mobile bar + navbar shortcuts: the social section. */
export const PRIMARY_NAV: NavItem[] =
  NAV_SECTIONS[0]?.items ?? [];

/** Everything outside the social section (legacy flat list). */
export const TOOL_NAV: NavItem[] = NAV_SECTIONS.slice(1).flatMap(
  (section) => section.items,
);

/** Routes that require a verified adult (18+). Enforced by requireAdult(). */
export const ADULT_ONLY_ROUTES = ["/strains", "/farm"];

/** Filter nav items by the viewer's adult status. */
export function visibleNav(items: NavItem[], isAdult: boolean): NavItem[] {
  return items.filter((item) => !(item.adultOnly && !isAdult));
}
