"use client";

import * as React from "react";
import Link from "next/link";
import {
  Banknote,
  Droplets,
  FlaskConical,
  Lock,
  Ruler,
  Scale,
  Search,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const TOOLS = [
  { id: "ec", href: "/tools/ec-converter", icon: Zap, memberOnly: false },
  { id: "vpd", href: "/tools/vpd", icon: Droplets, memberOnly: false },
  {
    id: "nutrient",
    href: "/tools/nutrient-calculator",
    icon: FlaskConical,
    memberOnly: true,
  },
  {
    id: "yield",
    href: "/tools/yield-estimator",
    icon: Scale,
    memberOnly: true,
  },
  { id: "units", href: "/tools/converters", icon: Ruler, memberOnly: false },
  { id: "currency", href: "/tools/currency", icon: Banknote, memberOnly: false },
  { id: "profit", href: "/tools/profit", icon: TrendingUp, memberOnly: false },
] as const;

export function ToolsIndex({ isMember }: { isMember: boolean }) {
  const t = useTranslations("tools");
  const [query, setQuery] = React.useState("");

  const visible = TOOLS.filter((tool) => {
    if (!query.trim()) return true;
    const haystack =
      `${t(`items.${tool.id}.name`)} ${t(`items.${tool.id}.description`)}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-56 rounded-full border bg-background py-1.5 pl-9 pr-4 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((tool) => {
          const Icon = tool.icon;
          const locked = tool.memberOnly && !isMember;
          return (
            <Link
              key={tool.id}
              href={locked ? "/membership" : tool.href}
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-background p-4 transition-shadow hover:shadow-md",
                locked && "opacity-80",
              )}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold">
                  {t(`items.${tool.id}.name`)}
                  {tool.memberOnly ? (
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        locked
                          ? "bg-muted text-muted-foreground"
                          : "bg-secondary text-primary",
                      )}
                    >
                      {locked ? <Lock className="h-3 w-3" /> : null}
                      {t("memberOnly")}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {t(`items.${tool.id}.description`)}
                </span>
              </span>
            </Link>
          );
        })}
        {visible.length === 0 ? (
          <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
