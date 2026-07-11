// Teaching aids for the Electronics & IoT track: original SVG diagrams
// (in /public/learn/electronics) and hands-on Arduino/ESP32 code samples,
// merged at track-assembly time. Pure data.

import type { Lesson } from "@/lib/learn/lessons";
import {
  enrichLessons,
  type CodeExtra,
  type LessonImage,
} from "@/lib/learn/media-enrich";

const IMG = "/learn/electronics";

const IMAGES: Record<string, LessonImage> = {
  "voltage-current-resistance": {
    src: `${IMG}/ohms-law.svg`,
    alt: "Ohm's law triangle and example circuit",
    caption: "V = I × R — သုံးလုံးထဲက နှစ်လုံးသိရင် ကျန်တစ်လုံး တွက်လို့ရ",
  },
  "elec-ohms-law": {
    src: `${IMG}/ohms-law.svg`,
    alt: "Ohm's law triangle",
    caption: "Ohm's law တြိဂံ — ဖုံးထားတဲ့ အက္ခရာကို ရှာနည်း",
  },
  "series-parallel": {
    src: `${IMG}/series-parallel.svg`,
    alt: "Series and parallel circuits",
    caption: "တန်းဆက် — လမ်းတစ်ခု · ပြိုင်ဆက် — လမ်းများစွာ",
  },
  "circuit-components": {
    src: `${IMG}/components.svg`,
    alt: "Common circuit components and their symbols",
    caption: "Resistor · LED · capacitor · switch · battery · diode",
  },
  resistors: {
    src: `${IMG}/resistor.svg`,
    alt: "Resistor colour bands limiting current to an LED",
    caption: "Resistor က လျှပ်စီး ကန့်သတ်ပေး — LED မကျွမ်းအောင်",
  },
  "leds-diodes": {
    src: `${IMG}/led-circuit.svg`,
    alt: "LED circuit with resistor calculation",
    caption: "LED circuit နဲ့ resistor တန်ဖိုး တွက်နည်း",
  },
  breadboards: {
    src: `${IMG}/breadboard.svg`,
    alt: "How breadboard rows connect",
    caption: "Breadboard အတွင်း ဘယ်အပေါက်တွေ ဆက်နေလဲ",
  },
  "switches-buttons": {
    src: `${IMG}/switch.svg`,
    alt: "Open vs closed switch controlling an LED",
    caption: "ဆက် = current စီး မီးလင်း · ဖြတ် = ပြတ် မီးမလင်း",
  },
  "gpio-inputs-outputs": {
    src: `${IMG}/gpio.svg`,
    alt: "GPIO input and output pins",
    caption: "Input pin = ဖတ် · Output pin = ထိန်း",
  },
  "elec-pull-up-down": {
    src: `${IMG}/pullup.svg`,
    alt: "Pull-up resistor circuit",
    caption: "Pull-up မပါရင် pin 'လွင့်' — မခန့်မှန်းနိုင်တဲ့ တန်ဖိုးထွက်",
  },
  "elec-voltage-divider": {
    src: `${IMG}/voltage-divider.svg`,
    alt: "Voltage divider circuit",
    caption: "R နှစ်လုံးနဲ့ voltage လျှော့ — sensor interface အခြေခံ",
  },
  "elec-transistors": {
    src: `${IMG}/transistor-switch.svg`,
    alt: "Transistor as a switch",
    caption: "GPIO အားနည်းနဲ့ 12V load အားကြီးကို ခလုတ်လုပ်ခြင်း",
  },
  "relays-switching": {
    src: `${IMG}/relay.svg`,
    alt: "Relay lets a small signal switch a big load",
    caption: "signal သေး → 220V load ကြီး ဖွင့်/ပိတ်",
  },
  "elec-pwm": {
    src: `${IMG}/pwm-duty.svg`,
    alt: "PWM duty cycle waveforms",
    caption: "ON ချိန်အချိုး ကွာရင် ပျမ်းမျှပါဝါ ကွာ — မှိန်/လင်း",
  },
  "motors-servos": {
    src: `${IMG}/motor-servo.svg`,
    alt: "DC motor spins, servo holds an angle",
    caption: "DC motor = အမြဲလည် · servo = တိကျ ထောင့်",
  },
  "elec-i2c": {
    src: `${IMG}/buses.svg`,
    alt: "UART I2C SPI bus comparison",
    caption: "ကြိုး ၂ ချောင်းတည်းနဲ့ device များစွာ — address နဲ့ခွဲ",
  },
  "elec-spi": {
    src: `${IMG}/buses.svg`,
    alt: "SPI bus wiring",
    caption: "SPI — ကြိုးများပေမယ့် အမြန်ဆုံး bus",
  },
  "elec-uart-serial": {
    src: `${IMG}/buses.svg`,
    alt: "UART TX RX wiring",
    caption: "UART — TX↔RX ကြိုးနှစ်ချောင်း တစ်ယောက်ချင်း စကားပြော",
  },
  "iot-architecture": {
    src: `${IMG}/iot-stack.svg`,
    alt: "IoT architecture layers",
    caption: "Sensor → MCU → MQTT → Cloud → App — အလွှာလိုက် စီးဆင်းပုံ",
  },
  "mqtt-messaging": {
    src: `${IMG}/mqtt.svg`,
    alt: "MQTT publish/subscribe through a broker",
    caption: "topic ကို publish → subscribe သူတိုင်း ရ",
  },
  "sending-data-to-the-cloud": {
    src: `${IMG}/cloud-data.svg`,
    alt: "Sensor to board to Wi-Fi to cloud to phone",
    caption: "Sensor → board → Wi-Fi → cloud → ဖုန်း chart",
  },
  "what-is-a-sensor": {
    src: `${IMG}/sensor-basics.svg`,
    alt: "A sensor turns the physical world into numbers",
    caption: "ရုပ်ပိုင်းလောက → signal → ဂဏန်း — sensor",
  },
  "build-a-circuit": {
    src: `${IMG}/circuit-loop.svg`,
    alt: "Battery, wire, switch and LED in a closed loop",
    caption: "loop ပြည့်မှ current စီး → မီးလင်း",
  },
  "electricity-flow": {
    src: `${IMG}/electron-flow.svg`,
    alt: "Electrons flowing from minus to plus in a wire",
    caption: "(−) → (+) အီလက်ထရွန် တွန်းစီး = current",
  },
  "conductors-insulators": {
    src: `${IMG}/conductor-insulator.svg`,
    alt: "Conductors let current through, insulators block it",
    caption: "ကြေး/သံ = စီး · ရော်ဘာ/ပလတ်စတစ် = မစီး",
  },
  "battery-power": {
    src: `${IMG}/battery.svg`,
    alt: "A battery provides the voltage that pushes current",
    caption: "Battery = တွန်းအား (V) ရဲ့ အရင်း — ဓာတု→လျှပ်စစ်",
  },
  capacitors: {
    src: `${IMG}/capacitor.svg`,
    alt: "A capacitor stores a little charge and smooths power",
    caption: "အားနည်းငယ် သိမ်း → ပါဝါ ချောမွေ့စေ",
  },
  "reading-schematics": {
    src: `${IMG}/schematic.svg`,
    alt: "Circuit schematic symbols and connections",
    caption: "စံ symbol တွေ = circuit ရဲ့ မြေပုံ",
  },
  microcontrollers: {
    src: `${IMG}/microcontroller.svg`,
    alt: "A microcontroller reads inputs and drives outputs",
    caption: "input ဖတ် → code တွက် → output ထိန်း — circuit ဦးနှောက်",
  },
  "digital-analog-signals": {
    src: `${IMG}/digital-analog.svg`,
    alt: "Smooth analog wave vs digital on/off steps",
    caption: "Analog = ချောမွေ့ · Digital = 0/1 နှစ်ဆင့်",
  },
  "temperature-sensors": {
    src: `${IMG}/temp-sensor.svg`,
    alt: "A temperature sensor turns warmth into a number",
    caption: "အပူ → DHT22/LM35 → 28.5°C",
  },
  "light-sensors": {
    src: `${IMG}/light-sensor.svg`,
    alt: "An LDR changes resistance with brightness",
    caption: "LDR — အလင်းများ R နည်း · မှောင် R များ",
  },
  "moisture-sensors": {
    src: `${IMG}/moisture-sensor.svg`,
    alt: "Two probes read how wet the soil is",
    caption: "probe ၂ ချောင်း — မြေစို/ခြောက် တိကျ",
  },
  "power-safety": {
    src: `${IMG}/power-safety.svg`,
    alt: "Working with electricity safely",
    caption: "မှန်တဲ့ voltage · ground · fuse — 220V သတိ",
  },
  "wifi-networks": {
    src: `${IMG}/wifi.svg`,
    alt: "A device joins a router to reach the internet",
    caption: "Device → router (SSID) → internet → cloud",
  },
  "automation-logic": {
    src: `${IMG}/automation.svg`,
    alt: "If this reading, then that action",
    caption: "IF စိုထိုင်း>70% THEN fan ဖွင့် — လူမလို",
  },
  "soldering-troubleshooting": {
    src: `${IMG}/soldering.svg`,
    alt: "A good shiny solder joint vs a cold joint",
    caption: "တောက်ပ joint = ကောင်း · multimeter နဲ့ fault ရှာ",
  },
  "elec-inductors": {
    src: `${IMG}/inductor.svg`,
    alt: "An inductor coil stores a magnetic field",
    caption: "current → သံလိုက်စက်ကွင်း သိမ်း — capacitor ရဲ့ ဆန့်ကျင်ဘက်",
  },
  "elec-diodes-types": {
    src: `${IMG}/diode-types.svg`,
    alt: "Forward vs reverse diode, LED, Zener, rectifier",
    caption: "current တစ်လမ်းသွား — LED · Zener · rectifier",
  },
  "elec-adc-dac": {
    src: `${IMG}/adc-dac.svg`,
    alt: "ADC turns analog to digital, DAC the reverse",
    caption: "ADC — analog→digital ဖတ် · DAC — digital→analog ထုတ်",
  },
  "elec-multimeter": {
    src: `${IMG}/multimeter.svg`,
    alt: "A multimeter measuring voltage, current, resistance",
    caption: "V · A · Ω · continuity — fault ရှာ ကိရိယာ",
  },
  "elec-logic-gates": {
    src: `${IMG}/logic-gates.svg`,
    alt: "AND, OR and NOT logic gates",
    caption: "AND · OR · NOT — digital ဆုံးဖြတ်ချက် အခြေခံ",
  },
  "elec-arduino": {
    src: `${IMG}/arduino.svg`,
    alt: "An Arduino board with pins and USB",
    caption: "USB နဲ့ program · beginner board အကောင်းဆုံး",
  },
  "elec-esp32": {
    src: `${IMG}/esp32.svg`,
    alt: "ESP32 board with built-in Wi-Fi",
    caption: "Wi-Fi + Bluetooth ပါ · IoT field node အတွက်",
  },
  "elec-raspberry-pi": {
    src: `${IMG}/raspberry-pi.svg`,
    alt: "A Raspberry Pi single-board computer",
    caption: "Linux run · CCTV/AI/server — MCU ထက် အားကြီး",
  },
  "elec-ph-sensor": {
    src: `${IMG}/ph-sensor.svg`,
    alt: "pH probe reading on a 0-14 scale",
    caption: "0 အက်ဆစ် ↔ 14 အယ်ကာလိ — အပင် 5.5–6.5",
  },
  "elec-ec-sensor": {
    src: `${IMG}/ec-sensor.svg`,
    alt: "EC/TDS probe reading nutrient strength",
    caption: "ဓာတ်ဆား များ → EC မြင့် — အာဟာရ ပြင်းအား",
  },
  "elec-flow-sensor": {
    src: `${IMG}/flow-sensor.svg`,
    alt: "A water flow sensor turbine counting pulses",
    caption: "ဘီးလည် → pulse ရေတွက် = ရေ ပမာဏ (L/min)",
  },
  "elec-ultrasonic": {
    src: `${IMG}/ultrasonic.svg`,
    alt: "Ultrasonic sensor measuring distance by echo",
    caption: "အသံ ပဲ့တင် အချိန် → အကွာအဝေး/ရေကန် အမြင့်",
  },
  "elec-oled-display": {
    src: `${IMG}/oled-display.svg`,
    alt: "An OLED screen showing sensor values",
    caption: "internet မလိုဘဲ တန်ဖိုးတွေ device ပေါ်တင် ဖတ်",
  },
  "elec-sd-logging": {
    src: `${IMG}/sd-logging.svg`,
    alt: "Logging sensor readings to an SD card CSV",
    caption: "offline မှာ data.csv ထဲ မှတ်တမ်းတင်",
  },
  "elec-solar-power": {
    src: `${IMG}/solar-power.svg`,
    alt: "Solar panel to charge controller to battery to node",
    caption: "panel → controller → battery → ESP32 — 24/7 field",
  },
  "elec-voltage-regulator": {
    src: `${IMG}/voltage-regulator.svg`,
    alt: "A regulator turning unstable voltage into a steady rail",
    caption: "မတည်ငြိမ် → တိကျ တည်ငြိမ် voltage (7805/buck)",
  },
  "elec-lora": {
    src: `${IMG}/lora.svg`,
    alt: "LoRa sending sensor data kilometres to a gateway",
    caption: "Wi-Fi မမီ ဝေးလံ လယ် — km ချီ · power နည်း",
  },
  "elec-home-assistant": {
    src: `${IMG}/home-assistant.svg`,
    alt: "Home Assistant / Node-RED hub tying devices together",
    caption: "device မျိုးစုံ တစ်နေရာ — dashboard + rule",
  },
  "elec-ota": {
    src: `${IMG}/ota.svg`,
    alt: "Over-the-air firmware update over Wi-Fi",
    caption: "ကြိုးမချိတ်ဘဲ code အသစ် အဝေးက တင်",
  },
  "elec-enclosure": {
    src: `${IMG}/enclosure.svg`,
    alt: "A weatherproof IP65 enclosure protecting a board",
    caption: "IP65 — မိုး/နေ/ဖုန်/ပိုး ဒဏ်မှ ကာကွယ်",
  },
  "elec-esd-static": {
    src: `${IMG}/esd.svg`,
    alt: "ESD protection: wrist strap, ground mat, anti-static bag",
    caption: "static ဓာတ်တိုး → chip ပျက် — strap/mat/bag နဲ့ ကာ",
  },
  "elec-project-soil-monitor": {
    src: `${IMG}/soil-monitor.svg`,
    alt: "A complete soil-monitor IoT node end to end",
    caption: "sensor + board + power + Wi-Fi + cloud — အားလုံးပေါင်း",
  },
};

const CODE: Record<string, CodeExtra> = {
  "what-is-a-sensor": {
    heading: "လက်တွေ့ — sensor တစ်လုံး ဖတ်ကြည့်",
    body: "Sensor ဆိုတာ လောကကို ဂဏန်းပြောင်းပေးတဲ့ ကိရိယာ — ပထမဆုံး ဖတ်ကြည့်ရအောင်။",
    code: "void setup() { Serial.begin(9600); }\n\nvoid loop() {\n  int raw = analogRead(A0);      // 0–1023 (10-bit)\n  Serial.println(raw);           // Serial Monitor မှာ ကြည့်\n  delay(500);\n}\n// အလင်း/အစိုဓာတ်/အပူ — sensor မျိုးစုံ ဒီပုံစံပဲ စဖတ်",
  },
  "sending-data-to-the-cloud": {
    heading: "လက်တွေ့ — ESP32 ကနေ cloud သို့",
    body: "ဖတ်ထားတဲ့ တန်ဖိုးကို HTTP POST နဲ့ server ပို့ခြင်း။",
    code: "#include <HTTPClient.h>\n\nvoid sendReading(float temp) {\n  HTTPClient http;\n  http.begin(\"https://api.example.com/readings\");\n  http.addHeader(\"Content-Type\", \"application/json\");\n  String body = \"{\\\"temp\\\":\" + String(temp) + \"}\";\n  int code = http.POST(body);      // 200 = အောင်မြင်\n  http.end();\n}",
  },
  "electricity-flow": {
    heading: "လက်တွေ့ — ရေပိုက် ဥပမာ",
    body: "လျှပ်စစ်ကို ရေစီးနဲ့ နှိုင်းတဲ့ မှတ်ဉာဏ်ကူ ဇယား။",
    code: "// လျှပ်စစ် ≈ ရေပိုက် ဥပမာ\n// ──────────────────────────\n// Voltage (V)  = ရေဖိအား  — တွန်းအား\n// Current (A)  = ရေစီးနှုန်း — စီးဆင်းမှု\n// Resistance(Ω)= ပိုက်ကျဉ်း  — အတားအဆီး\n// ──────────────────────────\n// ဖိအားမြင့် + ပိုက်ကျယ် → ရေများများစီး\n// V မြင့် + R နည်း → I များများစီး (V = I × R)",
  },
  "battery-power": {
    heading: "လက်တွေ့ — ဘက်ထရီ သက်တမ်း တွက်",
    body: "mAh ကနေ ဘယ်နှနာရီ ခံမလဲ ခန့်မှန်းခြင်း။",
    code: "// ဘက်ထရီ 2000mAh, circuit သုံးစွဲမှု 80mA\n// သက်တမ်း = 2000 ÷ 80 = 25 နာရီ\n\n// ESP32 deep sleep နဲ့ ချွေတာ —\nesp_sleep_enable_timer_wakeup(60 * 1000000); // 60s\nesp_deep_sleep_start();   // အိပ်နေစဉ် ~10µA သာ\n// တစ်မိနစ်တစ်ခါနိုး ဖတ်-ပို့-အိပ် → လနဲ့ချီ ခံ",
  },
  "circuit-components": {
    heading: "လက်တွေ့ — component သင်္ကေတ မှတ်",
    body: "Schematic ဖတ်ဖို့ အခြေခံ သင်္ကေတများ။",
    code: "// အသုံးများ သင်္ကေတများ\n// ────────────────────────\n// ─/\\/\\/─   resistor (R)\n// ─┤(─      capacitor (C)\n// ─▶|─      diode / LED\n// ─(M)─     motor\n// ⏚         ground (GND)\n// ─||─      battery\n// ────────────────────────\n// Schematic = circuit ရဲ့ မြေပုံ",
  },
  "switches-buttons": {
    heading: "လက်တွေ့ — debounce လုပ်နည်း",
    body: "ခလုတ်တစ်ချက်နှိပ် အကြိမ်များစွာ မဖတ်မိအောင် ကာကွယ်ခြင်း။",
    code: "int lastState = HIGH;\nunsigned long lastChange = 0;\n\nvoid loop() {\n  int state = digitalRead(BTN);\n  if (state != lastState && millis() - lastChange > 50) {\n    lastChange = millis();       // 50ms အတွင်း တုန်ခါမှု လျစ်လျူ\n    lastState = state;\n    if (state == LOW) toggleLed();  // တကယ့် နှိပ်ချက်\n  }\n}",
  },
  resistors: {
    heading: "လက်တွေ့ — LED resistor တွက်",
    body: "LED အတွက် resistor တန်ဖိုး ရွေးနည်း။",
    code: "// R = (Vsupply − Vled) ÷ Iled\n// ──────────────────────────\n// 5V board, အနီ LED (2V, 15mA):\n//   R = (5 − 2) ÷ 0.015 = 200Ω → 220Ω သုံး\n// 3.3V board, အပြာ LED (3V, 10mA):\n//   R = (3.3 − 3) ÷ 0.010 = 30Ω → 47Ω သုံး\n// ──────────────────────────\n// အနီးဆုံး ပိုကြီးတဲ့ standard တန်ဖိုး ရွေး",
  },
  "leds-diodes": {
    heading: "လက်တွေ့ — blink နဲ့ fade",
    body: "Digital ON/OFF နဲ့ PWM အမှိန်အလင်း နှစ်မျိုးလုံး။",
    code: "void loop() {\n  // Blink — digital\n  digitalWrite(13, HIGH); delay(500);\n  digitalWrite(13, LOW);  delay(500);\n\n  // Fade — PWM (pin ~9)\n  for (int b = 0; b <= 255; b += 5) {\n    analogWrite(9, b);    // 0=မှိတ်, 255=အလင်းဆုံး\n    delay(20);\n  }\n}",
  },
  microcontrollers: {
    heading: "လက်တွေ့ — sketch တစ်ပုဒ်ရဲ့ ခန္ဓာ",
    body: "Arduino program တိုင်း ဒီနှစ်ပိုင်းပဲ — setup တစ်ခါ၊ loop ထာဝရ။",
    code: "// တစ်ခါပဲ run — ပြင်ဆင်မှုများ\nvoid setup() {\n  Serial.begin(9600);      // PC နဲ့ စကားပြောလမ်း\n  pinMode(13, OUTPUT);     // pin 13 = ထွက် (LED)\n  pinMode(2, INPUT_PULLUP);// pin 2  = ဝင် (ခလုတ်)\n}\n\n// ထာဝရ ထပ်ခါ run — အလုပ်အားလုံး\nvoid loop() {\n  // sense → think → act ဒီထဲမှာ\n}",
  },
  "digital-analog-signals": {
    heading: "လက်တွေ့ — digital vs analog ဖတ်",
    body: "ON/OFF နှစ်မျိုးတည်း vs အဆင့် ၁၀၂၄ ဆင့် — ဖတ်နည်း ကွာပုံ။",
    code: "// Digital — 0 သို့ 1 နှစ်မျိုးတည်း\nint door = digitalRead(2);        // ဖွင့်/ပိတ်\n\n// Analog — 0 မှ 1023 (အဆင့်လိုက်)\nint light = analogRead(A0);       // အလင်း ပမာဏ\nfloat volts = light * (5.0 / 1023.0);\n\nSerial.print(door); Serial.print(\" \");\nSerial.println(volts);",
  },
  "gpio-inputs-outputs": {
    heading: "လက်တွေ့ — ခလုတ်နဲ့ LED ချိတ်",
    body: "Input ဖတ်ပြီး output ထိန်း — GPIO အခြေခံ စက်ဝန်းအပြည့်။",
    code: "void setup() {\n  pinMode(2, INPUT_PULLUP);   // ခလုတ် (နှိပ် = LOW)\n  pinMode(13, OUTPUT);        // LED\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {   // နှိပ်ထားစဉ်\n    digitalWrite(13, HIGH);      // LED လင်း\n  } else {\n    digitalWrite(13, LOW);\n  }\n}",
  },
  "temperature-sensors": {
    heading: "လက်တွေ့ — DHT22 အပူ/စိုထိုင်းဖတ်",
    body: "စိုက်ခင်း အသုံးအများဆုံး sensor တစ်လုံး ဖတ်နည်း။",
    code: "#include <DHT.h>\nDHT dht(4, DHT22);            // pin 4\n\nvoid setup() { Serial.begin(9600); dht.begin(); }\n\nvoid loop() {\n  float t = dht.readTemperature();  // °C\n  float h = dht.readHumidity();     // %\n  if (isnan(t)) { Serial.println(\"ဖတ်မရ!\"); }\n  else { Serial.printf(\"%.1f°C  %.0f%%\\n\", t, h); }\n  delay(2000);                 // DHT22 — 2s တစ်ခါပဲ ဖတ်ရ\n}",
  },
  "light-sensors": {
    heading: "လက်တွေ့ — LDR နဲ့ ညအလိုအလျောက်မီး",
    body: "အလင်းနည်းရင် မီးဖွင့်တဲ့ logic — voltage divider နဲ့ ဖတ်။",
    code: "void loop() {\n  int light = analogRead(A0);   // LDR + 10kΩ divider\n  Serial.println(light);        // နေ့: ~800, ည: ~150\n\n  if (light < 300) {            // မှောင်ပြီ\n    digitalWrite(LAMP, HIGH);\n  } else if (light > 400) {     // hysteresis — မလှုပ်ခတ်အောင်\n    digitalWrite(LAMP, LOW);\n  }\n  delay(1000);\n}",
  },
  "moisture-sensors": {
    heading: "လက်တွေ့ — မြေအစိုဓာတ် ဖတ်+ချိန်ညှိ",
    body: "အခြောက်/အစို တန်ဖိုးနှစ်ခု တိုင်းပြီး ရာခိုင်နှုန်း ပြောင်းနည်း။",
    code: "// ချိန်ညှိ: လေထဲ (ခြောက်) = 620, ရေထဲ (စို) = 250\nconst int DRY = 620, WET = 250;\n\nint moisturePercent() {\n  int raw = analogRead(A0);\n  int pct = map(raw, DRY, WET, 0, 100);\n  return constrain(pct, 0, 100);\n}\n// capacitive sensor သုံး — resistive က မြေထဲမှာ ချေးတက်",
  },
  "motors-servos": {
    heading: "လက်တွေ့ — DC motor အမြန်ထိန်း",
    body: "PWM နဲ့ motor အမြန်နှုန်း အဆင့်လိုက် ထိန်းခြင်း။",
    code: "void loop() {\n  analogWrite(EN_PIN, 100);   // နှေးနှေး (~40%)\n  delay(2000);\n  analogWrite(EN_PIN, 255);   // အပြည့် (100%)\n  delay(2000);\n  analogWrite(EN_PIN, 0);     // ရပ်\n  delay(1000);\n}\n// motor ကို GPIO တိုက်ရိုက် မချိတ်ရ —\n// driver (L298N/transistor) မဖြစ်မနေ ခံ",
  },
  "relays-switching": {
    heading: "လက်တွေ့ — relay နဲ့ ရေစုပ်စက်ထိန်း",
    body: "5V signal နဲ့ 220V ပန့် ဖွင့်ပိတ် — အန္တရာယ်ကင်းအောင် relay ခံ။",
    code: "const int RELAY = 7;   // active-LOW module များ\n\nvoid pumpOn()  { digitalWrite(RELAY, LOW);  }\nvoid pumpOff() { digitalWrite(RELAY, HIGH); }\n\nvoid loop() {\n  if (moisturePercent() < 30) {\n    pumpOn();  delay(10000);   // ၁၀ စက္ကန့် ရေလောင်း\n    pumpOff(); delay(60000);   // စိမ့်ဝင်ချိန် စောင့်\n  }\n}\n// ⚠️ 220V ဘက်ခြမ်း — လိုင်းသမားနဲ့သာ တပ်ဆင်ပါ",
  },
  "wifi-networks": {
    heading: "လက်တွေ့ — ESP32 WiFi ချိတ်",
    body: "WiFi ချိတ်ပြီး IP ရတဲ့ထိ — IoT ရဲ့ ပထမခြေလှမ်း။",
    code: "#include <WiFi.h>\n\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.begin(\"MyFarm\", \"password123\");\n  while (WiFi.status() != WL_CONNECTED) {\n    delay(500); Serial.print(\".\");\n  }\n  Serial.println(WiFi.localIP());   // ဥပမာ 192.168.1.42\n}\n// ပြတ်ရင် ပြန်ချိတ်ဖို့ WiFi.setAutoReconnect(true);",
  },
  "mqtt-messaging": {
    heading: "လက်တွေ့ — MQTT publish",
    body: "Topic ပေါ် message တင်ခြင်း — subscribe ထားသူတိုင်း ချက်ချင်းရ။",
    code: "#include <PubSubClient.h>\nPubSubClient mqtt(wifiClient);\n\nvoid setup() {\n  mqtt.setServer(\"broker.local\", 1883);\n  mqtt.connect(\"greenhouse-1\");\n}\n\nvoid loop() {\n  float t = dht.readTemperature();\n  mqtt.publish(\"farm/greenhouse1/temp\", String(t).c_str());\n  delay(5000);\n}\n// dashboard က farm/# subscribe → အကုန်မြင်",
  },
  "automation-logic": {
    heading: "လက်တွေ့ — rule engine အသေးစား",
    body: "IF-THEN rule တွေကို data နဲ့ တွဲစစ်တဲ့ automation core။",
    code: "struct Rule { float threshold; int pin; bool above; };\nRule rules[] = {\n  { 30.0, FAN,  true  },   // အပူ > 30° → fan\n  { 35.0, PUMP, false },   // အစိုဓာတ် < 35% → ရေ\n};\n\nvoid applyRules(float temp, float moisture) {\n  digitalWrite(FAN,  temp > rules[0].threshold);\n  digitalWrite(PUMP, moisture < rules[1].threshold);\n}\n// gwave farm rules လည်း ဒီသဘောပဲ — cloud မှာ စစ်",
  },
  "elec-ohms-law": {
    heading: "လက်တွေ့ — Ohm's law တွက်စက်",
    body: "သိတဲ့ နှစ်လုံးထည့်ရင် ကျန်တစ်လုံး ထုတ်ပေးတဲ့ function။",
    code: "float ohms(float v, float i, float r) {\n  // မသိတဲ့ တစ်လုံးကို 0 ထည့်\n  if (v == 0) return i * r;      // V = I×R\n  if (i == 0) return v / r;      // I = V/R\n  return v / i;                  // R = V/I\n}\n\n// 9V ဘက်ထရီ, 450Ω → I = ?\nSerial.println(ohms(9, 0, 450));  // 0.02A = 20mA",
  },
  "elec-transistors": {
    heading: "လက်တွေ့ — transistor နဲ့ fan ထိန်း",
    body: "GPIO → transistor base → 12V fan — PWM အမြန်ထိန်းပါ ရ။",
    code: "// NPN transistor (2N2222) — base မှာ 1kΩ ခံ\nconst int FAN = 9;   // PWM pin\n\nvoid loop() {\n  float temp = readTemp();\n  if (temp > 32)      analogWrite(FAN, 255); // အပြည့်\n  else if (temp > 28) analogWrite(FAN, 150); // အလယ်\n  else                analogWrite(FAN, 0);   // ရပ်\n  delay(2000);\n}\n// motor/fan — flyback diode မမေ့ပါနဲ့",
  },
  "elec-voltage-divider": {
    heading: "လက်တွေ့ — divider တွက် + ဖတ်",
    body: "R နှစ်လုံး ရွေးပြီး ADC နဲ့ တကယ့် voltage ပြန်တွက်နည်း။",
    code: "// 12V ဘက်ထရီကို 3.3V ESP32 နဲ့ စောင့်ကြည့် —\n// R1=100kΩ (အပေါ်), R2=27kΩ (အောက်)\n// Vout = 12 × 27/(100+27) = 2.55V ✓ (3.3V အောက်)\n\nfloat readBatteryV() {\n  int raw = analogRead(34);           // 0–4095\n  float vout = raw * (3.3 / 4095.0);\n  return vout * (100.0 + 27.0) / 27.0;  // ပြန်ချဲ့\n}",
  },
  "elec-pull-up-down": {
    heading: "လက်တွေ့ — INPUT_PULLUP သုံး",
    body: "ပြင်ပ resistor မလိုဘဲ chip တွင်း pull-up ဖွင့်နည်း။",
    code: "void setup() {\n  // chip တွင်း ~45kΩ pull-up အလိုအလျောက်\n  pinMode(2, INPUT_PULLUP);\n}\n\nvoid loop() {\n  // သတိ — logic ပြောင်းပြန်:\n  // မနှိပ် = HIGH (1), နှိပ် = LOW (0)\n  if (digitalRead(2) == LOW) {\n    Serial.println(\"နှိပ်လိုက်ပြီ!\");\n  }\n}",
  },
  "elec-pwm": {
    heading: "လက်တွေ့ — duty cycle စမ်းကြည့်",
    body: "analogWrite တန်ဖိုးအလိုက် LED အလင်း ဘယ်လိုပြောင်းလဲ။",
    code: "// analogWrite(pin, 0–255) — duty cycle\nanalogWrite(9,  64);   // 25% — မှိန်\nanalogWrite(9, 128);   // 50% — အလယ်\nanalogWrite(9, 255);   // 100% — အလင်းဆုံး\n\n// ESP32 မှာ —\nledcAttach(9, 5000, 8);      // 5kHz, 8-bit\nledcWrite(9, 128);           // 50%",
  },
  "elec-adc-dac": {
    heading: "လက်တွေ့ — ADC ကနေ voltage",
    body: "ADC ကိန်းပြည့်ကို တကယ့် voltage ပြန်ပြောင်းနည်း — board အလိုက် ကွာ။",
    code: "// Arduino Uno — 10-bit (0–1023), 5V ref\nfloat v1 = analogRead(A0) * (5.0 / 1023.0);\n\n// ESP32 — 12-bit (0–4095), 3.3V ref\nfloat v2 = analogRead(34) * (3.3 / 4095.0);\n\n// Resolution = ခွဲနိုင်တဲ့ အဆင့်အရေအတွက်\n// 10-bit: 5V÷1024 ≈ 4.9mV တစ်ဆင့်\n// 12-bit: 3.3V÷4096 ≈ 0.8mV တစ်ဆင့် — ပိုစိပ်",
  },
  "elec-i2c": {
    heading: "လက်တွေ့ — I2C scanner",
    body: "Bus ပေါ်မှာ ဘယ် device (address) တွေ ရှိလဲ ရှာတဲ့ classic tool။",
    code: "#include <Wire.h>\n\nvoid setup() {\n  Wire.begin(); Serial.begin(9600);\n  for (byte addr = 8; addr < 120; addr++) {\n    Wire.beginTransmission(addr);\n    if (Wire.endTransmission() == 0) {\n      Serial.print(\"တွေ့ပြီ: 0x\");\n      Serial.println(addr, HEX);   // ဥပမာ 0x3C = OLED\n    }\n  }\n}",
  },
  "elec-spi": {
    heading: "လက်တွေ့ — SPI transfer",
    body: "CS ချ၊ ပို့/ဖတ်၊ CS ပြန်တင် — SPI ရဲ့ အခြေခံသုံးဆင့်။",
    code: "#include <SPI.h>\n\nvoid setup() {\n  SPI.begin();\n  pinMode(CS, OUTPUT);\n}\n\nbyte readRegister(byte reg) {\n  digitalWrite(CS, LOW);          // device ရွေး\n  SPI.transfer(reg | 0x80);       // ဖတ်မယ့် register\n  byte value = SPI.transfer(0);   // ဖတ်\n  digitalWrite(CS, HIGH);         // ပြီး\n  return value;\n}",
  },
  "elec-uart-serial": {
    heading: "လက်တွေ့ — Serial ပို့/ဖတ်",
    body: "PC နဲ့ စကားပြော — debug လုပ်ရာမှာ နေ့စဉ်သုံး ကိရိယာ။",
    code: "void setup() { Serial.begin(115200); }\n\nvoid loop() {\n  // ပို့\n  Serial.println(\"temp=28.5\");\n\n  // ဖတ် — PC ကနေ command လက်ခံ\n  if (Serial.available()) {\n    String cmd = Serial.readStringUntil('\\n');\n    if (cmd == \"pump on\") pumpOn();\n  }\n}\n// baud rate နှစ်ဖက် တူရမည် (115200)",
  },
  "elec-multimeter": {
    heading: "လက်တွေ့ — တိုင်းနည်း အဆင့်လိုက်",
    body: "Voltage, current, resistance, continuity — ဘယ်လိုတိုင်းလဲ။",
    code: "// Multimeter တိုင်းနည်း\n// ─────────────────────────────\n// Voltage  (V⎓): circuit ဖွင့်ထား၊ နှစ်ဖက် ကပ်တိုင်း\n//                (parallel — ဖြုတ်စရာမလို)\n// Current  (A):  circuit ဖြတ်ပြီး ကြားညှပ်တိုင်း\n//                (series — လမ်းထဲ ဝင်ရ)\n// Resistance(Ω): ပါဝါ ပိတ်ပြီးမှ တိုင်း\n// Continuity(🔊): ကြိုးပြတ်လား စစ် — တီရင် ဆက်နေ\n// ─────────────────────────────\n// စမတိုင်းခင် range ကို မြင့်ကနေ စချ",
  },
  "elec-logic-gates": {
    heading: "လက်တွေ့ — gate တွေကို code နဲ့",
    body: "AND/OR/NOT ကို သစ်သီးခြံ automation logic နဲ့ တွဲမြင်ကြည့်။",
    code: "bool hot   = temp > 30;\nbool dry   = moisture < 35;\nbool night = light < 200;\n\nbool fanOn   = hot && !night;    // AND + NOT\nbool pumpOn  = dry || manualBtn; // OR\nbool alarmOn = hot && dry;       // နှစ်ခုလုံး ဆိုး\n\n// hardware gate (74HC08 စသည်) တွေလည်း\n// ဒီ logic ကိုပဲ transistor နဲ့ တည်ဆောက်ထား",
  },
  "elec-arduino": {
    heading: "လက်တွေ့ — ပထမဆုံး sketch",
    body: "Board ရွေး၊ port ရွေး၊ upload — Hello World (Blink)။",
    code: "// Tools → Board → Arduino Uno\n// Tools → Port → COM3 (သို့ /dev/ttyUSB0)\n// ➜ Upload ခလုတ် နှိပ်\n\nvoid setup() {\n  pinMode(LED_BUILTIN, OUTPUT);   // board ပေါ် LED\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}",
  },
  "elec-esp32": {
    heading: "လက်တွေ့ — ESP32 အားသာချက်သုံး",
    body: "WiFi + deep sleep + touch — Uno မှာမရှိတဲ့ စွမ်းရည်များ။",
    code: "// ESP32 — WiFi ပါ, RAM များ, core ၂ လုံး\n#include <WiFi.h>\n\nvoid setup() {\n  // touch sensor ပါပြီးသား — pin ကိုထိရင် သိ\n  if (touchRead(T0) < 40) Serial.println(\"ထိတယ်!\");\n\n  // ဖတ် → ပို့ → ၅ မိနစ် အိပ် (battery ချွေတာ)\n  publishReading();\n  esp_sleep_enable_timer_wakeup(300 * 1000000ULL);\n  esp_deep_sleep_start();\n}",
  },
  "elec-raspberry-pi": {
    heading: "လက်တွေ့ — Pi + Python GPIO",
    body: "Linux ကွန်ပျူတာပေါ်မှာ Python နဲ့ pin ထိန်းခြင်း။",
    code: "from gpiozero import LED, Button, MCP3008\nfrom time import sleep\n\nled = LED(17)\nbtn = Button(2)\nsoil = MCP3008(0)     # Pi မှာ ADC မပါ — MCP3008 ခံ\n\nwhile True:\n    if btn.is_pressed or soil.value < 0.35:\n        led.on()      # ရေလိုနေပြီ အချက်ပြ\n    else:\n        led.off()\n    sleep(1)",
  },
  "elec-ph-sensor": {
    heading: "လက်တွေ့ — pH ဖတ် + ချိန်ညှိ",
    body: "Buffer ရည် ၂ မျိုး (pH4, pH7) နဲ့ two-point calibration။",
    code: "// ချိန်ညှိ: pH7 မှာ 2.50V, pH4 မှာ 3.05V ဖတ်ရ\nconst float V7 = 2.50, V4 = 3.05;\nconst float SLOPE = (7.0 - 4.0) / (V7 - V4); // -5.45\n\nfloat readPH() {\n  float v = analogRead(A0) * (5.0 / 1023.0);\n  return 7.0 + (v - V7) * SLOPE;\n}\n// hydroponics: 5.5–6.5 ကြား ထိန်း\n// probe ကို KCl ရည်ထဲ သိမ်း — ခြောက်မခံ",
  },
  "elec-ec-sensor": {
    heading: "လက်တွေ့ — EC ဖတ် + အပူပြင်ဆင်",
    body: "EC က အပူချိန်နဲ့ ပြောင်း — 25°C စံ ပြန်ညှိရ။",
    code: "float readEC(float tempC) {\n  float raw = analogRead(A1) * (5.0 / 1023.0);\n  float ec = raw * K_CELL;         // probe constant\n  // 25°C စံအဖြစ် ပြင် (2%/°C)\n  return ec / (1.0 + 0.02 * (tempC - 25.0));\n}\n// ရွက်စား: EC 1.2–1.8 · သီးနှံ: 2.0–3.5 mS/cm\n// gwave EC/PPM converter tool နဲ့ တွဲသုံး",
  },
  "elec-flow-sensor": {
    heading: "လက်တွေ့ — ရေစီးနှုန်း တိုင်း",
    body: "Hall-effect flow sensor ရဲ့ pulse ရေတွက်ပြီး L/min တွက်။",
    code: "volatile int pulses = 0;\nvoid onPulse() { pulses++; }\n\nvoid setup() {\n  attachInterrupt(digitalPinToInterrupt(2), onPulse, RISING);\n}\n\nvoid loop() {\n  pulses = 0;\n  delay(1000);                    // ၁ စက္ကန့် ရေတွက်\n  float lpm = pulses / 7.5;       // YF-S201: 7.5 pulse/L/min\n  totalLiters += lpm / 60.0;      // သုံးရေ စုစုပေါင်း မှတ်\n}",
  },
  "elec-ultrasonic": {
    heading: "လက်တွေ့ — ရေကန် အမြင့်တိုင်း",
    body: "Ultrasonic ကို ရေလှောင်ကန် level meter အဖြစ် သုံးခြင်း။",
    code: "// sensor က ကန်အဖုံးမှာ — ရေမျက်နှာပြင်ထိ အကွာတိုင်း\nconst float TANK_DEPTH = 120.0;   // cm\n\nfloat waterPercent() {\n  float gap = readDistanceCm();   // ရေနဲ့ sensor အကွာ\n  float level = TANK_DEPTH - gap;\n  return constrain(level / TANK_DEPTH * 100, 0, 100);\n}\n// 20% အောက် → refill alert ပို့",
  },
  "elec-oled-display": {
    heading: "လက်တွေ့ — OLED မှာ ဖတ်ချက်ပြ",
    body: "0.96\" SSD1306 (I2C, 0x3C) မှာ sensor တန်ဖိုး ပြခြင်း။",
    code: "#include <Adafruit_SSD1306.h>\nAdafruit_SSD1306 oled(128, 64, &Wire);\n\nvoid setup() {\n  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);\n}\n\nvoid show(float t, float h) {\n  oled.clearDisplay();\n  oled.setTextSize(2);\n  oled.setTextColor(WHITE);\n  oled.setCursor(0, 0);\n  oled.printf(\"%.1fC\\n%.0f%%\", t, h);\n  oled.display();               // မမေ့ပါနဲ့!\n}",
  },
  "elec-sd-logging": {
    heading: "လက်တွေ့ — SD ကတ်ပေါ် CSV မှတ်",
    body: "အင်တာနက်မလိုဘဲ ဒေတာ လနဲ့ချီ သိမ်း — offline logger။",
    code: "#include <SD.h>\n\nvoid logReading(float t, float h) {\n  File f = SD.open(\"/log.csv\", FILE_APPEND);\n  if (f) {\n    // timestamp,temp,humidity\n    f.printf(\"%lu,%.1f,%.1f\\n\", millis(), t, h);\n    f.close();                 // မပိတ်ရင် data ပျောက်\n  }\n}\n// နောက်မှ PC မှာ Excel/pandas နဲ့ ဖွင့်စစ်",
  },
  "elec-solar-power": {
    heading: "လက်တွေ့ — solar စနစ် အရွယ်တွက်",
    body: "နေ့စဉ် သုံးစွဲမှုကနေ panel နဲ့ battery အရွယ် တွက်နည်း။",
    code: "// ESP32 node: ပျမ်းမျှ 50mA × 24h = 1200mAh/ရက်\n// မိုးရက် ၃ ရက်ခံ → battery = 1200×3÷0.8 = 4500mAh\n//   (LiFePO4 — 80% ထိသာ သုံး)\n// Panel: 1200mAh ÷ 5h နေ ÷ 0.7 လျော့ကျ ≈ 350mA\n//   → 6V 3W panel လုံလောက်\n\n// code ဘက် — deep sleep နဲ့ သုံးစွဲမှု ၁၀ဆ လျှော့:\nesp_sleep_enable_timer_wakeup(600 * 1000000ULL);\nesp_deep_sleep_start();",
  },
  "elec-lora": {
    heading: "လက်တွေ့ — LoRa ကီလိုမီတာချီ ပို့",
    body: "WiFi မမီတဲ့ လယ်ကွင်းအဝေးက node ကနေ ဒေတာပို့ခြင်း။",
    code: "#include <LoRa.h>\n\nvoid setup() {\n  LoRa.begin(433E6);            // မြန်မာ — 433MHz band\n  LoRa.setSpreadingFactor(10);  // ဝေး = SF မြင့် (နှေး)\n}\n\nvoid loop() {\n  LoRa.beginPacket();\n  LoRa.printf(\"field3,soil=%d\", soilPct);\n  LoRa.endPacket();\n  delay(60000);   // km 5+ ရောက် — bandwidth နည်းလို့ ကြဲပို့\n}",
  },
  "elec-home-assistant": {
    heading: "လက်တွေ့ — MQTT discovery",
    body: "Home Assistant က sensor ကို အလိုအလျောက် မြင်အောင် ကြေညာနည်း။",
    code: "// config topic ပေါ် တစ်ခါ ကြေညာ —\n// HA က sensor အသစ်ကို အလိုအလျောက် ထည့်\nmqtt.publish(\n  \"homeassistant/sensor/gh1temp/config\",\n  \"{\\\"name\\\":\\\"Greenhouse Temp\\\",\"\n  \"\\\"state_topic\\\":\\\"farm/gh1/temp\\\",\"\n  \"\\\"unit_of_measurement\\\":\\\"°C\\\"}\",\n  true);   // retained\n\n// ပြီးရင် ပုံမှန် data ပို့ရုံ\nmqtt.publish(\"farm/gh1/temp\", \"28.5\");",
  },
  "elec-ota": {
    heading: "လက်တွေ့ — ကြိုးမချိတ်ဘဲ update",
    body: "လယ်ထဲက node ကို WiFi ကနေ firmware အသစ်တင်နည်း။",
    code: "#include <ArduinoOTA.h>\n\nvoid setup() {\n  connectWiFi();\n  ArduinoOTA.setHostname(\"greenhouse-1\");\n  ArduinoOTA.setPassword(\"otapass\");  // မဖြစ်မနေ ထား\n  ArduinoOTA.begin();\n}\n\nvoid loop() {\n  ArduinoOTA.handle();   // loop ထဲ အမြဲခေါ်\n  // ... ပုံမှန် အလုပ်\n}\n// Arduino IDE → Port → Network port ရွေး → Upload",
  },
  "elec-project-soil-monitor": {
    heading: "လက်တွေ့ — project အပြည့်",
    body: "ဖတ် → ပြ → ပို့ → အိပ် — သင်ယူသမျှ တစ်ပုဒ်တည်း ပေါင်း။",
    code: "void loop() {\n  // ၁။ Sense\n  int soil = moisturePercent();\n  float t = dht.readTemperature();\n\n  // ၂။ Show — OLED\n  showOnOled(soil, t);\n\n  // ၃။ Act — rule\n  if (soil < 30) pumpFor(10);\n\n  // ၄။ Report — MQTT\n  mqtt.publish(\"farm/plot1/soil\", String(soil).c_str());\n\n  // ၅။ Sleep — battery\n  delay(60000);\n}",
  },
};

/** Merge diagrams and code sections into the electronics lessons. */
export function enrichElectronicsLessons(lessons: Lesson[]): Lesson[] {
  return enrichLessons(lessons, IMAGES, CODE);
}
