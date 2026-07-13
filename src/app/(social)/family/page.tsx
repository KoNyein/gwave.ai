import Link from "next/link";
import { redirect } from "next/navigation";
import { Map as MapIcon, MapPin, Radio } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { FamilyClient } from "@/components/family/family-client";
import { getCurrentProfile } from "@/lib/auth";
import { getCircleMembers, getMyCircles } from "@/lib/db/family";

export const metadata = { title: "Family" };
export const dynamic = "force-dynamic";

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: { c?: string };
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const t = await getTranslations("family");

  const circles = await getMyCircles(profile.id);
  const active =
    circles.find((c) => c.id === searchParams.c) ?? circles[0] ?? null;
  const members = active ? await getCircleMembers(active.id) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/family/trackers"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50"
          >
            <Radio className="h-4 w-4" /> Trackers
          </Link>
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50"
          >
            <MapIcon className="h-4 w-4" /> GPS Map
          </Link>
        </div>
      </div>

      <FamilyClient
        circles={circles}
        activeCircle={active}
        members={members}
        myUserId={profile.id}
        googleMapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
      />
    </div>
  );
}
