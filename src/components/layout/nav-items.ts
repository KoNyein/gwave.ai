import {
  BadgeCheck,

  Gem,
  Home,
  LayoutGrid,
  Leaf,
  Lightbulb,
  ShoppingCart,
  Sprout,
  Users,
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
];

export const TOOL_NAV: NavItem[] = [
  { href: "/membership", labelKey: "membership", icon: BadgeCheck },

  { href: "/home", labelKey: "smartHome", icon: Lightbulb },
  { href: "/pos", labelKey: "pos", icon: ShoppingCart },
];

/** Routes that require a verified adult (18+). Enforced by requireAdult(). */
export const ADULT_ONLY_ROUTES = ["/strains", "/farm"];

/** Filter nav items by the viewer's adult status. */
export function visibleNav(items: NavItem[], isAdult: boolean): NavItem[] {
  return items.filter((item) => !(item.adultOnly && !isAdult));
}
