import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Gem,
  MapPin,
  Pickaxe,
  Truck,
  Youtube,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MineralMedia } from "@/components/knowledge/mineral-media";
import { ExperienceList } from "@/components/knowledge/experience-list";
import { ShareExperience } from "@/components/knowledge/share-experience";
import { getCurrentUser } from "@/lib/auth";
import { getExperiencePosts } from "@/lib/db/experiences";
import { getMineralBySlug } from "@/lib/db/knowledge";

export default async function MineralDetailPage(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
  const t = await getTranslations("minerals");
  const [mineral, user] = await Promise.all([
    getMineralBySlug(params.slug),
    getCurrentUser(),
  ]);
  if (!mineral) notFound();
  const experiences = await getExperiencePosts(`/minerals/${mineral.slug}`);

  const extraProperties = Object.entries(mineral.properties);
  const mm = mineral.myanmar ?? {};
  const deposits = mm.deposits ?? [];
  const youtubeUrl = mineral.youtube_query
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(
        mineral.youtube_query,
      )}`
    : null;

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
      {/* Media — HTML5 specimen, audio read-aloud, video */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">📸 ရုပ်ပုံ · အသံ · ဗီဒီယို</CardTitle>
        </CardHeader>
        <CardContent>
          <MineralMedia
            name={mineral.name}
            category={mineral.category}
            description={mineral.description}
            hardnessMohs={mineral.hardness_mohs}
            colorText={mineral.properties.color ?? mineral.properties.colour}
            imageUrl={mineral.image_url}
            youtubeQuery={mineral.youtube_query}
          />
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
      {/* Myanmar — deposits, extraction, transport */}
      {deposits.length > 0 || mm.extraction || mm.transport || mm.notes ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              🇲🇲 မြန်မာနိုင်ငံတွင်
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {deposits.length > 0 ? (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
                  <MapPin className="h-4 w-4 text-primary" /> ထွက်ရှိရာ နေရာများ
                </p>
                <ul className="space-y-1.5">
                  {deposits.map((d, i) => (
                    <li
                      key={`${d.place}-${i}`}
                      className="rounded-lg border p-2.5"
                    >
                      <span className="font-medium">{d.place}</span>
                      <span className="text-muted-foreground"> · {d.region}</span>
                      {d.note ? (
                        <p className="text-xs text-muted-foreground">{d.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {mm.extraction ? (
              <div>
                <p className="mb-1 flex items-center gap-1.5 font-semibold">
                  <Pickaxe className="h-4 w-4 text-amber-600" /> ထုတ်ယူပုံ
                </p>
                <p className="text-muted-foreground">{mm.extraction}</p>
              </div>
            ) : null}
            {mm.transport ? (
              <div>
                <p className="mb-1 flex items-center gap-1.5 font-semibold">
                  <Truck className="h-4 w-4 text-sky-600" /> သယ်ယူပို့ဆောင်ပုံ
                </p>
                <p className="text-muted-foreground">{mm.transport}</p>
              </div>
            ) : null}
            {mm.notes ? (
              <p className="rounded-lg bg-muted p-2.5 text-xs text-muted-foreground">
                💡 {mm.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      {/* Learn more — external links */}
      {mineral.wikipedia_url || youtubeUrl ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📚 ဆက်လက် လေ့လာရန်</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {mineral.wikipedia_url ? (
              <a
                href={mineral.wikipedia_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <ExternalLink className="h-4 w-4" /> Wikipedia
              </a>
            ) : null}
            {youtubeUrl ? (
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                <Youtube className="h-4 w-4 text-red-600" /> YouTube ဗီဒီယိုများ
              </a>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <ShareExperience
        userId={user?.id ?? null}
        itemName={mineral.name}
        itemPath={`/minerals/${mineral.slug}`}
      />
      <ExperienceList posts={experiences} />
    </div>
  );
}
