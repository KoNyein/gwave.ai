"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { PRIMARY_NAV } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-40 flex items-center justify-around border-t bg-background py-1 lg:hidden"
      // Keep the tab row clear of the iPhone home indicator when installed as a
      // standalone PWA (viewport-fit=cover). Falls back to the normal py-1.
      style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
    >
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
              "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground",
              active && "text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
