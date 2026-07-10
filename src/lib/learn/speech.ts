// Client-only helpers around the browser Web Speech API. No network, no
// external service — the browser does text-to-speech and speech recognition
// locally (recognition may use an OS/cloud engine depending on the browser).

/** Speak `text` in the given BCP-47 language using the best matching voice. */
export function speak(text: string, lang: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // stop anything already playing
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.9; // a touch slower, easier for a learner to follow
  const voices = synth.getVoices();
  const primary = lang.split("-")[0] ?? lang;
  const match =
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith(primary));
  if (match) utter.voice = match;
  synth.speak(utter);
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Normalise a string for lenient comparison: lowercase, strip punctuation and
 *  whitespace so pronunciation scoring ignores spacing and case. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"()¿¡。，、！？；：]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/** Levenshtein edit distance between two strings. */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n] ?? 0;
}

/** A 0–100 similarity score between a spoken/typed attempt and the target. */
export function similarity(attempt: string, target: string): number {
  const a = normalise(attempt);
  const b = normalise(target);
  if (!a || !b) return 0;
  if (a === b) return 100;
  const dist = editDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, Math.round((1 - dist / maxLen) * 100));
}

// ---- Minimal typings for the (non-standard) SpeechRecognition API ----------
export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
export interface SpeechRecognitionResultEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

/** Return the browser's SpeechRecognition constructor if available. */
export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}
