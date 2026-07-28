import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyDataToken } from "@/lib/auth/tokens";
import { createAdminClient } from "@/lib/data/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mobile/audio/import-rss — import a podcast into the catalogue
 * from its public RSS feed (admin only). This is how podcast apps everywhere
 * work: episodes keep streaming from the publisher's own enclosure URLs — we
 * only store metadata + the public URL, never a copy of the audio. Built for
 * adding Myanmar shows (e.g. Burmese-language news/story feeds) in one tap.
 *
 * Re-running the same feed is idempotent: episodes whose enclosure URL is
 * already in the catalogue are skipped.
 */
const schema = z.object({
  url: z.string().url().max(600).startsWith("https://"),
  limit: z.number().int().min(1).max(50).default(20),
});

function bearer(request: NextRequest): string | undefined {
  const h = request.headers.get("authorization") ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : undefined;
}

function tag(block: string, name: string): string | null {
  // <name ...>text</name>, tolerating CDATA and attributes.
  const m = block.match(
    new RegExp(`<${name}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${name}>`, "i"),
  );
  return m?.[1]?.trim() ?? null;
}

function attr(block: string, tagName: string, attrName: string): string | null {
  const m = block.match(
    new RegExp(`<${tagName}[^>]*\\b${attrName}="([^"]+)"[^>]*/?>`, "i"),
  );
  return m?.[1] ?? null;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDuration(raw: string | null): number | null {
  if (!raw) return null;
  const parts = raw.trim().split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return parts[0] ?? null;
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
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feed URL." }, { status: 400 });
  }
  const { url, limit } = parsed.data;

  let xml: string;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "GwaveAudio/1.0 (+https://gwave.cc)" },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`feed responded ${res.status}`);
    // Cap at ~3 MB — a feed is text; anything bigger is not a podcast RSS.
    xml = (await res.text()).slice(0, 3_000_000);
  } catch (e) {
    return NextResponse.json(
      { error: `Couldn't fetch the feed — ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }

  const showTitle = tag(xml.split(/<item[\s>]/i)[0] ?? "", "title") ?? "Podcast";
  const channelImage =
    attr(xml.split(/<item[\s>]/i)[0] ?? "", "itunes:image", "href") ??
    tag(xml.split(/<item[\s>]/i)[0] ?? "", "url");

  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const episodes = items
    .map((block, i) => {
      const enclosure =
        attr(block, "enclosure", "url") ?? tag(block, "guid");
      const title = tag(block, "title");
      if (!enclosure || !title || !/^https?:\/\//i.test(enclosure)) return null;
      const desc = tag(block, "description") ?? tag(block, "itunes:summary");
      const pub = tag(block, "pubDate");
      const pubDate = pub ? new Date(pub) : null;
      return {
        title: stripHtml(title).slice(0, 200),
        audio_url: enclosure,
        description: desc ? stripHtml(desc).slice(0, 1000) : null,
        cover_url: attr(block, "itunes:image", "href") ?? channelImage,
        duration_s: parseDuration(tag(block, "itunes:duration")),
        episode_no:
          Number(tag(block, "itunes:episode")) || items.length - i,
        published_at:
          pubDate && !Number.isNaN(pubDate.getTime())
            ? pubDate.toISOString()
            : new Date().toISOString(),
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .slice(0, limit);

  if (episodes.length === 0) {
    return NextResponse.json(
      { error: "No playable episodes found in that feed." },
      { status: 422 },
    );
  }

  // Skip episodes already imported (matched on the enclosure URL).
  const urls = episodes.map((e) => e.audio_url);
  const { data: existing } = await admin
    .from("audio_tracks")
    .select("audio_url")
    .in("audio_url", urls)
    .returns<{ audio_url: string }[]>();
  const known = new Set((existing ?? []).map((r) => r.audio_url));

  let imported = 0;
  for (const ep of episodes) {
    if (known.has(ep.audio_url)) continue;
    const { data: track, error } = await admin
      .from("audio_tracks")
      .insert({
        kind: "podcast",
        title: ep.title,
        description: ep.description,
        cover_url: ep.cover_url,
        audio_url: ep.audio_url,
        duration_s: ep.duration_s,
        is_premium: false,
        protection: "free",
        currency: "USD",
        published_at: ep.published_at,
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !track) continue;
    await admin.from("audio_podcast").insert({
      track_id: track.id,
      episode_no: ep.episode_no,
      show_notes: ep.description,
    });
    imported++;
  }

  console.log(
    `[audio/import-rss] by=${claims.sub} show="${stripHtml(showTitle)}" found=${episodes.length} imported=${imported}`,
  );
  return NextResponse.json({
    ok: true,
    show: stripHtml(showTitle),
    found: episodes.length,
    imported,
    skipped: episodes.length - imported,
  });
}
