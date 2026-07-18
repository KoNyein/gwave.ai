import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open Graph link previews for posts/messages: fetch the page server-side and
 * return { title, description, image, siteName }. Auth-gated so it can't be
 * used as an open proxy; SSRF-guarded so it can't be pointed at internal
 * services; responses are cached in-process for an hour.
 */

interface Preview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

const CACHE = new Map<string, { at: number; data: Preview }>();
const TTL_MS = 60 * 60 * 1000;
const MAX_CACHE = 500;

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  // IP literals in private/reserved ranges (IPv4 + common IPv6 forms).
  if (/^\[?::1\]?$/.test(h) || h.startsWith("[fc") || h.startsWith("[fd") || h.startsWith("[fe80")) {
    return true;
  }
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    ) {
      return true;
    }
  }
  return false;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function metaContent(html: string, prop: string): string | null {
  const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*?content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${escaped}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const target = new URL(request.url).searchParams.get("url") ?? "";
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }
  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    isBlockedHost(parsed.hostname) ||
    (parsed.port && parsed.port !== "80" && parsed.port !== "443")
  ) {
    return NextResponse.json({ error: "URL not allowed." }, { status: 400 });
  }

  const key = parsed.toString();
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.data);
  }

  let data: Preview = {
    url: key,
    title: null,
    description: null,
    image: null,
    siteName: null,
  };
  try {
    const res = await fetch(key, {
      signal: AbortSignal.timeout(6000),
      headers: {
        // Some sites only emit OG tags for known crawlers.
        "User-Agent": "Mozilla/5.0 (compatible; GwaveBot/1.0; +https://gwave.cc)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const finalUrl = new URL(res.url);
    if (!isBlockedHost(finalUrl.hostname) && res.ok) {
      const html = (await res.text()).slice(0, 400_000);
      const title =
        metaContent(html, "og:title") ??
        (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
          ? decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]!)
          : null);
      const rawImage =
        metaContent(html, "og:image") ?? metaContent(html, "twitter:image");
      let image: string | null = null;
      if (rawImage) {
        try {
          const resolved = new URL(rawImage, finalUrl);
          if (
            (resolved.protocol === "https:" || resolved.protocol === "http:") &&
            !isBlockedHost(resolved.hostname)
          ) {
            image = resolved.toString();
          }
        } catch {
          /* skip bad image URLs */
        }
      }
      data = {
        url: key,
        title: title?.trim() || null,
        description:
          metaContent(html, "og:description") ??
          metaContent(html, "description"),
        image,
        siteName: metaContent(html, "og:site_name") ?? finalUrl.hostname,
      };
    }
  } catch {
    // Unreachable/slow site — cache the empty preview so we don't hammer it.
  }

  if (CACHE.size >= MAX_CACHE) {
    const oldest = CACHE.keys().next().value;
    if (oldest) CACHE.delete(oldest);
  }
  CACHE.set(key, { at: Date.now(), data });
  return NextResponse.json(data);
}
