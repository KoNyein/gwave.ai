// HTML course — third batch (30 → 60), full quality: every lesson is a runnable
// playground (kind "code" — the HTML renders live), has a YouTube video hint,
// and Burmese explanations with a real code sample in each section. Original
// content for GreenWave. Pure data.

import type { Lesson } from "@/lib/learn/lessons";

const BASE_CSS =
  "body{font-family:sans-serif;padding:1.25rem;line-height:1.6;color:#222}";

/** Build a runnable HTML lesson — the `play` markup renders in the preview. */
function html(
  slug: string,
  title: string,
  summary: string,
  minutes: number,
  youtubeQuery: string,
  play: string,
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
    code: { html: play, css: BASE_CSS, js: "" },
  };
}

export const HTML_EXTRA3: Lesson[] = [
  html(
    "html-doctype",
    "DOCTYPE နဲ့ ဖွဲ့စည်းပုံ",
    "စာမျက်နှာတိုင်းရဲ့ အခြေခံ skeleton။",
    9,
    "html document structure doctype tutorial",
    "<h1>ကျွန်ုပ်၏ စာမျက်နှာ</h1>\n<p>ဒါက body ထဲက အကြောင်းအရာ။ DOCTYPE, html, head, body\nဆိုတဲ့ ဖွဲ့စည်းပုံ အပြည့်အစုံကို editor မှာ ကြည့်ပါ။</p>",
    [
      [
        "<!DOCTYPE html>",
        "စာမျက်နှာ အစဆုံးမှာ `<!DOCTYPE html>` က browser ကို 'ဒါ HTML5 ပါ' လို့ ပြောသည်။ မထည့်ရင် browser က ဟောင်းတဲ့ 'quirks mode' နဲ့ ပြပြီး layout မှားနိုင်သည်။",
        "<!DOCTYPE html>",
      ],
      [
        "html · head · body",
        "`<html>` က အမြစ်။ အထဲမှာ `<head>` (title, meta — မမြင်ရ) နဲ့ `<body>` (မြင်ရတဲ့ အကြောင်းအရာ) ရှိသည်။ ဒီ ဖွဲ့စည်းပုံက စာမျက်နှာတိုင်းမှာ တူသည်။",
        "<html>\n  <head><title>...</title></head>\n  <body>...</body>\n</html>",
      ],
      [
        "lang attribute",
        "`<html lang=\"my\">` က စာမျက်နှာရဲ့ ဘာသာစကားကို ဖော်ပြသည် — screen reader ရဲ့ အသံထွက်၊ browser ရဲ့ ဘာသာပြန်ကမ်းလှမ်းချက်အတွက် အရေးကြီးသည်။",
        '<html lang="my">',
      ],
    ],
  ),
  html(
    "html-charset",
    "Character Encoding",
    "မြန်မာစာ မှန်ကန်စွာ ပေါ်စေဖို့ charset။",
    8,
    "html charset utf-8 meta tag",
    "<h2>မြန်မာစာ 🇲🇲</h2>\n<p>UTF-8 ကြောင့် မြန်မာစာနဲ့ emoji တွေ မှန်ကန်စွာ ပေါ်သည်။</p>",
    [
      [
        "UTF-8",
        "`<meta charset=\"UTF-8\">` က browser ကို စာလုံးများ (မြန်မာ, တရုတ်, emoji) ဘယ်လို ဖတ်ရမလဲ ပြောသည်။ မထည့်ရင် စာလုံးများ ရွေ့ရွေ့ဖရိုဖရဲ (mojibake) ဖြစ်နိုင်သည်။",
        '<meta charset="UTF-8">',
      ],
      [
        "head ရဲ့ ထိပ်",
        "charset ကို `<head>` ရဲ့ အပေါ်ဆုံး ၁၀၂၄ bytes အတွင်း ထားပါ — browser က စာဖတ်မီ encoding ကို အရင် သိဖို့ လိုသည်။",
      ],
      [
        "Unicode သုံးပါ",
        "UTF-8 က မြန်မာ Unicode ကို ပြည့်စုံစွာ ထောက်ပံ့သည်။ Zawgyi (ဟောင်း, စံမဲ့) မဟုတ်ဘဲ Unicode သုံးမှ device အားလုံးမှာ မှန်ကန်စွာ ပေါ်သည်။",
      ],
    ],
  ),
  html(
    "html-meta-seo",
    "Meta နဲ့ SEO",
    "title, description — search engine အတွက်။",
    9,
    "html meta tags seo title description",
    "<h1>GreenWave Farm</h1>\n<p>title နဲ့ description က Google ရလဒ်မှာ ပေါ်မယ့်\nအရာ — editor ရဲ့ head ထဲ ကြည့်ပါ (preview မှာ မမြင်ရ)။</p>",
    [
      [
        "title",
        "`<title>` က browser tab နဲ့ Google ရလဒ်ရဲ့ ခေါင်းစဉ် (အပြာရောင် စာ)။ စာမျက်နှာတိုင်းကို သီးခြား၊ ရှင်းလင်းတဲ့ title ပေးပါ — SEO ရဲ့ အရေးအကြီးဆုံး element။",
        "<title>GreenWave — Smart Farming</title>",
      ],
      [
        "meta description",
        "`<meta name=\"description\" content=\"...\">` က Google ရလဒ်အောက်က အကျဉ်းချုပ် စာသား။ ~155 လုံး၊ လူများ နှိပ်ချင်စေမယ့် စာ ရေးပါ။",
        '<meta name="description" content="မြန်မာတောင်သူများအတွက် smart farming platform">',
      ],
      [
        "SEO ဆိုတာ",
        "Search Engine Optimization — စာမျက်နှာကို Google မှာ ပိုမြင်နိုင်အောင် ပြင်ဆင်ခြင်း။ semantic HTML, ရှင်းလင်းတဲ့ title/description, မြန်ဆန်မှု, mobile-friendly က အခြေခံ။",
      ],
    ],
  ),
  html(
    "html-open-graph",
    "Open Graph (Social Share)",
    "Facebook/Messenger မှာ link မျှဝေရင် ပေါ်တဲ့ ပုံ/စာ။",
    8,
    "html open graph meta tags facebook",
    "<h2>Link Preview</h2>\n<p>og:title, og:image, og:description က social media မှာ\nlink မျှဝေတဲ့အခါ ပေါ်မယ့် card ကို ထိန်းချုပ်သည်။</p>",
    [
      [
        "og tags",
        "`<meta property=\"og:title\">`, `og:image`, `og:description`, `og:url` က Facebook/Messenger/Viber မှာ link မျှဝေတဲ့အခါ ပေါ်မယ့် preview ကို သတ်မှတ်သည်။",
        '<meta property="og:title" content="GreenWave Farm">\n<meta property="og:image" content="https://.../cover.jpg">',
      ],
      [
        "og:image",
        "မျှဝေချိန် ပေါ်မယ့် ပုံ — 1200×630 px အကြံပြုသည်။ ကောင်းတဲ့ ပုံက နှိပ်ချင်စိတ်ကို များစွာ တိုးစေသည်။",
      ],
      [
        "အကျိုး",
        "gwave post တစ်ခုကို Messenger မှာ မျှဝေရင် ခေါင်းစဉ်+ပုံ+အကျဉ်းချုပ် လှလှပပ ပေါ်စေဖို့ og tags က မရှိမဖြစ်။ Twitter Card (`twitter:*`) လည်း ဆင်တူ ရှိသည်။",
      ],
    ],
  ),
  html(
    "html-favicon",
    "Favicon",
    "browser tab ရဲ့ အသေးစား icon။",
    6,
    "html favicon tutorial",
    "<h2>🌱 GreenWave</h2>\n<p>Favicon က browser tab, bookmark မှာ ပေါ်တဲ့ logo lေး။\nhead ထဲ link rel=icon နဲ့ ထည့်သည်။</p>",
    [
      [
        "favicon ဆိုတာ",
        "browser tab, bookmark, history မှာ ပေါ်တဲ့ အသေးစား logo (16×16 / 32×32)။ brand ကို မှတ်မိစေ၊ tab များစွာထဲက ကိုယ့်site ကို လွယ်လွယ် ရှာစေသည်။",
        '<link rel="icon" href="/favicon.svg">',
      ],
      [
        "format",
        "`.ico`, `.png`, `.svg` သုံးနိုင်သည်။ modern site များက SVG favicon ကို ကြိုက်သည် (အရွယ်တိုင်း ကြည်လင်)။ phone home screen အတွက် `apple-touch-icon` (180×180) ထည့်ပါ။",
        '<link rel="apple-touch-icon" href="/icon-180.png">',
      ],
      [
        "PWA",
        "gwave က installable PWA — manifest ထဲက icon များက home screen မှာ ပေါ်သည်။ favicon နဲ့ app icon က brand ရဲ့ မျက်နှာ။",
      ],
    ],
  ),
  html(
    "html-iframe",
    "iframe",
    "အခြားစာမျက်နှာ/မြေပုံ/ဗီဒီယိုကို ထည့်သွင်းခြင်း။",
    8,
    "html iframe tutorial",
    '<h2>Embedded content</h2>\n<iframe title="demo" srcdoc="<p style=\'font-family:sans-serif\'>ဒါက iframe အတွင်းက စာမျက်နှာ</p>" width="100%" height="80"></iframe>',
    [
      [
        "iframe ဆိုတာ",
        "`<iframe src=\"...\">` က တခြား website/document တစ်ခုကို ကိုယ့်စာမျက်နှာထဲ 'ဘောင်' အဖြစ် ထည့်ပြသည် — YouTube video, Google Maps, payment form တွေ ထည့်ရာမှာ သုံးသည်။",
        '<iframe src="https://www.youtube.com/embed/ID"></iframe>',
      ],
      [
        "Google Maps",
        "`<iframe src=\"https://www.google.com/maps/embed?...\">` က မြေပုံ ထည့်သည်။ gwave ရဲ့ GPS map feature မှာ ဒီနည်း သုံးထားသည် — API key နဲ့။",
      ],
      [
        "လုံခြုံရေး",
        "မယုံကြည်ရတဲ့ site များကို iframe နဲ့ မထည့်ပါနှင့်။ `sandbox` attribute က iframe ရဲ့ ခွင့်ပြုချက် (script, form) များ ကန့်သတ်၊ `allow` က camera/mic စတာတွေ ခွင့်ပြုသည်။",
        '<iframe sandbox="allow-scripts" src="..."></iframe>',
      ],
    ],
  ),
  html(
    "html-figure",
    "figure နဲ့ figcaption",
    "ပုံနဲ့ ၎င်းရဲ့ စာတန်းကို တွဲဖော်ပြခြင်း။",
    7,
    "html figure figcaption element",
    "<figure>\n  <img src=\"https://placehold.co/300x140?text=Tomato\" alt=\"ခရမ်းချဉ်ပင်\" style=\"max-width:100%\">\n  <figcaption>ပုံ ၁ — ရက် ၈၀ သား ခရမ်းချဉ်ပင်</figcaption>\n</figure>",
    [
      [
        "အတွဲ",
        "`<figure>` ထဲမှာ `<img>` (သို့ chart, code, table) နဲ့ `<figcaption>` (ပုံစာ) ကို တွဲထားသည် — semantic အရ 'ဒီပုံနဲ့ ဒီစာ သက်ဆိုင်' ကြောင်း ဖော်ပြသည်။",
        "<figure>\n  <img src=\"soil.jpg\" alt=\"...\">\n  <figcaption>မြေဆီလွှာ စစ်ဆေးမှု</figcaption>\n</figure>",
      ],
      [
        "အသုံးဝင်ပုံ",
        "chart, ဓာတ်ပုံ, diagram, ကိုးကားချက်တွေမှာ ရှင်းလင်းချက် ပေးရာမှာ သင့်တော်သည်။ figure က block element — စာကြောင်းကြားထဲ မဟုတ်ဘဲ သီးခြား ရပ်တည်သည်။",
      ],
      [
        "a11y",
        "figcaption က screen reader အသုံးပြုသူများကို ပုံရဲ့ ဆက်စပ်အကြောင်းအရာ နားလည်စေသည်။ `alt` (ပုံ ဘာလဲ) နဲ့ figcaption (ဆက်စပ်ရှင်းလင်းချက်) က မတူ — နှစ်ခုလုံး အသုံးဝင်။",
      ],
    ],
  ),
  html(
    "html-details-summary",
    "details နဲ့ summary",
    "JavaScript မလိုဘဲ ဖွင့်/ပိတ် (accordion)။",
    7,
    "html details summary accordion",
    "<h2>FAQ</h2>\n<details>\n  <summary>ရေ ဘယ်နှစ်ကြိမ် လောင်းရမလဲ?</summary>\n  <p>နေ့စဉ် မနက်တစ်ကြိမ်၊ ပူတဲ့ရက် ညနေ ထပ်ဆင့်။</p>\n</details>\n<details open>\n  <summary>အလင်း ဘယ်လောက် လိုလဲ?</summary>\n  <p>နေ့စဉ် ၆ နာရီအထက်။</p>\n</details>",
    [
      [
        "details / summary",
        "`<details>` ထဲ `<summary>` (မြင်နေရတဲ့ ခေါင်းစဉ်) ထည့်၊ ကျန်တာက ဖွက်ထားပြီး summary ကို နှိပ်မှ ပေါ်သည် — accordion/dropdown ကို **JavaScript မလိုဘဲ** ရသည်။",
        "<details>\n  <summary>ဖတ်ရန် နှိပ်ပါ</summary>\n  <p>ဖွက်ထားတဲ့ အကြောင်းအရာ</p>\n</details>",
      ],
      [
        "FAQ",
        "မေးလေ့ရှိတဲ့ မေးခွန်းများ (FAQ) ကို details နဲ့ ပြရင် စာမျက်နှာ သပ်ရပ်ပြီး လိုတာ ရွေးဖတ်နိုင်သည်။",
      ],
      [
        "open",
        "`<details open>` က default အားဖြင့် ဖွင့်ထားပေးသည်။ `toggle` event နဲ့ ဖွင့်/ပိတ်ကို JS မှာ ဖမ်းနိုင်သည်။",
      ],
    ],
  ),
  html(
    "html-dialog",
    "dialog",
    "modal popup ကို native အနေနဲ့ ဖန်တီးခြင်း။",
    8,
    "html dialog element modal",
    "<h2>Native dialog</h2>\n<p>&lt;dialog&gt; က popup/modal ကို HTML native အနေနဲ့ ပေးသည်။\ndialog.showModal() နဲ့ ဖွင့်၊ close() နဲ့ ပိတ်။</p>",
    [
      [
        "dialog element",
        "`<dialog>` က popup/modal box ကို HTML native အနေနဲ့ ပေးသည်။ JavaScript မှာ `dlg.showModal()` က ဖွင့် (background ကို မှိန်)၊ `dlg.close()` က ပိတ်သည်။",
        '<dialog id="d"><p>Hello</p></dialog>\n<script>d.showModal()</script>',
      ],
      [
        "built-in a11y",
        "dialog က focus trap (Tab က dialog အတွင်းသာ)၊ Esc နဲ့ ပိတ်ခြင်း၊ backdrop စတဲ့ accessibility feature များ built-in ပါလာသည် — div နဲ့ ကိုယ်တိုင် ရေးစရာ မလိုတော့ပါ။",
      ],
      [
        "အသုံးပြုမှု",
        "အတည်ပြုချက် တောင်းခြင်း (ဖျက်မလား?), form popup, alert များအတွက် သင့်တော်သည်။ `::backdrop` pseudo-element နဲ့ နောက်ခံ style ပြင်နိုင်သည်။",
      ],
    ],
  ),
  html(
    "html-progress-meter",
    "progress နဲ့ meter",
    "တိုးတက်မှု/တိုင်းတာမှုကို ပြသခြင်း။",
    7,
    "html progress meter element",
    "<p>Upload: <progress value=\"70\" max=\"100\">70%</progress></p>\n<p>မြေဆီ စိုထိုင်း: <meter value=\"0.4\" min=\"0\" max=\"1\">40%</meter></p>",
    [
      [
        "progress",
        "`<progress value=\"70\" max=\"100\">` က အလုပ်တစ်ခု ဘယ်လောက်ပြီးပြီ ပြသည် — upload, download, lesson completion bar များအတွက်။ value မထည့်ရင် 'loading...' (indeterminate) ဖြစ်သည်။",
        '<progress value="3" max="10"></progress>',
      ],
      [
        "meter",
        "`<meter value=\"0.4\">` က သတ်မှတ်ထားတဲ့ အပိုင်းအခြားအတွင်း တိုင်းတာထားတဲ့ တန်ဖိုး (disk usage, ရမှတ်, စိုထိုင်းဆ) ကို ပြသည်။ progress နဲ့ မတူ — 'တိုးတက်မှု' မဟုတ်ဘဲ 'တိုင်းတာချက်'။",
        '<meter value="7" min="0" max="10" low="3" high="8"></meter>',
      ],
      [
        "a11y",
        "screen reader က ဒီ element များကို အလိုအလျောက် 'X ရာခိုင်နှုန်း' လို ဖတ်ပြသည် — div နဲ့ ကိုယ်တိုင် bar လုပ်တာထက် ကောင်းသည်။",
      ],
    ],
  ),
  html(
    "html-datalist",
    "datalist",
    "input အတွက် အကြံပြု စာရင်း (autocomplete)။",
    7,
    "html datalist autocomplete input",
    '<label>အပင်: <input list="plants" placeholder="ရိုက်ကြည့်ပါ"></label>\n<datalist id="plants">\n  <option value="Tomato"><option value="Chili"><option value="Mint">\n</datalist>',
    [
      [
        "datalist",
        "`<input list=\"plants\">` ကို `<datalist id=\"plants\">` နဲ့ ချိတ်ရင် ရိုက်နေစဉ် အကြံပြုချက်များ ပေါ်လာသည် — ရွေးလည်းရ၊ ကိုယ်ပိုင် ရိုက်လည်းရ။",
        '<input list="opts">\n<datalist id="opts"><option value="A"></datalist>',
      ],
      [
        "select နဲ့ ကွာ",
        "`<select>` က သတ်မှတ်ထားတာပဲ ရွေးရသည် (တင်းကျပ်)။ datalist က အကြံပြုရုံ — အခြားစာလုံးလည်း ရိုက်နိုင် (ပြောင်းလွယ်)။",
      ],
      [
        "ဥပမာ",
        "အပင်အမည်, မြို့နာမည် ရိုက်တဲ့ input မှာ လူသုံးများတဲ့ ရွေးချယ်စရာများ ကြိုပြပေး၍ မှားရိုက်မှု လျော့စေနိုင်သည်။",
      ],
    ],
  ),
  html(
    "html-fieldset",
    "fieldset နဲ့ legend",
    "form field များကို အုပ်စုဖွဲ့ခြင်း။",
    7,
    "html fieldset legend form",
    "<form>\n  <fieldset>\n    <legend>ကိုယ်ရေးအချက်အလက်</legend>\n    <label>အမည်: <input></label><br>\n    <label>ဖုန်း: <input></label>\n  </fieldset>\n</form>",
    [
      [
        "fieldset",
        "`<fieldset>` က ဆက်စပ်တဲ့ input များကို အုပ်စုဖွဲ့ပြီး ဘောင်ခတ်ပေးသည်။ `<legend>` က အုပ်စုရဲ့ ခေါင်းစဉ် (ဘောင်အပေါ်မှာ ပေါ်)။",
        "<fieldset>\n  <legend>လိပ်စာ</legend>\n  ...inputs...\n</fieldset>",
      ],
      [
        "အသုံးဝင်ပုံ",
        "'ကိုယ်ရေးအချက်အလက်', 'ပို့ဆောင်လိပ်စာ', 'ငွေပေးချေမှု' စသဖြင့် ရှည်လျားတဲ့ form ကို အပိုင်းလိုက် ခွဲပြရာမှာ သင့်တော်သည်။",
      ],
      [
        "a11y",
        "radio button အုပ်စု (ဥပမာ 'ကျား/မ') ကို fieldset/legend နဲ့ ဖွဲ့ခြင်းက screen reader အသုံးပြုသူများကို 'ဘယ်အုပ်စုအတွက် ရွေးနေတာလဲ' ပိုနားလည်စေသည်။",
      ],
    ],
  ),
  html(
    "html-labels-a11y",
    "Label နဲ့ Accessibility",
    "input တိုင်းအတွက် label — အားလုံးသုံးနိုင်စေရန်။",
    8,
    "html label accessibility forms",
    '<label for="email">အီးမေးလ်</label>\n<input id="email" type="email"><br><br>\n<input type="checkbox" id="ok">\n<label for="ok">သဘောတူပါသည်</label>',
    [
      [
        "label ချိတ်နည်း",
        "`<label for=\"email\">` ကို `<input id=\"email\">` နဲ့ ချိတ်ပါ — label နှိပ်ရင် input ကို focus ဖြစ်ပြီး (နှိပ်ရ လွယ်), screen reader က input ရဲ့ အဓိပ္ပာယ်ကို ဖတ်ပြသည်။",
        '<label for="qty">အရေအတွက်</label>\n<input id="qty" type="number">',
      ],
      [
        "placeholder ≠ label",
        "placeholder က label အစား **မဟုတ်**ပါ — ရိုက်ထည့်လိုက်ရင် ပျောက်သွားလို့ 'ဘာ field လဲ' မေ့သွားနိုင်သည်။ label ကို အမြဲ ထားပါ။",
      ],
      [
        "အားလုံးအတွက်",
        "accessibility က မျက်မမြင်, လက်တုန်, အသက်ကြီးသူ အားလုံး သုံးနိုင်စေရန် — 'မြန်မာလူမျိုးများအတွက် စေတနာထားပြီး' ဆောက်တဲ့ web ရဲ့ အနှစ်သာရ။ label က ဒါရဲ့ အခြေခံ။",
      ],
    ],
  ),
  html(
    "html-aria",
    "ARIA အခြေခံ",
    "assistive technology အတွက် အပို အချက်အလက်။",
    9,
    "html aria accessibility tutorial",
    '<button aria-label="ပိတ်ရန်">✕</button>\n<span role="status">သိမ်းပြီးပါပြီ</span>',
    [
      [
        "ARIA ဆိုတာ",
        "Accessible Rich Internet Applications — HTML ရဲ့ semantic မလုံလောက်တဲ့အခါ screen reader ကို အပို အချက်အလက် ပေးတဲ့ attribute အစု (`aria-*`, `role`)။",
        '<div role="button" tabindex="0">Click</div>',
      ],
      [
        "aria-label",
        "`aria-label=\"ပိတ်ရန်\"` က icon-only button (✕) ရဲ့ အဓိပ္ပာယ်ကို screen reader အား ပြောပြသည်။ `aria-hidden=\"true\"` က decorative element ကို ဖတ်စရာမလို လို့ ဖုံးသည်။",
        '<button aria-label="Search"><svg>...</svg></button>',
      ],
      [
        "ပထမ semantic",
        "ARIA မသုံးခင် မှန်ကန်တဲ့ HTML element (`<button>`, `<nav>`, `<main>`) ကို အရင် သုံးပါ — အဲဒါတွေမှာ accessibility built-in ပါပြီးသား။ 'No ARIA is better than bad ARIA'။",
      ],
    ],
  ),
  html(
    "html-tabindex",
    "tabindex နဲ့ Keyboard",
    "keyboard နဲ့ navigate လုပ်နိုင်စေခြင်း။",
    8,
    "html tabindex keyboard navigation",
    "<p>Tab key နဲ့ ဒီ element တွေကြား ရွှေ့ကြည့်ပါ:</p>\n<a href=\"#\">Link</a>\n<button>Button</button>\n<input placeholder=\"Input\">",
    [
      [
        "tab order",
        "အသုံးပြုသူ အချို့က mouse မသုံးဘဲ Tab key နဲ့ element တစ်ခုမှ တစ်ခု ရွှေ့ကြသည်။ `<a>`, `<button>`, `<input>` များက default အားဖြင့် ဒီ tab order ထဲ ပါသည်။",
      ],
      [
        "tabindex",
        "`tabindex=\"0\"` က မူလ မပါတဲ့ element (div) ကို tab order ထဲ ထည့်၊ `tabindex=\"-1\"` က JS နဲ့ focus လုပ်နိုင်ပေမဲ့ Tab နဲ့ မရောက်စေ။ `tabindex=\"1\"` အထက် (positive) ကို ရှောင်ပါ — order ရှုပ်စေသည်။",
        '<div tabindex="0" role="button">Custom</div>',
      ],
      [
        "focus ကို မြင်သာစေ",
        "keyboard focus ကို မြင်သာအောင် `:focus` / `:focus-visible` style ထားပါ — outline ကို မဖျောက်ပါနှင့်၊ ဖျောက်ရင် keyboard သုံးသူ 'ဘယ်ရောက်နေမှန်း' မသိတော့ပါ။",
      ],
    ],
  ),
  html(
    "html-picture-srcset",
    "picture နဲ့ srcset",
    "screen အလိုက် သင့်တော်တဲ့ ပုံ ပြသခြင်း။",
    9,
    "html picture srcset responsive images",
    '<img\n  srcset="https://placehold.co/300 300w, https://placehold.co/800 800w"\n  sizes="(max-width: 500px) 300px, 800px"\n  src="https://placehold.co/800" alt="responsive" style="max-width:100%">',
    [
      [
        "srcset",
        "`<img srcset=\"small.jpg 480w, big.jpg 1200w\" sizes=\"...\">` က screen အရွယ်/resolution အလိုက် သင့်တော်တဲ့ ပုံကို browser က ရွေးဆွဲသည် — mobile မှာ သေးတဲ့ပုံ ဆွဲလို့ data သက်သာ။",
        '<img srcset="s.jpg 480w, l.jpg 1200w" src="l.jpg" alt="...">',
      ],
      [
        "picture element",
        "`<picture>` က format/အခြေအနေ မတူတဲ့ ပုံများ (webp vs jpg, dark vs light) ကို `<source>` နဲ့ ပေးပြီး browser ထောက်ပံ့တာကို ရွေးသုံးသည်။",
        '<picture>\n  <source srcset="img.webp" type="image/webp">\n  <img src="img.jpg" alt="...">\n</picture>',
      ],
      [
        "အကျိုး",
        "mobile data နည်းတဲ့ မြန်မာအသုံးပြုသူများအတွက် ပုံ အရွယ် သင့်တော်စွာ ပေးခြင်းက စာမျက်နှာ မြန်ဆန်စေ၊ data ချွေတာစေသည်။ gwave ရဲ့ media compress feature က ဒီအတွက်။",
      ],
    ],
  ),
  html(
    "html-lazy-loading",
    "Lazy Loading",
    "မမြင်ရသေးတဲ့ ပုံများကို နောက်မှ load ခြင်း။",
    7,
    "html lazy loading images",
    '<img src="https://placehold.co/400x150?text=Lazy" loading="lazy" alt="lazy image" style="max-width:100%">\n<p>loading="lazy" က ပုံကို screen အနီးရောက်မှ load လုပ်သည်။</p>',
    [
      [
        "loading=lazy",
        "`<img loading=\"lazy\">` က ပုံကို screen အနီးရောက်မှသာ load လုပ်စေသည် — စာမျက်နှာ ပိုမြန်ဖွင့်၊ အောက်ဘက်ပုံတွေအတွက် data မဆွဲ။ `<iframe loading=\"lazy\">` လည်း ရသည်။",
        '<img src="photo.jpg" loading="lazy" alt="...">',
      ],
      [
        "ဘယ်အခါသုံး",
        "အောက်ဘက် အဝေးက ပုံများ (feed, gallery, footer) အတွက် သင့်တော်သည်။ ထိပ်ဆုံး (above the fold) ပုံကိုတော့ lazy **မလုပ်ပါနှင့်** — အဲဒါ ချက်ချင်း ပေါ်စေချင်သည်။",
      ],
      [
        "gwave",
        "feed နဲ့ profile ဓာတ်ပုံ grid များမှာ lazy loading သုံးထားလို့ scroll ချရင် လိုတဲ့ပုံသာ ဆွဲ — mobile data သက်သာသည်။",
      ],
    ],
  ),
  html(
    "html-table-accessibility",
    "Table ကို အားလုံးသုံးနိုင်စေခြင်း",
    "thead, tbody, caption, scope။",
    8,
    "html accessible tables scope caption",
    '<table border="1" cellpadding="6">\n  <caption>အပတ်စဉ် အရောင်း</caption>\n  <thead><tr><th scope="col">ကုန်</th><th scope="col">အရေ</th></tr></thead>\n  <tbody><tr><td>Tomato</td><td>10</td></tr></tbody>\n</table>',
    [
      [
        "ဖွဲ့စည်းပုံ",
        "`<caption>` (ဇယားခေါင်းစဉ်), `<thead>`/`<tbody>` (ခေါင်း/ကိုယ်), `<th>` (header cell) က ဇယားကို semantic ဖြစ်စေသည်။ ဒါက data table ရဲ့ အခြေခံ ဖွဲ့စည်းပုံ။",
        "<table>\n  <caption>...</caption>\n  <thead>...</thead>\n  <tbody>...</tbody>\n</table>",
      ],
      [
        "scope",
        "`<th scope=\"col\">` / `scope=\"row\"` က ဘယ် header က ဘယ် cell များနဲ့ သက်ဆိုင်လဲ ပြောပြသည် — screen reader က cell တစ်ခုဖတ်ရင် သက်ဆိုင်ရာ header ကိုပါ ဖတ်ပေးလို့ အရေးကြီး။",
        '<th scope="col">ဈေးနှုန်း</th>',
      ],
      [
        "layout မလုပ်ပါနှင့်",
        "table ကို **data** အတွက်သာ သုံးပါ — စာမျက်နှာ layout (ဘေးတိုက် နေရာချ) အတွက် CSS grid/flexbox သုံးပါ။ table နဲ့ layout လုပ်တာ ဟောင်းပြီး accessibility ဆိုးသည်။",
      ],
    ],
  ),
  html(
    "html-form-validation",
    "Form Validation Attributes",
    "required, pattern, min/max — browser စစ်ဆေးမှု။",
    9,
    "html form validation attributes",
    '<form>\n  <input type="email" required placeholder="email (required)"><br><br>\n  <input type="number" min="1" max="100" placeholder="1-100"><br><br>\n  <button>Submit</button>\n</form>',
    [
      [
        "required",
        "`<input required>` က ဖြည့်မထားရင် submit မဖြစ်စေ — browser က အလိုအလျောက် သတိပေး message ပြသည်။ JavaScript မလို။",
        '<input name="name" required>',
      ],
      [
        "type နဲ့ pattern",
        "`type=\"email\"` က email format, `type=\"url\"` က URL စစ်၊ `pattern=\"09\\d{9}\"` က ကိုယ်ပိုင် regex pattern စစ်၊ `min`/`max`/`maxlength` က ဂဏန်း/စာလုံး အပိုင်းအခြား သတ်မှတ်သည်။",
        '<input pattern="09[0-9]{9}" title="09 နဲ့စ, ၁၁ လုံး">',
      ],
      [
        "client + server",
        "browser validation က မြန်ဆန်၊ user experience ကောင်း — ဒါပေမဲ့ **server မှာလည်း ထပ်စစ်ရမည်**။ client validation ကို hacker က ကျော်နိုင်လို့ တကယ့် စစ်ဆေးမှုက server မှာ ဖြစ်ရသည်။",
      ],
    ],
  ),
  html(
    "html-autocomplete",
    "autocomplete Attribute",
    "form ဖြည့်ခြင်းကို မြန်ဆန်စေခြင်း။",
    6,
    "html autocomplete attribute forms",
    '<form>\n  <input autocomplete="name" placeholder="အမည်"><br><br>\n  <input type="tel" autocomplete="tel" placeholder="ဖုန်း"><br><br>\n  <input type="email" autocomplete="email" placeholder="email">\n</form>',
    [
      [
        "autocomplete",
        "`autocomplete=\"name\"`, `\"email\"`, `\"tel\"`, `\"street-address\"` က browser ကို 'ဒီ field ဘာလဲ' ပြောပြပြီး သိမ်းထားတဲ့ အချက်အလက်နဲ့ တစ်ချက်တည်း ဖြည့်ပေးစေသည်။",
        '<input autocomplete="email">',
      ],
      [
        "password",
        "`autocomplete=\"new-password\"` က password manager ကို password အသစ် အကြံပြုစေ၊ `\"current-password\"` က login field အတွက်။ ဒါက security အတွက်ပါ အထောက်အကူ။",
        '<input type="password" autocomplete="new-password">',
      ],
      [
        "အကျိုး",
        "form ဖြည့်ချိန် လျော့၊ စာလုံးမှား နည်း — မိုဘိုင်းမှာ ရိုက်ရ ခက်တဲ့ အသုံးပြုသူများအတွက် အထူးအသုံးဝင်၊ conversion တိုးစေသည်။",
      ],
    ],
  ),
  html(
    "html-data-attributes",
    "data-* Attributes",
    "element မှာ ကိုယ်ပိုင် data တွဲထားခြင်း။",
    7,
    "html data attributes tutorial",
    '<button data-id="42" data-price="500">ဝယ်ရန်</button>\n<p>JS မှာ button.dataset.id (42), button.dataset.price (500) နဲ့ ဖတ်သည်။</p>',
    [
      [
        "data-*",
        "`<button data-id=\"42\" data-price=\"500\">` က ကိုယ်ပိုင် data ကို element မှာ တွဲထားနိုင်သည်။ JS မှာ `el.dataset.id`, `el.dataset.price` နဲ့ ဖတ်သည် (`data-` ဖြုတ်, camelCase)။",
        "const id = btn.dataset.id;  // '42'",
      ],
      [
        "အသုံးဝင်ပုံ",
        "list item တစ်ခုစီရဲ့ id ကို `data-id` မှာ ထားပြီး click event မှာ 'ဘယ် item လဲ' သိနိုင်သည် — event delegation နဲ့ တွဲသုံးရင် အလွန်အသုံးဝင်။",
        '<li data-id="7">Item</li>',
      ],
      [
        "သတိ",
        "data-* က UI state (open/closed, sort order) အတွက် သင့်တော်ပေမဲ့ လုံခြုံရေး အရေးကြီးတဲ့ data (password, token, ဈေးနှုန်း အတည်ပြုရန်) ကို မထားပါနှင့် — user က DevTools နဲ့ မြင်/ပြင် နိုင်သည်။",
      ],
    ],
  ),
  html(
    "html-template-tag",
    "template Element",
    "ပြန်သုံးမယ့် HTML ကို ကြိုသိမ်းထားခြင်း။",
    7,
    "html template element javascript",
    '<template id="card">\n  <div class="card"><h3></h3><p></p></div>\n</template>\n<p>&lt;template&gt; ထဲက HTML က default မပေါ် — JS နဲ့ clone လုပ်ပြီး ထည့်သည်။</p>',
    [
      [
        "template",
        "`<template>` ထဲက HTML က default အားဖြင့် **မပေါ်, မ run** ဘဲ ကြိုပြင်ဆင်ထားတဲ့ 'ပုံစံခွက်' အဖြစ် ကျန်နေသည်။ JS နဲ့ clone လုပ်ပြီးမှ DOM ထဲ ထည့်သည် — list item ထပ်ခါထပ်ခါ ဖန်တီးရာမှာ သုံးသည်။",
        '<template id="row"><li></li></template>',
      ],
      [
        "clone",
        "`template.content.cloneNode(true)` က အထဲက HTML ကို ကူးယူ (deep copy) ပေးသည်။ ကူးထားတာကို ဖြည့်ပြီး `list.appendChild(clone)` နဲ့ ချိတ်သည်။",
        "const row = tpl.content.cloneNode(true);",
      ],
      [
        "အကျိုး",
        "innerHTML string တွဲတာထက် သန့်ရှင်း, လုံခြုံ (XSS မဖြစ်), performance ကောင်းသည်။ modern component library များ (Web Components) က template ကို အခြေခံသည်။",
      ],
    ],
  ),
  html(
    "html-svg-inline",
    "Inline SVG",
    "vector ပုံ/icon ကို တိုက်ရိုက် ထည့်ခြင်း။",
    8,
    "html inline svg tutorial",
    '<svg width="120" height="80" viewBox="0 0 120 80">\n  <circle cx="40" cy="40" r="30" fill="#22c55e"/>\n  <rect x="70" y="20" width="40" height="40" fill="#0ea5e9"/>\n</svg>',
    [
      [
        "SVG ဆိုတာ",
        "Scalable Vector Graphics — ကိန်းဂဏန်း/ပုံသဏ္ဌာန်နဲ့ ဆွဲထားတဲ့ ပုံ။ ဘယ်လောက် ချဲ့ချဲ့ မဝိုးဝါး (vector)။ icon, logo, chart, diagram များအတွက် အကောင်းဆုံး။",
        '<svg viewBox="0 0 24 24"><path d="..."/></svg>',
      ],
      [
        "inline ရဲ့ အားသာချက်",
        "SVG ကို HTML ထဲ တိုက်ရိုက် (`<svg>...</svg>`) ထည့်ရင် CSS နဲ့ အရောင်ပြောင်း (`fill`), JS နဲ့ animate, hover effect လုပ်နိုင်သည် — `<img src=\"x.svg\">` နဲ့ မရတာတွေ။",
        "svg circle { fill: currentColor; }",
      ],
      [
        "အကျိုး",
        "SVG က ဖိုင်အရွယ် သေး (icon တစ်ခု < 1KB), retina/4K screen တွေမှာပါ ကြည်လင်၊ HTTP request မလို (inline ဆိုရင်)။ gwave ရဲ့ icon အားလုံးနီးပါး SVG (lucide)။",
      ],
    ],
  ),
  html(
    "html-canvas-tag",
    "canvas Element",
    "JavaScript နဲ့ ပုံ/ဂရပ် ဆွဲစရာ နေရာ။",
    7,
    "html canvas element tutorial",
    '<canvas id="c" width="200" height="80" style="border:1px solid #ccc"></canvas>\n<script>\n  const ctx = document.getElementById("c").getContext("2d");\n  ctx.fillStyle = "#22c55e";\n  ctx.fillRect(10, 10, 80, 50);\n  ctx.fillStyle = "#0ea5e9";\n  ctx.beginPath(); ctx.arc(150, 40, 25, 0, Math.PI*2); ctx.fill();\n</script>',
    [
      [
        "canvas",
        "`<canvas>` က ဗလာ 'ကင်းဗတ်စ်' — JavaScript နဲ့ ပုံ, chart, ဂိမ်း, animation ဆွဲသည်။ HTML က နေရာပေးရုံ၊ ဆွဲတာက JS။",
        '<canvas id="c" width="300" height="150"></canvas>',
      ],
      [
        "width/height",
        "`<canvas width=\"300\" height=\"150\">` — အရွယ်ကို **attribute** နဲ့ သတ်မှတ်ပါ။ CSS နဲ့ ချဲ့ရင် ပုံ ဝိုးဝါး (blur) ဖြစ်သည် (pixel ကို ဆွဲယူလို့)။",
      ],
      [
        "SVG နဲ့ ကွာ",
        "SVG က vector (element-based, ချဲ့လို့ကောင်း, DOM ရှိ)၊ canvas က pixel (bitmap, မြန်, DOM မရှိ)။ animation များ, ဂိမ်း, image processing အတွက် canvas သင့်တော်သည်။",
      ],
    ],
  ),
  html(
    "html-script-loading",
    "script — defer နဲ့ async",
    "JavaScript ကို ဘယ်အချိန် load လုပ်မလဲ။",
    8,
    "html script defer async explained",
    "<h2>Script loading</h2>\n<p>&lt;script defer&gt; က HTML အကုန်ဖတ်ပြီးမှ run — အကောင်းဆုံး။\n&lt;script async&gt; က load ပြီးတာနဲ့ ချက်ချင်း run။</p>",
    [
      [
        "ပြဿနာ",
        "`<script src=...>` ကို head ထဲ ရိုးရိုးထည့်ရင် browser က HTML ဖတ်တာ ရပ်ပြီး script ကို download+run ပြီးမှ ဆက်ဖတ်သည် — စာမျက်နှာ 'ဟင်းလင်း' နှေးစေသည်။",
        "<head><script src=\"app.js\"></script></head>  <!-- ဆိုး -->",
      ],
      [
        "defer",
        "`<script defer src=...>` က HTML ဖတ်တာ မရပ်ဘဲ background မှာ download၊ HTML အကုန်ဖတ်ပြီးမှ (DOM ready) run သည်။ အစီအစဉ်လည်း ကျန်။ **အများစုအတွက် အကောင်းဆုံး**။",
        '<script defer src="app.js"></script>',
      ],
      [
        "async",
        "`<script async src=...>` က download ပြီးတာနဲ့ ချက်ချင်း run (အစီအစဉ် မကျန်) — အခြား script/DOM နဲ့ မဆက်စပ်တဲ့ analytics, ads စတာတွေအတွက် သင့်တော်သည်။",
      ],
    ],
  ),
  html(
    "html-noscript",
    "noscript နဲ့ Progressive Enhancement",
    "JavaScript မရှိတဲ့အခါ ကိုင်တွယ်ခြင်း။",
    6,
    "html noscript progressive enhancement",
    "<noscript>\n  <p style=\"color:red\">ဒီ app အပြည့်အသုံးပြုရန် JavaScript ဖွင့်ပါ။</p>\n</noscript>\n<p>ဒီစာက အမြဲ ပေါ်သည်။ အထက်က noscript က JS ပိတ်ထားမှ ပေါ်သည်။</p>",
    [
      [
        "noscript",
        "`<noscript>...</noscript>` ထဲက အကြောင်းအရာက JavaScript **ပိတ်ထား** သို့ မ run နိုင်တဲ့ browser မှာသာ ပေါ်သည် — JS လိုကြောင်း အသိပေးရာမှာ သုံးသည်။",
        "<noscript>JavaScript ဖွင့်ပါ</noscript>",
      ],
      [
        "progressive enhancement",
        "အခြေခံ content+function ကို HTML နဲ့ အရင် အလုပ်လုပ်အောင် လုပ်ပြီး JS က 'အပို' အဆင်ပြေမှုသာ ထည့်ပေးတဲ့ ချဉ်းကပ်ပုံ — JS မ run လည်း အခြေခံ အသုံးပြုနိုင်စေရန်။",
      ],
      [
        "အကျိုး",
        "network ညံ့တဲ့ နေရာ, browser အဟောင်း, JS error ဖြစ်တဲ့အခါမှာပါ အသုံးပြုသူ အခြေခံ လုပ်ဆောင်နိုင်စေသည် — မြန်မာ့ ကွန်ရက်အခြေအနေအတွက် အထူး သင့်တော်။",
      ],
    ],
  ),
  html(
    "html-base-link-rel",
    "link rel — CSS, preload, canonical",
    "ပြင်ပ resource ချိတ်ခြင်း။",
    7,
    "html link rel stylesheet preload canonical",
    "<h2>link rel</h2>\n<p>rel=stylesheet (CSS ချိတ်), rel=preload (ကြိုပြင်),\nrel=canonical (မူရင်း URL) — head ထဲ ကြည့်ပါ။</p>",
    [
      [
        "stylesheet",
        "`<link rel=\"stylesheet\" href=\"style.css\">` က ပြင်ပ CSS ဖိုင်ကို ချိတ်သည် — HTML/CSS ခွဲထားခြင်းရဲ့ အခြေခံ။",
        '<link rel="stylesheet" href="/css/main.css">',
      ],
      [
        "preconnect / preload",
        "`rel=\"preconnect\"` က ပြင်ပ server (fonts, CDN) ကို ကြိုချိတ်၊ `rel=\"preload\"` က အရေးကြီးတဲ့ resource (font, hero image) ကို ကြိုဆွဲ — စာမျက်နှာ မြန်ဆန်စေသည်။",
        '<link rel="preconnect" href="https://fonts.gstatic.com">',
      ],
      [
        "canonical",
        "`<link rel=\"canonical\" href=\"...\">` က တူညီ/ဆင်တူ content များအတွက် 'မူရင်း' URL ကို search engine အား ပြောပြသည် — duplicate content ကြောင့် SEO ကျမှု ကာကွယ်သည်။",
        '<link rel="canonical" href="https://gwave.cc/post/1">',
      ],
    ],
  ),
  html(
    "html-accessibility",
    "Accessibility ခြုံငုံ",
    "အားလုံးသုံးနိုင်တဲ့ web ဆောက်ခြင်း။",
    9,
    "web accessibility a11y basics tutorial",
    "<main>\n  <h1>ရှင်းလင်းတဲ့ ခေါင်းစဉ် ဖွဲ့စည်းပုံ</h1>\n  <img src=\"https://placehold.co/200x60\" alt=\"ဆိုလိုရင်း ရှင်းတဲ့ alt\" style=\"max-width:100%\">\n</main>",
    [
      [
        "ဘာကြောင့်",
        "မျက်မမြင်, အကြားအာရုံ ချို့တဲ့, လက်လှုပ်ရှားမှု ခက်ခဲသူ, အသက်ကြီးသူ အားလုံး web ကို သုံးနိုင်ခွင့် ရှိသင့်သည် — ဒါက တန်းတူညီမျှမှု၊ ဥပဒေအရလည်း လိုအပ်လာသည်။",
      ],
      [
        "အခြေခံ ၄ ချက်",
        "① semantic HTML (`<button>`, `<nav>`, `<h1>`–`<h6>` အစဉ်လိုက်) သုံး ② ပုံတိုင်း `alt` ③ input တိုင်း `<label>` ④ စာနဲ့ နောက်ခံ အရောင် ကွာဟမှု (contrast) 4.5:1 အထက်။",
        '<img src="plant.jpg" alt="ရက် ၈၀ သား ခရမ်းချဉ်ပင်">',
      ],
      [
        "စမ်းသပ်",
        "keyboard တစ်ခုတည်း (mouse မသုံး) နဲ့ စာမျက်နှာ တစ်ခုလုံး သုံးကြည့်ပါ — မရရင် ပြင်စရာ ရှိသည်။ browser ရဲ့ Lighthouse tool က accessibility ကို အလိုအလျောက် စစ်ပေးသည်။",
      ],
    ],
  ),
  html(
    "html-project-page",
    "Project — Landing Page",
    "သင်ယူထားသမျှ ပေါင်း၍ စာမျက်နှာ တစ်ခု ဆောက်ခြင်း။",
    13,
    "html landing page project tutorial",
    '<header><nav><strong>GreenWave</strong> · <a href="#f">Features</a></nav></header>\n<main>\n  <h1>Smart Farming for Myanmar</h1>\n  <p>တောင်သူများအတွက် ခေတ်မီ platform။</p>\n  <section id="f"><h2>Features</h2><ul><li>POS</li><li>Learn</li></ul></section>\n</main>\n<footer><small>© 2026 GreenWave</small></footer>',
    [
      [
        "အစီအစဉ်",
        "`<header>` (nav), `<main>` ထဲ hero (h1 + ပုံ) + feature `<section>` + contact `<form>`, `<footer>` — semantic element များနဲ့ ဖွဲ့ပါ။ ဒါက စစ်မှန်တဲ့ website ရဲ့ ဖွဲ့စည်းပုံ။",
        "<header>…</header>\n<main>…</main>\n<footer>…</footer>",
      ],
      [
        "semantic + a11y",
        "`<header>`, `<main>`, `<section>`, `<footer>` သုံး၊ ခေါင်းစဉ်ကို `<h1>`→`<h2>` အစဉ်လိုက်, ပုံတိုင်း `alt`, input တိုင်း `<label>` ထည့်ပါ — SEO နဲ့ accessibility နှစ်မျိုးလုံး ကောင်းစေသည်။",
      ],
      [
        "meta ပြည့်စုံ",
        "`<title>`, `<meta description>`, og tags, favicon, `<meta viewport>` ထည့်ပြီး social share နဲ့ SEO အဆင်သင့် ဖြစ်စေပါ။ ဒါဆို CSS သင်တန်းနဲ့ ဆက်၍ လှအောင် style လုပ်, JavaScript နဲ့ interactive ဖြစ်အောင် ဆက်တည်ဆောက်နိုင်ပြီ။",
      ],
    ],
  ),
];
