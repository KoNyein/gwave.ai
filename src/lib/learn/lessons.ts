// Age-banded learning content for the /learn platform. Pure data + helpers,
// safe to import from server and client components. No database needed —
// content is versioned in code so it works offline and is easy to review.

import type { AgeBand } from "@/lib/age";

export type LessonKind = "reading" | "quiz" | "code";

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // index into options
  explain?: string;
}

export interface LessonSection {
  heading: string;
  body: string;
}

export interface Lesson {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  kind: LessonKind;
  sections?: LessonSection[];
  quiz?: QuizQuestion[];
  /** For code lessons: starter files for the playground. */
  code?: { html: string; css: string; js: string };
}

export interface Track {
  slug: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  /** Which age bands see this track. */
  bands: AgeBand[];
  lessons: Lesson[];
}

// ───────────────────────── Kids: STEM starters ─────────────────────────────

const stemTrack: Track = {
  slug: "stem",
  title: "Science Starters",
  description: "Fun science about plants, water and light — for young explorers.",
  icon: "FlaskConical",
  bands: ["child", "preteen"],
  lessons: [
    {
      slug: "how-plants-grow",
      title: "How Plants Grow",
      summary: "Seeds, soil, sunshine and water — the recipe for a plant.",
      minutes: 6,
      kind: "reading",
      sections: [
        {
          heading: "A seed is a tiny package",
          body: "Every seed holds a baby plant and a little packed lunch. When it gets water, warmth and air, it wakes up and starts to grow. This waking-up is called germination.",
        },
        {
          heading: "The four things a plant needs",
          body: "Plants need light, water, air and nutrients from the soil. Leaves catch sunlight, roots drink water and hold the plant steady, and tiny holes in the leaves breathe in air.",
        },
        {
          heading: "Making food from light",
          body: "Plants make their own food using sunlight in a process called photosynthesis. They take in carbon dioxide and water and turn it into sugar and oxygen — the oxygen we breathe!",
        },
      ],
    },
    {
      slug: "plants-quiz",
      title: "Plant Power Quiz",
      summary: "Check what you learned about how plants grow.",
      minutes: 4,
      kind: "quiz",
      quiz: [
        {
          q: "What do we call a seed waking up and starting to grow?",
          options: ["Germination", "Hibernation", "Evaporation", "Gravity"],
          answer: 0,
          explain: "Germination is when a seed sprouts and begins to grow.",
        },
        {
          q: "Which part of a plant usually drinks water from the soil?",
          options: ["Leaves", "Flowers", "Roots", "Seeds"],
          answer: 2,
          explain: "Roots absorb water and hold the plant in place.",
        },
        {
          q: "What gas do plants give off that we need to breathe?",
          options: ["Carbon dioxide", "Oxygen", "Helium", "Steam"],
          answer: 1,
          explain: "Photosynthesis produces oxygen as it makes plant food.",
        },
      ],
    },
    {
      slug: "water-and-light",
      title: "Water & Light Experiments",
      summary: "Simple, safe things to try at home with a grown-up.",
      minutes: 5,
      kind: "reading",
      sections: [
        {
          heading: "Rainbow celery",
          body: "Put a stick of celery in a cup of water with a few drops of food colouring. After a day the colour climbs up the celery — that is water moving through tiny tubes, just like in real plants.",
        },
        {
          heading: "Reaching for the light",
          body: "Place a small plant near a window for a few days. Notice how the leaves turn toward the light. Plants grow toward light so they can make more food. This is called phototropism.",
        },
      ],
    },
  ],
};

// ─────────────────── Teens: web coding (HTML/CSS/JS) ────────────────────────

const codingTrack: Track = {
  slug: "coding",
  title: "Web Coding: HTML, CSS & JavaScript",
  description: "Build real web pages in your browser — no install needed.",
  icon: "Code2",
  bands: ["teen", "adult"],
  lessons: [
    {
      slug: "first-html-page",
      title: "Your First HTML Page",
      summary: "HTML is the skeleton of every web page. Build one and run it.",
      minutes: 10,
      kind: "code",
      sections: [
        {
          heading: "Tags build the page",
          body: "HTML uses tags like <h1> for a heading and <p> for a paragraph. Most tags come in pairs: an opening tag and a closing tag with a slash. Edit the code and press Run to see your page.",
        },
      ],
      code: {
        html: '<h1>Hello, GreenWave!</h1>\n<p>My first web page. 🌱</p>\n<button id="grow">Grow a plant</button>\n<p id="garden"></p>',
        css: "body { font-family: sans-serif; text-align: center; padding: 2rem; }\nh1 { color: #3B6D11; }\nbutton { background: #639922; color: white; border: 0; padding: .6rem 1rem; border-radius: 8px; cursor: pointer; }",
        js: "document.getElementById('grow').onclick = () => {\n  document.getElementById('garden').textContent += '🌿';\n};",
      },
    },
    {
      slug: "styling-with-css",
      title: "Make It Pretty with CSS",
      summary: "CSS controls colours, spacing and layout. Style a card.",
      minutes: 12,
      kind: "code",
      sections: [
        {
          heading: "Selectors and properties",
          body: "CSS picks an element with a selector (like .card) and sets properties (like color or padding). Try changing the colours and numbers, then press Run.",
        },
      ],
      code: {
        html: '<div class="card">\n  <h2>Blue Dream</h2>\n  <p>A calm, happy hybrid strain.</p>\n</div>',
        css: ".card {\n  max-width: 280px;\n  margin: 2rem auto;\n  padding: 1.5rem;\n  border-radius: 16px;\n  background: #EAF3DE;\n  box-shadow: 0 8px 24px rgba(0,0,0,.1);\n}\n.card h2 { color: #173404; margin: 0 0 .5rem; }\n.card p { color: #3B6D11; margin: 0; }",
        js: "// No JavaScript needed for this lesson — try editing the CSS!",
      },
    },
    {
      slug: "javascript-basics",
      title: "Interactive with JavaScript",
      summary: "JavaScript makes pages react. Build a click counter.",
      minutes: 12,
      kind: "code",
      sections: [
        {
          heading: "Variables and events",
          body: "JavaScript stores data in variables and runs code when things happen (events), like a click. This counter goes up every time you press the button.",
        },
      ],
      code: {
        html: '<h2>Water your plant</h2>\n<button id="water">💧 Water</button>\n<p>Watered <span id="count">0</span> times</p>',
        css: "body { font-family: sans-serif; text-align: center; padding: 2rem; }\nbutton { font-size: 1.2rem; padding: .6rem 1.2rem; border-radius: 8px; border: 0; background: #639922; color: white; cursor: pointer; }",
        js: "let count = 0;\nconst label = document.getElementById('count');\ndocument.getElementById('water').addEventListener('click', () => {\n  count = count + 1;\n  label.textContent = count;\n});",
      },
    },
    {
      slug: "coding-quiz",
      title: "Web Coding Quiz",
      summary: "Test your HTML, CSS and JavaScript knowledge.",
      minutes: 5,
      kind: "quiz",
      quiz: [
        {
          q: "Which language controls the STRUCTURE of a web page?",
          options: ["CSS", "HTML", "JavaScript", "SQL"],
          answer: 1,
          explain: "HTML defines the structure and content; CSS styles it; JS adds behaviour.",
        },
        {
          q: "Which is used to change colours and layout?",
          options: ["HTML", "JavaScript", "CSS", "Python"],
          answer: 2,
        },
        {
          q: "What runs when a user clicks a button?",
          options: ["A stylesheet", "An event handler", "A database", "A heading"],
          answer: 1,
          explain: "JavaScript event handlers run in response to actions like clicks.",
        },
      ],
    },
  ],
};

// ─────────────────── Adults: applied agri-science ──────────────────────────

const agriTrack: Track = {
  slug: "agri",
  title: "Applied Agri-Science",
  description: "Hydroponics, nutrients and data-driven growing for modern farms.",
  icon: "Sprout",
  bands: ["adult"],
  lessons: [
    {
      slug: "hydroponics-basics",
      title: "Hydroponics Basics",
      summary: "Growing without soil — how nutrient solutions work.",
      minutes: 10,
      kind: "reading",
      sections: [
        {
          heading: "Soil-free growing",
          body: "Hydroponics grows plants in a nutrient-rich water solution instead of soil. Roots get direct access to dissolved minerals, so plants often grow faster and use less water than field growing.",
        },
        {
          heading: "EC and pH",
          body: "Two numbers matter most: EC (electrical conductivity) measures how much nutrient is dissolved, and pH measures acidity. Most crops thrive at pH 5.5–6.5. The GreenWave tools include an EC/PPM converter and a VPD calculator to dial this in.",
        },
        {
          heading: "Monitoring with sensors",
          body: "IoT sensors track temperature, humidity, EC and pH in real time. The GreenWave smart-farm dashboard turns these readings into charts and can trigger automation rules — for example, turning on a fan when humidity climbs too high.",
        },
      ],
    },
    {
      slug: "agri-quiz",
      title: "Agri-Science Quiz",
      summary: "Check your hydroponics and monitoring knowledge.",
      minutes: 5,
      kind: "quiz",
      quiz: [
        {
          q: "What does EC measure in a nutrient solution?",
          options: [
            "Colour",
            "Dissolved nutrient concentration",
            "Temperature",
            "Light level",
          ],
          answer: 1,
          explain: "EC (electrical conductivity) rises as more nutrients dissolve.",
        },
        {
          q: "What pH range suits most hydroponic crops?",
          options: ["1–2", "5.5–6.5", "8–9", "11–12"],
          answer: 1,
        },
        {
          q: "What can a smart-farm automation rule do?",
          options: [
            "Nothing, it only displays data",
            "Trigger an action like a fan when a reading crosses a threshold",
            "Replace the plants",
            "Grow food in space only",
          ],
          answer: 1,
        },
      ],
    },
  ],
};

export const TRACKS: Track[] = [stemTrack, codingTrack, agriTrack];

/** Tracks visible to a given age band. Unknown DOB sees the kid-safe set. */
export function tracksForBand(band: AgeBand): Track[] {
  const effective: AgeBand = band === "unknown" ? "preteen" : band;
  return TRACKS.filter((t) => t.bands.includes(effective));
}

export function getTrack(slug: string): Track | undefined {
  return TRACKS.find((t) => t.slug === slug);
}

export function getLesson(
  trackSlug: string,
  lessonSlug: string,
): { track: Track; lesson: Lesson } | undefined {
  const track = getTrack(trackSlug);
  const lesson = track?.lessons.find((l) => l.slug === lessonSlug);
  if (!track || !lesson) return undefined;
  return { track, lesson };
}

/** Heading shown at the top of /learn for each band. */
export function headingForBand(band: AgeBand): string {
  if (band === "child" || band === "preteen") return "STEM for young explorers";
  if (band === "teen") return "Coding & technology";
  return "Grower & tech learning";
}
