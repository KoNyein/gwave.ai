// Robotics course — third batch (30 → 60). Reading lessons with a YouTube hint
// and three Burmese sections each: motors & drives, kinematics, sensing,
// navigation/planning, ROS, and agricultural robots. Slugs are `robo-` prefixed
// to stay distinct within the track. Original content for GreenWave. Pure data.

import type { Lesson } from "@/lib/learn/lessons";

function rd(
  slug: string,
  title: string,
  summary: string,
  minutes: number,
  youtubeQuery: string,
  sections: [string, string][],
): Lesson {
  return {
    slug,
    title,
    summary,
    minutes,
    kind: "reading",
    youtubeQuery,
    sections: sections.map(([heading, body]) => ({ heading, body })),
  };
}

export const ROBOTICS_EXTRA2: Lesson[] = [
  rd("robo-servo-stepper", "Servo နဲ့ Stepper Motor", "တိကျတဲ့ လှုပ်ရှားမှုအတွက် motor များ။", 9, "servo vs stepper motor explained", [
    ["DC vs servo vs stepper", "ရိုးရိုး DC motor က လည်ရုံ (position မသိ)။ servo က သတ်မှတ်တဲ့ ထောင့် (angle) ကို သွား, stepper က 'အဆင့်' (step) လိုက် တိကျစွာ လှည့်။ robot arm, camera gimbal အတွက် servo/stepper။"],
    ["stepper", "stepper က ကွိုင်များ အလှည့်ကျ ဖွင့်၍ တစ်ဆင့်ချင်း (ဥပမာ 1.8°) လှည့်သည် — encoder မလိုဘဲ position သိ။ 3D printer, CNC, တိကျတဲ့ linear stage။"],
    ["servo", "hobby servo က angle signal (PWM) ပေးရုံ — အတွင်းက feedback နဲ့ ထောင့်ကို ထိန်း။ robot joint, gripper, valve control အတွက် လွယ်ကူ။"],
  ]),
  rd("robo-motor-drivers", "Motor Driver (H-Bridge)", "microcontroller နဲ့ motor ကို ဆက်ခြင်း။", 9, "H-bridge motor driver explained", [
    ["ဘာကြောင့် လို", "microcontroller pin က motor မောင်းဖို့ ပါဝါ မလုံလောက်။ motor driver (H-bridge) က pin ရဲ့ signal နဲ့ ပါဝါများတဲ့ motor ကို ထိန်းချုပ်ပေးသည်။"],
    ["H-bridge", "H-bridge က transistor ၄ ခုနဲ့ motor ရဲ့ လည်ပတ်ဦးတည်ချက် (ရှေ့/နောက်) ပြောင်းနိုင်စေသည်။ L298N, DRV8833, TB6612 လို module များ အသုံးများ။"],
    ["speed + direction", "PWM နဲ့ speed, direction pin နဲ့ ဦးတည်ချက် ထိန်း။ robot ရဲ့ ဘီးနှစ်ဖက်ကို သီးခြား ထိန်း၍ ရှေ့/နောက်/ကွေ့ လုပ်နိုင် — differential drive ရဲ့ အခြေခံ။"],
  ]),
  rd("robo-encoders", "Encoder — position ဖတ်ခြင်း", "ဘီး/joint ဘယ်လောက် လှည့်ပြီးလဲ သိခြင်း။", 8, "rotary encoder robot wheel explained", [
    ["encoder ဆိုတာ", "encoder က motor/ဘီး ဘယ်လောက် လှည့်ပြီးလဲ တိုင်းတာပြီး pulse ထုတ်သည်။ pulse ရေတွက်၍ လှည့်ပတ်မှု, အမြန်နှုန်း, ရွှေ့သွားခဲ့တဲ့ အကွာအဝေး တွက်နိုင်။"],
    ["odometry", "ဘီးနှစ်ဖက်ရဲ့ encoder ကနေ robot ရွှေ့သွားခဲ့တဲ့ အကွာအဝေး/ဦးတည်ချက်ကို တွက်ခြင်းက 'wheel odometry' — position ခန့်မှန်းရာမှာ အခြေခံ။"],
    ["closed loop", "encoder feedback နဲ့ PID ပေါင်း၍ 'ဒီ speed နဲ့ လည်ပါ' လို့ တိကျစွာ ထိန်းနိုင် (closed-loop control) — feedback မရှိ open-loop ထက် တိကျ။"],
  ]),
  rd("robo-imu", "IMU — Gyroscope + Accelerometer", "robot ရဲ့ ဟန်ချက်နဲ့ ဦးတည်ချက် သိခြင်း။", 8, "IMU gyroscope accelerometer robot explained", [
    ["IMU ဆိုတာ", "IMU က accelerometer (အရှိန်/ဆွဲအား) + gyroscope (လှည့်နှုန်း) + တစ်ခါတရံ magnetometer (အိမ်မြှောင်) ပေါင်း — robot ရဲ့ ဦးတည်ချက်, ဟန်ချက်, လှုပ်ရှားမှု သိစေ။"],
    ["sensor fusion", "sensor တစ်ခုတည်းက drift/noise ရှိလို့ accelerometer + gyro ကို ပေါင်း (complementary/Kalman filter) ၍ တည်ငြိမ်တဲ့ orientation ရသည်။"],
    ["အသုံးချ", "self-balancing robot, drone ရဲ့ ဟန်ချက်ထိန်း, robot ဘယ်ဘက်/ညာဘက် လှည့်နေလဲ သိ။ ဖုန်းရဲ့ screen လှည့်တာလည်း IMU။"],
  ]),
  rd("robo-differential-drive", "Differential Drive", "ဘီးနှစ်ဖက်နဲ့ ရွှေ့လျား/ကွေ့ခြင်း။", 8, "differential drive robot kinematics", [
    ["သဘော", "differential drive က ဘီးနှစ်ဖက်ကို သီးခြား ထိန်း၍ ရွေ့လျားသည် — နှစ်ဖက် တူညီ = ရှေ့တိုး, တစ်ဖက် မြန် = ကွေ့, ဆန့်ကျင် = နေရာမှာ လှည့်။ steering ဘီး မလို။"],
    ["ရိုးရှင်း", "ဘီးနှစ်ဖက် + caster (လွတ်လပ်လည်တဲ့ ဘီး) နဲ့ balance။ hobby robot, ဖုန်ပြုတ်စက် (Roomba) အများစုက ဒီ ဒီဇိုင်း — ဆောက်လွယ်, ထိန်းလွယ်။"],
    ["kinematics", "ဘီးနှစ်ဖက်ရဲ့ အမြန်နှုန်းကနေ robot ရဲ့ ရှေ့တိုးနှုန်း + လှည့်နှုန်း တွက်နိုင် — odometry, navigation ရဲ့ အခြေခံ သင်္ချာ။"],
  ]),
  rd("robo-holonomic", "Mecanum / Omni Wheels", "ဘေးတိုက် ရွှေ့နိုင်တဲ့ ဘီးများ။", 8, "mecanum omni wheel robot explained", [
    ["holonomic ဆိုတာ", "ရိုးရိုး ဘီးက ရှေ့/နောက်သာ ရွှေ့နိုင် (ဘေးတိုက် မရ)။ mecanum/omni wheel က roller များပါ၍ ဘေးတိုက်, ထောင့်ဖြတ်, နေရာမှာ လှည့် — ဘယ်ဦးတည်ချက်မဆို ချက်ချင်း ရွှေ့နိုင် (holonomic)။"],
    ["mecanum", "mecanum wheel ၄ ခုရဲ့ လှည့်ပုံ ပေါင်းစပ်၍ robot ကို ရှေ့/ဘေး/ထောင့်ဖြတ်/လှည့် ရွှေ့နိုင် — warehouse robot, ကျဉ်းတဲ့ နေရာ operation အတွက်။"],
    ["အားနည်း", "roller များကြောင့် ကြမ်းပြင်နဲ့ ကိုက်မှု (traction) နည်း, အနှောင့်အယှက် ခံရ, complex control။ ညီညာတဲ့ ကြမ်းပြင်မှာ အကောင်းဆုံး။"],
  ]),
  rd("robo-inverse-kinematics", "Inverse Kinematics", "လိုချင်တဲ့ နေရာအတွက် joint ထောင့် တွက်ခြင်း။", 10, "inverse kinematics robot arm explained", [
    ["forward vs inverse", "forward kinematics — joint ထောင့်များ ပေး → end-effector (လက်ဖျား) နေရာ တွက်။ inverse kinematics — လိုချင်တဲ့ နေရာ ပေး → လိုအပ်တဲ့ joint ထောင့်များ တွက် (ပိုခက်)။"],
    ["robot arm", "'ဒီ အသီးကို ကိုင်ချင်' ဆိုရင် arm ရဲ့ joint တစ်ခုစီ ဘယ်ထောင့် လိုမလဲ inverse kinematics နဲ့ တွက်ရသည်။ ဖြေရှင်းချက် များစွာ ရှိနိုင်, မရှိလည်း ဖြစ်နိုင်။"],
    ["အသုံးချ", "robot arm pick-and-place, 3D printer, CNC, ကာတွန်း/game character animation။ library (MoveIt, IKPy) များနဲ့ တွက်ချက်နိုင်။"],
  ]),
  rd("robo-pid-tuning", "PID Tuning (လက်တွေ့)", "control loop ကို ချောမွေ့အောင် ချိန်ညှိခြင်း။", 9, "PID tuning tutorial robotics", [
    ["P, I, D", "P (proportional) — အမှားနဲ့ အချိုးကျ တုံ့ပြန်၊ I (integral) — အမှား စုပုံလာရင် ပြင်၊ D (derivative) — အမှား ပြောင်းနှုန်းကို ကြည့်၍ ကျော်လွန်မှု လျှော့။ ပေါင်းစပ်၍ တည်ငြိမ်တဲ့ control။"],
    ["tuning", "P များ = မြန်ဒါပေမဲ့ တုန်ခါ (oscillate)၊ D များ = ချောမွေ့ဒါပေမဲ့ noise ဆိုး၊ I များ = drift ပြင်ဒါပေမဲ့ overshoot။ တစ်ခုချင်း ချိန်ရသည် (Ziegler–Nichols နည်း)။"],
    ["အသုံးချ", "motor speed ထိန်း, self-balancing, drone ဟန်ချက်, temperature control (grow room heater), pump flow — feedback control အားလုံးမှာ PID။"],
  ]),
  rd("robo-lidar", "LiDAR", "အလင်းနဲ့ ပတ်ဝန်းကျင် တိုင်းတာခြင်း။", 8, "LiDAR robot mapping explained", [
    ["LiDAR ဆိုတာ", "LiDAR က laser ပို့, ပြန်လာချိန်ကို တိုင်း၍ အကွာအဝေး တွက်သည် — လှည့်ပတ်ခြင်းဖြင့် ပတ်ဝန်းကျင် တစ်ခုလုံးရဲ့ '2D/3D point cloud' မြေပုံ ဆွဲပေး။"],
    ["mapping", "robot က LiDAR နဲ့ အခန်း/ကွင်း ပုံသဏ္ဌာန် ဖတ်၍ မြေပုံ ဆောက်, အတားအဆီး ရှောင်, နေရာ သိ — self-driving car, robot vacuum ရဲ့ အခြေခံ။"],
    ["ဈေးနှုန်း", "2D LiDAR က ယခု ဈေးသက်သာလာ (hobby robot သုံးနိုင်)၊ 3D LiDAR က ဈေးကြီးဆဲ။ camera + LiDAR ပေါင်း (sensor fusion) က ပိုခိုင်မာ။"],
  ]),
  rd("robo-slam", "SLAM", "မြေပုံဆွဲရင်း ကိုယ့်နေရာ သိခြင်း။", 10, "SLAM simultaneous localization mapping explained", [
    ["SLAM ဆိုတာ", "SLAM (Simultaneous Localization And Mapping) က robot က မသိတဲ့ နေရာမှာ မြေပုံ ဆွဲရင်း တစ်ပြိုင်နက် ကိုယ့်နေရာကို ခန့်မှန်းခြင်း — 'ဥ နဲ့ ကြက်' ပုစ္ဆာလို အပြန်အလှန်မှီခို။"],
    ["sensor", "LiDAR (LiDAR SLAM) သို့ camera (Visual SLAM) နဲ့ ပတ်ဝန်းကျင် feature များ ဖမ်း, encoder/IMU နဲ့ ပေါင်း၍ တည်ငြိမ်တဲ့ မြေပုံ + နေရာ ရ။"],
    ["အသုံးချ", "robot vacuum, self-driving car, warehouse robot, drone။ GPS မရတဲ့ အထဲ (indoor, greenhouse) မှာ navigation ရဲ့ အဓိက နည်းပညာ။"],
  ]),
  rd("robo-path-planning", "Path Planning", "အစမှ ပန်းတိုင် လမ်းကြောင်း ရှာခြင်း။", 9, "robot path planning explained", [
    ["ပြဿနာ", "မြေပုံ ရှိပြီးရင် robot က အစနေရာကနေ ပန်းတိုင်ဆီ အတားအဆီး ရှောင်, အတိုဆုံး/အလုံခြုံဆုံး လမ်းကြောင်း ရွေးရသည် — path planning။"],
    ["grid + graph", "မြေပုံကို grid/graph အဖြစ် ပြောင်း၍ node များကြား လမ်းကြောင်း ရှာသည်။ Dijkstra, A* (heuristic သုံး, ပိုမြန်) က အသုံးများ။"],
    ["global vs local", "global planner က မြေပုံ တစ်ခုလုံးအတွက် လမ်းကြောင်း, local planner က ချက်ချင်း ပေါ်လာတဲ့ အတားအဆီး (လူ, အိုး) ကို real-time ရှောင်။ နှစ်ခု ပေါင်းသုံး။"],
  ]),
  rd("robo-a-star", "A* Algorithm", "အမြန်ဆုံး လမ်းရှာ algorithm။", 9, "A star pathfinding algorithm explained", [
    ["A* ဆိုတာ", "A* (A-star) က node များကြား အတိုဆုံး လမ်း ရှာ algorithm — 'ယခုအထိ ကုန်ကျစရိတ် (g)' + 'ပန်းတိုင်ဆီ ခန့်မှန်း (h, heuristic)' ပေါင်း၍ အလားအလာ အကောင်းဆုံး node ကို ဦးစားပေး ရှာ။"],
    ["heuristic", "h က ပန်းတိုင်ဆီ 'အနီးစပ်ဆုံး ခန့်မှန်း' (ဥပမာ ဖြောင့်တန်း အကွာအဝေး)။ ကောင်းတဲ့ heuristic က Dijkstra ထက် အများကြီး မြန်စေ။"],
    ["အသုံးချ", "robot navigation, ဂိမ်း NPC လမ်းရှာ, GPS route, network routing။ grid-based robot navigation ရဲ့ အခြေခံ။ ဒီ concept ကို code နဲ့ ရေးကြည့်ပါ။"],
  ]),
  rd("robo-obstacle-sensors", "Obstacle Sensing", "အတားအဆီး ရှာဖွေတဲ့ sensor များ။", 8, "obstacle detection sensors robot", [
    ["sensor အမျိုးအစား", "ultrasonic (အသံ, ဈေးသက်သာ), IR (အနီး), LiDAR (တိကျ, ဈေးကြီး), camera (ရှုပ်ထွေး, ဉာဏ်ရည်လို)။ robot ရဲ့ လိုအပ်ချက်/budget အလိုက် ရွေး။"],
    ["bumper + cliff", "ရိုးရှင်းတဲ့ robot မှာ bumper switch (ထိမှ သိ) + cliff sensor (အောက်ဆင်း/လှေကား ရှောင်) ပေါင်းသုံး — vacuum robot ရဲ့ အခြေခံ။"],
    ["fusion", "sensor တစ်ခုတည်း မလုံလောက် — ultrasonic က ကြေးမုံ လွဲ, IR က နေရောင်မှာ လွဲ။ များစွာ ပေါင်း (fusion) ၍ ယုံကြည်စိတ်ချရ။"],
  ]),
  rd("robo-vision-tracking", "Object Tracking", "camera နဲ့ အရာဝတ္ထု လိုက်ကြည့်ခြင်း။", 9, "computer vision object tracking robot", [
    ["detection vs tracking", "detection — frame တစ်ခုစီမှာ object ရှာ။ tracking — frame များ ဆက်တိုက်မှာ object တစ်ခုတည်းကို လိုက်ကြည့် (ဘယ်သွားလဲ)။ robot က target လိုက်ရာမှာ။"],
    ["color/feature", "ရိုးရှင်းတဲ့ tracking — အရောင် (color blob), ပုံသဏ္ဌာန်။ အဆင့်မြင့် — feature/deep learning (YOLO + tracker)။ camera + processing power အလိုက်။"],
    ["အသုံးချ", "robot က လူ/အသီး/အရောင်တံဆိပ် လိုက်, camera gimbal က target ကို frame ထဲ ထား, drone follow-me — vision-guided robot ရဲ့ အခြေခံ။"],
  ]),
  rd("robo-depth-camera", "Depth Camera", "အကွာအဝေးပါ မြင်တဲ့ camera။", 8, "depth camera stereo RGBD robot", [
    ["depth ဆိုတာ", "ရိုးရိုး camera က 2D ပုံသာ ရ (အနက် မသိ)။ depth camera က pixel တစ်ခုစီရဲ့ အကွာအဝေးပါ ပေး — 3D ပုံ (point cloud) ရ။ object grab, obstacle, mapping အတွက်။"],
    ["နည်းလမ်း", "stereo (မျက်လုံးနှစ်လုံးလို camera ၂ ခု), structured light (pattern ပစ်), ToF (Time-of-Flight, အလင်း ပြန်လာချိန်)။ Kinect, RealSense လို device များ။"],
    ["အသုံးချ", "robot arm က object ရဲ့ 3D နေရာ တွက်၍ ကိုင်, robot က ပတ်ဝန်းကျင် 3D map ဆွဲ, အသီး အရွယ်/အကွာ တိုင်း — agri robot picking အတွက်။"],
  ]),
  rd("robo-ros", "ROS — Robot Operating System", "robot software ဆောက်တဲ့ framework။", 9, "ROS robot operating system explained", [
    ["ROS ဆိုတာ", "ROS က robot software ရေးဖို့ framework/tool အစု — sensor, motor, algorithm များကို 'node' အဖြစ်ခွဲ, 'topic' နဲ့ message ဖလှယ်စေ။ robot software ရဲ့ 'operating system'။"],
    ["node + topic", "node တစ်ခုစီက အလုပ်တစ်ခု (camera ဖတ်, motor ထိန်း)၊ topic နဲ့ message ပို့/ဖတ် (publish/subscribe)။ module ခွဲ၍ ပြန်သုံးရ, ချိတ်ဆက်ရ လွယ်။"],
    ["ecosystem", "SLAM, navigation, MoveIt (arm), Gazebo (simulation), RViz (visualize) — အသင့်သုံး package ထောင်ချီ။ robot research/industry ရဲ့ စံ။ ROS 2 က ခေတ်မီ version။"],
  ]),
  rd("robo-simulation", "Simulation (Gazebo)", "robot ကို virtual မှာ စမ်းသပ်ခြင်း။", 8, "gazebo robot simulation tutorial", [
    ["ဘာကြောင့် simulate", "robot အစစ်က ဈေးကြီး, ပျက်လွယ်, စမ်းရ နှေး။ simulation က physics ပါတဲ့ virtual world မှာ robot ကို လွတ်လွတ်လပ်လပ် စမ်းသပ်, code test, အန္တရာယ်ကင်း။"],
    ["Gazebo", "Gazebo က ROS နဲ့ တွဲသုံးတဲ့ 3D physics simulator — sensor (LiDAR, camera), motor, ဆွဲအား, ပွတ်တိုက်အား အားလုံး တုပ။ code ကို sim မှာ စမ်း၍ real robot ဆီ ကူး။"],
    ["sim-to-real", "sim မှာ ကောင်းတာ real မှာ မတူနိုင် ('reality gap')။ AI robot များကို sim မှာ သန်းချီ လေ့ကျင့်ပြီး real ဆီ transfer — domain randomization နဲ့ gap လျှော့။"],
  ]),
  rd("robo-swarm", "Swarm Robotics", "robot များစွာ ပူးပေါင်း အလုပ်လုပ်ခြင်း။", 8, "swarm robotics explained", [
    ["swarm ဆိုတာ", "swarm robotics က ရိုးရှင်းတဲ့ robot များစွာ (ပျားအုပ်/ပုရွက်ဆိတ်လို) ဒေသတွင်း စည်းမျဉ်း ရိုးရိုးလေးများနဲ့ ပူးပေါင်း၍ ရှုပ်ထွေးတဲ့ အလုပ်ကို ပြီးမြောက်စေခြင်း။"],
    ["emergent behavior", "robot တစ်ခုချင်း ရိုးရှင်းပေမဲ့ အုပ်စုအနေနဲ့ ဖွဲ့စည်းမှု (formation), ရှာဖွေမှု, coverage လို 'emergent' အပြုအမူ ပေါ်ထွက် — central control မလို။"],
    ["agri", "field အနှံ့ drone/robot အုပ်စု နဲ့ စောင့်ကြည့်, ရေဖျန်း, ရိတ်သိမ်း — တစ်ခုပျက်လည်း ကျန်တာ ဆက်လုပ် (robust)။ အနာဂတ် စိုက်ပျိုးရေးရဲ့ ဖြစ်နိုင်ခြေ။"],
  ]),
  rd("robo-drone-flight", "Drone Flight Control", "quadcopter ဘယ်လို ပျံသန်းလဲ။", 9, "how drones fly quadcopter explained", [
    ["quadcopter", "quadcopter က rotor ၄ ခုရဲ့ အရှိန်ကို သီးခြား ထိန်း၍ ပျံ — အားလုံး တူ = အတက်/အဆင်း, ရှေ့/နောက် ကွာ = ရွှေ့, ဆန့်ကျင် တွဲ = လှည့် (yaw)။"],
    ["flight controller", "IMU + barometer + GPS ကနေ ဟန်ချက်/အမြင့်/နေရာ သိ, PID နဲ့ rotor အရှိန် ချိန်ညှိ၍ တည်ငြိမ်စွာ ပျံ — လူ့လက်နဲ့ ချက်ချင်း မထိန်းနိုင်တဲ့ အလုပ်ကို ကွန်ပျူတာ လုပ်။"],
    ["agri drone", "ရေ/ဆေး ဖျန်း, field survey (multispectral camera နဲ့ အပင် ကျန်းမာရေး), မြေပုံဆွဲ, အသီးအနှံ ရေတွက် — မြန်မာ့ စိုက်ခင်းများအတွက် အလားအလာ ကောင်း။"],
  ]),
  rd("robo-gps-navigation", "GPS Navigation", "ကွင်းပြင်မှာ လမ်းကြောင်းအတိုင်း သွားခြင်း။", 8, "GPS robot navigation waypoint", [
    ["GPS ဆိုတာ", "GPS က ဂြိုဟ်တုများကနေ robot ရဲ့ ကမ္ဘာပေါ်က နေရာ (latitude/longitude) ကို ~မီတာ အတိအကျ ပေး — အပြင် (outdoor) ကွင်းပြင် navigation အတွက်။"],
    ["waypoint", "waypoint (သွားရမယ့် နေရာ) များ သတ်မှတ်၍ robot က တစ်ခုပြီးတစ်ခု အလိုအလျောက် သွား — field robot, agri drone, mower ရဲ့ အခြေခံ။ IMU/encoder နဲ့ ပေါင်း။"],
    ["RTK", "ရိုးရိုး GPS က ~မီတာ လွဲ။ RTK-GPS က ~စင်တီမီတာ တိကျ — အတန်းလိုက် တိတိကျကျ စိုက်, ရိတ်ရာမှာ လိုအပ်တဲ့ တိကျမှု။"],
  ]),
  rd("robo-teleoperation", "Teleoperation", "robot ကို အဝေးက ထိန်းချုပ်ခြင်း။", 7, "robot teleoperation remote control", [
    ["teleop ဆိုတာ", "teleoperation က လူက robot ကို အဝေးက (joystick, ဖုန်း, VR) ထိန်းချုပ်ခြင်း — အန္တရာယ်ရှိ/ရောက်ရခက်တဲ့ နေရာ (မိုင်း, ရေအောက်, အာကာသ, ဘေးအန္တရာယ်) အတွက်။"],
    ["latency", "signal သွား/ပြန် ကြာချိန် (latency) များရင် ထိန်းရ ခက်။ video feed + control ကို မြန်မြန် ပို့ဖို့ လိုအပ်။ semi-autonomous (robot က အသေးစိတ် ကိုယ်တိုင်လုပ်) နဲ့ ပေါင်း။"],
    ["အသုံးချ", "surgical robot, bomb disposal, warehouse, agri (field မှာ ဝေးဝေးက monitor + ချက်ချင်း ဝင်ထိန်း)။ full autonomy မရသေးတဲ့ အလုပ်များအတွက် လက်တွေ့ဆန်။"],
  ]),
  rd("robo-force-control", "Force / Torque Control", "ဖိအား ခံစား၍ ညင်သာစွာ ကိုင်ခြင်း။", 8, "robot force torque control compliance", [
    ["ပြဿনা", "position control တင်ဆို robot က object ကို ဖိချေ/ကျိုးစေနိုင် (အသီး ကြေ)။ force control က ဖိအားကို ခံစား၍ 'ညင်သာစွာ' ကိုင်, ဖိအား ကန့်သတ်။"],
    ["force sensor", "joint/gripper မှာ force-torque sensor တပ်၍ ဘယ်လောက် ဖိမိလဲ ဖတ်, feedback နဲ့ ချိန်။ compliant (ပျော့ပျောင်း) control က object/လူနဲ့ ထိတွေ့ရာမှာ လုံခြုံ။"],
    ["agri", "အသီးအနှံ ရိတ်/ကောက်ရာမှာ ကြေမပျက်အောင် ညင်သာစွာ ကိုင်, ပင်စည် ဖြတ်ရာမှာ သင့်တော်တဲ့ အား — soft robotics နဲ့ တွဲ၍ ပျော့တဲ့ အသီးများ ကိုင်တွယ်။"],
  ]),
  rd("robo-battery-management", "Battery Management", "robot ရဲ့ ပါဝါ စီမံခန့်ခွဲခြင်း။", 8, "robot battery management BMS explained", [
    ["battery ရွေး", "robot အတွက် Li-ion/LiPo (ပေါ့, စွမ်းအင်များ) သို့ LiFePO4 (လုံခြုံ, ကြာခံ)။ voltage, capacity (mAh), discharge rate (C) ကို motor လိုအပ်ချက်နဲ့ ကိုက်ညီအောင် ရွေး။"],
    ["BMS", "Battery Management System က cell များကို အလွန်အားသွင်း/ကုန်ခြင်း, အပူလွန်ခြင်းမှ ကာကွယ်, balance ချိန် — LiPo မီးလောင်/ဖောင်းမှု ရှောင်ရာမှာ မရှိမဖြစ်။"],
    ["runtime", "ပါဝါ budget (motor, sensor, compute) တွက်၍ runtime ခန့်မှန်း, low-battery မှာ ဘေးကင်းရာ ပြန်လာ (return-to-home) automation ထည့်ပါ။"],
  ]),
  rd("robo-agri-weeding", "Weeding Robot", "ပေါင်းမြက် ရှင်းတဲ့ robot။", 8, "agricultural weeding robot explained", [
    ["ပြဿনာ", "ပေါင်းမြက် ရှင်းခြင်းက အလုပ်ကြမ်း, အချိန်ကုန်, ဓာတုဆေး (herbicide) သုံးရ။ weeding robot က ပေါင်းမြက်ကို ရွေးခြယ် ရှင်းလင်း၍ ဆေး လျှော့/မသုံး။"],
    ["vision", "camera + AI နဲ့ 'အပင်' vs 'ပေါင်းမြက်' ခွဲခြား, ပေါင်းမြက်ကိုသာ ပစ်မှတ်ထား၍ စက်ပိုင်း (ဆွဲ/ဖြတ်/laser) သို့ တိကျတဲ့ ဆေးဖျန်း (spot spray)။"],
    ["အကျိုး", "ဓာတုဆေး ~၉၀% လျှော့, အလုပ်သမား ရှားပါးမှု ဖြေရှင်း, organic စိုက်ပျိုးရေး ထောက်ပံ့။ AI + robotics + agri ပေါင်းစပ်မှုရဲ့ လက်တွေ့ ဥပမာ။"],
  ]),
  rd("robo-agri-harvest", "Harvesting Robot", "အသီးအနှံ ရိတ်သိမ်းတဲ့ robot။", 8, "fruit harvesting robot explained", [
    ["အခက်အခဲ", "အသီး ရိတ်သိမ်းက ခက်ခဲ — အသီး ရင့်/မရင့် ခွဲ, အရွက်ကြားက ရှာ, ကြေမပျက်အောင် ညင်သာ ကိုင်, အပင် မထိခိုက်။ လူ့လက်ကို အစားထိုးရ ခက်။"],
    ["နည်းပညာ", "depth camera + AI နဲ့ အသီး ရှာ/ရင့်မှု ခွဲ, inverse kinematics နဲ့ arm ရောက်အောင်, soft gripper + force control နဲ့ ညင်သာ ကိုင်၊ ဖြတ်။"],
    ["အခြေအနေ", "စတော်ဘယ်ရီ, ခရမ်းချဉ်, ပန်းသီး လို အသီးများအတွက် commercial robot ပေါ်လာပြီ။ ဈေးနှုန်း, အရှိန်, ယုံကြည်စိတ်ချရမှု တိုးတက်နေဆဲ — အနာဂတ် အလားအလာ ကြီး။"],
  ]),
  rd("robo-self-balance", "Self-Balancing Robot", "inverted pendulum ဟန်ချက်ထိန်းခြင်း။", 8, "self balancing robot explained PID", [
    ["ပြဿნা", "ဘီးနှစ်ဖက် robot (Segway လို) က သဘာဝအရ လဲ (inverted pendulum)။ IMU နဲ့ စောင်း ဖတ်, ဘီးကို လဲမယ့်ဘက် ရွှေ့၍ ဟန်ချက် ထိန်း — စက္ကန့်ပိုင်း တိုင်း ပြင်။"],
    ["control", "PID (သို့ ပိုအဆင့်မြင့် LQR) နဲ့ 'စောင်းမှု' ကို '0' ဖြစ်အောင် ဘီး motor ကို ချိန်။ tuning မှန်မှ တည်ငြိမ် — robotics ရဲ့ ဂန္ထဝင် control ပုစ္ဆာ။"],
    ["သင်ခန်းစာ", "IMU (sensing) + motor driver + PID (control) ပေါင်းစပ်မှုကို သင်ယူရာမှာ အကောင်းဆုံး project — sensor fusion, feedback control အားလုံး ပါ။"],
  ]),
  rd("robo-safety-standards", "Robot Safety", "လူနဲ့ အတူ လုံခြုံစွာ အလုပ်လုပ်ခြင်း။", 8, "robot safety collaborative cobot", [
    ["အန္တရာယ်", "robot က အားကြီး, မြန်လို့ လူကို ထိခိုက်နိုင်။ industrial robot များကို လုံခြုံ ဘောင် (cage), emergency stop, area scanner နဲ့ ခြားထားရသည်။"],
    ["cobot", "collaborative robot (cobot) က လူနဲ့ အတူ လုံခြုံစွာ လုပ်ရန် ဒီဇိုင်း — force limit, ထိမိရင် ရပ်, ညင်သာ။ sensor နဲ့ လူ ရှိ/မရှိ သိ။"],
    ["ကျင့်ဝတ်", "safety standard (ISO 10218, ISO 13849), risk assessment, fail-safe (ပါဝါ ပြတ်ရင် ဘေးကင်း ရပ်)။ agri/home robot မှာ လူ, ကလေး, တိရစ္ဆာန် ဘေးကင်းရေး ဦးစားပေး။"],
  ]),
  rd("robo-fabrication", "Robot Fabrication", "chassis နဲ့ အစိတ်အပိုင်း ထုတ်လုပ်ခြင်း။", 7, "3d printing robot chassis fabrication", [
    ["ပစ္စည်း ရွေး", "robot ကိုယ်ထည်အတွက် plywood/acrylic (laser cut), aluminium (ခိုင်), 3D printed plastic (ရှုပ်ထွေးတဲ့ ပုံသဏ္ဌာန်)။ အလေးချိန်, ခိုင်ခံ့မှု, ဈေးနှုန်း ချိန်ဆ။"],
    ["3D printing", "3D printer နဲ့ gripper, mount, gear, ကိုယ်ပိုင် အစိတ်အပိုင်း ထုတ်နိုင် — CAD (Fusion 360, FreeCAD) နဲ့ ဒီဇိုင်း, print, စမ်း, ပြင်။ prototype အတွက် အလွန်အသုံးဝင်။"],
    ["assembly", "screw, standoff, bracket နဲ့ တပ်ဆင်၊ wire ကို သပ်ရပ်စွာ စီ (cable management)၊ ဗဟိုချက် (center of mass) နိမ့်အောင် battery ကို အောက်ထား — ဟန်ချက်, ခိုင်ခံ့မှုအတွက်။"],
  ]),
  rd("robo-open-source", "Open-Source Robotics", "အခမဲ့ platform များနဲ့ စတင်ခြင်း။", 7, "open source robotics platforms", [
    ["ဘာကြောင့်", "open-source hardware/software က ဒီဇိုင်း, code ကို အခမဲ့ ရ, ပြင်ဆင်, community အကူအညီ ရ — အစကနေ ဆောက်စရာမလိုဘဲ လေ့လာ, တည်ဆောက်လွယ်။"],
    ["platform များ", "hardware — Arduino, ESP32, Raspberry Pi; software — ROS, OpenCV; robot — TurtleBot, Poppy, farm-ng (agri)。 kit များ, tutorial များ ကြွယ်ဝ။"],
    ["community", "GitHub, forum, Hackster, Instructables မှာ project ထောင်ချီ မျှဝေ။ ကိုယ့် project ကို ပြန်မျှဝေခြင်းက အခြားသူများ (မြန်မာ့ robotics community) ကို အထောက်အကူ — gwave community နဲ့ ချိတ်ဆက်နိုင်။"],
  ]),
  rd("robo-project-line-follower", "Project — Line Follower", "သင်ယူထားသမျှ ပေါင်း၍ robot ဆောက်ခြင်း။", 11, "line follower robot project PID", [
    ["ဒီဇိုင်း", "chassis + ဘီး ၂ ဖက် (differential drive) + motor driver (H-bridge) + IR sensor အခင်း (မြေပြင်က မဲ/ဖြူ ဖတ်) + microcontroller ပေါင်း၍ မျဉ်းကြောင်း လိုက်တဲ့ robot။"],
    ["control", "IR sensor ကနေ robot က မျဉ်းရဲ့ ဘယ်/ညာ ဘယ်လောက် သွေဖည်လဲ တွက်, PID နဲ့ ဘီးနှစ်ဖက် အရှိန် ချိန်၍ မျဉ်းပေါ် ပြန်လာအောင် ထိန်း — feedback control လက်တွေ့။"],
    ["တိုးချဲ့", "encoder နဲ့ speed ထိန်း, ultrasonic နဲ့ အတားအဆီး ရှောင်, junction ရှာ, အမြန်နှုန်း optimize။ ဒီ project က motor, sensor, control, code အားလုံးကို ချိတ်ဆက်ပေးသည် — robotics သင်ခန်းစာ အားလုံးရဲ့ အနှစ်ချုပ်။"],
  ]),
];
