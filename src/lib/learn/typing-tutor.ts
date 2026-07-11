// Typing-tutor data: the QWERTY keyboard layout, the 9-finger colour map and
// per-key finger assignment (for the on-screen keyboard highlight + "which
// finger" guidance), plus a level-based touch-typing curriculum. Burmese
// labels throughout. Pure data — safe to import from client and server.

export type FingerId =
  | "lp" // left pinky
  | "lr" // left ring
  | "lm" // left middle
  | "li" // left index
  | "ri" // right index
  | "rm" // right middle
  | "rr" // right ring
  | "rp" // right pinky
  | "th"; // thumbs (space)

export interface FingerInfo {
  /** Short Burmese name shown in the "press with" hint. */
  label: string;
  /** Tailwind background class for the coloured key. */
  bg: string;
  /** Home-row resting key for this finger (empty for thumb). */
  home: string;
}

export const FINGERS: Record<FingerId, FingerInfo> = {
  lp: { label: "ဘယ်လက်သန်း", bg: "bg-rose-500", home: "a" },
  lr: { label: "ဘယ်လက်ခွင်", bg: "bg-amber-500", home: "s" },
  lm: { label: "ဘယ်လက်ခလယ်", bg: "bg-lime-500", home: "d" },
  li: { label: "ဘယ်လက်ညှိုး", bg: "bg-emerald-500", home: "f" },
  ri: { label: "ညာလက်ညှိုး", bg: "bg-sky-500", home: "j" },
  rm: { label: "ညာလက်ခလယ်", bg: "bg-indigo-500", home: "k" },
  rr: { label: "ညာလက်ခွင", bg: "bg-violet-500", home: "l" },
  rp: { label: "ညာလက်သန်း", bg: "bg-pink-500", home: ";" },
  th: { label: "လက်မ", bg: "bg-slate-500", home: "" },
};

export const FINGER_ORDER: FingerId[] = [
  "lp", "lr", "lm", "li", "ri", "rm", "rr", "rp", "th",
];

// Which finger presses which key (standard touch-typing assignment).
const ASSIGN: Record<FingerId, string[]> = {
  lp: ["`", "1", "q", "a", "z"],
  lr: ["2", "w", "s", "x"],
  lm: ["3", "e", "d", "c"],
  li: ["4", "5", "r", "t", "f", "g", "v", "b"],
  ri: ["6", "7", "y", "u", "h", "j", "n", "m"],
  rm: ["8", "i", "k", ","],
  rr: ["9", "o", "l", "."],
  rp: ["0", "-", "=", "p", "[", "]", "\\", ";", "'", "/"],
  th: [" "],
};

/** char (lowercase) → finger that should press it. */
export const KEY_FINGER: Record<string, FingerId> = (() => {
  const map: Record<string, FingerId> = {};
  (Object.keys(ASSIGN) as FingerId[]).forEach((f) => {
    for (const k of ASSIGN[f]) map[k] = f;
  });
  return map;
})();

// Shifted symbols map back to their base key (so we can still show the finger).
const SHIFT_BASE: Record<string, string> = {
  "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7",
  "*": "8", "(": "9", ")": "0", _: "-", "+": "=", "{": "[", "}": "]",
  "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/", "~": "`",
};

/** The physical key (lowercase) a character is typed on. */
export function keyFor(ch: string): string {
  if (ch === " ") return " ";
  const lower = ch.toLowerCase();
  if (lower !== ch.toLowerCase()) return lower;
  if (KEY_FINGER[lower]) return lower;
  if (SHIFT_BASE[ch]) return SHIFT_BASE[ch];
  return lower;
}

/** The finger that should press a given character (or null if unknown). */
export function fingerFor(ch: string): FingerId | null {
  const k = keyFor(ch);
  return KEY_FINGER[k] ?? null;
}

// On-screen keyboard rows (lowercase base keys).
export const KEYBOARD_ROWS: string[][] = [
  ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]", "\\"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";", "'"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
];

/** Home-row resting keys (get the little bump / accent). */
export const HOME_KEYS = new Set(["a", "s", "d", "f", "j", "k", "l", ";"]);

export interface TypingLesson {
  id: string;
  title: string;
  /** 1 = beginner … 5 = advanced. */
  level: number;
  text: string;
}

// Level-based touch-typing curriculum. Home row first, then reach keys, then
// whole words and sentences — the classic progression.
export const TYPING_LESSONS: TypingLesson[] = [
  { id: "home-fj", title: "Home Row — f j", level: 1, text: "ff jj fj jf ffj jjf fjf jfj ff jj fj jf fjf jfj ffj" },
  { id: "home-asdf", title: "Home Row — a s d f", level: 1, text: "asdf asdf sad fad dad ads fads sass adds fada dasa sadf" },
  { id: "home-jkl", title: "Home Row — j k l ;", level: 1, text: "jkl; jkl; kill lull jall kall lalk jkl; llkj lkjl jklk" },
  { id: "home-all", title: "Home Row — အားလုံး", level: 1, text: "ask fall lads salad glass hall jak dash flask half aha" },
  { id: "reach-e-i", title: "Reach — e i", level: 2, text: "the die lie fie kie see fee die dike file like idle site" },
  { id: "top-row", title: "Top Row — q w e r t y", level: 2, text: "quit wire type your true were quote party write terry yew" },
  { id: "bottom-row", title: "Bottom Row — z x c v b n m", level: 2, text: "zinc box cave numb vine mix zebra brave manic combo maze" },
  { id: "caps", title: "စာလုံးကြီး (Shift)", level: 3, text: "The Sun Rises. My Farm Grows. Water The Plants. Good Day." },
  { id: "numbers", title: "ဂဏန်းများ", level: 3, text: "12 plants 30 days 90 seeds 7 rows 45 kg 100 litres 5 pots" },
  { id: "punct", title: "အမှတ်အသားများ", level: 3, text: "yes, no; wait. go! (soon) 'ok' \"fine\" — done? a/b + c = d" },
  { id: "words-common", title: "အသုံးများ စကားလုံးများ", level: 3, text: "the and you that have with this from they will your what our" },
  { id: "words-farm", title: "စိုက်ပျိုးရေး စကားလုံးများ", level: 4, text: "seed water light soil plant grow harvest root leaf farm crop" },
  { id: "sentence-1", title: "ဝါကျ — အခြေခံ", level: 4, text: "A good farmer waters the plants every morning before the sun." },
  { id: "sentence-2", title: "ဝါကျ — ရှည်", level: 4, text: "Healthy soil, clean water and enough light help every seed grow strong." },
  { id: "code-symbols", title: "Code Symbols", level: 5, text: "const x = 10; if (x > 5) { print(x); } // done #tag @user $val" },
  { id: "paragraph", title: "စာပိုဒ် — အမြန်", level: 5, text: "Typing well is a skill built one key at a time. Keep your fingers on the home row, look at the screen, and let speed come with practice." },
];

// Fixed-length passages for the timed challenges (long, so they don't run out).
export const CHALLENGE_TEXT =
  "The quick brown fox jumps over the lazy dog while a gentle rain falls on the green farm. " +
  "Every morning the farmer checks the soil, waters each young plant, and counts the new leaves. " +
  "Good habits grow like healthy crops when we care for them a little each day. " +
  "Keep your back straight, your fingers on the home row, and your eyes on the screen. " +
  "Speed will follow accuracy, so type calmly and let each word flow into the next one. " +
  "A patient learner becomes a fast typist, one steady keystroke at a time, day after day.";

export const CHALLENGE_DURATIONS = [60, 120, 240] as const;
