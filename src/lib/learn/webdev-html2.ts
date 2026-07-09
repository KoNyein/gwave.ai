// HTML course — expansion pack. These lessons are spliced into htmlTrack
// (webdev.ts) after the core lessons so the HTML course covers a full
// beginner→intermediate curriculum. All original content; every lesson is a
// runnable "code" lesson so learners edit and Run in the playground. Burmese
// overlay lives in i18n/my.ts.

import type { Lesson } from "@/lib/learn/lessons";

const css = "body { font-family: sans-serif; padding: 1.5rem; line-height: 1.6; }";
const noJs = "// This is an HTML lesson — edit the HTML and press Run.";

// A "Learn on YouTube" search per lesson (localized to Burmese via the overlay).
const YT: Record<string, string> = {
  "html-elements": "HTML elements and nesting tutorial",
  "html-paragraphs": "HTML paragraphs and whitespace",
  "html-formatting": "HTML text formatting tags bold italic",
  "html-quotations": "HTML blockquote and quotation tags",
  "html-comments": "HTML comments tutorial",
  "html-colors": "HTML colors tutorial",
  "html-styles": "HTML style attribute inline CSS",
  "html-classes": "HTML class attribute explained",
  "html-id": "HTML id attribute explained",
  "html-links-advanced": "HTML links target and anchors",
  "html-images-advanced": "HTML images alt and responsive",
  "html-tables-advanced": "HTML tables colspan rowspan",
  "html-lists-advanced": "HTML nested lists tutorial",
  "html-block-inline": "HTML block vs inline elements",
  "html-div-span": "HTML div and span explained",
  "html-head": "HTML head meta tags tutorial",
  "html-entities": "HTML entities special characters",
  "html-emojis": "HTML emojis tutorial",
  "html-input-types": "HTML input types form fields",
  "html-input-attributes": "HTML input attributes required placeholder",
  "html-layout": "HTML page layout semantic tutorial",
  "html-responsive": "HTML responsive web design viewport",
};

const HTML_EXTRA2_BASE: Lesson[] = [
  {
    slug: "html-elements",
    title: "Elements & Nesting",
    summary: "How tags wrap content and sit inside one another.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "An element = start tag + content + end tag",
        body: "An HTML element is an opening tag, some content, and a closing tag with a slash. Elements can be nested — placed inside each other — but they must be closed in the reverse order they were opened, like closing brackets.",
        code: "<p>Grow <strong>strong</strong> plants</p>",
      },
    ],
    code: {
      html: "<article>\n  <h2>Nesting works like boxes in boxes</h2>\n  <p>This paragraph is <em>inside</em> the article.</p>\n</article>",
      css,
      js: noJs,
    },
  },
  {
    slug: "html-paragraphs",
    title: "Paragraphs & Whitespace",
    summary: "Why extra spaces and line breaks collapse — and how to control them.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "The browser collapses whitespace",
        body: "No matter how many spaces or new lines you type, HTML shows them as a single space. Use <br> for a line break and <p> for a new paragraph. For pre-formatted text (keeping spaces exactly), use <pre>.",
        code: "<p>Line one<br>Line two</p>",
      },
    ],
    code: {
      html: "<p>These      spaces\n   collapse into one.</p>\n<pre>But  a  &lt;pre&gt;  block\nkeeps    them.</pre>",
      css,
      js: noJs,
    },
  },
  {
    slug: "html-formatting",
    title: "Text Formatting Tags",
    summary: "Bold, italic, highlight, small, deleted, subscript and superscript.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Meaning, not just looks",
        body: "<strong> and <b> bold text, <em> and <i> italicise, <mark> highlights, <del> shows deleted text, <ins> inserted, <sub> and <sup> make subscripts/superscripts. Prefer <strong>/<em> when the emphasis carries meaning.",
        code: "H<sub>2</sub>O and E = mc<sup>2</sup>",
      },
    ],
    code: {
      html: "<p><strong>Important:</strong> water at <mark>dawn</mark>.</p>\n<p>Old price <del>1500</del> new <ins>1200</ins>.</p>\n<p>CO<sub>2</sub> up, yield<sup>+</sup>.</p>",
      css,
      js: noJs,
    },
  },
  {
    slug: "html-quotations",
    title: "Quotations & Citations",
    summary: "blockquote, q, abbr and cite for quoting sources.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "Marking up quotes",
        body: "<blockquote> is a long, indented quote; <q> is a short inline quote (the browser adds quotation marks); <abbr> marks an abbreviation with a title tooltip; <cite> names a work being referenced.",
        code: "<abbr title=\"Electrical Conductivity\">EC</abbr>",
      },
    ],
    code: {
      html: "<blockquote>Healthy soil grows healthy plants.</blockquote>\n<p>She said <q>check the pH first</q>.</p>\n<p><abbr title=\"Vapour Pressure Deficit\">VPD</abbr> matters.</p>",
      css,
      js: noJs,
    },
  },
  {
    slug: "html-comments",
    title: "Comments",
    summary: "Leave notes in your code that the browser ignores.",
    minutes: 6,
    kind: "code",
    sections: [
      {
        heading: "Notes for humans",
        body: "Anything between <!-- and --> is a comment: the browser skips it, but it helps you and others understand the code. Use comments to explain tricky parts or to temporarily hide a piece of HTML.",
        code: "<!-- This is a comment -->",
      },
    ],
    code: {
      html: "<!-- The hero section -->\n<h1>GreenWave</h1>\n<!-- <p>This line is hidden.</p> -->\n<p>This line shows.</p>",
      css,
      js: noJs,
    },
  },
  {
    slug: "html-colors",
    title: "Colours in HTML",
    summary: "Name, hex and rgb colours — and where to use them.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Three ways to name a colour",
        body: "Colours can be a keyword (tomato), a hex code (#639922), or rgb()/rgba() with red-green-blue values 0–255 (and an alpha for transparency). They're set in CSS via properties like color and background-color.",
        code: "color: #639922;  /* GreenWave green */",
      },
    ],
    code: {
      html: '<p class="a">Named</p>\n<p class="b">Hex</p>\n<p class="c">RGB + alpha</p>',
      css: ".a { color: tomato; }\n.b { color: #639922; }\n.c { background: rgba(99,153,34,.25); padding:.3rem; }",
      js: noJs,
    },
  },
  {
    slug: "html-styles",
    title: "The style Attribute",
    summary: "Add CSS directly to a single element (and why to avoid it).",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "Inline styles",
        body: "The style attribute puts CSS on one element: style=\"color:green\". It's quick, but it mixes content and design and can't be reused. For anything beyond a one-off, prefer a class and a stylesheet — the next lesson.",
        code: '<p style="color: green;">Green text</p>',
      },
    ],
    code: {
      html: '<h1 style="color:#173404; text-align:center;">Styled inline</h1>\n<p style="background:#EAF3DE; padding:.6rem;">A tinted paragraph.</p>',
      css,
      js: noJs,
    },
  },
  {
    slug: "html-classes",
    title: "The class Attribute",
    summary: "Label elements so CSS and JavaScript can target them.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Reusable labels",
        body: "A class is a name you give one or more elements. In CSS you style all of them at once with a dot selector (.card). Many elements can share a class, and one element can have several classes separated by spaces.",
        code: '<div class="card featured">…</div>',
      },
    ],
    code: {
      html: '<p class="tag">Indica</p>\n<p class="tag">Sativa</p>\n<p class="tag hot">Hybrid</p>',
      css: ".tag { display:inline-block; background:#EAF3DE; padding:.2rem .6rem; border-radius:999px; margin:.2rem; }\n.hot { background:#639922; color:white; }",
      js: noJs,
    },
  },
  {
    slug: "html-id",
    title: "The id Attribute",
    summary: "A unique name for one element — for links and scripts.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "One id per page",
        body: "An id uniquely identifies a single element. Unlike a class, each id should appear only once. You can jump to it with a link (#section), style it in CSS with #id, or grab it in JavaScript with getElementById.",
        code: '<h2 id="watering">Watering</h2> … <a href="#watering">Jump</a>',
      },
    ],
    code: {
      html: '<a href="#tips">Go to tips ↓</a>\n<div style="height:120px"></div>\n<h2 id="tips">Tips</h2>\n<p>Water at dawn.</p>',
      css,
      js: noJs,
    },
  },
  {
    slug: "html-links-advanced",
    title: "Links in Depth",
    summary: "New tabs, page anchors, email and phone links.",
    minutes: 10,
    kind: "code",
    sections: [
      {
        heading: "Beyond a plain link",
        body: "target=\"_blank\" opens a link in a new tab (add rel=\"noopener\" for safety). href=\"#id\" jumps within the page, mailto: opens an email, and tel: dials a number on phones.",
        code: '<a href="mailto:hi@gwave.ai">Email us</a>',
      },
    ],
    code: {
      html: '<p><a href="https://example.com" target="_blank" rel="noopener">New tab ↗</a></p>\n<p><a href="mailto:hi@gwave.ai">Email</a> · <a href="tel:+95912345678">Call</a></p>',
      css,
      js: noJs,
    },
  },
  {
    slug: "html-images-advanced",
    title: "Images: alt, figure & favicon",
    summary: "Accessible images, captions and the browser-tab icon.",
    minutes: 10,
    kind: "code",
    sections: [
      {
        heading: "Describe every image",
        body: "The alt attribute describes an image for screen readers and shows if the image fails to load — always write it. <figure> groups an image with a <figcaption>. The favicon (a <link> in the head) is the little tab icon.",
        code: '<img src="leaf.png" alt="A healthy green leaf">',
      },
    ],
    code: {
      html: '<figure>\n  <img src="https://placehold.co/200x120/639922/fff?text=Leaf" alt="A healthy green leaf">\n  <figcaption>Fig 1. A healthy leaf.</figcaption>\n</figure>',
      css,
      js: noJs,
    },
  },
  {
    slug: "html-tables-advanced",
    title: "Tables: Spanning & Captions",
    summary: "colspan, rowspan, caption and table sections.",
    minutes: 11,
    kind: "code",
    sections: [
      {
        heading: "Merging cells",
        body: "colspan makes a cell stretch across columns; rowspan across rows. <caption> titles the table, and <thead>/<tbody> group the header and body rows for structure and styling.",
        code: '<td colspan="2">Merged</td>',
      },
    ],
    code: {
      html: "<table border=\"1\" cellpadding=\"6\">\n  <caption>Strain weeks</caption>\n  <thead><tr><th>Strain</th><th>Type</th><th>Weeks</th></tr></thead>\n  <tbody>\n    <tr><td>OG Kush</td><td>Indica</td><td>8</td></tr>\n    <tr><td colspan=\"2\">Sour Diesel (Sativa)</td><td>10</td></tr>\n  </tbody>\n</table>",
      css,
      js: noJs,
    },
  },
  {
    slug: "html-lists-advanced",
    title: "Lists: Nested & Description",
    summary: "Lists inside lists, and term/definition lists.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "More kinds of list",
        body: "Put a <ul> or <ol> inside an <li> to nest lists. A description list <dl> pairs a term <dt> with its definition <dd> — perfect for glossaries like plant terms.",
        code: "<dl><dt>pH</dt><dd>How acidic the water is</dd></dl>",
      },
    ],
    code: {
      html: "<ul>\n  <li>Vegetative\n    <ul><li>More nitrogen</li><li>18h light</li></ul>\n  </li>\n  <li>Flowering</li>\n</ul>\n<dl><dt>EC</dt><dd>Nutrient strength</dd></dl>",
      css,
      js: noJs,
    },
  },
  {
    slug: "html-block-inline",
    title: "Block vs Inline",
    summary: "Why some elements stack and others sit in a line.",
    minutes: 9,
    kind: "code",
    sections: [
      {
        heading: "Two display types",
        body: "Block elements (like <div>, <p>, <h1>) start on a new line and fill the width. Inline elements (like <span>, <a>, <strong>) sit within a line and take only as much width as they need. CSS can switch between them.",
        code: "<span>inline</span> <div>block</div>",
      },
    ],
    code: {
      html: '<div style="background:#EAF3DE">Block fills the row</div>\n<span style="background:#EAF3DE">inline</span>\n<span style="background:#EAF3DE">stays in line</span>',
      css,
      js: noJs,
    },
  },
  {
    slug: "html-div-span",
    title: "div and span",
    summary: "The generic containers you'll use everywhere.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "Grouping tools",
        body: "<div> is a block container used to group sections for layout and styling; <span> is an inline container to style part of a line. Neither adds meaning on its own — they exist to be styled with classes.",
        code: '<div class="card"><span class="badge">New</span></div>',
      },
    ],
    code: {
      html: '<div class="card">\n  <span class="badge">Featured</span>\n  <h3>Blue Dream</h3>\n</div>',
      css: ".card { border:1px solid #ddd; border-radius:12px; padding:1rem; max-width:220px; }\n.badge { background:#639922; color:#fff; padding:.1rem .5rem; border-radius:999px; font-size:.75rem; }",
      js: noJs,
    },
  },
  {
    slug: "html-head",
    title: "The <head> & Metadata",
    summary: "Title, charset, viewport and description — the invisible page info.",
    minutes: 9,
    kind: "reading",
    sections: [
      {
        heading: "Information about the page",
        body: "The <head> holds data the visitor doesn't see directly: <title> (the tab name), <meta charset=\"utf-8\"> (character set), the viewport meta for mobile, and <meta name=\"description\"> which search engines show. <link> attaches stylesheets and the favicon.",
        code: '<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>GreenWave</title>\n  <meta name="description" content="Social super-app for growers">\n</head>',
      },
      {
        heading: "Why it matters",
        body: "Good metadata makes your page mobile-friendly, searchable and shareable. The playground writes the head for you, so you focus on the body — but real pages always include these tags.",
      },
    ],
  },
  {
    slug: "html-entities",
    title: "Entities & Symbols",
    summary: "Show reserved characters like < > & and special symbols.",
    minutes: 8,
    kind: "code",
    sections: [
      {
        heading: "Escaping special characters",
        body: "Some characters are reserved by HTML. Write &lt; for <, &gt; for >, &amp; for &, and &nbsp; for a non-breaking space. Many symbols have names too: &copy; © , &deg; ° , &rarr; →.",
        code: "5 &lt; 10 &amp;&amp; true",
      },
    ],
    code: {
      html: "<p>Temperature: 25&deg;C</p>\n<p>if (a &lt; b) &amp;&amp; ok</p>\n<p>&copy; 2026 GreenWave &rarr; grow on</p>",
      css,
      js: noJs,
    },
  },
  {
    slug: "html-emojis",
    title: "Charset & Emojis",
    summary: "How UTF-8 lets you use any language and emoji.",
    minutes: 7,
    kind: "code",
    sections: [
      {
        heading: "UTF-8 covers the world",
        body: "The UTF-8 character set can represent almost every writing system — including Burmese — and emojis, which are just characters. Set <meta charset=\"utf-8\"> (the playground does) and you can paste 🌱 or မြန်မာ straight into HTML.",
        code: "<p>Grow 🌱 with GreenWave</p>",
      },
    ],
    code: {
      html: "<h2>🌱 GreenWave 🌿</h2>\n<p>Languages: English · မြန်မာ · ไทย · 中文</p>\n<p>Mood: 😀 🌤️ 💧</p>",
      css,
      js: noJs,
    },
  },
  {
    slug: "html-input-types",
    title: "Form Input Types",
    summary: "Email, number, date, range, colour and more.",
    minutes: 11,
    kind: "code",
    sections: [
      {
        heading: "The right input for the job",
        body: "The type attribute changes what an <input> does: email and number validate their content, date shows a picker, range is a slider, color a swatch, checkbox and radio for choices. Mobile keyboards adapt too.",
        code: '<input type="email"> <input type="range">',
      },
    ],
    code: {
      html: '<form>\n  <label>Email <input type="email" placeholder="you@grow.co"></label><br><br>\n  <label>Plants <input type="number" min="0" value="3"></label><br><br>\n  <label>Water <input type="range" min="0" max="10"></label><br><br>\n  <label>Colour <input type="color" value="#639922"></label>\n</form>',
      css,
      js: noJs,
    },
  },
  {
    slug: "html-input-attributes",
    title: "Input Attributes",
    summary: "placeholder, required, value, readonly and disabled.",
    minutes: 10,
    kind: "code",
    sections: [
      {
        heading: "Guiding and validating input",
        body: "placeholder shows hint text, value sets a default, required blocks empty submission, readonly shows a value that can't be edited, and disabled greys a field out. <label> ties text to a field so tapping the label focuses it.",
        code: '<input required placeholder="Your name">',
      },
    ],
    code: {
      html: '<form>\n  <label>Name <input required placeholder="Your name"></label><br><br>\n  <label>Farm <input value="GreenWave" readonly></label><br><br>\n  <label>Code <input disabled value="locked"></label><br><br>\n  <button>Submit</button>\n</form>',
      css,
      js: noJs,
    },
  },
  {
    slug: "html-layout",
    title: "Page Layout",
    summary: "Arrange header, nav, main, aside and footer.",
    minutes: 12,
    kind: "code",
    sections: [
      {
        heading: "A semantic skeleton",
        body: "A typical page uses <header> at the top, <nav> for links, <main> for the primary content (with <article> and <aside>), and <footer> at the bottom. These elements describe the layout so browsers, search engines and screen readers understand it.",
        code: "<header>…</header><main>…</main><footer>…</footer>",
      },
    ],
    code: {
      html: '<header><h1>🌿 GreenWave</h1></header>\n<nav>Home · Learn · Shop</nav>\n<main>\n  <article><h2>Welcome</h2><p>Grow together.</p></article>\n  <aside>Tip of the day</aside>\n</main>\n<footer>© 2026</footer>',
      css: "header,nav,main,aside,footer{padding:.6rem;border-radius:8px;margin:.3rem 0}\nheader{background:#173404;color:#fff}\nnav{background:#EAF3DE}\naside{background:#f3f3f3}\nfooter{background:#eee;text-align:center}",
      js: noJs,
    },
  },
  {
    slug: "html-responsive",
    title: "Responsive Basics",
    summary: "Make pages fit phones with the viewport and flexible units.",
    minutes: 10,
    kind: "code",
    sections: [
      {
        heading: "One page, every screen",
        body: "The viewport meta tag tells phones to use their real width. Then use flexible sizes — percentages, max-width, and images with max-width:100% — so content shrinks to fit. Media queries (in the CSS course) fine-tune each screen size.",
        code: '<meta name="viewport" content="width=device-width, initial-scale=1">',
      },
    ],
    code: {
      html: '<div class="wrap">\n  <img src="https://placehold.co/600x200/639922/fff?text=Responsive" alt="banner">\n  <p>Resize the preview — the image never overflows.</p>\n</div>',
      css: ".wrap { max-width: 100%; }\nimg { max-width: 100%; height: auto; border-radius: 8px; }",
      js: noJs,
    },
  },
];

export const HTML_EXTRA2: Lesson[] = HTML_EXTRA2_BASE.map((lesson) =>
  YT[lesson.slug] ? { ...lesson, youtubeQuery: YT[lesson.slug] } : lesson,
);
