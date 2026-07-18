export const locales = [
  "en", // English
  "my", // မြန်မာ (Burmese)
  "ar", // العربية (Arabic, RTL)
  "ur", // اردو (Urdu, RTL)
  "rki", // ရခိုင် (Rakhine)
  "shn", // ရှမ်း (Shan)
  "mnw", // မွန် (Mon)
  "ksw", // ကရင် (S'gaw Karen)
  "kyu", // ကယား (Kayah)
  "cnh", // ချင်း (Chin / Hakha)
  "th", // ไทย (Thai)
  "zh", // 中文 (Chinese)
] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Native-name labels for the language switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  my: "မြန်မာ",
  ar: "العربية",
  ur: "اردو",
  rki: "ရခိုင်",
  shn: "တႆး (ရှမ်း)",
  mnw: "ဘာသာ မန်",
  ksw: "ကညီ (ကရင်)",
  kyu: "ကယား",
  cnh: "ချင်း",
  th: "ไทย",
  zh: "中文",
};

/** Right-to-left scripts. The <html dir> is set from this. */
export const RTL_LOCALES: readonly Locale[] = ["ar", "ur"];
export function isRtl(locale: string): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

/**
 * Intermediate fallback before English, for keys a locale hasn't translated yet.
 * The Myanmar ethnic languages fall back to Burmese (which their speakers read)
 * rather than English; everything ultimately falls back to English (defaultLocale).
 */
export const FALLBACK_BASE: Partial<Record<Locale, Locale>> = {
  rki: "my",
  shn: "my",
  mnw: "my",
  ksw: "my",
  kyu: "my",
  cnh: "my",
};

export const LOCALE_COOKIE = "GWAVE_LOCALE";

/**
 * Should inline bilingual UI strings show their Burmese variant? True for
 * Burmese and the ethnic languages whose speakers read Burmese (same set as
 * FALLBACK_BASE). Everything else — including the default locale — reads the
 * English variant.
 */
export function prefersMyanmarScript(locale: string): boolean {
  return locale === "my" || locale in FALLBACK_BASE;
}

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
