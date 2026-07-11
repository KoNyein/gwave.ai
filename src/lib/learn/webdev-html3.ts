// HTML course — third batch, ~30 → 60 lessons. Modern, accessible, real-world
// HTML for Myanmar learners: metadata & SEO, media, accessible forms, ARIA,
// and a page project. Burmese reading lessons. Original content for GreenWave.

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

export const HTML_EXTRA3: Lesson[] = [
  rd("html-doctype", "DOCTYPE နဲ့ ဖွဲ့စည်းပုံ", "စာမျက်နှာတိုင်းရဲ့ အခြေခံ skeleton။", 8, [
    ["<!DOCTYPE html>", "စာမျက်နှာ အစမှာ `<!DOCTYPE html>` က browser ကို 'ဒါ HTML5 ပါ' လို့ ပြောသည်။ မထည့်ရင် browser က ဟောင်းတဲ့ mode နဲ့ ပြနိုင်သည်။"],
    ["အခြေခံ ဖွဲ့စည်းပုံ", "`<html>` ထဲမှာ `<head>` (မမြင်ရတဲ့ အချက်အလက်) နဲ့ `<body>` (မြင်ရတဲ့ အကြောင်းအရာ) ရှိသည်။"],
    ["lang", "`<html lang=\"my\">` က စာမျက်နှာရဲ့ ဘာသာစကားကို ဖော်ပြသည် — screen reader နဲ့ ဘာသာပြန်များအတွက် အရေးကြီး။"],
  ]),
  rd("html-charset", "Character Encoding", "မြန်မာစာ မှန်ကန်စွာ ပေါ်စေဖို့ charset။", 7, [
    ["UTF-8", "`<meta charset=\"UTF-8\">` က စာလုံးများ (မြန်မာ၊ တရုတ်၊ emoji) ကို မှန်ကန်စွာ ပြပေးသည်။ မထည့်ရင် စာလုံးများ ဖရိုဖရဲ ဖြစ်နိုင်သည်။"],
    ["head ထဲ ပထမဆုံး", "charset ကို `<head>` ရဲ့ အပေါ်ဆုံးမှာ ထားပါ — browser က စာဖတ်မီ encoding သိဖို့ လိုသည်။"],
    ["မြန်မာစာ", "UTF-8 က မြန်မာ Unicode ကို ပြည့်ပြည့်စုံစုံ ထောက်ပံ့သည် — Zawgyi မဟုတ်ဘဲ Unicode သုံးပါ။"],
  ]),
  rd("html-meta-seo", "Meta နဲ့ SEO", "title, description — search engine အတွက်။", 9, [
    ["title", "`<title>` က browser tab နဲ့ Google ရလဒ်မှာ ပေါ်တဲ့ ခေါင်းစဉ်။ စာမျက်နှာတိုင်း သီးခြား၊ ရှင်းလင်းတဲ့ title ထားပါ။"],
    ["description", "`<meta name=\"description\" content=\"...\">` က Google ရလဒ်အောက်က အကျဉ်းချုပ်။ လူများ နှိပ်ချင်စေမယ့် စာသား ရေးပါ။"],
    ["SEO ဆိုတာ", "Search Engine Optimization — စာမျက်နှာကို Google မှာ ပိုမြင်နိုင်အောင် ပြင်ဆင်ခြင်း။ semantic HTML နဲ့ meta က အခြေခံ။"],
  ]),
  rd("html-open-graph", "Open Graph (Social Share)", "Facebook/Messenger မှာ link မျှဝေရင် ပေါ်တဲ့ ပုံ/စာ။", 8, [
    ["og tags", "`<meta property=\"og:title\">`, `og:image`, `og:description` က social media မှာ link မျှဝေတဲ့အခါ ပေါ်မယ့် preview ကို ထိန်းချုပ်သည်။"],
    ["og:image", "မျှဝေတဲ့အခါ ပေါ်မယ့် ပုံ။ 1200×630 px အရွယ် အကြံပြုသည် — မကောင်းရင် လူ နှိပ်ချင်စိတ် လျော့သည်။"],
    ["အကျိုး", "gwave post တစ်ခုကို Messenger မှာ မျှဝေရင် လှပတဲ့ preview ပေါ်စေရန် og tags က မရှိမဖြစ်။"],
  ]),
  rd("html-favicon", "Favicon", "browser tab ရဲ့ အသေးစား icon။", 6, [
    ["favicon ဆိုတာ", "browser tab၊ bookmark မှာ ပေါ်တဲ့ အသေးစား logo။ brand ကို မှတ်မိစေသည်။"],
    ["ထည့်နည်း", "`<link rel=\"icon\" href=\"/favicon.ico\">` သို့ png/svg သုံးနိုင်သည်။ modern site များက SVG favicon ကို ကြိုက်သည်။"],
    ["အရွယ်များ", "phone home screen အတွက် `apple-touch-icon` စသဖြင့် အရွယ်များစွာ ထည့်နိုင်သည်။"],
  ]),
  rd("html-iframe", "iframe", "အခြားစာမျက်နှာ/မြေပုံ/ဗီဒီယိုကို ထည့်သွင်းခြင်း။", 8, [
    ["iframe ဆိုတာ", "`<iframe src=\"...\">` က တခြား website တစ်ခုကို ကိုယ့်စာမျက်နှာထဲ ထည့်ပြသည် — YouTube၊ Google Maps တွေ ထည့်ရာမှာ သုံးသည်။"],
    ["အသုံးများ", "`<iframe src=\"https://www.google.com/maps/embed?...\">` က မြေပုံ ထည့်သည်။ gwave GPS map မှာ ဒီနည်း သုံးထားသည်။"],
    ["လုံခြုံရေး", "မယုံကြည်ရတဲ့ site များကို iframe နဲ့ မထည့်ပါနှင့်။ `sandbox` attribute က iframe ရဲ့ ခွင့်ပြုချက်များ ကန့်သတ်ပေးသည်။"],
  ]),
  rd("html-figure", "figure နဲ့ figcaption", "ပုံနဲ့ ၎င်းရဲ့ စာတန်းကို တွဲဖော်ပြခြင်း။", 7, [
    ["အတွဲ", "`<figure>` ထဲမှာ `<img>` နဲ့ `<figcaption>` (ပုံစာ) ကို တွဲထားသည် — semantic အရ ပုံနဲ့ စာက သက်ဆိုင်ကြောင်း ဖော်ပြသည်။"],
    ["အသုံးဝင်ပုံ", "chart, ဓာတ်ပုံ, diagram တွေမှာ ရှင်းလင်းချက် ပေးရာမှာ သင့်တော်သည်။"],
    ["a11y", "figcaption က screen reader အသုံးပြုသူများကို ပုံရဲ့ အကြောင်းအရာ နားလည်စေသည်။"],
  ]),
  rd("html-details-summary", "details နဲ့ summary", "JavaScript မလိုဘဲ ဖွင့်/ပိတ် (accordion)။", 7, [
    ["details", "`<details><summary>ခေါင်းစဉ်</summary> အကြောင်းအရာ </details>` က နှိပ်ရင် ဖွင့်/ပိတ်နိုင်တဲ့ အပိုင်း ဖန်တီးသည် — JS မလို။"],
    ["FAQ", "မေးလေ့ရှိတဲ့ မေးခွန်းများ (FAQ) ကို details နဲ့ ပြရင် စာမျက်နှာ သပ်ရပ်သည်။"],
    ["open", "`<details open>` က default အားဖြင့် ဖွင့်ထားပေးသည်။"],
  ]),
  rd("html-dialog", "dialog", "modal popup ကို native အနေနဲ့ ဖန်တီးခြင်း။", 8, [
    ["dialog element", "`<dialog>` က popup/modal box ကို HTML native အနေနဲ့ ပေးသည်။ `dialog.showModal()` နဲ့ ဖွင့်၊ `dialog.close()` နဲ့ ပိတ်သည်။"],
    ["အကျိုး", "focus trap၊ Esc နဲ့ ပိတ်ခြင်း စတဲ့ accessibility feature များ built-in ပါလာသည် — ကိုယ်တိုင် ရေးစရာ မလို။"],
    ["အသုံးပြုမှု", "အတည်ပြုချက် တောင်းခြင်း၊ form popup များအတွက် သင့်တော်သည်။"],
  ]),
  rd("html-progress-meter", "progress နဲ့ meter", "တိုးတက်မှု/တိုင်းတာမှုကို ပြသခြင်း။", 7, [
    ["progress", "`<progress value=\"70\" max=\"100\">` က အလုပ်တစ်ခု ဘယ်လောက်ပြီးပြီ ပြသည် — upload, download bar များအတွက်။"],
    ["meter", "`<meter value=\"0.6\">` က တိုင်းတာထားတဲ့ တန်ဖိုး (disk usage, ရမှတ်) ကို ပြသည်။ progress နဲ့ မတူ။"],
    ["a11y", "screen reader က ဒီ element များကို အလိုအလျောက် နားလည်လို့ div နဲ့ ကိုယ်တိုင်လုပ်တာထက် ကောင်းသည်။"],
  ]),
  rd("html-datalist", "datalist", "input အတွက် အကြံပြု စာရင်း (autocomplete)။", 7, [
    ["datalist", "`<input list=\"plants\">` နဲ့ `<datalist id=\"plants\">` က ရိုက်နေစဉ် အကြံပြုချက်များ ပြပေးသည် — ရွေးလည်းရ၊ ကိုယ်တိုင်ရိုက်လည်းရ။"],
    ["dropdown နဲ့ ကွာ", "select က သတ်မှတ်ထားတာပဲ ရွေးရသည်။ datalist က အကြံပြုရုံ — အခြားစာလုံးလည်း ရိုက်နိုင်သည်။"],
    ["ဥပမာ", "အပင်အမည် ရိုက်တဲ့ input မှာ လူသုံးများတဲ့ အမည်များ ကြိုပြပေးနိုင်သည်။"],
  ]),
  rd("html-fieldset", "fieldset နဲ့ legend", "form field များကို အုပ်စုဖွဲ့ခြင်း။", 7, [
    ["fieldset", "`<fieldset>` က ဆက်စပ်တဲ့ input များကို အုပ်စုဖွဲ့ပြီး ဘောင်ခတ်ပေးသည်။ `<legend>` က အုပ်စုရဲ့ ခေါင်းစဉ်။"],
    ["အသုံးဝင်ပုံ", "'ကိုယ်ရေးအချက်အလက်'၊ 'ပို့ဆောင်လိပ်စာ' စသဖြင့် form ကို အပိုင်းလိုက် ခွဲပြရာမှာ သင့်တော်သည်။"],
    ["a11y", "radio button အုပ်စုများကို fieldset/legend နဲ့ ဖွဲ့ခြင်းက screen reader အသုံးပြုသူများကို ပိုနားလည်စေသည်။"],
  ]),
  rd("html-labels-a11y", "Label နဲ့ Accessibility", "input တိုင်းအတွက် label — အားလုံးသုံးနိုင်စေရန်။", 8, [
    ["label ချိတ်", "`<label for=\"email\">` နဲ့ `<input id=\"email\">` ကို ချိတ်ပါ — label နှိပ်ရင် input ကို focus ဖြစ်ပြီး screen reader က ဖတ်ပြသည်။"],
    ["placeholder မလုံလောက်", "placeholder က label အစား မဟုတ်ပါ — ရိုက်ထည့်လိုက်ရင် ပျောက်သွားလို့။ label ကို အမြဲ ထားပါ။"],
    ["အားလုံးအတွက်", "accessibility က မျက်မမြင်၊ လက်တုန်၊ အသက်ကြီးသူ အားလုံး သုံးနိုင်စေရန် — 'စေတနာထားပြီး' ဆောက်တဲ့ web ရဲ့ အနှစ်သာရ။"],
  ]),
  rd("html-aria", "ARIA အခြေခံ", "assistive technology အတွက် အပို အချက်အလက်။", 9, [
    ["ARIA ဆိုတာ", "Accessible Rich Internet Applications — HTML မှာ semantic မလုံလောက်တဲ့အခါ screen reader ကို အပို အချက်အလက် ပေးတဲ့ attribute များ။"],
    ["ဥပမာ", "`aria-label=\"ပိတ်ရန်\"` က icon-only button ရဲ့ အဓိပ္ပာယ်ကို screen reader အား ပြောပြသည်။ `role`, `aria-hidden` စသဖြင့် ရှိသည်။"],
    ["ပထမ semantic", "ARIA မသုံးခင် မှန်ကန်တဲ့ HTML element (button, nav) သုံးပါ — 'No ARIA is better than bad ARIA'။"],
  ]),
  rd("html-tabindex", "tabindex နဲ့ Keyboard", "keyboard နဲ့ navigate လုပ်နိုင်စေခြင်း။", 8, [
    ["tab နဲ့ ရွှေ့", "အသုံးပြုသူ အချို့က mouse မသုံးဘဲ Tab key နဲ့ element တစ်ခုမှ တစ်ခု ရွှေ့ကြသည်။ button, link, input များက default အားဖြင့် ရသည်။"],
    ["tabindex", "`tabindex=\"0\"` က element ကို tab order ထဲ ထည့်၊ `tabindex=\"-1\"` က JS နဲ့ focus လုပ်နိုင်ပေမဲ့ tab နဲ့ မရောက်စေ။"],
    ["focus ပြ", "keyboard focus ကို မြင်သာအောင် (`:focus` style) ထားပါ — မဖျောက်ပါနှင့်၊ keyboard သုံးသူ လမ်းပျောက်သွားမည်။"],
  ]),
  rd("html-picture-srcset", "picture နဲ့ srcset", "screen အလိုက် သင့်တော်တဲ့ ပုံ ပြသခြင်း။", 9, [
    ["srcset", "`<img srcset=\"small.jpg 480w, big.jpg 1200w\">` က screen အရွယ်အလိုက် သင့်တော်တဲ့ ပုံကို browser က ရွေးဆွဲသည် — data သက်သာစေသည်။"],
    ["picture", "`<picture>` က format မတူတဲ့ ပုံများ (webp, jpg) ကို ရွေးပေး၊ browser ထောက်ပံ့တာကို သုံးသည်။"],
    ["အကျိုး", "mobile data နည်းတဲ့ မြန်မာအသုံးပြုသူများအတွက် ပုံ အရွယ် သင့်တော်စွာ ပေးခြင်းက အရေးကြီး။"],
  ]),
  rd("html-lazy-loading", "Lazy Loading", "မမြင်ရသေးတဲ့ ပုံများကို နောက်မှ load ခြင်း။", 7, [
    ["loading=lazy", "`<img loading=\"lazy\">` က ပုံကို screen အနီးရောက်မှသာ load လုပ်စေသည် — စာမျက်နှာ ပိုမြန်ဖွင့်၊ data သက်သာ။"],
    ["ဘယ်အခါသုံး", "အောက်ဘက် အဝေးက ပုံများ (feed, gallery) အတွက် သင့်တော်သည်။ ထိပ်ဆုံး ပုံကို lazy မလုပ်ပါနှင့်။"],
    ["gwave", "feed နဲ့ profile ဓာတ်ပုံ grid များမှာ lazy loading သုံးထားလို့ scroll ချရင် data သက်သာသည်။"],
  ]),
  rd("html-table-accessibility", "Table ကို အားလုံးသုံးနိုင်စေခြင်း", "thead, tbody, caption, scope။", 8, [
    ["ဖွဲ့စည်းပုံ", "`<caption>` (ဇယားခေါင်းစဉ်)၊ `<thead>`/`<tbody>` (ခေါင်း/ကိုယ်)၊ `<th scope=\"col\">` က ဇယားကို semantic ဖြစ်စေသည်။"],
    ["scope", "`scope=\"col\"`/`scope=\"row\"` က ဘယ် header က ဘယ် cell နဲ့ သက်ဆိုင်လဲ ပြောပြသည် — screen reader အတွက် အရေးကြီး။"],
    ["layout မလုပ်ပါနှင့်", "table ကို data အတွက်သာ သုံးပါ — စာမျက်နှာ layout အတွက် CSS grid/flexbox သုံးပါ။"],
  ]),
  rd("html-form-validation", "Form Validation Attributes", "required, pattern, min/max — browser စစ်ဆေးမှု။", 9, [
    ["required", "`<input required>` က ဖြည့်မထားရင် submit မဖြစ်စေ။ browser က အလိုအလျောက် သတိပေးသည် — JS မလို။"],
    ["pattern & type", "`type=\"email\"` က email format စစ်၊ `pattern=\"[0-9]{6,}\"` က ကိုယ်ပိုင် pattern စစ်သည်။ `min`/`max` က ဂဏန်း အပိုင်းအခြား။"],
    ["အားသာချက်", "browser validation က မြန်ဆန်ပြီး လွယ်ကူ။ ဒါပေမဲ့ server မှာလည်း ထပ်စစ်ရမည် — client စစ်ဆေးမှုကို ကျော်လို့ရသည်။"],
  ]),
  rd("html-autocomplete", "autocomplete Attribute", "form ဖြည့်ခြင်းကို မြန်ဆန်စေခြင်း။", 6, [
    ["autocomplete", "`autocomplete=\"email\"`, `\"name\"`, `\"tel\"` က browser ကို ဒီ field ဘာလဲ ပြောပြပြီး သိမ်းထားတဲ့ အချက်အလက်နဲ့ ဖြည့်ပေးစေသည်။"],
    ["password", "`autocomplete=\"new-password\"` က password manager ကို password အသစ် အကြံပြုစေသည်။"],
    ["အကျိုး", "form ဖြည့်ချိန် လျော့၊ အမှားနည်း — mobile အသုံးပြုသူများအတွက် အထူးအသုံးဝင်။"],
  ]),
  rd("html-data-attributes", "data-* Attributes", "element မှာ ကိုယ်ပိုင် data တွဲထားခြင်း။", 7, [
    ["data-*", "`<button data-id=\"42\">` က ကိုယ်ပိုင် data ကို element မှာ တွဲထားနိုင်သည်။ JS မှာ `button.dataset.id` နဲ့ ဖတ်သည်။"],
    ["အသုံးဝင်ပုံ", "list item တစ်ခုစီရဲ့ id ကို data-id မှာ ထားပြီး click event မှာ ဘယ် item လဲ သိနိုင်သည်။"],
    ["သတိ", "data-* က UI state အတွက် သင့်တော်ပေမဲ့ လုံခြုံရေး အရေးကြီးတဲ့ data (password) ကို မထားပါနှင့် — user မြင်နိုင်သည်။"],
  ]),
  rd("html-template-tag", "template Element", "ပြန်သုံးမယ့် HTML ကို ကြိုသိမ်းထားခြင်း။", 7, [
    ["template", "`<template>` ထဲက HTML က default အားဖြင့် မပေါ်။ JS နဲ့ clone လုပ်ပြီးမှ ထည့်သည် — list item များ ထပ်ခါထပ်ခါ ဖန်တီးရာမှာ သုံးသည်။"],
    ["clone", "`template.content.cloneNode(true)` က အထဲက HTML ကို ကူးယူပေးသည်။"],
    ["အကျိုး", "innerHTML string တွဲတာထက် သန့်ရှင်း၊ လုံခြုံပြီး performance ကောင်းသည်။"],
  ]),
  rd("html-svg-inline", "Inline SVG", "vector ပုံ/icon ကို တိုက်ရိုက် ထည့်ခြင်း။", 8, [
    ["SVG ဆိုတာ", "Scalable Vector Graphics — ချဲ့လည်း မဝိုးဝါးတဲ့ ပုံ။ icon, logo, chart များအတွက် အကောင်းဆုံး။"],
    ["inline", "`<svg>...<path d=\"...\"/></svg>` ကို HTML ထဲ တိုက်ရိုက် ထည့်ရင် CSS/JS နဲ့ အရောင်ပြောင်း၊ animate လုပ်နိုင်သည်။"],
    ["အကျိုး", "SVG က ဖိုင်အရွယ် သေးပြီး ဘယ်လို screen မှာမဆို ကြည်လင်သည် — retina screen တွေမှာပါ။"],
  ]),
  rd("html-canvas-tag", "canvas Element", "JavaScript နဲ့ ပုံ/ဂရပ် ဆွဲစရာ နေရာ။", 7, [
    ["canvas", "`<canvas>` က ဗလာ 'ကင်းဗတ်စ်' — JavaScript နဲ့ ပုံ၊ chart၊ ဂိမ်း ဆွဲသည်။"],
    ["width/height", "`<canvas width=\"400\" height=\"300\">` — CSS နဲ့ အရွယ်ချဲ့ရင် ပုံဝိုးဝါးလို့ attribute နဲ့ သတ်မှတ်ပါ။"],
    ["SVG နဲ့ ကွာ", "SVG က vector (element-based)၊ canvas က pixel (bitmap)။ animation များ၊ ဂိမ်းအတွက် canvas သင့်တော်သည်။"],
  ]),
  rd("html-script-loading", "script — defer နဲ့ async", "JavaScript ကို ဘယ်အချိန် load လုပ်မလဲ။", 8, [
    ["ပြဿနာ", "`<script>` ကို head ထဲ ရိုးရိုးထည့်ရင် HTML ဖတ်တာ ရပ်ပြီး script ကို စောင့်သည် — စာမျက်နှာ နှေးစေသည်။"],
    ["defer", "`<script defer>` က HTML အကုန်ဖတ်ပြီးမှ run သည် — အစီအစဉ်လည်း ကျန်။ များသောအားဖြင့် ဒါ အကောင်းဆုံး။"],
    ["async", "`<script async>` က load ပြီးတာနဲ့ ချက်ချင်း run — အခြား script နဲ့ မဆက်စပ်တဲ့ analytics တွေအတွက် သင့်တော်သည်။"],
  ]),
  rd("html-noscript", "noscript နဲ့ Progressive Enhancement", "JavaScript မရှိတဲ့အခါ ကိုင်တွယ်ခြင်း။", 6, [
    ["noscript", "`<noscript>JS ဖွင့်ပါ</noscript>` က JavaScript ပိတ်ထားတဲ့ browser မှာသာ ပေါ်တဲ့ အကြောင်းအရာ။"],
    ["progressive enhancement", "အခြေခံ content ကို HTML နဲ့ အရင်လုပ်၊ JS က အပို feature ထည့်ပေးရုံ — JS မ run လည်း အခြေခံ အလုပ်လုပ်စေရန်။"],
    ["အကျိုး", "network ညံ့တဲ့ နေရာများ၊ browser အဟောင်းများမှာပါ အသုံးပြုသူ အခြေခံ လုပ်ဆောင်နိုင်စေသည်။"],
  ]),
  rd("html-base-link-rel", "base နဲ့ link rel", "URL အခြေခံနဲ့ ပြင်ပ resource ချိတ်ခြင်း။", 7, [
    ["link rel", "`<link rel=\"stylesheet\" href=\"style.css\">` က CSS ချိတ်၊ `rel=\"preconnect\"`/`\"preload\"` က resource များ ကြိုပြင်ဆင်ပေးသည်။"],
    ["canonical", "`<link rel=\"canonical\">` က တူညီတဲ့ content အတွက် မူရင်း URL ကို search engine အား ပြောပြသည် — SEO အတွက်။"],
    ["base", "`<base href=\"...\">` က စာမျက်နှာက relative link အားလုံးရဲ့ အခြေခံ URL ကို သတ်မှတ်သည် — သတိနဲ့ သုံးပါ။"],
  ]),
  rd("html-accessibility", "Accessibility ခြုံငုံ", "အားလုံးသုံးနိုင်တဲ့ web ဆောက်ခြင်း။", 9, [
    ["ဘာကြောင့်", "မျက်မမြင်၊ အကြားအာရုံချို့တဲ့၊ လက်လှုပ်ရှားမှု ခက်ခဲသူ အားလုံး web ကို သုံးနိုင်ခွင့် ရှိသင့်သည် — ဒါက တန်းတူညီမျှမှု။"],
    ["အခြေခံ ၄ ချက်", "semantic HTML သုံး၊ ပုံတိုင်း alt ထည့်၊ label ချိတ်၊ အရောင် ကွာဟမှု (contrast) လုံလောက်စေ။"],
    ["စမ်းသပ်", "keyboard တစ်ခုတည်းနဲ့ စာမျက်နှာ တစ်ခုလုံး သုံးကြည့်ပါ — မရရင် ပြင်စရာ ရှိသည်။"],
  ]),
  rd("html-project-page", "Project — Landing Page", "သင်ယူထားသမျှ ပေါင်း၍ စာမျက်နှာ တစ်ခု ဆောက်ခြင်း။", 12, [
    ["အစီအစဉ်", "header (nav)၊ hero (ခေါင်းစဉ်+ပုံ)၊ feature အပိုင်း၊ contact form၊ footer — semantic element များနဲ့ ဖွဲ့ပါ။"],
    ["semantic + a11y", "`<header>`, `<main>`, `<section>`, `<footer>` သုံး၊ ပုံတိုင်း alt၊ input တိုင်း label ထည့်ပါ။"],
    ["meta ပြည့်စုံ", "title, description, og tags, favicon, viewport ထည့်ပြီး social share နဲ့ SEO အဆင်သင့် ဖြစ်စေပါ။ ဒါဆို CSS သင်တန်းနဲ့ ဆက်၍ လှအောင် ပြင်နိုင်ပြီ။"],
  ]),
];
