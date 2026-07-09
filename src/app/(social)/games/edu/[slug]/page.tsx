import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { buildGameDoc } from "@/components/games/game-sandbox";
import { getCurrentProfile } from "@/lib/auth";
import { getEduGame } from "@/lib/games/edu-games";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const game = getEduGame(params.slug);
  return { title: game ? "Learning game" : "Games" };
}

export default async function EduGamePage({
  params,
}: {
  params: { slug: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const game = getEduGame(params.slug);
  if (!game) notFound();

  const t = await getTranslations("games");

  return (
    <div className="space-y-3">
      <Link
        href="/games"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("title")}
      </Link>
      <div className="flex items-center gap-2">
        <span className="text-3xl" aria-hidden>
          {game.emoji}
        </span>
        <div>
          <h1 className="text-xl font-bold">{t(game.titleKey)}</h1>
          <p className="text-sm text-muted-foreground">{t(game.descKey)}</p>
        </div>
      </div>
      {/* Same hardened sandbox as community games: opaque origin, no network. */}
      <iframe
        title={t(game.titleKey)}
        sandbox="allow-scripts"
        srcDoc={buildGameDoc(game.html)}
        className="h-[70vh] w-full rounded-xl border bg-white"
      />
    </div>
  );
}
