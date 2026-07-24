"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BadgeCheck,
  FlaskConical,
  Gamepad2,
  GraduationCap,
  LayoutGrid,
  ShieldAlert,
  Settings as SettingsIcon,
  Activity,
  Users,
  Wallet,
  MapPin,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface AdminLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface AdminNavSection {
  heading: string;
  hint: string;
  links: AdminLink[];
}

/**
 * Grouped admin navigation: instead of one flat row of pills, links are
 * organised into labelled categories with a one-line hint so admins know
 * what each area is for.
 */
const SECTIONS: AdminNavSection[] = [
  {
    heading: "📊 ခြုံငုံသုံးသပ်ချက်",
    hint: "စာရင်းအင်း၊ ဂရပ်နဲ့ infographic များ",
    links: [
      { href: "/admin", label: "Overview", icon: BarChart3 },
      { href: "/admin/modules", label: "Modules", icon: LayoutGrid },
    ],
  },
  {
    heading: "👥 လူများ (People)",
    hint: "အသုံးပြုသူ၊ အသင်းဝင်၊ ဆရာများ စီမံ",
    links: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/map", label: "Users map", icon: MapPin },
      { href: "/admin/membership", label: "Membership", icon: BadgeCheck },
      { href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
    ],
  },
  {
    heading: "🛡 အကြောင်းအရာ ထိန်းသိမ်း (Moderation)",
    hint: "တိုင်ကြားချက်၊ ဂိမ်း အတည်ပြု",
    links: [
      { href: "/admin/moderation", label: "Moderation", icon: ShieldAlert },
      { href: "/admin/games", label: "Games", icon: Gamepad2 },
    ],
  },
  {
    heading: "💰 ငွေကြေး & စနစ် (Finance & System)",
    hint: "G-Pay ledger၊ site settings/theme",
    links: [
      { href: "/admin/gpay", label: "G-Pay", icon: Wallet },
      { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
      { href: "/admin/system", label: "System", icon: Activity },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="mb-5 space-y-3">
      {SECTIONS.map((section) => (
        <div key={section.heading}>
          <div className="mb-1 flex items-baseline gap-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section.heading}
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              — {section.hint}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 px-1">
            {section.links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/admin" && pathname.startsWith(link.href));
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-sm font-medium transition-colors hover:bg-secondary",
                    active && "border-primary bg-secondary text-primary",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Small icon legend so first-time admins know where things live. */
export function AdminGuide() {
  const items: { icon: LucideIcon; text: string }[] = [
    { icon: BarChart3, text: "Overview — DAU/MAU, ဝင်ငွေ၊ infographic" },
    { icon: Users, text: "Users — ရှာဖွေ၊ role ပြောင်း၊ ပိတ်ဆို့" },
    { icon: BadgeCheck, text: "Membership — အသင်းဝင် စီမံ" },
    { icon: GraduationCap, text: "Teachers — ဆရာ လျှောက်လွှာ အတည်ပြု" },
    { icon: ShieldAlert, text: "Moderation — တိုင်ကြားချက် ဆုံးဖြတ်" },
    { icon: Gamepad2, text: "Games — community ဂိမ်း အတည်ပြု" },
    { icon: Wallet, text: "G-Pay — ငွေစာရင်း ledger" },
    { icon: SettingsIcon, text: "Settings — site name/theme/flags" },
  ];
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="mb-2 flex items-center gap-1.5 font-semibold">
        <FlaskConical className="h-4 w-4 text-primary" /> Admin လမ်းညွှန်
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.text} className="flex items-start gap-2 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{it.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
