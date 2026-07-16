export const locales = [
  "en",
  "my",
  "th",
  "zh",
  // Right-to-left scripts.
  "ar",
  "ur",
  // Myanmar ethnic languages. Message files start from a Burmese base and are
  // filled in by native speakers; the app works meanwhile via that base.
  "rki", // Rakhine / Arakanese
  "shn", // Shan (Tai)
  "mnw", // Mon
  "kar", // Karen (Sgaw)
  "kyu", // Kayah / Karenni
  "cnh", // Chin
] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Locales written right-to-left. Drives <html dir> and layout mirroring. */
export const RTL_LOCALES: readonly Locale[] = ["ar", "ur"];

export function isRtl(locale: string): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

/** Native-name (endonym) labels for the language switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  my: "မြန်မာ",
  th: "ไทย",
  zh: "中文",
  ar: "العربية",
  ur: "اردو",
  rki: "ရခိုင်",
  shn: "တႆး (ရှမ်း)",
  mnw: "ဘာသာ မန်",
  kar: "ကညီ (ကရင်)",
  kyu: "ကယား",
  cnh: "ချင်း",
};

export const LOCALE_COOKIE = "GWAVE_LOCALE";

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
