// Full HTML / CSS / JavaScript / Python courses for /learn — tutorial-style
// tracks with short explanations, a runnable "try it yourself" playground on
// every web lesson, and quizzes. All content is original.

import type { Track } from "@/lib/learn/lessons";
import {
  CSS_EXTRA,
  HTML_EXTRA,
  JS_EXTRA,
  PY_EXTRA,
} from "@/lib/learn/webdev-extra";
import { HTML_EXTRA2 } from "@/lib/learn/webdev-html2";
import { HTML_EXTRA3 } from "@/lib/learn/webdev-html3";
import { CSS_EXTRA2 } from "@/lib/learn/webdev-css2";
import { CSS_EXTRA3 } from "@/lib/learn/webdev-css3";
import { JS_EXTRA2 } from "@/lib/learn/webdev-js2";
import { JS_EXTRA3 } from "@/lib/learn/webdev-js3";
import { PY_EXTRA2 } from "@/lib/learn/webdev-py2";
import { PY_EXTRA3 } from "@/lib/learn/webdev-py3";
import {
  BOX_MODEL_SVG,
  FLEXBOX_SVG,
  HTML_STRUCTURE_SVG,
} from "@/lib/learn/diagrams";

// ────────────────────────────── HTML ───────────────────────────────────────

export const htmlTrack: Track = {
  slug: "html",
  title: "HTML Course",
  description:
    "The language of every web page — from your first tag to full page layouts.",
  icon: "FileCode2",
  bands: ["preteen", "teen", "adult"],
  lessons: [
    {
      slug: "html-intro",
      title: "HTML Introduction",
      summary: "What HTML is and how a page is put together.",
      minutes: 10,
      kind: "code",
      youtubeQuery: "HTML tutorial for beginners",
      sections: [
        {
          heading: "HTML describes structure",
          body: "Every web page you have ever visited is built from HTML — HyperText Markup Language. HTML does not make things move or calculate anything; its one job is to tell the browser what each piece of a page IS: this is a heading, this is a paragraph, this is a button, this is an image. The browser then knows how to display each part and how assistive tools should read it aloud.\n\nWe describe each piece with a tag written in angle brackets. Most tags come in a pair — an opening tag and a matching closing tag with a slash — that wrap around their content.",
          code: "<h1>A big heading</h1>\n<p>A paragraph of text.</p>",
        },
        {
          heading: "A full document",
          body: "A complete page has a fixed skeleton. It starts with `<!DOCTYPE html>`, then wraps everything in an `<html>` element. Inside that sit two parts: the `<head>`, which holds information about the page (its title, character set and settings) that visitors do not see directly, and the `<body>`, which holds everything they do see. The diagram shows this structure as a tree.\n\nIn this playground the skeleton is written for you — you edit the body content and press Run to see your page. Getting into the habit of pressing Run after every small change is the fastest way to learn.",
          image: {
            src: HTML_STRUCTURE_SVG,
            alt: "A tree: html contains head (title, meta) and body (h1, p, img).",
            caption: "Every page is an <html> element holding <head> and <body>.",
          },
        },
        {
          heading: "How the browser reads it",
          body: "When a browser loads your HTML it reads it from top to bottom and builds a model of the page in memory, then paints that model on the screen. Because it reads in order, the order you write your tags is the order things appear. This same model is what CSS later styles and what JavaScript later changes — so clean, well-structured HTML is the foundation everything else is built on.",
        },
      ],
      code: {
        html: "<h1>My first page</h1>\n<p>I am learning HTML on gwave.ai.</p>\n<p>Change this text, then press <b>Run</b>.</p>",
        css: "body { font-family: sans-serif; padding: 2rem; }",
        js: "// HTML lesson — no JavaScript needed yet.",
      },
    },
    {
      slug: "html-text",
      title: "Headings & Text",
      summary: "Six heading levels, paragraphs, bold, italic and line breaks.",
      minutes: 10,
      kind: "code",
      youtubeQuery: "HTML headings and text formatting",
      sections: [
        {
          heading: "Headings h1–h6",
          body: "Headings range from <h1> (most important, one per page) down to <h6>. Search engines and screen readers use them to understand your page outline.",
          code: "<h1>Title</h1>\n<h2>Section</h2>\n<h3>Sub-section</h3>",
        },
        {
          heading: "Inline text tags",
          body: "<b> and <strong> make text bold, <i> and <em> make it italic, <mark> highlights, <small> shrinks, and <br> forces a line break without starting a new paragraph.",
        },
      ],
      code: {
        html: "<h1>Growing Guide</h1>\n<h2>Week 1</h2>\n<p>Water <strong>every two days</strong>.</p>\n<p>Keep the light <em>gentle</em> — seedlings burn <mark>easily</mark>.</p>\n<p>Line one<br>Line two</p>",
        css: "body { font-family: sans-serif; padding: 2rem; line-height: 1.6; }",
        js: "// Try adding an <h3> of your own.",
      },
    },
    {
      slug: "html-links-images",
      title: "Links & Images",
      summary: "Connect pages with <a> and show pictures with <img>.",
      minutes: 10,
      kind: "code",
      youtubeQuery: "HTML links and images tutorial",
      sections: [
        {
          heading: "Anchors",
          body: "The <a> tag creates a link. Its href attribute holds the destination. Text between the tags becomes clickable.",
          code: '<a href="https://example.com">Visit example.com</a>',
        },
        {
          heading: "Images",
          body: "The <img> tag has no closing tag. src points to the picture and alt describes it for people who can't see it — always write a useful alt. (The playground blocks the network, so we draw 'images' with emoji and CSS here.)",
          code: '<img src="plant.jpg" alt="A young cannabis seedling">',
        },
      ],
      code: {
        html: '<h1>My garden gallery</h1>\n<p class="photo">🌱</p>\n<p class="photo">🌿</p>\n<a href="#" onclick="alert(\'Links work!\'); return false;">Click this link</a>',
        css: ".photo {\n  display: inline-block;\n  font-size: 64px;\n  padding: 20px;\n  background: #EAF3DE;\n  border-radius: 12px;\n}",
        js: "// Real pages load images from src URLs.",
      },
    },
    {
      slug: "html-lists-tables",
      title: "Lists & Tables",
      summary: "Bullet lists, numbered lists and data tables.",
      minutes: 12,
      kind: "code",
      youtubeQuery: "HTML lists and tables tutorial",
      sections: [
        {
          heading: "Lists",
          body: "<ul> makes a bulleted (unordered) list, <ol> a numbered (ordered) one. Each item sits in an <li>.",
          code: "<ul>\n  <li>Water</li>\n  <li>Light</li>\n</ul>",
        },
        {
          heading: "Tables",
          body: "A <table> holds rows (<tr>). Header cells are <th>, data cells are <td>. Use tables for data — not for page layout.",
        },
      ],
      code: {
        html: "<h2>Feeding schedule</h2>\n<table>\n  <tr><th>Week</th><th>EC</th></tr>\n  <tr><td>1</td><td>0.8</td></tr>\n  <tr><td>2</td><td>1.2</td></tr>\n</table>\n<h2>Shopping list</h2>\n<ol>\n  <li>Seeds</li>\n  <li>Pots</li>\n  <li>Nutrients</li>\n</ol>",
        css: "table { border-collapse: collapse; }\nth, td { border: 1px solid #999; padding: 6px 12px; }\nth { background: #EAF3DE; }",
        js: "// Add a third row to the table.",
      },
    },
    {
      slug: "html-forms",
      title: "Forms & Inputs",
      summary: "Text boxes, checkboxes, dropdowns and buttons.",
      minutes: 12,
      kind: "code",
      youtubeQuery: "HTML forms and inputs tutorial",
      sections: [
        {
          heading: "Collecting input",
          body: "Forms gather what users type or pick. <input> handles text, numbers, checkboxes and more via its type attribute; <select> makes a dropdown; <textarea> is a big text box; <label> names a field and should point at the input's id.",
          code: '<label for="name">Name</label>\n<input id="name" type="text">',
        },
      ],
      code: {
        html: '<h2>Grow log entry</h2>\n<label for="plant">Plant name</label><br>\n<input id="plant" type="text" placeholder="Blue Dream"><br><br>\n<label for="stage">Stage</label><br>\n<select id="stage">\n  <option>Seedling</option>\n  <option>Veg</option>\n  <option>Flower</option>\n</select><br><br>\n<button id="save">Save</button>\n<p id="out"></p>',
        css: "body { font-family: sans-serif; padding: 2rem; }\ninput, select { padding: 6px; }",
        js: "document.getElementById('save').onclick = () => {\n  const plant = document.getElementById('plant').value || '(no name)';\n  const stage = document.getElementById('stage').value;\n  document.getElementById('out').textContent = `Saved: ${plant} — ${stage}`;\n};",
      },
    },
    {
      slug: "html-semantic",
      title: "Semantic Layout",
      summary: "header, nav, main, article, footer — pages with meaning.",
      minutes: 10,
      kind: "code",
      youtubeQuery: "HTML semantic elements tutorial",
      sections: [
        {
          heading: "Why semantic tags",
          body: "Instead of wrapping everything in <div>, semantic tags say what each area is: <header>, <nav>, <main>, <article>, <aside>, <footer>. Screen readers and search engines rely on them, and your CSS gets simpler.",
        },
      ],
      code: {
        html: "<header>🌿 GrowBlog</header>\n<nav>Home · Guides · About</nav>\n<main>\n  <article>\n    <h2>Week 3 update</h2>\n    <p>The plants doubled in size!</p>\n  </article>\n</main>\n<footer>© 2026 GrowBlog</footer>",
        css: "body { font-family: sans-serif; margin: 0; }\nheader { background: #3B6D11; color: white; padding: 1rem; font-weight: bold; }\nnav { background: #EAF3DE; padding: .5rem 1rem; }\nmain { padding: 1rem; }\nfooter { border-top: 1px solid #ddd; padding: 1rem; color: #777; }",
        js: "// Try adding an <aside> next to the article.",
      },
    },
    ...HTML_EXTRA,
    ...HTML_EXTRA2,
    ...HTML_EXTRA3,
    {
      slug: "html-quiz",
      title: "HTML Quiz",
      summary: "Fourteen questions covering the whole HTML course.",
      minutes: 7,
      kind: "quiz",
      quiz: [
        {
          q: "What does HTML stand for?",
          options: [
            "HyperText Markup Language",
            "High Tech Modern Language",
            "Home Tool Markup List",
            "Hyperlink Text Machine Language",
          ],
          answer: 0,
        },
        {
          q: "Which tag makes the most important heading?",
          options: ["<h6>", "<head>", "<h1>", "<title>"],
          answer: 2,
          explain: "<h1> is the top-level heading; <head> holds page metadata.",
        },
        {
          q: "Which attribute holds a link's destination?",
          options: ["src", "href", "link", "to"],
          answer: 1,
        },
        {
          q: "Which tag shows an image?",
          options: ["<picture-file>", "<image>", "<img>", "<src>"],
          answer: 2,
        },
        {
          q: "A numbered list uses which tag?",
          options: ["<ul>", "<ol>", "<li> alone", "<list>"],
          answer: 1,
          explain: "<ol> = ordered (numbered); <ul> = unordered (bullets).",
        },
        {
          q: "Which input element makes a dropdown?",
          options: ["<textarea>", "<select>", "<button>", "<option> alone"],
          answer: 1,
        },
        {
          q: "Why write alt text on images?",
          options: [
            "It makes images load faster",
            "It describes the image for screen readers and when it fails to load",
            "It is required for CSS",
            "It hides the image",
          ],
          answer: 1,
        },
        {
          q: "Which is a semantic layout tag?",
          options: ["<div>", "<span>", "<article>", "<b>"],
          answer: 2,
        },
        {
          q: "How do you write a comment in HTML?",
          options: [
            "// like this",
            "<!-- like this -->",
            "/* like this */",
            "# like this",
          ],
          answer: 1,
        },
        {
          q: "Which entity displays a less-than sign (<)?",
          options: ["&amp;", "&lt;", "&gt;", "&quot;"],
          answer: 1,
          explain: "&lt; renders < ; &gt; renders >.",
        },
        {
          q: "Which attribute lets you style and script one unique element?",
          options: ["class", "id", "name", "type"],
          answer: 1,
          explain: "An id is unique per page; a class can be shared by many.",
        },
        {
          q: "Which input attribute stops an empty field being submitted?",
          options: ["placeholder", "readonly", "required", "value"],
          answer: 2,
        },
        {
          q: "Which meta tag makes a page fit phone screens?",
          options: [
            '<meta charset="utf-8">',
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
            '<meta name="description">',
            "<title>",
          ],
          answer: 1,
        },
        {
          q: "A block element like <div> …",
          options: [
            "sits within a line of text",
            "starts on a new line and fills the width",
            "is always invisible",
            "can only hold images",
          ],
          answer: 1,
        },
      ],
    },
  ],
};

// ────────────────────────────── CSS ────────────────────────────────────────

export const cssTrack: Track = {
  slug: "css",
  title: "CSS Course",
  description:
    "Colours, spacing, flexbox, grid and animation — make pages beautiful.",
  icon: "Palette",
  bands: ["preteen", "teen", "adult"],
  lessons: [
    {
      slug: "css-selectors",
      title: "Selectors & Colours",
      summary: "Target elements and paint them.",
      minutes: 10,
      kind: "code",
      youtubeQuery: "CSS selectors tutorial",
      sections: [
        {
          heading: "Three ways to select",
          body: "A tag selector (p) styles every paragraph, a class selector (.note) styles elements with class=\"note\", and an id selector (#title) styles the single element with that id. Colours can be names, hex codes like #3B6D11, or rgb()/hsl().",
          code: "p { color: gray; }\n.note { color: #C25410; }\n#title { color: hsl(93 73% 25%); }",
        },
      ],
      code: {
        html: '<h1 id="title">CSS Selectors</h1>\n<p>A normal paragraph.</p>\n<p class="note">A paragraph with the note class.</p>',
        css: "#title { color: #3B6D11; }\np { color: #444; }\n.note { color: #C25410; font-weight: bold; }",
        js: "// Change the colours, then press Run.",
      },
    },
    {
      slug: "css-box-model",
      title: "The Box Model",
      summary: "Padding, border and margin — every element is a box.",
      minutes: 12,
      kind: "code",
      youtubeQuery: "CSS box model explained",
      sections: [
        {
          heading: "Content → padding → border → margin",
          body: "One idea unlocks most of CSS layout: every element on the page is a rectangular box, and that box has four layers wrapped around its content. Working outward from the middle: the content itself, then padding (space INSIDE the border that pushes the border away from the content), then the border, then margin (space OUTSIDE the border that pushes other elements away). The diagram shows these four layers nested inside one another.\n\nOnce you can picture this, most 'why is there a gap here?' and 'why won't these two boxes touch?' puzzles answer themselves — the gap is almost always padding or margin.",
          code: ".box {\n  padding: 16px;   /* inside the border */\n  border: 2px solid green;\n  margin: 24px;    /* outside the border */\n}",
          image: {
            src: BOX_MODEL_SVG,
            alt: "Nested boxes: content inside padding, inside border, inside margin.",
            caption: "The box model: content → padding → border → margin.",
          },
        },
        {
          heading: "Padding vs. margin — when to use which",
          body: "They look similar but do different jobs. Use padding when you want space that is part of the element — for example, breathing room inside a button so the text does not touch the edge; padding takes the element's background colour. Use margin to push an element away from its neighbours — the space between two cards. A handy rule: padding is space you can 'see' (it is coloured by the box); margin is invisible space between boxes.",
        },
      ],
      code: {
        html: '<div class="box">Box A</div>\n<div class="box">Box B</div>',
        css: ".box {\n  background: #EAF3DE;\n  padding: 16px;\n  border: 2px solid #3B6D11;\n  border-radius: 8px;\n  margin: 16px;\n}",
        js: "// Try margin: 0 and see the boxes touch.",
      },
    },
    {
      slug: "css-typography",
      title: "Text & Fonts",
      summary: "Font families, sizes, weights and spacing.",
      minutes: 10,
      kind: "code",
      youtubeQuery: "CSS typography fonts tutorial",
      sections: [
        {
          heading: "The type toolbox",
          body: "font-family picks the typeface (with fallbacks), font-size sets the size (use rem so users can zoom), font-weight sets thickness, line-height controls the space between lines, and text-align positions the text.",
        },
      ],
      code: {
        html: "<h1>Readable typography</h1>\n<p>Good text styling makes long reading comfortable. Aim for a line height around 1.5 and a size of at least 16 pixels for body text.</p>",
        css: "body {\n  font-family: Georgia, serif;\n  font-size: 1.05rem;\n  line-height: 1.6;\n  max-width: 34rem;\n  margin: 2rem auto;\n}\nh1 {\n  font-family: Arial, sans-serif;\n  letter-spacing: -0.5px;\n}",
        js: "// Swap Georgia for Courier and feel the difference.",
      },
    },
    {
      slug: "css-flexbox",
      title: "Flexbox",
      summary: "One-dimensional layout: rows, columns, centring.",
      minutes: 14,
      kind: "code",
      youtubeQuery: "CSS flexbox tutorial",
      sections: [
        {
          heading: "display: flex",
          body: "Set display:flex on a container and its children line up in a row. justify-content spaces them along the row, align-items positions them across it, gap adds space between them, and flex-direction:column stacks them instead.",
          code: ".row {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  gap: 12px;\n}",
          image: {
            src: FLEXBOX_SVG,
            alt: "Three items in a row along the main axis, with a cross axis.",
            caption: "Flex items flow along the main axis; the cross axis is perpendicular.",
          },
        },
      ],
      code: {
        html: '<div class="row">\n  <div class="chip">🌱 Seed</div>\n  <div class="chip">🌿 Veg</div>\n  <div class="chip">🌸 Flower</div>\n</div>',
        css: ".row {\n  display: flex;\n  gap: 12px;\n  justify-content: center;\n  padding: 2rem;\n}\n.chip {\n  background: #EAF3DE;\n  padding: 12px 20px;\n  border-radius: 999px;\n  font-family: sans-serif;\n}",
        js: "// Try justify-content: space-between, then flex-direction: column.",
      },
    },
    {
      slug: "css-grid",
      title: "CSS Grid",
      summary: "Two-dimensional layout for cards and galleries.",
      minutes: 14,
      kind: "code",
      youtubeQuery: "CSS grid layout tutorial",
      sections: [
        {
          heading: "Rows AND columns",
          body: "Grid lays children out in two dimensions. grid-template-columns defines the columns — repeat(3, 1fr) means three equal shares — and gap spaces the cells. It's the tool for photo grids and dashboards.",
          code: ".grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 10px;\n}",
        },
      ],
      code: {
        html: '<div class="grid">\n  <div class="cell">1</div>\n  <div class="cell">2</div>\n  <div class="cell">3</div>\n  <div class="cell">4</div>\n  <div class="cell">5</div>\n  <div class="cell">6</div>\n</div>',
        css: ".grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 10px;\n  padding: 1rem;\n}\n.cell {\n  background: #3B6D11;\n  color: white;\n  padding: 2rem 0;\n  text-align: center;\n  border-radius: 10px;\n  font-family: sans-serif;\n}",
        js: "// Change repeat(3, 1fr) to repeat(2, 1fr).",
      },
    },
    {
      slug: "css-animation",
      title: "Transitions & Animation",
      summary: "Smooth hovers and keyframe animations.",
      minutes: 12,
      kind: "code",
      youtubeQuery: "CSS animations and transitions",
      sections: [
        {
          heading: "Transitions",
          body: "transition makes property changes glide instead of jump — perfect for hover effects. @keyframes defines multi-step animations you attach with the animation property.",
          code: ".btn { transition: transform .2s; }\n.btn:hover { transform: scale(1.1); }",
        },
      ],
      code: {
        html: '<button class="btn">Hover me</button>\n<div class="pulse">🌿</div>',
        css: ".btn {\n  padding: 12px 24px;\n  border: 0;\n  border-radius: 10px;\n  background: #639922;\n  color: white;\n  font-size: 1rem;\n  transition: transform .2s, background .2s;\n}\n.btn:hover { transform: scale(1.1); background: #3B6D11; }\n.pulse {\n  font-size: 48px;\n  width: fit-content;\n  margin: 2rem;\n  animation: grow 1.2s infinite alternate;\n}\n@keyframes grow {\n  from { transform: scale(1); }\n  to { transform: scale(1.4); }\n}",
        js: "// Make the pulse faster: change 1.2s to 0.4s.",
      },
    },
    {
      slug: "css-responsive",
      title: "Responsive Design",
      summary: "Media queries — one page that fits every screen.",
      minutes: 12,
      kind: "code",
      youtubeQuery: "CSS media queries responsive",
      sections: [
        {
          heading: "Media queries",
          body: "A media query applies styles only when a condition is true, like the screen being narrower than 600px. Design mobile-first: write the phone styles normally, then add min-width queries for bigger screens.",
          code: "@media (max-width: 600px) {\n  .cards { grid-template-columns: 1fr; }\n}",
        },
      ],
      code: {
        html: '<div class="cards">\n  <div class="card">One</div>\n  <div class="card">Two</div>\n  <div class="card">Three</div>\n</div>\n<p>Resize the preview panel to see the layout change.</p>',
        css: ".cards {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 10px;\n  padding: 1rem;\n}\n.card {\n  background: #EAF3DE;\n  padding: 2rem 0;\n  text-align: center;\n  border-radius: 10px;\n  font-family: sans-serif;\n}\n@media (max-width: 500px) {\n  .cards { grid-template-columns: 1fr; }\n}",
        js: "// Mobile-first: try min-width instead of max-width.",
      },
    },
    ...CSS_EXTRA,
    ...CSS_EXTRA2,
    ...CSS_EXTRA3,
    {
      slug: "css-quiz",
      title: "CSS Quiz",
      summary: "Twelve questions covering the whole CSS course.",
      minutes: 8,
      kind: "quiz",
      quiz: [
        {
          q: "Which selector targets class=\"card\"?",
          options: ["#card", ".card", "card()", "<card>"],
          answer: 1,
        },
        {
          q: "Space INSIDE an element's border is:",
          options: ["margin", "gap", "padding", "outline"],
          answer: 2,
        },
        {
          q: "Which makes a flex container?",
          options: [
            "display: block",
            "display: flex",
            "position: flex",
            "flex: on",
          ],
          answer: 1,
        },
        {
          q: "grid-template-columns: repeat(4, 1fr) creates:",
          options: [
            "Four equal columns",
            "Four rows",
            "One column repeated on four pages",
            "A 4px gap",
          ],
          answer: 0,
        },
        {
          q: "What does transition do?",
          options: [
            "Deletes an element",
            "Makes property changes animate smoothly",
            "Loads the next page",
            "Changes the HTML",
          ],
          answer: 1,
        },
        {
          q: "@media (max-width: 600px) applies its styles when…",
          options: [
            "the screen is wider than 600px",
            "the screen is at most 600px wide",
            "the page has 600 elements",
            "JavaScript is disabled",
          ],
          answer: 1,
        },
        {
          q: "Which value makes an element's width INCLUDE its padding and border?",
          options: [
            "box-sizing: content-box",
            "box-sizing: border-box",
            "overflow: hidden",
            "display: flex",
          ],
          answer: 1,
        },
        {
          q: "Which unit is relative to the ROOT font size?",
          options: ["px", "rem", "vw", "pt"],
          answer: 1,
          explain: "rem scales with the root font-size; em with the element's own.",
        },
        {
          q: "Which pseudo-class styles an element while the mouse is over it?",
          options: [":focus", ":hover", ":first-child", ":checked"],
          answer: 1,
        },
        {
          q: "What do ::before and ::after let you do?",
          options: [
            "Delete elements",
            "Insert generated content around an element",
            "Load a new page",
            "Change the HTML file",
          ],
          answer: 1,
        },
        {
          q: "When two rules conflict, which is the STRONGEST selector?",
          options: [
            "a tag selector (p)",
            "a class selector (.note)",
            "an id selector (#lead)",
            "they are all equal",
          ],
          answer: 2,
        },
        {
          q: "How do you make a fixed-height box scroll when content overflows?",
          options: [
            "overflow: visible",
            "overflow: auto with a set height",
            "display: none",
            "position: fixed",
          ],
          answer: 1,
        },
      ],
    },
  ],
};

// ─────────────────────────── JavaScript ────────────────────────────────────

export const javascriptTrack: Track = {
  slug: "javascript",
  title: "JavaScript Course",
  description:
    "Start from zero: your first line of code, decisions, loops, the DOM and events.",
  icon: "Braces",
  bands: ["preteen", "teen", "adult"],
  lessons: [
    {
      slug: "js-start",
      title: "Your First Code",
      summary: "What JavaScript is, and printing your very first message.",
      minutes: 8,
      kind: "code",
      youtubeQuery: "JavaScript for absolute beginners hello world",
      sections: [
        {
          heading: "What is JavaScript?",
          body: "JavaScript is a language you use to give a computer instructions, one line at a time. The computer does exactly what each line says, from top to bottom — like following the steps in a recipe. Let's write our very first instruction together.",
        },
        {
          heading: "Show a message",
          body: "The instruction `log(\"...\")` shows a message on the screen. Put the words you want to show inside the quotes. Press Run and you will see them appear. Then change the words to your own name and Run again — the screen changes with you.",
          code: 'log("Hello!");\nlog("My name is Mai");',
        },
        {
          heading: "One line, then the next",
          body: "Each line runs, then the next line runs after it — always in order, top to bottom. Add as many `log` lines as you like and the messages appear in the same order you wrote them. That is the whole secret of code: small steps, one after another.",
          code: 'log("I am learning to code 🌱");\nlog("This is fun!");',
        },
      ],
      code: {
        html: '<h2>Output</h2>\n<pre id="out"></pre>',
        css: "body{font-family:sans-serif;padding:1.5rem}h2{color:#3B6D11}pre{background:#f4f4f4;padding:1rem;border-radius:8px;white-space:pre-wrap}",
        js: 'const log = (m) => document.getElementById("out").textContent += m + "\\n";\n\nlog("Hello! 👋");\nlog("My name is Mai");\nlog("I am learning JavaScript 🌱");\n\n// Your turn: change "Mai" to your own name.\n// Then add one more log line of your own below, and press Run.',
      },
    },
    {
      slug: "js-variables",
      title: "Variables & Types",
      summary: "let, const and the basic value types.",
      minutes: 11,
      kind: "code",
      youtubeQuery: "JavaScript variables let const tutorial",
      sections: [
        {
          heading: "Storing values in variables",
          body: "A variable is a named box that holds a value so your program can use it later. You create one with `const` or `let` and a name. Use `const` for a value that never changes after you set it — which is most of the time, and makes your code safer — and `let` only when the value genuinely needs to change later. (An older keyword, `var`, still works but modern code avoids it.)",
          code: 'const name = "Mai";   // never changes\nlet count = 3;        // will change later',
        },
        {
          heading: "The basic types",
          body: "Every value has a type. The ones you use constantly are: numbers (`3`, `1.5`), strings (text in quotes, `\"Mai\"`), and booleans (`true`/`false`). Two more hold collections: arrays (an ordered list) and objects (labelled data) — you will meet both soon. The `typeof` keyword tells you the type of any value, which is handy when debugging.",
          code: 'typeof 3       // "number"\ntypeof "hi"    // "string"\ntypeof true    // "boolean"',
        },
        {
          heading: "Template strings",
          body: "To build a piece of text out of values, wrap it in backticks (`) and drop values in with `${ }`. This 'template string' is far cleaner than gluing pieces together with `+`. It is one of the most-used features in everyday JavaScript.",
          code: "const name = 'Mai';\nconst plants = 5;\n`${name} has ${plants} plants`;",
        },
      ],
      code: {
        html: '<h2>Console output</h2>\n<pre id="out"></pre>',
        css: "body { font-family: sans-serif; padding: 1.5rem; }\npre { background: #f4f4f4; padding: 1rem; border-radius: 8px; }",
        js: "const log = (m) => document.getElementById('out').textContent += m + '\\n';\n\nconst name = 'Mai';\nlet plants = 3;\nplants = plants + 2;\n\nlog(`Grower: ${name}`);\nlog(`Plants: ${plants}`);\nlog(`Type of plants: ${typeof plants}`);\nlog(`Is happy: ${plants > 0}`);",
      },
    },
    {
      slug: "js-functions",
      title: "Functions",
      summary: "Reusable blocks of logic with inputs and outputs.",
      minutes: 12,
      kind: "code",
      youtubeQuery: "JavaScript functions tutorial",
      sections: [
        {
          heading: "Defining and calling",
          body: "A function takes parameters, does work and returns a result. Arrow functions are a short modern syntax. Once defined, call it as many times as you like.",
          code: "function add(a, b) {\n  return a + b;\n}\nconst double = (n) => n * 2;",
        },
      ],
      code: {
        html: '<h2>Nutrient mixer</h2>\n<pre id="out"></pre>',
        css: "body { font-family: sans-serif; padding: 1.5rem; }\npre { background: #f4f4f4; padding: 1rem; border-radius: 8px; }",
        js: "const log = (m) => document.getElementById('out').textContent += m + '\\n';\n\nfunction mlForLitres(litres, mlPerLitre) {\n  return litres * mlPerLitre;\n}\n\nconst strength = (ec) => ec < 1 ? 'gentle' : ec < 2 ? 'medium' : 'strong';\n\nlog(`10 L at 2 ml/L needs ${mlForLitres(10, 2)} ml`);\nlog(`EC 0.8 is ${strength(0.8)}`);\nlog(`EC 2.4 is ${strength(2.4)}`);",
      },
    },
    {
      slug: "js-if-else",
      title: "If / Else — Making Decisions",
      summary: "Run code only when something is true, and pick between two paths.",
      minutes: 12,
      kind: "code",
      youtubeQuery: "JavaScript if else statement for beginners",
      sections: [
        {
          heading: "Making a decision",
          body: "Sometimes code should only run when something is true. `if` asks a yes/no question inside its ( ). If the answer is yes (true), the code inside the { } runs. If the answer is no, that code is skipped and nothing happens.",
          code: 'const temperature = 30;\n\nif (temperature > 28) {\n  log("It is hot 🥵");\n}',
        },
        {
          heading: "The other path: else",
          body: "Add `else` to say what should happen when the `if` question is NOT true. Now exactly one of the two blocks always runs — never both, never none. Think of a fork in the road: the answer decides which way you walk.",
          code: 'const water = 2;\n\nif (water > 0) {\n  log("The plant has water 🌿");\n} else {\n  log("Time to water 💧");\n}',
        },
        {
          heading: "Asking the question",
          body: "Inside the ( ) you compare two values with these signs:\n\n`>` bigger than · `<` smaller than · `>=` bigger or equal · `<=` smaller or equal · `===` exactly the same · `!==` not the same.\n\nImportant: use `===` (three equals) to check if two things are equal. A single `=` means 'store a value', not 'compare' — a very common beginner mix-up.",
          code: 'if (age === 10) {\n  log("You are ten");\n}\nif (score !== 0) {\n  log("You have points");\n}',
        },
        {
          heading: "More than two choices: else if",
          body: "When there are several cases, chain them with `else if`. JavaScript checks each question from the top and runs the FIRST one that is true, then stops and ignores the rest. A final plain `else` catches everything left over.",
          code: 'const ec = 1.8;\n\nif (ec < 1) {\n  log("gentle");\n} else if (ec < 2) {\n  log("medium");\n} else {\n  log("strong");\n}',
        },
      ],
      code: {
        html: '<h2>Watering helper</h2>\n<pre id="out"></pre>',
        css: "body{font-family:sans-serif;padding:1.5rem}h2{color:#3B6D11}pre{background:#f4f4f4;padding:1rem;border-radius:8px;white-space:pre-wrap}",
        js: 'const log = (m) => document.getElementById("out").textContent += m + "\\n";\n\nconst soilMoisture = 20;  // 0 = dry, 100 = very wet\n\nif (soilMoisture < 30) {\n  log("Soil is dry — water now 💧");\n} else if (soilMoisture < 70) {\n  log("Soil is just right 🌿");\n} else {\n  log("Soil is very wet — wait ⛅");\n}\n\n// Your turn: change soilMoisture to 50, then to 90, and press Run\n// each time. Watch which message the if/else chooses.',
      },
    },
    {
      slug: "js-conditions-loops",
      title: "Conditions & Loops",
      summary: "if/else decisions and for/while repetition.",
      minutes: 12,
      kind: "code",
      youtubeQuery: "JavaScript if else loops tutorial",
      sections: [
        {
          heading: "Deciding and repeating",
          body: "if/else runs code only when a condition is true. A for loop repeats code a set number of times; while repeats as long as a condition holds. Comparison uses === (equal), !== (not equal), < and >.",
          code: "for (let i = 1; i <= 3; i++) {\n  console.log(i);\n}",
        },
      ],
      code: {
        html: '<h2>Watering week</h2>\n<pre id="out"></pre>',
        css: "body { font-family: sans-serif; padding: 1.5rem; }\npre { background: #f4f4f4; padding: 1rem; border-radius: 8px; }",
        js: "const log = (m) => document.getElementById('out').textContent += m + '\\n';\n\nfor (let day = 1; day <= 7; day++) {\n  if (day % 2 === 1) {\n    log(`Day ${day}: 💧 water`);\n  } else {\n    log(`Day ${day}: rest`);\n  }\n}",
      },
    },
    {
      slug: "js-arrays-objects",
      title: "Arrays & Objects",
      summary: "Lists of values and labelled data, plus map/filter.",
      minutes: 14,
      kind: "code",
      youtubeQuery: "JavaScript arrays and objects tutorial",
      sections: [
        {
          heading: "Collections",
          body: "Arrays hold ordered lists: plants[0] is the first item. Objects hold labelled fields: plant.name. Array methods do the heavy lifting — map transforms every item, filter keeps some, and find gets the first match.",
          code: "const plants = ['Blue Dream', 'OG Kush'];\nconst plant = { name: 'Blue Dream', weeks: 3 };",
        },
      ],
      code: {
        html: '<h2>My grow room</h2>\n<pre id="out"></pre>',
        css: "body { font-family: sans-serif; padding: 1.5rem; }\npre { background: #f4f4f4; padding: 1rem; border-radius: 8px; }",
        js: "const log = (m) => document.getElementById('out').textContent += m + '\\n';\n\nconst plants = [\n  { name: 'Blue Dream', weeks: 3 },\n  { name: 'Northern Lights', weeks: 7 },\n  { name: 'White Widow', weeks: 5 },\n];\n\nconst names = plants.map(p => p.name);\nlog('All: ' + names.join(', '));\n\nconst flowering = plants.filter(p => p.weeks >= 5);\nlog('Flowering: ' + flowering.map(p => p.name).join(', '));\n\nconst oldest = plants.find(p => p.weeks === 7);\nlog('Oldest: ' + oldest.name);",
      },
    },
    {
      slug: "js-dom",
      title: "The DOM",
      summary: "Read and change the page from JavaScript.",
      minutes: 12,
      kind: "code",
      youtubeQuery: "JavaScript DOM manipulation tutorial",
      sections: [
        {
          heading: "The page as objects",
          body: "The browser turns your HTML into the DOM — a tree of objects JavaScript can read and change. document.querySelector finds an element; .textContent changes its text; .style and .classList change its look; document.createElement adds new ones.",
          code: "const title = document.querySelector('h1');\ntitle.textContent = 'Changed!';",
        },
      ],
      code: {
        html: '<h1 id="title">Original title</h1>\n<ul id="list"></ul>',
        css: "body { font-family: sans-serif; padding: 1.5rem; }\nli { margin: 4px 0; }",
        js: "document.getElementById('title').textContent = 'DOM powers 🌿';\n\nconst list = document.getElementById('list');\n['Read elements', 'Change text', 'Add nodes'].forEach((text) => {\n  const li = document.createElement('li');\n  li.textContent = '✅ ' + text;\n  list.appendChild(li);\n});",
      },
    },
    {
      slug: "js-events",
      title: "Events & a Mini App",
      summary: "Click, input and submit — build a tiny todo list.",
      minutes: 15,
      kind: "code",
      youtubeQuery: "JavaScript events addEventListener tutorial",
      sections: [
        {
          heading: "Reacting to the user",
          body: "addEventListener runs your function when something happens: a click, typing, a form submit. This lesson combines everything so far into a working todo list — the pattern behind every web app.",
          code: "button.addEventListener('click', () => {\n  // runs on every click\n});",
        },
      ],
      code: {
        html: '<h2>Grow tasks</h2>\n<input id="task" placeholder="e.g. flush the system">\n<button id="add">Add</button>\n<ul id="list"></ul>',
        css: "body { font-family: sans-serif; padding: 1.5rem; }\ninput { padding: 8px; width: 55%; }\nbutton { padding: 8px 14px; }\nli { margin: 6px 0; cursor: pointer; }\nli.done { text-decoration: line-through; color: #999; }",
        js: "const input = document.getElementById('task');\nconst list = document.getElementById('list');\n\ndocument.getElementById('add').addEventListener('click', () => {\n  const text = input.value.trim();\n  if (!text) return;\n  const li = document.createElement('li');\n  li.textContent = '🌱 ' + text;\n  li.addEventListener('click', () => li.classList.toggle('done'));\n  list.appendChild(li);\n  input.value = '';\n});",
      },
    },
    ...JS_EXTRA,
    ...JS_EXTRA2,
    ...JS_EXTRA3,
    {
      slug: "js-quiz",
      title: "JavaScript Quiz",
      summary: "Twelve questions covering the whole JavaScript course.",
      minutes: 8,
      kind: "quiz",
      quiz: [
        {
          q: "Which keyword declares a value that never changes?",
          options: ["let", "var", "const", "static"],
          answer: 2,
        },
        {
          q: "What does `plants.length` give for ['a','b','c']?",
          options: ["2", "3", "'abc'", "undefined"],
          answer: 1,
        },
        {
          q: "Which comparison is strictly-equal in JavaScript?",
          options: ["=", "==", "===", "=>"],
          answer: 2,
          explain: "= assigns, == loosely compares, === compares value AND type.",
        },
        {
          q: "array.map(fn) returns…",
          options: [
            "the first matching item",
            "a new array with fn applied to every item",
            "true or false",
            "nothing",
          ],
          answer: 1,
        },
        {
          q: "Which finds an element in the page?",
          options: [
            "document.querySelector('#id')",
            "page.find('#id')",
            "html.get('#id')",
            "css.select('#id')",
          ],
          answer: 0,
        },
        {
          q: "addEventListener('click', fn) does what?",
          options: [
            "Clicks the element",
            "Runs fn once immediately",
            "Runs fn every time the element is clicked",
            "Removes the element",
          ],
          answer: 2,
        },
        {
          q: "array.filter(fn) returns…",
          options: [
            "one value (a total)",
            "a new array of items that pass the test",
            "the array's length",
            "true or false",
          ],
          answer: 1,
        },
        {
          q: "Which is a correct arrow function that returns n doubled?",
          options: ["n => n * 2", "n -> n * 2", "function n * 2", "=> n * 2 n"],
          answer: 0,
        },
        {
          q: "What does const { name } = grower do?",
          options: [
            "Creates an object called name",
            "Copies grower.name into a variable name (destructuring)",
            "Deletes name",
            "Nothing",
          ],
          answer: 1,
        },
        {
          q: "await can only be used inside…",
          options: [
            "any function",
            "an async function",
            "a for loop",
            "the HTML file",
          ],
          answer: 1,
        },
        {
          q: "Code that might throw an error goes inside which block?",
          options: ["if", "try", "for", "switch"],
          answer: 1,
          explain: "try runs the risky code; catch handles any error it throws.",
        },
        {
          q: "Which gives a whole number from 0 to 5?",
          options: [
            "Math.random() * 5",
            "Math.floor(Math.random() * 6)",
            "Math.round(6)",
            "Math.max(0, 5)",
          ],
          answer: 1,
        },
      ],
    },
  ],
};

// ─────────────────────────────── Python ────────────────────────────────────

export const pythonTrack: Track = {
  slug: "python",
  title: "Python Course",
  description:
    "The friendliest programming language — data, logic and automation.",
  icon: "Terminal",
  bands: ["preteen", "teen", "adult"],
  lessons: [
    {
      slug: "py-intro",
      title: "Python Introduction",
      summary: "What Python is, printing, and running your first lines.",
      minutes: 9,
      kind: "python",
      youtubeQuery: "Python tutorial for beginners",
      pythonCode: "print(\"Hello, gwave.ai!\")\nprint(\"2 + 3 =\", 2 + 3)\n\n# Try changing the text, then press Run.\nname = \"Mai\"\nprint(\"Grower:\", name)",
      sections: [
        {
          heading: "Why Python",
          body: "Python is famous for reading almost like plain English, which makes it the most popular first programming language in the world. But it is not a toy: the same language you learn here powers artificial intelligence, data science, websites, scientific research and everyday automation. Learning it opens more doors than almost any other single skill in computing.\n\nBest of all, this course runs Python right in your browser — press Run and it executes instantly, with nothing to install. When you want to run it on your own machine later, it is free from python.org, in phone apps like Pydroid, or online at replit.com.",
        },
        {
          heading: "print() — your first function",
          body: "print() writes text to the screen. Text (a string) goes in quotes; numbers don't need them. One line is a complete program:",
          code: 'print("Hello, gwave.ai!")\nprint("2 + 3 =", 2 + 3)',
        },
        {
          heading: "Comments",
          body: "Lines starting with # are comments — notes for humans that Python ignores.",
          code: "# This is a comment\nprint(\"Python ignores the line above\")",
        },
      ],
    },
    {
      slug: "py-variables",
      title: "Variables & Types",
      summary: "Numbers, strings, booleans and f-strings.",
      minutes: 10,
      kind: "python",
      youtubeQuery: "Python variables and data types",
      pythonCode: "name = \"Mai\"\nplants = 3\nheight = 12.5\nis_growing = True\n\nprint(f\"{name} is growing {plants} plants\")\nprint(\"Tallest:\", height, \"cm\")\nprint(\"Type of plants:\", type(plants).__name__)\nprint(\"Growing?\", is_growing)",
      sections: [
        {
          heading: "No declarations needed",
          body: "A variable is created the moment you assign it. Python figures out the type: int (whole number), float (decimal), str (text), bool (True/False).",
          code: 'name = "Mai"\nplants = 3\nheight = 12.5\nis_growing = True',
        },
        {
          heading: "f-strings",
          body: "Put an f before the quotes and insert values with curly braces — the cleanest way to build text:",
          code: 'name = "Mai"\nplants = 3\nprint(f"{name} is growing {plants} plants")',
        },
        {
          heading: "Converting types",
          body: "int(), float() and str() convert between types — essential when reading user input, which always arrives as text:",
          code: 'age = int(input("Your age: "))\nprint(f"Next year you will be {age + 1}")',
        },
      ],
    },
    {
      slug: "py-conditions",
      title: "If / Elif / Else",
      summary: "Decisions with indentation — Python's signature style.",
      minutes: 10,
      kind: "python",
      youtubeQuery: "Python if elif else tutorial",
      pythonCode: "ec = 1.4\n\nif ec < 1.0:\n    print(\"Feed is gentle\")\nelif ec < 2.0:\n    print(\"Feed is medium\")\nelse:\n    print(\"Feed is strong\")\n\ntemp = 26\nhumid = 65\nif temp > 24 and humid > 60:\n    print(\"Turn on the exhaust fan\")",
      sections: [
        {
          heading: "Indentation IS the syntax",
          body: "Python groups code by indentation instead of curly braces. Everything indented under an if runs only when the condition is true. elif chains more checks; else catches the rest.",
          code: 'ec = 1.4\nif ec < 1.0:\n    print("Feed is gentle")\nelif ec < 2.0:\n    print("Feed is medium")\nelse:\n    print("Feed is strong")',
        },
        {
          heading: "Combining conditions",
          body: "and, or and not combine checks — much more readable than symbols:",
          code: 'temp = 26\nhumid = 65\nif temp > 24 and humid > 60:\n    print("Turn on the exhaust fan")',
        },
      ],
    },
    {
      slug: "py-loops",
      title: "Loops",
      summary: "for, while, range() and looping over lists.",
      minutes: 10,
      kind: "python",
      youtubeQuery: "Python for and while loops tutorial",
      pythonCode: "for day in range(1, 8):\n    if day % 2 == 1:\n        print(f\"Day {day}: water\")\n    else:\n        print(f\"Day {day}: rest\")\n\nplants = [\"Blue Dream\", \"OG Kush\", \"White Widow\"]\nfor plant in plants:\n    print(\"Checking\", plant)",
      sections: [
        {
          heading: "for + range",
          body: "range(1, 8) counts 1 to 7 (the end is excluded). The loop body runs once per number:",
          code: 'for day in range(1, 8):\n    if day % 2 == 1:\n        print(f"Day {day}: water 💧")\n    else:\n        print(f"Day {day}: rest")',
        },
        {
          heading: "Looping a list",
          body: "for works directly on lists — no index bookkeeping needed:",
          code: 'plants = ["Blue Dream", "OG Kush", "White Widow"]\nfor plant in plants:\n    print(f"Checking {plant}...")',
        },
        {
          heading: "while",
          body: "while repeats as long as its condition stays true — be sure something inside changes it, or it loops forever:",
          code: "water = 5\nwhile water > 0:\n    print(f\"Watering... {water} litres left\")\n    water = water - 1",
        },
      ],
    },
    {
      slug: "py-functions",
      title: "Functions",
      summary: "def, parameters, return values and defaults.",
      minutes: 10,
      kind: "python",
      youtubeQuery: "Python functions def return tutorial",
      pythonCode: "def ml_for_litres(litres, ml_per_litre):\n    return litres * ml_per_litre\n\nprint(ml_for_litres(10, 2))\nprint(ml_for_litres(25, 1.5))\n\ndef greet(name, lang=\"en\"):\n    return f\"Hello {name}!\" if lang == \"en\" else f\"Mingalaba {name}!\"\n\nprint(greet(\"Mai\"))\nprint(greet(\"Mai\", \"my\"))",
      sections: [
        {
          heading: "def defines, return answers",
          body: "Functions bundle logic you want to reuse. Parameters go in the parentheses; return sends a result back to the caller.",
          code: 'def ml_for_litres(litres, ml_per_litre):\n    return litres * ml_per_litre\n\nprint(ml_for_litres(10, 2))   # 20\nprint(ml_for_litres(25, 1.5)) # 37.5',
        },
        {
          heading: "Default values",
          body: "A parameter can have a default so callers may skip it:",
          code: 'def greet(name, lang="en"):\n    if lang == "my":\n        return f"မင်္ဂလာပါ {name}!"\n    return f"Hello {name}!"\n\nprint(greet("Mai"))\nprint(greet("Mai", "my"))',
        },
      ],
    },
    {
      slug: "py-collections",
      title: "Lists & Dictionaries",
      summary: "Python's two workhorse containers.",
      minutes: 12,
      kind: "python",
      youtubeQuery: "Python lists dictionaries tutorial",
      pythonCode: "plants = [\"Blue Dream\", \"OG Kush\"]\nplants.append(\"White Widow\")\nprint(\"All:\", plants)\nprint(\"First:\", plants[0], \"\u00b7 Count:\", len(plants))\n\nplant = {\"name\": \"Blue Dream\", \"weeks\": 3, \"healthy\": True}\nplant[\"weeks\"] = 4\nfor key, value in plant.items():\n    print(key, \"->\", value)",
      sections: [
        {
          heading: "Lists",
          body: "A list is an ordered collection. Index from 0, append to add, len() to count:",
          code: 'plants = ["Blue Dream", "OG Kush"]\nplants.append("White Widow")\nprint(plants[0])      # Blue Dream\nprint(len(plants))    # 3',
        },
        {
          heading: "Dictionaries",
          body: "A dict maps keys to values — like a labelled record:",
          code: 'plant = {"name": "Blue Dream", "weeks": 3, "healthy": True}\nprint(plant["name"])\nplant["weeks"] = 4\nfor key, value in plant.items():\n    print(key, "→", value)',
        },
        {
          heading: "A mini program",
          body: "Combining everything — find the plants that need feeding:",
          code: 'plants = [\n    {"name": "A", "ec": 0.7},\n    {"name": "B", "ec": 1.8},\n    {"name": "C", "ec": 0.5},\n]\nhungry = [p["name"] for p in plants if p["ec"] < 1.0]\nprint("Feed these:", hungry)',
        },
      ],
    },
    ...PY_EXTRA,
    ...PY_EXTRA2,
    ...PY_EXTRA3,
    {
      slug: "py-quiz",
      title: "Python Quiz",
      summary: "Twelve questions covering the whole Python course.",
      minutes: 8,
      kind: "quiz",
      quiz: [
        {
          q: "Which prints text to the screen?",
          options: ["echo()", "print()", "console.log()", "write()"],
          answer: 1,
        },
        {
          q: "How does Python group the body of an if?",
          options: [
            "Curly braces { }",
            "Parentheses ( )",
            "Indentation",
            "Semicolons",
          ],
          answer: 2,
        },
        {
          q: "range(1, 5) produces…",
          options: ["1,2,3,4,5", "1,2,3,4", "0,1,2,3,4", "5,4,3,2,1"],
          answer: 1,
          explain: "The end value is excluded.",
        },
        {
          q: "f\"Hi {name}\" is called…",
          options: ["a comment", "an f-string", "a function", "a dictionary"],
          answer: 1,
        },
        {
          q: "Which adds an item to a list?",
          options: [
            "list.push(x)",
            "list.append(x)",
            "list.add(x)",
            "list + x",
          ],
          answer: 1,
        },
        {
          q: "plant[\"name\"] reads from a…",
          options: ["list", "loop", "dictionary", "range"],
          answer: 2,
        },
        {
          q: "What does def do?",
          options: [
            "Deletes a file",
            "Defines a function",
            "Declares a constant",
            "Debugs the code",
          ],
          answer: 1,
        },
        {
          q: "What does [n*2 for n in range(3)] produce?",
          options: ["[0, 2, 4]", "[2, 4, 6]", "[0, 1, 2]", "[6]"],
          answer: 0,
          explain: "A list comprehension doubles 0, 1 and 2.",
        },
        {
          q: "Which collection cannot be changed after it is created?",
          options: ["list", "dict", "tuple", "set"],
          answer: 2,
        },
        {
          q: "word[::-1] gives you the string…",
          options: ["unchanged", "reversed", "uppercased", "empty"],
          answer: 1,
        },
        {
          q: "In a class, __init__ is…",
          options: [
            "a loop",
            "the constructor that sets up each object",
            "a comment",
            "a module",
          ],
          answer: 1,
        },
        {
          q: "lambda x: x + 1 is…",
          options: [
            "a small anonymous function",
            "a list",
            "an error",
            "a keyword to delete x",
          ],
          answer: 0,
        },
      ],
    },
  ],
};

export const WEBDEV_TRACKS: Track[] = [
  htmlTrack,
  cssTrack,
  javascriptTrack,
  pythonTrack,
];
