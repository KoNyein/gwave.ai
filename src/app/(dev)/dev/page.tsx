import { redirect } from "next/navigation";

import { ApiKeysManager } from "@/components/dev/api-keys-manager";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function DevKeysPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: keys } = await supabase
    .from("api_keys")
    .select("*")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  return <ApiKeysManager keys={keys ?? []} />;
}
