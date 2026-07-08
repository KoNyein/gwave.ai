/**
 * Site-wide appearance templates. The active one is stored in
 * site_settings (key "appearance", publicly readable) and applied as a
 * data-theme attribute on <html>; each template is a CSS-variable set in
 * globals.css, so switching is instant and needs no rebuild.
 */
export const SITE_THEMES = ["greenwave", "ocean", "sunset"] as const;

export type SiteTheme = (typeof SITE_THEMES)[number];

export const DEFAULT_THEME: SiteTheme = "greenwave";

/** Swatches shown on the admin theme picker cards. */
export const THEME_PREVIEW: Record<
  SiteTheme,
  { primary: string; secondary: string; accent: string }
> = {
  greenwave: { primary: "#3B6D11", secondary: "#EAF3DE", accent: "#639922" },
  ocean: { primary: "#0D5F8F", secondary: "#DDEEf8", accent: "#16788C" },
  sunset: { primary: "#C25410", secondary: "#FBE8D3", accent: "#C22350" },
};

export function isSiteTheme(value: unknown): value is SiteTheme {
  return (
    typeof value === "string" && (SITE_THEMES as readonly string[]).includes(value)
  );
}
