// JavaScript course — third batch (30 → 60), full quality: every lesson is a
// runnable web playground (kind "code" with an html/css/js starter), has a
// YouTube video hint, and detailed Burmese explanations with code samples in
// each section. Original content for GreenWave. Pure data.

import type { Lesson } from "@/lib/learn/lessons";

const PRE_HTML = '<h2>Console</h2>\n<pre id="out"></pre>';
const PRE_CSS =
  "body{font-family:sans-serif;padding:1.25rem}pre{background:#f4f4f4;padding:1rem;border-radius:8px;white-space:pre-wrap}";
const LOG =
  "const log = (m) => document.getElementById('out').textContent += m + '\\n';\n\n";

/** Build a runnable JS lesson with a console playground. */
function js(
  slug: string,
  title: string,
  summary: string,
  minutes: number,
  youtubeQuery: string,
  playJs: string,
  sections: [heading: string, body: string, code?: string][],
): Lesson {
  return {
    slug,
    title,
    summary,
    minutes,
    kind: "code",
    youtubeQuery,
    sections: sections.map(([heading, body, code]) =>
      code ? { heading, body, code } : { heading, body },
    ),
    code: { html: PRE_HTML, css: PRE_CSS, js: LOG + playJs },
  };
}

export const JS_EXTRA3: Lesson[] = [
  js(
    "js-closures",
    "Closure",
    "function တစ်ခုက ပတ်ဝန်းကျင် variable ကို 'မှတ်' ထားခြင်း။",
    11,
    "javascript closures explained",
    "function makeCounter() {\n  let n = 0;\n  return () => ++n;\n}\nconst next = makeCounter();\nlog(next()); // 1\nlog(next()); // 2\nlog(next()); // 3",
    [
      [
        "closure ဆိုတာ",
        "အတွင်း function တစ်ခုက ၎င်းကို ဝိုင်းရံထားတဲ့ (enclosing) function ရဲ့ variable ကို ပြန်သုံးနိုင်တာကို closure ဟုခေါ်သည်။ ပြင်ပ function ပြီးသွားလည်း ဒီ variable က မပျောက်ဘဲ ကျန်နေသည် — closure က ၎င်းကို 'မှတ်' ထားသည်။",
        "function makeCounter() {\n  let n = 0;              // ဒီ variable ကို\n  return () => ++n;       // အတွင်း function က မှတ်ထား\n}",
      ],
      [
        "private data",
        "closure ထဲက variable ကို ပြင်ပက တိုက်ရိုက် မထိနိုင် — safe ဖြစ်သည်။ ဒါက object-oriented မဟုတ်ဘဲ private state ထားတဲ့ နည်း။ counter, config, cache များ ဖန်တီးရာမှာ အသုံးဝင်သည်။",
        "const c = makeCounter();\nc(); // n ကို ပြင်ပက မမြင်ရ",
      ],
      [
        "အသုံးများပုံ",
        "event handler, setTimeout callback, module pattern အားလုံး closure အပေါ် အခြေခံသည်။ React ရဲ့ hooks (useState) တောင် closure နဲ့ အလုပ်လုပ်သည် — JavaScript ရဲ့ အခြေခံ concept တစ်ခု။",
      ],
    ],
  ),
  js(
    "js-higher-order",
    "Higher-Order Functions",
    "function ကို argument အဖြစ်ပေး/return ပြန်ခြင်း။",
    10,
    "javascript higher order functions",
    "const nums = [1, 2, 3, 4];\nconst doubled = nums.map((x) => x * 2);\nlog(doubled.join(', '));\n\nfunction repeat(n, action) {\n  for (let i = 0; i < n; i++) action(i);\n}\nrepeat(3, (i) => log('row ' + i));",
    [
      [
        "function တွေက value",
        "JavaScript မှာ function က value တစ်ခုလို — variable ထဲ ထည့်လို့၊ argument အဖြစ် ပေးလို့၊ return ပြန်လို့ ရသည်။ function ကို လက်ခံ သို့ ပြန်ပေးတဲ့ function ကို higher-order function ဟုခေါ်သည်။",
        "const shout = (msg) => msg.toUpperCase();\nconst fn = shout;   // function ကို variable ထဲ",
      ],
      [
        "callback",
        "argument အဖြစ် ပေးလိုက်တဲ့ function ကို callback ဟုခေါ်သည်။ `map`, `filter`, `forEach`, `addEventListener` အားလုံး callback လက်ခံသည် — 'ဘာလုပ်မလဲ' ဆိုတာ ကိုယ်တိုင် သတ်မှတ်ပေးရသည်။",
        "nums.forEach((x) => log(x));",
      ],
      [
        "အကျိုး",
        "code ကို ပြန်သုံးလွယ်၊ တိုတောင်း၊ ဖတ်ရလွယ်စေသည်။ loop logic ကို တစ်နေရာမှာ ရေးပြီး 'ဘာလုပ်မလဲ' ကို callback နဲ့ လွယ်လွယ် ပြောင်းနိုင်သည် — functional programming ရဲ့ အနှစ်သာရ။",
      ],
    ],
  ),
  js(
    "js-map-filter-reduce",
    "map, filter, reduce",
    "array data ကို loop မလိုဘဲ ပြောင်း/စစ်/စုချုံ့ခြင်း။",
    12,
    "javascript map filter reduce",
    "const sales = [500, 1200, 800, 2000];\n\nconst withVat = sales.map((x) => x * 1.05);\nlog('VAT: ' + withVat.join(', '));\n\nconst big = sales.filter((x) => x >= 1000);\nlog('>=1000: ' + big.join(', '));\n\nconst total = sales.reduce((sum, x) => sum + x, 0);\nlog('Total: ' + total);",
    [
      [
        "map — ပြောင်းလဲ",
        "`arr.map(fn)` က element တိုင်းကို fn နဲ့ ပြောင်းပြီး တူညီအရေအတွက် array အသစ် ပြန်ပေးသည်။ မူရင်းကို မပြောင်း။ ဈေးနှုန်းတွေကို VAT ပါ တွက်တာ၊ object list ကနေ name တွေချည်း ထုတ်တာမျိုး။",
        "const names = users.map((u) => u.name);",
      ],
      [
        "filter — စစ်ထုတ်",
        "`arr.filter(fn)` က fn က `true` ပြန်တဲ့ element များသာ ယူပြီး array အသစ် ပေးသည်။ stock ကုန်နေတဲ့ ပစ္စည်း ဖယ်တာ၊ ရမှတ်မီသူ ရွေးတာမျိုး။",
        "const inStock = products.filter((p) => p.qty > 0);",
      ],
      [
        "reduce — စုချုံ့",
        "`arr.reduce((acc, x) => ..., start)` က array တစ်ခုလုံးကို တန်ဖိုးတစ်ခုအဖြစ် စုချုံ့သည်။ `acc` က စုဆောင်းတန်ဖိုး၊ `start` က အစ။ စုစုပေါင်း၊ အများဆုံး၊ အုပ်စုဖွဲ့ခြင်း — အားလုံး reduce နဲ့ ရသည်။",
        "const sum = nums.reduce((a, b) => a + b, 0);",
      ],
    ],
  ),
  js(
    "js-array-sort",
    "Array စီစဉ်ခြင်း (sort)",
    "sort နဲ့ compare function — အစဉ်လိုက် စီခြင်း။",
    10,
    "javascript array sort compare function",
    "const nums = [10, 2, 33, 4];\nlog('default: ' + [...nums].sort().join(', '));\nlog('asc: ' + [...nums].sort((a, b) => a - b).join(', '));\nlog('desc: ' + [...nums].sort((a, b) => b - a).join(', '));\n\nconst items = [{n:'b',p:3},{n:'a',p:1}];\nitems.sort((x, y) => x.p - y.p);\nlog(items.map((i) => i.n).join(', '));",
    [
      [
        "default sort ရဲ့ ထောင်ချောက်",
        "`arr.sort()` က default အားဖြင့် element တွေကို **string အဖြစ်** နှိုင်းယှဉ်စီသည် — ဂဏန်းတွေမှာ မှားနိုင်သည် (`10` က `2` ရှေ့ရောက်၊ '10' < '2' ဖြစ်လို့)။",
        "[10, 2, 33].sort()  // [10, 2, 33] -> ['10','2','33']",
      ],
      [
        "compare function",
        "`arr.sort((a, b) => a - b)` က ဂဏန်းများကို ငယ်စဉ်ကြီးလိုက်၊ `(a, b) => b - a` က ကြီးစဉ်ငယ်လိုက် စီသည်။ ရလဒ် အနုတ်ဆို a ရှေ့၊ အပေါင်းဆို b ရှေ့။ object များအတွက် `x.price - y.price` စသဖြင့်။",
        "users.sort((a, b) => a.age - b.age);",
      ],
      [
        "mutate ဖြစ်တာ သတိထား",
        "`sort` က မူရင်း array ကို **တိုက်ရိုက် ပြောင်း** (mutate) သည်။ မူရင်းကို မထိချင်ရင် `[...arr].sort(...)` နဲ့ copy အရင်ယူပါ။",
        "const sorted = [...arr].sort((a,b) => a-b);",
      ],
    ],
  ),
  js(
    "js-immutability",
    "Immutability",
    "data ကို မပြောင်းဘဲ အသစ်ဖန်တီးခြင်း — bug လျော့နည်း။",
    10,
    "javascript immutability spread operator",
    "const user = { name: 'Mai', plants: 3 };\nconst updated = { ...user, plants: 5 };\nlog('old: ' + user.plants);      // 3 (မပြောင်း)\nlog('new: ' + updated.plants);   // 5\n\nconst arr = [1, 2, 3];\nconst added = [...arr, 4];\nlog('added: ' + added.join(', '));",
    [
      [
        "ဘာကြောင့် အရေးကြီး",
        "မူရင်း data ကို တိုက်ရိုက် ပြောင်းရင် အခြားနေရာက အသုံးပြုမှုတွေ မမျှော်လင့်ဘဲ ထိခိုက်ပြီး bug ဖြစ်နိုင်သည်။ အသစ် ဖန်တီးတာ (immutable) က ပိုလုံခြုံ၊ ခြေရာခံရ လွယ်သည်။",
      ],
      [
        "object/array copy",
        "`{ ...user, plants: 5 }` က မူရင်း object ကို မထိဘဲ ပြောင်းထားတဲ့ copy အသစ်၊ `[...arr, item]` က ထည့်၊ `arr.filter((x) => x.id !== id)` က ဖယ်သည် — push/splice လို mutate မလုပ်ဘဲ။",
        "const removed = arr.filter((x) => x !== 2);",
      ],
      [
        "React state",
        "React မှာ state ကို immutable ပြောင်းမှသာ re-render မှန်မှန် ဖြစ်သည်။ ဒါကြောင့် spread operator (`...`) က modern JavaScript မှာ အသုံးအများဆုံး တစ်ခု။",
      ],
    ],
  ),
  js(
    "js-modules",
    "Modules (import / export)",
    "code ကို ဖိုင်များ ခွဲ၍ ပြန်သုံးခြင်း။",
    10,
    "javascript es6 modules import export",
    "// module ကို playground မှာ တိုက်ရိုက် စမ်း၍မရ — pattern ကို ဖတ်ပါ\n// math.js:  export const add = (a, b) => a + b;\n// app.js:   import { add } from './math.js';\n\nconst add = (a, b) => a + b;   // ဒီမှာ inline စမ်း\nlog('add: ' + add(2, 3));",
    [
      [
        "export",
        "ဖိုင်တစ်ခုက function/value ကို `export const add = ...` သို့ `export function area() {...}` နဲ့ အခြားဖိုင် သုံးနိုင်အောင် ဖွင့်ပေးသည်။ ဖိုင်တစ်ခုမှာ `export default` တစ်ခုတည်း ထားနိုင်သည်။",
        "export const PI = 3.14;\nexport default function main() {}",
      ],
      [
        "import",
        "`import { add } from './math.js'` က တခြားဖိုင်ရဲ့ named export ကို ယူသည် (curly bracket ပါ)။ default export အတွက် `import main from './app.js'` (curly မပါ)။ `import * as m from ...` က အားလုံး။",
        "import { add, PI } from './math.js';",
      ],
      [
        "အကျိုး",
        "code ကြီးလာရင် ဖိုင်များ ခွဲထားခြင်းက ရှာရ/ပြင်ရ/ပြန်သုံးရ လွယ်စေသည်။ modern JS project (React, Vue, Node) အားလုံး module သုံးသည်။ HTML မှာ `<script type=\"module\">` နဲ့ ဖွင့်ရသည်။",
      ],
    ],
  ),
  js(
    "js-fetch",
    "fetch — Internet မှ data",
    "API/server ကို ခေါ်ဆို၍ data ယူခြင်း။",
    11,
    "javascript fetch api tutorial",
    "async function load() {\n  try {\n    const r = await fetch('https://jsonplaceholder.typicode.com/todos/1');\n    const data = await r.json();\n    log('title: ' + data.title);\n  } catch (e) {\n    log('error: ' + e.message);\n  }\n}\nload();",
    [
      [
        "fetch()",
        "`fetch(url)` က server ကို HTTP request ပို့ပြီး Promise ပြန်ပေးသည်။ `.then(r => r.json())` နဲ့ JSON response ကို ဖတ်၊ သို့မဟုတ် async/await နဲ့ ပိုသန့်အောင် ရေးနိုင်သည်။",
        "fetch(url).then((r) => r.json()).then((data) => log(data));",
      ],
      [
        "async/await + error",
        "`const r = await fetch(url); const data = await r.json();` က ပိုဖတ်ရလွယ်သည်။ network fail ဖြစ်နိုင်လို့ `try/catch` နဲ့ ပတ်ပါ။ `r.ok` သို့ `r.status` နဲ့ အောင်မြင်မှု စစ်ပါ။",
        "if (!r.ok) throw new Error('HTTP ' + r.status);",
      ],
      [
        "အသုံးချ",
        "ရာသီဥတု API ကို fetch လုပ်ပြီး ယနေ့ အပူချိန်ကို စာမျက်နှာမှာ ပြသတာ၊ POST နဲ့ form data ပို့တာမျိုး လုပ်နိုင်သည် — modern web app အားလုံး fetch နဲ့ server ကို ဆက်သွယ်သည်။",
      ],
    ],
  ),
  js(
    "js-fetch-render",
    "Data ကို စာမျက်နှာမှာ ပြသခြင်း",
    "fetch data ကို DOM မှာ render လုပ်ခြင်း။",
    11,
    "javascript render json data to html",
    "const plants = [{name:'Tomato'},{name:'Chili'},{name:'Mint'}];\nconst html = plants.map((p) => '- ' + p.name).join('\\n');\nlog(html);\n// တကယ့် app မှာ: el.innerHTML = plants.map(...).join('')",
    [
      [
        "data → HTML",
        "fetch ကနေ ရလာတဲ့ array ကို `.map()` နဲ့ HTML string အဖြစ် ပြောင်းပြီး `element.innerHTML = html` နဲ့ စာမျက်နှာမှာ ထည့်သည်။ list, card, table အားလုံး ဒီနည်းနဲ့ render လုပ်သည်။",
        "el.innerHTML = items.map((i) => `<li>${i.name}</li>`).join('');",
      ],
      [
        "template literal",
        "backtick နဲ့ `` `<li>${item.name}</li>` `` က data ကို HTML ထဲ လွယ်လွယ် ထည့်ပေးသည်။ `.join('')` က array ကို string တစ်ခုတည်း ပေါင်းသည် (comma မပါ)။",
      ],
      [
        "XSS ဂရုစိုက်",
        "အသုံးပြုသူ ရိုက်ထည့်တဲ့ data ကို innerHTML မှာ **တိုက်ရိုက် မထည့်ပါနှင့်** — hacker က `<script>` ထည့်ပြီး XSS တိုက်ခိုက်နိုင်သည်။ ရိုးရိုးစာသားအတွက် `textContent` သို့ escape လုပ်ခြင်းက ပိုလုံခြုံသည်။",
      ],
    ],
  ),
  js(
    "js-regex-js",
    "Regular Expressions",
    "စာသား pattern ရှာ/စစ်ဆေးခြင်း။",
    11,
    "javascript regular expressions tutorial",
    "const text = 'ဆက်သွယ်ရန် 09123456789';\nconst phone = text.match(/\\d{7,}/);\nlog('phone: ' + (phone ? phone[0] : 'none'));\n\nconst valid = /^09\\d{9}$/.test('09123456789');\nlog('valid MM phone: ' + valid);",
    [
      [
        "pattern",
        "regex က `/.../ ` ကြားမှာ ရေးသည်။ `\\d` = ဂဏန်း၊ `\\d{7,}` = ၇ လုံးအထက်၊ `^`/`$` = အစ/အဆုံး၊ `\\w` = စာလုံး၊ `+` = တစ်ခု သို့ ပို။ phone, email, password format စစ်ရာမှာ သုံးသည်။",
        "/^09\\d{9}$/   // 09 နဲ့စ, နောက် ၉ လုံး",
      ],
      [
        "test နဲ့ match",
        "`/pattern/.test(str)` က ကိုက်ရင် `true`/`false`။ `str.match(/pattern/)` က ပထမဆုံး တွေ့တာ (မတွေ့ရင် null)၊ `/g` flag ထည့်ရင် အားလုံး။",
        "'a1b2'.match(/\\d/g)  // ['1', '2']",
      ],
      [
        "replace",
        "`str.replace(/\\s+/g, ' ')` က ကွက်လပ်များစွာကို တစ်လုံးအဖြစ် ပြောင်း — form input သန့်စင်ရာမှာ သုံးသည်။ regex က အားကောင်းပေမဲ့ ရှုပ်လွယ်လို့ ရိုးရှင်းတဲ့ အလုပ်တွေအတွက် `includes`, `startsWith` သုံးပါ။",
        "'a   b'.replace(/\\s+/g, ' ')  // 'a b'",
      ],
    ],
  ),
  js(
    "js-localstorage",
    "localStorage",
    "browser ထဲမှာ data သိမ်းခြင်း — refresh လုပ်လည်း ကျန်။",
    10,
    "javascript localstorage tutorial",
    "// playground sandbox မှာ localStorage ကန့်သတ်ချက် ရှိနိုင်\ntry {\n  localStorage.setItem('name', 'Mai');\n  log('saved: ' + localStorage.getItem('name'));\n  const cart = [{id:1},{id:2}];\n  localStorage.setItem('cart', JSON.stringify(cart));\n  log('cart: ' + localStorage.getItem('cart'));\n} catch (e) { log('storage blocked'); }",
    [
      [
        "setItem / getItem",
        "`localStorage.setItem(key, value)` က သိမ်း၊ `localStorage.getItem(key)` က ဖတ်၊ `removeItem(key)` က ဖျက်သည်။ browser ပိတ်လည်း data ကျန်နေသည် — session မဟုတ်ဘဲ ရေရှည်။",
        "localStorage.setItem('theme', 'dark');",
      ],
      [
        "object သိမ်းခြင်း",
        "localStorage က string ပဲ သိမ်းလို့ object/array ကို `JSON.stringify()` နဲ့ string ပြောင်းပြီး သိမ်း၊ `JSON.parse()` နဲ့ ပြန်ဖတ်ရသည်။",
        "localStorage.setItem('cart', JSON.stringify(cart));\nconst cart = JSON.parse(localStorage.getItem('cart'));",
      ],
      [
        "အသုံးချ",
        "dark mode ရွေးချယ်မှု၊ cart ထဲက ပစ္စည်း၊ form draft, 'နောက်တစ်ခါ မပြပါနဲ့' စတဲ့ ဆက်တင်များကို localStorage မှာ သိမ်းထားနိုင်သည်။ gwave ရဲ့ tool များက usePersistentState နဲ့ ဒီနည်း သုံးထားသည်။",
      ],
    ],
  ),
  js(
    "js-sets-maps",
    "Set နဲ့ Map",
    "ထပ်နေမှုမရှိတဲ့ Set၊ key-value Map။",
    10,
    "javascript set and map tutorial",
    "const unique = [...new Set([1, 1, 2, 3, 3])];\nlog('unique: ' + unique.join(', '));\n\nconst m = new Map();\nm.set('tomato', 500);\nm.set('chili', 800);\nlog('tomato price: ' + m.get('tomato'));\nlog('size: ' + m.size);",
    [
      [
        "Set — ထပ်မနေ",
        "`new Set([1,1,2,3])` က ထပ်နေတာတွေ ဖယ်ပြီး `{1,2,3}` ဖြစ်စေသည်။ array ထဲ ထပ်နေမှု ဖယ်ဖို့ `[...new Set(arr)]` က အလွယ်ဆုံးနည်း။ `.has(x)`, `.add(x)`, `.delete(x)` ရှိသည်။",
        "const tags = [...new Set(allTags)];",
      ],
      [
        "Map — ပိုကောင်းတဲ့ dict",
        "Map က object နဲ့ ဆင်ပေမဲ့ key ကို string မဟုတ်တဲ့ အရာ (number, object) လည်း သုံးနိုင်၊ ထည့်တဲ့ အစဉ်လိုက် ကျန်၊ `.size` နဲ့ အရေအတွက် လွယ်လွယ် ရသည်။",
        "m.set(1, 'a'); m.get(1); m.has(1); m.delete(1);",
      ],
      [
        "ဘယ်အခါ သုံး",
        "unique တန်ဖိုးများ စုဖို့ Set၊ ရှုပ်ထွေးတဲ့/မကြာခဏ ပြောင်းတဲ့ key–value data အတွက် Map က object ထက် ပိုသင့်တော်သည်။ JSON သိမ်းဖို့တော့ object က ပိုလွယ်။",
      ],
    ],
  ),
  js(
    "js-generators",
    "Generator Functions",
    "တန်ဖိုးများကို တစ်ခုချင်း တဖြည်းဖြည်း ထုတ်ပေးခြင်း။",
    10,
    "javascript generators tutorial",
    "function* countTo(n) {\n  for (let i = 1; i <= n; i++) yield i;\n}\nfor (const x of countTo(4)) log(x);\n\nconst g = countTo(2);\nlog(JSON.stringify(g.next()));",
    [
      [
        "function*",
        "`function* gen() { yield 1; yield 2; }` — `yield` က တန်ဖိုးတစ်ခု ထုတ်ပြီး function ကို ခဏရပ်ထားသည်။ `.next()` ခေါ်တိုင်း နောက်တစ်ခုကို ဆက်ထုတ်သည်။",
        "function* ids() { let i = 0; while (true) yield i++; }",
      ],
      [
        "lazy — လိုမှ ထုတ်",
        "generator က တန်ဖိုးအားလုံးကို တစ်ပြိုင်နက် မထုတ်ဘဲ တောင်းမှ ထုတ်ပေးလို့ memory သက်သာသည် — အဆုံးမရှိတဲ့ sequence (id generator) တောင် လုပ်နိုင်သည်။",
      ],
      [
        "for...of",
        "`for (const x of gen())` နဲ့ generator ရဲ့ တန်ဖိုးများကို လှည့်ဖတ်နိုင်သည်။ generator က iterator protocol ကို အလိုအလျောက် လိုက်နာသည်။",
      ],
    ],
  ),
  js(
    "js-optional-chaining",
    "Optional Chaining နဲ့ Nullish",
    "?. နဲ့ ?? — null/undefined ကို လုံခြုံစွာ ကိုင်တွယ်ခြင်း။",
    9,
    "javascript optional chaining nullish coalescing",
    "const user = { name: 'Mai', address: null };\nlog('city: ' + (user.address?.city ?? 'မသိ'));\nlog('name: ' + (user.name ?? 'no name'));\nlog('zero: ' + (0 ?? 'default'));   // 0 (|| ဆို 'default')",
    [
      [
        "?. optional chaining",
        "`user?.address?.city` က `user` သို့ `address` က null/undefined ဆိုရင် error မတက်ဘဲ `undefined` ပြန်ပေးသည် — 'Cannot read property of null' crash ကို ကာကွယ်သည်။ function အတွက်လည်း `obj.fn?.()` ရှိသည်။",
        "const city = user?.address?.city;",
      ],
      [
        "?? nullish coalescing",
        "`name ?? 'default'` က name က null/undefined ဆိုမှသာ default ကို သုံးသည်။ `||` နဲ့ မတူတာက `0`, `''`, `false` ကို default **မလုပ်** — အဲဒါတွေက valid value လို့ သဘောထားသည်။",
        "const qty = input ?? 0;   // 0 ကို လက်ခံ",
      ],
      [
        "အသုံးဝင်ပုံ",
        "API response တွေမှာ field ရှိ/မရှိ မသေချာတဲ့အခါ `?.` နဲ့ `??` က code ကို လုံခြုံ၊ တိုတောင်းစေသည် — nested `if` စစ်ဆေးမှုတွေ များစွာ လျှော့ပေးသည်။",
      ],
    ],
  ),
  js(
    "js-getters-setters",
    "Getter နဲ့ Setter",
    "property ဖတ်/ရေးချိန်မှာ logic run ခြင်း။",
    9,
    "javascript getters and setters",
    "class Person {\n  constructor(f, l) { this.first = f; this.last = l; }\n  get fullName() { return this.first + ' ' + this.last; }\n  set fullName(v) { [this.first, this.last] = v.split(' '); }\n}\nconst p = new Person('Mai', 'Aung');\nlog(p.fullName);\np.fullName = 'Su Su';\nlog(p.first);",
    [
      [
        "get",
        "class ထဲမှာ `get fullName() {...}` က method ကို property လို ဖတ်နိုင်စေသည် — `p.fullName` (bracket မပါ)။ တွက်ချက်ထားတဲ့ (computed) တန်ဖိုးများအတွက် သင့်တော်သည်။",
        "get area() { return this.w * this.h; }",
      ],
      [
        "set",
        "`set age(v) { if (v < 0) throw...; this._age = v; }` က တန်ဖိုး သတ်မှတ်ချိန်မှာ validation/တွက်ချက်မှု ထည့်နိုင်သည်။ `p.age = 25` လို ရိုးရိုး assignment လုပ်ရင်း အတွင်းမှာ စစ်ဆေးသည်။",
        "set price(v) { this._price = Math.max(0, v); }",
      ],
      [
        "အကျိုး",
        "ပြင်ပက ရိုးရိုး property လို သုံးရင်း အတွင်းမှာ validation, formatting, computed logic ဝှက်ထားနိုင်သည် — API ကို ရိုးရှင်းအောင် ထားရင်း ထိန်းချုပ်မှု ရသည်။",
      ],
    ],
  ),
  js(
    "js-prototypes",
    "Prototype",
    "JavaScript ရဲ့ inheritance အခြေခံ။",
    10,
    "javascript prototype explained",
    "function Animal(name) { this.name = name; }\nAnimal.prototype.speak = function () { return this.name + ' makes a sound'; };\nconst dog = new Animal('Dog');\nlog(dog.speak());\nlog('has own speak? ' + dog.hasOwnProperty('speak'));",
    [
      [
        "prototype chain",
        "object တိုင်းမှာ 'prototype' link ရှိသည်။ property/method ရှာတဲ့အခါ ကိုယ့်မှာ မတွေ့ရင် prototype ကို ဆက်ရှာ၊ အဲဒီမှာ မတွေ့ရင် ၎င်းရဲ့ prototype... ဒါက prototype chain။",
      ],
      [
        "class က အဖုံး",
        "modern `class` syntax က prototype အပေါ်မှာ တင်ထားတဲ့ လှပတဲ့ အဖုံးသာ (syntactic sugar)။ `class` နဲ့ ရေးရင်လည်း အတွင်းမှာ prototype နဲ့ပဲ အလုပ်လုပ်နေသည် — method တွေက prototype မှာ ရှိသည်။",
        "class Animal { speak() {} }  // speak က prototype မှာ",
      ],
      [
        "ဘာကြောင့် သိသင့်",
        "method များကို instance တိုင်းမှာ ကူးမထားဘဲ prototype တစ်နေရာမှာ သိမ်းလို့ memory သက်သာသည်။ `Array`, `String` ရဲ့ built-in method တွေ ဘယ်ကလာလဲ နားလည်စေသည် — debugging မှာ အသိပညာ ပေးသည်။",
      ],
    ],
  ),
  js(
    "js-event-delegation",
    "Event Delegation",
    "element များစွာအတွက် listener တစ်ခုတည်း သုံးခြင်း။",
    10,
    "javascript event delegation tutorial",
    "// pattern (DOM playground မှာ ခံစားကြည့်)\n// list.addEventListener('click', (e) => {\n//   if (e.target.matches('li')) log('clicked: ' + e.target.textContent);\n// });\nlog('parent တစ်ခုမှာ listener တစ်ခု → child အားလုံး ကိုင်တွယ်');\nlog('e.target နဲ့ ဘယ် child ကို နှိပ်လဲ သိသည်');",
    [
      [
        "ပြဿနာ",
        "list item ၁၀၀ ခုစီမှာ click listener သီးသီးခြားခြား တပ်ရင် memory ကုန်၊ item အသစ် ထည့်တိုင်းလည်း listener ပြန်တပ်ရသည် — မထိရောက်။",
      ],
      [
        "delegation",
        "parent element တစ်ခုမှာပဲ listener တပ်ပြီး `event.target` (နှိပ်လိုက်တဲ့ element) ကို စစ်ဆေးသည်။ event က child ကနေ parent ဆီ 'bubble' တက်လာလို့ parent မှာ ဖမ်းနိုင်သည်။",
        "ul.addEventListener('click', (e) => {\n  if (e.target.matches('.del')) e.target.closest('li').remove();\n});",
      ],
      [
        "အကျိုး",
        "listener တစ်ခုတည်းနဲ့ item ဘယ်နှစ်ခုကိုမဆို ကိုင်တွယ်နိုင်၊ dynamic ဖန်တီးတဲ့ element များအတွက်ပါ အလိုအလျောက် အလုပ်လုပ်၊ performance ကောင်းသည်။",
      ],
    ],
  ),
  js(
    "js-forms",
    "Form ကိုင်တွယ်ခြင်း",
    "input ဖတ်ခြင်း၊ submit ကိုင်တွယ်ခြင်း၊ validation။",
    11,
    "javascript form handling validation",
    "// pattern:\n// form.addEventListener('submit', (e) => {\n//   e.preventDefault();\n//   const name = form.elements.name.value.trim();\n//   if (!name) { log('name လို'); return; }\n//   log('submitted: ' + name);\n// });\nconst value = '  Mai  ';\nlog('trimmed: [' + value.trim() + ']');",
    [
      [
        "submit event",
        "`form.addEventListener('submit', (e) => { e.preventDefault(); ... })` — `preventDefault()` က browser ရဲ့ default 'စာမျက်နှာ reload' လုပ်ဆောင်မှုကို တားသည်။ ဒါမှ JavaScript နဲ့ ကိုယ်တိုင် ကိုင်တွယ်နိုင်။",
        "e.preventDefault();",
      ],
      [
        "value ဖတ်",
        "`input.value` က ရိုက်ထည့်ထားတဲ့ စာသား၊ `checkbox.checked` က အမှန်ခြစ်မှု (true/false)၊ `select.value` က ရွေးထားတာကို ပေးသည်။ `.trim()` က အစ/အဆုံး ကွက်လပ် ဖယ်သည်။",
        "const email = form.elements.email.value;",
      ],
      [
        "validation",
        "submit မလုပ်ခင် လိုအပ်တဲ့ field ပြည့်စုံမှု၊ email/phone format မှန်ကန်မှုကို စစ်ပြီး မပြည့်စုံရင် error message ပြပါ။ browser ရဲ့ `required`, `pattern` နဲ့ ပေါင်းသုံးရင် ပိုကောင်းသည်။",
      ],
    ],
  ),
  js(
    "js-dom-create",
    "DOM element ဖန်တီးခြင်း",
    "createElement, appendChild နဲ့ element အသစ် တည်ဆောက်ခြင်း။",
    10,
    "javascript createelement appendchild",
    "// pattern:\n// const li = document.createElement('li');\n// li.textContent = 'Tomato';\n// ul.appendChild(li);\nconst items = ['Tomato', 'Chili'];\nitems.forEach((t) => log('<li>' + t + '</li>'));",
    [
      [
        "createElement",
        "`document.createElement('li')` က element အသစ် ဖန်တီး၊ `li.textContent = '...'` နဲ့ စာသား ထည့်၊ `li.className = 'item'` နဲ့ class၊ `ul.appendChild(li)` နဲ့ DOM ထဲ ချိတ်သည်။",
        "const btn = document.createElement('button');\nbtn.textContent = 'Save';",
      ],
      [
        "innerHTML vs createElement",
        "innerHTML က မြန်ဆန်လွယ်ကူ (template literal နဲ့)၊ ဒါပေမဲ့ user data အတွက် createElement + textContent က XSS မဖြစ်လို့ ပိုလုံခြုံသည်။ element အနည်းငယ်အတွက် createElement, များများအတွက် innerHTML။",
      ],
      [
        "remove",
        "`element.remove()` က DOM ကနေ ဖယ်ရှား၊ `element.closest('li')` က အနီးဆုံး parent ကို ရှာသည် — list item ဖျက်တဲ့ button တွေအတွက် သုံးသည်။",
        "e.target.closest('.card').remove();",
      ],
    ],
  ),
  js(
    "js-debounce-throttle",
    "Debounce နဲ့ Throttle",
    "မကြာခဏ ဖြစ်တဲ့ event များကို ထိန်းချုပ်ခြင်း။",
    11,
    "javascript debounce throttle explained",
    "function debounce(fn, ms) {\n  let t;\n  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };\n}\nconst search = debounce((q) => log('search: ' + q), 300);\nsearch('a'); search('ab'); search('abc'); // နောက်ဆုံးတစ်ခုသာ run",
    [
      [
        "ပြဿနာ",
        "search box မှာ စာလုံးရိုက်တိုင်း API ခေါ်ရင် ခေါ်ဆိုမှု အလွန်များ (ရိုက်တိုင်း တစ်ခါ) ပြီး server ပင်ပန်း၊ data ကုန်သည်။ scroll/resize event တွေလည်း အလွန်မကြာခဏ ဖြစ်သည်။",
      ],
      [
        "debounce",
        "debounce က event ဆက်တိုက်ဖြစ်နေစဉ် စောင့်ပြီး 'ရပ်သွားမှ' (ဥပမာ 300ms အကြာ) တစ်ကြိမ်တည်း run သည်။ search suggestion, auto-save, form validation အတွက် အကောင်းဆုံး။",
        "input.oninput = debounce(doSearch, 300);",
      ],
      [
        "throttle",
        "throttle က အချိန်တစ်ခုအတွင်း အများဆုံး တစ်ကြိမ်သာ run စေသည် (ဥပမာ 200ms တိုင်း တစ်ခါ)။ scroll position ခြေရာခံ၊ window resize, drag စတဲ့ ဆက်တိုက်ဖြစ်နေတဲ့ event များအတွက် သင့်တော်သည်။",
      ],
    ],
  ),
  js(
    "js-truthy-falsy",
    "Truthy နဲ့ Falsy",
    "ဘယ်တန်ဖိုးတွေက true/false လို အလုပ်လုပ်လဲ။",
    9,
    "javascript truthy and falsy values",
    "const vals = [0, '', null, undefined, NaN, false, 'hi', 1, [], {}];\nvals.forEach((v) => log(JSON.stringify(v) + ' -> ' + Boolean(v)));",
    [
      [
        "falsy ၆ ခု",
        "`false`, `0`, `''` (empty string), `null`, `undefined`, `NaN` — ဒီ ၆ ခုက condition မှာ false လို အလုပ်လုပ်သည်။ ကျန်အားလုံး truthy။",
        "if (name) { ... }  // name မှာ တန်ဖိုးရှိမှ",
      ],
      [
        "အသုံးချ",
        "`if (arr.length)` က array ဗလာမဟုတ်မှ၊ `if (user)` က user ရှိမှ run သည်။ `value || 'default'` က value falsy ဆို default သုံးသည် (ဒါပေမဲ့ 0 ကို default လုပ်တာ သတိထား — `??` က ပိုကောင်း)။",
      ],
      [
        "ထောင်ချောက်",
        "`'0'` (string), `[]` (empty array), `{}` (empty object) က **truthy** — မမျှော်လင့်တဲ့ bug များ ဖြစ်နိုင်လို့ သတိထားပါ။ array ဗလာ/မဗလာ စစ်ချင်ရင် `.length` သုံးပါ။",
        "Boolean([]) // true !",
      ],
    ],
  ),
  js(
    "js-type-coercion",
    "Type Coercion",
    "JavaScript က type များကို အလိုအလျောက် ပြောင်းပုံ။",
    10,
    "javascript type coercion == vs ===",
    "log('5 + 3 = ' + (5 + 3));\nlog(\"'5' + 3 = \" + ('5' + 3));   // '53'\nlog(\"'5' - 3 = \" + ('5' - 3));   // 2\nlog('0 == \"\" -> ' + (0 == ''));  // true !\nlog('0 === \"\" -> ' + (0 === '')); // false",
    [
      [
        "== vs ===",
        "`==` (loose) က type ကို ပြောင်းပြီးမှ နှိုင်းသည် (`0 == ''` → true၊ `'5' == 5` → true)၊ `===` (strict) က type ပါ တူမှ true။ မမျှော်လင့်တဲ့ bug ရှောင်ဖို့ **အမြဲ `===`** သုံးပါ။",
        "0 === '';   // false (မှန်ကန်)",
      ],
      [
        "+ operator",
        "`'5' + 3` က `'53'` (string ပေါင်း — number ကို string ပြောင်း)၊ ဒါပေမဲ့ `'5' - 3` က `2` (`-` က number အတွက်ပဲ ရှိလို့ string ကို number ပြောင်း)။ ဒါက coercion ရဲ့ ရှုပ်ထွေးမှု။",
      ],
      [
        "ရှင်းရှင်း ပြောင်း",
        "`Number(x)`, `String(x)`, `Boolean(x)`, `parseInt(x)` နဲ့ ကိုယ်တိုင် ရှင်းရှင်း ပြောင်းတာက အလိုအလျောက် ပြောင်းစေတာထက် bug နည်း၊ ဖတ်ရလွယ်သည်။",
        "const n = Number(input.value);",
      ],
    ],
  ),
  js(
    "js-hoisting",
    "Hoisting",
    "var/function declaration တွေ အပေါ်ကို 'တင်' ခြင်း။",
    9,
    "javascript hoisting explained",
    "log('call before define: ' + add(2, 3));\nfunction add(a, b) { return a + b; }\n\n// let/const က hoisting ဒီလို မဖြစ် — ကြေညာမီ သုံးရင် error",
    [
      [
        "ဆိုလိုရင်း",
        "JavaScript က declaration တွေကို scope အပေါ်ဆုံးကို 'ရွှေ့' သလို လုပ်ဆောင်သည် (hoisting)။ ဒါကြောင့် `function` declaration ကို ကြေညာမီ ခေါ်လို့ရသည်။",
      ],
      [
        "var ရဲ့ ထောင်ချောက်",
        "`var` က hoisting ဖြစ်ပြီး ကြေညာမီ သုံးရင် error မတက်ဘဲ `undefined` ဖြစ်နေသည် — bug ရှာရ ခက်စေသည်။ `let`/`const` က ကြေညာမီ သုံးရင် error (temporal dead zone) — ဒါက ပိုကောင်းသည်။",
        "console.log(x); var x = 5;  // undefined (error မဟုတ်)",
      ],
      [
        "အကြံ",
        "`var` ကို လုံးဝ ရှောင်ပြီး `const` (default) နဲ့ `let` (ပြောင်းစရာလိုမှ) သုံးပါ — hoisting ကြောင့်ဖြစ်တဲ့ ရှုပ်ထွေးမှုများ ကင်းစေသည်။",
      ],
    ],
  ),
  js(
    "js-event-loop",
    "Event Loop",
    "JavaScript ဘယ်လို async ကို ကိုင်တွယ်လဲ။",
    11,
    "javascript event loop explained",
    "log('1 start');\nsetTimeout(() => log('4 timeout'), 0);\nPromise.resolve().then(() => log('3 promise'));\nlog('2 end');\n// output: 1, 2, 3, 4",
    [
      [
        "single thread",
        "JavaScript က တစ်ချိန်တည်း code တစ်ကြောင်းသာ run နိုင်သည် (single thread)။ ဒါပေမဲ့ event loop ကြောင့် setTimeout, fetch လို စောင့်ဆိုင်းမှုများကို ပိတ်ဆို့မှုမရှိဘဲ ကိုင်တွယ်နိုင်သည်။",
      ],
      [
        "task queue",
        "setTimeout, fetch, event စတဲ့ အလုပ်များ ပြီးရင် ၎င်းတို့ရဲ့ callback က queue ထဲဝင်သည်။ main code (call stack) ကုန်မှ event loop က queue ကနေ တစ်ခုချင်း ဆွဲ run သည်။",
      ],
      [
        "microtask ဦးစားပေး",
        "Promise ရဲ့ `.then` (microtask) က setTimeout (macrotask) ထက် **ဦးစားပေး** run သည်။ ဒါကြောင့် အထက်က ဥပမာမှာ 'promise' က 'timeout' ရှေ့ ထွက်သည် — async code ရဲ့ အစီအစဉ် နားလည်ဖို့ အရေးကြီး။",
      ],
    ],
  ),
  js(
    "js-promise-all",
    "Promise.all နဲ့ race",
    "async အလုပ်များစွာကို တစ်ပြိုင်နက် စီမံခြင်း။",
    10,
    "javascript promise all race allsettled",
    "const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));\nasync function run() {\n  const results = await Promise.all([wait(10,'a'), wait(20,'b')]);\n  log('all: ' + results.join(', '));\n  const first = await Promise.race([wait(30,'slow'), wait(5,'fast')]);\n  log('race: ' + first);\n}\nrun();",
    [
      [
        "Promise.all",
        "`await Promise.all([p1, p2])` က promise များအားလုံးကို တစ်ပြိုင်နက် စတင်ပြီး **အားလုံး ပြီးမှ** ရလဒ် array ကို ပြန်ပေးသည် — တစ်ခုပြီးမှတစ်ခု `await` လုပ်တာထက် များစွာ မြန်သည်။",
        "const [user, posts] = await Promise.all([getUser(), getPosts()]);",
      ],
      [
        "race",
        "`Promise.race([...])` က အမြန်ဆုံး ပြီး (settle) တာကို ယူသည် — timeout ထည့်ရာမှာ (data vs 5s timer) အသုံးဝင်သည်။",
      ],
      [
        "error ကိုင်တွယ်",
        "Promise.all မှာ တစ်ခု fail ရင် တစ်ခုလုံး reject ဖြစ်သည်။ တစ်ခုချင်းရဲ့ ရလဒ် (အောင်/ရှုံး) အားလုံး လိုချင်ရင် `Promise.allSettled` သုံးပါ — ၎င်းက ဘယ်ဟာမှ မ reject ဘဲ status အားလုံး ပြန်ပေးသည်။",
      ],
    ],
  ),
  js(
    "js-recursion-js",
    "Recursion",
    "function က ကိုယ့်ကိုယ်ကို ပြန်ခေါ်ခြင်း။",
    10,
    "javascript recursion tutorial",
    "function factorial(n) {\n  if (n <= 1) return 1;      // base case\n  return n * factorial(n - 1);\n}\nlog('5! = ' + factorial(5));\n\nfunction sum(arr) {\n  return arr.length ? arr[0] + sum(arr.slice(1)) : 0;\n}\nlog('sum = ' + sum([1, 2, 3, 4]));",
    [
      [
        "သဘော",
        "ပြဿနာကြီးကို တူညီတဲ့ ပြဿနာငယ်များ ခွဲပြီး function က ကိုယ့်ကိုယ်ကို ပြန်ခေါ်၍ ဖြေရှင်းသည်။ **base case** (ရပ်မှတ်) မဖြစ်မနေ လိုသည် — မဟုတ်ရင် အဆုံးမရှိ ပြန်ခေါ်မည်။",
        "if (n <= 1) return 1;  // base case",
      ],
      [
        "ဘယ်အခါ သဘာဝကျ",
        "folder ထဲက folder ထဲက ဖိုင်များ (nested tree)၊ comment ရဲ့ reply ရဲ့ reply, menu structure စတဲ့ 'ကိုယ့်ထဲကိုယ်' ဖွဲ့စည်းပုံများ ဖြတ်ရာမှာ recursion က သဘာဝကျသည်။",
      ],
      [
        "သတိ",
        "base case မမှန်ရင် အဆုံးမရှိ ပြန်ခေါ်ပြီး 'Maximum call stack exceeded' error တက်သည်။ ရိုးရိုး loop နဲ့ ရနိုင်ရင် loop က မကြာခဏ ပိုမြန်၊ ပိုလုံခြုံသည်။",
      ],
    ],
  ),
  js(
    "js-canvas-basics",
    "Canvas အခြေခံ",
    "JavaScript နဲ့ ပုံ/ဂရပ် ဆွဲခြင်း။",
    11,
    "javascript canvas tutorial for beginners",
    "// canvas playground:\n// const ctx = canvas.getContext('2d');\n// ctx.fillStyle = 'green';\n// ctx.fillRect(10, 10, 100, 50);\n// ctx.beginPath(); ctx.arc(80, 80, 30, 0, Math.PI*2); ctx.fill();\nlog('ctx.fillRect(x, y, w, h) — လေးထောင့်');\nlog('ctx.arc(x, y, r, 0, Math.PI*2) — စက်ဝိုင်း');",
    [
      [
        "canvas + context",
        "`<canvas>` element က ပုံဆွဲစရာ နေရာ။ `canvas.getContext('2d')` က ဆွဲဖို့ tool အစုံ (context) ပေးသည်။ ဒါက pixel-based — ဆွဲပြီးတာ 'ပုံ' ဖြစ်သွားသည်။",
        "const ctx = canvas.getContext('2d');",
      ],
      [
        "ပုံ ဆွဲခြင်း",
        "`ctx.fillRect(x, y, w, h)` က ဖြည့်ထားတဲ့ လေးထောင့်၊ `ctx.arc(...)` က စက်ဝိုင်း၊ `ctx.fillText('hi', x, y)` က စာသား ဆွဲသည်။ `ctx.fillStyle = 'green'` နဲ့ အရောင်၊ `ctx.lineWidth` နဲ့ မျဉ်းအထူ သတ်မှတ်သည်။",
        "ctx.fillStyle = '#22c55e';\nctx.fillRect(0, 0, 50, 50);",
      ],
      [
        "အသုံးဝင်ပုံ",
        "chart, ဂိမ်း, animation, ပုံ edit များအတွက် canvas က အခြေခံ။ sensor data ကို ကိုယ်ပိုင် graph ဆွဲပြ၊ ဂိမ်း ဆောက်နိုင်သည်။ `requestAnimationFrame` နဲ့ animation လုပ်သည်။",
      ],
    ],
  ),
  js(
    "js-project-todo",
    "Project — Todo App",
    "သင်ယူထားသမျှ ပေါင်း၍ todo list app ဆောက်ခြင်း။",
    13,
    "javascript todo app tutorial vanilla",
    "let todos = [];\nfunction add(text) { todos = [...todos, { id: Date.now(), text, done: false }]; }\nfunction toggle(id) { todos = todos.map((t) => t.id===id ? {...t, done:!t.done} : t); }\nadd('Water plants'); add('Check soil');\ntoggle(todos[0].id);\ntodos.forEach((t) => log((t.done?'[x] ':'[ ] ') + t.text));",
    [
      [
        "အင်္ဂါရပ်များ",
        "အလုပ် ထည့်/ဖျက်/ပြီးမှတ်နိုင်ခြင်း — form (input), DOM create, event (delegation), array method (map/filter), immutability, localStorage အားလုံးကို ပေါင်းသုံးသည်။ ဒါက အခြေခံ app တစ်ခုရဲ့ ပုံစံ။",
      ],
      [
        "state → render pattern",
        "state ကို array တစ်ခုမှာ သိမ်း → ပြောင်းတိုင်း `render()` function ခေါ် → localStorage သိမ်း။ ဒါက React အပါအဝင် modern framework အားလုံးရဲ့ အခြေခံ mental model — 'UI က state ရဲ့ function'။",
        "function render() {\n  ul.innerHTML = todos.map((t) => `<li>${t.text}</li>`).join('');\n}",
      ],
      [
        "တိုးချဲ့ရန်",
        "filter (ပြီးပြီ/မပြီး), due date, category, drag-to-reorder ထည့်ပြီး ကိုယ်ပိုင် စိုက်ပျိုးရေး အလုပ်စာရင်း app အထိ ဆက်တည်ဆောက်နိုင်သည်။ ဒါဆိုရင် gwave မှာ share-as-post တောင် လုပ်နိုင်ပြီ။",
      ],
    ],
  ),
  js(
    "js-clean-code",
    "သန့်ရှင်းသော JavaScript",
    "ဖတ်ရလွယ်၊ ထိန်းသိမ်းရလွယ်တဲ့ code ရေးထုံး။",
    9,
    "javascript clean code best practices",
    "// ❌ မကောင်း\nconst d = (a) => a*0.05+a;\n// ✅ ကောင်း\nconst TAX = 0.05;\nconst withTax = (price) => price + price * TAX;\nlog('with tax: ' + withTax(1000));",
    [
      [
        "နာမည်ကောင်း",
        "`d`, `temp`, `x` ထက် `harvestDays`, `plantCount`, `totalPrice` လို ဆိုလိုရင်း ရှင်းတဲ့ နာမည်များ သုံးပါ။ function နာမည်က ကြိယာ (`calculateTotal`, `getUser`) ဖြစ်သင့်သည်။",
      ],
      [
        "function ငယ်ငယ်",
        "function တစ်ခုက အလုပ်တစ်ခုသာ လုပ်သင့်သည် (single responsibility)။ ကြီးလွန်း/အလုပ်များ လုပ်နေရင် ငယ်ငယ် ခွဲပါ — test လုပ်ရ, ပြန်သုံးရ, ဖတ်ရ လွယ်စေသည်။",
      ],
      [
        "const ဦးစားပေး",
        "ပြောင်းစရာမလိုရင် `const` သုံးပါ (default)၊ ပြောင်းမှ `let`၊ `var` ကို ရှောင်ပါ။ `===` သုံးပါ။ Prettier (format) နဲ့ ESLint (စစ်ဆေး) tool တွေက အလိုအလျောက် သပ်ရပ်စေ၊ အမှား ထောက်ပြသည်။",
      ],
    ],
  ),
];
