"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Leaf, MessageCircle, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { PRIMARY_NAV } from "@/components/layout/nav-items";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("search")}
              aria-label={t("search")}
              className="w-56 rounded-full bg-muted pl-9 lg:w-72"
            />
          </div>
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
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("messages")}>
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("notifications")}>
            <Bell className="h-5 w-5" />
          </Button>
          <ProfileMenu profile={profile} />
        </div>
      </div>
    </header>
  );
}
