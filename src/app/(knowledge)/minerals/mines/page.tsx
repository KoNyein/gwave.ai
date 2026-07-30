import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { MineSitesBoard } from "@/components/knowledge/mine-sites-board";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mine sites map — Myanmar minerals" };

/**
 * The community mine-site map. Anyone may look; a signed-in user can add and
 * correct listings, and reports go to the admin queue at /admin/mines.
 *
 * It lives under /minerals rather than /metals because the pins are about the
 * rock in the ground, not the day's quote — the metal board links across.
 */
export default async function MineSitesPage() {
  const profile = await getCurrentProfile();

  return (
    <div className="space-y-4">
      <Link
        href="/minerals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Minerals
      </Link>
      <MineSitesBoard
        isAdmin={profile?.role === "admin"}
        userId={profile?.id ?? ""}
      />
    </div>
  );
}
