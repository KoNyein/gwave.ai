import "server-only";

import { createClient } from "@/lib/data/server";
import type { Certificate } from "@/types/database";

export interface CertificateWithOwner extends Certificate {
  owner_name: string | null;
  owner_username: string | null;
}

/** A single certificate with the owner's display name, for the public page. */
export async function getCertificate(
  id: string,
): Promise<CertificateWithOwner | null> {
  const db = await createClient();
  const { data } = await db
    .from("certificates")
    .select("*, profiles!certificates_user_id_fkey(display_name, username)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const profile = row.profiles as {
    display_name: string | null;
    username: string | null;
  } | null;
  delete row.profiles;
  return {
    ...(row as unknown as Certificate),
    owner_name: profile?.display_name ?? null,
    owner_username: profile?.username ?? null,
  };
}

/** All certificates a user has earned, newest first. */
export async function getCertificatesForUser(
  userId: string,
): Promise<Certificate[]> {
  const db = await createClient();
  const { data } = await db
    .from("certificates")
    .select("*")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false })
    .returns<Certificate[]>();
  return data ?? [];
}
