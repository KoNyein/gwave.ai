// Teaching aids for the Robotics & AI track: original SVG diagrams (in
// /public/learn/robotics) and hands-on code samples, merged into the
// lesson data at track-assembly time. Keeping the enrichment in one file
// makes the media/code coverage easy to review and extend. Pure data.

import type { Lesson } from "@/lib/learn/lessons";
import {
  enrichLessons,
  type CodeExtra,
  type LessonImage,
} from "@/lib/learn/media-enrich";

const IMG = "/learn/robotics";

/** Diagram attached to the first section of the lesson with this slug. */
const IMAGES: Record<string, LessonImage> = {
  "what-is-a-robot": {
    src: `${IMG}/sense-think-act.svg`,
    alt: "Sense, Think, Act loop diagram",
    caption: "Robot တိုင်းရဲ့ နှလုံးသား — အာရုံခံ → ဆုံးဖြတ် → လှုပ်ရှား စက်ဝန်း",
  },
  "robot-anatomy": {
    src: `${IMG}/robot-anatomy.svg`,
    alt: "Labeled robot parts diagram",
    caption: "Robot ရဲ့ အဓိက အစိတ်အပိုင်း — sensor, controller, power, actuator",
  },
  "robot-arms": {
    src: `${IMG}/two-link-arm.svg`,
    alt: "Two-link robot arm diagram",
    caption: "လက်ဆစ် ၂ ဆစ်ပါ robot arm — joint ထောင့်တွေက လက်ဖျားနေရာ ဆုံးဖြတ်",
  },
  "degrees-of-freedom": {
    src: `${IMG}/two-link-arm.svg`,
    alt: "Robot arm joints diagram",
    caption: "Joint တစ်ခုစီက DOF တစ်ခု — ဒီ arm မှာ ၂ DOF ရှိသည်",
  },
  "coordinate-frames": {
    src: `${IMG}/coordinate-frames.svg`,
    alt: "World frame and robot frame diagram",
    caption: "ကမ္ဘာ့ဘောင် (world frame) ထဲမှာ robot ရဲ့ pose (x, y, θ)",
  },
  "kinematics-basics": {
    src: `${IMG}/two-link-arm.svg`,
    alt: "Forward kinematics of a two-link arm",
    caption: "Joint ထောင့် θ1, θ2 ကနေ လက်ဖျား (x, y) ကို တွက်ခြင်း",
  },
  "feedback-pid": {
    src: `${IMG}/pid-loop.svg`,
    alt: "PID feedback control loop block diagram",
    caption: "Closed-loop — sensor ကပြန်ဖတ်ပြီး error ကို PID နဲ့ ပြင်",
  },
  "locomotion-wheels": {
    src: `${IMG}/differential-drive.svg`,
    alt: "Differential drive robot diagram",
    caption: "ဘီးနှစ်ဖက် အမြန်နှုန်း ကွာရင် robot ကွေ့သည်",
  },
  "obstacle-avoidance": {
    src: `${IMG}/ultrasonic.svg`,
    alt: "Ultrasonic distance sensing diagram",
    caption: "အသံလှိုင်း ပဲ့တင်ပြန်ချိန်နဲ့ အကွာအဝေး တွက်ခြင်း",
  },
  "line-following": {
    src: `${IMG}/line-follower.svg`,
    alt: "Line follower robot with two IR sensors",
    caption: "IR sensor နှစ်လုံးနဲ့ မျဉ်းကြောင်း လိုက်ခြင်း",
  },
  "mapping-localization": {
    src: `${IMG}/lidar-slam.svg`,
    alt: "LiDAR scan building a map",
    caption: "အကွာအဝေး ထိမှတ်များ စုပေါင်းပြီး မြေပုံ ဖြစ်လာပုံ",
  },
  "robo-servo-stepper": {
    src: `${IMG}/robot-anatomy.svg`,
    alt: "Robot actuator diagram",
    caption: "Actuator — ဆုံးဖြတ်ချက်ကို လှုပ်ရှားမှု ပြောင်းပေးတဲ့ အစိတ်အပိုင်း",
  },
  "robo-motor-drivers": {
    src: `${IMG}/h-bridge.svg`,
    alt: "H-bridge motor driver circuit diagram",
    caption: "Switch လေးလုံးက လျှပ်စီး ဦးတည်ချက်ပြောင်းပြီး motor အလှည့် ထိန်း",
  },
  "robo-encoders": {
    src: `${IMG}/encoder.svg`,
    alt: "Optical encoder disc and pulse train",
    caption: "အပေါက်ပါ disc လည်တိုင်း pulse ထွက် — ရေတွက်ရင် လှည့်ထောင့်သိ",
  },
  "robo-imu": {
    src: `${IMG}/imu-axes.svg`,
    alt: "IMU roll pitch yaw axes",
    caption: "Roll / Pitch / Yaw — robot ရဲ့ စောင်းချိန် သုံးမျိုး",
  },
  "robo-differential-drive": {
    src: `${IMG}/differential-drive.svg`,
    alt: "Differential drive kinematics diagram",
    caption: "v = (vL+vR)/2, ω = (vR−vL)/L — ဘီးနှစ်ဖက်နဲ့ လမ်းကြောင်းထိန်း",
  },
  "robo-holonomic": {
    src: `${IMG}/mecanum.svg`,
    alt: "Mecanum wheel robot diagram",
    caption: "Roller ၄၅° စောင်းပါတဲ့ ဘီးလေးလုံး — ဘယ်ဘက်မဆို ရွေ့နိုင်",
  },
  "robo-inverse-kinematics": {
    src: `${IMG}/two-link-arm.svg`,
    alt: "Two-link arm inverse kinematics diagram",
    caption: "လိုချင်တဲ့ (x, y) အတွက် θ1, θ2 ကို ပြောင်းပြန် တွက်ခြင်း",
  },
  "robo-pid-tuning": {
    src: `${IMG}/pid-loop.svg`,
    alt: "PID control loop diagram",
    caption: "Kp, Ki, Kd သုံးလုံး ချိန်ညှိပြီး တုံ့ပြန်မှု ချောမွေ့စေ",
  },
  "robo-lidar": {
    src: `${IMG}/lidar-slam.svg`,
    alt: "LiDAR scanning surroundings",
    caption: "Laser ရောင်ခြည် ၃၆၀° ပတ်ပြီး ပတ်ဝန်းကျင် အကွာအဝေးတိုင်း",
  },
  "robo-slam": {
    src: `${IMG}/lidar-slam.svg`,
    alt: "SLAM building a map while localizing",
    caption: "မြေပုံဆွဲရင်း ကိုယ့်နေရာကိုပါ တစ်ပြိုင်နက် ခန့်မှန်း",
  },
  "robo-path-planning": {
    src: `${IMG}/astar-grid.svg`,
    alt: "Grid path planning diagram",
    caption: "Grid ပေါ်မှာ အစမှ ပန်းတိုင်ထိ လမ်းကြောင်း ရှာခြင်း",
  },
  "robo-a-star": {
    src: `${IMG}/astar-grid.svg`,
    alt: "A star algorithm on a grid",
    caption: "A* — စရိတ် g(n) + ခန့်မှန်း h(n) အနည်းဆုံးကို အရင်စစ်",
  },
  "robo-obstacle-sensors": {
    src: `${IMG}/ultrasonic.svg`,
    alt: "Ultrasonic obstacle sensing",
    caption: "Ultrasonic — ပဲ့တင်သံ ပြန်ရောက်ချိန်ကနေ အကွာအဝေး",
  },
  "robo-drone-flight": {
    src: `${IMG}/quadcopter.svg`,
    alt: "Quadcopter motor layout",
    caption: "Motor လေးလုံး — နှစ်လုံး ↻ နှစ်လုံး ↺ လှည့်ပြီး torque ချေ",
  },
  "robo-self-balance": {
    src: `${IMG}/inverted-pendulum.svg`,
    alt: "Inverted pendulum balancing diagram",
    caption: "ယိမ်းတဲ့ဘက် ဘီးမောင်းပြီး ဟန်ချက်ထိန်း — segway နည်းပညာ",
  },
  "robo-project-line-follower": {
    src: `${IMG}/line-follower.svg`,
    alt: "Line follower project diagram",
    caption: "Project — sensor ဖတ် → ဆုံးဖြတ် → motor မောင်း စက်ဝန်းအပြည့်",
  },
};

/** A hands-on code section appended to the lesson with this slug. */
const CODE: Record<string, CodeExtra> = {
  "what-is-a-robot": {
    heading: "လက်တွေ့ — robot loop ကို code နဲ့",
    body: "Robot တိုင်းရဲ့ program က ဒီပုံစံပါပဲ — ထာဝရ loop ထဲမှာ ဖတ်၊ ဆုံးဖြတ်၊ လှုပ်ရှား။",
    code: "// Arduino-style robot loop\nvoid loop() {\n  int distance = readUltrasonic();   // ၁။ Sense — အာရုံခံ\n  if (distance < 20) {               // ၂။ Think — ဆုံးဖြတ်\n    turnLeft();                      // ၃။ Act — လှုပ်ရှား\n  } else {\n    driveForward();\n  }\n}                                    // → ပြန်စ (တစ်စက္ကန့် ရာချီ)",
  },
  "how-ai-helps-farms": {
    heading: "လက်တွေ့ — rule vs AI",
    body: "Rule-based က လူရေးထားတဲ့ if၊ AI က data ကနေ သင်ယူထားတဲ့ model။",
    code: "# Rule-based — လူရေးတဲ့ စည်းမျဉ်း\nif humidity > 70:\n    fan_on()\n\n# AI — data ကနေ သင်ယူထားတဲ့ model\nharvest_day = model.predict([temp, humidity, ec, light])\nprint(f\"ခန့်မှန်း ရိတ်သိမ်းရက်: {harvest_day}\")",
  },
  "robot-actuators": {
    heading: "လက်တွေ့ — servo လှည့်ကြည့်",
    body: "Servo motor ကို ထောင့်တိကျစွာ လှည့်ခိုင်းတဲ့ Arduino code။",
    code: "#include <Servo.h>\nServo arm;\n\nvoid setup() { arm.attach(9); }      // pin 9\n\nvoid loop() {\n  arm.write(0);     delay(1000);     // ၀° သို့\n  arm.write(90);    delay(1000);     // ၉၀° သို့\n  arm.write(180);   delay(1000);     // ၁၈၀° သို့\n}",
  },
  "robot-sensors": {
    heading: "လက်တွေ့ — ultrasonic ဖတ်ကြည့်",
    body: "HC-SR04 sensor နဲ့ အကွာအဝေး စင်တီမီတာ ဖတ်တဲ့ code။",
    code: "long readDistanceCm() {\n  digitalWrite(TRIG, HIGH);          // အသံလှိုင်း ပစ်\n  delayMicroseconds(10);\n  digitalWrite(TRIG, LOW);\n  long t = pulseIn(ECHO, HIGH);      // ပဲ့တင်သံ ကြာချိန် (µs)\n  return t * 0.034 / 2;              // အသံနှုန်း × အချိန် ÷ 2\n}",
  },
  "robot-power": {
    heading: "လက်တွေ့ — battery voltage စောင့်ကြည့်",
    body: "Voltage divider နဲ့ battery ဖတ်ပြီး နည်းရင် သတိပေးတဲ့ code။",
    code: "float readBattery() {\n  int raw = analogRead(A0);              // 0–1023\n  return raw * (5.0 / 1023.0) * 2.0;     // divider ×2 ပြန်ချဲ့\n}\n\nvoid loop() {\n  if (readBattery() < 6.4) {             // 2S LiPo အနိမ့်ဆုံး\n    stopMotors();                        // ချက်ချင်း ရပ် — battery ကာကွယ်\n    blinkWarning();\n  }\n}",
  },
  "locomotion-wheels": {
    heading: "လက်တွေ့ — ဘီးနှစ်ဖက် မောင်းကြည့်",
    body: "ဘီးနှစ်ဖက် အမြန်နှုန်း ချိန်ပြီး တည့်တည့်သွား/ကွေ့စေတဲ့ code။",
    code: "void drive(int left, int right) {   // -255 … 255\n  setMotor(LEFT_MOTOR, left);\n  setMotor(RIGHT_MOTOR, right);\n}\n\ndrive(200, 200);   // တည့်တည့် ရှေ့သွား\ndrive(100, 200);   // ဘယ်ကွေ့ (ဘယ်ဘီး နှေး)\ndrive(-150, 150);  // နေရာမှာပဲ လှည့် (spin)",
  },
  "grippers-end-effectors": {
    heading: "လက်တွေ့ — gripper ဖွင့်ပိတ်",
    body: "Servo တစ်လုံးတည်းနဲ့ လုပ်ထားတဲ့ gripper ရိုးရိုး။",
    code: "Servo gripper;\nconst int OPEN = 100, CLOSED = 35;   // ထောင့် ချိန်ညှိပြီးသား\n\nvoid grab()    { gripper.write(CLOSED); delay(400); }\nvoid release() { gripper.write(OPEN);   delay(400); }\n\n// အသုံး: သွား → ဆွဲ → ယူလာ → လွှတ်\ndriveTo(target); grab(); driveTo(home); release();",
  },
  "coordinate-frames": {
    heading: "လက်တွေ့ — frame ပြောင်းတွက်",
    body: "Robot frame က အမှတ်ကို world frame ကို ပြောင်းတဲ့ ပုံသေနည်း။",
    code: "import math\n\ndef robot_to_world(px, py, rx, ry, theta):\n    \"\"\"robot frame (px,py) → world frame\"\"\"\n    wx = rx + px * math.cos(theta) - py * math.sin(theta)\n    wy = ry + px * math.sin(theta) + py * math.cos(theta)\n    return wx, wy\n\n# robot က (2,0,45°) မှာရှိ၊ ရှေ့ 1m က အရာဝတ္ထု world မှာ ဘယ်နေရာ?\nprint(robot_to_world(1, 0, 2, 0, math.radians(45)))",
  },
  "kinematics-basics": {
    heading: "လက်တွေ့ — forward kinematics",
    body: "Joint ထောင့်နှစ်ခုကနေ လက်ဖျားနေရာ တွက်တဲ့ Python code။",
    code: "import math\n\ndef forward(theta1, theta2, L1=10, L2=8):\n    x = L1*math.cos(theta1) + L2*math.cos(theta1+theta2)\n    y = L1*math.sin(theta1) + L2*math.sin(theta1+theta2)\n    return x, y\n\n# joint နှစ်ခုလုံး 45° ဆိုရင် လက်ဖျား ဘယ်ရောက်လဲ?\nx, y = forward(math.radians(45), math.radians(45))\nprint(f\"tip = ({x:.1f}, {y:.1f})\")",
  },
  "control-loops": {
    heading: "လက်တွေ့ — open vs closed",
    body: "စစ်ဆေးမှု မပါ/ပါ ကွာခြားချက်ကို code နှစ်ပိုင်းနဲ့ နှိုင်းယှဉ်။",
    code: "// Open-loop — မျှော်လင့်ရုံ (စစ်မကြည့်)\nmotorOn(); delay(3000); motorOff();   // ၃ စက္ကန့် = 1m လို့ မျှော်\n\n// Closed-loop — sensor နဲ့ စစ်ရင်း သွား\nwhile (encoderDistance() < 100) {     // 100cm ပြည့်တဲ့ထိ\n  driveForward();\n}\nstopMotors();                         // တိကျစွာ ရပ်",
  },
  "feedback-pid": {
    heading: "လက်တွေ့ — PID controller",
    body: "Error သုံးမျိုး (ခု၊ စုစုပေါင်း၊ အပြောင်းအလဲ) ပေါင်းတဲ့ PID အပြည့်။",
    code: "float Kp=2.0, Ki=0.1, Kd=0.5;\nfloat integral=0, lastError=0;\n\nfloat pid(float target, float actual, float dt) {\n  float error = target - actual;      // ဘယ်လောက် လွဲလဲ\n  integral += error * dt;             // စုစုပေါင်း လွဲချက်\n  float deriv = (error - lastError) / dt;  // ပြောင်းနှုန်း\n  lastError = error;\n  return Kp*error + Ki*integral + Kd*deriv;\n}",
  },
  "sequencing-robots": {
    heading: "လက်တွေ့ — command အစီအစဉ်",
    body: "Robot ကို command စာရင်း အစဉ်လိုက် လုပ်ခိုင်းခြင်း — sequencing။",
    code: "commands = [\"forward\", \"forward\", \"left\", \"forward\", \"grab\"]\n\nfor cmd in commands:            # အစဉ်လိုက် တစ်ခုချင်း\n    robot.do(cmd)\n    print(\"လုပ်ပြီး:\", cmd)\n\n# အစီအစဉ် မှားရင် ရလဒ်လုံးဝ ပြောင်း —\n# \"grab\" ကို အရင်ထားရင် ဘာမှ မဆွဲမိ!",
  },
  "loops-robots": {
    heading: "လက်တွေ့ — loop နဲ့ စတုရန်းသွား",
    body: "ထပ်ခါလုပ်တာကို loop နဲ့ တိုစေခြင်း — စတုရန်းပုံ လမ်းကြောင်း။",
    code: "# မ loop ဘဲ — ၈ ကြောင်း\n# forward(); turn(90); forward(); turn(90); ...\n\n# loop နဲ့ — ၃ ကြောင်း\nfor i in range(4):\n    robot.forward(50)   # 50cm သွား\n    robot.turn(90)      # ညာ ၉၀° ကွေ့\n# → စတုရန်းပုံ ပြီး၊ ထောင့် ၅ လိုရင် range(5) ပဲ ပြောင်း",
  },
  "conditionals-robots": {
    heading: "လက်တွေ့ — if နဲ့ ဆုံးဖြတ်",
    body: "Sensor တန်ဖိုးပေါ် မူတည်ပြီး လမ်းခွဲ ရွေးခြင်း။",
    code: "distance = robot.read_ultrasonic()\n\nif distance < 15:          # အရမ်းနီး — အန္တရာယ်\n    robot.stop()\n    robot.backward(10)\nelif distance < 40:        # နီးလာပြီ — ရှောင်\n    robot.turn(45)\nelse:                      # ရှင်း — ဆက်သွား\n    robot.forward(20)",
  },
  "robot-navigation": {
    heading: "လက်တွေ့ — waypoint လိုက်ခြင်း",
    body: "မှတ်တိုင်တွေကို တစ်ခုပြီးတစ်ခု သွားတဲ့ navigation အခြေခံ။",
    code: "import math\nwaypoints = [(0,2), (3,2), (3,5)]\n\nfor wx, wy in waypoints:\n    # ၁။ ပန်းတိုင်ဘက် ဦးတည်ချက် တွက်\n    angle = math.atan2(wy - robot.y, wx - robot.x)\n    robot.turn_to(angle)\n    # ၂။ ရောက်တဲ့ထိ သွား (ရောက်ပြီလား စစ်ရင်း)\n    while robot.distance_to(wx, wy) > 0.1:\n        robot.forward_step()",
  },
  "obstacle-avoidance": {
    heading: "လက်တွေ့ — ရှောင်တိမ်း logic",
    body: "ရှေ့မှာ အတားရှိရင် ရပ်၊ လှည့်ကြည့်၊ ရှင်းတဲ့ဘက် သွားတဲ့ code။",
    code: "void loop() {\n  if (readDistanceCm() < 25) {       // အတား တွေ့ပြီ\n    stopMotors();\n    turnHead(-45); long left  = readDistanceCm();\n    turnHead(45);  long right = readDistanceCm();\n    turnHead(0);\n    if (left > right) turnLeft(60);  // ရှင်းတဲ့ဘက် ရွေး\n    else              turnRight(60);\n  }\n  driveForward();\n}",
  },
  "line-following": {
    heading: "လက်တွေ့ — sensor နှစ်လုံး line follow",
    body: "IR sensor နှစ်လုံးရဲ့ အနက်/အဖြူ ဖတ်ချက်နဲ့ မျဉ်းပေါ် နေအောင် ထိန်း။",
    code: "void loop() {\n  bool L = digitalRead(IR_LEFT);    // 1 = အနက် (မျဉ်း)\n  bool R = digitalRead(IR_RIGHT);\n\n  if      (!L && !R) drive(180, 180); // နှစ်ခုလုံး အဖြူ → တည့်တည့်\n  else if ( L && !R) drive( 80, 180); // ဘယ်က မျဉ်းထိ → ဘယ်ကွေ့\n  else if (!L &&  R) drive(180,  80); // ညာက မျဉ်းထိ → ညာကွေ့\n  else               drive(  0,   0); // နှစ်ခုလုံး အနက် → ဆုံးမှတ်\n}",
  },
  "mapping-localization": {
    heading: "လက်တွေ့ — occupancy grid",
    body: "မြေပုံကို ကွက်လေးတွေ (grid) အဖြစ် သိမ်း — 1 = အတား, 0 = ရှင်း။",
    code: "# 0 = ရှင်း, 1 = အတား, -1 = မသိသေး\ngrid = [[-1]*20 for _ in range(20)]\n\ndef update_map(robot_x, robot_y, hit_x, hit_y):\n    # ray တစ်လျှောက် ကွက်တွေ ရှင်း၊ ထိမှတ်ကွက် အတား\n    for cx, cy in cells_between(robot_x, robot_y, hit_x, hit_y):\n        grid[cy][cx] = 0\n    grid[hit_y][hit_x] = 1     # sensor ထိတဲ့နေရာ = နံရံ",
  },
  "computer-vision-robots": {
    heading: "လက်တွေ့ — အရောင်နဲ့ အရာရှာ",
    body: "OpenCV နဲ့ အနီရောင် အရာဝတ္ထုကို ရှာပြီး အလယ်မှတ် ထုတ်ခြင်း။",
    code: "import cv2\n\nframe = camera.read()\nhsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)\nmask = cv2.inRange(hsv, (0,120,70), (10,255,255))  # အနီ\nM = cv2.moments(mask)\nif M[\"m00\"] > 0:\n    cx = int(M[\"m10\"] / M[\"m00\"])   # အရာဝတ္ထု အလယ် x\n    # cx < width/2 → ဘယ်ဘက်မှာ → ဘယ်လှည့်\n    robot.turn_towards(cx)",
  },
  "robot-learning": {
    heading: "လက်တွေ့ — Q-learning တစ်ကြောင်း",
    body: "ဆုကြေး (reward) ကနေ တဖြည်းဖြည်း သင်ယူတဲ့ update rule။",
    code: "# Q[state][action] = ဒီအခြေအနေမှာ ဒီအလုပ်လုပ်ရင် ဘယ်လောက်ကောင်းလဲ\nalpha, gamma = 0.1, 0.9\n\ndef learn(state, action, reward, next_state):\n    best_next = max(Q[next_state].values())\n    Q[state][action] += alpha * (\n        reward + gamma * best_next - Q[state][action]\n    )\n# ကြိမ်ပေါင်းများစွာ စမ်း → မှားရင် ဆုနည်း → မှန်တဲ့လမ်း သင်ယူ",
  },
  "agri-robots-drones": {
    heading: "လက်တွေ့ — drone စိုက်ကွင်း စစ်ဆေးရေး",
    body: "ကွင်းကို အတန်းလိုက် ပျံသန်းစစ်တဲ့ mission ပုံစံ။",
    code: "# စိုက်ကွင်းကို \"lawnmower\" ပုံစံ အတန်းလိုက် ပျံစစ်\nfor row in range(6):\n    y = row * 10                      # အတန်းခြား 10m\n    drone.goto(0 if row%2 else 60, y) # ဇစ်ဇက် သွား\n    photo = drone.capture()\n    stress = ndvi(photo)              # အပင် ကျန်းမာရေး index\n    if stress > 0.4:\n        mark_for_inspection(row)      # လူ သွားစစ်ရန် မှတ်",
  },
  "robo-servo-stepper": {
    heading: "လက်တွေ့ — stepper တစ်ဆင့်ချင်းလှည့်",
    body: "Stepper ကို step အရေအတွက် တိကျစွာ ခိုင်းခြင်း။",
    code: "// 200 steps = ၁ ပတ် (1.8°/step)\nvoid stepMotor(int steps, bool cw) {\n  digitalWrite(DIR_PIN, cw);\n  for (int i = 0; i < steps; i++) {\n    digitalWrite(STEP_PIN, HIGH);\n    delayMicroseconds(800);\n    digitalWrite(STEP_PIN, LOW);\n    delayMicroseconds(800);\n  }\n}\nstepMotor(100, true);   // ၁၈၀° တိတိ လှည့်",
  },
  "robo-motor-drivers": {
    heading: "လက်တွေ့ — H-bridge ထိန်းချုပ်",
    body: "L298N driver ရဲ့ pin နှစ်ချောင်းနဲ့ ရှေ့/နောက်/ရပ်။",
    code: "void forward(int speed) {\n  digitalWrite(IN1, HIGH); digitalWrite(IN2, LOW);\n  analogWrite(EN, speed);          // PWM = အမြန်နှုန်း\n}\nvoid backward(int speed) {\n  digitalWrite(IN1, LOW);  digitalWrite(IN2, HIGH);\n  analogWrite(EN, speed);\n}\nvoid brake() {\n  digitalWrite(IN1, LOW);  digitalWrite(IN2, LOW);\n}",
  },
  "robo-encoders": {
    heading: "လက်တွေ့ — interrupt နဲ့ pulse ရေတွက်",
    body: "Encoder pulse ကို interrupt နဲ့ မလွတ်တမ်း ရေတွက်ပြီး အကွာအဝေး တွက်။",
    code: "volatile long count = 0;\nvoid onPulse() { count++; }          // pulse တိုင်း အလိုအလျောက်\n\nvoid setup() {\n  attachInterrupt(digitalPinToInterrupt(2), onPulse, RISING);\n}\n\nfloat distanceCm() {\n  // ၁ ပတ် = 20 pulse, ဘီးပတ်လည် = 21cm\n  return (count / 20.0) * 21.0;\n}",
  },
  "robo-imu": {
    heading: "လက်တွေ့ — complementary filter",
    body: "Gyro (မြန်ပေမယ့် drift) + accel (နှေးပေမယ့် တည်ငြိမ်) ပေါင်းခြင်း။",
    code: "float angle = 0;\n\nvoid update(float dt) {\n  float gyroRate  = readGyroX();          // °/s\n  float accAngle  = atan2(accY(), accZ()) * 57.3;\n  // 98% gyro (မြန်) + 2% accel (drift ပြင်)\n  angle = 0.98 * (angle + gyroRate * dt)\n        + 0.02 * accAngle;\n}",
  },
  "robo-differential-drive": {
    heading: "လက်တွေ့ — v, ω ကနေ ဘီးအမြန်",
    body: "လိုချင်တဲ့ ရှေ့တိုးနှုန်း v နဲ့ လှည့်နှုန်း ω ကို ဘီးနှစ်ဖက် အမြန် ပြောင်း။",
    code: "WHEEL_BASE = 0.15   # ဘီးနှစ်ဖက်ကြား 15cm\n\ndef drive(v, omega):\n    \"\"\"v = m/s, omega = rad/s\"\"\"\n    vl = v - omega * WHEEL_BASE / 2\n    vr = v + omega * WHEEL_BASE / 2\n    set_wheel_speeds(vl, vr)\n\ndrive(0.3, 0.0)    # တည့်တည့် 0.3 m/s\ndrive(0.2, 1.0)    # သွားရင်း ဘယ်ကွေ့\ndrive(0.0, 2.0)    # နေရာမှာပဲ လှည့်",
  },
  "robo-holonomic": {
    heading: "လက်တွေ့ — mecanum mixing",
    body: "ရှေ့/ဘေး/လှည့် သုံးမျိုးကို ဘီးလေးလုံး အမြန်အဖြစ် ပေါင်းစပ်။",
    code: "def mecanum(vx, vy, omega):\n    \"\"\"vx=ရှေ့, vy=ဘေး, omega=လှည့်\"\"\"\n    fl = vx - vy - omega    # ရှေ့ဘယ်\n    fr = vx + vy + omega    # ရှေ့ညာ\n    bl = vx + vy - omega    # နောက်ဘယ်\n    br = vx - vy + omega    # နောက်ညာ\n    return fl, fr, bl, br\n\nmecanum(0, 1, 0)   # ဘေးတိုက် ညာရွေ့ — ဘီးမလှည့်ဘဲ!",
  },
  "robo-inverse-kinematics": {
    heading: "လက်တွေ့ — 2-link IK",
    body: "လိုချင်တဲ့ (x, y) အတွက် joint ထောင့် ပြောင်းပြန်တွက်တဲ့ Python code။",
    code: "import math\n\ndef ik(x, y, L1=10, L2=8):\n    d = (x*x + y*y - L1*L1 - L2*L2) / (2*L1*L2)\n    if abs(d) > 1: return None        # လက်မမီ!\n    t2 = math.acos(d)                 # elbow ထောင့်\n    t1 = math.atan2(y, x) - math.atan2(\n        L2*math.sin(t2), L1 + L2*math.cos(t2))\n    return math.degrees(t1), math.degrees(t2)\n\nprint(ik(12, 8))   # ဒီနေရာရောက်ဖို့ joint ထောင့်များ",
  },
  "robo-pid-tuning": {
    heading: "လက်တွေ့ — အဆင့်လိုက် tuning",
    body: "Kp အရင်၊ ပြီးမှ Kd၊ နောက်ဆုံး Ki — လက်တွေ့ ချိန်နည်း အစဉ်။",
    code: "# ၁။ Ki=Kd=0 ထား၊ Kp တိုး — တုန်ခါစ ရောက်တဲ့ထိ\nKp, Ki, Kd = 1.0, 0.0, 0.0\n# → 4.0 မှာ တုန်ခါရင် Kp = 4.0 × 0.6 ≈ 2.4 ယူ\n\n# ၂။ Kd တိုး — ကျော်လွန်မှု (overshoot) သတ်\nKd = 0.4\n\n# ၃။ steady error ကျန်ရင် Ki အနည်းငယ် ထည့်\nKi = 0.05\n# သတိ: Ki များရင် integral windup — တုန်ခါပြန်မည်",
  },
  "robo-lidar": {
    heading: "လက်တွေ့ — scan ထဲက အနီးဆုံးရှာ",
    body: "LiDAR scan (ထောင့်တိုင်း အကွာအဝေး) ထဲက အနီးဆုံး အတားရှာခြင်း။",
    code: "# scan = [ထောင့် 0° ကနေ 359° ထိ အကွာအဝေး (m)]\nscan = lidar.read()\n\nnearest = min(range(360), key=lambda a: scan[a])\nprint(f\"အနီးဆုံး: {scan[nearest]:.2f}m at {nearest}°\")\n\nif scan[nearest] < 0.3:          # 30cm အတွင်း\n    robot.turn(nearest + 180)    # ဆန့်ကျင်ဘက် လှည့်ရှောင်",
  },
  "robo-slam": {
    heading: "လက်တွေ့ — SLAM စက်ဝန်း",
    body: "Predict (ရွေ့သလောက် ခန့်မှန်း) → Update (scan နဲ့ ပြင်) စက်ဝန်း။",
    code: "while True:\n    # ၁။ Predict — encoder/IMU အရ ကိုယ့် pose ရွှေ့ခန့်မှန်း\n    pose = motion_model(pose, wheel_odometry())\n\n    # ၂။ Update — scan ကို မြေပုံနဲ့ တိုက်ပြီး pose ပြင်\n    scan = lidar.read()\n    pose = scan_match(scan, grid_map, pose)\n\n    # ၃။ Map — ပြင်ပြီး pose နဲ့ မြေပုံ ဖြည့်\n    grid_map.integrate(scan, pose)",
  },
  "robo-path-planning": {
    heading: "လက်တွေ့ — BFS လမ်းရှာ",
    body: "Grid ပေါ်မှာ အနီးဆုံးကွက်တွေ တစ်လွှာချင်း ချဲ့ရှာတဲ့ BFS။",
    code: "from collections import deque\n\ndef bfs(grid, start, goal):\n    q = deque([start]); parent = {start: None}\n    while q:\n        cur = q.popleft()\n        if cur == goal:                 # ရောက်ပြီ — လမ်းပြန်ဆွဲ\n            return path_from(parent, goal)\n        for nb in neighbors(cur):       # ဘေး ၄ ကွက်\n            if grid[nb] == 0 and nb not in parent:\n                parent[nb] = cur\n                q.append(nb)",
  },
  "robo-a-star": {
    heading: "လက်တွေ့ — A* core",
    body: "f = g (လာခဲ့စရိတ်) + h (ကျန်ခန့်မှန်း) အနည်းဆုံးကို အရင်စစ်။",
    code: "import heapq\n\ndef astar(grid, start, goal):\n    h = lambda p: abs(p[0]-goal[0]) + abs(p[1]-goal[1])\n    open_ = [(h(start), 0, start, None)]\n    seen = {}\n    while open_:\n        f, g, cur, par = heapq.heappop(open_)\n        if cur in seen: continue\n        seen[cur] = par\n        if cur == goal: return path_from(seen, goal)\n        for nb in free_neighbors(grid, cur):\n            heapq.heappush(open_, (g+1+h(nb), g+1, nb, cur))",
  },
  "robo-obstacle-sensors": {
    heading: "လက်တွေ့ — sensor နှစ်မျိုး ပေါင်းသုံး",
    body: "Ultrasonic (အဝေး) + IR (အနီး/အစွန်း) ပေါင်းစစ်ခြင်း — sensor fusion အခြေခံ။",
    code: "void loop() {\n  long d   = readUltrasonicCm();     // ရှေ့ အဝေးကြီး\n  bool edge = !digitalRead(IR_DOWN); // အောက် — စားပွဲစွန်း!\n\n  if (edge) {              // ချောက်/စွန်း — အရေးပေါ်ဆုံး\n    stopMotors(); backward(20);\n  } else if (d < 20) {     // ရှေ့ အတား\n    avoidTurn();\n  } else {\n    driveForward();\n  }\n}",
  },
  "robo-vision-tracking": {
    heading: "လက်တွေ့ — centroid tracking",
    body: "Frame တိုင်း အရာဝတ္ထုအလယ်မှတ်ကို ရှာပြီး camera အလယ် ရောက်အောင် လိုက်။",
    code: "while True:\n    frame = camera.read()\n    cx = find_object_center_x(frame)   # mask + moments\n    if cx is None:\n        robot.spin_slow()              # ပျောက် — လှည့်ရှာ\n        continue\n    error = cx - FRAME_WIDTH // 2      # အလယ်က ဘယ်လောက်လွဲ\n    robot.turn_speed(Kp * error)       # P-control နဲ့ လိုက်\n    if abs(error) < 20:\n        robot.forward_slow()           # တည့်ပြီ — ချဉ်းကပ်",
  },
  "robo-depth-camera": {
    heading: "လက်တွေ့ — depth frame စစ်",
    body: "Depth camera ရဲ့ pixel တိုင်း အကွာအဝေးပါတဲ့ frame ကို စစ်ခြင်း။",
    code: "depth = camera.read_depth()      # 2D array — mm\n\n# ရှေ့တည့်တည့် အကွက် (center window) အနီးဆုံးဖတ်\ncenter = depth[200:280, 280:360]\nnearest_mm = center.min()\n\nif nearest_mm < 400:             # 40cm အတွင်း အတား\n    robot.stop()\nelse:\n    robot.forward()",
  },
  "robo-ros": {
    heading: "လက်တွေ့ — ROS publisher",
    body: "ROS မှာ node တစ်ခုက topic ပေါ် velocity command ပို့ခြင်း။",
    code: "import rclpy\nfrom geometry_msgs.msg import Twist\n\nrclpy.init()\nnode = rclpy.create_node(\"driver\")\npub = node.create_publisher(Twist, \"/cmd_vel\", 10)\n\nmsg = Twist()\nmsg.linear.x = 0.2      # ရှေ့ 0.2 m/s\nmsg.angular.z = 0.5     # လှည့် 0.5 rad/s\npub.publish(msg)        # motor node က နားထောင်ပြီး မောင်း",
  },
  "robo-simulation": {
    heading: "လက်တွေ့ — simulation မှာ အရင်စမ်း",
    body: "အစစ်မတိုင်ခင် virtual robot နဲ့ code စမ်းတဲ့ လုပ်ငန်းစဉ်။",
    code: "# Gazebo/simulator မှာ robot မော်ဒယ် launch\n$ ros2 launch my_robot sim.launch.py\n\n# code က sim ရော အစစ်ရော — topic တူတူပဲ\n$ ros2 run my_robot line_follower\n\n# sim မှာ အဆင်ပြေမှ hardware ပေါ် တင် —\n# ပျက်စီးစရာ မရှိ၊ ကြိမ်ပေါင်းများစွာ စမ်းလို့ရ",
  },
  "robo-swarm": {
    heading: "လက်တွေ့ — swarm စည်းမျဉ်း ၃ ချက်",
    body: "ရိုးရှင်းတဲ့ စည်းမျဉ်းသုံးခုကနေ အုပ်စုအပြုအမူ ပေါ်လာခြင်း (boids)။",
    code: "def swarm_step(me, neighbors):\n    # ၁။ Separation — အနီးလွန်းရင် ခွာ\n    away = flee_if_too_close(me, neighbors, r=0.5)\n    # ၂။ Alignment — အများ ဦးတည်ရာ လိုက်\n    align = average_heading(neighbors)\n    # ၃။ Cohesion — အုပ်စုအလယ်ဘက် ဆွဲ\n    center = towards_centroid(neighbors)\n    return away*1.5 + align*1.0 + center*0.8",
  },
  "robo-drone-flight": {
    heading: "လက်တွေ့ — quad motor mixing",
    body: "Throttle + roll/pitch/yaw ကို မော်တာလေးလုံး အမြန် ပေါင်းစပ်ခြင်း။",
    code: "def mix(throttle, roll, pitch, yaw):\n    m1 = throttle + roll + pitch - yaw   # ရှေ့ဘယ် ↻\n    m2 = throttle - roll + pitch + yaw   # ရှေ့ညာ ↺\n    m3 = throttle + roll - pitch + yaw   # နောက်ဘယ် ↺\n    m4 = throttle - roll - pitch - yaw   # နောက်ညာ ↻\n    return m1, m2, m3, m4\n# roll/pitch/yaw တစ်ခုစီက PID ရဲ့ output —\n# IMU ဖတ် → PID → mix → မော်တာ (တစ်စက္ကန့် ၄၀၀ကြိမ်+)",
  },
  "robo-gps-navigation": {
    heading: "လက်တွေ့ — GPS ဦးတည်ချက်တွက်",
    body: "လက်ရှိနေရာကနေ ပန်းတိုင် GPS မှတ်ဆီ ဦးတည်ထောင့် (bearing) တွက်။",
    code: "import math\n\ndef bearing(lat1, lon1, lat2, lon2):\n    dlon = math.radians(lon2 - lon1)\n    lat1, lat2 = math.radians(lat1), math.radians(lat2)\n    x = math.sin(dlon) * math.cos(lat2)\n    y = (math.cos(lat1)*math.sin(lat2)\n       - math.sin(lat1)*math.cos(lat2)*math.cos(dlon))\n    return math.degrees(math.atan2(x, y)) % 360\n\n# compass ဖတ်ချက်နဲ့ နှိုင်း → လွဲသလောက် ကွေ့",
  },
  "robo-teleoperation": {
    heading: "လက်တွေ့ — joystick ကနေ motor",
    body: "Joystick နှစ်လုံးတန်ဖိုးကို drive command ပြောင်းပြီး ပို့ခြင်း။",
    code: "while True:\n    x, y = joystick.read()        # -1.0 … 1.0\n    v     = y * MAX_SPEED         # ရှေ့/နောက်\n    omega = -x * MAX_TURN         # ဘယ်/ညာ\n    send_to_robot({\"v\": v, \"w\": omega})   # WiFi/radio\n    time.sleep(0.05)              # 20Hz\n\n# ⚠️ လင့်ခ်ပြတ်ရင် robot ဘက်မှာ 0.5s အတွင်း\n# command မရရင် auto-stop (failsafe) မဖြစ်မနေထည့်ပါ",
  },
  "robo-force-control": {
    heading: "လက်တွေ့ — အားဖတ်ပြီး ညင်သာစွာဆွဲ",
    body: "Force sensor ဖတ်ရင်း ကြိမ်လုံးလောက်ပဲ ဖိတဲ့ gripper logic။",
    code: "TARGET_FORCE = 2.0   # Newton — ခရမ်းချဉ်သီး မကြေစေ\n\nwhile gripper.closing():\n    f = force_sensor.read()\n    if f >= TARGET_FORCE:\n        gripper.hold()           # လုံလောက်ပြီ — ရပ်ထား\n        break\n    gripper.close_step(slow=True)\n\n# position control: \"ဒီထောင့်ထိ ပိတ်\" (မာတဲ့အရာ)\n# force control:    \"ဒီအားထိ ဖိ\"   (နူးညံ့တဲ့အရာ)",
  },
  "robo-battery-management": {
    heading: "လက်တွေ့ — battery % နဲ့ auto-return",
    body: "Voltage ကနေ ရာခိုင်နှုန်းခန့်မှန်းပြီး နည်းရင် အလိုအလျောက် ပြန်။",
    code: "def battery_percent(v, cells=3):\n    per_cell = v / cells               # LiPo ဆဲလ်တစ်လုံးချင်း\n    # 4.2V=100%, 3.5V=10% (linear ခန့်မှန်း)\n    return max(0, min(100, (per_cell - 3.5) / 0.7 * 100))\n\npct = battery_percent(read_voltage())\nif pct < 25:\n    robot.return_to_dock()   # အားနည်း — ပြန်အားသွင်း\nelif pct < 10:\n    robot.emergency_stop()   # LiPo ကာကွယ် — ချက်ချင်းရပ်",
  },
  "robo-agri-weeding": {
    heading: "လက်တွေ့ — ပေါင်းမြက် ရှာ-ရှင်း စက်ဝန်း",
    body: "Camera နဲ့ ပေါင်းခွဲခြား → တည်နေရာတွက် → tool ချ လုပ်ငန်းစဉ်။",
    code: "for frame in camera.stream():\n    plants = detect(frame)            # AI model\n    for p in plants:\n        if p.label == \"weed\" and p.conf > 0.85:\n            x, y = pixel_to_ground(p.box)   # ကင်မရာ→မြေ\n            robot.stop_over(x, y)\n            weeder.actuate()          # လက်/laser/ဆေးစက်\n        # သီးနှံပင် (crop) ဆိုရင် — မထိဘဲ ကျော်",
  },
  "robo-agri-harvest": {
    heading: "လက်တွေ့ — မှည့်ပြီလား စစ်ပြီး ဆွတ်",
    body: "အရောင်နဲ့ ရင့်မှည့်မှု စစ် → IK နဲ့ လက်တံရောက် → ညင်သာစွာ ဆွတ်။",
    code: "fruits = detect_fruits(camera.read())\nfor f in fruits:\n    ripeness = red_ratio(f.pixels)      # အနီအချိုး\n    if ripeness < 0.7:\n        continue                        # မမှည့်သေး — ထား\n    x, y, z = locate_3d(f, depth_cam)   # တည်နေရာ ၃ဘက်မြင်\n    angles = arm.ik(x, y, z)            # inverse kinematics\n    arm.move_to(angles)\n    gripper.grab(max_force=1.5)         # force control — မကြေစေ\n    arm.place_in_basket()",
  },
  "robo-self-balance": {
    heading: "လက်တွေ့ — balance loop",
    body: "IMU ထောင့်ဖတ် → PID → ယိမ်းရာဘက် ဘီးမောင်း — 200Hz စက်ဝန်း။",
    code: "target = 0.0                    # ထောင်မတ်မတ် = 0°\n\nwhile True:\n    angle = imu.pitch()         # complementary filter ပြီးသား\n    if abs(angle) > 35:\n        motors.off(); break     # လဲပြီ — မတင်းနဲ့တော့\n    u = pid(target, angle, dt=0.005)\n    motors.both(u)              # ယိမ်းရာဘက် မောင်း\n    time.sleep(0.005)           # 200Hz — နှေးရင် လဲမည်",
  },
  "robo-fabrication": {
    heading: "လက်တွေ့ — chassis ရွေးချယ်မှု",
    body: "ပစ္စည်းသုံးမျိုးရဲ့ အားသာ/အားနည်း နှိုင်းယှဉ်ဇယား code မှတ်စု။",
    code: "# Chassis ပစ္စည်း ရွေးနည်း\n# ─────────────────────────────────────────\n# ပျဉ်ပြား/acrylic  — စျေးသက်သာ၊ ဖြတ်လွယ်၊ ကျိုးလွယ်\n# 3D print (PLA)   — ပုံစံလွတ်လပ်၊ နာရီချီကြာ၊ အပူမခံ\n# aluminum        — ခိုင်မာ၊ လေး၊ တူးလ်လို\n# ─────────────────────────────────────────\n# အကြံ: prototype = ပျဉ်/print, အပြီး = aluminum\n# မြန်မာမှာ — ဝါး၊ သစ်သားလည်း chassis ကောင်းကောင်း ရ!",
  },
  "robo-open-source": {
    heading: "လက်တွေ့ — စတင်ရန် အခမဲ့ stack",
    body: "ပိုက်ဆံနည်းနည်းနဲ့ စလို့ရတဲ့ open-source လမ်းကြောင်း။",
    code: "# အခမဲ့/စျေးသက်သာ robotics stack\n# ────────────────────────────────\n# Board:     Arduino Uno clone (~15,000 Ks)\n# Firmware:  Arduino IDE (အခမဲ့)\n# Sim:       Webots / Gazebo (အခမဲ့)\n# Vision:    OpenCV (အခမဲ့)\n# Framework: ROS 2 (အခမဲ့)\n# ပုံစံ:      Thingiverse STL များ (အခမဲ့)\n# သင်ခန်းစာ:  gwave Robotics track — ဒီမှာပဲ 😊",
  },
  "robo-project-line-follower": {
    heading: "လက်တွေ့ — project code အပြည့်",
    body: "သင်ယူထားသမျှ ပေါင်းထားတဲ့ line follower — PID ပါ ဗားရှင်း။",
    code: "// sensor 5 လုံး array — မျဉ်းရဲ့ တည်နေရာ -2…+2\nfloat readLinePosition() {\n  int s[5]; float sum = 0, weighted = 0;\n  for (int i = 0; i < 5; i++) {\n    s[i] = analogRead(A0 + i) > 500;   // အနက် = 1\n    weighted += s[i] * (i - 2);\n    sum += s[i];\n  }\n  return sum > 0 ? weighted / sum : lastPos;\n}\n\nvoid loop() {\n  float pos = readLinePosition();       // Sense\n  float u = pid(0, pos, 0.01);          // Think — PID\n  drive(BASE - u, BASE + u);            // Act\n}",
  },
};

/** Merge diagrams and code sections into the robotics lessons. */
export function enrichRoboticsLessons(lessons: Lesson[]): Lesson[] {
  return enrichLessons(lessons, IMAGES, CODE);
}
