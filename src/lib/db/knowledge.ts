import "server-only";


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
