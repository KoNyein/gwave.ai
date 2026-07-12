/**
 * Personal, eye-friendly appearance themes — chosen per-user (stored in
 * localStorage, applied client-side as data-theme on <html>) so each person
 * can pick a low-strain dark palette independently of the admin site theme.
 *
 * Every palette avoids pure white text and pure black backgrounds, uses
 * softened contrast, and pairs with a frosted-glass card treatment (see
 * globals.css) for a calmer night-time read.
 */
export const USER_APPEARANCES = [
  {
    id: "default",
    label: "မူလ (Site default)",
    desc: "Admin သတ်မှတ်ထားတဲ့ theme",
    swatch: ["#3B6D11", "#EAF3DE", "#639922"],
  },
  {
    id: "sage-mist",
    label: "Sage Mist",
    desc: "အစိမ်းအနွေး dark — ညဘက်သုံးရန်",
    swatch: ["#14211b", "#5cbf8f", "#2e8a5a"],
  },
  {
    id: "dim-slate",
    label: "Dim Slate",
    desc: "မီးခိုးပြာ soft dark — အဖြူစစ် မသုံး",
    swatch: ["#171b22", "#6fa8dc", "#3f6d99"],
  },
  {
    id: "hacker",
    label: "Hacker Terminal",
    desc: "အနက်ပေါ် အစိမ်း terminal",
    swatch: ["#050b06", "#3ce65a", "#7bd63a"],
  },
  {
    id: "amber-noir",
    label: "Amber Noir",
    desc: "အနက် · အဝါ · အစိမ်း",
    swatch: ["#0f0e08", "#f2c033", "#3fae6b"],
  },
  {
    id: "deep-ocean",
    label: "Deep Ocean",
    desc: "မှောင်တဲ့ teal — မျက်လုံးအေး",
    swatch: ["#111c22", "#40c4c4", "#3aa08f"],
  },
] as const;

export type UserAppearanceId = (typeof USER_APPEARANCES)[number]["id"];

/** localStorage key holding the chosen appearance id. */
export const APPEARANCE_KEY = "gwave-appearance";

/** The data-theme values that carry a frosted-glass, dark, low-strain look. */
export const PERSONAL_DARK_THEMES = USER_APPEARANCES.filter(
  (a) => a.id !== "default",
).map((a) => a.id);
