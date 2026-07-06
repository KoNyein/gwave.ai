import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Mineral, Strain, StrainType } from "@/types/database";

export const KNOWLEDGE_PAGE_SIZE = 24;

export interface StrainFilters {
  query?: string;
  type?: StrainType;
  thcMin?: number;
  effects?: string[];
  page?: number;
}

export interface MineralFilters {
  query?: string;
  category?: string;
  page?: number;
}

export interface KnowledgePage<T> {
  items: T[];
  page: number;
  hasMore: boolean;
}

/** Escape LIKE wildcards so user input matches literally. */
function likePattern(query: string): string {
  return `%${query.replace(/[%_\\]/g, "\\$&")}%`;
}

export async function listStrains(
  filters: StrainFilters = {},
): Promise<KnowledgePage<Strain>> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * KNOWLEDGE_PAGE_SIZE;

  let query = supabase.from("strains").select("*");
  if (filters.query) {
    query = query.ilike("name", likePattern(filters.query));
  }
  if (filters.type) {
    query = query.eq("type", filters.type);
  }
  if (filters.thcMin !== undefined) {
    query = query.gte("thc", filters.thcMin);
  }
  if (filters.effects && filters.effects.length > 0) {
    query = query.contains("effects", filters.effects);
  }

  const { data, error } = await query
    .order("name", { ascending: true })
    .range(from, from + KNOWLEDGE_PAGE_SIZE);
  if (error) throw new Error(`Failed to load strains: ${error.message}`);

  const items = data ?? [];
  return {
    items: items.slice(0, KNOWLEDGE_PAGE_SIZE),
    page,
    hasMore: items.length > KNOWLEDGE_PAGE_SIZE,
  };
}

export async function getStrainBySlug(slug: string): Promise<Strain | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("strains")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function listMinerals(
  filters: MineralFilters = {},
): Promise<KnowledgePage<Mineral>> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * KNOWLEDGE_PAGE_SIZE;

  let query = supabase.from("minerals").select("*");
  if (filters.query) {
    query = query.ilike("name", likePattern(filters.query));
  }
  if (filters.category) {
    query = query.eq("category", filters.category);
  }

  const { data, error } = await query
    .order("name", { ascending: true })
    .range(from, from + KNOWLEDGE_PAGE_SIZE);
  if (error) throw new Error(`Failed to load minerals: ${error.message}`);

  const items = data ?? [];
  return {
    items: items.slice(0, KNOWLEDGE_PAGE_SIZE),
    page,
    hasMore: items.length > KNOWLEDGE_PAGE_SIZE,
  };
}

export async function getMineralBySlug(slug: string): Promise<Mineral | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("minerals")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getMineralCategories(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("minerals")
    .select("category")
    .order("category");
  return [...new Set((data ?? []).map((row) => row.category))];
}

/** Lightweight name matches for the global search dropdown. */
export async function quickSearchKnowledge(query: string, limit = 5) {
  const supabase = await createClient();
  const pattern = likePattern(query);
  const [strainsRes, mineralsRes] = await Promise.all([
    supabase
      .from("strains")
      .select("name, slug, type, thc, cbd")
      .ilike("name", pattern)
      .order("name")
      .limit(limit),
    supabase
      .from("minerals")
      .select("name, slug, symbol, category")
      .ilike("name", pattern)
      .order("name")
      .limit(limit),
  ]);
  return {
    strains: strainsRes.data ?? [],
    minerals: mineralsRes.data ?? [],
  };
}
