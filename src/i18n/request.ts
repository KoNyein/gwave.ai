import type { AbstractIntlMessages } from "next-intl";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import {
  defaultLocale,
  FALLBACK_BASE,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/i18n/config";

type Messages = AbstractIntlMessages;

/**
 * Deep-merge translations over the English base so a locale file may be partial
 * (or empty): any key it doesn't translate falls back to English instead of
 * rendering the raw key or throwing. Lets new languages ship incrementally.
 */
function mergeMessages(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const key of Object.keys(override)) {
    const o = override[key];
    if (o === undefined) continue;
    const b = out[key];
    out[key] =
      o && typeof o === "object" && !Array.isArray(o) &&
      b && typeof b === "object" && !Array.isArray(b)
        ? mergeMessages(b as Messages, o as Messages)
        : o;
  }
  return out;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const load = async (l: Locale): Promise<Messages> =>
    (await import(`../messages/${l}.json`)).default as Messages;

  // Merge order: English base → (Burmese for ethnic languages) → the locale itself.
  let messages = await load(defaultLocale);
  const mid = FALLBACK_BASE[locale];
  if (mid) messages = mergeMessages(messages, await load(mid));
  if (locale !== defaultLocale) messages = mergeMessages(messages, await load(locale));

  return { locale, messages };
});
