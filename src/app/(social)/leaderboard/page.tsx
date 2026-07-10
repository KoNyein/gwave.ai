import { LeaderboardView } from "@/components/reviews/leaderboard-view";
import { getLeaderboard } from "@/lib/db/reviews";

export const metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [pages, products] = await Promise.all([
    getLeaderboard("page", 30),
    getLeaderboard("shop_product", 30),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <LeaderboardView pages={pages} products={products} />
    </div>
  );
}
