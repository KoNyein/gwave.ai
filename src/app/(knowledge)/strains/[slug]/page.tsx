import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sprout } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { StrainTypeBadge } from "@/components/knowledge/strain-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { getStrainBySlug } from "@/lib/db/knowledge";

function Meter({
  label,
  value,
  max,
  suffix,
}: {
  label: string;
  value: number | null;
  max: number;
  suffix: string;
}) {
  const percent =
    value === null ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {value === null ? "–" : `${value}${suffix}`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export default async function StrainDetailPage({
  params,
}: {
  params: { slug: string };
}) {

  const t = await getTranslations("strains");
  const strain = await getStrainBySlug(params.slug);
  if (!strain) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/strains"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToStrains")}
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{strain.name}</h1>
            <StrainTypeBadge type={strain.type} />
          </div>
          {strain.description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {strain.description}
            </p>
          ) : null}
          <div className="grid max-w-md gap-3 sm:grid-cols-2">
            <Meter label="THC" value={strain.thc} max={30} suffix="%" />
            <Meter label="CBD" value={strain.cbd} max={20} suffix="%" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Effects */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("effects")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {strain.effects.map((effect, index) => (
              <div key={effect}>
                <p className="mb-1 text-sm font-medium capitalize">{effect}</p>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${Math.max(30, 95 - index * 14)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Flavors & terpenes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("flavorsAndTerpenes")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {t("flavors")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {strain.flavors.map((flavor) => (
                  <span
                    key={flavor}
                    className="rounded-full bg-secondary px-3 py-1 text-sm capitalize text-primary"
                  >
                    {flavor}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {t("terpenes")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {strain.terpenes.map((terpene) => (
                  <span
                    key={terpene}
                    className="rounded-full border px-3 py-1 text-sm capitalize"
                  >
                    {terpene}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growing info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sprout className="h-4 w-4 text-primary" />
            {t("growingInfo")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{t("difficulty")}</dt>
              <dd className="font-semibold capitalize">
                {strain.grow_difficulty ?? "–"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("floweringTime")}</dt>
              <dd className="font-semibold">
                {strain.flowering_weeks
                  ? t("weeks", { count: strain.flowering_weeks })
                  : "–"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("yieldIndoor")}</dt>
              <dd className="font-semibold">{strain.yield_indoor ?? "–"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("yieldOutdoor")}</dt>
              <dd className="font-semibold">{strain.yield_outdoor ?? "–"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
