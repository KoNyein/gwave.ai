// Pseudocode course for the /learn platform. Teaches algorithmic thinking
// from the ground up using plain-language pseudocode, then lets the learner
// RUN the same idea as real Python in the in-browser playground (no input()
// is used, since the sandbox has no stdin — values are set in the code).
// Original content; Burmese overlay lives in i18n/my.ts. Every lesson also
// carries a youtubeQuery so learners can jump to Burmese video tutorials.

import type { Track } from "@/lib/learn/lessons";

export const pseudocodeTrack: Track = {
  slug: "pseudocode",
  title: "Pseudocode & Algorithms",
  description:
    "Think like a programmer — plan in plain steps, then run it as real code. Basics to projects.",
  icon: "ListChecks",
  bands: ["preteen", "teen", "adult"],
  lessons: [
    {
      slug: "pc-intro",
      title: "What Is Pseudocode?",
      summary: "Plan a program in plain steps before writing real code.",
      minutes: 7,
      kind: "reading",
      youtubeQuery: "pseudocode tutorial for beginners",
      sections: [
        {
          heading: "A recipe for the computer",
          body: "Pseudocode is a way to describe the steps of a program in plain language — no strict grammar, no computer needed. Like a cooking recipe, it lists what to do, in order, so a human can follow the logic before turning it into a real programming language.",
          code: "BEGIN\n  READ name\n  PRINT \"Hello, \" + name\nEND",
        },
        {
          heading: "Why bother?",
          body: "Planning in pseudocode lets you get the logic right first, in any language you understand — including your own. Once the steps are clear, translating them into Python, JavaScript or any language is easy. Professionals sketch pseudocode to design and explain algorithms.",
        },
        {
          heading: "Common keywords",
          body: "Most pseudocode uses a few words: READ / INPUT (get data), PRINT / OUTPUT (show data), SET (store a value), IF … THEN … ELSE (decide), WHILE / FOR (repeat). We will meet each one, then run the real Python version.",
        },
      ],
    },
    {
      slug: "pc-sequence",
      title: "Sequence: Step by Step",
      summary: "Instructions run top to bottom, in order. Run your first program.",
      minutes: 9,
      kind: "python",
      youtubeQuery: "sequence programming basics",
      sections: [
        {
          heading: "Order matters",
          body: "A sequence is a list of steps done one after another, top to bottom. Swap two steps and the result can change — pour the tea before boiling the water and it won't work! Below, the pseudocode and its Python are side by side. Press Run.",
          code: "BEGIN\n  SET greeting TO \"Grow with GreenWave\"\n  PRINT greeting\n  PRINT \"Lesson 1 complete\"\nEND",
        },
      ],
      pythonCode:
        '# Pseudocode → Python. Each line runs in order, top to bottom.\ngreeting = "Grow with GreenWave"\nprint(greeting)\nprint("Lesson 1 complete")\n',
    },
    {
      slug: "pc-variables",
      title: "Variables & Output",
      summary: "Store values in named boxes and calculate with them.",
      minutes: 10,
      kind: "python",
      youtubeQuery: "variables in programming explained",
      sections: [
        {
          heading: "A variable is a labelled box",
          body: "SET puts a value into a named box (a variable) so you can use it later. You can store numbers or text and do maths with numbers. Change the values and press Run to see the total update.",
          code: "BEGIN\n  SET price TO 1200\n  SET quantity TO 3\n  SET total TO price * quantity\n  PRINT total\nEND",
        },
      ],
      pythonCode:
        "# Variables hold values you can reuse and calculate with.\nprice = 1200\nquantity = 3\ntotal = price * quantity\nprint(\"Total:\", total)\n",
    },
    {
      slug: "pc-conditions",
      title: "Decisions: IF / ELSE",
      summary: "Make the program choose between paths.",
      minutes: 11,
      kind: "python",
      youtubeQuery: "if else statement programming",
      sections: [
        {
          heading: "Choosing a path",
          body: "IF … THEN … ELSE lets a program decide. It checks a condition (true or false) and runs one branch or the other. Here we check soil moisture and decide whether to water. Change the moisture value and press Run.",
          code: "BEGIN\n  SET moisture TO 30\n  IF moisture < 40 THEN\n    PRINT \"Water the plant\"\n  ELSE\n    PRINT \"Soil is fine\"\n  END IF\nEND",
        },
      ],
      pythonCode:
        '# Try changing moisture to 55 and run again.\nmoisture = 30\nif moisture < 40:\n    print("Water the plant")\nelse:\n    print("Soil is fine")\n',
    },
    {
      slug: "pc-loops",
      title: "Loops: Repeat Steps",
      summary: "Do something many times without copying code.",
      minutes: 12,
      kind: "python",
      youtubeQuery: "for loop while loop tutorial",
      sections: [
        {
          heading: "FOR and WHILE",
          body: "A loop repeats steps. A FOR loop repeats a set number of times; a WHILE loop repeats as long as a condition stays true. This prints a countdown, then a times-table row. Press Run, then change the numbers.",
          code: "BEGIN\n  FOR day FROM 1 TO 5\n    PRINT \"Day \" + day\n  END FOR\nEND",
        },
      ],
      pythonCode:
        '# FOR loop: repeat a fixed number of times.\nfor day in range(1, 6):\n    print("Day", day)\n\n# WHILE loop: repeat while a condition is true.\ncount = 3\nwhile count > 0:\n    print("Countdown:", count)\n    count = count - 1\nprint("Lift-off!")\n',
    },
    {
      slug: "pc-project-guessing",
      title: "Project: Number Guessing Game",
      summary: "Combine variables, loops and conditions into a real game.",
      minutes: 15,
      kind: "python",
      youtubeQuery: "number guessing game algorithm",
      sections: [
        {
          heading: "The plan (pseudocode)",
          body: "Our game hides a secret number and 'guesses' it smartly by halving the range each time — the same idea as binary search. Read the plan, then run the Python. Change the secret and watch how few guesses it needs.",
          code: "BEGIN\n  SET secret TO 42\n  SET low TO 1\n  SET high TO 100\n  WHILE low <= high\n    SET guess TO (low + high) / 2\n    IF guess = secret THEN PRINT \"Found!\"\n    ELSE IF guess < secret THEN SET low TO guess + 1\n    ELSE SET high TO guess - 1\n  END WHILE\nEND",
        },
      ],
      pythonCode:
        '# The computer guesses your secret by halving the range each time.\nsecret = 42\nlow, high = 1, 100\ntries = 0\nwhile low <= high:\n    guess = (low + high) // 2\n    tries += 1\n    print("Guess", tries, "->", guess)\n    if guess == secret:\n        print("Found it in", tries, "tries!")\n        break\n    elif guess < secret:\n        low = guess + 1\n    else:\n        high = guess - 1\n',
    },
    {
      slug: "pc-functions",
      title: "Functions: Reusable Steps",
      summary: "Name a block of steps and reuse it anywhere.",
      minutes: 11,
      kind: "python",
      youtubeQuery: "functions in programming explained",
      sections: [
        {
          heading: "A named procedure",
          body: "A function (or PROCEDURE) is a named group of steps you can run again and again with different inputs. It keeps programs short and clear. Here a function converts Celsius to Fahrenheit; we call it a few times.",
          code: "BEGIN\n  PROCEDURE toF(c)\n    RETURN c * 9 / 5 + 32\n  END PROCEDURE\n  PRINT toF(25)\n  PRINT toF(30)\nEND",
        },
      ],
      pythonCode:
        '# Define once, call many times.\ndef to_fahrenheit(c):\n    return c * 9 / 5 + 32\n\nfor c in [20, 25, 30]:\n    print(c, "C =", to_fahrenheit(c), "F")\n',
    },
    {
      slug: "pc-arrays",
      title: "Lists & Arrays",
      summary: "Hold many values in one place and loop over them.",
      minutes: 12,
      kind: "python",
      youtubeQuery: "arrays and lists programming",
      sections: [
        {
          heading: "A row of boxes",
          body: "An array (a list) stores many values under one name, each at a position (index) starting from 0. Loop over a list to process every item — like totalling the plants across several growers.",
          code: "BEGIN\n  SET plants TO [12, 5, 20, 8]\n  SET total TO 0\n  FOR each p IN plants\n    SET total TO total + p\n  END FOR\n  PRINT total\nEND",
        },
      ],
      pythonCode:
        '# A list holds many values; loop to process them all.\nplants = [12, 5, 20, 8]\ntotal = 0\nfor p in plants:\n    total = total + p\nprint("Total plants:", total)\nprint("Biggest grower:", max(plants))\n',
    },
    {
      slug: "pc-project-fizzbuzz",
      title: "Project: FizzBuzz",
      summary: "The classic interview puzzle — loops plus conditions.",
      minutes: 12,
      kind: "python",
      youtubeQuery: "fizzbuzz explained",
      sections: [
        {
          heading: "The rules",
          body: "Count from 1 to 20. For multiples of 3 print 'Fizz', for multiples of 5 print 'Buzz', for both print 'FizzBuzz', otherwise the number. It's a favourite test of loop + condition logic. Run it, then change 20 to 30.",
          code: "BEGIN\n  FOR n FROM 1 TO 20\n    IF n divisible by 15 THEN PRINT \"FizzBuzz\"\n    ELSE IF n divisible by 3 THEN PRINT \"Fizz\"\n    ELSE IF n divisible by 5 THEN PRINT \"Buzz\"\n    ELSE PRINT n\n  END FOR\nEND",
        },
      ],
      pythonCode:
        '# FizzBuzz: check the most specific rule (both) first.\nfor n in range(1, 21):\n    if n % 15 == 0:\n        print("FizzBuzz")\n    elif n % 3 == 0:\n        print("Fizz")\n    elif n % 5 == 0:\n        print("Buzz")\n    else:\n        print(n)\n',
    },
    {
      slug: "pc-algorithms",
      title: "Algorithms: Search & Sort",
      summary: "How computers find and order things efficiently.",
      minutes: 10,
      kind: "reading",
      youtubeQuery: "searching and sorting algorithms for beginners",
      sections: [
        {
          heading: "An algorithm is a clear plan",
          body: "An algorithm is a precise set of steps that solves a problem and always finishes. The same task can have fast and slow algorithms — good ones do less work as the data grows.",
        },
        {
          heading: "Linear vs. binary search",
          body: "Linear search checks items one by one — fine for small lists. Binary search (like our guessing game) works only on a SORTED list but halves the search each step, so it finds an item in a list of a million in about 20 checks instead of a million.",
          code: "BINARY SEARCH(list, target)\n  low = 0, high = length - 1\n  WHILE low <= high\n    mid = (low + high) / 2\n    IF list[mid] = target THEN RETURN mid\n    IF list[mid] < target THEN low = mid + 1\n    ELSE high = mid - 1\n  RETURN not found",
        },
        {
          heading: "Sorting",
          body: "Sorting puts data in order so searches and reports are easier. Simple methods like bubble sort are easy to understand but slow; real languages ship fast built-in sorts. Knowing the ideas helps you pick the right tool.",
        },
      ],
    },
    {
      slug: "pc-project-calculator",
      title: "Project: Mini Calculator",
      summary: "Put it all together — functions, lists and conditions.",
      minutes: 14,
      kind: "python",
      youtubeQuery: "build a simple calculator program",
      sections: [
        {
          heading: "Design first",
          body: "Plan the calculator in pseudocode: a function per operation, then run a list of sums and print each result. This mirrors how a real app is structured. Run it, then add your own operation (e.g. power).",
          code: "BEGIN\n  PROCEDURE calc(a, op, b)\n    IF op = \"+\" THEN RETURN a + b\n    IF op = \"-\" THEN RETURN a - b\n    IF op = \"*\" THEN RETURN a * b\n    IF op = \"/\" THEN RETURN a / b\n  END PROCEDURE\nEND",
        },
      ],
      pythonCode:
        '# A tiny calculator built from a function and a list of jobs.\ndef calc(a, op, b):\n    if op == "+":\n        return a + b\n    if op == "-":\n        return a - b\n    if op == "*":\n        return a * b\n    if op == "/":\n        return a / b if b != 0 else "cannot divide by 0"\n\njobs = [(6, "+", 4), (10, "-", 3), (7, "*", 8), (9, "/", 2)]\nfor a, op, b in jobs:\n    print(a, op, b, "=", calc(a, op, b))\n',
    },
    {
      slug: "pc-quiz",
      title: "Pseudocode Quiz",
      summary: "Check your algorithm-thinking skills.",
      minutes: 5,
      kind: "quiz",
      quiz: [
        {
          q: "What is pseudocode?",
          options: [
            "A programming language the computer runs directly",
            "A plain-language plan of a program's steps",
            "A type of computer virus",
            "A kind of database",
          ],
          answer: 1,
          explain: "Pseudocode describes the logic in plain steps, in no specific language.",
        },
        {
          q: "Which structure repeats steps while a condition stays true?",
          options: ["IF", "WHILE loop", "SET", "PRINT"],
          answer: 1,
        },
        {
          q: "In a list, the first item is usually at which index?",
          options: ["1", "0", "-1", "100"],
          answer: 1,
          explain: "Most languages start counting positions at 0.",
        },
        {
          q: "Why does binary search need a sorted list?",
          options: [
            "It doesn't — any order works",
            "So it can safely discard half the list each step",
            "To make the list look nicer",
            "Because it is slower on sorted lists",
          ],
          answer: 1,
        },
        {
          q: "What is the main benefit of a function (procedure)?",
          options: [
            "It makes the program run only once",
            "It lets you name and reuse a block of steps",
            "It deletes variables",
            "It hides errors",
          ],
          answer: 1,
        },
      ],
    },
  ],
};
