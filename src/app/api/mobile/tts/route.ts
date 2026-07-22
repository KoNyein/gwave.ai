import { NextRequest, NextResponse } from "next/server";

// Text-to-speech proxy for the native language courses.
//
// The web trainer speaks phrases with the browser's Web Speech API, but many
// Android phones in Myanmar ship with no usable TTS voice installed, so the
// app's on-device `flutter_tts` stays silent. This route gives every device a
// reliable voice: it fetches spoken MP3 audio for the phrase and streams it
// back, so the app just plays a URL (with device TTS kept only as a fallback).
//
// Audio comes from Google's translate speech endpoint, which covers all five
// course languages (English, Thai, Chinese, Japanese, Korean). Proxying it
// here lets us set a proper User-Agent, keep the app talking only to gwave.cc,
// and cache aggressively at the CDN.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Map a course BCP-47 tag (e.g. "th-TH") to a Google `tl` speech code. */
function ttsLang(input: string): string {
  const tag = input.trim().toLowerCase();
  if (tag.startsWith("zh")) return "zh-CN";
  if (tag.startsWith("yue")) return "zh-CN";
  const base = tag.split("-")[0];
  return base || "en";
}

/**
 * Split text into <=200-char chunks on word/sentence boundaries — Google's
 * endpoint rejects longer strings. Course phrases are short, so this almost
 * always yields a single chunk; the split is just a safety net.
 */
function chunk(text: string, max = 200): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return [clean];
  const parts: string[] = [];
  let rest = clean;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut <= 0) cut = max;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function fetchSpeech(text: string, tl: string): Promise<Buffer> {
  const buffers: Buffer[] = [];
  const pieces = chunk(text);
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (!piece) continue;
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob" +
      `&tl=${encodeURIComponent(tl)}` +
      `&total=${pieces.length}&idx=${i}` +
      `&textlen=${piece.length}` +
      `&q=${encodeURIComponent(piece)}`;
    const res = await fetch(url, {
      headers: {
        // A browser-like UA is required or the endpoint returns 403.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`speech provider returned ${res.status}`);
    }
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  // MP3 frames concatenate cleanly, so joined chunks play as one clip.
  return Buffer.concat(buffers);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const text = (params.get("q") ?? params.get("text") ?? "").trim();
  const lang = params.get("lang") ?? params.get("tl") ?? "en";

  if (!text) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }
  if (text.length > 400) {
    return NextResponse.json({ error: "Text too long." }, { status: 400 });
  }

  try {
    const audio = await fetchSpeech(text, ttsLang(lang));
    if (audio.length === 0) throw new Error("empty audio");
    return new NextResponse(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        // Phrases never change — let the CDN and app cache them for a month.
        "Cache-Control": "public, max-age=2592000, immutable",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "TTS failed." },
      { status: 502 },
    );
  }
}
