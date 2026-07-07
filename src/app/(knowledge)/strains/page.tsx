import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { StrainCard } from "@/components/knowledge/strain-card";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdult } from "@/lib/auth";
import { listStrains } from "@/lib/db/knowledge";
import { cn } from "@/lib/utils";
import type { StrainType } from "@/types/database";

const TYPES: (StrainType | "all")[] = ["all", "indica", "sativa", "hybrid"];
const THC_STEPS = [0, 15, 18, 20, 22];
const FILTER_EFFECTS = [
  "relaxed",
  "happy",
  "euphoric",
  "uplifted",
  "sleepy",
  "creative",
  "focused",
  "energetic",
];

interface SearchParams {
  q?: string;
  type?: string;
  thc?: string;
  effects?: string;
  page?: string;
}

function buildQuery(
  params: SearchParams,
  overrides: Partial<SearchParams>,
): string {
  const merged = { ...params, ...overrides };
  const search = new URLSearchParams();
  if (merged.q) search.set("q", merged.q);
  if (merged.type && merged.type !== "all") search.set("type", merged.type);
  if (merged.thc && merged.thc !== "0") search.set("thc", merged.thc);
  if (merged.effects) search.set("effects", merged.effects);
  if (merged.page && merged.page !== "1") search.set("page", merged.page);
  const encoded = search.toString();
  return encoded ? `/strains?${encoded}` : "/strains";
}

export default async function StrainsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Cannabis content — verified adults (18+) only.
  await requireAdult();
  const t = await getTranslations("strains");

  const type = TYPES.includes(searchParams.type as StrainType)
    ? (searchParams.type as StrainType)
    : undefined;
  const thcMin = Number(searchParams.thc) || undefined;
  const selectedEffects = (searchParams.effects ?? "")
    .split(",")
    .filter((effect) => FILTER_EFFECTS.includes(effect));
  const page = Math.max(1, Number(searchParams.page) || 1);

  const result = await listStrains({
    query: searchParams.q,
    type,
    thcMin,
    effects: selectedEffects.length > 0 ? selectedEffects : undefined,
    page,
  });

  function toggleEffect(effect: string): string {
    const next = selectedEffects.includes(effect)
      ? selectedEffects.filter((e) => e !== effect)
      : [...selectedEffects, effect];
    return buildQuery(searchParams, {
      effects: next.join(",") || undefined,
      page: "1",
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <form action="/strains" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={t("searchPlaceholder")}
            className="w-48 rounded-full border bg-background px-4 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </form>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              {t("filterType")}
            </span>
            {TYPES.map((option) => (
              <Link
                key={option}
                href={buildQuery(searchParams, {
                  type: option === "all" ? undefined : option,
                  page: "1",
                })}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm capitalize transition-colors",
                  (option === "all" && !type) || option === type
                    ? "border-primary bg-secondary font-semibold text-primary"
                    : "hover:bg-muted",
                )}
              >
                {option === "all" ? t("allTypes") : option}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              {t("filterThc")}
            </span>
            {THC_STEPS.map((step) => (
              <Link
                key={step}
                href={buildQuery(searchParams, {
                  thc: step === 0 ? undefined : String(step),
                  page: "1",
                })}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  (step === 0 && !thcMin) || step === thcMin
                    ? "border-primary bg-secondary font-semibold text-primary"
                    : "hover:bg-muted",
                )}
              >
                {step === 0 ? t("anyThc") : `${step}%+`}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              {t("filterEffects")}
            </span>
            {FILTER_EFFECTS.map((effect) => (
              <Link
                key={effect}
                href={toggleEffect(effect)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm capitalize transition-colors",
                  selectedEffects.includes(effect)
                    ? "border-primary bg-secondary font-semibold text-primary"
                    : "hover:bg-muted",
                )}
              >
                {effect}
              </Link>
            ))}
          </div>
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
          {result.items.map((strain) => (
            <StrainCard key={strain.id} strain={strain} />
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
