import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { GardenGame } from "@/components/learn/garden-game";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Grow-a-Garden" };
export const dynamic = "force-dynamic";

export default async function GardenGamePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-4">
      <Link
        href="/learn"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Learn
      </Link>
      <div>
        <h1 className="text-xl font-bold">Grow-a-Garden 🌻</h1>
        <p className="text-sm text-muted-foreground">
          Give each plant water and sunlight to help it grow and bloom.
        </p>
      </div>
      <GardenGame />
    </div>
  );
}
