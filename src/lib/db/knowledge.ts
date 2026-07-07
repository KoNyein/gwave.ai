import "server-only";

import { unstable_cache } from "next/cache";

import { createAnonClient } from "@/lib/supabase/anon";
import type { Mineral, Strain, StrainType } from "@/types/database";

export const KNOWLEDGE_PAGE_SIZE = 24;

// Knowledge tables are public-read and change rarely (admin edits + seed),
// so reads go through a cookie-less anon client and are cached for 5
// minutes. Revalidate on demand with revalidateTag("knowledge").
const KNOWLEDGE_REVALIDATE_SECONDS = 300;

function cached<Args extends unknown[], Result>(
  keyPrefix: string,
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return (...args: Args) =>
    unstable_cache(fn, [keyPrefix, JSON.stringify(args)], {
      revalidate: KNOWLEDGE_REVALIDATE_SECONDS,
      tags: ["knowledge"],
    })(...args);
}

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

export const listStrains = cached(
  "strains-list",
  async function listStrains(
    filters: StrainFilters = {},
  ): Promise<KnowledgePage<Strain>> {
    const supabase = createAnonClient();
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
  },
);

export const getStrainBySlug = cached(
  "strain-by-slug",
  async function getStrainBySlug(slug: string): Promise<Strain | null> {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("strains")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return data;
  },
);

export const listMinerals = cached(
  "minerals-list",
  async function listMinerals(
    filters: MineralFilters = {},
  ): Promise<KnowledgePage<Mineral>> {
    const supabase = createAnonClient();
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
  },
);

export const getMineralBySlug = cached(
  "mineral-by-slug",
  async function getMineralBySlug(slug: string): Promise<Mineral | null> {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("minerals")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    return data;
  },
);

export const getMineralCategories = cached(
  "mineral-categories",
  async function getMineralCategories(): Promise<string[]> {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("minerals")
      .select("category")
      .order("category");
    return [...new Set((data ?? []).map((row) => row.category))];
  },
);

/**
 * Lightweight name matches for the global search dropdown. Deliberately NOT
 * cached: the per-keystroke query space would flood the cache for no reuse.
 */
export async function quickSearchKnowledge(query: string, limit = 5) {
  const supabase = createAnonClient();
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
