// Advanced JavaScript — a runnable language track for /learn. Each lesson opens
// in the HTML/CSS/JS playground with a small demo that prints its output to the
// page, so learners see closures, `this`, prototypes, promises, async/await,
// generators and modules actually run. Burmese-primary teaching with an SVG
// diagram on the first section and a per-lesson YouTube query (audio read-aloud
// is global). Pure data.

import type { Track } from "@/lib/learn/lessons";

const IMG = "/learn/advjs";

// A demo skeleton: `print(...)` appends a line to the output box.
function demo(js: string): { html: string; css: string; js: string } {
  return {
    html: '<pre id="out"></pre>',
    css: "body{margin:0;background:#0f172a;color:#e2e8f0;font:13px/1.6 monospace;padding:14px}\n#out{white-space:pre-wrap;margin:0}",
    js:
      "const out = document.getElementById('out');\nconst print = (...a) => out.textContent += a.map(x => typeof x==='object'?JSON.stringify(x):x).join(' ') + '\\n';\n\n" +
      js,
  };
}

export const advancedJsTrack: Track = {
  slug: "advanced-js",
  title: "Advanced JavaScript",
  description:
    "Closure, this, prototype, Promise, async/await, generator, module — JavaScript ရဲ့ အတွင်းကျ သဘောတရားတွေ လက်တွေ့ run ပြီး ကျွမ်းကျင်အောင်။",
  icon: "Braces",
  bands: ["teen", "adult"],
  lessons: [
    {
      slug: "advjs-intro",
      title: "Advanced JS — Overview",
      summary: "ဒီသင်ရိုးမှာ JavaScript ရဲ့ အတွင်းကျ concept တွေ လက်တွေ့ run ရမယ်။",
      minutes: 5,
      kind: "code",
      youtubeQuery: "advanced javascript concepts explained",
      sections: [
        {
          heading: "'ဘာလို့' ကို နားလည်ကြမယ်",
          body: "အခြေခံ JavaScript တတ်ပြီးရင် — ကုဒ်က 'ဘာလို့ ဒီလိုဖြစ်လဲ' ဆိုတာ နားလည်ဖို့ လိုတယ်။ ဒီသင်ရိုးက closure, scope, `this`, prototype, Promise, async/await, event loop, generator, module စတဲ့ အတွင်းကျ concept တွေကို — သီအိုရီ တစ်ခုတည်း မဟုတ်ဘဲ playground မှာ run ပြီး output ကြည့်ရင်း သင်ပေးမှာပါ။ interview မေးခွန်း အများစုလည်း ဒီ topic တွေထဲကပါ။ ညာဘက် Run နှိပ်ကြည့်ပါ။",
          image: {
            src: `${IMG}/closure.svg`,
            alt: "A closure capturing an outer variable",
            caption: "Closure — advanced JS ရဲ့ အခြေခံ အုတ်မြစ်",
          },
        },
      ],
      code: demo(
        "print('JavaScript engine က single-thread ဖြစ်ပေမယ့်');\nprint('event loop နဲ့ async အလုပ်တွေ တစ်ပြိုင်နက် ကိုင်တွယ်နိုင်တယ်။');\nprint('');\nprint('ဒီသင်ရိုးမှာ — ' + ['closure','this','prototype','Promise','async','generator','module'].join(', '));",
      ),
    },
    {
      slug: "closures",
      title: "Closures",
      summary: "function က သူ့ဖန်တီးရာ scope ရဲ့ variable တွေ ဆက်ကိုင်ထားခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript closures explained",
      sections: [
        {
          heading: "အတွင်း function က မှတ်ထား",
          body: "Closure ဆိုတာ — function တစ်ခုက သူ့ကို ဖန်တီးပေးခဲ့တဲ့ scope ရဲ့ variable တွေကို၊ အဲ့ scope ပြီးဆုံးသွားပြီးတဲ့ နောက်မှာတောင် ဆက်ကိုင်ဆွဲထားနိုင်တာပါ။ ဒါက counter၊ private data ဖုံးကွယ်ခြင်း၊ callback တွေမှာ အသုံးများတယ်။ အောက်က `makeCounter()` ပြီးသွားပေမယ့် — return လုပ်လိုက်တဲ့ function က `count` ကို မှတ်ထားဆဲ ဖြစ်လို့ ဂဏန်း တိုးသွားတာ တွေ့ရမယ်။",
          image: {
            src: `${IMG}/closure.svg`,
            alt: "Inner function remembering the outer count variable",
            caption: "outer ပြီးလည်း inner က count ကို မှတ်ထား 🔒",
          },
        },
      ],
      code: demo(
        "function makeCounter() {\n  let count = 0;            // private\n  return () => ++count;    // closure\n}\nconst next = makeCounter();\nprint(next()); // 1\nprint(next()); // 2\nprint(next()); // 3\n\nconst other = makeCounter(); // count သီးသန့်\nprint(other()); // 1 — မရော",
      ),
    },
    {
      slug: "scope-hoisting",
      title: "Scope & Hoisting",
      summary: "let/const/var ကွာခြားချက်၊ scope chain နှင့် hoisting။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript hoisting let const var scope",
      sections: [
        {
          heading: "ဗားရီ ဘယ်မှာ ရှင်သန်လဲ",
          body: "`var` က function-scoped ပြီး hoist (အပေါ်တင်) ဖြစ်လို့ ကြေညာမီ သုံးရင် `undefined` ရတယ်။ `let`/`const` က block-scoped ({} အတွင်း) ဖြစ်ပြီး ကြေညာမီ သုံးရင် error (temporal dead zone) တက်တယ်။ Scope chain က — အတွင်းမှာ မတွေ့ရင် အပြင် (parent) ဆီ တစ်ဆင့်ချင်း ရှာတက်တာပါ။ ခေတ်သစ် code မှာ `var` ရှောင်ပြီး `const` (မပြောင်းတာ) / `let` (ပြောင်းတာ) သုံးပါ။",
          image: {
            src: `${IMG}/scope-chain.svg`,
            alt: "Scope chain looking outward for a variable",
            caption: "အတွင်းမရှိ → parent scope ဆီ ရှာတက်",
          },
        },
      ],
      code: demo(
        "print(typeof a); // undefined — var hoisted\nvar a = 1;\n\nfunction outer() {\n  const o = 'outer';\n  function inner() { return o; } // scope chain\n  return inner();\n}\nprint(outer()); // 'outer'\n\ntry { print(b); let b = 2; }\ncatch (e) { print('TDZ: ' + e.name); } // ReferenceError",
      ),
    },
    {
      slug: "this-binding",
      title: "The `this` Keyword",
      summary: "`this` က function ကို ဘယ်လို ခေါ်လဲအပေါ် မူတည်ခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript this keyword explained",
      sections: [
        {
          heading: "ခေါ်ပုံက this ကို ဆုံးဖြတ်",
          body: "`this` ရဲ့ တန်ဖိုးက function ကို **ဘယ်လို ခေါ်လဲ** အပေါ် မူတည်တယ် — ဘယ်မှာ ရေးလဲ မဟုတ်ဘူး။ `obj.method()` ဆို this=obj။ သီးသန့် ခေါ်ရင် this=undefined (strict) သို့ window။ **arrow function** ကတော့ ကိုယ်ပိုင် this မရှိဘဲ — ဖန်တီးရာ scope ရဲ့ this ကို ယူတယ်၊ ဒါကြောင့် callback တွေမှာ အသုံးဝင်တယ်။",
          image: {
            src: `${IMG}/this-binding.svg`,
            alt: "this depends on how the function is called",
            caption: "method · call/apply · bind · arrow",
          },
        },
      ],
      code: demo(
        "const user = {\n  name: 'Mya',\n  hi() { return 'Hi ' + this.name; },\n  hiLater() { setTimeout(() => print(this.name), 0); } // arrow → this=user\n};\nprint(user.hi());          // Hi Mya\nconst f = user.hi;\ntry { print(f()); } catch { print('this lost!'); } // this=undefined\nuser.hiLater();            // Mya (arrow keeps this)",
      ),
    },
    {
      slug: "call-apply-bind",
      title: "call, apply & bind",
      summary: "`this` ကို ကိုယ်တိုင် သတ်မှတ်ခြင်း။",
      minutes: 8,
      kind: "code",
      youtubeQuery: "javascript call apply bind difference",
      sections: [
        {
          heading: "this ကို ကိုယ်တိုင် ချိတ်",
          body: "`call(thisArg, a, b)` — this သတ်မှတ်ပြီး ချက်ချင်း ခေါ်၊ argument တစ်ခုချင်း။ `apply(thisArg, [a,b])` — အတူတူ ဒါပေမယ့် argument array။ `bind(thisArg)` — this ချိတ်ထားတဲ့ function **အသစ်** ပြန်ပေး (ချက်ချင်း မခေါ်)၊ နောက်မှ ခေါ်လို့ရ။ callback/event handler တွေမှာ this မပျောက်အောင် bind သုံးလေ့ ရှိတယ်။",
          image: {
            src: `${IMG}/this-binding.svg`,
            alt: "call, apply and bind set this explicitly",
            caption: "call/apply = ချက်ချင်း · bind = function အသစ်",
          },
        },
      ],
      code: demo(
        "function intro(greet) { return greet + ', ' + this.name; }\nconst a = { name: 'Aung' }, b = { name: 'Su' };\nprint(intro.call(a, 'Hello'));      // Hello, Aung\nprint(intro.apply(b, ['မင်္ဂလာ'])); // မင်္ဂလာ, Su\nconst forA = intro.bind(a);\nprint(forA('Hi'));                  // Hi, Aung (this=a အမြဲ)",
      ),
    },
    {
      slug: "prototypes",
      title: "Prototypes & Inheritance",
      summary: "Prototype chain — JS ရဲ့ inheritance အခြေခံ။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript prototype chain inheritance",
      sections: [
        {
          heading: "မတွေ့ရင် prototype ဆီ တက်ရှာ",
          body: "JavaScript object တိုင်းမှာ `__proto__` (prototype) link ရှိတယ်။ property/method တစ်ခုကို object ပေါ်မှာ မတွေ့ရင် — သူ့ prototype ဆီ၊ အဲ့ဒါမှာ မတွေ့ရင် အဲ့ဒါ့ prototype ဆီ — `null` ရောက်တဲ့အထိ တက်ရှာတယ်။ ဒါ prototype chain ပါ။ `class` နဲ့ `extends` က ဒီ chain ကိုပဲ လှလှ ရေးတဲ့ syntax (sugar) ဖြစ်တယ်။",
          image: {
            src: `${IMG}/prototype-chain.svg`,
            alt: "Object to prototype to Object.prototype chain",
            caption: "obj → proto → Object.proto → null",
          },
        },
      ],
      code: demo(
        "const animal = { speak() { return this.name + ' makes a sound'; } };\nconst dog = Object.create(animal); // proto = animal\ndog.name = 'Rex';\nprint(dog.speak());                // Rex makes a sound (proto ကနေ)\nprint(dog.hasOwnProperty('speak'));// false — dog ကိုယ်ပိုင် မဟုတ်\nprint(Object.getPrototypeOf(dog) === animal); // true",
      ),
    },
    {
      slug: "es6-classes",
      title: "ES6 Classes",
      summary: "class, constructor, extends, super နှင့် static။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript es6 classes extends super",
      sections: [
        {
          heading: "prototype ကို လှလှ ရေး",
          body: "`class` က prototype-based inheritance ကို ဖတ်ရလွယ်တဲ့ syntax ပေးတယ်။ `constructor` က object အသစ် ဆောက်တိုင်း run တယ်၊ `extends` နဲ့ တစ်ခြား class ဆီက အမွေဆက်ခံ၊ `super()` နဲ့ parent constructor ခေါ်၊ `static` method က instance မလိုဘဲ class ကနေ တိုက်ရိုက် ခေါ်လို့ရတယ်။ အတွင်းမှာ prototype chain ပဲ ဆက်အလုပ်လုပ်နေတာ မှတ်ထားပါ။",
          image: {
            src: `${IMG}/prototype-chain.svg`,
            alt: "Classes are sugar over the prototype chain",
            caption: "class/extends = prototype chain ရဲ့ sugar",
          },
        },
      ],
      code: demo(
        "class Animal {\n  constructor(name) { this.name = name; }\n  speak() { return this.name + ' makes a sound'; }\n}\nclass Dog extends Animal {\n  speak() { return super.speak() + ' (woof)'; }\n  static create(n) { return new Dog(n); }\n}\nconst d = Dog.create('Rex');\nprint(d.speak());           // Rex makes a sound (woof)\nprint(d instanceof Animal); // true",
      ),
    },
    {
      slug: "higher-order",
      title: "Higher-Order Functions",
      summary: "map, filter, reduce — function ကို data အဖြစ် သုံးခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript map filter reduce explained",
      sections: [
        {
          heading: "function ကို argument အဖြစ်ပေး",
          body: "Higher-order function ဆိုတာ — function ကို argument အဖြစ် လက်ခံတာ သို့ function ကို return ပြန်ပေးတာ။ `map` က array element တိုင်းကို ပြောင်း၊ `filter` က condition ကိုက်တာ ရွေး၊ `reduce` က array တစ်ခုလုံးကို တန်ဖိုးတစ်ခုတည်း စုစည်းတယ်။ loop ရေးစရာမလိုဘဲ — ရည်ရွယ်ချက် ရှင်းရှင်း (declarative) ဖော်ပြနိုင်တယ်။",
          image: {
            src: `${IMG}/hof.svg`,
            alt: "map, filter and reduce transforming an array",
            caption: "map ပြောင်း · filter ရွေး · reduce စု",
          },
        },
      ],
      code: demo(
        "const nums = [1, 2, 3, 4, 5, 6];\nconst doubled = nums.map(x => x * 2);\nprint('map:', doubled);\nconst even = nums.filter(x => x % 2 === 0);\nprint('filter:', even);\nconst sum = nums.reduce((acc, x) => acc + x, 0);\nprint('reduce:', sum);\n// chain\nprint('chain:', nums.filter(x => x > 2).map(x => x * 10));",
      ),
    },
    {
      slug: "destructuring-spread",
      title: "Destructuring & Spread",
      summary: "array/object ဖြည်ခြင်း၊ spread/rest (...) operator။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "javascript destructuring spread rest operator",
      sections: [
        {
          heading: "လိုတာ ဆွဲထုတ် · ဖြန့်/စု",
          body: "Destructuring က array/object ထဲက တန်ဖိုးတွေကို variable ထဲ တစ်ခါတည်း ဆွဲထုတ်တာပါ။ Spread (`...`) က array/object ကို ဖြန့်ချ (copy, merge, argument အဖြစ်ဖြန့်)၊ Rest (`...`) က ကျန်တာတွေ စုစည်း (function parameter, array ကျန်)။ ခေတ်သစ် code မှာ အသုံးအများဆုံး syntax တစ်ခုပါ — immutable update တွေမှာလည်း အရေးကြီးတယ်။",
          image: {
            src: `${IMG}/hof.svg`,
            alt: "Destructuring and spread on arrays and objects",
            caption: "[a,b]=arr · {x}=obj · [...a,...b]",
          },
        },
      ],
      code: demo(
        "const [first, ...rest] = [10, 20, 30, 40];\nprint('first:', first, 'rest:', rest);\nconst user = { name: 'Mya', age: 20, city: 'YGN' };\nconst { name, ...info } = user;\nprint('name:', name, 'info:', info);\nconst merged = { ...user, age: 21 }; // immutable update\nprint('merged:', merged);\nconst max = Math.max(...[3, 9, 2]); // spread as args\nprint('max:', max);",
      ),
    },
    {
      slug: "promises",
      title: "Promises",
      summary: "async ရလဒ်ကို ကိုယ်စားပြုခြင်း — then/catch/finally။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript promises then catch explained",
      sections: [
        {
          heading: "အနာဂတ် တန်ဖိုး",
          body: "Promise က — အခုချက်ချင်း မရသေးဘဲ အနာဂတ်မှာ ရလာမယ့် (သို့ ကျရှုံးမယ့်) တန်ဖိုးကို ကိုယ်စားပြုတဲ့ object ပါ။ အခြေအနေ ၃ ခု — pending (စောင့်ဆဲ), fulfilled (အောင်မြင် → `.then`), rejected (ကျရှုံး → `.catch`)။ callback တွေ အထပ်ထပ် (callback hell) ရှောင်ဖို့ — promise တွေကို `.then` နဲ့ ဆက်တွဲ (chain) လို့ရတယ်။",
          image: {
            src: `${IMG}/promise-states.svg`,
            alt: "Promise states: pending, fulfilled, rejected",
            caption: "pending → fulfilled(.then) / rejected(.catch)",
          },
        },
      ],
      code: demo(
        "function wait(ms, val) {\n  return new Promise(res => setTimeout(() => res(val), ms));\n}\nprint('start');\nwait(300, '🍅')\n  .then(v => { print('got:', v); return wait(200, '🌶'); })\n  .then(v => print('then:', v))\n  .catch(e => print('error:', e))\n  .finally(() => print('done'));\nprint('(sync code runs first)');",
      ),
    },
    {
      slug: "async-await",
      title: "async / await",
      summary: "Promise ကို sync လို ဖတ်ရလွယ်အောင် ရေးခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript async await tutorial",
      sections: [
        {
          heading: "await = ရလဒ် ရတဲ့အထိ ရပ်",
          body: "`async` function ထဲမှာ `await` က promise ရဲ့ ရလဒ် ရလာတဲ့အထိ — thread မ block ဘဲ — အဲ့ function ကို ခဏရပ်ထားပေးတယ်။ ဒါက `.then` chain ကို sync code လို ရိုးရိုးရှင်းရှင်း ရေးစေတယ်၊ ဖတ်ရ အများကြီး လွယ်တယ်။ error ကို `try/catch` နဲ့ ဖမ်း။ `await Promise.all([...])` နဲ့ တစ်ပြိုင်နက် စောင့်နိုင်တယ်။",
          image: {
            src: `${IMG}/async-await.svg`,
            alt: "await pausing until the promise resolves",
            caption: "await — promise ရလဒ် ရတဲ့အထိ ခဏရပ်",
          },
        },
      ],
      code: demo(
        "const wait = (ms, v) => new Promise(r => setTimeout(() => r(v), ms));\nasync function load() {\n  try {\n    print('loading...');\n    const a = await wait(300, '🍅');\n    const b = await wait(200, '🌶');\n    print('got:', a, b);\n    const both = await Promise.all([wait(100,'A'), wait(100,'B')]);\n    print('parallel:', both);\n  } catch (e) { print('err:', e); }\n}\nload();",
      ),
    },
    {
      slug: "event-loop",
      title: "The Event Loop",
      summary: "single-thread ဖြစ်လျက် async ဘယ်လို အလုပ်လုပ်လဲ။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "javascript event loop explained microtask",
      sections: [
        {
          heading: "stack · queue · microtask",
          body: "JavaScript က thread တစ်ခုတည်း ရှိတယ်။ sync code တွေ call stack ပေါ် တန်းစီ run တယ်။ setTimeout လို async callback တွေ ကြာမှ callback queue ထဲ ဝင်တယ်။ Promise ရဲ့ `.then` က **microtask queue** ထဲ ဝင်ပြီး — callback queue ထက် **ဦးစားပေး** run တယ်။ Event loop က — stack ဗလာဖြစ်တိုင်း microtask အားလုံး အရင်ရှင်း၊ ပြီးမှ callback တစ်ခု ယူတင်တယ်။",
          image: {
            src: `${IMG}/event-loop.svg`,
            alt: "Call stack, queue and the event loop",
            caption: "stack ဗလာ → microtask → callback တစ်ခု",
          },
        },
      ],
      code: demo(
        "print('1 — sync');\nsetTimeout(() => print('4 — timeout (macrotask)'), 0);\nPromise.resolve().then(() => print('3 — promise (microtask)'));\nprint('2 — sync');\n// order: 1, 2, 3, 4 — microtask beats timeout",
      ),
    },
    {
      slug: "generators",
      title: "Generators & Iterators",
      summary: "function* နှင့် yield — ရပ်/ဆက်နိုင်သော function။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "javascript generators yield iterators",
      sections: [
        {
          heading: "yield နဲ့ ကြားမှာ ရပ်",
          body: "`function*` (generator) က — ပုံမှန် function လို တစ်ခါတည်း အကုန် run မဟုတ်ဘဲ — `yield` တိုင်းမှာ ခဏရပ်ပြီး တန်ဖိုး ပြန်ပေးတယ်။ `.next()` ခေါ်မှ နောက်တစ်ဆင့် ဆက် run တယ်။ ဒါက infinite sequence, lazy evaluation, custom iterator တွေ ဖန်တီးဖို့ အသုံးဝင်တယ်။ `for...of` နဲ့ လှည့်လို့လည်း ရတယ်။",
          image: {
            src: `${IMG}/generators.svg`,
            alt: "A generator pausing at each yield",
            caption: "yield → ရပ် · next() → ဆက် (lazy)",
          },
        },
      ],
      code: demo(
        "function* ids() {\n  let i = 1;\n  while (true) yield i++;   // infinite, lazy\n}\nconst gen = ids();\nprint(gen.next().value); // 1\nprint(gen.next().value); // 2\nprint(gen.next().value); // 3\n\nfunction* range(a, b) { for (let i=a; i<=b; i++) yield i; }\nprint([...range(5, 9)]); // [5,6,7,8,9]",
      ),
    },
    {
      slug: "modules",
      title: "ES Modules",
      summary: "import / export — code ကို ဖိုင်များ ခွဲစီမံခြင်း။",
      minutes: 8,
      kind: "code",
      youtubeQuery: "javascript es modules import export",
      sections: [
        {
          heading: "ဖိုင်ခွဲ · ပြန်သုံး",
          body: "ES Modules က code ကို ဖိုင်များ ခွဲပြီး `export` (ထုတ်ပေး) / `import` (ယူသုံး) နဲ့ ချိတ်တဲ့ စနစ်ပါ။ module တိုင်း သီးသန့် scope ရှိလို့ — global namespace မညစ်ဘူး၊ ဘယ်ဟာ ဘယ်ကလာလဲ ရှင်းတယ်။ named export (အများ) နဲ့ default export (တစ်ခု) ရှိတယ်။ (playground က ဖိုင်တစ်ခုတည်းမို့ — ဒီ demo မှာ module pattern ကို object နဲ့ ပြထားပါတယ်။)",
          image: {
            src: `${IMG}/modules.svg`,
            alt: "import and export between module files",
            caption: "export ထုတ် · import ယူ · scope သီးသန့်",
          },
        },
      ],
      code: demo(
        "// module pattern (IIFE) — module ရဲ့ သဘော\nconst mathMod = (() => {\n  const PI = 3.14159;            // private\n  function add(a, b) { return a + b; }\n  function area(r) { return PI * r * r; }\n  return { add, area };          // 'export'\n})();\nprint(mathMod.add(2, 3));        // 5\nprint(mathMod.area(10).toFixed(2)); // 314.16\n// real file: export function add(){} / import { add } from './math.js'",
      ),
    },
    {
      slug: "error-handling",
      title: "Error Handling",
      summary: "try/catch/finally, throw နှင့် custom Error။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "javascript error handling try catch throw",
      sections: [
        {
          heading: "အမှားကို ဂုဏ်သိက္ခာရှိရှိ ကိုင်",
          body: "`try` block ထဲ error တက်ရင် — `catch` က ဖမ်းပြီး program မ crash ဘဲ ဆက်သွားစေတယ်။ `finally` က error ရှိ/မရှိ အမြဲ run (cleanup)။ `throw` နဲ့ ကိုယ်တိုင် error ပစ်နိုင်ပြီး — `Error` ကို extends လုပ်ပြီး custom error type ဖန်တီးလို့ရတယ်။ async မှာ `try/catch` ကို `await` နဲ့ တွဲသုံးပါ။",
          image: {
            src: `${IMG}/promise-states.svg`,
            alt: "Handling success and error paths",
            caption: "try → catch(error) → finally (cleanup)",
          },
        },
      ],
      code: demo(
        "class ValidationError extends Error {\n  constructor(msg) { super(msg); this.name = 'ValidationError'; }\n}\nfunction check(age) {\n  if (age < 0) throw new ValidationError('age မမှန်');\n  return 'ok ' + age;\n}\nfor (const a of [20, -5]) {\n  try { print(check(a)); }\n  catch (e) { print(e.name + ': ' + e.message); }\n  finally { print('— စစ်ပြီး —'); }\n}",
      ),
    },
    {
      slug: "immutability",
      title: "Immutability & Pure Functions",
      summary: "const, Object.freeze, ပြောင်းလဲမှုမရှိ update နှင့် pure function။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "javascript immutability pure functions",
      sections: [
        {
          heading: "မူရင်း မထိဘဲ အသစ် ဆောက်",
          body: "Immutability ဆိုတာ — data ကို တိုက်ရိုက် မပြောင်းဘဲ၊ ပြောင်းချင်ရင် **copy အသစ်** ဆောက်တာပါ (spread `...` သုံး)။ ဒါက bug လျှော့ပြီး React လို framework တွေမှာ အရေးကြီးတယ်။ **Pure function** ဆိုတာ — input တူရင် output အမြဲတူ၊ ပြင်ပ state မထိ (side-effect မရှိ) function ပါ — စမ်းသပ်ရ/မှန်းဆရ လွယ်တယ်။",
          image: {
            src: `${IMG}/hof.svg`,
            alt: "Immutable update creating a new array/object",
            caption: "[...arr, x] · {...obj, k} — မူရင်း မထိ",
          },
        },
      ],
      code: demo(
        "const arr = [1, 2, 3];\nconst added = [...arr, 4];      // မူရင်း မပြောင်း\nprint('orig:', arr, 'new:', added);\nconst user = Object.freeze({ name: 'Mya' });\nuser.name = 'X';               // freeze → တိတ်တဆိတ် fail\nprint('frozen:', user.name);   // Mya\n// pure: input တူ → output တူ, side-effect မရှိ\nconst double = x => x * 2;\nprint(double(5), double(5));    // 10 10",
      ),
    },
    {
      slug: "debounce-throttle",
      title: "Debounce & Throttle",
      summary: "မကြာခဏ fire ဖြစ်တဲ့ event တွေ ထိန်းချုပ်ခြင်း — closure အသုံးချ။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "javascript debounce throttle explained",
      sections: [
        {
          heading: "closure နဲ့ event ထိန်း",
          body: "Search box ရိုက်တာ၊ scroll, resize စတာတွေ — စက္ကန့်ပိုင်း အတွင်း ဒါဇင်ချီ fire ဖြစ်တတ်တယ်။ **Debounce** — နောက်ဆုံး event ပြီး တိတ်ဆိတ်ချိန် (ဥပမာ 300ms) ကြာမှ တစ်ခါ run (search အတွက် အသင့်တော်ဆုံး)။ **Throttle** — အချိန်ကာလ တစ်ခုအတွင်း အများဆုံး တစ်ခါသာ run (scroll အတွက်)။ နှစ်ခုလုံး closure နဲ့ timer မှတ်ထားတာ ဖြစ်တယ် — ဒါ closure ရဲ့ လက်တွေ့ အသုံးချမှုပါ။",
          image: {
            src: `${IMG}/closure.svg`,
            alt: "Debounce and throttle store a timer in a closure",
            caption: "closure ထဲ timer မှတ် → event ထိန်း",
          },
        },
      ],
      code: demo(
        "function debounce(fn, ms) {\n  let t;                         // closure ထဲ မှတ်\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), ms);\n  };\n}\nconst search = debounce(q => print('search:', q), 200);\n// အမြန် ၄ ကြိမ် ရိုက် — နောက်ဆုံးတစ်ခုသာ run\nsearch('t'); search('to'); search('tom'); search('tomato');\nprint('(200ms စောင့်... နောက်ဆုံးတစ်ခုသာ)');",
      ),
    },
    {
      slug: "advjs-quiz",
      title: "Advanced JS Quiz",
      summary: "closure, this, prototype, promise, event loop — စစ်ဆေးပါ။",
      minutes: 6,
      kind: "quiz",
      quiz: [
        {
          q: "Closure ဆိုတာ ဘာလဲ။",
          options: [
            "function ကို ပိတ်တာ",
            "function က သူ့ဖန်တီးရာ scope ရဲ့ variable တွေ ဆက်ကိုင်ထားခြင်း",
            "loop အမျိုးအစား",
            "error တစ်မျိုး",
          ],
          answer: 1,
          explain: "function က outer scope ရဲ့ variable တွေကို scope ပြီးသွားလည်း မှတ်ထားတာ closure ပါ။",
        },
        {
          q: "`this` ရဲ့ တန်ဖိုးက ဘာအပေါ် အဓိက မူတည်လဲ။",
          options: ["function ဘယ်မှာ ရေးလဲ", "function ကို ဘယ်လို ခေါ်လဲ", "file အမည်", "browser"],
          answer: 1,
          explain: "regular function မှာ this က ခေါ်ပုံ (call-site) အပေါ် မူတည်တယ်။",
        },
        {
          q: "arrow function ရဲ့ `this` က ဘယ်ကလာလဲ။",
          options: ["undefined အမြဲ", "ဖန်တီးရာ scope ရဲ့ this", "window အမြဲ", "ကျပန်း"],
          answer: 1,
          explain: "arrow မှာ ကိုယ်ပိုင် this မရှိ — lexical (ဖန်တီးရာ) scope ကနေ ယူတယ်။",
        },
        {
          q: "property မတွေ့ရင် JS က ဘယ်မှာ ဆက်ရှာလဲ။",
          options: ["error တက်", "prototype chain အတိုင်း တက်ရှာ", "global", "ရပ်သွား"],
          answer: 1,
          explain: "object → prototype → ... → null အထိ prototype chain ကို တက်ရှာတယ်။",
        },
        {
          q: "Promise ရဲ့ အခြေအနေ ၃ ခုက ဘာတွေလဲ။",
          options: [
            "start, middle, end",
            "pending, fulfilled, rejected",
            "open, close, error",
            "true, false, null",
          ],
          answer: 1,
          explain: "pending (စောင့်), fulfilled (.then), rejected (.catch)။",
        },
        {
          q: "Event loop မှာ ဘယ်ဟာက ဦးစားပေး run လဲ။",
          options: [
            "setTimeout callback (macrotask)",
            "Promise .then (microtask)",
            "နှစ်ခုတူတူ",
            "ကျပန်း",
          ],
          answer: 1,
          explain: "microtask (Promise) က macrotask (setTimeout) ထက် အရင် run တယ်။",
        },
      ],
    },
  ],
};
