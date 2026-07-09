// Extra Robotics lessons taking the course from 4 to 30 lessons. Reading
// lessons with three short sections each, written for all ages and focused on
// robotics itself (mechanics, sensing, control, navigation) so it complements
// rather than repeats the AI course. Original content for GreenWave. Pure data,
// safe to import from server and client.

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

export const ROBOTICS_EXTRA: Lesson[] = [
  rd(
    "robot-history",
    "A Short History of Robots",
    "From ancient automatons to today's helpful machines.",
    8,
    [
      [
        "Old dreams of machines",
        "People have imagined machines that move on their own for thousands of years, building clever wind-up 'automatons' long before electricity. These could pour a drink or play music, but they only ever repeated a fixed set of motions.",
      ],
      [
        "The industrial robot",
        "The first modern robots appeared in factories in the 1960s, doing repetitive jobs like welding car bodies. They were strong, precise and tireless, but blind — they followed exact instructions and could not react to surprises.",
      ],
      [
        "Robots that sense and think",
        "As sensors and computers grew cheap and powerful, robots gained the ability to sense the world and adapt. Today's robots vacuum homes, explore other planets and help on farms — a long way from a wind-up toy.",
      ],
    ],
  ),
  rd(
    "robot-types",
    "Kinds of Robots",
    "The main families of robots and what each is for.",
    8,
    [
      [
        "Fixed and mobile",
        "Some robots stay in one place, like a robotic arm bolted to a factory floor. Others are mobile, moving on wheels, legs or propellers. The first excel at precise, repeated work; the second can go where the work is.",
      ],
      [
        "By where they work",
        "Robots are often grouped by their world: industrial robots in factories, service robots in homes and shops, field robots on farms and outdoors, and exploration robots underwater or in space. Each environment shapes the design.",
      ],
      [
        "Autonomy varies",
        "Some robots do exactly what a human commands moment to moment (teleoperated), some follow a fixed program, and some decide for themselves how to reach a goal (autonomous). Most real robots sit somewhere along this scale.",
      ],
    ],
  ),
  rd(
    "robot-anatomy",
    "The Parts of a Robot",
    "The building blocks almost every robot shares.",
    8,
    [
      [
        "Body, brain and power",
        "A robot has a body (the structure and moving parts), a controller that acts as its brain, and a power source such as a battery. These three together turn a pile of parts into a machine that can act.",
      ],
      [
        "Senses and muscles",
        "On top of that, a robot needs sensors to perceive the world and actuators — motors and similar parts — to move. The controller reads the sensors, decides, and drives the actuators, closing the sense-think-act loop.",
      ],
      [
        "Software ties it together",
        "None of the hardware means anything without a program. The software decides how sensor readings become actions. Two robots with identical bodies can behave completely differently depending on the code they run.",
      ],
    ],
  ),
  rd(
    "robot-actuators",
    "Actuators: A Robot's Muscles",
    "The parts that turn decisions into movement.",
    8,
    [
      [
        "Making things move",
        "An actuator converts energy — usually electrical — into motion. Electric motors spin wheels and tools, servos move to precise angles, and linear actuators push and pull. They are how a robot's decisions become real movement.",
      ],
      [
        "Choosing the right one",
        "A wheel that spins continuously wants a plain motor; a joint that must hold an exact angle wants a servo; a lift that moves in and out wants a linear actuator. Matching the actuator to the motion is a core design choice.",
      ],
      [
        "Force, speed and precision",
        "Actuators trade off strength, speed and accuracy. A powerful actuator may move slowly; a fast one may be weak. Good robot design picks actuators sized to the job — no more force or speed than the task really needs.",
      ],
    ],
  ),
  rd(
    "robot-sensors",
    "Sensors: A Robot's Senses",
    "How a robot perceives the world around it.",
    8,
    [
      [
        "Turning the world into data",
        "Sensors give a robot its senses. Distance sensors measure how far away things are, cameras capture images, touch sensors feel contact, and gyroscopes track tilt and turning. Each turns some part of the world into numbers.",
      ],
      [
        "Internal and external",
        "Some sensors watch the outside world (distance, light, temperature); others watch the robot itself — how fast a wheel turns, which way it is leaning, how much battery is left. A robot needs both to act sensibly.",
      ],
      [
        "No sensor is perfect",
        "Every reading carries a little noise and error, and sensors can be fooled — a distance sensor may miss glass, a camera may struggle in the dark. Good robots combine several sensors so a mistake by one is caught by another.",
      ],
    ],
  ),
  rd(
    "robot-power",
    "Powering a Robot",
    "Where a robot's energy comes from and why it matters.",
    7,
    [
      [
        "Carrying your own energy",
        "A mobile robot must carry its power, usually in rechargeable batteries. Battery size sets how long it can run and how heavy it is — more energy means more weight, which needs more energy to move. Designers balance this carefully.",
      ],
      [
        "Sharing power wisely",
        "Motors, sensors and the controller all draw from the same supply. Motors are especially hungry, so a robot manages its energy — slowing down, resting, or returning to charge — to avoid stopping dead in the middle of a task.",
      ],
      [
        "Staying charged",
        "Some robots return to a docking station to recharge on their own, like a robot vacuum. On a farm, solar panels can top up a field robot's batteries. Planning for power is as important as planning for movement.",
      ],
    ],
  ),
  rd(
    "locomotion-wheels",
    "Moving on Wheels",
    "Why wheels are the most common way robots get around.",
    8,
    [
      [
        "Simple and efficient",
        "Wheels are the most popular way to move a robot because they are simple, efficient and easy to control. On smooth, flat ground a wheeled robot rolls quickly using little energy — hard for legs to beat.",
      ],
      [
        "Steering",
        "A common design drives two wheels separately: spin both forward to go straight, spin them at different speeds to turn, and spin them opposite ways to rotate on the spot. This 'differential drive' is easy to build and program.",
      ],
      [
        "Where wheels struggle",
        "Wheels dislike stairs, deep mud and rough, broken ground. On soft farm soil, wide or tracked wheels spread the weight to avoid sinking. Choosing the right wheels for the terrain is part of designing a field robot.",
      ],
    ],
  ),
  rd(
    "locomotion-legs",
    "Walking Robots",
    "Legs are harder than wheels — but they go where wheels cannot.",
    8,
    [
      [
        "Why legs are hard",
        "Walking means constantly almost falling and catching yourself, balancing on a few small contact points. That makes legged robots much harder to build and control than wheeled ones, needing quick sensing and constant correction.",
      ],
      [
        "Why bother",
        "Legs can cross ground wheels cannot: stairs, rocks, gaps and rubble. A legged robot can step over an obstacle instead of driving around it, which is valuable in rough natural terrain or disaster zones.",
      ],
      [
        "Two legs, four, or more",
        "More legs usually mean easier balance: a six-legged robot can always keep several feet on the ground. Two-legged (humanoid) robots are the hardest of all, because they must actively balance like a person does.",
      ],
    ],
  ),
  rd(
    "robot-arms",
    "Robotic Arms",
    "The reaching, lifting machines of industry and beyond.",
    9,
    [
      [
        "Joints and links",
        "A robotic arm is a chain of rigid 'links' connected by 'joints' that bend or rotate, ending in a tool or hand. Together the joints let the tip reach many positions and angles in the space around the arm.",
      ],
      [
        "Reach and workspace",
        "The set of all points an arm can reach is its 'workspace'. More joints usually mean a larger, more flexible workspace but a harder arm to control. Designers give an arm just enough joints for its job.",
      ],
      [
        "From factories to farms",
        "Arms weld cars, assemble electronics and pack boxes with tireless precision. On farms, gentle arms can pick fruit or handle delicate seedlings — jobs that need both careful sensing and a soft, well-chosen grip.",
      ],
    ],
  ),
  rd(
    "grippers-end-effectors",
    "Grippers & End Effectors",
    "The 'hand' at the end of a robot arm.",
    8,
    [
      [
        "The tool at the tip",
        "Whatever a robot arm holds at its end is the 'end effector'. It might be a gripper that grasps, a suction cup that lifts, a welding torch, or a camera. The end effector is chosen for the specific task.",
      ],
      [
        "Gripping is tricky",
        "Holding an object without dropping or crushing it is surprisingly hard. A gripper must apply enough force to hold but not so much that it damages a soft item like a ripe tomato. Sensing that force is key.",
      ],
      [
        "Soft and clever grippers",
        "Newer 'soft' grippers use flexible, air-filled fingers that mould around an object, handling delicate or oddly shaped items gently. For farm robots picking soft produce, a gentle, adaptable grip matters more than raw strength.",
      ],
    ],
  ),
  rd(
    "degrees-of-freedom",
    "Degrees of Freedom",
    "Counting the ways a robot can move.",
    8,
    [
      [
        "What a degree of freedom is",
        "A degree of freedom (DOF) is one independent way a robot can move — one joint that bends, or one direction it can slide. Counting the DOF tells you how flexible a robot or arm is.",
      ],
      [
        "More freedom, more ability",
        "A simple gripper on a slider might have two DOF; a human arm has about seven. More DOF lets a robot reach a target from many angles and around obstacles, but each one adds a motor, cost and control complexity.",
      ],
      [
        "Enough, not too many",
        "Good design uses just enough DOF for the task. Reaching any point in space needs three; also choosing the angle of approach needs six. Beyond that, extra DOF add flexibility at the price of a harder robot to build and program.",
      ],
    ],
  ),
  rd(
    "coordinate-frames",
    "Coordinate Frames",
    "How a robot describes where things are.",
    8,
    [
      [
        "Position as numbers",
        "To act in the world, a robot must describe positions as numbers. It uses coordinate frames — an origin point and directions (x, y, z) — so any spot becomes a set of measurements it can calculate with.",
      ],
      [
        "Many frames at once",
        "A robot juggles several frames: one fixed to the world, one to its own body, one to its gripper. 'The apple is 20 cm ahead of my camera' and 'the apple is at this spot in the room' describe the same apple in different frames.",
      ],
      [
        "Switching frames",
        "The maths of turning a position in one frame into another is called a transform. It lets a robot take what its camera sees and work out how to move its arm there. Frames and transforms quietly underlie almost all robot motion.",
      ],
    ],
  ),
  rd(
    "kinematics-basics",
    "Kinematics: Where Will the Tip Go?",
    "Working out a robot's position from its joints.",
    9,
    [
      [
        "Joints to position",
        "Kinematics is the study of motion without worrying about forces. 'Forward kinematics' answers: given each joint's angle, where does the arm's tip end up? It is pure geometry — angles in, a position out.",
      ],
      [
        "The harder reverse",
        "The reverse question — 'what joint angles put the tip at this exact spot?' — is 'inverse kinematics', and it is harder. There may be several answers, or none if the target is out of reach. Robots solve it constantly to place their tools.",
      ],
      [
        "Why it matters",
        "Every time a robot arm reaches a precise point — a weld seam, a fruit, a screw hole — inverse kinematics works out the angles to get there. It is the bridge between 'go to that spot' and the motors that actually move.",
      ],
    ],
  ),
  rd(
    "control-loops",
    "Open & Closed Loop Control",
    "The difference between hoping and checking.",
    8,
    [
      [
        "Open loop: no feedback",
        "In open-loop control a robot sends a command and assumes it worked — 'turn the wheel for two seconds' — without checking the result. It is simple, but any slip, bump or worn part makes the outcome drift off target.",
      ],
      [
        "Closed loop: measure and correct",
        "Closed-loop control adds a sensor that measures the actual result and feeds it back, so the robot can correct itself. 'Keep turning until the sensor says we have arrived' reaches the goal even when conditions vary.",
      ],
      [
        "Why feedback wins",
        "Almost all reliable robots use closed-loop control for anything that matters. Measuring reality instead of trusting a command is what lets a robot stay accurate despite friction, weight and the messiness of the real world.",
      ],
    ],
  ),
  rd(
    "feedback-pid",
    "Feedback Control & PID",
    "How a robot smoothly reaches and holds a target.",
    9,
    [
      [
        "The error to fix",
        "Feedback control works from the 'error' — the gap between where the robot is and where it should be. The controller's job is to drive that error to zero, again and again, many times a second.",
      ],
      [
        "The idea behind PID",
        "A popular method, PID, blends three views of the error: how big it is now, how long it has lingered, and how fast it is changing. Combining them lets a robot approach a target quickly without overshooting or wobbling.",
      ],
      [
        "Tuning matters",
        "PID has settings that must be tuned to the machine. Too weak and it responds sluggishly; too strong and it oscillates. Good tuning is what makes a robot arm glide smoothly to a stop instead of jerking or bouncing.",
      ],
    ],
  ),
  rd(
    "sequencing-robots",
    "Sequencing: Order of Operations",
    "The most basic idea in telling a robot what to do.",
    7,
    [
      [
        "Step by step",
        "A robot program is a list of steps carried out in order — this is sequencing. 'Move forward, turn left, close gripper' does something completely different if the steps are shuffled. Order is meaning.",
      ],
      [
        "Plan before you run",
        "Because a robot follows steps exactly, planning the sequence first saves trouble. Picture the path, list the moves, then run it. The robot will do precisely what you wrote — including your mistakes — so clear planning pays off.",
      ],
      [
        "The base of all coding",
        "Sequencing is the foundation every other programming idea builds on. The robot game in this course is pure sequencing practice: arrange the commands in the right order and watch the robot reach its goal.",
      ],
    ],
  ),
  rd(
    "loops-robots",
    "Loops: Repeating Actions",
    "Letting a robot repeat steps without writing them out.",
    7,
    [
      [
        "Say it once, do it many times",
        "A loop repeats a set of commands. Instead of writing 'move forward' ten times, you write it once inside a loop that runs ten times. Loops keep programs short and make long, repetitive tasks easy.",
      ],
      [
        "Counting and forever loops",
        "Some loops run a set number of times ('repeat 4 times' to trace a square). Others run until something happens ('keep going until the sensor sees a wall'). Both save effort and make a robot's behaviour flexible.",
      ],
      [
        "Loops on a farm",
        "A field robot might loop: drive a row, check a plant, water if dry, repeat for the next plant. One well-written loop can tend a whole field of plants with the same short set of instructions.",
      ],
    ],
  ),
  rd(
    "conditionals-robots",
    "Conditionals: Making Decisions",
    "How a robot chooses one action or another.",
    7,
    [
      [
        "If this, then that",
        "A conditional lets a robot decide: 'IF the sensor sees a wall, THEN turn; otherwise, keep going.' This is how a robot reacts to the world instead of blindly following the same steps every time.",
      ],
      [
        "Reacting to sensors",
        "Conditionals connect sensing to action. The robot checks a reading and picks a branch: too dark, turn on a light; soil dry, run the pump; obstacle ahead, stop. Different readings lead to different behaviour.",
      ],
      [
        "Combining with loops",
        "The real power comes from mixing loops and conditionals: repeat forever, and each time, decide what to do based on what the sensors say. This small combination is enough to build surprisingly clever robot behaviour.",
      ],
    ],
  ),
  rd(
    "robot-navigation",
    "Navigation: Getting Around",
    "How a robot works out where to go and how to get there.",
    8,
    [
      [
        "Where am I, where to?",
        "Navigation answers two questions: where is the robot now, and how does it reach its goal? A robot combines its sensors and a plan to move from its current spot toward a target without getting lost.",
      ],
      [
        "Planning a path",
        "Given a map and a goal, the robot plans a route that avoids known obstacles — often the shortest safe path. As it moves, it checks progress and adjusts, because the real world rarely matches the plan exactly.",
      ],
      [
        "Reacting on the way",
        "Even with a good plan, surprises appear: a person steps in, a box has moved. So navigation blends planning ahead with reacting in the moment, replanning around whatever the sensors reveal.",
      ],
    ],
  ),
  rd(
    "obstacle-avoidance",
    "Avoiding Obstacles",
    "Keeping a moving robot from bumping into things.",
    7,
    [
      [
        "Sensing what's in the way",
        "To avoid obstacles a robot must first detect them, using distance sensors, cameras or bumpers. The moment something appears too close ahead, the robot needs to react before it collides.",
      ],
      [
        "Stop, steer or slow",
        "Common responses are to stop, steer around, or slow down and edge past. A simple rule — 'if something is closer than 20 cm, turn away from it' — already prevents many crashes and is easy to program.",
      ],
      [
        "Safety first",
        "For robots that share space with people, obstacle avoidance is a safety must, not a nicety. Reliable stopping and gentle behaviour around humans are essential wherever a robot and a person can meet.",
      ],
    ],
  ),
  rd(
    "line-following",
    "Line Following",
    "A classic beginner robot that traces a path.",
    7,
    [
      [
        "Following a marked path",
        "A line-following robot uses sensors underneath to detect a dark line on a light floor and steer to stay on it. It is a favourite first robotics project because it shows sensing and steering working together simply.",
      ],
      [
        "How it stays on track",
        "The robot constantly checks: am I drifting off the line? If it wanders left, it steers right, and vice versa — a tiny feedback loop repeated many times a second. Small, constant corrections keep it centred.",
      ],
      [
        "Where it is used",
        "The same idea guides warehouse robots along marked routes and factory carts between stations. A simple line on the floor is a cheap, reliable way to tell many robots exactly where to travel.",
      ],
    ],
  ),
  rd(
    "mapping-localization",
    "Mapping & Knowing Where You Are",
    "How a robot builds a map and locates itself on it.",
    9,
    [
      [
        "Two linked problems",
        "To move well, a robot often needs a map of its surroundings and to know its own place on that map. The tricky part is that building the map and locating yourself depend on each other — you need one to do the other.",
      ],
      [
        "Building the map as you go",
        "Robots solve this by exploring and updating the map and their position together, step by step, from sensor readings. This 'map while you move' approach lets a robot enter an unknown room and gradually chart it.",
      ],
      [
        "Why it is powerful",
        "With a map and its location, a robot can plan routes, remember where things are, and return to a spot later. It is what lets a robot vacuum cover a whole home once, or a field robot revisit the exact plant it checked yesterday.",
      ],
    ],
  ),
  rd(
    "computer-vision-robots",
    "Giving Robots Sight",
    "How robots make sense of what a camera sees.",
    8,
    [
      [
        "A camera is not seeing",
        "A camera gives a robot a grid of colour values, not understanding. Computer vision is the software that turns those pixels into meaning — 'that is a ripe tomato', 'that is a person', 'the path is clear ahead'.",
      ],
      [
        "Finding and recognising",
        "Vision helps a robot locate objects (where is the fruit?) and identify them (is it ripe?). Combined with the robot's coordinate frames, a seen object becomes a place the arm can reach and act on.",
      ],
      [
        "Vision on the farm",
        "For agricultural robots, sight is central: spotting weeds among crops, judging ripeness, counting plants, or guiding an arm to pick. Good lighting and clear cameras make the difference between a robot that sees well and one that stumbles.",
      ],
    ],
  ),
  rd(
    "robot-learning",
    "Robots That Learn",
    "When a robot improves with practice instead of fixed rules.",
    9,
    [
      [
        "Beyond fixed instructions",
        "Most robots follow rules a human wrote. A learning robot instead improves from experience or data — adjusting how it grips, walks or steers as it practises, much like the machine learning covered in the AI course.",
      ],
      [
        "Learning by trying",
        "One way a robot learns is trial and error: it tries an action, sees whether it worked, and favours what succeeds. In simulation it can practise thousands of times safely before ever touching the real world.",
      ],
      [
        "Promise and caution",
        "Learning lets robots handle messy, varied tasks that are hard to program by hand. But a learned skill is only as good as its practice and data, so testing carefully and keeping a human in charge stay essential.",
      ],
    ],
  ),
  rd(
    "agri-robots-drones",
    "Farm Robots & Drones",
    "How robotics is changing the way we grow food.",
    9,
    [
      [
        "Robots in the field",
        "Agricultural robots plant seeds, pull weeds, water precisely and harvest crops. By working tirelessly and acting plant by plant, they can cut waste and labour while treating each plant according to what it actually needs.",
      ],
      [
        "Eyes in the sky",
        "Drones fly over fields carrying cameras and sensors, spotting dry patches, pests or sick plants from above far faster than walking the rows. The maps they make guide ground robots and growers to exactly where attention is needed.",
      ],
      [
        "Fitting the GreenWave picture",
        "Farm robots pair naturally with smart-farm sensors and dashboards: sensors and drones reveal what is happening, and robots act on it. Together they point toward growing that is more precise, less wasteful and easier to manage.",
      ],
    ],
  ),
  rd(
    "robot-safety-ethics",
    "Robot Safety & Ethics",
    "Building and using robots responsibly.",
    8,
    [
      [
        "Safety around people",
        "A robot shares space with humans, so safety comes first: it must stop or slow when a person is near, move predictably, and fail gently. Designers add sensors and limits specifically to protect the people around a machine.",
      ],
      [
        "Jobs and fairness",
        "Robots change work — easing dangerous, dull tasks but also replacing some jobs. Using them well means thinking about the people affected: retraining, sharing the benefits, and deciding thoughtfully which tasks to automate.",
      ],
      [
        "Humans stay responsible",
        "However capable a robot becomes, people design it, deploy it and answer for what it does. Keeping humans able to understand, oversee and override robots is the foundation of using them safely and fairly.",
      ],
    ],
  ),
];
