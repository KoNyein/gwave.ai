import {
  BadgeCheck,
  LayoutDashboard,
  BookOpen,
  Calculator,
  Clapperboard,
  Flag,
  Flower2,
  Gamepad2,
  Gem,
  HeartPulse,
  Briefcase,
  Home,
  LayoutGrid,
  Landmark,
  Leaf,
  Lightbulb,
  Map,
  MapPin,
  Radio,
  Rocket,
  ShoppingCart,
  Siren,
  Trophy,
  Wallet,
  Sprout,
  Store,
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
      { href: "/games", labelKey: "games", icon: Gamepad2 },
    ],
  },
  {
    headingKey: "sectionLearn",
    items: [
      { href: "/learn", labelKey: "learn", icon: BookOpen },
      { href: "/leaderboard", labelKey: "leaderboard", icon: Trophy },
      { href: "/wellness", labelKey: "wellness", icon: Flower2 },
      { href: "/health", labelKey: "health", icon: HeartPulse },
    ],
  },
  {
    headingKey: "sectionFarm",
    items: [
      // Grow-operation monitoring → verified adults only.
      { href: "/farm", labelKey: "farm", icon: Sprout, adultOnly: true },
      { href: "/home", labelKey: "smartHome", icon: Lightbulb },
      { href: "/cameras", labelKey: "cameras", icon: Video },
      { href: "/family", labelKey: "family", icon: MapPin },
      { href: "/map", labelKey: "map", icon: Map },
      // Emergency SOS lives on the map; surface it directly for fast access.
      { href: "/map", labelKey: "sos", icon: Siren },
    ],
  },
  {
    headingKey: "sectionBusiness",
    items: [
      { href: "/shop", labelKey: "shop", icon: Store },
      { href: "/jobs", labelKey: "jobs", icon: Briefcase },
      { href: "/pos", labelKey: "pos", icon: ShoppingCart },
      { href: "/boost", labelKey: "boost", icon: Rocket },
      { href: "/gpay", labelKey: "gpay", icon: Wallet },
      { href: "/finance", labelKey: "finance", icon: Landmark },
      { href: "/membership", labelKey: "membership", icon: BadgeCheck },
    ],
  },
  {
    headingKey: "sectionKnowledge",
    items: [
      // Strain database covers cannabis → verified adults only.
      { href: "/strains", labelKey: "strains", icon: Leaf, adultOnly: true },
      { href: "/minerals", labelKey: "minerals", icon: Gem },
      { href: "/tools", labelKey: "tools", icon: Calculator },
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
