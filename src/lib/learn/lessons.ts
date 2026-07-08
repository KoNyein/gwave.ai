// Age-banded learning content for the /learn platform. Pure data + helpers,
// safe to import from server and client components. No database needed —
// content is versioned in code so it works offline and is easy to review.

import type { AgeBand } from "@/lib/age";

export type LessonKind = "reading" | "quiz" | "code" | "robot" | "circuit";

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

// ─────────────────── Electronics & IoT (all ages, banded) ──────────────────

const electronicsTrack: Track = {
  slug: "electronics-iot",
  title: "Electronics & IoT",
  description: "Sensors, circuits and connected devices for smart growing.",
  icon: "Cpu",
  bands: ["child", "preteen", "teen", "adult"],
  lessons: [
    {
      slug: "what-is-a-sensor",
      title: "What Is a Sensor?",
      summary: "The devices that turn the real world into numbers.",
      minutes: 6,
      kind: "reading",
      sections: [
        {
          heading: "A sensor measures the world",
          body: "A sensor is a small electronic device that measures something physical — temperature, light, moisture, distance — and turns it into an electrical signal a computer can read. Your phone has many: a light sensor dims the screen, and an accelerometer knows which way you tilt it.",
        },
        {
          heading: "Sensors on a smart farm",
          body: "GreenWave farms use sensors for temperature, humidity and soil moisture. Each reading becomes a number the system stores and charts. When a value crosses a limit — say humidity above 70% — an automation rule can act, like switching on a fan.",
        },
        {
          heading: "Analog vs. digital",
          body: "Some sensors give an analog signal — a smooth range of values, like a dial. Others are digital — clear on/off or exact numbers. A tiny computer called a microcontroller reads the sensor and decides what to do next.",
        },
      ],
    },
    {
      slug: "build-a-circuit",
      title: "Build a Circuit (Game)",
      summary: "Connect a battery, wire, switch and LED to light it up.",
      minutes: 12,
      kind: "circuit",
      sections: [
        {
          heading: "Electricity needs a loop",
          body: "Electricity only flows around a complete loop called a circuit. Connect the battery, wire, switch and LED in a full ring, then close the switch — the LED lights up! Break the loop anywhere and the light goes out. Add each part in order and press the switch.",
        },
      ],
    },
    {
      slug: "sending-data-to-the-cloud",
      title: "Sending Data to the Cloud",
      summary: "How a sensor's reading travels to an app you can see.",
      minutes: 8,
      kind: "reading",
      sections: [
        {
          heading: "From device to internet",
          body: "An IoT (Internet of Things) device is anything with sensors that connects to the internet. The microcontroller reads a sensor, packages the number as a small message, and sends it over Wi-Fi or a mobile network to a server in the cloud.",
        },
        {
          heading: "MQTT: a language for tiny devices",
          body: "Many IoT devices talk using MQTT — a lightweight messaging system. A device 'publishes' a reading to a topic (like farm/zone1/temperature) and a server 'subscribes' to receive it. GreenWave uses an MQTT broker so farm sensors can stream data efficiently, even on weak connections.",
        },
        {
          heading: "Storing and showing the data",
          body: "The cloud server saves each reading with a timestamp in a database. An app then reads that history and draws charts — exactly what the GreenWave smart-farm dashboard does. Because the data is live, the dashboard updates the moment a new reading arrives.",
        },
      ],
    },
    {
      slug: "electronics-iot-quiz",
      title: "Electronics & IoT Quiz",
      summary: "Check what you learned about sensors, circuits and IoT.",
      minutes: 5,
      kind: "quiz",
      quiz: [
        {
          q: "What does a sensor do?",
          options: [
            "Stores files",
            "Turns something physical into a signal a computer can read",
            "Prints paper",
            "Charges a battery",
          ],
          answer: 1,
          explain: "Sensors measure the world and convert it into electrical signals.",
        },
        {
          q: "Electricity flows only around a…",
          options: [
            "Straight line",
            "Complete loop (circuit)",
            "Single wire with one end",
            "Magnet",
          ],
          answer: 1,
          explain: "A circuit must be a complete loop for current to flow.",
        },
        {
          q: "What does IoT stand for?",
          options: [
            "Internet of Things",
            "Input of Text",
            "Index of Tables",
            "Images or Text",
          ],
          answer: 0,
        },
        {
          q: "Which lightweight system do many IoT devices use to send readings?",
          options: ["MQTT", "PDF", "HTML", "USB"],
          answer: 0,
          explain: "MQTT is a lightweight publish/subscribe messaging protocol for devices.",
        },
      ],
    },
  ],
};

// ─────────────────── Robotics & AI (all ages, banded) ──────────────────────

const roboticsTrack: Track = {
  slug: "robotics",
  title: "Robotics & AI",
  description:
    "How robots sense, think and move — with a hands-on robot programming game.",
  icon: "Bot",
  bands: ["child", "preteen", "teen", "adult"],
  lessons: [
    {
      slug: "what-is-a-robot",
      title: "What Is a Robot?",
      summary: "Sense, think, act — the loop every robot runs on.",
      minutes: 7,
      kind: "reading",
      sections: [
        {
          heading: "Sense → Think → Act",
          body: "A robot is a machine that senses its surroundings, decides what to do, and then acts. It repeats this loop many times a second. A robot vacuum senses a wall (sense), decides to turn (think), and drives away from it (act).",
        },
        {
          heading: "Sensors are a robot's senses",
          body: "Sensors turn the real world into numbers a robot can use — distance sensors, cameras, temperature and light sensors. On a GreenWave smart farm, sensors read temperature, humidity and soil moisture so the system can act automatically.",
        },
        {
          heading: "Actuators make things move",
          body: "Actuators are the muscles: motors that spin wheels, arms that lift, valves that open. A robot's program connects what the sensors say to what the actuators do.",
        },
      ],
    },
    {
      slug: "program-a-robot",
      title: "Program a Robot (Game)",
      summary: "Write a list of commands to guide the robot to the goal.",
      minutes: 12,
      kind: "robot",
      sections: [
        {
          heading: "Sequencing: order matters",
          body: "Programming a robot means giving it commands in the right order — this is called sequencing, the foundation of all coding. Plan the path, add your moves, then press Run and watch the robot follow them exactly.",
        },
      ],
    },
    {
      slug: "how-ai-helps-farms",
      title: "How AI Helps Farms",
      summary: "From simple rules to smart predictions.",
      minutes: 8,
      kind: "reading",
      sections: [
        {
          heading: "Rules vs. learning",
          body: "The simplest 'smart' systems follow rules a human wrote: IF humidity > 70% THEN turn on the fan. Artificial intelligence goes further — it learns patterns from lots of past data to predict what will happen next, like forecasting when a crop will be ready to harvest.",
        },
        {
          heading: "AI you can see in GreenWave",
          body: "The smart-farm automation rules are the rule-based kind — reliable and easy to understand. As more sensor history builds up, AI models can spot trends a person might miss, such as an early sign of plant stress.",
        },
        {
          heading: "Keeping AI safe and fair",
          body: "AI is only as good as its data. Good engineers check that predictions are accurate, explain how decisions are made, and always keep a human in charge of important choices.",
        },
      ],
    },
    {
      slug: "robotics-quiz",
      title: "Robotics & AI Quiz",
      summary: "Check what you learned about robots and AI.",
      minutes: 5,
      kind: "quiz",
      quiz: [
        {
          q: "What loop does every robot repeat?",
          options: [
            "Start → Stop",
            "Sense → Think → Act",
            "Buy → Sell",
            "Up → Down",
          ],
          answer: 1,
          explain: "Robots continuously sense their surroundings, decide, and act.",
        },
        {
          q: "What turns the real world into numbers a robot can use?",
          options: ["Actuators", "Wheels", "Sensors", "Batteries"],
          answer: 2,
        },
        {
          q: "Giving commands in the correct order is called…",
          options: ["Sequencing", "Painting", "Charging", "Guessing"],
          answer: 0,
          explain: "Sequencing is the foundation of programming.",
        },
        {
          q: "What is the safest way to use AI for important decisions?",
          options: [
            "Let it decide everything alone",
            "Keep a human in charge and check its accuracy",
            "Never write down the data",
            "Turn off all sensors",
          ],
          answer: 1,
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

export const TRACKS: Track[] = [
  stemTrack,
  electronicsTrack,
  roboticsTrack,
  codingTrack,
  agriTrack,
];

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
