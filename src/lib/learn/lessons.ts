// Age-banded learning content for the /learn platform. Pure data + helpers,
// safe to import from server and client components. No database needed —
// content is versioned in code so it works offline and is easy to review.

import type { AgeBand } from "@/lib/age";
import { AGRI_EXTRA } from "@/lib/learn/agri-extra";
import { ELECTRONICS_EXTRA } from "@/lib/learn/electronics-extra";
import { ROBOTICS_EXTRA } from "@/lib/learn/robotics-extra";
import { STEM_EXTRA } from "@/lib/learn/stem-extra";

export type LessonKind =
  | "reading"
  | "quiz"
  | "code"
  | "robot"
  | "circuit"
  | "python"
  | "sql";

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: number; // index into options
  explain?: string;
}

export interface LessonSection {
  heading: string;
  body: string;
  /** Optional code sample rendered as a formatted block under the body. */
  code?: string;
  /**
   * Optional teaching image/diagram shown under the body. `src` can be any
   * image URL or an inline SVG data URI. Teachers can point this at their own
   * photo; the caption is localized via the overlay.
   */
  image?: { src: string; alt: string; caption?: string };
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
  /** For python lessons: starter script for the Pyodide playground. */
  pythonCode?: string;
  /** For sql lessons: starter query for the sql.js playground. */
  sqlCode?: string;
  /** Optional YouTube video id embedded at the top of the lesson. */
  youtubeId?: string;
  /**
   * Optional topic to surface a "Learn on YouTube" link (a search, opened in
   * a new tab) when no specific youtubeId is pinned. Localized via the
   * overlay so Myanmar learners get Burmese results.
   */
  youtubeQuery?: string;
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
  title: "STEM: Science Starters",
  description:
    "Fun science — matter, energy, forces, the body, weather and space — for every curious learner.",
  icon: "FlaskConical",
  bands: ["child", "preteen", "teen", "adult"],
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
    ...STEM_EXTRA,
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
    ...ELECTRONICS_EXTRA,
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
        {
          q: "Ohm's law says voltage equals…",
          options: [
            "current + resistance",
            "current × resistance",
            "current − resistance",
            "resistance ÷ current",
          ],
          answer: 1,
          explain: "V = I × R ties voltage, current and resistance together.",
        },
        {
          q: "Which material is a good conductor?",
          options: ["Rubber", "Copper", "Glass", "Dry wood"],
          answer: 1,
          explain: "Metals like copper let current flow easily; plastic and glass insulate.",
        },
        {
          q: "Why does an LED need a resistor in series?",
          options: [
            "To make it brighter",
            "To limit current so it does not burn out",
            "To change its colour",
            "It does not need one",
          ],
          answer: 1,
        },
        {
          q: "In a series circuit, if one part breaks…",
          options: [
            "Nothing changes",
            "The whole loop opens and current stops",
            "Only that part keeps working",
            "The voltage doubles",
          ],
          answer: 1,
        },
        {
          q: "What is a microcontroller?",
          options: [
            "A type of battery",
            "A tiny computer on a chip that reads inputs and controls outputs",
            "A kind of wire",
            "A screen",
          ],
          answer: 1,
        },
        {
          q: "What does a relay let you do?",
          options: [
            "Store files",
            "Use a small signal to switch a much larger, separate circuit",
            "Measure temperature",
            "Charge a phone faster",
          ],
          answer: 1,
        },
        {
          q: "A good automation rule uses a gap (turn on at 70%, off at 60%) to…",
          options: [
            "Save files",
            "Stop the device rapidly flicking on and off around one level",
            "Increase voltage",
            "Make the sensor faster",
          ],
          answer: 1,
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
    ...ROBOTICS_EXTRA,
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
        {
          q: "What is an actuator on a robot?",
          options: [
            "A part that senses light",
            "A part that turns energy into movement",
            "A type of battery",
            "The robot's map",
          ],
          answer: 1,
          explain: "Actuators — like motors — are a robot's muscles.",
        },
        {
          q: "Closed-loop control is better than open-loop because it…",
          options: [
            "Uses no sensors",
            "Measures the real result and corrects itself",
            "Is always cheaper",
            "Runs without power",
          ],
          answer: 1,
        },
        {
          q: "A 'degree of freedom' is…",
          options: [
            "A temperature reading",
            "One independent way a robot can move",
            "A kind of wheel",
            "A battery level",
          ],
          answer: 1,
        },
        {
          q: "Inverse kinematics answers which question?",
          options: [
            "What is the battery level?",
            "What joint angles put the tip at this exact spot?",
            "How hot is the motor?",
            "What colour is the object?",
          ],
          answer: 1,
        },
        {
          q: "How does a line-following robot stay on the line?",
          options: [
            "It memorises the whole floor",
            "It makes small constant corrections when it drifts off",
            "It uses GPS only",
            "It cannot turn",
          ],
          answer: 1,
        },
        {
          q: "Why is obstacle avoidance especially important for robots near people?",
          options: [
            "To save battery",
            "For safety — to stop or steer before a collision",
            "To go faster",
            "To store more data",
          ],
          answer: 1,
        },
        {
          q: "Why do farm drones fly over fields?",
          options: [
            "To water every plant directly",
            "To spot dry patches, pests or sick plants quickly from above",
            "To replace the soil",
            "To charge the sensors",
          ],
          answer: 1,
        },
        {
          q: "A robot that learns from trial and error often practises first in…",
          options: [
            "A simulation, safely, before the real world",
            "A locked box forever",
            "No environment at all",
            "The cloud only",
          ],
          answer: 0,
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
      slug: "plant-nutrients",
      title: "Plant Nutrients",
      summary: "The elements a plant needs — and how to read a deficiency.",
      minutes: 10,
      kind: "reading",
      sections: [
        {
          heading: "Macronutrients: N, P, K",
          body: "Three elements are needed in the largest amounts. Nitrogen (N) drives green, leafy growth. Phosphorus (P) supports roots, flowers and fruit. Potassium (K) keeps the whole plant healthy and helps it move water and resist stress. The numbers on a nutrient bottle — like 5-10-5 — are the N-P-K ratio.",
        },
        {
          heading: "Micronutrients matter too",
          body: "Plants also need small amounts of calcium, magnesium, sulfur, iron, zinc and more. They are needed in tiny quantities, but a shortage of even one can stall growth. A balanced feed supplies them together.",
        },
        {
          heading: "Reading a deficiency",
          body: "Leaves are the plant's status screen. Older leaves turning pale or yellow often means low nitrogen, since the plant moves it to new growth. Yellowing between the veins can signal iron or magnesium shortage. Match the symptom to the feed before guessing.",
        },
        {
          heading: "Feed by growth stage",
          body: "Young plants in vegetative growth want more nitrogen; flowering and fruiting plants want more phosphorus and potassium. Adjusting the mix as the crop matures is the heart of feeding — and every change should be logged so you can repeat what works.",
        },
      ],
    },
    {
      slug: "light-and-spectrum",
      title: "Light & Spectrum",
      summary: "PPFD, DLI and photoperiod — measuring the light a crop gets.",
      minutes: 10,
      kind: "reading",
      sections: [
        {
          heading: "Light is food",
          body: "Photosynthesis runs on light, so light is effectively a crop's energy budget. Plants mostly use the wavelengths we see as blue and red; blue-rich light keeps growth compact, while red light encourages stretching and flowering.",
        },
        {
          heading: "PPFD and DLI",
          body: "PPFD (photosynthetic photon flux density) measures how much usable light lands on the canopy each second. DLI (daily light integral) adds that up over a whole day. Together they tell you whether a crop is under-lit or getting plenty — far more useful than a lamp's watts.",
        },
        {
          heading: "Photoperiod: the day-length switch",
          body: "Many plants flower based on how many hours of darkness they get. Long-day and short-day crops respond differently, so growers control the light schedule with a timer. Keeping the dark period truly dark is as important as the light hours.",
        },
      ],
    },
    {
      slug: "pest-management",
      title: "Integrated Pest Management",
      summary: "Prevent, monitor and respond to pests with the least harm.",
      minutes: 9,
      kind: "reading",
      sections: [
        {
          heading: "Prevention first",
          body: "Integrated Pest Management (IPM) treats chemicals as a last resort. Most problems are avoided by clean tools, healthy airflow, quarantining new plants and keeping the growing area tidy. A strong plant resists pests far better than a stressed one.",
        },
        {
          heading: "Scout regularly",
          body: "Check plants often — under leaves especially — and note what you see. Sticky traps reveal flying pests early. Catching an infestation while it is small is the difference between wiping a leaf and losing a crop.",
        },
        {
          heading: "Respond in steps",
          body: "Start with the gentlest fix: remove affected leaves, adjust humidity, or introduce beneficial insects that eat the pest. Escalate only if needed, and always identify the pest first — the wrong treatment wastes time and can harm the plant.",
        },
      ],
    },
    {
      slug: "harvest-and-curing",
      title: "Harvest, Drying & Curing",
      summary: "Timing and after-care that decide final quality.",
      minutes: 9,
      kind: "reading",
      sections: [
        {
          heading: "Knowing when to harvest",
          body: "Harvest timing shapes potency, flavour and weight. Growers watch maturity signs on the plant rather than the calendar — colour changes and ripeness cues that develop in the final weeks. Harvesting too early or too late both cost quality.",
        },
        {
          heading: "Drying slowly",
          body: "After harvest, plants are dried slowly in a cool, dark, ventilated space over one to two weeks. Rushing it with heat traps harsh compounds and ruins aroma; drying too slowly risks mould. Steady temperature and humidity are everything.",
        },
        {
          heading: "Curing for quality",
          body: "Curing stores the dried harvest in sealed containers, opened briefly each day, for several weeks. This gentle process smooths flavour and improves the final product. Logging temperature and humidity — the same habit the GreenWave dashboard encourages — makes good results repeatable.",
        },
      ],
    },
    ...AGRI_EXTRA,
    {
      slug: "agri-quiz",
      title: "Agri-Science Quiz",
      summary: "Check your growing, nutrient and harvest knowledge.",
      minutes: 6,
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
          q: "In an N-P-K ratio, what does the N stand for?",
          options: ["Nickel", "Nitrogen", "Neon", "Sodium"],
          answer: 1,
          explain: "Nitrogen drives leafy, vegetative growth.",
        },
        {
          q: "What does DLI (daily light integral) describe?",
          options: [
            "The colour of the light",
            "Total usable light a crop receives over a day",
            "The price of a lamp",
            "The soil pH",
          ],
          answer: 1,
        },
        {
          q: "What is the first choice in Integrated Pest Management?",
          options: [
            "Spray strong chemicals immediately",
            "Prevention and regular scouting",
            "Remove all the plants",
            "Ignore it",
          ],
          answer: 1,
          explain: "IPM prevents and monitors first, using chemicals only as a last resort.",
        },
        {
          q: "Why is curing done slowly in sealed containers?",
          options: [
            "To dry it faster with heat",
            "To smooth flavour and improve quality over weeks",
            "To add weight with water",
            "It has no effect",
          ],
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
        {
          q: "A deficiency showing on older, lower leaves first usually points to a…",
          options: [
            "Immobile nutrient",
            "Mobile nutrient the plant moved to new growth",
            "Light problem",
            "Pest",
          ],
          answer: 1,
          explain: "Mobile nutrients like N, P, K and Mg are relocated to new leaves.",
        },
        {
          q: "Why do roots need a medium with air in it?",
          options: [
            "Roots photosynthesise",
            "Roots need oxygen and suffocate in waterlogged medium",
            "Air adds nutrients",
            "It keeps pests away",
          ],
          answer: 1,
          explain: "Over-watering starves roots of oxygen and causes rot.",
        },
        {
          q: "VPD (vapour pressure deficit) combines which two readings?",
          options: [
            "pH and EC",
            "Temperature and humidity",
            "Light and CO₂",
            "Weight and time",
          ],
          answer: 1,
        },
        {
          q: "Adding CO₂ mainly helps growth only when…",
          options: [
            "The room is dark",
            "Light is already strong and other factors are not the limit",
            "Humidity is very low",
            "Plants are seedlings",
          ],
          answer: 1,
        },
        {
          q: "What is the point of topping a plant during vegetative growth?",
          options: [
            "To kill pests",
            "To turn one main shoot into multiple even tops",
            "To flower it faster",
            "To reduce watering",
          ],
          answer: 1,
        },
        {
          q: "A grow journal is valuable mainly because it lets you…",
          options: [
            "Skip watering",
            "Link a result back to the conditions and decisions that caused it",
            "Avoid all pests",
            "Grow without light",
          ],
          answer: 1,
        },
      ],
    },
  ],
};

import { WEBDEV_TRACKS } from "@/lib/learn/webdev";
import { SQL_AI_TRACKS } from "@/lib/learn/courses-sql-ai";
import { pseudocodeTrack } from "@/lib/learn/pseudocode";

export const TRACKS: Track[] = [
  stemTrack,
  electronicsTrack,
  roboticsTrack,
  pseudocodeTrack,
  ...WEBDEV_TRACKS,
  ...SQL_AI_TRACKS,
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
