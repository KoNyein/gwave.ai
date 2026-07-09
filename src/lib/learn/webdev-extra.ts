// Additional lessons for the HTML/CSS/JavaScript/Python tracks. Original
// tutorial content; spliced into each track just before its course quiz.

import type { Lesson } from "@/lib/learn/lessons";

export const HTML_EXTRA: Lesson[] = [
  {
    slug: "html-attributes",
    title: "Attributes, id & class",
    summary: "Extra information on tags — the hooks CSS and JS grab onto.",
    minutes: 10,
    kind: "code",
    sections: [
      {
        heading: "name=\"value\" pairs",
        body: "Attributes sit inside the opening tag and add information: href on links, src on images, type on inputs. Two special ones appear everywhere — id names ONE element uniquely, class labels a GROUP of elements for styling.",
        code: '<p id="intro" class="note big">One id, two classes.</p>',
      },
      {
        heading: "style and title",
        body: "The style attribute applies inline CSS to a single element (fine for quick tests, avoid for real projects) and title shows a tooltip on hover.",
      },
    ],
    code: {
      html: '<h2 id="top" title="Hover me!">Attributes demo</h2>\n<p class="note">First note</p>\n<p class="note">Second note</p>\n<p style="color: purple;">Inline-styled paragraph</p>',
      css: ".note { background: #EAF3DE; padding: 8px 12px; border-radius: 8px; }\n#top { color: #3B6D11; }",
      js: "// One id per page; classes can repeat.",
    },
  },
  {
    slug: "html-media",
    title: "Audio, Video & Iframes",
    summary: "Embed sound, movies and other pages.",
    minutes: 8,
    kind: "reading",
    sections: [
      {
        heading: "Video and audio",
        body: "The <video> and <audio> tags play media files. Add controls so users get play/pause buttons, and always provide a fallback text inside the tag.",
        code: '<video src="tour.mp4" controls width="480">\n  Your browser cannot play this video.\n</video>\n\n<audio src="podcast.mp3" controls></audio>',
      },
      {
        heading: "Iframes",
        body: "An <iframe> embeds another page inside yours — maps, videos, dashboards. Untrusted content should always get a sandbox attribute to limit what it can do (that's exactly how this site runs community games safely).",
        code: '<iframe src="https://example.com" width="600" height="400"\n        sandbox="allow-scripts"></iframe>',
      },
    ],
  },
];

export const CSS_EXTRA: Lesson[] = [
  {
    slug: "css-position",
    title: "Position & Z-Index",
    summary: "relative, absolute, fixed, sticky — and stacking order.",
    minutes: 12,
    kind: "code",
      youtubeQuery: "CSS position relative absolute fixed",
    sections: [
      {
        heading: "The position property",
        body: "static is the default flow. relative nudges an element from its normal spot and becomes the anchor for children. absolute places an element exactly, relative to its nearest positioned ancestor. fixed pins to the screen; sticky sticks after you scroll past it. z-index decides who sits on top.",
        code: ".parent { position: relative; }\n.badge {\n  position: absolute;\n  top: -8px;\n  right: -8px;\n}",
      },
    ],
    code: {
      html: '<div class="card">\n  Inbox\n  <span class="badge">3</span>\n</div>',
      css: "body { font-family: sans-serif; padding: 3rem; }\n.card {\n  position: relative;\n  display: inline-block;\n  background: #EAF3DE;\n  padding: 1rem 2rem;\n  border-radius: 12px;\n  font-size: 1.2rem;\n}\n.badge {\n  position: absolute;\n  top: -10px;\n  right: -10px;\n  background: crimson;\n  color: white;\n  border-radius: 999px;\n  padding: 2px 9px;\n  font-size: .85rem;\n}",
      js: "// Move the badge to the bottom-left corner.",
    },
  },
  {
    slug: "css-variables",
    title: "CSS Variables",
    summary: "Custom properties — theme your whole page from one place.",
    minutes: 10,
    kind: "code",
      youtubeQuery: "CSS variables custom properties",
    sections: [
      {
        heading: "Define once, use everywhere",
        body: "Custom properties start with -- and are read with var(). Define them on :root and every rule can share them — change one line and the whole page re-themes. This exact technique powers this site's switchable templates.",
        code: ":root { --brand: #3B6D11; }\nh1 { color: var(--brand); }",
      },
    ],
    code: {
      html: '<h1>Theme demo</h1>\n<button class="btn">Primary button</button>\n<p class="tag">tag one</p>',
      css: ":root {\n  --brand: #3B6D11;\n  --brand-soft: #EAF3DE;\n  --round: 10px;\n}\nbody { font-family: sans-serif; padding: 2rem; }\nh1 { color: var(--brand); }\n.btn {\n  background: var(--brand);\n  color: white;\n  border: 0;\n  padding: 10px 18px;\n  border-radius: var(--round);\n}\n.tag {\n  display: inline-block;\n  background: var(--brand-soft);\n  padding: 6px 12px;\n  border-radius: var(--round);\n}",
      js: "// Change --brand to hotpink and watch everything update.",
    },
  },
  {
    slug: "css-shadows-gradients",
    title: "Shadows & Gradients",
    summary: "Depth and colour blends that make UIs feel polished.",
    minutes: 10,
    kind: "code",
      youtubeQuery: "CSS box-shadow and gradients",
    sections: [
      {
        heading: "box-shadow and linear-gradient",
        body: "box-shadow adds depth (x-offset, y-offset, blur, colour); a soft large-blur shadow reads as elevation. linear-gradient blends colours as a background — give it an angle and colour stops.",
        code: ".card {\n  box-shadow: 0 8px 24px rgba(0,0,0,.15);\n  background: linear-gradient(135deg, #639922, #3B6D11);\n}",
      },
    ],
    code: {
      html: '<div class="hero">\n  <h1>GreenWave</h1>\n  <p>Grow smarter.</p>\n</div>',
      css: "body { font-family: sans-serif; padding: 2rem; background: #f6f6f6; }\n.hero {\n  max-width: 320px;\n  margin: auto;\n  padding: 2.5rem 2rem;\n  border-radius: 20px;\n  color: white;\n  background: linear-gradient(135deg, #639922, #173404);\n  box-shadow: 0 16px 40px rgba(23, 52, 4, .35);\n}\n.hero h1 { margin: 0 0 .3rem; }\n.hero p { margin: 0; opacity: .85; }",
      js: "// Try 45deg, or add a third colour stop.",
    },
  },
];

export const JS_EXTRA: Lesson[] = [
  {
    slug: "js-strings-numbers",
    title: "Strings & Numbers",
    summary: "The everyday methods you reach for constantly.",
    minutes: 10,
    kind: "code",
    sections: [
      {
        heading: "String toolbox",
        body: "toUpperCase/toLowerCase change case, includes checks for a substring, split turns text into an array, trim removes surrounding spaces, and slice cuts a piece out. Numbers get toFixed for decimals and Math helpers like round, floor and random.",
        code: '"Blue Dream".includes("Dream")  // true\n"a,b,c".split(",")               // ["a","b","c"]\n(3.14159).toFixed(2)              // "3.14"\nMath.round(4.6)                   // 5',
      },
    ],
    code: {
      html: '<h2>String lab</h2>\n<pre id="out"></pre>',
      css: "body { font-family: sans-serif; padding: 1.5rem; }\npre { background: #f4f4f4; padding: 1rem; border-radius: 8px; }",
      js: "const log = (m) => document.getElementById('out').textContent += m + '\\n';\n\nconst name = '  Blue Dream  ';\nlog('trimmed: [' + name.trim() + ']');\nlog('upper: ' + name.trim().toUpperCase());\nlog('has Dream: ' + name.includes('Dream'));\nlog('letters: ' + name.trim().length);\n\nconst yield_g = 123.456;\nlog('yield: ' + yield_g.toFixed(1) + ' g');\nlog('dice roll: ' + (Math.floor(Math.random() * 6) + 1));",
    },
  },
  {
    slug: "js-json",
    title: "JSON",
    summary: "The data format of the web — stringify and parse.",
    minutes: 10,
    kind: "code",
    sections: [
      {
        heading: "Objects ⇄ text",
        body: "APIs send data as JSON text. JSON.stringify turns a JavaScript object into that text; JSON.parse turns it back into an object. Every app that talks to a server does this constantly.",
        code: 'const text = JSON.stringify({ name: "Mai", plants: 3 });\nconst back = JSON.parse(text);\nconsole.log(back.plants); // 3',
      },
    ],
    code: {
      html: '<h2>JSON round-trip</h2>\n<pre id="out"></pre>',
      css: "body { font-family: sans-serif; padding: 1.5rem; }\npre { background: #f4f4f4; padding: 1rem; border-radius: 8px; white-space: pre-wrap; }",
      js: "const log = (m) => document.getElementById('out').textContent += m + '\\n';\n\nconst grow = { strain: 'Blue Dream', week: 4, readings: [1.2, 1.4, 1.3] };\n\nconst text = JSON.stringify(grow, null, 2);\nlog('As text:');\nlog(text);\n\nconst parsed = JSON.parse(text);\nlog('Average EC: ' + (parsed.readings.reduce((a, b) => a + b, 0) / parsed.readings.length).toFixed(2));",
    },
  },
  {
    slug: "js-timers",
    title: "Timers & Animation",
    summary: "setTimeout, setInterval and a live clock.",
    minutes: 10,
    kind: "code",
    sections: [
      {
        heading: "Doing things later — or repeatedly",
        body: "setTimeout(fn, ms) runs a function once after a delay; setInterval(fn, ms) runs it again and again. They power clocks, countdowns and simple animations. Always keep the id so you can clearInterval when done.",
        code: "const id = setInterval(() => tick(), 1000);\n// later: clearInterval(id);",
      },
    ],
    code: {
      html: '<h2 id="clock">--:--:--</h2>\n<button id="stop">Stop</button>\n<div id="plant" style="font-size:40px">🌱</div>',
      css: "body { font-family: sans-serif; padding: 2rem; text-align: center; }\n#clock { font-variant-numeric: tabular-nums; }",
      js: "const clock = document.getElementById('clock');\nconst id = setInterval(() => {\n  clock.textContent = new Date().toLocaleTimeString();\n}, 1000);\n\ndocument.getElementById('stop').onclick = () => clearInterval(id);\n\nconst stages = ['🌱', '🌿', '🪴', '🌳'];\nlet i = 0;\nsetInterval(() => {\n  i = (i + 1) % stages.length;\n  document.getElementById('plant').textContent = stages[i];\n}, 800);",
    },
  },
];

export const PY_EXTRA: Lesson[] = [
  {
    slug: "py-strings",
    title: "Working with Strings",
    summary: "Slicing, methods and joining text.",
    minutes: 10,
    kind: "python",
      pythonCode: "strain = \"Blue Dream\"\nprint(strain[0], strain[-1], strain[0:4])\n\nprint(\"Blue Dream\".upper())\nprint(\"a,b,c\".split(\",\"))\nprint(\" - \".join([\"a\", \"b\", \"c\"]))\nprint(\"Blue Dream\".replace(\"Blue\", \"Green\"))",
    sections: [
      {
        heading: "Slicing",
        body: "Square brackets pull characters out of a string: [0] is the first, [-1] the last, and [0:4] a slice of the first four.",
        code: 'strain = "Blue Dream"\nprint(strain[0])     # B\nprint(strain[-1])    # m\nprint(strain[0:4])   # Blue',
      },
      {
        heading: "Everyday methods",
        body: "upper/lower change case, strip trims spaces, replace swaps text, split breaks a string into a list, and join glues a list back together.",
        code: 'plants = "a,b,c".split(",")     # [\'a\', \'b\', \'c\']\nline = " - ".join(plants)         # a - b - c\nprint("Blue Dream".replace("Blue", "Green"))',
      },
    ],
  },
  {
    slug: "py-errors",
    title: "Errors & try/except",
    summary: "Handle problems gracefully instead of crashing.",
    minutes: 10,
    kind: "python",
      pythonCode: "def safe_divide(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return \"cannot divide by zero\"\n    finally:\n        print(\"done\")\n\nprint(safe_divide(10, 2))\nprint(safe_divide(10, 0))",
    sections: [
      {
        heading: "Catching exceptions",
        body: "When something goes wrong Python raises an exception. Wrap risky code in try and handle the failure in except — like when a user types text where a number belongs.",
        code: 'try:\n    ec = float(input("EC reading: "))\n    print(f"Logged {ec}")\nexcept ValueError:\n    print("That was not a number — try again")',
      },
      {
        heading: "finally",
        body: "A finally block always runs, error or not — the place for cleanup like closing a file.",
        code: 'try:\n    risky()\nexcept Exception as e:\n    print("Problem:", e)\nfinally:\n    print("Done either way")',
      },
    ],
  },
  {
    slug: "py-modules",
    title: "Modules: math, random & datetime",
    summary: "Import ready-made tools from the standard library.",
    minutes: 10,
    kind: "python",
      pythonCode: "import math\nimport random\nfrom datetime import date, timedelta\n\nprint(\"sqrt(144) =\", math.sqrt(144))\nprint(\"pi ~\", round(math.pi, 2))\nprint(\"dice:\", random.randint(1, 6))\n\ntoday = date.today()\nharvest = today + timedelta(weeks=8)\nprint(f\"Planted {today}, harvest ~ {harvest}\")",
    sections: [
      {
        heading: "import",
        body: "Python ships with hundreds of modules. import brings one in, then dot into its functions:",
        code: "import math\nimport random\n\nprint(math.sqrt(144))            # 12.0\nprint(round(math.pi, 2))          # 3.14\nprint(random.randint(1, 6))       # dice roll\nprint(random.choice([\"a\", \"b\"]))",
      },
      {
        heading: "Dates and times",
        body: "datetime handles clocks and calendars — the backbone of logs and schedules:",
        code: "from datetime import date, timedelta\n\ntoday = date.today()\nharvest = today + timedelta(weeks=8)\nprint(f\"Planted {today}, harvest around {harvest}\")",
      },
    ],
  },
];
