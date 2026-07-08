"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { updateSiteTheme } from "@/lib/actions/admin";
import { SITE_THEMES, THEME_PREVIEW, type SiteTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * The three site templates as clickable preview cards. Picking one updates
 * site_settings and re-renders the whole app with the new palette.
 */
export function ThemePicker({ current }: { current: SiteTheme }) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [saving, setSaving] = React.useState<SiteTheme | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function pick(theme: SiteTheme) {
    if (theme === current || pending) return;
    setSaving(theme);
    setError(null);
    startTransition(async () => {
      const result = await updateSiteTheme(theme);
      if (!result.ok) setError(result.error);
      setSaving(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        {SITE_THEMES.map((theme) => {
          const preview = THEME_PREVIEW[theme];
          const active = theme === current;
          return (
            <button
              key={theme}
              type="button"
              onClick={() => pick(theme)}
              disabled={pending}
              className={cn(
                "rounded-xl border-2 p-3 text-left transition-colors",
                active ? "border-primary bg-secondary" : "hover:bg-muted",
              )}
              aria-pressed={active}
            >
              <div className="mb-2 flex h-10 overflow-hidden rounded-lg">
                <span
                  className="flex-[3]"
                  style={{ backgroundColor: preview.primary }}
                />
                <span
                  className="flex-[2]"
                  style={{ backgroundColor: preview.accent }}
                />
                <span
                  className="flex-[2]"
                  style={{ backgroundColor: preview.secondary }}
                />
              </div>
              <p className="flex items-center gap-1 text-sm font-semibold">
                {saving === theme ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : active ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : null}
                {t(`theme_${theme}`)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(`themeDesc_${theme}`)}
              </p>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
