/// Edu Arcade ရဲ့ game definitions — မေးခွန်းထုတ်တဲ့ generator တွေ။
///
/// Game အများစုက **"မှန်တဲ့ 3D object ကို ရွေး"** mechanic တစ်ခုတည်း —
/// prompt တစ်ခုပြ၊ ရွေးစရာ object ၃-၄ ခု မျှော၊ မှန်ရင် confetti။
/// (Word Builder နဲ့ Memory ကတော့ arcade.tsx မှာ သီးခြား mode)
///
/// ★ ရှိပြီးသား HTML learning games (Math Sprint, အရောင်ခွဲ, တိရစ္ဆာန်,
///   အသီးအနှံ, နိုင်ငံအလံ, စုံ/မ, မြှောက်ကိန်း, ပေါင်း/နုတ်, Hex Colour,
///   အရေအတွက်ရေတွက်, Memory Match, စာလုံးပေါင်း) တွေရဲ့ 3D မျိုးဆက်။

export type Choice = {
  /// Emoji (sprite) ဒါမှမဟုတ် စာသား tile
  emoji?: string;
  text?: string;
  /// Crystal အရောင် (color games)
  color?: string;
  correct: boolean;
};

export type Round = { prompt: string; sub?: string; choices: Choice[] };

export type PickGame = {
  id: string;
  nameMy: string;
  emoji: string;
  blurbMy: string;
  kind: "pick";
  rounds: number;
  gen(): Round;
};

export type SpecialGame = {
  id: "word" | "memory";
  nameMy: string;
  emoji: string;
  blurbMy: string;
  kind: "word" | "memory";
};

export type ArcadeGame = PickGame | SpecialGame;

const ri = (n: number) => Math.floor(Math.random() * n);
const shuffle = <T,>(a: T[]): T[] => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};
/// မှား choice တွေ correct နဲ့ မထပ်အောင် ထုတ်တယ်
function numberChoices(correct: number, spread: number): Choice[] {
  const wrong = new Set<number>();
  while (wrong.size < 3) {
    const w = correct + (ri(spread * 2 + 1) - spread);
    if (w !== correct && w >= 0) wrong.add(w);
  }
  return shuffle([
    { text: String(correct), correct: true },
    ...[...wrong].map((w) => ({ text: String(w), correct: false })),
  ]);
}

const ANIMALS: [string, string][] = [
  ["🐘", "ဆင်"], ["🦁", "ခြင်္သေ့"], ["🐯", "ကျား"], ["🐮", "နွား"], ["🐔", "ကြက်"],
  ["🐷", "ဝက်"], ["🐍", "မြွေ"], ["🐟", "ငါး"], ["🐒", "မျောက်"], ["🐕", "ခွေး"],
  ["🐈", "ကြောင်"], ["🐎", "မြင်း"], ["🦆", "ဘဲ"], ["🐐", "ဆိတ်"], ["🦉", "ဇီးကွက်"],
];
const FRUITS: [string, string][] = [
  ["🍎", "ပန်းသီး"], ["🍌", "ငှက်ပျောသီး"], ["🥭", "သရက်သီး"], ["🍉", "ဖရဲသီး"],
  ["🍇", "စပျစ်သီး"], ["🍍", "နာနတ်သီး"], ["🥥", "အုန်းသီး"], ["🍊", "လိမ္မော်သီး"],
  ["🍓", "စတော်ဘယ်ရီ"], ["🍋", "ရှောက်သီး"], ["🍑", "မက်မွန်သီး"], ["🥑", "ထောပတ်သီး"],
];
const FLAGS: [string, string][] = [
  ["🇲🇲", "မြန်မာ"], ["🇹🇭", "ထိုင်း"], ["🇯🇵", "ဂျပန်"], ["🇰🇷", "ကိုရီးယား"],
  ["🇨🇳", "တရုတ်"], ["🇮🇳", "အိန္ဒိယ"], ["🇺🇸", "အမေရိကန်"], ["🇬🇧", "ဗြိတိန်"],
  ["🇸🇬", "စင်္ကာပူ"], ["🇻🇳", "ဗီယက်နမ်"], ["🇫🇷", "ပြင်သစ်"], ["🇩🇪", "ဂျာမနီ"],
];
const COLORS: [string, string, string][] = [
  // [css color, မြန်မာအမည်, hex]
  ["#ef4444", "အနီ", "#ef4444"],
  ["#3b82f6", "အပြာ", "#3b82f6"],
  ["#22c55e", "အစိမ်း", "#22c55e"],
  ["#eab308", "အဝါ", "#eab308"],
  ["#a855f7", "ခရမ်း", "#a855f7"],
  ["#f97316", "လိမ္မော်ရောင်", "#f97316"],
  ["#ec4899", "ပန်းရောင်", "#ec4899"],
  ["#8b5e34", "အညို", "#8b5e34"],
  ["#111827", "အနက်", "#111827"],
  ["#e5e7eb", "အဖြူ", "#e5e7eb"],
];
const COUNT_EMOJI = ["🍎", "⭐", "🎈", "🐠", "🌸", "⚽"];

/// Pair-list ကနေ "အမည်တွဲ" round ထုတ်
function matchRound(pairs: [string, string][], prompt: (name: string) => string): Round {
  const picks = shuffle([...pairs]).slice(0, 4);
  const target = picks[ri(picks.length)]!;
  return {
    prompt: prompt(target[1]),
    choices: picks.map(([emoji]) => ({ emoji, correct: emoji === target[0] })),
  };
}

export const PICK_GAMES: PickGame[] = [
  {
    id: "math",
    nameMy: "သင်္ချာ ပစ်ခွင်း",
    emoji: "🧮",
    blurbMy: "အပေါင်း/အနုတ်/အမြှောက် — မှန်တဲ့ အဖြေကြယ်ကို ပစ်ခွင်းပါ",
    kind: "pick",
    rounds: 10,
    gen() {
      const op = ri(3);
      let a: number;
      let b: number;
      let ans: number;
      let sym: string;
      if (op === 0) {
        a = 2 + ri(48);
        b = 2 + ri(48);
        ans = a + b;
        sym = "+";
      } else if (op === 1) {
        a = 10 + ri(80);
        b = 1 + ri(Math.min(a - 1, 40));
        ans = a - b;
        sym = "−";
      } else {
        a = 2 + ri(11);
        b = 2 + ri(11);
        ans = a * b;
        sym = "×";
      }
      return { prompt: `${a} ${sym} ${b} = ?`, choices: numberChoices(ans, 8) };
    },
  },
  {
    id: "count",
    nameMy: "အရေအတွက် ရေတွက်",
    emoji: "🔢",
    blurbMy: "ပေါ်လာတဲ့ ပစ္စည်းတွေ ဘယ်နှစ်ခုလဲ ရေတွက်ပြီး ရွေးပါ",
    kind: "pick",
    rounds: 8,
    gen() {
      const n = 3 + ri(7);
      const emoji = COUNT_EMOJI[ri(COUNT_EMOJI.length)]!;
      return {
        prompt: `${emoji} ဘယ်နှစ်ခု ရှိလဲ?`,
        sub: Array.from({ length: n }, () => emoji).join(" "),
        choices: numberChoices(n, 2),
      };
    },
  },
  {
    id: "oddeven",
    nameMy: "စုံ / မ ခွဲ",
    emoji: "⚖️",
    blurbMy: "တောင်းဆိုတဲ့ စုံဂဏန်း (သို့) မဂဏန်းကို ရွေးပါ",
    kind: "pick",
    rounds: 10,
    gen() {
      const wantEven = ri(2) === 0;
      const correct = 2 + ri(48) * 2 + (wantEven ? 0 : 1);
      const wrong = new Set<number>();
      while (wrong.size < 3) {
        const w = 2 + ri(48) * 2 + (wantEven ? 1 : 0);
        wrong.add(w);
      }
      return {
        prompt: wantEven ? "စုံဂဏန်းကို ရွေးပါ" : "မဂဏန်းကို ရွေးပါ",
        choices: shuffle([
          { text: String(correct), correct: true },
          ...[...wrong].map((w) => ({ text: String(w), correct: false })),
        ]),
      };
    },
  },
  {
    id: "animal",
    nameMy: "တိရစ္ဆာန် အမည်တွဲ",
    emoji: "🐾",
    blurbMy: "အမည်နဲ့ ကိုက်တဲ့ တိရစ္ဆာန်ကို ရွေးပါ",
    kind: "pick",
    rounds: 10,
    gen: () => matchRound(ANIMALS, (n) => `"${n}" ကို ရွေးပါ`),
  },
  {
    id: "fruit",
    nameMy: "အသီးအနှံ အမည်တွဲ",
    emoji: "🍎",
    blurbMy: "အမည်နဲ့ ကိုက်တဲ့ အသီးကို ရွေးပါ",
    kind: "pick",
    rounds: 10,
    gen: () => matchRound(FRUITS, (n) => `"${n}" ကို ရွေးပါ`),
  },
  {
    id: "flag",
    nameMy: "နိုင်ငံ အလံ",
    emoji: "🚩",
    blurbMy: "နိုင်ငံအမည်နဲ့ ကိုက်တဲ့ အလံကို ရွေးပါ",
    kind: "pick",
    rounds: 10,
    gen: () => matchRound(FLAGS, (n) => `"${n}" နိုင်ငံရဲ့ အလံ?`),
  },
  {
    id: "colorname",
    nameMy: "အရောင် အမည်",
    emoji: "🌈",
    blurbMy: "အရောင်အမည်နဲ့ ကိုက်တဲ့ ကျောက်တုံးကို ရွေးပါ",
    kind: "pick",
    rounds: 10,
    gen() {
      const picks = shuffle([...COLORS]).slice(0, 4);
      const t = picks[ri(picks.length)]!;
      return {
        prompt: `"${t[1]}" ရောင်ကို ရွေးပါ`,
        choices: picks.map(([css]) => ({ color: css, correct: css === t[0] })),
      };
    },
  },
  {
    id: "hex",
    nameMy: "Hex Colour 3D",
    emoji: "🎨",
    blurbMy: "CSS hex code နဲ့ ကိုက်တဲ့ အရောင်ကို ရွေး — web developer အစပျိုး",
    kind: "pick",
    rounds: 10,
    gen() {
      const picks = shuffle([...COLORS]).slice(0, 4);
      const t = picks[ri(picks.length)]!;
      return {
        prompt: t[2],
        sub: "ဒီ hex code က ဘယ်အရောင်လဲ?",
        choices: picks.map(([css]) => ({ color: css, correct: css === t[0] })),
      };
    },
  },
];

/// Word Builder ရဲ့ စကားလုံးစာရင်း — emoji hint နဲ့
export const WORDS: { word: string; emoji: string; my: string }[] = [
  { word: "CAT", emoji: "🐱", my: "ကြောင်" },
  { word: "DOG", emoji: "🐶", my: "ခွေး" },
  { word: "SUN", emoji: "☀️", my: "နေ" },
  { word: "FISH", emoji: "🐟", my: "ငါး" },
  { word: "BIRD", emoji: "🐦", my: "ငှက်" },
  { word: "APPLE", emoji: "🍎", my: "ပန်းသီး" },
  { word: "HOUSE", emoji: "🏠", my: "အိမ်" },
  { word: "WATER", emoji: "💧", my: "ရေ" },
  { word: "MOON", emoji: "🌙", my: "လ" },
  { word: "STAR", emoji: "⭐", my: "ကြယ်" },
  { word: "TREE", emoji: "🌳", my: "သစ်ပင်" },
  { word: "BOOK", emoji: "📖", my: "စာအုပ်" },
];

/// Memory Match ရဲ့ pair emoji များ
export const MEMORY_EMOJI = ["🐘", "🍎", "⭐", "🎈", "🐠", "🌸", "🚗", "🎵"];

export const SPECIAL_GAMES: SpecialGame[] = [
  {
    id: "word",
    nameMy: "စာလုံးပေါင်း တည်ဆောက်",
    emoji: "🔤",
    blurbMy: "စာလုံးတုံးတွေကို အစီအစဉ်မှန်အောင် နှိပ်ပြီး စကားလုံး ပေါင်းပါ",
    kind: "word",
  },
  {
    id: "memory",
    nameMy: "Memory Match 3D",
    emoji: "🧠",
    blurbMy: "ကတ်တွေ လှန်ပြီး တူတဲ့အတွဲ ရှာပါ",
    kind: "memory",
  },
];

export const ALL_GAMES: ArcadeGame[] = [...PICK_GAMES, ...SPECIAL_GAMES];
