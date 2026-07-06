import {
  Calculator,
  Flag,
  Home,
  LayoutGrid,
  ShoppingCart,
  Sprout,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/feed", labelKey: "home", icon: Home },
  { href: "/friends", labelKey: "friends", icon: Users },
  { href: "/groups", labelKey: "groups", icon: LayoutGrid },
  { href: "/pages", labelKey: "pages", icon: Flag },
];

export const TOOL_NAV: NavItem[] = [
  { href: "/tools", labelKey: "tools", icon: Calculator },
  { href: "/farm", labelKey: "farm", icon: Sprout },
  { href: "/pos", labelKey: "pos", icon: ShoppingCart },
];
