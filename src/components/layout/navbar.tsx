"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { GlobalSearch } from "@/components/layout/global-search";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { PRIMARY_NAV } from "@/components/layout/nav-items";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

export function Navbar({ profile }: { profile: Profile | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4">
        {/* Left: logo + search */}
        <div className="flex items-center gap-2">
          <Link href="/feed" className="flex items-center gap-1.5 text-primary">
            <Leaf className="h-8 w-8" />
            <span className="hidden text-lg font-bold sm:inline">gwave.ai</span>
          </Link>
          <GlobalSearch />
        </div>

        {/* Center: primary nav */}
        <nav className="mx-auto flex items-center gap-1">
          {PRIMARY_NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={t(item.labelKey)}
                className={cn(
                  "flex h-10 w-14 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted sm:w-20",
                  active && "text-primary",
                )}
              >
                <Icon className="h-6 w-6" />
              </Link>
            );
          })}
        </nav>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          <LocaleSwitcher />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={t("messages")}
            asChild
          >
            <Link href="/messages">
              <MessageCircle className="h-5 w-5" />
            </Link>
          </Button>
          {profile ? <NotificationsButton userId={profile.id} /> : null}
          <ProfileMenu profile={profile} />
        </div>
      </div>
    </header>
  );
}
