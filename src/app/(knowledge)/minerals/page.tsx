import Link from "next/link";
import { Gem } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";
import {
  getMineralCategories,
  listMinerals,
} from "@/lib/db/knowledge";
import { cn } from "@/lib/utils";
import type { Mineral } from "@/types/database";

interface SearchParams {
  q?: string;
  category?: string;
  page?: string;
}

function buildQuery(
  params: SearchParams,
  overrides: Partial<SearchParams>,
): string {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  if (merged.q) search.set("q", merged.q);
  if (merged.category) search.set("category", merged.category);
  if (merged.page && merged.page !== "1") search.set("page", merged.page);
  const encoded = search.toString();
  return encoded ? `/minerals?${encoded}` : "/minerals";
}

function MineralCard({ mineral }: { mineral: Mineral }) {
  return (
    <Link
      href={`/minerals/${mineral.slug}`}
      className="flex flex-col gap-2 rounded-xl border bg-background p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-tight">{mineral.name}</h3>
        {mineral.symbol ? (
          <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
            {mineral.symbol}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{mineral.category}</p>
      <p className="text-xs text-muted-foreground">
        Mohs {mineral.hardness_mohs ?? "–"} ·{" "}
        {mineral.density ? `${mineral.density} g/cm³` : "–"}
      </p>
      {mineral.uses.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {mineral.uses.slice(0, 2).map((use) => (
            <span
              key={use}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {use}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export default async function MineralsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations("minerals");
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [categories, result] = await Promise.all([
    getMineralCategories(),
    listMinerals({
      query: searchParams.q,
      category: searchParams.category,
      page,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <Gem className="h-5 w-5 text-primary" />
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <form action="/minerals" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={t("searchPlaceholder")}
            className="w-48 rounded-full border bg-background px-4 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </form>
      </div>

      {/* Category filter */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Link
            href={buildQuery(searchParams, { category: undefined, page: "1" })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              !searchParams.category
                ? "border-primary bg-secondary font-semibold text-primary"
                : "hover:bg-muted",
            )}
          >
            {t("allCategories")}
          </Link>
          {categories.map((category) => (
            <Link
              key={category}
              href={buildQuery(searchParams, { category, page: "1" })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                searchParams.category === category
                  ? "border-primary bg-secondary font-semibold text-primary"
                  : "hover:bg-muted",
              )}
            >
              {category}
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Grid */}
      {result.items.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {t("noResults")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((mineral) => (
            <MineralCard key={mineral.id} mineral={mineral} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-3">
        {page > 1 ? (
          <Link
            href={buildQuery(searchParams, { page: String(page - 1) })}
            className="rounded-full border bg-background px-4 py-1.5 text-sm hover:bg-muted"
          >
            ← {t("previous")}
          </Link>
        ) : null}
        {result.hasMore ? (
          <Link
            href={buildQuery(searchParams, { page: String(page + 1) })}
            className="rounded-full border bg-background px-4 py-1.5 text-sm hover:bg-muted"
          >
            {t("next")} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
