import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { GrowGame } from "@/components/games/grow-game";
import { requireAdult } from "@/lib/auth";

export const metadata = { title: "Grow Master" };
export const dynamic = "force-dynamic";

/** Cannabis-cultivation sim — verified adults (18+) only. */
export default async function GrowGamePage() {
  await requireAdult();
  const t = await getTranslations("games");

  return (
    <div className="space-y-4">
      <Link
        href="/games"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("backToGames")}
      </Link>
      <div>
        <h1 className="text-xl font-bold">Grow Master 🌿</h1>
        <p className="text-sm text-muted-foreground">{t("growTagline")}</p>
      </div>
      <GrowGame />
    </div>
  );
}
