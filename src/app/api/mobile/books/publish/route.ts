import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/books/publish — add a book to the store from the app. The
 * caller uploads the PDF/EPUB + cover to the media bucket first and sends the
 * storage paths here. Admin publishes platform books (publisher_id null);
 * any signed-in author publishes their own (publisher_id set, so premium
 * sales settle to them through the buy_book RPC). Reads/purchases go straight
 * through PostgREST (books-store.sql), so this is the only books route needed.
 */
const schema = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(200),
  description: z.string().max(4000).optional(),
  category: z.string().max(100).optional(),
  language: z.string().max(8).default("my"),
  cover_url: z.string().max(1000).optional(),
  file_url: z.string().min(1).max(1000),
  file_format: z.enum(["pdf", "epub"]).default("pdf"),
  pages: z.number().int().positive().optional(),
  is_premium: z.boolean().default(false),
  price: z.number().positive().max(10000).optional(),
  currency: z.string().length(3).default("USD"),
});

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

export async function POST(request: NextRequest) {
  const claims = await verifyDataToken(bearer(request));
  if (!claims?.sub) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data: me } = await admin
    .from("profiles")
    .select("role")
    .eq("id", claims.sub)
    .maybeSingle<{ role: string | null }>();
  const isAdmin = me?.role === "admin";

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid book." }, { status: 400 });
  }
  const b = parsed.data;
  if (b.is_premium && !(b.price && b.price > 0)) {
    return NextResponse.json(
      { error: "A premium book needs a price." },
      { status: 400 },
    );
  }

  const { data: book, error } = await admin
    .from("books")
    .insert({
      title: b.title,
      author: b.author,
      description: b.description ?? null,
      category: b.category ?? null,
      language: b.language,
      cover_url: b.cover_url ?? null,
      file_url: b.file_url,
      file_format: b.file_format,
      pages: b.pages ?? null,
      is_premium: b.is_premium,
      price: b.is_premium ? b.price : null,
      currency: b.currency,
      publisher_id: isAdmin ? null : claims.sub,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !book) {
    return NextResponse.json(
      { error: error?.message ?? "insert_failed" },
      { status: 500 },
    );
  }

  console.log(`[books/publish] by=${claims.sub} id=${book.id}`);
  return NextResponse.json({ ok: true, id: book.id });
}
