"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

import { createClient } from "@/lib/data/server";
import type { ActionResult } from "@/lib/actions/posts";

const uuid = z.string().uuid();

const createPageSchema = z.object({
  name: z.string().min(3).max(80),
  category: z.string().max(60).optional().or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return base.length >= 3 ? `${base}-${suffix}` : `page-${suffix}`;
}

export async function createPage(
  input: z.infer<typeof createPageSchema>,
): Promise<ActionResult<{ slug: string }>> {
  const parsed = createPageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Invalid page.",
    };
  }

  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const slug = slugify(parsed.data.name);
  const { error } = await db.from("pages").insert({
    name: parsed.data.name.trim(),
    slug,
    category: parsed.data.category?.trim() || null,
    description: parsed.data.description?.trim() || null,
    owner_id: user.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/pages");
  return { ok: true, data: { slug } };
}

export async function followPage(pageId: string): Promise<ActionResult> {
  if (!uuid.safeParse(pageId).success) {
    return { ok: false, error: "Invalid page." };
  }
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await db.from("page_followers").insert({
    page_id: pageId,
    user_id: user.id,
  });
  if (error && error.code !== "23505") {
    return { ok: false, error: error.message };
  }
  revalidatePath("/pages", "layout");
  return { ok: true, data: undefined };
}

export async function unfollowPage(pageId: string): Promise<ActionResult> {
  if (!uuid.safeParse(pageId).success) {
    return { ok: false, error: "Invalid page." };
  }
  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await db
    .from("page_followers")
    .delete()
    .eq("page_id", pageId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pages", "layout");
  return { ok: true, data: undefined };
}
