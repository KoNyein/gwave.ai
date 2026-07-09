// CSS course — expansion pack. Runnable lessons spliced into cssTrack
// (webdev.ts) after the core lessons, taking the CSS course to a full
// beginner→intermediate curriculum. All original content; every lesson runs
// in the playground. Burmese overlay lives in i18n/my.ts.

import type { Lesson } from "@/lib/learn/lessons";

const noJs = "// CSS lesson — edit the CSS and press Run.";

// A "Learn on YouTube" search per lesson (localized to Burmese via the overlay).
const YT: Record<string, string> = {
  "css-syntax": "CSS syntax rules selectors properties",
  "css-how-to": "how to add CSS to HTML",
  "css-colors-values": "CSS color values hex rgb hsl",
  "css-backgrounds": "CSS background properties tutorial",
  "css-borders": "CSS borders and border-radius",
  "css-margin-padding": "CSS margin and padding tutorial",
  "css-sizing": "CSS width height min max sizing",
  "css-units": "CSS units px em rem percent",
  "css-display-visibility": "CSS display and visibility",
  "css-text": "CSS text properties alignment spacing",
  "css-fonts": "CSS fonts font-family tutorial",
  "css-links": "CSS styling links hover states",
  "css-lists": "CSS styling lists tutorial",
  "css-tables": "CSS styling tables tutorial",
  "css-pseudo-classes": "CSS pseudo-classes hover focus",
  "css-pseudo-elements": "CSS pseudo-elements before after",
  "css-specificity": "CSS specificity explained",
  "css-overflow": "CSS overflow property tutorial",
  "css-transforms": "CSS transform rotate scale translate",
};

const CSS_EXTRA2_BASE: Lesson[] = [
  {
    slug: "css-syntax",
    title: "CSS Syntax",
    summary: "Selector, property and value — the shape of every rule.",
    minutes: 7,
    kind: "code",
    sections: [
      {
        heading: "One rule, three parts",
        body: "A CSS rule targets elements with a selector, then sets one or more property: value pairs inside braces. Each declaration ends with a semicolon. Change the colour and size below, then press Run.",
        code: "p {\n  color: green;   /* property: value */\n  font-size: 18px;\n}",
      },
    ],
    code: {
      html: "<h1>GreenWave</h1>\n<p>Change my colour and size in the CSS.</p>",
      css: "h1 { color: #3B6D11; }\np { color: #639922; font-size: 18px; }",
      js: noJs,
    },
  },
  {
    slug: "css-how-to",
    title: "Three Ways to Add CSS",
    summary: "Inline, internal and external styles — and which to prefer.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "Inline, internal, external",
        body: "You can style with a style attribute (inline), a <style> block in the head (internal), or a separate .css file linked with <link> (external). External is best for real sites — one file styles every page. The playground uses the internal CSS panel.",
        code: '<link rel="stylesheet" href="styles.css">',
      },
    ],
    code: {
      html: '<p style="color:tomato">Inline (in the tag)</p>\n<p class="internal">Internal (the CSS panel →)</p>',
      css: ".internal { color: #639922; font-weight: bold; }",
      js: noJs,
    },
  },
  {
    slug: "css-colors-values",
    title: "Colour Values",
    summary: "Names, hex, rgb and hsl — four ways to pick a colour.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "Four notations",
        body: "A colour can be a keyword (teal), hex (#639922), rgb(99,153,34) or hsl(88,64%,37%). rgb and hsl also take an alpha for transparency: rgba(...) or hsl(... / 50%). hsl is handy because you tweak hue, saturation and lightness separately.",
        code: "color: hsl(88 64% 37%);",
      },
    ],
    code: {
      html: '<p class="a">Keyword</p><p class="b">Hex</p><p class="c">RGB</p><p class="d">HSL</p>',
      css: ".a{color:teal}.b{color:#639922}.c{color:rgb(190,24,93)}.d{color:hsl(210 80% 45%)}\np{font-weight:bold;font-size:20px}",
      js: noJs,
    },
  },
  {
    slug: "css-backgrounds",
    title: "Backgrounds",
    summary: "Colour, image, gradient, size and position.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Layering a background",
        body: "background-color fills an element; background-image adds a picture or a gradient; background-size (cover/contain) and background-position control how it sits. A linear-gradient() needs no image file at all.",
        code: "background: linear-gradient(135deg, #639922, #173404);",
      },
    ],
    code: {
      html: '<div class="hero"><h2>Grow with us</h2></div>',
      css: ".hero { padding:3rem 1rem; border-radius:16px; color:white; text-align:center;\n  background: linear-gradient(135deg,#639922,#173404); }",
      js: noJs,
    },
  },
  {
    slug: "css-borders",
    title: "Borders & Radius",
    summary: "Line style, width, colour and rounded corners.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "Drawing a border",
        body: "border sets width, style (solid, dashed, dotted) and colour in one line. border-radius rounds the corners — a large value on a square makes a circle. Each side can be set on its own too.",
        code: "border: 2px solid #639922;\nborder-radius: 12px;",
      },
    ],
    code: {
      html: '<div class="card">Rounded card</div>\n<div class="pill">Pill</div>\n<div class="circle"></div>',
      css: ".card{border:2px solid #639922;border-radius:12px;padding:1rem;margin:.5rem 0}\n.pill{border:2px dashed #BE185D;border-radius:999px;padding:.4rem 1rem;display:inline-block}\n.circle{width:60px;height:60px;border-radius:50%;background:#639922}",
      js: noJs,
    },
  },
  {
    slug: "css-margin-padding",
    title: "Margin & Padding",
    summary: "Space outside vs. inside an element.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Outside and inside",
        body: "margin is the space OUTSIDE an element's border (pushing others away); padding is the space INSIDE, between the border and the content. Both take one to four values (top, right, bottom, left). margin: 0 auto centres a fixed-width block.",
        code: "margin: 1rem auto;\npadding: 0.75rem 1.25rem;",
      },
    ],
    code: {
      html: '<div class="box">I have padding inside and margin outside.</div>',
      css: "body{background:#EAF3DE}\n.box{background:white;padding:1.25rem;margin:1.5rem;border-radius:10px;max-width:280px}",
      js: noJs,
    },
  },
  {
    slug: "css-sizing",
    title: "Sizing & box-sizing",
    summary: "width, height, min/max — and why box-sizing matters.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Controlling size",
        body: "width and height set an element's size; max-width stops it growing too wide on big screens, and min-height keeps it from collapsing. box-sizing: border-box makes width include padding and border, which makes layouts far easier to reason about.",
        code: "box-sizing: border-box;\nmax-width: 320px;",
      },
    ],
    code: {
      html: '<div class="a">border-box</div>\n<div class="b">content-box</div>',
      css: "div{width:200px;padding:20px;border:4px solid #173404;background:#EAF3DE;margin:.5rem 0}\n.a{box-sizing:border-box}\n.b{box-sizing:content-box}",
      js: noJs,
    },
  },
  {
    slug: "css-units",
    title: "Units: px, em, rem, %, vw",
    summary: "Absolute vs relative sizes, and when to use each.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Relative units scale",
        body: "px is a fixed size. em is relative to the element's font-size, rem to the root font-size — great for consistent, scalable spacing. % is relative to the parent, and vw/vh are 1% of the viewport width/height. Prefer rem and % for responsive design.",
        code: "font-size: 1.25rem;\nwidth: 80%;",
      },
    ],
    code: {
      html: '<div class="wrap"><p class="big">2rem text</p><p class="half">80% wide box</p></div>',
      css: ".wrap{font-size:16px}\n.big{font-size:2rem;color:#3B6D11}\n.half{width:80%;background:#EAF3DE;padding:.5rem;border-radius:8px}",
      js: noJs,
    },
  },
  {
    slug: "css-display-visibility",
    title: "display & visibility",
    summary: "Show, hide and change how an element flows.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "block, inline, none",
        body: "display changes how an element behaves: block (full width, new line), inline (in a line), inline-block (in a line but sizable), or none (removed entirely). visibility: hidden hides an element but keeps its space; display: none removes both.",
        code: "display: inline-block;\n/* or */ display: none;",
      },
    ],
    code: {
      html: '<span class="tag">A</span><span class="tag">B</span>\n<div class="gone">You can\'t see me</div>\n<p>Text after.</p>',
      css: ".tag{display:inline-block;background:#639922;color:#fff;padding:.3rem .6rem;border-radius:6px;margin:.2rem}\n.gone{display:none}",
      js: noJs,
    },
  },
  {
    slug: "css-text",
    title: "Styling Text",
    summary: "Align, decorate, transform and space text.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Text properties",
        body: "text-align positions text (left/center/right), text-decoration adds or removes underlines, text-transform changes case (uppercase/capitalize), line-height sets the gap between lines, and letter-spacing spreads characters.",
        code: "text-align: center;\ntext-transform: uppercase;",
      },
    ],
    code: {
      html: "<h2>grow with greenwave</h2>\n<p>Readable body text with comfortable line spacing for long paragraphs.</p>",
      css: "h2{text-align:center;text-transform:capitalize;letter-spacing:1px;color:#173404}\np{line-height:1.7;text-align:justify}",
      js: noJs,
    },
  },
  {
    slug: "css-fonts",
    title: "Fonts",
    summary: "Font family, size, weight and style.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "Choosing type",
        body: "font-family lists preferred fonts with a generic fallback (sans-serif, serif, monospace) at the end. font-weight sets boldness (400 normal, 700 bold), font-style makes italics, and it's common to bundle them in the font shorthand.",
        code: "font-family: 'Segoe UI', system-ui, sans-serif;",
      },
    ],
    code: {
      html: "<p class='sans'>Sans-serif</p><p class='serif'>Serif</p><p class='mono'>Monospace</p>",
      css: "p{font-size:20px;margin:.3rem 0}\n.sans{font-family:system-ui,sans-serif}\n.serif{font-family:Georgia,serif}\n.mono{font-family:ui-monospace,monospace;font-weight:700}",
      js: noJs,
    },
  },
  {
    slug: "css-links",
    title: "Styling Links",
    summary: "Colour links by state: normal, hover, visited, active.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "Link states",
        body: "Links can be styled per state with pseudo-classes: :link (unvisited), :visited, :hover (pointer over) and :active (being clicked). Remove the default underline with text-decoration and add it back on hover for a modern feel.",
        code: "a:hover { color: #639922; text-decoration: underline; }",
      },
    ],
    code: {
      html: '<p><a href="#">Hover over me</a></p>',
      css: "a{color:#3B6D11;text-decoration:none;font-weight:bold;font-size:20px}\na:hover{color:#639922;text-decoration:underline}",
      js: noJs,
    },
  },
  {
    slug: "css-lists",
    title: "Styling Lists",
    summary: "Bullets, numbers and turning a list into a menu.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "list-style and layout",
        body: "list-style-type changes the marker (disc, circle, square, decimal) or removes it (none). Setting display or flex on the list items turns a plain <ul> into a horizontal navigation bar — the classic menu trick.",
        code: "ul { list-style: none; display: flex; gap: 1rem; }",
      },
    ],
    code: {
      html: "<ul class='nav'><li>Home</li><li>Learn</li><li>Shop</li></ul>\n<ul class='ticks'><li>Watered</li><li>Fed</li></ul>",
      css: ".nav{list-style:none;display:flex;gap:1rem;padding:.5rem;background:#173404;border-radius:8px}\n.nav li{color:#fff}\n.ticks{list-style:'✅ '}",
      js: noJs,
    },
  },
  {
    slug: "css-tables",
    title: "Styling Tables",
    summary: "Borders, spacing, striped rows and hover.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Readable tables",
        body: "border-collapse: collapse merges cell borders into clean single lines. padding gives cells room, a background on the header row makes it stand out, and :nth-child(even) stripes alternate rows for easy scanning.",
        code: "tr:nth-child(even) { background: #EAF3DE; }",
      },
    ],
    code: {
      html: "<table>\n<tr><th>Strain</th><th>Weeks</th></tr>\n<tr><td>OG Kush</td><td>8</td></tr>\n<tr><td>Blue Dream</td><td>9</td></tr>\n<tr><td>Sour Diesel</td><td>10</td></tr>\n</table>",
      css: "table{border-collapse:collapse;width:100%}\nth,td{border:1px solid #cbd5c0;padding:.5rem;text-align:left}\nth{background:#173404;color:#fff}\ntr:nth-child(even){background:#EAF3DE}",
      js: noJs,
    },
  },
  {
    slug: "css-pseudo-classes",
    title: "Pseudo-classes",
    summary: ":hover, :focus, :first-child, :nth-child and more.",
    minutes: 10,
    kind: "code",
    sections: [
      {
        heading: "Styling by state or position",
        body: "A pseudo-class styles an element in a certain state or position: :hover (mouse over), :focus (selected input), :first-child / :last-child, and :nth-child(n) (every nth item). They react without any JavaScript.",
        code: "li:nth-child(odd) { background: #EAF3DE; }",
      },
    ],
    code: {
      html: "<input placeholder='Click me'>\n<ul><li>One</li><li>Two</li><li>Three</li><li>Four</li></ul>",
      css: "input{padding:.5rem;border:2px solid #ccc;border-radius:8px}\ninput:focus{border-color:#639922;outline:none}\nli{padding:.4rem}\nli:nth-child(odd){background:#EAF3DE}\nli:hover{background:#639922;color:#fff}",
      js: noJs,
    },
  },
  {
    slug: "css-pseudo-elements",
    title: "Pseudo-elements",
    summary: "::before and ::after add content and decoration.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Generated content",
        body: "::before and ::after insert generated content before or after an element — icons, quote marks, decorative bars — without touching the HTML. They need a content property (even an empty one) to appear.",
        code: "li::before { content: '🌱 '; }",
      },
    ],
    code: {
      html: "<ul class='checks'><li>Water</li><li>Light</li><li>Nutrients</li></ul>\n<p class='quote'>Grow together</p>",
      css: ".checks{list-style:none;padding:0}\n.checks li::before{content:'🌱 '}\n.quote::before{content:'“'}\n.quote::after{content:'”'}\n.quote{font-size:22px;color:#3B6D11}",
      js: noJs,
    },
  },
  {
    slug: "css-specificity",
    title: "Specificity & the Cascade",
    summary: "Which rule wins when two conflict.",
    minutes: 9,
    kind: "reading",
    sections: [
      {
        heading: "The cascade decides",
        body: "When two rules set the same property, CSS picks the more specific one. An id (#name) beats a class (.name), which beats a tag (p). If specificity ties, the rule written later wins. Inline styles are stronger still.",
        code: "p { color: black; }        /* weakest */\n.note { color: green; }    /* stronger */\n#lead { color: red; }      /* strongest */",
      },
      {
        heading: "Keep it simple",
        body: "High specificity (or !important) makes CSS hard to override later. Good stylesheets lean on classes and a sensible order, reserving ids and !important for rare cases. Understanding the cascade is the key to debugging 'why won't this style apply?'.",
      },
    ],
  },
  {
    slug: "css-overflow",
    title: "Overflow & Scrolling",
    summary: "What happens when content is bigger than its box.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "Handling too-big content",
        body: "overflow controls content that doesn't fit: visible (spills out, the default), hidden (clipped), scroll (always a scrollbar) or auto (a scrollbar only when needed). Set a height, then overflow: auto to make a scrollable panel.",
        code: "overflow-y: auto;\nmax-height: 120px;",
      },
    ],
    code: {
      html: "<div class='panel'>\n  <p>Line 1</p><p>Line 2</p><p>Line 3</p><p>Line 4</p><p>Line 5</p><p>Line 6</p>\n</div>",
      css: ".panel{max-height:120px;overflow-y:auto;border:2px solid #639922;border-radius:8px;padding:.5rem}",
      js: noJs,
    },
  },
  {
    slug: "css-transforms",
    title: "2D Transforms",
    summary: "Move, rotate, scale and skew elements.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Reshaping without reflow",
        body: "transform moves and reshapes an element without disturbing the layout around it: translate(x, y) shifts it, rotate(deg) spins it, scale(n) grows or shrinks it, and they combine. Pair with a transition for smooth motion on hover.",
        code: "transform: rotate(-3deg) scale(1.05);",
      },
    ],
    code: {
      html: "<div class='card'>Hover me</div>",
      css: ".card{width:160px;padding:1.5rem;background:#639922;color:#fff;border-radius:12px;text-align:center;\n  transition:transform .2s}\n.card:hover{transform:rotate(-3deg) scale(1.06)}",
      js: noJs,
    },
  },
];

export const CSS_EXTRA2: Lesson[] = CSS_EXTRA2_BASE.map((lesson) =>
  YT[lesson.slug] ? { ...lesson, youtubeQuery: YT[lesson.slug] } : lesson,
);
