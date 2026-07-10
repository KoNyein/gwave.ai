import { redirect } from "next/navigation";

import { BoostManager } from "@/components/boost/boost-manager";
import { getCurrentProfile } from "@/lib/auth";
import { getMyBoosts } from "@/lib/db/boosts";

export const metadata = { title: "Boost" };
export const dynamic = "force-dynamic";

export default async function BoostPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const boosts = await getMyBoosts();

  return (
    <div className="mx-auto max-w-2xl">
      <BoostManager boosts={boosts} />
    </div>
  );
}
