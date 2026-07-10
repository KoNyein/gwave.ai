"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  PRIMARY_NAV,
  TOOL_NAV,
  visibleNav,
} from "@/components/layout/nav-items";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ageBandOf } from "@/lib/age";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

/**
 * Full navigation drawer for phones & tablets. The left sidebar (which holds
 * every tool feature) is desktop-only, so on smaller screens this hamburger is
 * the way to reach Learn, G-Pay, Reels, Family, Finance, Cameras, Shop, etc.
 */
export function MobileMenu({ profile }: { profile: Profile | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const isAdult = ageBandOf(profile?.birth_date ?? null) === "adult";
  const primary = visibleNav(PRIMARY_NAV, isAdult);
  const tools = visibleNav(TOOL_NAV, isAdult);
  const initials = (profile?.username ?? "U").slice(0, 2).toUpperCase();

  // Close on route change + lock body scroll while open.
  React.useEffect(() => setOpen(false), [pathname]);
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const renderItem = (item: (typeof primary)[number]) => {
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
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Scrim */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Panel */}
          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-3 py-3">
              <Link
                href="/profile"
                className="flex items-center gap-2 font-semibold"
              >
                <Avatar className="h-9 w-9">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt="" />
                  ) : null}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span className="truncate">
                  {profile?.full_name ?? profile?.username ?? t("profile")}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1 p-2">
              {primary.map(renderItem)}
              <div className="my-2 border-t" />
              {tools.map(renderItem)}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
