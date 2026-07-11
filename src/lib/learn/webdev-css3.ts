// CSS course — third batch (30 → 60), full quality: every lesson is a runnable
// playground (kind "code" — the styled result renders live), has a YouTube
// video hint, and Burmese explanations with a code sample in each section.
// Original content for GreenWave. Pure data.

import type { Lesson } from "@/lib/learn/lessons";

/** Build a runnable CSS lesson — html + css render together in the preview. */
function css(
  slug: string,
  title: string,
  summary: string,
  minutes: number,
  youtubeQuery: string,
  html: string,
  cssCode: string,
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
    code: { html, css: cssCode, js: "" },
  };
}

export const CSS_EXTRA3: Lesson[] = [
  css(
    "css-flex-alignment",
    "Flexbox — align/justify (နက်နက်)",
    "justify-content, align-items, gap ဖြင့် နေရာချထားခြင်း။",
    10,
    "css flexbox align justify content tutorial",
    '<div class="row">\n  <div class="box">1</div><div class="box">2</div><div class="box">3</div>\n</div>',
    ".row{display:flex;justify-content:space-between;align-items:center;gap:8px;height:120px;background:#f1f5f9;padding:8px}\n.box{background:#22c55e;color:#fff;padding:16px;border-radius:8px}",
    [
      [
        "အဓိက ဝင်ရိုးနှစ်ခု",
        "flex container မှာ ဝင်ရိုးနှစ်ခု ရှိသည် — main axis (default: အလျားလိုက်) နှင့် cross axis (ဒေါင်လိုက်)။ `justify-content` က main axis တစ်လျှောက်၊ `align-items` က cross axis တစ်လျှောက် နေရာချသည်။",
        "display: flex;\njustify-content: center;\nalign-items: center;",
      ],
      [
        "justify-content တန်ဖိုးများ",
        "`flex-start`, `center`, `flex-end`, `space-between` (အစွန်းနှစ်ဖက် ကပ်၊ ကြားညီ), `space-around`, `space-evenly` — item များကို main axis တစ်လျှောက် ဘယ်လို ဖြန့်မလဲ ရွေးသည်။",
        "justify-content: space-between;",
      ],
      [
        "gap",
        "`gap: 8px` က item များကြား အကွာအဝေး — margin သုံးတာထက် သန့်ပြီး နောက်ဆုံး item မှာ ပိုနေတာ မဖြစ်။ flex နှင့် grid နှစ်မျိုးလုံးမှာ သုံးနိုင်သည်။",
      ],
    ],
  ),
  css(
    "css-grid-areas",
    "Grid Template Areas",
    "grid ကို နာမည်တပ်ထားတဲ့ ဧရိယာများနဲ့ တည်ဆောက်ခြင်း။",
    11,
    "css grid template areas tutorial",
    '<div class="layout">\n  <header>Header</header><nav>Nav</nav><main>Main</main><footer>Footer</footer>\n</div>',
    '.layout{display:grid;gap:6px;height:200px;grid-template-columns:80px 1fr;grid-template-areas:"h h" "n m" "f f"}\nheader{grid-area:h}nav{grid-area:n}main{grid-area:m}footer{grid-area:f}\nheader,nav,main,footer{background:#0ea5e9;color:#fff;padding:8px;border-radius:6px;text-align:center}',
    [
      [
        "areas ဆိုတာ",
        "`grid-template-areas` က grid ကို ASCII ပုံစံ ဆွဲသလို နာမည်တပ်ထားတဲ့ ဧရိယာများနဲ့ ဖွဲ့သည်။ string တစ်ကြောင်းက row တစ်ခု၊ စကားလုံးတစ်ခုက cell တစ်ခု။",
        'grid-template-areas:\n  "header header"\n  "nav    main";',
      ],
      [
        "grid-area",
        "element တစ်ခုစီကို `grid-area: header` နဲ့ သတ်မှတ်ထားတဲ့ ဧရိယာနာမည်ဆီ ချိတ်သည်။ တူညီတဲ့ နာမည်ကို ဆက်တိုက်ရေးရင် ဧရိယာ ကျယ်သွားသည် (span)။",
        "header { grid-area: header; }",
      ],
      [
        "အကျိုး",
        "layout တစ်ခုလုံးကို CSS တစ်နေရာမှာ မြင်သာအောင် ဆွဲနိုင်သည်။ responsive အတွက် media query ထဲမှာ areas ကို ပြန်စီရုံနဲ့ layout တစ်ခုလုံး ပြောင်းနိုင်သည်။",
      ],
    ],
  ),
  css(
    "css-grid-auto-fill",
    "Grid — auto-fill နဲ့ minmax",
    "responsive card grid ကို media query မလိုဘဲ တည်ဆောက်ခြင်း။",
    10,
    "css grid auto-fill minmax repeat tutorial",
    '<div class="cards"><div>A</div><div>B</div><div>C</div><div>D</div><div>E</div></div>',
    ".cards{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(90px,1fr))}\n.cards>div{background:#8b5cf6;color:#fff;padding:20px;border-radius:8px;text-align:center}",
    [
      [
        "repeat + auto-fill",
        "`repeat(auto-fill, minmax(90px, 1fr))` က column များကို screen အကျယ်အလိုက် အလိုအလျောက် ဖြည့်ပေးသည် — နေရာဆံ့သလောက် column ထည့်၊ ကျန်တာ အောက်ဆင်း။ media query မလိုတော့ပါ။",
        "grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));",
      ],
      [
        "minmax",
        "`minmax(90px, 1fr)` က column အနည်းဆုံး 90px, အများဆုံး ကျန်နေရာ အညီအမျှ (1fr)။ ဒါက card မသေးလွန်း/မကြီးလွန်း စေဘဲ တောက်လျှောက် လှသည်။",
      ],
      [
        "auto-fill vs auto-fit",
        "`auto-fill` က နေရာလွတ်ဆို column အလွတ် ချန်ထား၊ `auto-fit` က ရှိတဲ့ item များကို ဖြန့်ဆန့်ပေးသည်။ product grid, gallery များအတွက် အသုံးဝင်။",
      ],
    ],
  ),
  css(
    "css-media-queries",
    "Media Queries (နက်နက်)",
    "screen အရွယ်အလိုက် style ပြောင်းခြင်း — mobile-first။",
    10,
    "css media queries responsive tutorial",
    '<div class="panel">screen ကို ချုံ့/ဆန့် ကြည့်ပါ — အရောင် ပြောင်းသည်</div>',
    ".panel{padding:30px;text-align:center;border-radius:8px;background:#22c55e;color:#fff}\n@media (min-width:500px){.panel{background:#0ea5e9}}\n@media (min-width:800px){.panel{background:#8b5cf6}}",
    [
      [
        "media query",
        "`@media (min-width: 500px) { ... }` က screen 500px အထက်မှာသာ အထဲက style သက်ရောက်စေသည်။ ဒါက responsive design ရဲ့ အခြေခံ tool — device တစ်ခုစီအတွက် layout ချိန်ညှိသည်။",
        "@media (min-width: 768px) {\n  .grid { grid-template-columns: 1fr 1fr; }\n}",
      ],
      [
        "mobile-first",
        "အခြေခံ style ကို mobile အတွက် အရင်ရေးပြီး `min-width` နဲ့ screen ကြီးလာမှ ထပ်ဖြည့်တာက အကောင်းဆုံး — မြန်မာ့ mobile အသုံးပြုသူ များစွာအတွက် သင့်တော်။",
      ],
      [
        "အခြား feature များ",
        "`(max-width: ...)`, `(orientation: landscape)`, `(prefers-color-scheme: dark)`, `(prefers-reduced-motion)` — screen အရွယ်တင်မက အသုံးပြုသူ ရွေးချယ်မှုအလိုက်ပါ ချိန်ညှိနိုင်သည်။",
      ],
    ],
  ),
  css(
    "css-container-queries",
    "Container Queries",
    "parent container အရွယ်အလိုက် style ပြောင်းခြင်း။",
    10,
    "css container queries tutorial",
    '<div class="card"><div class="inner">Container query demo</div></div>',
    ".card{container-type:inline-size;border:1px solid #cbd5e1;padding:8px;border-radius:8px}\n.inner{background:#f59e0b;color:#fff;padding:16px;border-radius:6px}\n@container (min-width:300px){.inner{background:#22c55e}}",
    [
      [
        "media vs container",
        "media query က **screen** အရွယ်ကို ကြည့်သည်။ container query က **parent element** အရွယ်ကို ကြည့်သည် — component တစ်ခုကို ဘယ်နေရာ ထားထား ကိုယ့်ဆံ့တဲ့ နေရာအလိုက် ချိန်ညှိနိုင်သည်။",
        "@container (min-width: 300px) { .inner { ... } }",
      ],
      [
        "container-type",
        "parent မှာ `container-type: inline-size` သတ်မှတ်မှ container query အလုပ်လုပ်သည်။ ၎င်းက 'ဒီ element ကို container အဖြစ် တိုင်းတာပါ' လို့ ဆိုသည်။",
      ],
      [
        "အကျိုး",
        "reusable component (card, widget) များအတွက် အလွန်အသုံးဝင် — sidebar မှာ သေးသေး၊ main မှာ ကြီးကြီး အလိုအလျောက် ပြောင်းသည်။ modern browser များ ထောက်ပံ့ပြီ။",
      ],
    ],
  ),
  css(
    "css-transitions",
    "Transitions",
    "state ပြောင်းချိန် ချောမွေ့တဲ့ animation။",
    9,
    "css transitions tutorial",
    '<button class="btn">Hover me</button>',
    ".btn{background:#22c55e;color:#fff;border:0;padding:12px 24px;border-radius:8px;font-size:16px;transition:transform .2s ease,background .2s ease}\n.btn:hover{background:#16a34a;transform:scale(1.1)}",
    [
      [
        "transition",
        "`transition: transform .2s ease` က property တစ်ခု ပြောင်းချိန် (hover, focus) ချက်ချင်း မဟုတ်ဘဲ တဖြည်းဖြည်း ပြောင်းစေသည်။ syntax — property, ကြာချိန်, timing function။",
        "transition: background 0.3s ease, transform 0.2s;",
      ],
      [
        "trigger",
        "transition ကို `:hover`, `:focus`, class ပြောင်း (JS) စတဲ့ state ပြောင်းမှုများက စတင်စေသည်။ base state နဲ့ ပြောင်းထားတဲ့ state ကြားက ကွာဟမှုကို animate လုပ်ပေးသည်။",
      ],
      [
        "timing function",
        "`ease`, `linear`, `ease-in-out`, `cubic-bezier(...)` — ပြောင်းလဲမှုရဲ့ 'အရှိန်' ပုံစံ။ UI ကို သဘာဝကျ၊ လှပစေရန် အရေးကြီး။ animation ကို 200–300ms လောက်သာ ထားပါ။",
      ],
    ],
  ),
  css(
    "css-keyframes",
    "Keyframe Animations",
    "@keyframes ဖြင့် ဆက်တိုက် လှုပ်ရှားမှု ဖန်တီးခြင်း။",
    10,
    "css keyframes animation tutorial",
    '<div class="ball"></div>',
    "@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-40px)}}\n.ball{width:40px;height:40px;border-radius:50%;background:#ef4444;animation:bounce 1s ease-in-out infinite}",
    [
      [
        "@keyframes",
        "`@keyframes` က animation ရဲ့ အဆင့်များ (0% မှ 100%) ကို သတ်မှတ်သည်။ transition (state နှစ်ခုကြား) နဲ့မတူ — အဆင့်များစွာ ပါဝင်နိုင်ပြီး ကိုယ်တိုင် စတင်နိုင်သည်။",
        "@keyframes spin {\n  from { transform: rotate(0); }\n  to { transform: rotate(360deg); }\n}",
      ],
      [
        "animation property",
        "`animation: bounce 1s ease-in-out infinite` — အမည်, ကြာချိန်, timing, အကြိမ်ရေ (`infinite` = အဆုံးမရှိ)။ `alternate` က အသွား/အပြန် တလှည့်စီ။",
        "animation: spin 2s linear infinite;",
      ],
      [
        "performance",
        "`transform` နဲ့ `opacity` ကိုသာ animate လုပ်ပါ — GPU က ကိုင်တွယ်လို့ ချောမွေ့သည်။ `width`, `top`, `margin` animate လုပ်ရင် reflow ဖြစ်ပြီး ခြစ်တတ်သည်။",
      ],
    ],
  ),
  css(
    "css-transform-3d",
    "3D Transforms",
    "perspective, rotateX/Y ဖြင့် သုံးဖက်မြင် effect။",
    9,
    "css 3d transforms perspective tutorial",
    '<div class="scene"><div class="card3d">3D</div></div>',
    ".scene{perspective:400px;padding:20px}\n.card3d{width:100px;height:100px;background:#0ea5e9;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:8px;transition:transform .4s;transform:rotateY(0)}\n.scene:hover .card3d{transform:rotateY(40deg)}",
    [
      [
        "perspective",
        "parent မှာ `perspective: 400px` သတ်မှတ်မှ 3D depth ပေါ်လာသည် — တန်ဖိုးနည်းရင် ပိုပြင်းထန်တဲ့ 3D effect။ ၎င်းက 'ကြည့်သူ မျက်လုံး အကွာအဝေး' လို့ ဆိုသည်။",
        "perspective: 500px;",
      ],
      [
        "rotateX / rotateY / rotateZ",
        "`rotateY(40deg)` က ဒေါင်လိုက်ဝင်ရိုးပတ် လှည့်၊ `rotateX` က အလျားလိုက်၊ `translateZ` က ရှေ့/နောက် ရွှေ့သည်။ card flip, cube effect များ ဖန်တီးနိုင်။",
        "transform: rotateY(180deg);",
      ],
      [
        "transform-style",
        "nested 3D အတွက် `transform-style: preserve-3d` လိုသည် — child element များ ၎င်းတို့ရဲ့ 3D နေရာ ထိန်းထားစေသည်။ flip card ရဲ့ ရှေ့/နောက်မျက်နှာ အတွက်။",
      ],
    ],
  ),
  css(
    "css-filters",
    "Filters",
    "blur, brightness, grayscale ဖြင့် ပုံ/element ပြင်ဆင်ခြင်း။",
    8,
    "css filter property tutorial",
    '<div class="row"><div class="b a">normal</div><div class="b c">blur</div><div class="b d">gray</div></div>',
    ".row{display:flex;gap:8px}\n.b{width:70px;height:70px;background:linear-gradient(45deg,#f59e0b,#ef4444);color:#fff;display:flex;align-items:center;justify-content:center;border-radius:8px;font-size:11px}\n.c{filter:blur(2px)}.d{filter:grayscale(1)}",
    [
      [
        "filter",
        "`filter` က element ကို image editor လို ပြင်ဆင်ပေးသည် — `blur(4px)`, `brightness(1.2)`, `contrast(1.5)`, `grayscale(1)`, `sepia(1)`, `hue-rotate(90deg)`။",
        "filter: brightness(1.2) contrast(1.1);",
      ],
      [
        "backdrop-filter",
        "`backdrop-filter: blur(10px)` က element **နောက်ခံ**ကို ဝါးစေသည် — 'frosted glass' (မှန်နှင်းခဲ) effect။ modal, navbar များအတွက် လှသည်။",
      ],
      [
        "hover effect",
        "transition နဲ့ တွဲရင် gallery ပုံများကို hover လုပ်တဲ့အခါ grayscale မှ full-colour ပြောင်းတာမျိုး လှလှပပ လုပ်နိုင်သည်။",
      ],
    ],
  ),
  css(
    "css-blend-modes",
    "Blend Modes",
    "မျဉ်း/ပုံ အလွှာများ ရောစပ်ခြင်း — mix-blend-mode။",
    8,
    "css mix-blend-mode tutorial",
    '<div class="stack"><div class="c1"></div><div class="c2"></div></div>',
    ".stack{position:relative;height:120px}\n.c1,.c2{position:absolute;width:90px;height:90px;border-radius:50%}\n.c1{background:#ef4444;left:10px;top:15px}\n.c2{background:#0ea5e9;left:60px;top:15px;mix-blend-mode:multiply}",
    [
      [
        "mix-blend-mode",
        "`mix-blend-mode: multiply` က element ကို ၎င်းအောက်က အရာနဲ့ ရောစပ်ပေးသည် — Photoshop layer blend လိုပဲ။ `screen`, `overlay`, `difference` စသဖြင့် ရှိသည်။",
        "mix-blend-mode: multiply;",
      ],
      [
        "background-blend-mode",
        "element တစ်ခုတည်းရဲ့ background image နဲ့ background colour ကို ရောစပ်ချင်ရင် `background-blend-mode` သုံးသည် — duotone ပုံ effect ဖန်တီးနိုင်။",
      ],
      [
        "အသုံးဝင်ပုံ",
        "ပုံပေါ်မှာ စာ ဖတ်ရလွယ်အောင် overlay, logo ရောစပ်ခြင်း, ဖန်တီးမှုဆိုင်ရာ effect များအတွက်။ သတိ — အရောင် ကွာဟမှု (contrast) ကို ထိန်းပါ။",
      ],
    ],
  ),
  css(
    "css-clip-path",
    "clip-path",
    "element ကို ပုံသဏ္ဌာန်အမျိုးမျိုး ဖြတ်တောက်ခြင်း။",
    8,
    "css clip-path tutorial",
    '<div class="shapes"><div class="s tri"></div><div class="s hex"></div></div>',
    ".shapes{display:flex;gap:12px}\n.s{width:80px;height:80px;background:#8b5cf6}\n.tri{clip-path:polygon(50% 0,100% 100%,0 100%)}\n.hex{clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)}",
    [
      [
        "clip-path",
        "`clip-path` က element ကို ပုံသဏ္ဌာန်တစ်ခုအတိုင်း ဖြတ်ပြသည် — ကျန်တာ ဖျောက်။ `circle()`, `ellipse()`, `polygon(...)`, `inset()` သုံးနိုင်သည်။",
        "clip-path: circle(50%);",
      ],
      [
        "polygon",
        "`polygon(50% 0, 100% 100%, 0 100%)` က point များ ချိတ်ဆက်၍ ပုံဆွဲသည် — ဒါက တြိဂံ။ point တစ်ခုစီက x% y% (element ရဲ့ ရာခိုင်နှုန်း)။",
      ],
      [
        "အသုံးဝင်ပုံ",
        "hero section ရဲ့ စောင်းနေတဲ့ အနားသတ်, badge, ဒီဇိုင်း element များအတွက်။ transition နဲ့ တွဲရင် ပုံသဏ္ဌာန် ပြောင်းတဲ့ animation လုပ်နိုင်သည်။",
      ],
    ],
  ),
  css(
    "css-object-fit",
    "object-fit",
    "ပုံ/ဗီဒီယိုကို container ထဲ ဘယ်လို ဆံ့စေမလဲ။",
    8,
    "css object-fit tutorial",
    '<div class="imgs"><img class="a" src="https://placehold.co/120x60/22c55e/fff"><img class="b" src="https://placehold.co/120x60/0ea5e9/fff"></div>',
    ".imgs{display:flex;gap:8px}\nimg{width:80px;height:80px;border-radius:8px}\n.a{object-fit:cover}.b{object-fit:contain;background:#e2e8f0}",
    [
      [
        "ပြဿနာ",
        "ပုံရဲ့ အချိုးအစား နဲ့ container မတူရင် ပုံ ဆွဲဆန့်/ပြားသွားနိုင်သည်။ `object-fit` က ဒါကို ဖြေရှင်းသည်။",
      ],
      [
        "cover vs contain",
        "`object-fit: cover` က container အပြည့် ဖုံး (ဘေးပိုတာ ဖြတ်) — thumbnail, avatar အတွက်။ `contain` က ပုံအပြည့် ပြ (ဘေးမှာ နေရာ ချန်)။",
        "img { width: 100%; height: 200px; object-fit: cover; }",
      ],
      [
        "object-position",
        "`object-position: center top` က ဖြတ်တဲ့အခါ ဘယ်အပိုင်း ပြထားမလဲ ရွေးသည် — လူပုံတွေမှာ ဦးခေါင်း မဖြတ်မိအောင် `top` သုံးတာမျိုး။",
      ],
    ],
  ),
  css(
    "css-aspect-ratio",
    "aspect-ratio",
    "element ရဲ့ အလျား:အမြင့် အချိုး ထိန်းချုပ်ခြင်း။",
    7,
    "css aspect-ratio property tutorial",
    '<div class="v">16:9</div><div class="sq">1:1</div>',
    ".v{aspect-ratio:16/9;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:8px;margin-bottom:8px}\n.sq{aspect-ratio:1;width:80px;background:#0ea5e9;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:8px}",
    [
      [
        "aspect-ratio",
        "`aspect-ratio: 16/9` က element ရဲ့ အလျား:အမြင့် အချိုးကို ထိန်းသည် — အကျယ် ဘယ်လောက် ဖြစ်ဖြစ် အမြင့်ကို အလိုအလျောက် တွက်ပေးသည်။ video, card thumbnail အတွက် အလွန်အသုံးဝင်။",
        "aspect-ratio: 16 / 9;\naspect-ratio: 1;   /* စတုရန်း */",
      ],
      [
        "ရှေးနည်း",
        "အရင်က padding-top hack (`padding-top: 56.25%`) သုံးခဲ့ရသည်။ `aspect-ratio` က ရှင်းရှင်းလင်းလင်း အစားထိုးပေးလို့ code သန့်သွားသည်။",
      ],
      [
        "အသုံးချ",
        "reels/video grid, image placeholder (loading), map embed များမှာ အရွယ် တည်ငြိမ်စေ၍ layout shift (စာမျက်နှာ ခုန်တာ) ကို ကာကွယ်သည်။",
      ],
    ],
  ),
  css(
    "css-calc",
    "calc()",
    "unit မတူတဲ့ တန်ဖိုးများ တွက်ချက်ခြင်း။",
    8,
    "css calc function tutorial",
    '<div class="bar">width: calc(100% - 40px)</div>',
    ".bar{width:calc(100% - 40px);background:#f59e0b;color:#fff;padding:16px;border-radius:8px;margin:0 auto}",
    [
      [
        "calc()",
        "`calc()` က unit မတူတဲ့ တန်ဖိုးများ (%, px, rem, vw) ကို ပေါင်း/နုတ်/မြှောက်/စား လုပ်ပေးသည် — CSS တစ်ခုတည်းမှာ တွက်ချက်မှု။ operator ဘေးမှာ ကွက်လပ် ထားရသည်။",
        "width: calc(100% - 2rem);\nheight: calc(100vh - 60px);",
      ],
      [
        "အသုံးများ",
        "sidebar ဖယ်ပြီး ကျန်နေရာ (`calc(100% - 250px)`), navbar အမြင့် ဖယ်ပြီး full-height (`calc(100vh - 3.5rem)`) — gwave ရဲ့ layout များစွာမှာ သုံးထားသည်။",
      ],
      [
        "CSS variable နဲ့",
        "`calc(var(--gap) * 2)` လို variable နဲ့ တွဲသုံးရင် design system တစ်ခုလုံးကို တစ်နေရာက ထိန်းချုပ်နိုင်သည် — အလွန် အားကောင်း။",
      ],
    ],
  ),
  css(
    "css-nesting",
    "CSS Nesting",
    "selector များကို အထဲထဲ ရေးခြင်း (Sass မလို)။",
    8,
    "css native nesting tutorial",
    '<div class="card"><h3>Title</h3><p>Body <a href="#">link</a></p></div>',
    ".card{background:#f1f5f9;padding:16px;border-radius:8px}\n.card h3{margin:0 0 6px;color:#0f172a}\n.card p{margin:0;color:#475569}\n.card a{color:#0ea5e9}\n.card a:hover{text-decoration:underline}",
    [
      [
        "nesting ဆိုတာ",
        "modern CSS မှာ selector များကို အထဲထဲ (nested) ရေးနိုင်ပြီ — Sass/Less မလိုတော့ပါ။ `.card { & h3 { ... } }` ပုံစံ။ ဆက်စပ်တဲ့ style များ တစ်နေရာမှာ စုထားလို့ ဖတ်ရလွယ်။",
        ".card {\n  padding: 16px;\n  & h3 { color: navy; }\n  &:hover { background: #eee; }\n}",
      ],
      [
        "& (parent selector)",
        "`&` က parent selector ကို ကိုယ်စားပြုသည် — `&:hover`, `&.active`, `& .child`။ pseudo-class နဲ့ modifier များ ရေးရာမှာ အသုံးဝင်။",
      ],
      [
        "browser support",
        "modern browser များ (2023+) ထောက်ပံ့ပြီ။ ဟောင်းတဲ့ browser ရော support လိုရင် PostCSS/Sass နဲ့ compile လုပ်နိုင်သည်။",
      ],
    ],
  ),
  css(
    "css-z-index",
    "z-index နဲ့ Stacking",
    "element များ ဘယ်ဟာ အပေါ်တင်မလဲ ထိန်းချုပ်ခြင်း။",
    9,
    "css z-index stacking context tutorial",
    '<div class="wrap"><div class="a">1</div><div class="b">2 (top)</div></div>',
    ".wrap{position:relative;height:100px}\n.a,.b{position:absolute;width:60px;height:60px;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:8px}\n.a{background:#ef4444;left:20px;top:15px;z-index:1}\n.b{background:#0ea5e9;left:50px;top:30px;z-index:2}",
    [
      [
        "z-index",
        "`z-index` က overlap ဖြစ်တဲ့ element များထဲက ဘယ်ဟာ အပေါ်တင်မလဲ သတ်မှတ်သည် — ဂဏန်း ကြီးတာ အပေါ်။ `position` (relative/absolute/fixed) သတ်မှတ်ထားမှ အလုပ်လုပ်သည်။",
        "position: absolute;\nz-index: 10;",
      ],
      [
        "stacking context",
        "element အချို့ (`position` + `z-index`, `opacity < 1`, `transform`) က 'stacking context' အသစ် ဖန်တီးသည်။ အထဲက z-index က အပြင်နဲ့ မယှဉ်တော့ဘဲ context အတွင်းသာ ယှဉ်သည် — z-index bug များရဲ့ အဓိကအကြောင်းရင်း။",
      ],
      [
        "အကြံ",
        "z-index ကို 9999 လို ကြီးကြီး မသုံးပါနှင့်။ layer အဆင့် (dropdown: 10, modal: 100, toast: 1000) စနစ်တကျ သတ်မှတ်ထားတာက ရှင်းသည်။",
      ],
    ],
  ),
  css(
    "css-scroll-snap",
    "Scroll Snap",
    "scroll လုပ်ရင် item များ နေရာကျအောင် ဆွဲစေခြင်း။",
    8,
    "css scroll snap tutorial",
    '<div class="slider"><div>1</div><div>2</div><div>3</div><div>4</div></div>',
    ".slider{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px}\n.slider>div{scroll-snap-align:center;flex:0 0 80%;height:100px;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:8px}",
    [
      [
        "scroll-snap-type",
        "container မှာ `scroll-snap-type: x mandatory` က အလျားလိုက် scroll လုပ်ရင် item များကို နေရာကျအောင် အလိုအလျောက် ဆွဲပေးသည် — carousel/slider ကို JS မလိုဘဲ ရသည်။",
        "scroll-snap-type: x mandatory;",
      ],
      [
        "scroll-snap-align",
        "child element များမှာ `scroll-snap-align: center` (သို့ `start`) က ဘယ်နေရာမှာ ရပ်မလဲ သတ်မှတ်သည်။ image carousel, story viewer, product slider အတွက် အသုံးဝင်။",
      ],
      [
        "အကျိုး",
        "mobile-friendly slider ကို native scroll (momentum, touch) နဲ့ ရလို့ JS library မလို — performance ကောင်း၊ code သန့်။",
      ],
    ],
  ),
  css(
    "css-nth-child",
    "nth-child နဲ့ Patterns",
    "element များကို ပုံစံအလိုက် ရွေးခြယ်ခြင်း။",
    9,
    "css nth-child selector tutorial",
    '<ul class="list"><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li></ul>',
    ".list{list-style:none;padding:0}\n.list li{padding:8px;border-radius:6px}\n.list li:nth-child(odd){background:#e2e8f0}\n.list li:nth-child(even){background:#f8fafc}\n.list li:nth-child(2){color:#ef4444;font-weight:bold}",
    [
      [
        "nth-child",
        "`:nth-child(2)` က ဒုတိယ element၊ `:nth-child(odd)`/`(even)` က မ/စုံ, `:nth-child(3n)` က ၃ ခုတိုင်း — table row အရောင်လိုက်ခြားခြင်း (zebra), grid pattern များအတွက်။",
        "tr:nth-child(even) { background: #f4f4f4; }",
      ],
      [
        "first/last/only",
        "`:first-child`, `:last-child`, `:only-child` — list ရဲ့ ပထမ/နောက်ဆုံး item မှာ margin/border ဖယ်တာမျိုးအတွက် အသုံးဝင်။",
        "li:last-child { border-bottom: none; }",
      ],
      [
        "nth-of-type",
        "`:nth-child` က element အားလုံးကို ရေတွက်၊ `:nth-of-type` က တူညီ tag များကိုသာ ရေတွက်သည် — ရောနှောနေတဲ့ element များထဲက pattern ရွေးရာမှာ ကွာသည်။",
      ],
    ],
  ),
  css(
    "css-attribute-selectors",
    "Attribute Selectors",
    "attribute တန်ဖိုးအလိုက် element ရွေးခြယ်ခြင်း။",
    8,
    "css attribute selectors tutorial",
    '<input type="text" placeholder="text"><br><br><input type="email" placeholder="email"><br><br><a href="https://x.com">external</a>',
    'input{padding:8px;border:1px solid #cbd5e1;border-radius:6px}\ninput[type="email"]{border-color:#0ea5e9}\na[href^="https"]{color:#22c55e}\na[href^="https"]::after{content:" ↗"}',
    [
      [
        "attribute selector",
        "`[type=\"email\"]` က ၎င်း attribute ရှိတဲ့ element ရွေးသည်။ `[disabled]`, `[required]` စသဖြင့် တန်ဖိုးမပါဘဲလည်း ရွေးနိုင်။ form styling အတွက် အလွန်အသုံးဝင်။",
        'input[type="email"] { border-color: blue; }',
      ],
      [
        "pattern matching",
        "`[href^=\"https\"]` (နဲ့စ), `[href$=\".pdf\"]` (နဲ့ဆုံး), `[class*=\"btn\"]` (ပါဝင်) — external link, PDF link, icon များကို အလိုအလျောက် မှတ်သားရာမှာ သုံးသည်။",
        'a[href$=".pdf"]::after { content: " (PDF)"; }',
      ],
      [
        "data-* နဲ့",
        "`[data-status=\"active\"]` လို data attribute နဲ့ တွဲရင် JavaScript က data-* ပြောင်းရုံနဲ့ style ပြောင်းစေနိုင်သည် — state-driven UI ရဲ့ သန့်ရှင်းတဲ့ နည်း။",
      ],
    ],
  ),
  css(
    "css-combinators",
    "Combinators",
    "element ဆက်နွယ်မှုအလိုက် ရွေးခြယ်ခြင်း။",
    8,
    "css combinators selectors tutorial",
    '<div class="menu"><h3>Menu</h3><p>first</p><p>second</p></div>',
    ".menu h3+p{color:#ef4444;font-weight:bold}\n.menu>p{margin:4px 0}\n.menu p~p{color:#0ea5e9}",
    [
      [
        "combinator အမျိုးအစား",
        "`A B` (descendant — အထဲမှာ), `A > B` (direct child — တိုက်ရိုက်သား), `A + B` (adjacent — ချက်ချင်းနောက်), `A ~ B` (sibling — နောက်က ညီအစ်ကို အားလုံး)။",
        ".nav > li { ... }   /* တိုက်ရိုက် child သာ */",
      ],
      [
        "child vs descendant",
        "`.card p` က .card ထဲက p **အားလုံး** (နက်နက်ပါ)၊ `.card > p` က တိုက်ရိုက် child p သာ။ nested structure မှာ တိကျစွာ ရွေးချင်ရင် `>` သုံးပါ။",
      ],
      [
        "adjacent (+)",
        "`h3 + p` က h3 ရဲ့ ချက်ချင်းနောက်က p — heading အောက်က ပထမ paragraph ကို သီးသန့် style လုပ်တာမျိုး။ form label + input အတွက်လည်း အသုံးဝင်။",
      ],
    ],
  ),
  css(
    "css-cascade-layers",
    "Cascade Layers (@layer)",
    "style ဦးစားပေးမှုကို အလွှာလိုက် စီမံခြင်း။",
    9,
    "css cascade layers layer tutorial",
    '<button class="btn">Styled by layers</button>',
    "@layer base,theme;\n@layer base{.btn{padding:10px 20px;border:0;border-radius:8px}}\n@layer theme{.btn{background:#8b5cf6;color:#fff}}",
    [
      [
        "@layer",
        "`@layer` က style များကို အလွှာ (base, components, utilities) ခွဲ၍ ဦးစားပေးမှုကို ရှင်းရှင်းလင်းလင်း ထိန်းချုပ်ပေးသည်။ နောက်ကြေညာတဲ့ layer က ဦးစားပေးများသည် — specificity အငြင်းပွားမှု လျော့။",
        "@layer reset, base, components, utilities;",
      ],
      [
        "ဘာကြောင့် အသုံးဝင်",
        "project ကြီးလာရင် `!important` နဲ့ specificity war ဖြစ်တတ်သည်။ @layer က 'framework style ကို ကိုယ့် style က အမြဲ လွှမ်း' လို စည်းမျဉ်း တိတိကျကျ ချမှတ်ပေးသည်။",
      ],
      [
        "order",
        "layer ရဲ့ အစီအစဉ်ကို အပေါ်မှာ တစ်ခါတည်း ကြေညာနိုင်သည် — `@layer a, b;`။ b က a ထက် ဦးစားပေး၊ ရေးထားတဲ့ နေရာ မဆိုင်တော့ပါ။",
      ],
    ],
  ),
  css(
    "css-logical-properties",
    "Logical Properties",
    "ဘာသာစကား ဦးတည်ချက် (LTR/RTL) အလိုက် ချိန်ညှိခြင်း။",
    8,
    "css logical properties tutorial",
    '<div class="box">margin-inline-start</div>',
    ".box{margin-inline-start:24px;padding-block:12px;padding-inline:16px;background:#22c55e;color:#fff;border-start-start-radius:12px}",
    [
      [
        "physical vs logical",
        "`margin-left` က ရုပ်ပိုင်းအရ ဘယ်ဘက်။ `margin-inline-start` က 'စာဖတ်တဲ့ အစဘက်' — LTR (မြန်မာ/အင်္ဂလိပ်) မှာ ဘယ်, RTL (အာရဗီ) မှာ ညာ။ ဘာသာစကားစုံ site အတွက် အရေးကြီး။",
        "margin-inline-start: 1rem;\npadding-block: 8px;   /* အပေါ်+အောက် */",
      ],
      [
        "inline vs block",
        "`inline` က စာဖတ်တဲ့ ဦးတည်ချက် (ပုံမှန် အလျားလိုက်), `block` က ၎င်းနဲ့ ထောင့်မှန် (ဒေါင်လိုက်)။ `padding-inline`, `margin-block`, `inset-inline` စသဖြင့်။",
      ],
      [
        "အကျိုး",
        "RTL support ကို CSS ပြန်ရေးစရာမလိုဘဲ အလိုအလျောက် ရသည်။ modern, international web ရဲ့ အလေ့အထ ကောင်း။",
      ],
    ],
  ),
  css(
    "css-dark-mode",
    "Dark Mode",
    "အလင်း/အမှောင် theme ကို CSS variable ဖြင့် တည်ဆောက်ခြင်း။",
    9,
    "css dark mode variables tutorial",
    '<div class="card"><p>Theme-aware card</p></div>',
    ":root{--bg:#fff;--fg:#0f172a}\n@media (prefers-color-scheme:dark){:root{--bg:#0f172a;--fg:#f8fafc}}\n.card{background:var(--bg);color:var(--fg);padding:20px;border-radius:8px;border:1px solid #94a3b8}",
    [
      [
        "prefers-color-scheme",
        "`@media (prefers-color-scheme: dark)` က အသုံးပြုသူရဲ့ device က dark mode လား ကြည့်သည်။ CSS variable တန်ဖိုးများကို ဒီထဲမှာ ပြောင်းရုံနဲ့ theme တစ်ခုလုံး ပြောင်းသည်။",
        "@media (prefers-color-scheme: dark) {\n  :root { --bg: #111; --fg: #eee; }\n}",
      ],
      [
        "variable-driven",
        "အရောင်တိုင်းကို variable (`var(--bg)`) နဲ့ သုံးပါ — element တစ်ခုချင်း မပြင်ဘဲ `:root` variable ပြောင်းရုံနဲ့ site တစ်ခုလုံး theme ပြောင်းသည်။ gwave ရဲ့ theme system ရဲ့ အခြေခံ။",
      ],
      [
        "manual toggle",
        "user ကိုယ်တိုင် ရွေးချင်ရင် `:root[data-theme=\"dark\"]` selector နဲ့ JavaScript က `data-theme` attribute ပြောင်းပေးသည် — system setting ကို override လုပ်နိုင်။",
      ],
    ],
  ),
  css(
    "css-accessibility",
    "CSS Accessibility",
    "focus, contrast, reduced-motion — အားလုံးသုံးနိုင်စေရန်။",
    9,
    "css accessibility focus visible tutorial",
    '<button class="btn">Tab to focus me</button>',
    ".btn{padding:10px 20px;border:0;border-radius:8px;background:#22c55e;color:#fff;font-size:16px}\n.btn:focus-visible{outline:3px solid #0ea5e9;outline-offset:2px}\n@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}",
    [
      [
        "focus-visible",
        "keyboard နဲ့ navigate လုပ်သူများ 'ဘယ်ရောက်နေမှန်း' သိဖို့ focus outline မဖြစ်မနေ လိုသည်။ `:focus-visible` က keyboard focus မှာသာ outline ပြ (mouse click မှာ မပြ) — အလှနဲ့ accessibility နှစ်ခုလုံး ရသည်။ outline ကို **မဖျောက်ပါနှင့်**။",
        ".btn:focus-visible { outline: 3px solid blue; }",
      ],
      [
        "colour contrast",
        "စာနဲ့ နောက်ခံ အရောင် ကွာဟမှု (contrast ratio) အနည်းဆုံး 4.5:1 ရှိရမည် — မျက်စိအားနည်းသူများ ဖတ်နိုင်ရန်။ browser DevTools က contrast ကို စစ်ပေးသည်။",
      ],
      [
        "prefers-reduced-motion",
        "အသုံးပြုသူ အချို့က animation များက ခေါင်းမူး/မမူးဖြစ်စေသည်။ `@media (prefers-reduced-motion: reduce)` ထဲမှာ animation ပိတ်ပေးခြင်းက ဂရုစိုက်မှု ဖြစ်သည်။",
      ],
    ],
  ),
  css(
    "css-print",
    "Print Stylesheets",
    "စာမျက်နှာကို ပရင့်ထုတ်ရန် ပြင်ဆင်ခြင်း။",
    8,
    "css print stylesheet media print tutorial",
    '<div class="doc"><nav class="no-print">Menu (ပရင့်မှာ မပါ)</nav><p>ပရင့်ထုတ်မယ့် အကြောင်းအရာ</p></div>',
    ".no-print{background:#ef4444;color:#fff;padding:8px;border-radius:6px}\n@media print{.no-print{display:none}body{color:#000}}",
    [
      [
        "@media print",
        "`@media print { ... }` ထဲက style က ပရင့်ထုတ်တဲ့အခါ (သို့ PDF သိမ်းတဲ့အခါ) သာ သက်ရောက်သည်။ POS receipt, invoice, report များအတွက် အသုံးဝင်။",
        "@media print {\n  .sidebar, nav { display: none; }\n}",
      ],
      [
        "ဖျောက်သင့်တာများ",
        "nav, sidebar, button, ad များကို `display: none` နဲ့ ဖျောက်ပါ။ နောက်ခံအရောင် ဖယ်, စာလုံးအနက်, link ရဲ့ URL ကို ဖော်ပြ (`a::after { content: attr(href); }`) — စက္ကူ ချွေတာ၊ ဖတ်ရလွယ်။",
      ],
      [
        "page break",
        "`page-break-inside: avoid` (သို့ `break-inside: avoid`) က table row, card တစ်ခုကို စာမျက်နှာ နှစ်ခုကြား မဖြတ်စေ။ invoice, receipt တွေမှာ အရေးကြီး။",
      ],
    ],
  ),
  css(
    "css-bem",
    "BEM Naming",
    "class နာမည်များ စနစ်တကျ ပေးခြင်း — Block Element Modifier။",
    9,
    "css bem naming convention tutorial",
    '<div class="card card--featured"><h3 class="card__title">Title</h3><button class="card__btn">Buy</button></div>',
    ".card{padding:16px;border-radius:8px;background:#f1f5f9}\n.card--featured{border:2px solid #22c55e}\n.card__title{margin:0 0 8px;color:#0f172a}\n.card__btn{background:#22c55e;color:#fff;border:0;padding:8px 16px;border-radius:6px}",
    [
      [
        "BEM ဆိုတာ",
        "Block__Element--Modifier — class နာမည်ပေးတဲ့ စည်းမျဉ်း။ `card` (block), `card__title` (element — အစိတ်အပိုင်း), `card--featured` (modifier — အမျိုးအစား)။ ကြီးမားတဲ့ project မှာ class များ ရှုပ်မသွားစေရန်။",
        ".block__element--modifier",
      ],
      [
        "ဘာကြောင့် အသုံးဝင်",
        "class နာမည်ကြည့်ရုံနဲ့ 'ဘယ် component ရဲ့ ဘယ်အပိုင်းလဲ' သိသည်။ specificity တူညီ (class တစ်ခုစီ) ဖြစ်လို့ cascade ရှုပ်ထွေးမှု လျော့။ nested selector များ မလိုတော့ပါ။",
      ],
      [
        "အခြား နည်းလမ်းများ",
        "BEM အပြင် utility-first (Tailwind), CSS Modules, CSS-in-JS စတဲ့ ချဉ်းကပ်ပုံများ ရှိသည်။ team နဲ့ project အလိုက် တစ်ခုကို ရွေးပြီး တစ်သမတ်တည်း သုံးတာ အဓိက။",
      ],
    ],
  ),
  css(
    "css-performance",
    "CSS Performance",
    "မြန်ဆန်တဲ့ style ရေးနည်း။",
    8,
    "css performance optimization tutorial",
    '<div class="box">Animate transform, not width</div>',
    ".box{background:#0ea5e9;color:#fff;padding:20px;border-radius:8px;transition:transform .3s;will-change:transform}\n.box:hover{transform:translateX(20px)}",
    [
      [
        "transform + opacity",
        "animation အတွက် `transform` နဲ့ `opacity` ကိုသာ သုံးပါ — browser က GPU နဲ့ ကိုင်တွယ်လို့ ချောမွေ့သည်။ `width`, `height`, `top`, `margin` animate လုပ်ရင် reflow/repaint ဖြစ်ပြီး ခြစ်တတ်။",
        "/* ✅ */ transform: translateX(20px);\n/* ❌ */ left: 20px;",
      ],
      [
        "selector ရိုးရှင်းစေ",
        "အလွန်ရှုပ်တဲ့ selector (`.a .b .c .d span`) က browser ကို ပင်ပန်းစေသည်။ class တစ်ခုတည်း (`.card-title`) က ပိုမြန်၊ ပိုရှင်း။",
      ],
      [
        "will-change (သတိနဲ့)",
        "`will-change: transform` က browser ကို 'ဒါ animate လုပ်တော့မယ်' ကြိုပြောပေးသည် — ကြိုပြင်ဆင်လို့ ချောသည်။ ဒါပေမဲ့ များများ မသုံးပါနှင့် — memory ကုန်စေသည်။",
      ],
    ],
  ),
  css(
    "css-utility-first",
    "Utility-First (Tailwind concept)",
    "class လေးများ ပေါင်း၍ ဒီဇိုင်းဆွဲခြင်း။",
    9,
    "tailwind css utility first explained",
    '<div class="p-4 rounded bg-green text-white flex gap">\n  <span class="bold">Utility</span><span>classes</span>\n</div>',
    ".p-4{padding:16px}.rounded{border-radius:8px}.bg-green{background:#22c55e}.text-white{color:#fff}.flex{display:flex}.gap{gap:8px}.bold{font-weight:bold}",
    [
      [
        "utility-first ဆိုတာ",
        "class တစ်ခုစီက အလုပ်တစ်ခုသာ လုပ်သည် (`p-4` = padding, `flex` = display:flex)။ HTML မှာ ၎င်းတို့ ပေါင်းစပ်ရုံနဲ့ ဒီဇိုင်းဆွဲသည် — CSS ဖိုင် သီးသန့် မရေးဘဲ။ Tailwind CSS ရဲ့ ချဉ်းကပ်ပုံ။",
        '<div class="flex gap-2 p-4 rounded bg-white">',
      ],
      [
        "အားသာ/အားနည်း",
        "အားသာ — မြန်, consistent (design token), CSS မကြီးလာ, နာမည်ပေးစရာ မလို။ အားနည်း — HTML class များ, အစပိုင်း သင်ယူရ။ gwave က Tailwind သုံးထားသည်။",
      ],
      [
        "@apply နဲ့ component",
        "class ထပ်နေတာ များရင် `@apply` (Tailwind) နဲ့ component class ဖန်တီးနိုင်, သို့ React component အဖြစ် ထုတ်ပြီး ပြန်သုံးနိုင်သည် — utility နဲ့ component ချဉ်းကပ်ပုံ ပေါင်းစပ်။",
      ],
    ],
  ),
  css(
    "css-custom-scrollbar",
    "Custom Scrollbar",
    "scrollbar ကို style ပြင်ဆင်ခြင်း။",
    7,
    "css custom scrollbar styling tutorial",
    '<div class="scroll"><p>အထဲမှာ scroll လုပ်ကြည့်ပါ</p><div style="height:300px"></div><p>အဆုံး</p></div>',
    ".scroll{height:120px;overflow-y:auto;border:1px solid #cbd5e1;border-radius:8px;padding:8px}\n.scroll::-webkit-scrollbar{width:8px}\n.scroll::-webkit-scrollbar-thumb{background:#22c55e;border-radius:8px}\n.scroll::-webkit-scrollbar-track{background:#f1f5f9}",
    [
      [
        "webkit scrollbar",
        "`::-webkit-scrollbar`, `::-webkit-scrollbar-thumb` (ဆွဲတဲ့ အပိုင်း), `::-webkit-scrollbar-track` (နောက်ခံ) — Chrome/Safari/Edge မှာ scrollbar ကို ကိုယ်ပိုင် style ပေးနိုင်သည်။",
        ".box::-webkit-scrollbar { width: 8px; }\n.box::-webkit-scrollbar-thumb { background: #888; }",
      ],
      [
        "standard property",
        "modern browser များအတွက် `scrollbar-width: thin` နဲ့ `scrollbar-color: thumb track` က standard နည်း — Firefox ရော ထောက်ပံ့သည်။",
        "scrollbar-width: thin;\nscrollbar-color: #22c55e #f1f5f9;",
      ],
      [
        "သတိ",
        "scrollbar ကို လုံးဝ ဖျောက်ခြင်း (`display: none`) က accessibility ဆိုးစေနိုင်သည် — content ပိုနေမှန်း အသုံးပြုသူ မသိတော့ပါ။ ပါးအောင်/လှအောင်သာ ပြင်ပါ။",
      ],
    ],
  ),
  css(
    "css-project-card",
    "Project — Product Card",
    "သင်ယူထားသမျှ ပေါင်း၍ လှပတဲ့ card ဆွဲခြင်း။",
    12,
    "css product card design tutorial",
    '<div class="pcard">\n  <div class="pcard__img">🍅</div>\n  <div class="pcard__body"><h3>Tomato</h3><p>ရက် ၈၀ · အထွက်ကောင်း</p>\n  <button class="pcard__btn">ဝယ်ရန် · ၅၀၀ Ks</button></div>\n</div>',
    ".pcard{max-width:220px;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.1);transition:transform .2s,box-shadow .2s}\n.pcard:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,.15)}\n.pcard__img{aspect-ratio:16/9;background:linear-gradient(135deg,#22c55e,#0ea5e9);display:flex;align-items:center;justify-content:center;font-size:48px}\n.pcard__body{padding:14px}\n.pcard__body h3{margin:0 0 4px}\n.pcard__body p{margin:0 0 10px;color:#64748b;font-size:13px}\n.pcard__btn{width:100%;padding:10px;border:0;border-radius:8px;background:#22c55e;color:#fff;font-weight:600;cursor:pointer}",
    [
      [
        "ပေါင်းစပ်ခြင်း",
        "ဒီ card မှာ box-shadow, border-radius + overflow:hidden, aspect-ratio, gradient, flexbox, transition (hover lift), BEM naming အားလုံး ပေါင်းသုံးထားသည် — သင်ယူထားသမျှ တစ်နေရာတည်း။",
      ],
      [
        "hover lift",
        "`transform: translateY(-4px)` + box-shadow ကြီးလာခြင်းက card ကို 'မြှောက်တက်' သလို ခံစားရစေသည် — modern UI ရဲ့ အသုံးများ effect။ transition နဲ့ ချောမွေ့စေ။",
      ],
      [
        "တိုးချဲ့ရန်",
        "grid (`repeat(auto-fill, minmax(220px, 1fr))`) နဲ့ card များ စီ, dark mode variable ထည့်, badge (clip-path) ထည့်ပြီး gwave shop ရဲ့ product grid အထိ ဆက်တည်ဆောက်နိုင်ပြီ။",
      ],
    ],
  ),
];
