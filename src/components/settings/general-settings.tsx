"use client";

import Link from "next/link";
import { useTransition } from "react";
import { LayoutDashboard } from "lucide-react";
import { useLocale } from "next-intl";

import { setLocale } from "@/app/actions/locale";
import { LOCALE_LABELS, locales } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Settings → General: app-wide preferences that aren't tied to the profile
 * row — display language (stored in the locale cookie) and quick links.
 */
export function GeneralSettings() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium">🌐 ဘာသာစကား (Language)</p>
        <div className="flex flex-wrap gap-2">
          {locales.map((l) => (
            <button
              key={l}
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => setLocale(l))}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
                l === locale &&
                  "border-primary bg-primary/10 text-primary",
              )}
            >
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Menu နဲ့ စာသားများ ရွေးထားတဲ့ ဘာသာစကားနဲ့ ပြပါမယ်။
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">📊 ကိုယ်ပိုင် စာရင်းချုပ်</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          <LayoutDashboard className="h-4 w-4 text-primary" />
          My Dashboard ကြည့်ရန်
        </Link>
      </div>
    </div>
  );
}
