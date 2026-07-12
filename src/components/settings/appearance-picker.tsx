"use client";

import * as React from "react";
import { Check } from "lucide-react";

import {
  APPEARANCE_KEY,
  USER_APPEARANCES,
  type UserAppearanceId,
} from "@/lib/appearance";
import { cn } from "@/lib/utils";

/**
 * Per-user eye-friendly theme picker. Writes the choice to localStorage and
 * applies it instantly by stamping data-theme on <html>; "Default" clears the
 * override and restores the admin site theme (passed as `adminTheme`). An
 * inline script in the root layout re-applies the saved choice before paint so
 * there's no flash on reload.
 */
export function AppearancePicker({ adminTheme }: { adminTheme: string }) {
  const [selected, setSelected] = React.useState<UserAppearanceId>("default");

  React.useEffect(() => {
    const saved = localStorage.getItem(APPEARANCE_KEY) as UserAppearanceId | null;
    if (saved && USER_APPEARANCES.some((a) => a.id === saved)) {
      setSelected(saved);
    }
  }, []);

  function apply(id: UserAppearanceId) {
    setSelected(id);
    const root = document.documentElement;
    if (id === "default") {
      localStorage.removeItem(APPEARANCE_KEY);
      if (adminTheme && adminTheme !== "greenwave") {
        root.setAttribute("data-theme", adminTheme);
      } else {
        root.removeAttribute("data-theme");
      }
    } else {
      localStorage.setItem(APPEARANCE_KEY, id);
      root.setAttribute("data-theme", id);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium">🎨 အသွင်အပြင် (Appearance)</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {USER_APPEARANCES.map((a) => {
          const active = selected === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => apply(a.id)}
              className={cn(
                "relative overflow-hidden rounded-xl border p-3 text-left transition-colors hover:bg-muted",
                active && "border-primary ring-2 ring-primary/40",
              )}
            >
              <div className="mb-2 flex gap-1">
                {a.swatch.map((c) => (
                  <span
                    key={c}
                    className="h-6 w-6 rounded-md border border-black/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <p className="flex items-center gap-1 text-sm font-medium">
                {a.label}
                {active ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
              </p>
              <p className="text-[11px] text-muted-foreground">{a.desc}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        မျက်လုံးသက်သာစေတဲ့ dark theme များ — ဒီ device မှာသာ သိမ်းထားပါမယ်။
      </p>
    </div>
  );
}
