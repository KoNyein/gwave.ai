"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { GlobalSearch } from "@/components/layout/global-search";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { NotificationsButton } from "@/components/layout/notifications-button";
import { PRIMARY_NAV } from "@/components/layout/nav-items";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { TimezoneSync } from "@/components/layout/timezone-sync";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

export function Navbar({ profile }: { profile: Profile | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    // 📐 viewportFit:"cover" မို့ standalone PWA မှာ status bar က header ကို
    // ဖုံးတယ် — safe-area ကို header ကိုယ်တိုင် ယူထားတယ်။
    <header
      className="sticky top-0 z-40 border-b bg-background"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {profile ? <TimezoneSync /> : null}
      <div className="flex h-14 items-center gap-1 px-2 sm:gap-2 sm:px-4">
        {/* Left: menu (mobile) + logo + search */}
        <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
          <MobileMenu profile={profile} />
          <Link
            href="/feed"
            aria-label="Gwave"
            className="flex shrink-0 items-center gap-1.5 text-primary"
          >
            <Leaf className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="hidden text-lg font-bold sm:inline">Gwave</span>
          </Link>
          <GlobalSearch />
        </div>

        {/* Center: primary nav (desktop — mobile uses the bottom bar) */}
        <nav className="mx-auto hidden items-center gap-1 lg:flex">
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

        {/* Right: actions
            📐 ဖုန်းမှာ icon ခလုတ် ၅ ခုက အရမ်း ကြပ်တယ် (360px ဖုန်းမှာ
            ခလုတ်တွေ အချင်းချင်း ကပ်နေပြီး မှားနှိပ်တတ်တယ်)。 အသွင်အပြင်နဲ့
            ဘာသာစကားက ခဏခဏ သုံးတာ မဟုတ်လို့ ☰ drawer ထဲ ရွှေ့လိုက်တယ် —
            ဖုန်းမှာ ခလုတ် ၃ ခုပဲ ကျန်တယ်။ */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <div className="hidden items-center gap-1 sm:flex">
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
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
