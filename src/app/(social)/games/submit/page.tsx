import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SubmitGameForm } from "@/components/games/submit-game-form";
import { getCurrentProfile } from "@/lib/auth";
import { getGame, type GameWithAuthor } from "@/lib/db/games";

export const metadata = { title: "Submit a game" };
export const dynamic = "force-dynamic";

/** Upload a self-contained HTML5 game for moderator review. */
export default async function SubmitGamePage({
  searchParams,
}: {
  searchParams: { edit?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const t = await getTranslations("games");

  // Editing an existing submission — only the author's own (RLS re-checks).
  let existing: GameWithAuthor | undefined;
  if (searchParams.edit) {
    const game = await getGame(searchParams.edit);
    if (game && game.author_id === profile.id) existing = game;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/games"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToGames")}
      </Link>
      <div>
        <h1 className="text-xl font-bold">
          {existing ? t("editTitle") : t("submitTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("submitSubtitle")}</p>
      </div>
      <SubmitGameForm existing={existing} />
    </div>
  );
}
