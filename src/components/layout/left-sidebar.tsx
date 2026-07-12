"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { NAV_SECTIONS, visibleNav } from "@/components/layout/nav-items";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ageBandOf } from "@/lib/age";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

export function LeftSidebar({ profile }: { profile: Profile | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const isAdult = ageBandOf(profile?.birth_date ?? null) === "adult";
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: visibleNav(section.items, isAdult),
  })).filter((section) => section.items.length > 0);
  const initials = (profile?.username ?? "U").slice(0, 2).toUpperCase();

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto px-3 py-4 lg:block">
      <nav className="space-y-1">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-lg px-2 py-2 font-medium transition-colors hover:bg-muted"
        >
          <Avatar className="h-8 w-8">
            {profile?.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt="" />
            ) : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="truncate">
            {profile?.full_name ?? profile?.username ?? t("profile")}
          </span>
        </Link>

        {sections.map((section) => (
          <div key={section.headingKey}>
            <p className="mt-4 px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(section.headingKey)}
            </p>
            {section.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-2 font-medium transition-colors hover:bg-muted",
                    active && "bg-secondary text-primary",
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        ))}

        <div className="my-2 border-t" />
        <Link
          href="/help"
          className={cn(
            "flex items-center gap-3 rounded-lg px-2 py-2 font-medium transition-colors hover:bg-muted",
            pathname === "/help" && "bg-secondary text-primary",
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-primary">
            <HelpCircle className="h-5 w-5" />
          </span>
          အကူအညီ (Help)
        </Link>
      </nav>
    </aside>
  );
}
