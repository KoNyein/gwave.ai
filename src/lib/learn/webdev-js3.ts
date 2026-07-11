// JavaScript course — third batch, 30 → 60 lessons. Deeper, practical JS for
// Myanmar learners: functional patterns, the DOM in depth, fetch, storage, and
// small projects. Burmese reading lessons. Original content for GreenWave.

import type { Lesson } from "@/lib/learn/lessons";

function rd(
  slug: string,
  title: string,
  summary: string,
  minutes: number,
  sections: [string, string][],
): Lesson {
  return {
    slug,
    title,
    summary,
    minutes,
    kind: "reading",
    sections: sections.map(([heading, body]) => ({ heading, body })),
  };
}

export const JS_EXTRA3: Lesson[] = [
  rd(
    "js-closures",
    "Closure",
    "function တစ်ခုက ပတ်ဝန်းကျင် variable ကို 'မှတ်' ထားခြင်း။",
    10,
    [
      ["closure ဆိုတာ", "အတွင်း function တစ်ခုက အပြင် function ရဲ့ variable ကို ပြန်ပြီးသုံးနိုင်တာ — function ပြီးသွားလည်း ဒီ variable က ကျန်နေသည်။ ဒါက closure။"],
      ["ဥပမာ", "`function counter() { let n = 0; return () => ++n; }` — ပြန်ရတဲ့ function ကို ခေါ်တိုင်း `n` က ဆက်တိုးသည်။ `n` က ပြင်ပက မမြင်ရ၊ လုံခြုံသည်။"],
      ["အသုံးဝင်ပုံ", "private data ထား၊ configuration ချုပ်ကိုင်၊ callback များ ဖန်တီးရာမှာ closure က အခြေခံ concept ဖြစ်သည်။"],
    ],
  ),
  rd(
    "js-higher-order",
    "Higher-Order Functions",
    "function ကို argument အဖြစ်ပေး/return ပြန်ခြင်း။",
    9,
    [
      ["function တွေက value", "JavaScript မှာ function က value တစ်ခုလို variable ထဲ ထည့်လို့၊ argument အဖြစ် ပေးလို့ ရသည်။ function ကို လက်ခံ/ပြန်ပေးတဲ့ function ကို higher-order ဟုခေါ်သည်။"],
      ["ဥပမာ", "`[1,2,3].map(x => x*2)` — `map` က function တစ်ခုကို argument အဖြစ် လက်ခံသည်။ ဒါက higher-order function။"],
      ["အကျိုး", "code ကို ပြန်သုံးလွယ်စေ၊ တိုတောင်းစေ၊ ဖတ်ရလွယ်စေသည် — functional programming ရဲ့ အနှစ်သာရ။"],
    ],
  ),
  rd(
    "js-map-filter-reduce",
    "map, filter, reduce",
    "array data ကို loop မလိုဘဲ ပြောင်း/စစ်/စုချုံ့ခြင်း။",
    11,
    [
      ["map", "`arr.map(fn)` က element တိုင်းကို ပြောင်းပြီး အသစ် array ပြန်ပေးသည် — ဈေးနှုန်းတွေကို VAT ပါ တွက်တာမျိုး။"],
      ["filter", "`arr.filter(fn)` က စစ်ဆေးမှု မှန်တဲ့ element များသာ ယူသည် — stock ကုန်နေတဲ့ ပစ္စည်းများ ဖယ်တာမျိုး။"],
      ["reduce", "`arr.reduce((sum, x) => sum + x, 0)` က array တစ်ခုလုံးကို တန်ဖိုးတစ်ခုအဖြစ် စုချုံ့သည် — အရောင်းစုစုပေါင်း တွက်တာမျိုး။"],
    ],
  ),
  rd(
    "js-array-sort",
    "Array စီစဉ်ခြင်း (sort)",
    "sort နဲ့ compare function — အစဉ်လိုက် စီခြင်း။",
    9,
    [
      ["sort ရဲ့ သဘော", "`arr.sort()` က default အားဖြင့် စာသားအဖြစ် နှိုင်းယှဉ်စီသည် — ဂဏန်းတွေမှာ မှားနိုင်သည် (10 က 9 ရှေ့ရောက်)။"],
      ["compare function", "`arr.sort((a, b) => a - b)` က ငယ်စဉ်ကြီးလိုက်၊ `(a, b) => b - a` က ကြီးစဉ်ငယ်လိုက်။ object များအတွက် `a.price - b.price` စသဖြင့်။"],
      ["သတိ", "sort က မူရင်း array ကိုတိုက်ရိုက် ပြောင်းသည် (mutate)။ မူရင်းကို မထိချင်ရင် `[...arr].sort(...)` သုံးပါ။"],
    ],
  ),
  rd(
    "js-immutability",
    "Immutability",
    "data ကို မပြောင်းဘဲ အသစ်ဖန်တီးခြင်း — bug လျော့နည်း။",
    9,
    [
      ["ဘာကြောင့်", "မူရင်း data ကို တိုက်ရိုက် ပြောင်းရင် အခြားနေရာက အသုံးပြုမှုတွေ ထိခိုက်ပြီး bug ဖြစ်နိုင်သည်။ အသစ် ဖန်တီးတာက ပိုလုံခြုံသည်။"],
      ["spread သုံး", "`const updated = { ...user, name: \"သစ်\" }` က မူရင်း object ကို မထိဘဲ ပြောင်းထားတဲ့ copy အသစ် ဖန်တီးသည်။"],
      ["array", "`[...arr, newItem]` က ထည့်၊ `arr.filter(x => x.id !== id)` က ဖယ် — push/splice လို mutate မလုပ်ဘဲ။ React state အတွက် အထူးအရေးကြီး။"],
    ],
  ),
  rd(
    "js-modules",
    "Modules (import / export)",
    "code ကို ဖိုင်များ ခွဲ၍ ပြန်သုံးခြင်း။",
    9,
    [
      ["export", "ဖိုင်တစ်ခုက function/value ကို `export function area() {...}` သို့ `export const PI = 3.14` နဲ့ အခြားဖိုင်များ သုံးနိုင်အောင် ဖွင့်ပေးသည်။"],
      ["import", "`import { area } from \"./math.js\"` က တခြားဖိုင်က export ကို ယူသုံးသည်။ `export default` အတွက် `import area from ...` (curly မပါ)။"],
      ["အကျိုး", "code ကြီးလာရင် ဖိုင်များ ခွဲထားခြင်းက ရှာရ/ပြင်ရ/ပြန်သုံးရ လွယ်စေသည်။ modern JS project အားလုံး module သုံးသည်။"],
    ],
  ),
  rd(
    "js-fetch",
    "fetch — Internet မှ data",
    "API/server ကို ခေါ်ဆို၍ data ယူခြင်း။",
    10,
    [
      ["fetch()", "`fetch(url)` က server ကို request ပို့ပြီး Promise ပြန်ပေးသည်။ `.then(r => r.json())` နဲ့ JSON data ကို ဖတ်သည်။"],
      ["async/await ပုံစံ", "`const r = await fetch(url); const data = await r.json();` က ပိုဖတ်ရလွယ်သည်။ `try/catch` နဲ့ error ကို ဖမ်းပါ။"],
      ["ဥပမာ", "ရာသီဥတု API ကို fetch လုပ်ပြီး ယနေ့ အပူချိန်ကို စာမျက်နှာမှာ ပြသတာမျိုး လုပ်နိုင်သည်။"],
    ],
  ),
  rd(
    "js-fetch-render",
    "Data ကို စာမျက်နှာမှာ ပြသခြင်း",
    "fetch လုပ်ထားတဲ့ data ကို DOM မှာ render လုပ်ခြင်း။",
    10,
    [
      ["data → HTML", "fetch ရလာတဲ့ array ကို `.map()` နဲ့ HTML string ဖြစ်အောင် ပြောင်းပြီး `element.innerHTML = html` နဲ့ ထည့်သည်။"],
      ["template literal", "backtick နဲ့ `` `<li>${item.name}</li>` `` ပုံစံက data ကို HTML ထဲ လွယ်လွယ် ထည့်ပေးသည်။"],
      ["ဂရုစိုက်", "အသုံးပြုသူ ရိုက်ထည့်တဲ့ data ကို innerHTML မှာ တိုက်ရိုက် မထည့်ပါနှင့် — XSS အန္တရာယ် ရှိသည်။ `textContent` က ပိုလုံခြုံသည်။"],
    ],
  ),
  rd(
    "js-regex-js",
    "Regular Expressions",
    "စာသား pattern ရှာ/စစ်ဆေးခြင်း။",
    10,
    [
      ["pattern", "`/\\d{6,}/` က ဂဏန်း ၆ လုံးအထက်ကို ဆိုလိုသည်။ phone၊ email၊ password format စစ်ရာမှာ သုံးသည်။"],
      ["test နဲ့ match", "`/pattern/.test(str)` က မှန်/မှား ပြန်ပေးသည်။ `str.match(/pattern/g)` က တွေ့သမျှ ယူသည်။"],
      ["replace", "`str.replace(/\\s+/g, \" \")` က ကွက်လပ်များစွာကို တစ်လုံးအဖြစ် ပြောင်း — form input သန့်စင်ရာမှာ အသုံးဝင်သည်။"],
    ],
  ),
  rd(
    "js-localstorage",
    "localStorage",
    "browser ထဲမှာ data သိမ်းခြင်း — refresh လုပ်လည်း ကျန်။",
    9,
    [
      ["သိမ်း/ဖတ်", "`localStorage.setItem(\"name\", \"ကို\")` က သိမ်း၊ `localStorage.getItem(\"name\")` က ဖတ်သည်။ browser ပိတ်လည်း data ကျန်နေသည်။"],
      ["object သိမ်းခြင်း", "localStorage က string ပဲ သိမ်းလို့ object ကို `JSON.stringify()` နဲ့ သိမ်း၊ `JSON.parse()` နဲ့ ဖတ်ရသည်။"],
      ["ဥပမာ", "အသုံးပြုသူရဲ့ dark mode ရွေးချယ်မှု၊ cart ထဲက ပစ္စည်းများကို localStorage မှာ သိမ်းထားနိုင်သည်။"],
    ],
  ),
  rd(
    "js-sets-maps",
    "Set နဲ့ Map",
    "ထပ်နေမှုမရှိတဲ့ အစု (Set)၊ key-value အစု (Map)။",
    9,
    [
      ["Set", "`new Set([1,1,2,3])` က ထပ်နေတာတွေ ဖယ်ပြီး `{1,2,3}` ဖြစ်စေသည်။ array ထဲ ထပ်နေမှု ဖယ်ဖို့ `[...new Set(arr)]` သုံးသည်။"],
      ["Map", "Map က object နဲ့ ဆင်ပေမဲ့ key ကို string မဟုတ်တဲ့ အရာ (object, number) လည်း သုံးနိုင်ပြီး အစဉ်လိုက် ကျန်သည်။"],
      ["ဘယ်အခါသုံး", "unique တန်ဖိုးများအတွက် Set၊ ရှုပ်ထွေးတဲ့ key–value mapping အတွက် Map က object ထက် ပိုသင့်တော်သည်။"],
    ],
  ),
  rd(
    "js-generators",
    "Generator Functions",
    "တန်ဖိုးများကို တစ်ခုချင်း တဖြည်းဖြည်း ထုတ်ပေးခြင်း။",
    9,
    [
      ["function*", "`function* gen() { yield 1; yield 2; }` — `yield` က တန်ဖိုးတစ်ခု ထုတ်ပြီး ခဏရပ်သည်။ ခေါ်တိုင်း နောက်တစ်ခု ဆက်ထုတ်သည်။"],
      ["lazy", "generator က တန်ဖိုးအားလုံးကို တစ်ပြိုင်နက် မထုတ်ဘဲ လိုမှ ထုတ်ပေးလို့ memory သက်သာသည် — အဆုံးမရှိတဲ့ sequence တောင် ရသည်။"],
      ["for...of", "`for (const x of gen())` နဲ့ generator ရဲ့ တန်ဖိုးများကို လှည့်ဖတ်နိုင်သည်။"],
    ],
  ),
  rd(
    "js-optional-chaining",
    "Optional Chaining နဲ့ Nullish",
    "?. နဲ့ ?? — null/undefined ကို လုံခြုံစွာ ကိုင်တွယ်ခြင်း။",
    8,
    [
      ["?.", "`user?.address?.city` က user သို့ address က null/undefined ဆိုရင် error မတက်ဘဲ undefined ပြန်ပေးသည် — 'Cannot read property' crash မဖြစ်တော့ပါ။"],
      ["??", "`name ?? \"မသိ\"` က name က null/undefined ဆိုမှ default ကို သုံးသည်။ `||` နဲ့မတူတာက `0` သို့ `\"\"` ကို default မလုပ်ပါ။"],
      ["အသုံးဝင်ပုံ", "API response တွေမှာ field ရှိ/မရှိ မသေချာတဲ့အခါ ?. နဲ့ ?? က code ကို လုံခြုံပြီး တိုတောင်းစေသည်။"],
    ],
  ),
  rd(
    "js-getters-setters",
    "Getter နဲ့ Setter",
    "property ဖတ်/ရေးချိန်မှာ logic run ခြင်း။",
    8,
    [
      ["get / set", "class ထဲမှာ `get fullName() { return this.first + this.last; }` က property လို ဖတ်နိုင်တဲ့ computed value ဖန်တီးသည်။"],
      ["setter", "`set age(v) { if (v < 0) throw...; this._age = v; }` က တန်ဖိုး သတ်မှတ်ချိန်မှာ စစ်ဆေးမှု ထည့်နိုင်သည်။"],
      ["အကျိုး", "ပြင်ပက ရိုးရိုး property လို သုံးရင်း အတွင်းမှာ validation/တွက်ချက်မှု ဝှက်ထားနိုင်သည်။"],
    ],
  ),
  rd(
    "js-prototypes",
    "Prototype",
    "JavaScript ရဲ့ inheritance အခြေခံ။",
    9,
    [
      ["prototype chain", "object တိုင်းမှာ 'prototype' link ရှိသည်။ property ရှာတဲ့အခါ ကိုယ့်မှာ မတွေ့ရင် prototype ကို ဆက်ရှာသည် — ဒါက chain။"],
      ["class က အဖုံး", "modern `class` syntax က prototype အပေါ်မှာ တင်ထားတဲ့ အလှဆင်ခြင်းသာ။ အတွင်းမှာ prototype နဲ့ အလုပ်လုပ်နေသည်။"],
      ["ဘာကြောင့်သိသင့်", "method များကို instance တိုင်းမှာ မဟုတ်ဘဲ prototype တစ်နေရာမှာ သိမ်းလို့ memory သက်သာသည်။ debug လုပ်ရာမှာလည်း အသိပညာ ပေးသည်။"],
    ],
  ),
  rd(
    "js-event-delegation",
    "Event Delegation",
    "element များစွာအတွက် listener တစ်ခုတည်း သုံးခြင်း။",
    9,
    [
      ["ပြဿနာ", "list item ၁၀၀ ခုစီမှာ click listener တပ်ရင် memory ကုန်ပြီး၊ item အသစ်ထည့်ရင်လည်း ထပ်တပ်ရသည်။"],
      ["delegation", "parent element တစ်ခုမှာပဲ listener တပ်ပြီး `event.target` နဲ့ ဘယ် child ကို နှိပ်လဲ စစ်ဆေးသည်။ listener တစ်ခုတည်းနဲ့ အားလုံး ကိုင်တွယ်နိုင်သည်။"],
      ["အကျိုး", "dynamic ဖန်တီးတဲ့ element များအတွက်ပါ အလိုအလျောက် အလုပ်လုပ်ပြီး performance ကောင်းသည်။"],
    ],
  ),
  rd(
    "js-forms",
    "Form ကိုင်တွယ်ခြင်း",
    "input ဖတ်ခြင်း၊ submit ကို ကိုင်တွယ်ခြင်း၊ validation။",
    10,
    [
      ["submit event", "`form.addEventListener(\"submit\", e => { e.preventDefault(); ... })` — `preventDefault()` က စာမျက်နှာ reload မဖြစ်အောင် တားသည်။"],
      ["value ဖတ်", "`input.value` က ရိုက်ထည့်ထားတဲ့ စာသား၊ `checkbox.checked` က အမှန်ခြစ်မှုကို ပေးသည်။"],
      ["validation", "submit မလုပ်ခင် လိုအပ်တဲ့ field ပြည့်စုံမှု၊ format မှန်ကန်မှုကို စစ်ပြီး error message ပြသပါ — အသုံးပြုသူ အတွေ့အကြုံ ကောင်းစေသည်။"],
    ],
  ),
  rd(
    "js-dom-create",
    "DOM element ဖန်တီးခြင်း",
    "createElement, appendChild နဲ့ element အသစ် တည်ဆောက်ခြင်း။",
    9,
    [
      ["createElement", "`const li = document.createElement(\"li\")` က element အသစ် ဖန်တီး၊ `li.textContent = \"...\"` နဲ့ စာသား ထည့်၊ `ul.appendChild(li)` နဲ့ ချိတ်သည်။"],
      ["innerHTML vs createElement", "innerHTML က မြန်ဆန်လွယ်ကူပေမဲ့ user data အတွက် createElement + textContent က ပိုလုံခြုံသည် (XSS မဖြစ်)။"],
      ["remove", "`element.remove()` က DOM မှ ဖယ်ရှားသည်။ list item ဖျက်တာမျိုးအတွက် သုံးသည်။"],
    ],
  ),
  rd(
    "js-debounce-throttle",
    "Debounce နဲ့ Throttle",
    "မကြာခဏ ဖြစ်တဲ့ event များကို ထိန်းချုပ်ခြင်း။",
    10,
    [
      ["ပြဿနာ", "search box မှာ စာလုံးရိုက်တိုင်း API ခေါ်ရင် ခေါ်ဆိုမှု အလွန်များပြီး server ပင်ပန်းသည်။"],
      ["debounce", "ရိုက်နေစဉ် စောင့်ပြီး ရပ်သွားမှ (ဥပမာ 300ms) တစ်ကြိမ်တည်း ခေါ်သည် — search suggestion အတွက် အကောင်းဆုံး။"],
      ["throttle", "အချိန်တစ်ခုအတွင်း အများဆုံး တစ်ကြိမ်သာ run စေသည် — scroll၊ resize event များအတွက် သင့်တော်သည်။"],
    ],
  ),
  rd(
    "js-truthy-falsy",
    "Truthy နဲ့ Falsy",
    "ဘယ်တန်ဖိုးတွေက true/false လို အလုပ်လုပ်လဲ။",
    8,
    [
      ["falsy ၆ ခု", "`false`, `0`, `\"\"` (empty), `null`, `undefined`, `NaN` — ဒါတွေက condition မှာ false လို အလုပ်လုပ်သည်။ ကျန်အားလုံး truthy။"],
      ["အသုံးချ", "`if (name)` က name မှာ တန်ဖိုးရှိမှ run သည်။ `if (arr.length)` က array ဗလာမဟုတ်မှ run သည်။"],
      ["သတိ", "`\"0\"` (string) နဲ့ `[]` (empty array) က truthy — မမျှော်လင့်တဲ့ bug များ ဖြစ်နိုင်လို့ သတိထားပါ။"],
    ],
  ),
  rd(
    "js-type-coercion",
    "Type Coercion",
    "JavaScript က type များကို အလိုအလျောက် ပြောင်းပုံ။",
    9,
    [
      ["== vs ===", "`==` က type ကို ပြောင်းပြီး နှိုင်းသည် (`0 == \"\"` → true)၊ `===` က type ပါ တူမှ true။ အမြဲ `===` သုံးပါ။"],
      ["+ operator", "`\"5\" + 3` က `\"53\"` (string ပေါင်း)၊ ဒါပေမဲ့ `\"5\" - 3` က `2` (ဂဏန်းနုတ်)။ ဒါက coercion ရဲ့ ရှုပ်ထွေးမှု။"],
      ["ရှင်းရှင်း ပြောင်း", "`Number(x)`, `String(x)`, `Boolean(x)` နဲ့ ကိုယ်တိုင် ရှင်းရှင်း ပြောင်းတာက အလိုအလျောက်ပြောင်းစေတာထက် bug နည်းသည်။"],
    ],
  ),
  rd(
    "js-hoisting",
    "Hoisting",
    "var/function declaration တွေ အပေါ်ကို 'တင်' ခြင်း။",
    8,
    [
      ["ဆိုလိုရင်း", "JavaScript က declaration တွေကို scope အပေါ်ဆုံးကို ရွှေ့သလို လုပ်ဆောင်သည်။ function declaration ကို ကြေညာမီ ခေါ်လို့ရသည်။"],
      ["let/const", "`var` က hoisting ဖြစ်ပြီး `undefined` ဖြစ်နေသည်။ `let`/`const` က ကြေညာမီ သုံးရင် error (temporal dead zone) — ဒါက ပိုကောင်းသည်။"],
      ["အကြံ", "`var` ကို ရှောင်ပြီး `let`/`const` သုံးပါ — hoisting ကြောင့်ဖြစ်တဲ့ ရှုပ်ထွေးမှုများ ကင်းစေသည်။"],
    ],
  ),
  rd(
    "js-event-loop",
    "Event Loop",
    "JavaScript ဘယ်လို async ကို ကိုင်တွယ်လဲ။",
    10,
    [
      ["single thread", "JavaScript က တစ်ချိန်တည်း အလုပ်တစ်ခုသာ လုပ်နိုင်သည်။ ဒါပေမဲ့ event loop ကြောင့် စောင့်ဆိုင်းမှုများကို ပိတ်ဆို့မှုမရှိ ကိုင်တွယ်နိုင်သည်။"],
      ["callback queue", "setTimeout, fetch စတဲ့ အလုပ်များ ပြီးရင် callback က queue ထဲဝင်၊ main code ပြီးမှ event loop က တစ်ခုချင်း ထုတ်လုပ်သည်။"],
      ["microtask", "Promise ရဲ့ callback (microtask) က setTimeout (macrotask) ထက် ဦးစားပေး run သည် — async code ရဲ့ အစီအစဉ် နားလည်ဖို့ အရေးကြီး။"],
    ],
  ),
  rd(
    "js-promise-all",
    "Promise.all နဲ့ race",
    "async အလုပ်များစွာကို တစ်ပြိုင်နက် စီမံခြင်း။",
    9,
    [
      ["Promise.all", "`await Promise.all([fetchA(), fetchB()])` က နှစ်ခုစလုံးကို တစ်ပြိုင်နက် စတင်ပြီး နှစ်ခုလုံး ပြီးမှ ဆက်သည် — တစ်ခုပြီးမှတစ်ခုထက် မြန်သည်။"],
      ["race", "`Promise.race([...])` က အမြန်ဆုံး ပြီးတာကို ယူသည် — timeout ထည့်ရာမှာ အသုံးဝင်သည်။"],
      ["error", "Promise.all မှာ တစ်ခု fail ရင် အားလုံး reject ဖြစ်သည်။ တစ်ခုချင်း ရလဒ် လိုရင် `Promise.allSettled` သုံးပါ။"],
    ],
  ),
  rd(
    "js-recursion-js",
    "Recursion",
    "function က ကိုယ့်ကိုယ်ကို ပြန်ခေါ်ခြင်း။",
    9,
    [
      ["သဘော", "ပြဿနာကြီးကို တူညီတဲ့ ပြဿနာငယ်များ ခွဲပြီး function က ကိုယ့်ကိုယ်ကို ပြန်ခေါ်၍ ဖြေရှင်းသည်။ base case (ရပ်မှတ်) မဖြစ်မနေ လိုသည်။"],
      ["ဥပမာ", "folder ထဲက folder ထဲက ဖိုင်များ (nested tree) ကို ဖြတ်ရာမှာ recursion က သဘာဝကျသည်။"],
      ["သတိ", "base case မမှန်ရင် အဆုံးမရှိ ပြန်ခေါ်ပြီး 'stack overflow' error တက်သည်။ loop နဲ့ ရနိုင်ရင် loop က မကြာခဏ ပိုသင့်တော်သည်။"],
    ],
  ),
  rd(
    "js-canvas-basics",
    "Canvas အခြေခံ",
    "JavaScript နဲ့ ပုံ/ဂရပ် ဆွဲခြင်း။",
    10,
    [
      ["canvas", "`<canvas>` element က ပုံဆွဲစရာ နေရာ။ `canvas.getContext(\"2d\")` က ဆွဲဖို့ tool များ ပေးသည်။"],
      ["ဆွဲခြင်း", "`ctx.fillRect(x, y, w, h)` က လေးထောင့်၊ `ctx.arc(...)` က စက်ဝိုင်း ဆွဲသည်။ `ctx.fillStyle = \"green\"` နဲ့ အရောင် သတ်မှတ်သည်။"],
      ["အသုံးဝင်ပုံ", "chart၊ ဂိမ်း၊ animation များအတွက် canvas က အခြေခံ။ sensor data ကို ကိုယ်ပိုင် graph ဆွဲပြနိုင်သည်။"],
    ],
  ),
  rd(
    "js-project-todo",
    "Project — Todo App",
    "သင်ယူထားသမျှ ပေါင်း၍ todo list app ဆောက်ခြင်း။",
    12,
    [
      ["အင်္ဂါရပ်များ", "အလုပ် ထည့်/ဖျက်/ပြီးမှတ်နိုင်ခြင်း — form, DOM create, event, array method, localStorage အားလုံး ပေါင်းသုံးသည်။"],
      ["တည်ဆောက်ပုံ", "state ကို array တစ်ခုမှာ သိမ်း → ပြောင်းတိုင်း render function ခေါ် → localStorage သိမ်း။ ဒါက modern app ရဲ့ အခြေခံ pattern။"],
      ["တိုးချဲ့", "filter (ပြီးပြီ/မပြီး)၊ due date၊ category ထည့်ပြီး ကိုယ်ပိုင် စိုက်ပျိုးရေး အလုပ်စာရင်း app အထိ ဆက်တည်ဆောက်နိုင်သည်။"],
    ],
  ),
  rd(
    "js-clean-code",
    "သန့်ရှင်းသော JavaScript",
    "ဖတ်ရလွယ်၊ ထိန်းသိမ်းရလွယ်တဲ့ code ရေးထုံး။",
    9,
    [
      ["နာမည်ကောင်း", "`d`, `temp` ထက် `harvestDays`, `plantCount` လို ဆိုလိုရင်း ရှင်းတဲ့ နာမည်များ သုံးပါ။ function နာမည်က ကြိယာ (`calculateTotal`) ဖြစ်သင့်သည်။"],
      ["function ငယ်ငယ်", "function တစ်ခုက အလုပ်တစ်ခုသာ လုပ်သင့်သည်။ ကြီးလွန်းရင် ငယ်ငယ် ခွဲပါ — test/ပြန်သုံး လွယ်စေသည်။"],
      ["const ဦးစားပေး", "ပြောင်းစရာမလိုရင် `const` သုံးပါ။ `var` ကို ရှောင်ပါ။ tool (Prettier, ESLint) နဲ့ format/စစ်ဆေးမှု အလိုအလျောက် လုပ်ပါ။"],
    ],
  ),
];
