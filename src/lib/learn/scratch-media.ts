// Teaching aids for the Scratch (block-coding) track: original SVG block
// diagrams (in /public/learn/scratch) and per-lesson "watch on YouTube"
// learning queries, merged at track-assembly time. Pure data.

import type { Lesson } from "@/lib/learn/lessons";
import {
  enrichLessons,
  type CodeExtra,
  type LessonImage,
  type LessonVideo,
} from "@/lib/learn/media-enrich";

const IMG = "/learn/scratch";

const IMAGES: Record<string, LessonImage> = {
  "what-is-scratch": {
    src: `${IMG}/blocks-intro.svg`,
    alt: "Scratch blocks snapping together like puzzle pieces",
    caption: "Code မရိုက်ဘဲ block ဆက်တပ်ရုံနဲ့ အမိန့်ပေး",
  },
  "first-move": {
    src: `${IMG}/motion-move.svg`,
    alt: "Move steps block moving the cat sprite",
    caption: "«ခြေလှမ်း ရှေ့သွား» — sprite ကို ရွှေ့",
  },
  turning: {
    src: `${IMG}/motion-turn.svg`,
    alt: "Turn degrees block rotating the sprite",
    caption: "«ဒီဂရီ လှည့်» — လမ်းကြောင်း ပြောင်း",
  },
  "loops-intro": {
    src: `${IMG}/loop-repeat.svg`,
    alt: "Repeat loop block wrapping other blocks",
    caption: "«ကြိမ် ထပ်လုပ်» — block များများ မထည့်ဘဲ ထပ်",
  },
  "draw-square": {
    src: `${IMG}/pen-square.svg`,
    alt: "Repeat 4 of move and turn draws a square",
    caption: "repeat 4 [ရှေ့ + 90° လှည့်] = စတုဂံ",
  },
  "say-hello": {
    src: `${IMG}/say-bubble.svg`,
    alt: "Say block showing a speech bubble",
    caption: "«ပြော» — ခေါင်းပေါ် စကားပြော ပူဖောင်း",
  },
  "pen-art": {
    src: `${IMG}/pen-art.svg`,
    alt: "Pen down draws a trail as the sprite moves",
    caption: "pen down — ရွှေ့ရင်း ပန်းချီ ဆွဲ",
  },
  events: {
    src: `${IMG}/event-flag.svg`,
    alt: "Event hat blocks: flag clicked and key pressed",
    caption: "Hat block — flag/key နှိပ်မှ script စ",
  },
  staircase: {
    src: `${IMG}/staircase.svg`,
    alt: "Repeating x and y change makes a staircase",
    caption: "ပုံစံ ထပ်တာကို loop → လှေကား",
  },
  "forever-loop": {
    src: `${IMG}/forever.svg`,
    alt: "Forever loop runs blocks endlessly",
    caption: "«forever» — ရပ်တဲ့အထိ မပြတ် ထပ်",
  },
  "variables-lists": {
    src: `${IMG}/variables.svg`,
    alt: "A score variable holding a changing value",
    caption: "Variable — score/အသက် တန်ဖိုး သိမ်း",
  },
  conditionals: {
    src: `${IMG}/if-else.svg`,
    alt: "If else block branching on a condition",
    caption: "«အကယ်၍ ... ဆိုရင်» — ဆုံးဖြတ်ချက်",
  },
  sound: {
    src: `${IMG}/sound.svg`,
    alt: "Play sound and note blocks with a waveform",
    caption: "Sound block — Meow/တေးသွား ထည့်",
  },
  "concepts-quiz": {
    src: `${IMG}/blocks-palette.svg`,
    alt: "Scratch block categories by colour",
    caption: "အုပ်စုများ — အရောင်လိုက် မှတ်",
  },
  "free-build": {
    src: `${IMG}/sprite-stage.svg`,
    alt: "Sprite on stage driven by a block script",
    caption: "Sprite + Stage + Script ပေါင်း တည်ဆောက်",
  },
  "next-steps": {
    src: `${IMG}/path-forward.svg`,
    alt: "Same logic in Scratch blocks and Python text code",
    caption: "Block logic — Python/JS မှာလည်း တူ",
  },
};

const VIDEOS: Record<string, LessonVideo> = {
  "what-is-scratch": { youtubeQuery: "scratch programming for beginners burmese" },
  "first-move": { youtubeQuery: "scratch move steps block tutorial" },
  turning: { youtubeQuery: "scratch turn degrees direction tutorial" },
  "loops-intro": { youtubeQuery: "scratch repeat loop block tutorial" },
  "draw-square": { youtubeQuery: "scratch draw square with pen repeat" },
  "say-hello": { youtubeQuery: "scratch say block speech bubble tutorial" },
  "pen-art": { youtubeQuery: "scratch pen extension drawing tutorial" },
  events: { youtubeQuery: "scratch events hat blocks green flag tutorial" },
  staircase: { youtubeQuery: "scratch draw staircase loop tutorial" },
  "forever-loop": { youtubeQuery: "scratch forever loop tutorial" },
  "variables-lists": { youtubeQuery: "scratch variables score tutorial" },
  conditionals: { youtubeQuery: "scratch if else conditional block tutorial" },
  sound: { youtubeQuery: "scratch play sound block tutorial" },
  "concepts-quiz": { youtubeQuery: "scratch block categories explained" },
  "free-build": { youtubeQuery: "scratch make a simple game beginners" },
  "next-steps": { youtubeQuery: "from scratch to python for kids" },
};

const CODE: Record<string, CodeExtra> = {};

/** Merge block diagrams and teaching videos into the Scratch lessons. */
export function enrichScratchLessons(lessons: Lesson[]): Lesson[] {
  return enrichLessons(lessons, IMAGES, CODE, VIDEOS);
}
