// Client-only helpers around the browser Web Speech API. No network, no
// external service — the browser does text-to-speech and speech recognition
// locally (recognition may use an OS/cloud engine depending on the browser).

// iOS Safari loads voices asynchronously — getVoices() is often empty on the
// first call and only fills after a `voiceschanged` event, so keep a cache.
let voicesCache: SpeechSynthesisVoice[] = [];
let voicesListenerAttached = false;
// Keep the active utterance referenced: WebKit garbage-collects utterances
// mid-speech, which cuts the audio off silently.
let activeUtterance: SpeechSynthesisUtterance | null = null;

function loadVoices(synth: SpeechSynthesis): SpeechSynthesisVoice[] {
  const now = synth.getVoices();
  if (now.length > 0) voicesCache = now;
  if (!voicesListenerAttached) {
    voicesListenerAttached = true;
    synth.addEventListener?.("voiceschanged", () => {
      const v = synth.getVoices();
      if (v.length > 0) voicesCache = v;
    });
  }
  return voicesCache;
}

/** Speak `text` in the given BCP-47 language using the best matching voice. */
export function speak(text: string, lang: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.9; // a touch slower, easier for a learner to follow
  const voices = loadVoices(synth);
  const primary = (lang.split("-")[0] ?? lang).toLowerCase();
  const match =
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(primary));
  if (match) utter.voice = match;
  activeUtterance = utter;
  utter.onend = utter.onerror = () => {
    if (activeUtterance === utter) activeUtterance = null;
  };
  const kick = () => {
    synth.speak(utter);
    // iOS Safari can be stuck "paused" after a cancel or backgrounding, and
    // then speak() queues silently forever — resume() unsticks it.
    synth.resume();
  };
  if (synth.speaking || synth.pending) {
    // WebKit drops an utterance queued in the same tick as cancel(); give the
    // engine a beat to actually flush before speaking again.
    synth.cancel();
    setTimeout(kick, 120);
  } else {
    // Nothing to cancel — speak synchronously inside the user gesture (iOS
    // requires the first speak() of a page to happen inside one).
    kick();
  }
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
