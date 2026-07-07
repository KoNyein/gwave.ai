export const locales = ["en", "my", "th", "zh"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Native-name labels for the language switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  my: "မြန်မာ",
  th: "ไทย",
  zh: "中文",
};

export const LOCALE_COOKIE = "GWAVE_LOCALE";

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
