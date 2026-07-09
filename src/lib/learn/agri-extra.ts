// Extra agriculture lessons taking the Applied Agri-Science course from 6 to 30
// lessons. All are reading lessons with three short sections each. Original
// tutorial content written for GreenWave growers. Pure data, safe to import
// from server and client.

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

const AGRI_YT: Record<string, string> = {
  "seed-starting": "seed germination for beginners",
  "cloning-cuttings": "how to clone plants from cuttings",
  "transplanting": "how to transplant seedlings",
  "growing-media": "hydroponic growing media explained",
  "water-quality": "water quality for hydroponics",
  "ph-management": "managing pH in hydroponics",
  "ec-ppm-mixing": "EC PPM nutrient mixing tutorial",
  "deficiency-guide": "plant nutrient deficiency guide",
  "nutrient-toxicity": "nutrient burn and flushing plants",
  "root-health": "healthy roots hydroponics",
  "vpd-transpiration": "VPD vapor pressure deficit growing",
  "climate-control": "grow room temperature humidity",
  "co2-enrichment": "CO2 enrichment for plants",
  "airflow-ventilation": "grow room airflow ventilation",
  "plant-training": "low stress training LST topping",
  "trellising-scrog": "SCROG screen of green tutorial",
  "flowering-stages": "plant flowering stages explained",
  "breeding-pollination": "plant breeding pollination basics",
  "common-pests": "identifying common garden pests",
  "common-diseases": "common plant diseases powdery mildew",
  "beneficial-insects": "beneficial insects biological pest control",
  "organic-vs-mineral": "organic vs synthetic nutrients",
  "post-harvest-storage": "curing and storing harvest",
  "grow-journal-data": "grow journal record keeping"
};

const AGRI_EXTRA_BASE: Lesson[] = [
  rd(
    "seed-starting",
    "Seeds & Germination",
    "Waking a seed and giving a seedling its best start.",
    9,
    [
      [
        "What a seed needs",
        "A seed sprouts when it has moisture, warmth and air — light is usually not needed until the shoot appears. Most seeds germinate best around 22–26°C in a damp, well-aired medium that is never waterlogged. Too wet and the seed rots; too dry and it stalls.",
      ],
      [
        "Simple, reliable methods",
        "Growers start seeds in damp paper, small plugs, or directly in the final medium. Plant at a depth of about twice the seed's width and keep humidity high until the first leaves open. A clear cover holds moisture while the seedling is fragile.",
      ],
      [
        "The delicate seedling stage",
        "A new seedling has tiny roots and little energy reserve, so keep light gentle and feed weak or not at all at first. Overwatering is the most common killer — the medium should dry slightly between waterings so roots reach out and breathe.",
      ],
    ],
  ),
  rd(
    "cloning-cuttings",
    "Cloning from Cuttings",
    "Copying a favourite plant instead of starting from seed.",
    10,
    [
      [
        "Why clone",
        "A cutting taken from a healthy 'mother' plant grows into an exact genetic copy. Cloning skips germination, keeps the traits you like, and gives an even crop where every plant behaves the same — a big advantage for planning a grow.",
      ],
      [
        "Taking a cutting",
        "Cut a healthy young shoot with a clean, sharp blade just below a node, remove the lower leaves, and place it in a moist medium or water. Rooting hormone speeds things up. High humidity and gentle light keep the cutting alive while it has no roots yet.",
      ],
      [
        "Rooting and care",
        "Roots usually appear in one to two weeks. Keep humidity high at first, then lower it gradually to 'harden' the clone before moving it to full light. A rooted, hardened clone transplants just like a seedling — and carries none of a seed's genetic surprises.",
      ],
    ],
  ),
  rd(
    "transplanting",
    "Transplanting & Potting Up",
    "Moving plants to bigger homes without setting them back.",
    8,
    [
      [
        "When to pot up",
        "A plant is ready for a bigger container when its roots fill the current one — you may see roots at the drainage holes or growth slowing. Moving up in stages (small to medium to large) keeps the root zone from staying soggy in an oversized pot.",
      ],
      [
        "Gentle handling",
        "Water lightly before transplanting so the root ball holds together, then support the stem and lift from below — never pull by the stem. Settle the plant at the same depth it grew before and firm the medium gently around it to remove air pockets.",
      ],
      [
        "Reducing transplant shock",
        "Transplant in low light or the cooler part of the day, water in well, and expect a short pause before growth resumes. Avoid feeding heavily right away. Handled carefully, a plant barely notices the move; handled roughly, it can sulk for a week.",
      ],
    ],
  ),
  rd(
    "growing-media",
    "Growing Media & Substrates",
    "Coco, rockwool, perlite and soil — what roots actually sit in.",
    10,
    [
      [
        "The job of a medium",
        "A growing medium holds the plant up, stores water and nutrients, and — just as important — holds air for the roots. The best medium for you balances water retention against drainage and airflow for your watering style and climate.",
      ],
      [
        "Common choices",
        "Soil and compost are forgiving and full of life. Coco coir drains well and is easy to feed precisely. Rockwool holds lots of water and suits automated systems. Perlite and clay pebbles add air and drainage, often mixed into other media.",
      ],
      [
        "Matching medium to method",
        "Fast-draining media like coco and perlite want frequent, precise feeding; water-holding media like rockwool and soil are watered less often. Choosing the medium and the watering plan together — not separately — is what keeps roots healthy.",
      ],
    ],
  ),
  rd(
    "water-quality",
    "Water Quality",
    "Your source water shapes everything you feed after it.",
    9,
    [
      [
        "Start by knowing your water",
        "Every feed begins with water, and water is rarely pure. Tap water carries dissolved minerals measured as a starting EC or PPM. Knowing that baseline matters, because those minerals add to whatever nutrients you mix in.",
      ],
      [
        "Hardness and alkalinity",
        "'Hard' water is high in calcium and magnesium and resists pH change (high alkalinity). That can be helpful or a nuisance depending on your feed. Very hard water may need less added cal-mag; very soft or RO water often needs some added back.",
      ],
      [
        "When to filter",
        "If source water is very high in minerals or contaminants, a reverse-osmosis (RO) filter strips it back to near-zero so you control exactly what goes in. RO is not always necessary — for many growers, knowing and adjusting for their tap water is enough.",
      ],
    ],
  ),
  rd(
    "ph-management",
    "Managing pH",
    "Why the right pH unlocks the nutrients already in the tank.",
    10,
    [
      [
        "pH controls uptake",
        "pH measures how acidic or alkaline the solution is, from 0 to 14. It matters because roots can only absorb each nutrient within a certain pH window. Even a perfectly mixed feed is useless if the pH locks the nutrients away.",
      ],
      [
        "Target ranges",
        "Most hydroponic and coco crops take up nutrients best around pH 5.5–6.2; soil runs a little higher, roughly 6.0–6.8. Because different nutrients peak at slightly different points, letting pH drift gently across the range can help everything get absorbed.",
      ],
      [
        "Adjusting safely",
        "Mix nutrients first, then adjust pH with small amounts of pH-up or pH-down, stirring and re-measuring as you go. Add acid or base slowly — a little goes a long way. Check pH regularly, as it shifts as plants drink and as the solution ages.",
      ],
    ],
  ),
  rd(
    "ec-ppm-mixing",
    "EC, PPM & Mixing Feed",
    "Measuring feed strength and mixing it in the right order.",
    10,
    [
      [
        "Two scales, one idea",
        "EC (electrical conductivity) and PPM (parts per million) both describe how strong a nutrient solution is. EC is the direct measurement; PPM is converted from it using a scale (500 or 700), which is why two meters can show different PPM for the same tank. Pick one scale and stay with it.",
      ],
      [
        "Feed by strength and stage",
        "Seedlings and clones want a weak feed; plants in full growth want more. Rather than guessing, mix to a target EC for the stage, then watch the plants and the run-off. Rising run-off EC means they are drinking water faster than food — a sign to dilute.",
      ],
      [
        "Mix in the right order",
        "Add nutrients to water one part at a time, stirring between each — never pour concentrates together, or they can react and lock out. Add cal-mag or part A first, then the others, then check EC, and only then adjust pH. Order keeps everything available.",
      ],
    ],
  ),
  rd(
    "deficiency-guide",
    "Reading Nutrient Deficiencies",
    "Turning leaf symptoms into a diagnosis.",
    11,
    [
      [
        "Mobile vs. immobile",
        "Where a symptom appears tells you a lot. Mobile nutrients (nitrogen, phosphorus, potassium, magnesium) are moved from old leaves to new ones, so shortages show on lower, older leaves first. Immobile nutrients (calcium, iron, sulfur) show on new top growth.",
      ],
      [
        "Common patterns",
        "Whole older leaves paling to yellow suggests nitrogen. Yellowing between the veins of older leaves points to magnesium; the same on new leaves points to iron. Purple stems and dull leaves can mean phosphorus; scorched leaf edges often mean potassium.",
      ],
      [
        "Confirm before you feed",
        "Symptoms overlap, and pH problems mimic deficiencies by locking nutrients out. Before adding more of anything, check pH and EC — the true fix is often correcting pH, not piling on nutrients. Change one thing at a time and log what you did.",
      ],
    ],
  ),
  rd(
    "nutrient-toxicity",
    "Overfeeding, Lockout & Flushing",
    "When too much food becomes the problem.",
    9,
    [
      [
        "Too much is a problem too",
        "Plants can be overfed. High EC draws water back out of the roots ('nutrient burn'), showing as scorched, clawing leaf tips. More is not better — a moderate, steady feed beats a strong one the plant cannot use.",
      ],
      [
        "Lockout",
        "When one nutrient is far too high, or pH is wrong, it can block the uptake of others — 'lockout'. The plant shows a deficiency even though the nutrient is present in the tank. Piling on more of the missing element makes it worse, not better.",
      ],
      [
        "Flushing to reset",
        "Running plain, pH-corrected water through the medium washes out built-up salts and resets the root zone. Growers flush when EC climbs too high, before switching feeds, and sometimes near harvest. After flushing, resume feeding gently and rebuild strength.",
      ],
    ],
  ),
  rd(
    "root-health",
    "Root Health & Oxygen",
    "Healthy roots are white, and white roots need air.",
    9,
    [
      [
        "Roots breathe",
        "Roots need oxygen as much as water. In waterlogged, airless medium they suffocate and rot. This is why good drainage and air-filled pores matter, and why over-watering — not under-watering — kills more plants than almost anything else.",
      ],
      [
        "Root rot and its signs",
        "Starved of oxygen, roots turn brown and slimy and the plant wilts even when the medium is wet. Warm, stagnant water in hydroponic systems invites it. Cool, moving, oxygen-rich solution and clean equipment are the best prevention.",
      ],
      [
        "Helpful microbes",
        "A living root zone is not sterile. Beneficial fungi and bacteria (such as mycorrhizae and Trichoderma) partner with roots, helping them take up nutrients and crowding out disease. Feeding this quiet underground community pays off above ground.",
      ],
    ],
  ),
  rd(
    "vpd-transpiration",
    "VPD & Transpiration",
    "How temperature and humidity together drive a plant's drinking.",
    10,
    [
      [
        "Plants breathe through leaves",
        "Tiny pores called stomata open to take in CO₂ and let water vapour out — transpiration. That flow pulls water and nutrients up from the roots. When conditions stop transpiration, feeding slows even if the tank is full.",
      ],
      [
        "What VPD means",
        "Vapour pressure deficit (VPD) combines temperature and humidity into one number describing how strongly the air pulls moisture from the leaf. Too low (cool and humid) and the plant barely transpires; too high (warm and dry) and it closes its stomata to avoid drying out.",
      ],
      [
        "Dialling it in by stage",
        "Seedlings and clones like a low VPD (humid, gentle); mature plants handle a higher VPD. Growers adjust temperature and humidity together to hit a target range for the stage — the GreenWave VPD calculator turns the two readings into that single figure.",
      ],
    ],
  ),
  rd(
    "climate-control",
    "Temperature & Humidity by Stage",
    "Setting the climate a crop wants as it grows.",
    9,
    [
      [
        "Different stages, different climates",
        "A crop's ideal climate changes as it grows. Clones and seedlings want warm, humid air; vegetative plants like warm and moderately humid; flowering plants usually prefer slightly cooler and drier air to protect quality and deter mould.",
      ],
      [
        "Day and night",
        "A modest temperature drop at night is normal and healthy, but a large swing stresses plants and can cause condensation — a mould risk. Aim for a steady day setting and a gentle, controlled night drop rather than wild changes.",
      ],
      [
        "Tools of control",
        "Heaters, fans, humidifiers and dehumidifiers hold the range, and sensors plus automation rules keep it steady without constant attention. The GreenWave farm dashboard logs the climate over time so you can link a result back to the conditions that produced it.",
      ],
    ],
  ),
  rd(
    "co2-enrichment",
    "CO₂ Enrichment",
    "Adding carbon dioxide — when it helps and when it wastes money.",
    9,
    [
      [
        "CO₂ is a raw material",
        "Photosynthesis combines light, water and carbon dioxide. Normal air holds about 400 ppm of CO₂. In a sealed, brightly lit room, plants can use more than the air supplies, so adding CO₂ can raise growth — but only if other factors are not the limit.",
      ],
      [
        "It only helps when light is high",
        "Extra CO₂ does nothing if light is the bottleneck. Enrichment pays off only under strong lighting and a warm, well-managed climate. Below that, the money spent on CO₂ would do more good improving light or airflow first.",
      ],
      [
        "Safety and control",
        "CO₂ at high levels is dangerous to people, so enrichment needs a controller, good sealing and monitoring — never guesswork. For most home-scale growers, simply ensuring fresh air exchange to keep CO₂ from dropping below normal is enough.",
      ],
    ],
  ),
  rd(
    "airflow-ventilation",
    "Airflow & Ventilation",
    "Moving air keeps plants strong and disease away.",
    8,
    [
      [
        "Two kinds of air movement",
        "Growers need both air exchange (swapping stale room air for fresh) and internal airflow (a gentle breeze over the canopy). Exchange manages heat, humidity and CO₂; internal airflow strengthens stems and dries leaf surfaces that mould would love.",
      ],
      [
        "A gentle, even breeze",
        "Leaves should flutter slightly, not thrash. Aim for movement through the whole canopy, above and below, with no dead, stagnant corners where humidity pools. Stagnant pockets are exactly where mould and pests take hold first.",
      ],
      [
        "Filtering and balance",
        "Extraction fans, intake and carbon filters keep air fresh and odour down. Balance intake and extraction so the space neither over-pressurises nor pulls unfiltered air through gaps. Good airflow is quiet, constant, and easy to forget once it is right.",
      ],
    ],
  ),
  rd(
    "plant-training",
    "Plant Training: LST & Topping",
    "Shaping a plant for more light and a bigger yield.",
    10,
    [
      [
        "Why train",
        "Left alone, many plants grow one tall central stem that hogs the light. Training spreads the plant out so more branches sit in strong light, turning one dominant top into many even ones — usually a bigger, more uniform harvest.",
      ],
      [
        "Low-stress training (LST)",
        "LST gently bends and ties branches outward and down, opening the centre to light without cutting. It is forgiving and works on almost any plant. Do it while stems are young and flexible, and adjust the ties as the plant grows.",
      ],
      [
        "Topping and pinching",
        "Topping removes the very tip of a stem, prompting the plant to grow two main shoots instead of one; repeated, it builds a bushy, even canopy. These are 'high-stress' techniques — do them during vegetative growth and give the plant time to recover before flowering.",
      ],
    ],
  ),
  rd(
    "trellising-scrog",
    "Trellising & SCROG",
    "Supporting the canopy so light and weight are shared.",
    9,
    [
      [
        "Why support the canopy",
        "As plants grow heavy with flower, branches can bend or snap. A trellis or net holds them up, keeps the canopy flat and even, and spaces the tops so light reaches them all. Support is planning ahead, not a rescue after a branch breaks.",
      ],
      [
        "The SCROG method",
        "Screen of Green (SCROG) stretches a horizontal net over the plants and tucks growing shoots under and through it, weaving them across the screen. The result is a flat, even 'table' of tops, each in strong light — efficient use of a fixed light footprint.",
      ],
      [
        "Working the net",
        "Tuck and weave during vegetative growth and early flower, while stems still bend easily; stop once flowers set and stems stiffen. A well-worked screen turns a few plants into a wide, productive canopy without extra lights.",
      ],
    ],
  ),
  rd(
    "flowering-stages",
    "The Flowering Cycle",
    "What happens after a plant switches to making flowers.",
    10,
    [
      [
        "The switch to flower",
        "Many crops begin flowering when the dark period lengthens (or, for auto-flowering types, simply with age). For the first week or two the plant stretches, often doubling in height, before it settles into building flowers — plan headroom for that stretch.",
      ],
      [
        "Building the harvest",
        "Through mid-flower the plant pours energy into forming and fattening flowers. Its appetite shifts toward phosphorus and potassium and away from nitrogen. Steady climate and light now pay off directly in the final weight and quality.",
      ],
      [
        "Ripening",
        "In the final weeks flowers mature and ripen — colours and aromas develop and the plant slows. Watching these ripeness cues, not just counting days, tells you when to harvest. The last stretch is where patience is rewarded or lost.",
      ],
    ],
  ),
  rd(
    "breeding-pollination",
    "Breeding & Pollination Basics",
    "How new seeds — and new varieties — are made.",
    9,
    [
      [
        "Male, female and seeds",
        "Many crops have separate male and female plants. Females make the flowers growers usually want; males make pollen. When pollen reaches a female flower, it makes seeds. Growers who want seedless flower keep males well away.",
      ],
      [
        "Making a cross",
        "To breed a new variety, a grower pollinates a chosen female with a chosen male, capturing traits from both parents in the seeds. Careful selection over generations — keeping the best, discarding the rest — is how stable new varieties are built.",
      ],
      [
        "Preserving genetics",
        "Seeds store a line for the future, and cloning preserves a single prized plant exactly. Labelling, dating and keeping records of each cross or clone is essential — good breeding is as much bookkeeping as it is biology.",
      ],
    ],
  ),
  rd(
    "common-pests",
    "Identifying Common Pests",
    "Knowing the usual suspects before they spread.",
    10,
    [
      [
        "Sap-suckers",
        "Spider mites, aphids and thrips pierce leaves and drink sap, leaving stippling, curling or silvery scars. Spider mites are tiny and hide under leaves, sometimes with fine webbing; aphids cluster on soft new growth; thrips leave pale, scratchy trails.",
      ],
      [
        "Fliers and soil dwellers",
        "Whiteflies scatter up in a cloud when a plant is shaken. Fungus gnats hover around wet medium and their larvae nibble roots — usually a sign the medium is staying too wet. Sticky traps catch the adults and reveal a problem early.",
      ],
      [
        "Catching them early",
        "The key defence is regular, close inspection, especially under leaves and on new growth. A pest found while it is a few insects is easy to remove; the same pest found after a week can be a crop-wide infestation. Scout, don't wait.",
      ],
    ],
  ),
  rd(
    "common-diseases",
    "Common Plant Diseases",
    "The moulds and rots growers meet most — and how to avoid them.",
    10,
    [
      [
        "Powdery mildew",
        "Powdery mildew appears as white, dusty patches on leaves, thriving in humid, still air with poor circulation. Prevention beats cure: keep humidity in range, keep air moving, and remove affected leaves early before spores spread.",
      ],
      [
        "Bud rot and moulds",
        "Grey mould (botrytis) attacks dense flowers from the inside in cool, damp, still conditions, turning them brown and mushy. Good airflow, controlled humidity in late flower, and not letting the canopy stay wet are the main defences.",
      ],
      [
        "Root and stem diseases",
        "Damping-off fells seedlings at the soil line; root rots follow waterlogged, airless media. Clean tools, fresh medium, careful watering and healthy oxygen levels prevent most of them. Once rot sets in, prevention on the next crop matters more than heroics on this one.",
      ],
    ],
  ),
  rd(
    "beneficial-insects",
    "Beneficial Insects & Biocontrol",
    "Fighting pests with other living things instead of sprays.",
    9,
    [
      [
        "Nature's pest control",
        "Biological control uses helpful creatures to eat or parasitise pests. Ladybirds and lacewings devour aphids; predatory mites hunt spider mites; tiny parasitic wasps target whiteflies. Released in time, they hold pests below damaging levels.",
      ],
      [
        "Timing and balance",
        "Beneficials work best introduced early, before a pest explodes, and need the pest to survive on — so heavy chemical sprays that wipe out everything undermine them. Biocontrol is a balance to maintain, not a one-time cure.",
      ],
      [
        "Fitting IPM",
        "Beneficial insects are a core tool of Integrated Pest Management: prevent first, monitor closely, then reach for living controls before chemicals. They suit enclosed grows well, where released helpers stay where you need them.",
      ],
    ],
  ),
  rd(
    "organic-vs-mineral",
    "Organic vs. Mineral Feeding",
    "Two philosophies of feeding a plant — and where they meet.",
    9,
    [
      [
        "Feeding the plant vs. the soil",
        "Mineral (synthetic) nutrients dissolve into forms roots take up straight away — precise and fast, ideal for hydroponics. Organic feeding relies on soil life to break down natural inputs, feeding the plant indirectly by feeding the ecosystem around its roots.",
      ],
      [
        "Trade-offs",
        "Mineral feeding gives tight control and quick correction but leaves no room for error and can build up salts. Organic growing is more forgiving and self-buffering but slower to respond and harder to measure. Neither is simply 'better' — they suit different setups.",
      ],
      [
        "Living soil and hybrids",
        "Many growers blend the two: a living-soil base with occasional targeted feeding. Whatever the method, the fundamentals stay the same — right amount, right stage, and careful record-keeping so you can repeat a good result.",
      ],
    ],
  ),
  rd(
    "post-harvest-storage",
    "Storage & Shelf Life",
    "Keeping a finished harvest good for the long term.",
    8,
    [
      [
        "The enemies of stored crops",
        "After curing, four things degrade a stored harvest: light, heat, oxygen and the wrong humidity. Light and heat break down delicate compounds; too much moisture invites mould; too little makes the product harsh and brittle.",
      ],
      [
        "Storing well",
        "Keep the harvest in airtight containers in a cool, dark place at a steady, moderate humidity. Small humidity-control packs help hold the right level. Avoid clear jars on a sunny shelf — the worst possible spot for long-term quality.",
      ],
      [
        "Check and log",
        "Open containers occasionally to check for any smell of mould and to let them breathe. Recording storage conditions and dates — the same habit as during the grow — means you learn how long your harvest stays at its best.",
      ],
    ],
  ),
  rd(
    "grow-journal-data",
    "Grow Journals & Data-Driven Growing",
    "Why the best growers write everything down.",
    9,
    [
      [
        "Memory is not a method",
        "A grow spans months and dozens of small decisions. No one remembers them accurately later. A grow journal — feeds, EC, pH, climate, training, problems and dates — turns a vague memory into evidence you can actually learn from.",
      ],
      [
        "What to record",
        "Log the essentials at each check: date and day of grow, EC and pH in and out, temperature and humidity, what you fed, and anything you changed or noticed. A photo a day captures what numbers miss. Consistency matters more than detail.",
      ],
      [
        "Turning data into better crops",
        "With records, you can link a result to its cause — connect this week's yellow leaves to last week's pH drift, or a great harvest to the climate that produced it. The GreenWave dashboard logs sensor data automatically; your notes add the decisions behind it.",
      ],
    ],
  ),
];

export const AGRI_EXTRA: Lesson[] = AGRI_EXTRA_BASE.map((l) =>
  AGRI_YT[l.slug] ? { ...l, youtubeQuery: AGRI_YT[l.slug] } : l,
);
