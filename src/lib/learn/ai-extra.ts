// Extra AI lessons that take the AI course from 8 to 30 lessons. All are
// reading lessons with three short sections each. Original tutorial content
// written for GreenWave, using farming and grower examples where natural.
// Pure data, safe to import from server and client.

import type { Lesson } from "@/lib/learn/lessons";

// Helper: a reading lesson made of three sections (heading + body).
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

export const AI_EXTRA: Lesson[] = [
  rd(
    "ai-history",
    "A Short History of AI",
    "From a 1950s idea to the tools in your pocket today.",
    9,
    [
      [
        "The dream of thinking machines",
        "The idea of machines that can reason is old, but the field got its name in 1956 at a summer workshop in the United States. Early researchers were hopeful — some thought human-level AI was only a decade away. They were wrong about the timing, but they set the questions the field still works on.",
      ],
      [
        "Winters and springs",
        "Progress came in waves. Bursts of excitement and funding (an 'AI spring') were followed by disappointment when the technology hit limits (an 'AI winter'). This happened twice before the 1990s. Each winter cleared away hype but left useful ideas behind that later work built on.",
      ],
      [
        "Why now",
        "Modern AI took off because three things arrived together: huge amounts of digital data, fast and cheap computing (especially GPUs), and better learning methods. None alone was enough; together they turned decades-old ideas like neural networks into practical tools almost everyone now uses.",
      ],
    ],
  ),
  rd(
    "ai-narrow-general",
    "Narrow, General & Super AI",
    "Three levels of ability — and where today's AI really sits.",
    8,
    [
      [
        "Narrow AI: one job well",
        "Every AI in use today is narrow: built for a single kind of task. A model that spots plant disease in photos cannot hold a conversation, and a chat model cannot drive a car. Narrow AI can beat humans at its one job while being helpless outside it.",
      ],
      [
        "General AI: the open goal",
        "Artificial general intelligence (AGI) would match a human across almost any mental task — learning new skills on its own, transferring knowledge from one area to another. It does not exist yet, and experts disagree on how far away it is. Treat confident predictions with caution.",
      ],
      [
        "Superintelligence: the debate",
        "Superintelligence means an AI far beyond human ability in every field. It is a topic of serious research and serious disagreement. For now it is a reason to build AI carefully and think ahead about safety, not a product you can buy.",
      ],
    ],
  ),
  rd(
    "ai-how-learns",
    "How a Model Actually Learns",
    "Guess, measure the error, adjust — repeated a huge number of times.",
    10,
    [
      [
        "A loop of small corrections",
        "Learning is a loop. The model makes a prediction, compares it to the right answer, measures how wrong it was, and nudges its internal numbers to be a little less wrong next time. Repeat this over millions of examples and the small corrections add up to real skill.",
      ],
      [
        "Loss: a score for wrongness",
        "The 'loss' is a single number that says how far the model's answers are from the truth — higher is worse. Training is the search for settings that make the loss as low as possible. When people say a model is 'training', this number is what they watch fall.",
      ],
      [
        "Learning rate: the step size",
        "The model adjusts in steps. Too large a step and it overshoots and never settles; too small and training takes forever. This step size, the 'learning rate', is one of the most important dials a practitioner sets. Good training is patient and well-tuned.",
      ],
    ],
  ),
  rd(
    "ai-classification-regression",
    "Classification vs. Regression",
    "The two most common jobs supervised models do.",
    9,
    [
      [
        "Classification: which category?",
        "Classification puts an input into one of a few labelled groups. 'Is this leaf healthy or sick?' and 'Is this message spam or not?' are classification. The output is a category, and often a confidence score — '92% likely sick'.",
      ],
      [
        "Regression: how much?",
        "Regression predicts a number on a continuous scale. 'How many grams will this plant yield?' or 'What will the temperature be tonight?' are regression. The output is a quantity, not a label, and 'close' answers count as partly right.",
      ],
      [
        "Choosing the right frame",
        "The same data can be framed either way. 'Days until harvest' is regression; 'harvest this week, yes or no' is classification. Picking the frame that matches the decision you need to make is an important first step in any AI project.",
      ],
    ],
  ),
  rd(
    "ai-clustering",
    "Finding Groups: Clustering",
    "How unsupervised AI discovers structure with no labels.",
    9,
    [
      [
        "Grouping without answers",
        "In clustering, no one tells the model the right groups — it finds them. Given data on many growers (city, plant count, strains), a clustering method sorts them into natural groups of similar growers. It is discovery, not prediction.",
      ],
      [
        "How similarity is measured",
        "Clustering needs a way to judge how alike two items are, usually a distance: items close together in the data land in the same group. Choosing what counts as 'close' — and putting features on a fair scale first — shapes the groups you get.",
      ],
      [
        "What clusters are good for",
        "Clusters reveal patterns you did not know to look for: customer segments, similar plants, unusual outliers. They are a starting point for questions, not final answers — a human still has to look at each group and decide what it means.",
      ],
    ],
  ),
  rd(
    "ai-reinforcement",
    "Learning by Reward",
    "How agents improve through trial, error and feedback.",
    10,
    [
      [
        "Reward instead of labels",
        "In reinforcement learning an 'agent' acts in an environment and receives rewards or penalties. It is not told the right move; it discovers which actions pay off by trying them and remembering what worked. This is how AIs learn to play games at a superhuman level.",
      ],
      [
        "Exploration vs. exploitation",
        "The agent faces a constant choice: repeat the move it already knows is good (exploit), or try something new that might be better (explore). Too little exploration and it gets stuck in a mediocre habit; too much and it never settles. Balancing the two is the core challenge.",
      ],
      [
        "Where it fits",
        "Reinforcement learning suits problems with a clear goal and room to practise: robots learning to move, systems tuning a greenhouse's climate, or game-playing AIs. It needs many attempts, so it often trains in a simulation before touching the real world.",
      ],
    ],
  ),
  rd(
    "ai-features",
    "Features: What the Model Sees",
    "Turning raw reality into numbers a model can learn from.",
    9,
    [
      [
        "From world to numbers",
        "A model cannot see a plant; it sees features — the measured inputs like height, leaf colour, humidity and days since planting. Choosing which features to collect, and how to represent them as numbers, is often what decides whether a project succeeds.",
      ],
      [
        "Feature engineering",
        "Sometimes a raw number is weak but a combination is strong. 'Water per plant' (water divided by plant count) may predict better than water and plant count separately. Crafting these helpful new features from the raw data is called feature engineering.",
      ],
      [
        "Scaling and cleaning",
        "Features on wildly different scales (grams vs. degrees) can confuse a model, so they are often rescaled to a common range. Missing or mistyped values are filled in or removed first. This unglamorous cleaning work usually improves results more than a fancier model would.",
      ],
    ],
  ),
  rd(
    "ai-overfitting",
    "Overfitting & Generalisation",
    "Why a model that memorises the answers still fails.",
    10,
    [
      [
        "Memorising vs. understanding",
        "A model overfits when it learns the training examples too exactly — including their noise and quirks — instead of the general pattern. It scores brilliantly on data it has seen and poorly on anything new. Like a student who memorised past exam papers but cannot answer a fresh question.",
      ],
      [
        "The opposite: underfitting",
        "Underfitting is the other failure: the model is too simple to capture the pattern at all, so it does poorly everywhere. Good training walks a line between the two — complex enough to learn the real signal, simple enough to ignore the noise.",
      ],
      [
        "Guarding against it",
        "Practitioners fight overfitting by testing on held-out data, keeping models no more complex than needed, and gathering more varied examples. The true goal is never a high training score — it is good performance on data the model has never seen.",
      ],
    ],
  ),
  rd(
    "ai-evaluation",
    "Measuring a Model",
    "Accuracy is not enough — precision, recall and why they matter.",
    11,
    [
      [
        "When accuracy misleads",
        "Accuracy is the share of predictions that are correct. It sounds ideal but can lie: if only 1 in 100 plants is diseased, a model that always says 'healthy' is 99% accurate and completely useless. Rare but important cases need better measures.",
      ],
      [
        "Precision and recall",
        "Precision asks: of the plants the model flagged as sick, how many really were? Recall asks: of all the truly sick plants, how many did it catch? A cautious model has high precision; a thorough one has high recall. Which matters more depends on the cost of each mistake.",
      ],
      [
        "The confusion matrix",
        "A confusion matrix lays out the four outcomes — correct healthy, correct sick, false alarms and missed cases — in a small grid. Reading it shows exactly where a model goes wrong, which a single accuracy number hides. Always look past one number.",
      ],
    ],
  ),
  rd(
    "ai-computer-vision",
    "Computer Vision",
    "How machines make sense of images and video.",
    10,
    [
      [
        "Teaching software to see",
        "Computer vision is AI that interprets images — spotting a disease on a leaf, counting plants in a photo, reading a label. To a computer an image is just a grid of numbers for colour; vision models learn to turn those numbers into meaning.",
      ],
      [
        "Layers that build up understanding",
        "Vision models (often convolutional neural networks) work in layers. Early layers detect simple things like edges and colours; later layers combine them into shapes, then into a leaf, then into a sick leaf. Complexity is built up step by step.",
      ],
      [
        "Everyday and farm uses",
        "Vision powers face unlock, medical scans, self-checkout and self-driving cars. On a farm it can grade produce, detect pests early from photos, or watch a crop's growth over time — doing tireless visual checks a person could not keep up.",
      ],
    ],
  ),
  rd(
    "ai-nlp",
    "Understanding Language",
    "How AI reads, translates and answers in human language.",
    10,
    [
      [
        "The challenge of language",
        "Human language is messy: words have many meanings, order matters, and context changes everything. Natural language processing (NLP) is the branch of AI that works with text and speech — translating, summarising, answering questions and more.",
      ],
      [
        "From words to numbers",
        "Models cannot read letters directly, so text is broken into pieces called tokens and each is turned into numbers. Similar words get similar numbers, so the model can tell that 'grow' and 'cultivate' are related — the basis of everything a language model does.",
      ],
      [
        "What NLP enables",
        "NLP sits behind translation apps, search engines, spam filters, voice assistants and chat models. For GreenWave it could power a Burmese-and-English help assistant, search across posts, or automatic summaries of long growing guides.",
      ],
    ],
  ),
  rd(
    "ai-transformers",
    "Transformers & Attention",
    "The design that made modern language AI possible.",
    11,
    [
      [
        "Reading everything at once",
        "Older language models read text one word at a time and forgot earlier words. The transformer, introduced in 2017, reads a whole passage together and lets every word look at every other word. This made models far better at long, connected text.",
      ],
      [
        "Attention: what matters here",
        "The key idea is 'attention': for each word, the model works out which other words are most relevant and focuses on them. In 'the plant needs water because it is dry', attention helps the model link 'it' to 'plant'. This focus is learned, not hand-written.",
      ],
      [
        "Why it changed everything",
        "Transformers train efficiently on huge text collections and scale up well — bigger versions keep getting better. Almost every well-known language model today is a transformer. Understanding attention is the single most useful idea for grasping modern AI.",
      ],
    ],
  ),
  rd(
    "ai-embeddings",
    "Embeddings: Meaning as Numbers",
    "How AI turns words and images into points in space.",
    10,
    [
      [
        "Meaning as a location",
        "An embedding represents an item — a word, sentence or image — as a list of numbers, a point in a high-dimensional space. The clever part: similar meanings land near each other. 'Cannabis' and 'marijuana' sit close; 'tractor' sits far away.",
      ],
      [
        "Why closeness is powerful",
        "Once meaning is a location, 'find similar' becomes 'find nearby'. Search engines, recommendations and duplicate-detection all work by comparing embeddings. Ask for strains like one you enjoyed, and the system returns its nearest neighbours in embedding space.",
      ],
      [
        "Beyond single words",
        "Whole sentences, documents and pictures can be embedded too, even into the same space so text can be matched to images. Embeddings are the quiet workhorse behind search and the retrieval step in many AI assistants.",
      ],
    ],
  ),
  rd(
    "ai-prompt-advanced",
    "Better Prompting Techniques",
    "Few-shot examples, step-by-step reasoning and clear roles.",
    11,
    [
      [
        "Show, don't just tell",
        "Beyond a plain instruction, you can include a few worked examples in the prompt — 'few-shot' prompting. Showing two or three inputs with their ideal outputs teaches the model the exact format and style you want far better than describing it.",
      ],
      [
        "Ask for the steps",
        "For anything involving reasoning or maths, asking the model to 'think step by step' and show its working often improves the answer. Breaking a hard task into stages — outline, then draft, then check — beats demanding the final answer in one leap.",
      ],
      [
        "Set the role and limits",
        "Tell the model who to be and what boundaries to keep: 'You are a careful farming assistant. If you are unsure, say so. Answer in Burmese, in three short bullets.' Clear roles, format and honesty rules make outputs more useful and more trustworthy.",
      ],
    ],
  ),
  rd(
    "ai-rag",
    "Giving AI Your Own Facts",
    "Retrieval-augmented generation, in plain terms.",
    10,
    [
      [
        "The knowledge gap",
        "A language model only knows what was in its training data, which has a cut-off date and never included your private notes. Ask about last week's harvest log and it cannot know. Retrieval fills this gap without retraining the whole model.",
      ],
      [
        "Retrieve, then generate",
        "Retrieval-augmented generation (RAG) first searches your own documents for passages relevant to the question, then hands those passages to the model along with the question. The model answers using the facts you supplied — like an open-book exam.",
      ],
      [
        "Why it is popular",
        "RAG keeps answers current and grounded in sources you control, and it can cite where each fact came from, which reduces made-up answers. It is how many company and farm assistants safely answer from private guides, manuals and records.",
      ],
    ],
  ),
  rd(
    "ai-agents",
    "AI Agents & Tools",
    "When a model can take actions, not just talk.",
    10,
    [
      [
        "From answering to doing",
        "A plain chat model only produces text. An AI 'agent' can also use tools — searching the web, running a calculation, calling a program, or updating a record — and decide which tool to use for each step. It turns talk into action.",
      ],
      [
        "Planning in steps",
        "An agent breaks a goal into steps, acts, looks at the result, and adjusts — a loop of plan, act, observe. 'Check tonight's forecast and, if frost is likely, schedule the heater' is several tool calls the agent strings together on its own.",
      ],
      [
        "Power and caution",
        "Because agents take real actions, mistakes have real effects. Sensible systems limit what an agent may touch, ask a human before anything risky or costly, and keep a log of what it did — freedom to act paired with clear guardrails.",
      ],
    ],
  ),
  rd(
    "ai-image-generation",
    "Generating Images",
    "How AI creates pictures from a text description.",
    10,
    [
      [
        "Painting from noise",
        "Modern image generators often work by 'diffusion': they start with random static and remove the noise step by step, shaping it toward the picture your words describe. After training on many image-and-caption pairs, they learn what 'a healthy cannabis plant at sunrise' should look like.",
      ],
      [
        "The prompt is the brush",
        "Your description guides every step. More detail — subject, setting, style, lighting — gives more control. As with text, small wording changes can shift the result a lot, so image prompting is its own skill of patient refining.",
      ],
      [
        "Uses and responsibilities",
        "Generated images help with design, mock-ups, teaching and art. They also raise real concerns: fakes that mislead, copied styles, and images made without consent. Label AI images honestly and never use them to deceive.",
      ],
    ],
  ),
  rd(
    "ai-speech-audio",
    "Speech & Audio AI",
    "Turning voice into text and text back into voice.",
    9,
    [
      [
        "Speech to text",
        "Speech recognition turns spoken words into written text. It powers dictation, voice search and live captions. Modern systems handle accents and background noise far better than before, though quiet, clear speech still works best.",
      ],
      [
        "Text to speech",
        "The reverse, text-to-speech, reads written words aloud in a natural voice — the technology behind screen readers and the 'Listen' button on GreenWave lessons. Good synthetic voices now sound close to human, which helps learners who prefer listening.",
      ],
      [
        "Voices raise new questions",
        "Because a voice can be copied from a short sample, audio AI brings risks: impersonation and scam calls. Treat an unexpected voice message asking for money or secrets with suspicion, even if it sounds like someone you know.",
      ],
    ],
  ),
  rd(
    "ai-hallucination",
    "Why AI Gets Things Wrong",
    "Hallucinations, confidence and how to protect yourself.",
    10,
    [
      [
        "Fluent but not always factual",
        "A language model predicts likely words; it does not check a fact database. So it can produce a smooth, confident sentence that is simply untrue — a 'hallucination'. The fluent tone makes these errors easy to miss, which is exactly the danger.",
      ],
      [
        "Confidence is not correctness",
        "AI states wrong answers with the same certainty as right ones — it has no built-in sense of doubt. Never take confidence as proof. For anything that matters, verify against a trusted source before you act.",
      ],
      [
        "How to reduce the risk",
        "Ask for sources, give the model the facts it needs (as in retrieval), keep questions specific, and cross-check important claims. Use AI as a fast first draft you always review, never as the last word on facts, health, money or law.",
      ],
    ],
  ),
  rd(
    "ai-bias-fairness",
    "Bias & Fairness in Depth",
    "How unfairness sneaks into AI — and how to catch it.",
    10,
    [
      [
        "Bias begins in the data",
        "A model learns the world its data shows it. If the training photos of healthy crops all come from one region, it may misjudge plants grown elsewhere. If a hiring dataset reflects past discrimination, the model can quietly repeat it. The data carries the bias in.",
      ],
      [
        "It can grow, not just copy",
        "AI can amplify a small imbalance into a big one by treating a common pattern as a rule. That makes bias an active harm, not a neutral mirror — worth checking for deliberately, because it rarely announces itself.",
      ],
      [
        "Checking and correcting",
        "Fair teams measure results separately for different groups, not just overall, and look for gaps. They fix the data, adjust the model, or add human review where stakes are high. Fairness is ongoing work, never a box ticked once.",
      ],
    ],
  ),
  rd(
    "ai-privacy-data",
    "AI, Privacy & Your Data",
    "What happens to what you type — and how to stay safe.",
    9,
    [
      [
        "Your input can travel",
        "Many AI tools send what you type to a company's servers to produce a reply, and some may store or reuse it to improve their models. Treat anything you paste into a tool you do not control as potentially seen by others.",
      ],
      [
        "Never feed it secrets",
        "Do not paste passwords, ID numbers, medical details, or other people's private data into public AI tools. Once shared, you cannot pull it back. When handling sensitive data, choose tools with clear privacy terms or ones that run locally.",
      ],
      [
        "Rights and consent",
        "People whose data trains an AI deserve consent and protection, and in many places the law now requires it. If you build with AI, collect only what you need, say how you use it, and let people opt out — good practice and, increasingly, the rule.",
      ],
    ],
  ),
  rd(
    "ai-in-agriculture",
    "AI in Farming & Careers",
    "Real uses on the farm and where the jobs are heading.",
    10,
    [
      [
        "AI in the field",
        "Agriculture is one of AI's most practical frontiers: spotting pests and disease from photos, predicting the best harvest day, guiding water and nutrients precisely, and forecasting yield and price. For growers this means less waste and earlier warnings — GreenWave's own tools point this way.",
      ],
      [
        "A helper, not a replacement",
        "AI handles the tireless watching and number-crunching; the grower still brings judgement, ethics and care. The strongest results come from people and AI together — the machine flags what to look at, the human decides what to do.",
      ],
      [
        "Skills worth building",
        "Whatever your field, useful AI skills are: framing a problem as data, judging an answer critically, prompting well, and understanding limits and bias. You do not need to build models to work with AI — clear thinking and honest checking matter most.",
      ],
    ],
  ),
];
