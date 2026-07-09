// SQL and AI courses for the /learn platform. Original tutorial content
// (structured like a classic "learn by doing" course) written for GreenWave.
// SQL lessons are runnable against an in-browser SQLite database seeded with
// two demo tables — `growers(id, name, city, plants)` and
// `strains(id, name, type, weeks, grower_id)` — see sql-playground.tsx.
// Pure data, safe to import from server and client.

import { AI_EXTRA } from "@/lib/learn/ai-extra";
import { SQL_EXTRA } from "@/lib/learn/courses-sql-ai-extra";
import {
  GROUP_BY_SVG,
  JOIN_SVG,
  SELECT_FLOW_SVG,
  TABLE_SVG,
} from "@/lib/learn/sql-diagrams";
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
      minutes: 10,
      kind: "reading",
      youtubeQuery: "SQL tutorial for beginners",
      sections: [
        {
          heading: "A database is organised information",
          body: "A database is a store of information arranged so a program can find any part of it again in an instant. Almost every app you touch keeps its data in one: an online shop remembers its products and orders, a chat app remembers every message, and GreenWave itself stores growers, strains, posts and lessons this way. Without databases, an app would forget everything the moment you closed it.\n\nSQL — Structured Query Language — is the language we use to talk to a database: to ask it questions ('which growers are in Yangon?') and to change what it holds ('add this new grower'). It has been the standard language for this for decades, so the ideas you learn here apply to almost every database you will ever meet.",
        },
        {
          heading: "Tables, rows and columns",
          body: "Data in a SQL database lives in tables, which look much like a spreadsheet. Each table has columns — the fields every record shares, such as name or city — and rows, where each row is one complete record, such as a single grower. The diagram below shows the `growers` table you will query throughout this course, alongside a `strains` table.\n\nThinking in tables is the heart of SQL: once you can picture your data as neat rows and columns, the queries that follow become far easier to read and write.",
          image: {
            src: TABLE_SVG,
            alt: "A growers table with id, name, city and plants columns and three example rows.",
            caption: "A table: columns run across the top, one record per row.",
          },
        },
        {
          heading: "Queries ask questions",
          body: "A query is simply a request for data written in SQL. The most common query begins with SELECT — literally 'select these columns from this table'. Over the coming lessons you will learn to filter rows, sort them, count and total them, and combine two tables together. Each idea builds on the last.",
        },
        {
          heading: "Learn by doing",
          body: "You do not need to install anything. Every SQL lesson in this course has a live editor with a small database already loaded, running entirely in your browser. Read the explanation, then edit the query and press Run to see the real result — and, just as usefully, change it and see what happens. Experimenting freely is the fastest way to build real understanding, and nothing you do here can break anything.",
        },
      ],
    },
    {
      slug: "sql-select",
      title: "SELECT: Read Data",
      summary: "Pull columns out of a table with SELECT.",
      minutes: 11,
      kind: "sql",
      youtubeQuery: "SQL SELECT statement explained",
      sections: [
        {
          heading: "SELECT columns FROM a table",
          body: "Every question you ask a database follows the same simple shape: SELECT names the columns you want, and FROM names the table they live in. The diagram below shows that shape, with WHERE (which you will meet next) choosing the rows.\n\nUse `*` as a shortcut meaning 'every column'. SQL keywords like SELECT and FROM are not case-sensitive — `select` works too — but writing them in capitals is a widespread habit that makes a query easy to read at a glance, separating the commands from your column and table names.",
          image: {
            src: SELECT_FLOW_SVG,
            alt: "SELECT chooses columns, FROM chooses the table, WHERE chooses the rows.",
            caption: "The shape of a query: columns, then table, then a row filter.",
          },
        },
        {
          heading: "Choose only what you need",
          body: "Listing the exact columns you want — `SELECT name, city` — is usually better than `SELECT *`. It makes the result easier to read, and in a real app it moves less data, so pages load faster. Reach for `*` when you are exploring a table; name your columns when you know what you want.",
          code: "SELECT name, city FROM growers;\nSELECT * FROM growers;",
        },
        {
          heading: "Try it",
          body: "Run the query below to list every grower with all their columns. Then change it to `SELECT name, plants FROM growers;` and run it again — notice the result now shows only the two columns you named. Try naming the columns in a different order and see that the result follows your order.",
        },
      ],
      sqlCode: "SELECT * FROM growers;",
    },
    {
      slug: "sql-where",
      title: "WHERE: Filter Rows",
      summary: "Keep only the rows that match a condition.",
      minutes: 11,
      kind: "sql",
      youtubeQuery: "SQL WHERE clause tutorial",
      sections: [
        {
          heading: "Filtering with WHERE",
          body: "A table can hold millions of rows, but you rarely want them all. WHERE keeps only the rows where a condition you write is true, and quietly drops the rest. It is the single most useful clause in SQL — 'show me just the rows I care about'.\n\nYou compare values with `=` (equal), `<` and `>` (less/greater than), `<=` and `>=`, and `<>` (not equal). One rule trips up every beginner: text values must go inside single quotes (`'Yangon'`), while numbers must not (`10`). Getting that right is half the battle.",
          code: "SELECT * FROM growers WHERE city = 'Yangon';\nSELECT * FROM growers WHERE plants > 10;",
        },
        {
          heading: "Combining conditions",
          body: "Real questions often have more than one part. Join conditions with AND (both must be true) and OR (either may be true). 'Growers in Mandalay with more than 10 plants' needs both, so you use AND. When you mix AND and OR in one query, wrap the OR part in brackets so the meaning is clear.",
          code: "SELECT * FROM growers\nWHERE city = 'Mandalay' AND plants > 10;",
        },
        {
          heading: "Try it",
          body: "Run the query to find growers with more than 10 plants. Then edit the number to `5`, or replace the whole condition with `city = 'Yangon'`, and run again. Try adding `AND plants > 10` to a city filter to combine the two.",
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
      youtubeQuery: "SQL ORDER BY and LIMIT tutorial",
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
      youtubeQuery: "SQL DISTINCT keyword explained",
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
      youtubeQuery: "SQL COUNT SUM AVG aggregate functions",
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
      minutes: 13,
      kind: "sql",
      youtubeQuery: "SQL GROUP BY and HAVING tutorial",
      sections: [
        {
          heading: "One summary per group",
          body: "An aggregate like SUM squeezes many rows into a single number. GROUP BY makes that far more powerful: it first splits the rows into groups that share a value, then runs the aggregate once for each group. 'How many plants per city?' means group the growers by city, then sum the plants within each — as the diagram shows, several rows collapse into one summary row per city.",
          image: {
            src: GROUP_BY_SVG,
            alt: "Rows for each city collapse into one summed row per city.",
            caption: "GROUP BY collapses rows that share a value into one row each.",
          },
          code: "SELECT city, SUM(plants) AS plants\nFROM growers\nGROUP BY city;",
        },
        {
          heading: "HAVING: filtering the groups",
          body: "WHERE cannot test a group total, because the total does not exist until after the rows are grouped. That is what HAVING is for: it filters the grouped results using an aggregate. 'Only cities with more than one grower' is `HAVING COUNT(*) > 1`. A simple rule to remember: WHERE filters rows before grouping, HAVING filters groups after.",
          code: "SELECT city, COUNT(*) AS growers\nFROM growers\nGROUP BY city\nHAVING COUNT(*) > 1;",
        },
        {
          heading: "Try it",
          body: "The query totals plants for each city. Add `ORDER BY plants DESC` at the end to rank the cities from most to fewest plants, then run it. Try swapping SUM for COUNT(*) to count growers per city instead.",
        },
      ],
      sqlCode: "SELECT city, SUM(plants) AS plants\nFROM growers\nGROUP BY city;",
    },
    {
      slug: "sql-join",
      title: "JOIN: Combine Tables",
      summary: "Match rows across two tables to answer richer questions.",
      minutes: 14,
      kind: "sql",
      youtubeQuery: "SQL JOIN explained for beginners",
      sections: [
        {
          heading: "Linking tables with keys",
          body: "Good databases do not cram everything into one giant table. Instead they spread data across several tables and link them with keys. Here, rather than repeating a grower's details on every strain, each strain simply carries a `grower_id` that points at a grower's `id`. The diagram shows that link.\n\nA JOIN follows that key to match rows across the two tables, so you can pull the grower's name and the strain's name together into a single result — the database re-assembles the connected data for you.",
          image: {
            src: JOIN_SVG,
            alt: "The strains.grower_id column points to the growers.id column, linking the tables.",
            caption: "A JOIN matches rows across two tables using a shared key.",
          },
          code: "SELECT strains.name AS strain, growers.name AS grower\nFROM strains\nJOIN growers ON strains.grower_id = growers.id;",
        },
        {
          heading: "Reading a JOIN",
          body: "The ON part is the heart of a JOIN: it tells the database which columns must match — here `strains.grower_id = growers.id`. Because both tables have a `name` column, we write `strains.name` and `growers.name` in full so there is no confusion about which one we mean. Prefixing columns with their table name is a good habit in any query that joins.",
        },
        {
          heading: "Try it",
          body: "The query lists each strain with the grower who grows it. Add `WHERE growers.city = 'Yangon'` before the semicolon to see only the strains grown by Yangon growers, then run it again.",
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
      youtubeQuery: "SQL INSERT UPDATE DELETE tutorial",
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
    ...SQL_EXTRA,
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
        {
          q: "In LIKE, what does the % wildcard match?",
          options: [
            "Exactly one character",
            "Any run of characters, including none",
            "Only digits",
            "A literal percent sign",
          ],
          answer: 1,
          explain: "% matches any number of characters; _ matches exactly one.",
        },
        {
          q: "Which clause filters groups after GROUP BY?",
          options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"],
          answer: 1,
          explain: "WHERE filters rows before grouping; HAVING filters the groups.",
        },
        {
          q: "A LEFT JOIN differs from a plain JOIN because it…",
          options: [
            "Sorts the result",
            "Keeps left-table rows even with no match, filling NULLs",
            "Removes duplicate rows",
            "Is always faster",
          ],
          answer: 1,
        },
        {
          q: "How do you test for a missing (NULL) value?",
          options: ["= NULL", "IS NULL", "== NULL", "NULL()"],
          answer: 1,
          explain: "NULL is unknown, so you must use IS NULL, not =.",
        },
        {
          q: "What does COUNT(DISTINCT city) return?",
          options: [
            "The total number of rows",
            "The number of different city values",
            "The longest city name",
            "The first city alphabetically",
          ],
          answer: 1,
        },
        {
          q: "Which pair takes 'page two' of two rows each?",
          options: [
            "LIMIT 2 OFFSET 2",
            "LIMIT 2 OFFSET 0",
            "TOP 2",
            "PAGE 2",
          ],
          answer: 0,
          explain: "OFFSET skips rows before LIMIT starts counting.",
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
    ...AI_EXTRA,
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
        {
          q: "Classification predicts a category; regression predicts…",
          options: [
            "A number on a continuous scale",
            "Another category",
            "Nothing at all",
            "The training data",
          ],
          answer: 0,
          explain: "'How many grams?' is regression; 'sick or healthy?' is classification.",
        },
        {
          q: "A model that scores perfectly on training data but fails on new data has…",
          options: ["Underfit", "Overfit", "No loss", "Been retrained"],
          answer: 1,
          explain: "Overfitting means memorising the examples instead of the pattern.",
        },
        {
          q: "Why can plain accuracy be misleading?",
          options: [
            "It is always wrong",
            "With rare cases, always guessing 'no' can look highly accurate yet be useless",
            "It cannot be measured",
            "It only works for images",
          ],
          answer: 1,
        },
        {
          q: "In a transformer, 'attention' lets each word…",
          options: [
            "Be ignored",
            "Focus on the other words most relevant to it",
            "Be translated automatically",
            "Turn into an image",
          ],
          answer: 1,
        },
        {
          q: "Retrieval-augmented generation (RAG) improves answers by…",
          options: [
            "Retraining the whole model each time",
            "Searching your own documents and giving the model those facts",
            "Making the model bigger",
            "Removing the prompt",
          ],
          answer: 1,
          explain: "RAG grounds answers in sources you control, like an open-book exam.",
        },
        {
          q: "An AI agent differs from a plain chat model because it can…",
          options: [
            "Only produce text",
            "Use tools and take actions, not just talk",
            "Never make mistakes",
            "Work without any goal",
          ],
          answer: 1,
        },
      ],
    },
  ],
};

export const SQL_AI_TRACKS: Track[] = [sqlTrack, aiTrack];
