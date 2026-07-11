"use server";

/**
 * Lightweight, key-free machine translation for chat messages via Google's
 * public translate endpoint. Auto-detects the source language and translates
 * into the viewer's UI locale. Best-effort: on any failure we return the
 * original text so the UI degrades gracefully.
 */

const LOCALE_TO_GT: Record<string, string> = {
  en: "en",
  my: "my",
  th: "th",
  zh: "zh-CN",
};

export interface TranslateResult {
  ok: boolean;
  text: string;
  /** Detected source language code (best effort), or "". */
  source: string;
}

export async function translateText(
  text: string,
  targetLocale: string,
): Promise<TranslateResult> {
  const clean = text.trim();
  if (!clean) return { ok: true, text: "", source: "" };

  const tl = LOCALE_TO_GT[targetLocale] ?? "en";
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t" +
    `&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(clean.slice(0, 3000))}`;

  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, text: clean, source: "" };

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return { ok: false, text: clean, source: "" };

    const segments = data[0];
    let out = "";
    if (Array.isArray(segments)) {
      for (const seg of segments) {
        if (Array.isArray(seg) && typeof seg[0] === "string") out += seg[0];
      }
    }
    const source = typeof data[2] === "string" ? data[2] : "";
    if (!out) return { ok: false, text: clean, source };
    return { ok: true, text: out, source };
  } catch {
    return { ok: false, text: clean, source: "" };
  }
}
