import "server-only";

import { createClient } from "@/lib/data/server";
import type { GameCatalogItem } from "@/types/database";

/** Active catalog games for the public /games grid (RLS shows active only). */
export async function getCatalogGames(): Promise<GameCatalogItem[]> {
  const db = await createClient();
  const { data } = await db
    .from("game_catalog")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<GameCatalogItem[]>();
  return data ?? [];
}

/** Every catalog game, active or not — for the admin management view. */
export async function getAllCatalogGames(): Promise<GameCatalogItem[]> {
  const db = await createClient();
  const { data } = await db
    .from("game_catalog")
    .select("*")
    .order("sort_order", { ascending: false })
    .order("created_at", { ascending: false })
    .returns<GameCatalogItem[]>();
  return data ?? [];
}
