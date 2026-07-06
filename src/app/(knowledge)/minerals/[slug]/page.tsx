import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gem } from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMineralBySlug } from "@/lib/db/knowledge";

export default async function MineralDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const t = await getTranslations("minerals");
  const mineral = await getMineralBySlug(params.slug);
  if (!mineral) notFound();

  const extraProperties = Object.entries(mineral.properties);

  return (
    <div className="space-y-4">
      <Link
        href="/minerals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToMinerals")}
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Gem className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{mineral.name}</h1>
            {mineral.symbol ? (
              <span className="rounded bg-muted px-2.5 py-1 font-mono text-sm">
                {mineral.symbol}
              </span>
            ) : null}
            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-primary">
              {mineral.category}
            </span>
          </div>
          {mineral.description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {mineral.description}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* Property table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("properties")}</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <tr>
                <td className="py-2 pr-4 text-muted-foreground">
                  {t("hardness")}
                </td>
                <td className="py-2 font-medium">
                  {mineral.hardness_mohs ?? "–"}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-muted-foreground">
                  {t("density")}
                </td>
                <td className="py-2 font-medium">
                  {mineral.density ? `${mineral.density} g/cm³` : "–"}
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 text-muted-foreground">
                  {t("category")}
                </td>
                <td className="py-2 font-medium">{mineral.category}</td>
              </tr>
              {extraProperties.map(([key, value]) => (
                <tr key={key}>
                  <td className="py-2 pr-4 capitalize text-muted-foreground">
                    {key.replace(/_/g, " ")}
                  </td>
                  <td className="py-2 font-medium">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Uses */}
      {mineral.uses.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("uses")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {mineral.uses.map((use) => (
              <span
                key={use}
                className="rounded-full bg-secondary px-3 py-1 text-sm text-primary"
              >
                {use}
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
