// STEM course — expansion pack. Broad, all-ages science lessons spliced into
// stemTrack (lessons.ts) so "STEM: Science Starters" is a full course, not a
// three-lesson taster. All original content; Burmese overlay in i18n/my.ts.

import type { Lesson } from "@/lib/learn/lessons";
import { WATER_CYCLE_SVG } from "@/lib/learn/diagrams";

export const STEM_EXTRA: Lesson[] = [
  {
    slug: "states-of-matter",
    title: "States of Matter",
    summary: "Solids, liquids and gases — and how they change.",
    minutes: 7,
    kind: "reading",
      youtubeQuery: "states of matter for kids",
    sections: [
      {
        heading: "Three everyday states",
        body: "Everything around us is made of tiny particles. In a solid they are packed tight and hold a shape (ice). In a liquid they slide past each other and take the container's shape (water). In a gas they fly around freely and spread out (steam).",
      },
      {
        heading: "Changing state",
        body: "Adding heat makes particles move faster: a solid melts into a liquid, and a liquid evaporates into a gas. Removing heat reverses it — a gas condenses and a liquid freezes. The water in a plant moves through all three states in nature.",
      },
    ],
  },
  {
    slug: "the-water-cycle",
    title: "The Water Cycle",
    summary: "How water travels from the sea to the sky and back.",
    minutes: 7,
    kind: "reading",
      youtubeQuery: "the water cycle for kids",
    sections: [
      {
        heading: "Round and round",
        body: "The Sun heats water in oceans and rivers, turning it into invisible vapour — evaporation. High up it cools and forms clouds — condensation. When the drops grow heavy they fall as rain or snow — precipitation. The water flows back to the sea and the cycle repeats.",
        image: {
          src: WATER_CYCLE_SVG,
          alt: "The sun evaporates water from the sea; clouds form and rain falls on land.",
          caption: "Evaporation → clouds → rain → back to the sea.",
        },
      },
      {
        heading: "Why it matters for growing",
        body: "The water cycle waters every plant on Earth for free. Understanding it helps growers collect rainwater, manage humidity, and know why leaves lose water on a hot, dry day.",
      },
    ],
  },
  {
    slug: "forces-and-motion",
    title: "Forces & Motion",
    summary: "Pushes, pulls and the pull of gravity.",
    minutes: 8,
    kind: "reading",
      youtubeQuery: "forces and motion for kids",
    sections: [
      {
        heading: "A force is a push or a pull",
        body: "A force can start something moving, stop it, speed it up, slow it down, or change its direction. Kicking a ball, opening a door and a magnet tugging a nail are all forces at work.",
      },
      {
        heading: "Gravity",
        body: "Gravity is the force that pulls everything toward the Earth — it's why a dropped seed falls and why water runs downhill into the roots. The bigger the object, the stronger its gravity; that's why the Earth holds the Moon in orbit.",
      },
    ],
  },
  {
    slug: "energy-forms",
    title: "Forms of Energy",
    summary: "Light, heat, sound, motion and electricity.",
    minutes: 8,
    kind: "reading",
      youtubeQuery: "forms of energy for kids",
    sections: [
      {
        heading: "Energy makes things happen",
        body: "Energy is the ability to do work or cause change. It comes in forms you meet every day: light from the Sun, heat from a fire, sound from a speaker, movement in a running child, and electricity in a wire.",
      },
      {
        heading: "Energy changes form",
        body: "Energy is never used up — it changes from one form to another. A plant turns light energy into chemical energy (food); a torch turns electrical energy into light; your body turns food into movement and heat.",
      },
    ],
  },
  {
    slug: "simple-machines",
    title: "Simple Machines",
    summary: "Levers, wheels and ramps that make work easier.",
    minutes: 8,
    kind: "reading",
      youtubeQuery: "simple machines for kids",
    sections: [
      {
        heading: "Working smarter",
        body: "A simple machine changes the size or direction of a force so a job feels easier. A lever (like a see-saw or a crowbar) lifts a heavy load with a small push. A ramp lets you raise something gradually instead of straight up.",
      },
      {
        heading: "Wheels and pulleys",
        body: "A wheel and axle rolls a load instead of dragging it, cutting friction. A pulley lets you pull down to lift up — handy for raising water from a well. Most machines you use combine several simple machines.",
      },
    ],
  },
  {
    slug: "magnets",
    title: "Magnets",
    summary: "Invisible forces that attract and repel.",
    minutes: 7,
    kind: "reading",
      youtubeQuery: "how magnets work for kids",
    sections: [
      {
        heading: "Poles attract and repel",
        body: "A magnet has two ends: a north pole and a south pole. Opposite poles pull together (attract); like poles push apart (repel). Magnets attract objects made of iron, nickel and steel, but not wood, plastic or paper.",
      },
      {
        heading: "The Earth is a magnet",
        body: "The Earth itself acts like a giant magnet, which is why a compass needle always points north. Magnets are inside motors, speakers and the sensors on a smart farm.",
      },
    ],
  },
  {
    slug: "electricity-basics",
    title: "Electricity Basics",
    summary: "Current, circuits and staying safe.",
    minutes: 8,
    kind: "reading",
      youtubeQuery: "electricity basics for kids",
    sections: [
      {
        heading: "A flow of tiny charges",
        body: "Electricity is a flow of tiny charged particles called electrons. It only flows around a complete loop — a circuit. Break the loop and the flow stops, just like a switch turning off a light.",
      },
      {
        heading: "Conductors, insulators and safety",
        body: "Materials that let electricity flow are conductors (metals); those that block it are insulators (rubber, plastic). That's why wires have plastic coats. Never experiment with mains electricity — it is dangerous; batteries are the safe way to learn.",
      },
    ],
  },
  {
    slug: "the-human-body",
    title: "The Human Body",
    summary: "The main systems that keep you alive.",
    minutes: 8,
    kind: "reading",
      youtubeQuery: "human body systems for kids",
    sections: [
      {
        heading: "Teams of organs",
        body: "Your body is organised into systems that each do a job. The heart and blood vessels (circulatory system) carry oxygen; the lungs (respiratory system) breathe; the stomach and intestines (digestive system) turn food into fuel; bones and muscles let you move.",
      },
      {
        heading: "Looking after it",
        body: "Good food, clean water, sleep, exercise and washing your hands keep these systems healthy. Plants help too — they make the oxygen your lungs need.",
      },
    ],
  },
  {
    slug: "weather-and-seasons",
    title: "Weather & Seasons",
    summary: "Why the weather changes and seasons happen.",
    minutes: 7,
    kind: "reading",
      youtubeQuery: "weather and seasons for kids",
    sections: [
      {
        heading: "What makes weather",
        body: "Weather is what the air is doing now — sunny, rainy, windy, hot or cold. It comes from the Sun heating the air and water unevenly, which moves clouds and wind around the planet.",
      },
      {
        heading: "Why seasons change",
        body: "The Earth is tilted as it orbits the Sun. When your part of the world leans toward the Sun it gets more direct light and warmth (summer); leaning away brings cooler seasons. Growers plant according to these seasons.",
      },
    ],
  },
  {
    slug: "the-solar-system",
    title: "The Solar System",
    summary: "The Sun, the planets and our place in space.",
    minutes: 8,
    kind: "reading",
      youtubeQuery: "solar system for kids",
    sections: [
      {
        heading: "A family around the Sun",
        body: "Eight planets orbit our star, the Sun, held by gravity. In order from the Sun they are Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune. Earth is the only one we know of with life.",
      },
      {
        heading: "Day, night and the Moon",
        body: "The Earth spins once a day, giving us day and night. The Moon orbits the Earth about once a month and reflects the Sun's light. The Sun's light is also what powers photosynthesis in every plant.",
      },
    ],
  },
  {
    slug: "living-things",
    title: "Living Things",
    summary: "What makes something alive, and how we group life.",
    minutes: 7,
    kind: "reading",
      youtubeQuery: "living things classification for kids",
    sections: [
      {
        heading: "Signs of life",
        body: "Living things grow, need energy (food), respond to their surroundings, and reproduce. A plant, a bird and a bacterium are alive; a rock and a robot are not — a robot can move but it doesn't grow or reproduce.",
      },
      {
        heading: "Plants and animals",
        body: "Plants make their own food from sunlight, so they usually stay in one place. Animals must find and eat food, so they move. Both depend on each other: animals breathe the oxygen plants make, and many plants need animals to spread their seeds.",
      },
    ],
  },
  {
    slug: "measurement",
    title: "Measuring the World",
    summary: "Length, mass, time and temperature — and their units.",
    minutes: 7,
    kind: "reading",
      youtubeQuery: "measurement units for kids",
    sections: [
      {
        heading: "Numbers with units",
        body: "Science measures things so we can compare and repeat them. Length is measured in metres, mass in grams and kilograms, time in seconds, and temperature in degrees Celsius. A measurement always needs a number AND a unit — '5' means nothing; '5 cm' does.",
      },
      {
        heading: "Fair measuring",
        body: "Good scientists use the right tool (a ruler for length, a scale for mass) and read it carefully. On a smart farm, sensors measure temperature, humidity and moisture the same way — turning the world into numbers a computer can chart.",
      },
    ],
  },
  {
    slug: "stem-quiz-2",
    title: "STEM Science Quiz",
    summary: "Check what you learned about matter, forces, energy and space.",
    minutes: 5,
    kind: "quiz",
    quiz: [
      {
        q: "In which state of matter do particles hold a fixed shape?",
        options: ["Solid", "Liquid", "Gas", "None"],
        answer: 0,
        explain: "In a solid the particles are packed tightly and keep their shape.",
      },
      {
        q: "What is evaporation in the water cycle?",
        options: [
          "Rain falling",
          "Water turning into vapour and rising",
          "Clouds forming",
          "Water freezing",
        ],
        answer: 1,
      },
      {
        q: "What force pulls a dropped seed toward the ground?",
        options: ["Magnetism", "Gravity", "Sound", "Electricity"],
        answer: 1,
      },
      {
        q: "A plant turns light energy mainly into…",
        options: [
          "Sound energy",
          "Chemical energy (food)",
          "Electrical energy",
          "Nothing",
        ],
        answer: 1,
        explain: "Photosynthesis stores light energy as chemical energy in sugar.",
      },
      {
        q: "Which simple machine is a see-saw an example of?",
        options: ["A pulley", "A lever", "A wheel", "A ramp"],
        answer: 1,
      },
      {
        q: "Which planet do we live on?",
        options: ["Mars", "Venus", "Earth", "Jupiter"],
        answer: 2,
      },
    ],
  },
];
