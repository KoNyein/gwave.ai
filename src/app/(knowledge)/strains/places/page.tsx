import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PlacesBoard } from "@/components/knowledge/places-board";
import { getCurrentProfile, requireAdult } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cannabis map — shops, farms, clinics" };

/**
 * The community cannabis map. 18+ only (same requireAdult gate as /strains).
 * Every signed-in adult can add and correct listings; reports go to the admin
 * queue at /admin/places.
 */
export default async function CannabisPlacesPage() {
  await requireAdult();
  const profile = await getCurrentProfile();

  return (
    <div className="space-y-4">
      <Link
        href="/strains"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Strains
      </Link>
      <div>
        <h1 className="text-xl font-bold">
          🗺 ဆေးခြောက်ဆိုင် / စိုက်ခင်း / ကလင်းနစ် မြေပုံ
        </h1>
        <p className="text-sm text-muted-foreground">
          User များ စုစည်းပေးထားသော မြေပုံ — ရှာဖွေ၊ ထည့်၊ ပြင်၊ တိုင်ကြားနိုင်သည်
        </p>
      </div>
      <PlacesBoard
        isAdmin={profile?.role === "admin"}
        userId={profile?.id ?? ""}
      />
    </div>
  );
}
