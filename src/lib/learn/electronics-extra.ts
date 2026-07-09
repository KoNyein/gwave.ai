// Extra Electronics & IoT lessons taking the course from 4 to 30 lessons.
// Reading lessons with three short sections each, written for all ages, so the
// language stays approachable while still teaching real ideas. Original content
// for GreenWave. Pure data, safe to import from server and client.

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

export const ELECTRONICS_EXTRA: Lesson[] = [
  rd(
    "electricity-flow",
    "What Is Electricity?",
    "The flow of tiny charges that powers everything electronic.",
    7,
    [
      [
        "Moving charge",
        "Everything is made of atoms, and atoms contain tiny particles called electrons that carry a negative electric charge. When electrons move together through a material, that flow is an electric current — the basis of every electronic device.",
      ],
      [
        "Push and flow",
        "Electricity needs a push to move. A battery or power supply provides that push, called voltage. The steady stream of charge it drives around a circuit is the current. No push, no flow — like water sitting still in a level pipe.",
      ],
      [
        "Why it is useful",
        "Moving charge can be turned into light, heat, sound and movement, or used to carry information. That is why one invisible flow can power a lamp, a motor, a phone and a farm sensor alike — we just guide it with the right parts.",
      ],
    ],
  ),
  rd(
    "voltage-current-resistance",
    "Voltage, Current & Resistance",
    "The three ideas at the heart of every circuit.",
    9,
    [
      [
        "A water pipe picture",
        "Imagine water in pipes. Voltage is the pressure pushing the water, current is how much water flows past a point each second, and resistance is how narrow the pipe is. Electricity behaves in a very similar way, which makes this a handy picture.",
      ],
      [
        "Ohm's law",
        "These three connect by a simple rule called Ohm's law: voltage = current × resistance. Raise the voltage and more current flows; raise the resistance and less current flows. Nearly all basic circuit maths starts here.",
      ],
      [
        "Units",
        "Voltage is measured in volts (V), current in amperes or 'amps' (A), and resistance in ohms (Ω). A small LED circuit might run at a few volts and a few thousandths of an amp — small numbers doing useful work.",
      ],
    ],
  ),
  rd(
    "conductors-insulators",
    "Conductors & Insulators",
    "Why electricity flows through some things and not others.",
    7,
    [
      [
        "Conductors let charge through",
        "A conductor is a material that lets electric current flow easily. Most metals — copper, aluminium, gold — are good conductors, which is why wires are made of metal. Their electrons move freely, so charge passes with little resistance.",
      ],
      [
        "Insulators block it",
        "An insulator resists the flow of current. Plastic, rubber, glass and dry wood hold their electrons tightly, so charge cannot pass. The plastic coating on a wire is an insulator that keeps the current inside the metal and keeps you safe.",
      ],
      [
        "In between: semiconductors",
        "Some materials, like silicon, sit between the two and can be made to conduct or not depending on conditions. These 'semiconductors' are the foundation of chips, sensors and the microcontrollers that run smart devices.",
      ],
    ],
  ),
  rd(
    "battery-power",
    "Batteries & Power",
    "Where the push comes from, and how it runs out.",
    8,
    [
      [
        "Storing energy chemically",
        "A battery stores energy in chemicals and releases it as electricity when connected in a circuit. Inside, a reaction pushes electrons out of one end (the negative terminal) and pulls them into the other (the positive), driving current around the loop.",
      ],
      [
        "Voltage and capacity",
        "A battery is rated by its voltage (the push, like 1.5V or 3.7V) and its capacity — how long it can supply current, often in milliamp-hours (mAh). A higher-capacity battery runs a device for longer before it needs recharging or replacing.",
      ],
      [
        "Using power wisely",
        "Every device draws power, and battery-run gadgets — like a wireless farm sensor — must be gentle with it. Sleeping between readings and sending only small messages lets a sensor run for months on one small battery.",
      ],
    ],
  ),
  rd(
    "circuit-components",
    "Meet the Components",
    "The small parts you connect to build a circuit.",
    8,
    [
      [
        "A kit of building blocks",
        "Electronic circuits are built from a handful of standard parts, each with one job. Resistors limit current, capacitors store a little charge, LEDs give light, switches make and break the loop, and wires connect everything together.",
      ],
      [
        "Symbols and values",
        "Each component has a symbol used in diagrams and a value that describes its size — a resistor's resistance in ohms, a capacitor's in farads. Learning to recognise a few symbols lets you read a circuit like a simple map.",
      ],
      [
        "Polarity matters for some",
        "Some parts, like resistors, can go either way round. Others — LEDs, many capacitors, batteries — have a positive and negative side and must be connected the right way, or they will not work (and can be damaged). Always check before powering up.",
      ],
    ],
  ),
  rd(
    "series-parallel",
    "Series & Parallel Circuits",
    "Two ways to wire parts, with very different results.",
    9,
    [
      [
        "Series: one path",
        "In a series circuit the parts sit one after another on a single loop, so the same current flows through each. If one part breaks — like a blown bulb in an old string of lights — the whole loop opens and everything goes out.",
      ],
      [
        "Parallel: shared branches",
        "In a parallel circuit parts sit on separate branches that share the same two connection points. Each branch gets the full voltage, and if one branch breaks the others keep working. House wiring and most real devices use parallel connections.",
      ],
      [
        "Choosing between them",
        "Series is simple and shares current; parallel keeps parts independent and gives each the full voltage. Real circuits often mix both. Knowing which you are looking at explains why a circuit behaves the way it does.",
      ],
    ],
  ),
  rd(
    "switches-buttons",
    "Switches & Buttons",
    "The parts that let you make and break a circuit on purpose.",
    6,
    [
      [
        "Opening and closing the loop",
        "A switch is simply a controlled gap in a circuit. Closed, it completes the loop and current flows; open, it breaks the loop and the current stops. Every light switch on a wall does exactly this.",
      ],
      [
        "Momentary vs. latching",
        "A push button (momentary) only connects while you hold it, then springs back — good for 'press to start'. A latching switch stays where you put it, like a light switch that holds on or off. Each suits different jobs.",
      ],
      [
        "Reading a switch with a computer",
        "A microcontroller can watch a button as an input: it checks whether the pin is connected or not, and runs code when the state changes. This is how a single button can start a pump, silence an alarm, or wake a sleeping sensor.",
      ],
    ],
  ),
  rd(
    "resistors",
    "Resistors",
    "The humble part that keeps current under control.",
    8,
    [
      [
        "Slowing the flow",
        "A resistor limits how much current flows through a part of a circuit. Without one, a sensitive component like an LED could draw too much current and burn out. The resistor 'uses up' some voltage to keep the rest safe.",
      ],
      [
        "Choosing a value",
        "A resistor's value, in ohms, sets how much it limits current — bigger value, less current. Ohm's law tells you which value to pick for a given part and voltage. Getting this right is one of the most common tasks in simple electronics.",
      ],
      [
        "The colour code",
        "Small resistors show their value with coloured bands rather than printed numbers. Each colour stands for a digit, and reading the bands in order gives the value. It looks mysterious at first but becomes quick with a little practice.",
      ],
    ],
  ),
  rd(
    "leds-diodes",
    "LEDs & Diodes",
    "One-way parts that light up or steer current.",
    8,
    [
      [
        "A diode is a one-way valve",
        "A diode lets current flow in one direction only and blocks it in the other. That makes it useful for protecting circuits — for example, stopping damage if a battery is connected the wrong way round.",
      ],
      [
        "The LED",
        "A light-emitting diode (LED) is a diode that glows when current flows through it the right way. LEDs are bright, tough and use very little power, which is why they light everything from screens to torches to indicator lights on devices.",
      ],
      [
        "Always add a resistor",
        "An LED needs a resistor in series to limit its current, or it will draw too much and burn out. And because it is a one-way part, it must be connected the correct way round — the longer leg is usually the positive side.",
      ],
    ],
  ),
  rd(
    "capacitors",
    "Capacitors",
    "A part that stores a little charge and smooths things out.",
    8,
    [
      [
        "Storing charge briefly",
        "A capacitor stores a small amount of electric charge and releases it quickly. Think of a tiny, fast bucket for electricity: it fills up when voltage is applied and empties when the circuit needs a quick top-up.",
      ],
      [
        "Smoothing and timing",
        "Because they fill and empty in a predictable way, capacitors are used to smooth out bumpy power (steadying a wobbly supply) and to create timing delays. Many circuits rely on them to keep signals clean and steady.",
      ],
      [
        "Handle with a little care",
        "Larger capacitors can hold charge even after power is off, and many have a positive and negative side that must be connected correctly. In small hobby circuits they are safe, but it is a good habit to respect them and check their orientation.",
      ],
    ],
  ),
  rd(
    "breadboards",
    "Breadboards: Building Without Solder",
    "The reusable board that makes trying circuits easy.",
    7,
    [
      [
        "Prototyping made simple",
        "A breadboard lets you build a circuit by pushing parts and wires into holes — no soldering, no permanent joins. It is the fastest way to try an idea, and you can pull everything out and start again in seconds.",
      ],
      [
        "How the holes connect",
        "The holes are joined in hidden strips: short rows across the middle connect parts placed in the same row, while long rails down the sides carry power and ground to the whole board. Knowing this pattern is the key to using one.",
      ],
      [
        "From breadboard to real board",
        "Once a circuit works on a breadboard, it can be soldered onto a permanent board for lasting use. Almost every gadget started life as a messy breadboard prototype before becoming a neat finished product.",
      ],
    ],
  ),
  rd(
    "reading-schematics",
    "Reading Circuit Diagrams",
    "The map that shows how a circuit connects.",
    8,
    [
      [
        "A diagram, not a photo",
        "A schematic is a drawing that shows how components connect using symbols and lines, not a picture of the real layout. It cares about the connections, not where each part physically sits, which makes complex circuits easy to follow.",
      ],
      [
        "Symbols and lines",
        "Each part has its own symbol — a zigzag or box for a resistor, a triangle-and-bar for a diode — and lines are wires. A dot where lines cross means they are joined; no dot means they simply pass over each other.",
      ],
      [
        "Power and ground",
        "Most schematics show a power symbol at the top and a ground symbol at the bottom, with the circuit in between. Reading from power down to ground, you can trace the path current takes and understand what each part does.",
      ],
    ],
  ),
  rd(
    "microcontrollers",
    "Microcontrollers",
    "The tiny computer that gives a circuit a brain.",
    9,
    [
      [
        "A whole computer on a chip",
        "A microcontroller is a small, cheap computer on a single chip. It has a processor, a little memory, and pins to connect to the outside world. Boards like Arduino make one easy to program and wire up.",
      ],
      [
        "It reads, decides, acts",
        "The microcontroller runs a program in a loop: read the inputs (sensors, buttons), decide what to do, then control the outputs (lights, motors, messages). This simple cycle is the heart of nearly every smart device.",
      ],
      [
        "The brain of a smart farm node",
        "In a GreenWave sensor, a microcontroller reads the temperature and humidity, checks whether anything needs attention, and sends the readings to the cloud. It is small and low-power, yet it ties the whole device together.",
      ],
    ],
  ),
  rd(
    "digital-analog-signals",
    "Digital & Analog Signals",
    "Two ways electronics carry information.",
    8,
    [
      [
        "Analog: smooth values",
        "An analog signal varies smoothly over a range, like the slow rise of temperature through a day or a dimmer sliding a light from off to full. Many real-world sensors produce analog signals because the world itself changes smoothly.",
      ],
      [
        "Digital: on or off",
        "A digital signal has just two clear states, usually written 1 and 0 (on and off, high and low). Computers work in digital because two clean states are easy to store and copy without error. A button is naturally digital: pressed or not.",
      ],
      [
        "Converting between them",
        "A microcontroller turns an analog sensor reading into a digital number using an analog-to-digital converter (ADC). Once it is a number, the computer can compare it, store it, and send it — bridging the smooth world and the digital one.",
      ],
    ],
  ),
  rd(
    "gpio-inputs-outputs",
    "Inputs & Outputs (GPIO)",
    "How a microcontroller connects to sensors and switches.",
    8,
    [
      [
        "Pins that can go either way",
        "A microcontroller connects to the world through pins, many of them 'general purpose' (GPIO). Each can be set as an input, to read something like a button or sensor, or an output, to control something like an LED or motor.",
      ],
      [
        "Reading an input",
        "As an input, a pin senses whether a voltage is present (high) or not (low), or reads an analog level. The program checks the pin and reacts — for example, turning on a fan when a moisture reading drops too low.",
      ],
      [
        "Driving an output",
        "As an output, a pin can be switched high or low by the program to turn things on and off. Small loads like an LED connect directly; bigger ones like a pump need a helper such as a transistor or relay, covered later.",
      ],
    ],
  ),
  rd(
    "temperature-sensors",
    "Temperature Sensors",
    "Turning warmth into a number a device can use.",
    7,
    [
      [
        "Feeling the heat electronically",
        "A temperature sensor changes its electrical behaviour with heat — its resistance or output voltage shifts as it warms or cools. The microcontroller reads that change and converts it into a temperature in degrees.",
      ],
      [
        "Common types",
        "Simple sensors like a thermistor change resistance with temperature; digital sensors send an exact reading over a data line. Digital ones are easy because they do the maths themselves and just report a clean number.",
      ],
      [
        "Why it matters on a farm",
        "Temperature drives plant growth, disease risk and equipment behaviour, so measuring it well is essential. A GreenWave node logs temperature continuously, letting the dashboard chart it and trigger a fan or heater when it drifts out of range.",
      ],
    ],
  ),
  rd(
    "light-sensors",
    "Light Sensors",
    "Measuring brightness with electronics.",
    7,
    [
      [
        "Turning light into a signal",
        "A light sensor changes its electrical output depending on how much light falls on it. The simplest, a light-dependent resistor (LDR), drops its resistance in bright light and raises it in the dark — an easy signal to read.",
      ],
      [
        "Everyday uses",
        "Light sensors dim your phone screen in the dark, switch street lamps on at dusk, and let a camera set its exposure. Anywhere a device needs to 'notice' brightness, a light sensor is doing the work quietly.",
      ],
      [
        "In growing",
        "For plants, light is food, so knowing how much a crop receives is valuable. A light sensor can confirm a lamp is working, track daily light, or trigger shade — turning the vague idea of 'enough light' into a measured number.",
      ],
    ],
  ),
  rd(
    "moisture-sensors",
    "Moisture Sensors",
    "Knowing when a plant needs water — without guessing.",
    7,
    [
      [
        "Measuring water in soil",
        "A soil moisture sensor gauges how much water is in the growing medium, usually by measuring how easily a small current passes between two points — wetter medium conducts more. The reading tells you whether roots have enough water.",
      ],
      [
        "Reading and reacting",
        "The microcontroller turns the sensor's signal into a moisture level. When it falls below a set point, an automation rule can switch on a pump for a short watering, then stop — watering by data instead of by habit.",
      ],
      [
        "Placement and care",
        "Where you put the sensor matters: too shallow and it dries first, too deep and it lags. Cheaper sensors can corrode over time, so growers check and clean them. A well-placed, well-kept sensor saves both water and worry.",
      ],
    ],
  ),
  rd(
    "motors-servos",
    "Motors & Servos",
    "Making things move with electricity.",
    8,
    [
      [
        "Turning current into motion",
        "A motor turns electrical energy into spinning movement using magnetism. Send current through its coils and a shaft rotates — the basis of fans, pumps, wheels and countless machines. Reverse the current and it spins the other way.",
      ],
      [
        "Servos: motors that aim",
        "A servo is a small motor that moves to a precise angle and holds it, guided by a control signal. It is perfect for jobs like opening a vent a set amount or steering a robot arm, where position matters more than continuous spinning.",
      ],
      [
        "They need their own power",
        "Motors draw far more current than a microcontroller pin can supply, so they get their own power and are switched through a driver or transistor. Connecting a motor straight to a control pin is a common beginner mistake to avoid.",
      ],
    ],
  ),
  rd(
    "relays-switching",
    "Relays: Switching Big Loads",
    "Letting a tiny signal control a powerful device.",
    8,
    [
      [
        "A switch you can control",
        "A relay is an electrically operated switch. A small signal from a microcontroller energises the relay, which flips a much larger, separate circuit on or off. It lets a delicate 3-volt brain control a powerful pump or light safely.",
      ],
      [
        "Keeping the sides apart",
        "The control side and the load side of a relay are kept electrically separate, which protects the microcontroller from the high power it is switching. This separation is a big part of why relays are so widely used.",
      ],
      [
        "In a smart home or farm",
        "Relays are how the GreenWave smart-home switches turn real appliances on and off. A tap in the app sends a signal, a relay clicks, and a fan, pump or light responds — the bridge between software and the physical world.",
      ],
    ],
  ),
  rd(
    "power-safety",
    "Power & Safety",
    "Working with electricity sensibly and safely.",
    8,
    [
      [
        "Low voltage vs. mains",
        "Hobby electronics runs on low, safe voltages — a few volts from batteries or a USB supply. Mains electricity from a wall socket is far higher and can injure or kill. Never open or wire mains devices without proper training and protection.",
      ],
      [
        "Common-sense habits",
        "Disconnect power before changing a circuit, check parts are the right way round, and avoid short circuits (a direct path from plus to minus) which can overheat wires and batteries. Tidy wiring is safe wiring.",
      ],
      [
        "Heat and batteries",
        "If a part or battery gets hot, disconnect it — heat usually means too much current. Treat batteries with care: do not crush, short or overheat them. Respecting these limits keeps both you and your project safe.",
      ],
    ],
  ),
  rd(
    "wifi-networks",
    "Wi-Fi & Networks",
    "How a device joins the internet to share data.",
    8,
    [
      [
        "Talking without wires",
        "Wi-Fi lets a device send and receive data through radio waves instead of cables. A small Wi-Fi chip on a sensor board connects it to a home or farm network, which in turn connects to the wider internet.",
      ],
      [
        "Addresses and routers",
        "On a network, each device has an address so messages reach the right place, and a router directs traffic between them and the internet — like a post office sorting letters. Your data hops through several such stops to reach a server.",
      ],
      [
        "Weak signals and reach",
        "Radio signals fade with distance and walls, so a far-flung farm sensor may struggle on Wi-Fi. That is why IoT devices keep messages small and sometimes use longer-range radios — getting the data out reliably is half the challenge.",
      ],
    ],
  ),
  rd(
    "mqtt-messaging",
    "MQTT: Messaging for Devices",
    "A lightweight way for tiny devices to share readings.",
    9,
    [
      [
        "Publish and subscribe",
        "MQTT is a messaging system built for small, low-power devices. A device 'publishes' a reading to a named topic, and anything interested 'subscribes' to that topic to receive it. Senders and receivers never need to know about each other directly.",
      ],
      [
        "The broker in the middle",
        "A central server called a broker receives every published message and passes it on to the right subscribers. GreenWave runs a broker so many farm sensors can stream data to the dashboard at once, tidily and efficiently.",
      ],
      [
        "Why it suits IoT",
        "MQTT messages are tiny and the protocol copes well with weak or dropped connections, reconnecting and catching up. That makes it ideal for battery sensors on patchy networks — exactly the conditions real farms often have.",
      ],
    ],
  ),
  rd(
    "iot-architecture",
    "How an IoT System Fits Together",
    "From a sensor in the field to a chart on your phone.",
    9,
    [
      [
        "The four stages",
        "A typical IoT system has four parts: the device (sensor plus microcontroller) that measures, the network that carries the data, the cloud that stores and processes it, and the app that shows it to you. Each hands off to the next.",
      ],
      [
        "Data flows one way, control the other",
        "Readings travel up — device to cloud to app — while commands can travel back down: you tap a switch in the app and the message flows to a device that acts. Understanding both directions explains how a smart farm really works.",
      ],
      [
        "Designing for the real world",
        "Good IoT design plans for lost connections, low power and lots of devices. Storing readings when offline and sending them later, keeping messages small, and securing the data are what turn a demo into something dependable.",
      ],
    ],
  ),
  rd(
    "automation-logic",
    "Automation: If This, Then That",
    "Turning readings into actions without a human.",
    8,
    [
      [
        "Rules that watch and act",
        "Automation is a set of rules of the form 'if a condition is met, do an action'. If humidity rises above 70%, turn on the fan. If soil moisture drops too low, run the pump. The system checks the rules constantly and acts on its own.",
      ],
      [
        "Thresholds and hysteresis",
        "A rule needs a threshold — the level that triggers it. To stop a device flicking on and off around that level, good rules use a gap: turn the fan on at 70% but off only at 60%. This gap keeps behaviour steady and gentle on equipment.",
      ],
      [
        "Keeping a human in charge",
        "Automation handles the routine, but people set the rules and can always override them. The GreenWave farm dashboard lets you build these rules and see what they did — the machine acts, but you stay in control.",
      ],
    ],
  ),
  rd(
    "soldering-troubleshooting",
    "Soldering & Troubleshooting",
    "Making lasting joins and finding faults.",
    9,
    [
      [
        "Soldering basics",
        "Soldering joins parts permanently by melting a soft metal (solder) to bond them and carry current. A hot iron does the work, so it demands respect: hold parts steady, heat the joint briefly, and let it cool. Always work in fresh air and never touch the tip.",
      ],
      [
        "A good joint",
        "A good solder joint is shiny and smooth, wrapping the connection neatly. A dull, blobby or cracked joint may not conduct and is a common cause of circuits that half-work. Learning to spot a bad joint saves hours of confusion.",
      ],
      [
        "Finding the fault",
        "When a circuit misbehaves, troubleshoot step by step: check power is present, connections are right, and parts face the correct way. Change one thing at a time and test. Patient, methodical checking finds almost every fault in the end.",
      ],
    ],
  ),
];
