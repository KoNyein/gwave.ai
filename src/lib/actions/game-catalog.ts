"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { createClient } from "@/lib/supabase/server";

async function requireStaff(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();
  if (profile?.role !== "admin" && profile?.role !== "moderator") return null;
  return user.id;
}

const httpsUrl = z
  .string()
  .trim()
  .url()
  .max(1000)
  .refine((u) => u.startsWith("https://"), "URL must start with https://");

const addSchema = z.object({
  title: z.string().trim().min(1).max(160),
  thumbnailUrl: httpsUrl,
  gameUrl: httpsUrl,
  category: z.string().trim().min(1).max(40).default("Education"),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

/** Admin: add a game to the catalog. RLS also enforces the staff check. */
export async function addCatalogGame(input: {
  title: string;
  thumbnailUrl: string;
  gameUrl: string;
  category: string;
  sortOrder?: number;
}): Promise<ActionResult<{ id: string }>> {
  const userId = await requireStaff();
  if (!userId) return { ok: false, error: "Admins only" };
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { title, thumbnailUrl, gameUrl, category, sortOrder } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_catalog")
    .insert({
      title,
      thumbnail_url: thumbnailUrl,
      game_url: gameUrl,
      category,
      sort_order: sortOrder ?? 0,
      created_by: userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not add the game." };
  }
  revalidatePath("/games");
  return { ok: true, data: { id: data.id } };
}

/** Admin: show/hide a catalog game. */
export async function setCatalogGameActive(input: {
  id: string;
  isActive: boolean;
}): Promise<ActionResult> {
  const userId = await requireStaff();
  if (!userId) return { ok: false, error: "Admins only" };
  if (!z.string().uuid().safeParse(input.id).success) {
    return { ok: false, error: "Invalid input" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("game_catalog")
    .update({ is_active: input.isActive })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/games");
  return { ok: true, data: undefined };
}

/** Admin: delete a catalog game. */
export async function deleteCatalogGame(input: {
  id: string;
}): Promise<ActionResult> {
  const userId = await requireStaff();
  if (!userId) return { ok: false, error: "Admins only" };
  if (!z.string().uuid().safeParse(input.id).success) {
    return { ok: false, error: "Invalid input" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("game_catalog")
    .delete()
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/games");
  return { ok: true, data: undefined };
}
