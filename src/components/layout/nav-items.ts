import {
  BadgeCheck,
  BookOpen,
  Calculator,
  Flag,
  Flower2,
  Gamepad2,
  Gem,
  Home,
  LayoutGrid,
  Leaf,
  Lightbulb,
  Radio,
  ShoppingCart,
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

export const PRIMARY_NAV: NavItem[] = [
  { href: "/feed", labelKey: "home", icon: Home },
  { href: "/friends", labelKey: "friends", icon: Users },
  { href: "/groups", labelKey: "groups", icon: LayoutGrid },
  { href: "/pages", labelKey: "pages", icon: Flag },
  { href: "/live", labelKey: "live", icon: Radio },
  { href: "/games", labelKey: "games", icon: Gamepad2 },
];

export const TOOL_NAV: NavItem[] = [
  { href: "/membership", labelKey: "membership", icon: BadgeCheck },
  { href: "/learn", labelKey: "learn", icon: BookOpen },
  { href: "/wellness", labelKey: "wellness", icon: Flower2 },
  // Strain database covers cannabis → verified adults only.
  { href: "/strains", labelKey: "strains", icon: Leaf, adultOnly: true },
  { href: "/minerals", labelKey: "minerals", icon: Gem },
  { href: "/tools", labelKey: "tools", icon: Calculator },
  // Grow-operation monitoring → verified adults only.
  { href: "/farm", labelKey: "farm", icon: Sprout, adultOnly: true },
  { href: "/home", labelKey: "smartHome", icon: Lightbulb },
  { href: "/cameras", labelKey: "cameras", icon: Video },
  { href: "/pos", labelKey: "pos", icon: ShoppingCart },
  { href: "/shop", labelKey: "shop", icon: Store },
  { href: "/gpay", labelKey: "gpay", icon: Wallet },
];

/** Routes that require a verified adult (18+). Enforced by requireAdult(). */
export const ADULT_ONLY_ROUTES = ["/strains", "/farm"];

/** Filter nav items by the viewer's adult status. */
export function visibleNav(items: NavItem[], isAdult: boolean): NavItem[] {
  return items.filter((item) => !(item.adultOnly && !isAdult));
}
