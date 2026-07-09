// SQL and AI courses for the /learn platform. Original tutorial content
// (structured like a classic "learn by doing" course) written for GreenWave.
// SQL lessons are runnable against an in-browser SQLite database seeded with
// two demo tables — `growers(id, name, city, plants)` and
// `strains(id, name, type, weeks, grower_id)` — see sql-playground.tsx.
// Pure data, safe to import from server and client.

import type { Track } from "@/lib/learn/lessons";

// ─────────────────────────── SQL course ────────────────────────────────────

const sqlTrack: Track = {
  slug: "sql",
  title: "SQL Course",
  description:
    "Query real data in your browser — SELECT, WHERE, JOIN and more. No install needed.",
  icon: "Database",
  bands: ["teen", "adult"],
  lessons: [
    {
      slug: "sql-intro",
      title: "What Is SQL?",
      summary: "Databases, tables, rows and columns — the language of data.",
      minutes: 8,
      kind: "reading",
      sections: [
        {
          heading: "A database is organised information",
          body: "A database stores information so a program can find it again quickly. Almost every app you use — a shop, a chat, GreenWave itself — keeps its data in a database. SQL (Structured Query Language) is the language we use to ask a database questions and to change what it holds.",
        },
        {
          heading: "Tables, rows and columns",
          body: "Data lives in tables, which look like spreadsheets. Each table has columns (the fields, such as name or city) and rows (one record each, such as a single grower). In these lessons you will query two tables: `growers` and `strains`.",
          code: "growers\n  id | name  | city      | plants\n  ---+-------+-----------+-------\n   1 | Mai   | Yangon    | 12\n   2 | Aung  | Mandalay  |  5\n   3 | Su    | Yangon    | 20",
        },
        {
          heading: "Queries ask questions",
          body: "A query is a request for data. The most common query starts with SELECT — 'select these columns from this table'. Over the next lessons you will filter, sort, count and combine data. Every lesson has a live editor: edit the query and press Run to see the real result.",
        },
      ],
    },
    {
      slug: "sql-select",
      title: "SELECT: Read Data",
      summary: "Pull columns out of a table with SELECT.",
      minutes: 10,
      kind: "sql",
      sections: [
        {
          heading: "SELECT columns FROM a table",
          body: "SELECT names the columns you want; FROM names the table. Use `*` to mean 'every column'. SQL keywords are not case-sensitive, but writing them in capitals is a common habit that makes queries easy to read.",
          code: "SELECT name, city FROM growers;\nSELECT * FROM growers;",
        },
        {
          heading: "Try it",
          body: "Run the query below to list every grower. Then change it to `SELECT name, plants FROM growers;` and run it again to see only two columns.",
        },
      ],
      sqlCode: "SELECT * FROM growers;",
    },
    {
      slug: "sql-where",
      title: "WHERE: Filter Rows",
      summary: "Keep only the rows that match a condition.",
      minutes: 10,
      kind: "sql",
      sections: [
        {
          heading: "Filtering with WHERE",
          body: "WHERE keeps only rows where a condition is true. You can compare with `=`, `<`, `>`, `<=`, `>=` and `<>` (not equal). Text values go in single quotes; numbers do not. Combine conditions with AND and OR.",
          code: "SELECT * FROM growers WHERE city = 'Yangon';\nSELECT * FROM growers WHERE plants > 10;\nSELECT * FROM growers WHERE city = 'Mandalay' AND plants > 10;",
        },
        {
          heading: "Try it",
          body: "Run the query to find growers with more than 10 plants. Then edit the number, or swap in a city name, and run again.",
        },
      ],
      sqlCode: "SELECT name, city, plants\nFROM growers\nWHERE plants > 10;",
    },
    {
      slug: "sql-order-limit",
      title: "ORDER BY & LIMIT",
      summary: "Sort your results and take just the top few.",
      minutes: 9,
      kind: "sql",
      sections: [
        {
          heading: "Sorting rows",
          body: "ORDER BY sorts the result by a column. Add DESC for high-to-low (descending) or ASC for low-to-high (the default). LIMIT cuts the result down to a number of rows — handy for 'top 3' style questions.",
          code: "SELECT name, plants FROM growers ORDER BY plants DESC;\nSELECT name, plants FROM growers ORDER BY plants DESC LIMIT 3;",
        },
        {
          heading: "Try it",
          body: "The query lists growers from most plants to fewest. Add `LIMIT 3` at the end to see only the top three growers.",
        },
      ],
      sqlCode: "SELECT name, plants\nFROM growers\nORDER BY plants DESC;",
    },
    {
      slug: "sql-distinct",
      title: "DISTINCT: Unique Values",
      summary: "Remove duplicate values from a column.",
      minutes: 8,
      kind: "sql",
      sections: [
        {
          heading: "Unique values only",
          body: "SELECT DISTINCT returns each value only once. Several growers live in Yangon, but `SELECT DISTINCT city` lists each city a single time — useful for building menus or seeing what values exist.",
          code: "SELECT city FROM growers;\nSELECT DISTINCT city FROM growers;",
        },
        {
          heading: "Try it",
          body: "Run the query to see the list of distinct cities. Then remove DISTINCT and run again to notice the duplicates return.",
        },
      ],
      sqlCode: "SELECT DISTINCT city FROM growers;",
    },
    {
      slug: "sql-aggregate",
      title: "COUNT, SUM & AVG",
      summary: "Turn many rows into a single answer.",
      minutes: 11,
      kind: "sql",
      sections: [
        {
          heading: "Aggregate functions",
          body: "Aggregate functions summarise many rows into one value. COUNT(*) counts rows, SUM adds a column up, AVG gives the average, and MIN/MAX give the smallest and largest. You can rename the result column with AS.",
          code: "SELECT COUNT(*) AS growers FROM growers;\nSELECT SUM(plants) AS total_plants FROM growers;\nSELECT AVG(plants) AS avg_plants FROM growers;",
        },
        {
          heading: "Try it",
          body: "The query totals every grower's plants. Change SUM to AVG, or to MAX, and run again to ask a different question of the same data.",
        },
      ],
      sqlCode: "SELECT SUM(plants) AS total_plants\nFROM growers;",
    },
    {
      slug: "sql-group-by",
      title: "GROUP BY & HAVING",
      summary: "Summarise data per category.",
      minutes: 12,
      kind: "sql",
      sections: [
        {
          heading: "One summary per group",
          body: "GROUP BY splits rows into groups that share a value, then runs an aggregate on each group. 'How many plants per city?' means group by city and sum the plants. HAVING filters those grouped results (WHERE filters rows before grouping; HAVING filters after).",
          code: "SELECT city, SUM(plants) AS plants\nFROM growers\nGROUP BY city;\n\nSELECT city, COUNT(*) AS growers\nFROM growers\nGROUP BY city\nHAVING COUNT(*) > 1;",
        },
        {
          heading: "Try it",
          body: "The query totals plants for each city. Add an ORDER BY plants DESC at the end to rank the cities, then run it.",
        },
      ],
      sqlCode: "SELECT city, SUM(plants) AS plants\nFROM growers\nGROUP BY city;",
    },
    {
      slug: "sql-join",
      title: "JOIN: Combine Tables",
      summary: "Match rows across two tables to answer richer questions.",
      minutes: 13,
      kind: "sql",
      sections: [
        {
          heading: "Linking tables with keys",
          body: "Real databases spread data across tables and link them with keys. Each strain has a `grower_id` that points at a grower's `id`. A JOIN matches those rows so you can see the grower's name next to the strain in one result.",
          code: "SELECT strains.name AS strain, growers.name AS grower\nFROM strains\nJOIN growers ON strains.grower_id = growers.id;",
        },
        {
          heading: "Try it",
          body: "The query lists each strain with the grower who grows it. Add `WHERE growers.city = 'Yangon'` before the semicolon to see only Yangon growers' strains.",
        },
      ],
      sqlCode:
        "SELECT strains.name AS strain, growers.name AS grower, growers.city\nFROM strains\nJOIN growers ON strains.grower_id = growers.id;",
    },
    {
      slug: "sql-insert-update",
      title: "INSERT, UPDATE & DELETE",
      summary: "Change the data, not just read it.",
      minutes: 12,
      kind: "sql",
      sections: [
        {
          heading: "Writing data",
          body: "SELECT reads; INSERT, UPDATE and DELETE change data. INSERT adds a new row, UPDATE edits existing rows (always with a WHERE, or you change every row!), and DELETE removes rows. Here the database is rebuilt fresh on every Run, so experiment freely.",
          code: "INSERT INTO growers VALUES (6, 'Thida', 'Bago', 9);\nUPDATE growers SET plants = 25 WHERE name = 'Su';\nDELETE FROM growers WHERE name = 'Aung';",
        },
        {
          heading: "Try it",
          body: "The query inserts a new grower and then selects everyone so you can see the change. Try adding an UPDATE line before the final SELECT.",
        },
      ],
      sqlCode:
        "INSERT INTO growers VALUES (6, 'Thida', 'Bago', 9);\nSELECT * FROM growers;",
    },
    {
      slug: "sql-quiz",
      title: "SQL Quiz",
      summary: "Check what you learned about querying databases.",
      minutes: 5,
      kind: "quiz",
      quiz: [
        {
          q: "Which keyword reads data from a table?",
          options: ["READ", "SELECT", "GET", "SHOW"],
          answer: 1,
          explain: "SELECT chooses the columns and FROM names the table.",
        },
        {
          q: "Which clause keeps only rows that match a condition?",
          options: ["ORDER BY", "GROUP BY", "WHERE", "LIMIT"],
          answer: 2,
        },
        {
          q: "What does COUNT(*) return?",
          options: [
            "The largest value",
            "The number of rows",
            "The average",
            "The column names",
          ],
          answer: 1,
        },
        {
          q: "What does a JOIN do?",
          options: [
            "Deletes duplicate rows",
            "Sorts the result",
            "Matches rows across two tables using a key",
            "Adds a new column permanently",
          ],
          answer: 2,
          explain: "A JOIN links tables on a shared key like grower_id = id.",
        },
        {
          q: "Which statement should almost always include a WHERE clause?",
          options: [
            "SELECT",
            "UPDATE",
            "CREATE TABLE",
            "It never matters",
          ],
          answer: 1,
          explain: "Without WHERE, UPDATE and DELETE affect every row.",
        },
      ],
    },
  ],
};

// ─────────────────────────── AI course ─────────────────────────────────────

const aiTrack: Track = {
  slug: "ai",
  title: "AI Course",
  description:
    "How machines learn, what neural networks and generative AI are, and how to use AI responsibly.",
  icon: "BrainCircuit",
  bands: ["teen", "adult"],
  lessons: [
    {
      slug: "ai-intro",
      title: "What Is Artificial Intelligence?",
      summary: "The idea of machines that perform tasks that seem to need thinking.",
      minutes: 8,
      kind: "reading",
      sections: [
        {
          heading: "A working definition",
          body: "Artificial intelligence (AI) is software that performs tasks we usually associate with human thinking — recognising a photo, understanding a sentence, recommending a strain, or predicting when a crop is ready. AI does not 'think' like a person; it finds patterns in data and uses them to make useful guesses.",
        },
        {
          heading: "Narrow AI is everywhere",
          body: "Almost all AI today is 'narrow': it is very good at one job and useless at others. The spam filter in your email, the map that predicts traffic, and the voice assistant on your phone are each narrow AI. A single system that can do everything a human can — 'general' AI — does not yet exist.",
        },
        {
          heading: "Rules vs. learning",
          body: "Early AI followed hand-written rules: IF humidity is over 70% THEN turn on the fan. That still works well and is easy to understand. Modern AI adds machine learning, where the system discovers the rules itself by studying many examples — the subject of the next lesson.",
        },
      ],
    },
    {
      slug: "ai-machine-learning",
      title: "Machine Learning",
      summary: "How software learns patterns from examples instead of being told the rules.",
      minutes: 10,
      kind: "reading",
      sections: [
        {
          heading: "Learning from examples",
          body: "Machine learning (ML) is the part of AI where a program improves by studying data rather than by following rules a human wrote. Show it thousands of labelled leaf photos marked 'healthy' or 'sick', and it learns the visual patterns that separate the two — then it can judge a new photo it has never seen.",
        },
        {
          heading: "Three broad styles",
          body: "In supervised learning the examples come with the right answer (labelled photos). In unsupervised learning there are no labels and the system groups similar things on its own (finding clusters of similar growers). In reinforcement learning an agent learns by trial and error, earning rewards for good moves — the way game-playing AIs improve.",
        },
        {
          heading: "Features and predictions",
          body: "A model looks at features — the measurable inputs like temperature, humidity and days since planting — and produces a prediction, such as 'ready to harvest in 6 days'. Better, more relevant features usually matter more than a fancier model.",
        },
      ],
    },
    {
      slug: "ai-neural-networks",
      title: "Neural Networks & Deep Learning",
      summary: "The layered models behind image and language AI.",
      minutes: 10,
      kind: "reading",
      sections: [
        {
          heading: "Inspired by the brain",
          body: "A neural network is a model built from many simple units ('neurons') connected in layers. Each connection has a weight — a number that strengthens or weakens a signal. Data flows in one side, through the layers, and an answer comes out the other. The network learns by nudging those weights until its answers get better.",
        },
        {
          heading: "Why 'deep'",
          body: "Deep learning just means a neural network with many layers. Early layers pick up simple patterns (edges in a photo), and later layers combine them into complex ideas (a leaf, then a sick leaf). Stacking layers lets the model handle messy real-world data like images, audio and text.",
        },
        {
          heading: "Training takes data and computing power",
          body: "Networks learn by making a guess, measuring how wrong it is (the 'loss'), and adjusting weights to reduce that error — repeated millions of times. This needs large datasets and powerful hardware, which is why big AI models are expensive to build.",
        },
      ],
    },
    {
      slug: "ai-training-data",
      title: "Data: The Fuel of AI",
      summary: "Why the quality of the data decides the quality of the AI.",
      minutes: 9,
      kind: "reading",
      sections: [
        {
          heading: "Garbage in, garbage out",
          body: "An AI model is only as good as the data it learns from. If the examples are wrong, missing, or unrepresentative, the model's predictions will be too. Careful data collection and cleaning is often the largest part of a real AI project.",
        },
        {
          heading: "Training, validation and test",
          body: "Data is usually split into three parts: a training set the model learns from, a validation set used to tune it, and a test set kept aside to check honest performance on data it never saw. Judging a model on data it trained on would flatter it unfairly.",
        },
        {
          heading: "Bias hides in data",
          body: "If a dataset only contains plants from one climate, the model may fail elsewhere. Bias in the data becomes bias in the predictions. Good teams check who and what their data represents — and who it leaves out — before trusting the results.",
        },
      ],
    },
    {
      slug: "ai-generative",
      title: "Generative AI & Large Language Models",
      summary: "The AI that writes, draws and codes — and how it works.",
      minutes: 11,
      kind: "reading",
      sections: [
        {
          heading: "Making new content",
          body: "Generative AI creates new content — text, images, audio, code — rather than just sorting or labelling existing data. Chat assistants, image generators and coding helpers are all generative. GreenWave's own coding lessons run alongside the kind of tools this AI powers.",
        },
        {
          heading: "How a language model predicts",
          body: "A large language model (LLM) is trained on huge amounts of text to predict the next word, over and over. From that simple goal it picks up grammar, facts and reasoning patterns. When you type a prompt, it generates a reply one piece at a time, each choice guided by everything before it.",
        },
        {
          heading: "Confident but sometimes wrong",
          body: "Because a model predicts likely text rather than looking up truth, it can state wrong facts fluently — this is called a 'hallucination'. Treat generative AI as a fast, helpful draft-maker whose output you always check, not as an oracle.",
        },
      ],
    },
    {
      slug: "ai-using-ai",
      title: "Using AI Well: Prompting",
      summary: "Practical ways to get better results from AI tools.",
      minutes: 9,
      kind: "reading",
      sections: [
        {
          heading: "A prompt is your instruction",
          body: "A prompt is what you ask an AI tool to do. Clear, specific prompts get better answers. Say who it should act as, what you want, and the format you expect: 'You are a farming assistant. List three reasons a cannabis leaf might yellow, as short bullet points.'",
        },
        {
          heading: "Give context and examples",
          body: "Models work better when you include the facts they need and, when possible, an example of the output you want. Break big requests into steps. If the first answer misses, refine your prompt rather than starting over — this back-and-forth is normal.",
        },
        {
          heading: "Keep a human in the loop",
          body: "Check important AI output before acting on it, especially for health, money or safety. Never paste secrets or private personal data into a tool you don't control. AI is a helper; you stay responsible for the final decision.",
        },
      ],
    },
    {
      slug: "ai-ethics",
      title: "AI Ethics & Safety",
      summary: "Fairness, privacy and keeping people in charge.",
      minutes: 9,
      kind: "reading",
      sections: [
        {
          heading: "Fairness",
          body: "AI can repeat and even amplify unfair patterns in its data — for example, treating one group worse because it was underrepresented. Building fair AI means checking outcomes across different groups and fixing gaps in the data, not just chasing overall accuracy.",
        },
        {
          heading: "Privacy and transparency",
          body: "AI often learns from personal data, so it must respect consent and protect what it stores. People also deserve to know when they are dealing with AI and, for important decisions, roughly how it reached its conclusion. Hidden, unexplainable decisions erode trust.",
        },
        {
          heading: "Humans stay accountable",
          body: "For decisions that affect people's lives, a human should be able to review, override and be answerable for the outcome. The safest systems use AI to inform and speed up human judgement, never to replace responsibility for it.",
        },
      ],
    },
    {
      slug: "ai-quiz",
      title: "AI Quiz",
      summary: "Check what you learned about how AI works and how to use it.",
      minutes: 5,
      kind: "quiz",
      quiz: [
        {
          q: "Most AI in use today is best described as…",
          options: [
            "General AI that can do anything a human can",
            "Narrow AI that is good at one specific task",
            "Conscious and self-aware",
            "Just a spreadsheet",
          ],
          answer: 1,
        },
        {
          q: "In supervised learning, the training examples come with…",
          options: [
            "No information at all",
            "The correct answer (a label)",
            "A reward score only",
            "Random noise",
          ],
          answer: 1,
          explain: "Supervised learning trains on labelled examples.",
        },
        {
          q: "What does 'deep' mean in deep learning?",
          options: [
            "The model is very old",
            "A neural network with many layers",
            "The data is stored deep underground",
            "It only works at night",
          ],
          answer: 1,
        },
        {
          q: "When a language model states a wrong fact confidently, it is called a…",
          options: ["Bug report", "Hallucination", "Firewall", "Backup"],
          answer: 1,
        },
        {
          q: "What is the safest way to use AI for an important decision?",
          options: [
            "Let it decide alone with no review",
            "Keep a human in charge to check and override it",
            "Hide that AI was involved",
            "Feed it as much private data as possible",
          ],
          answer: 1,
        },
      ],
    },
  ],
};

export const SQL_AI_TRACKS: Track[] = [sqlTrack, aiTrack];
