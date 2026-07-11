// Electronics & IoT course — third batch (30 → 60). Reading lessons with a
// YouTube hint and three Burmese sections each, focused on components, buses,
// boards, sensors and outdoor/farm IoT. Slugs are `elec-` prefixed to stay
// distinct within the track. Original content for GreenWave. Pure data.

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

export const ELECTRONICS_EXTRA2: Lesson[] = [
  rd("elec-ohms-law", "Ohm's Law (တွက်ချက်)", "V = I × R — circuit တွက်ချက်မှုရဲ့ အခြေခံ။", 9, "ohms law explained calculation", [
    ["V = I × R", "Ohm's Law က Voltage (V, ဗို့), Current (I, အမ်ပီယာ), Resistance (R, အုမ်း) သုံးခုရဲ့ ဆက်နွယ်မှု — V = I × R။ နှစ်ခု သိရင် တတိယကို တွက်နိုင်။"],
    ["ဥပမာ", "5V ကို 1000Ω resistor နဲ့ ဆက်ရင် current = V/R = 5/1000 = 0.005A (5mA)။ LED အတွက် သင့်တော်တဲ့ resistor ရွေးရာမှာ ဒီတွက်ချက်မှု လိုအပ်။"],
    ["power", "Power (P, ဝပ်) = V × I။ component က ဘယ်လောက် အပူထွက်မလဲ, resistor ဘယ် wattage လိုမလဲ တွက်ရာမှာ သုံးသည် — ဒီဇိုင်း လုံခြုံရေးအတွက် အရေးကြီး။"],
  ]),
  rd("elec-transistors", "Transistor", "signal ချဲ့/ဖွင့်ပိတ်တဲ့ အခြေခံ component။", 10, "how transistors work explained", [
    ["transistor ဆိုတာ", "transistor က signal ကို ချဲ့ (amplify) သို့ ဖွင့်/ပိတ် (switch) လုပ်တဲ့ semiconductor။ pin ၃ ခု — base, collector, emitter (BJT)၊ base က ရေတံခါးလို current ကို ထိန်းသည်။"],
    ["switch အဖြစ်", "microcontroller ရဲ့ အားနည်းတဲ့ signal (GPIO) နဲ့ ပါဝါများတဲ့ ဝန် (motor, LED strip) ကို ဖွင့်/ပိတ်ရာမှာ transistor ကို switch အဖြစ် သုံးသည် — pin တိုက်ရိုက် မဆွဲနိုင်လို့။"],
    ["MOSFET", "MOSFET က transistor အမျိုးအစားတစ်ခု — voltage နဲ့ ထိန်းလို့ ပိုထိရောက်, ပါဝါများတဲ့ switching (motor, heater) အတွက် သင့်တော်။ smart farm ရဲ့ pump control တွေမှာ သုံးသည်။"],
  ]),
  rd("elec-inductors", "Inductor", "လျှပ်စစ်စက်ကွင်း သိမ်းဆည်းတဲ့ component။", 8, "inductor explained electronics", [
    ["inductor ဆိုတာ", "inductor (ကွိုင်) က current စီးဆင်းမှုကို magnetic field အဖြစ် သိမ်းသည်။ current ပြောင်းမှုကို ဆန့်ကျင် — DC ကို ဖြတ်, AC/ripple ကို ဟန့်တားသည်။"],
    ["အသုံးများ", "power supply filter (noise ဖယ်), boost/buck converter (voltage ပြောင်း), radio tuning။ capacitor နဲ့ ဆန့်ကျင်ဘက် အလုပ်လုပ်သည်။"],
    ["motor နဲ့ relay", "motor, relay ရဲ့ ကွိုင်က inductor — ပိတ်လိုက်ရင် voltage spike ('back-EMF') ထွက်လို့ flyback diode နဲ့ ကာကွယ်ရသည် (မဟုတ်ရင် transistor ပျက်)။"],
  ]),
  rd("elec-diodes-types", "Diode အမျိုးအစားများ", "current တစ်လမ်းသွား + အထူးပြု diode များ။", 8, "types of diodes explained", [
    ["diode ဆိုတာ", "diode က current ကို တစ်လမ်းသာ စီးစေသည် (valve လို)။ polarity မှားရင် လျှပ်စစ် မစီး။ AC ကို DC ပြောင်း (rectifier) ရာမှာ အခြေခံ။"],
    ["အထူးပြု", "Zener diode (voltage ကန့်သတ်/reference), Schottky (မြန်, voltage drop နည်း), LED (အလင်းထုတ်), photodiode (အလင်း ဖမ်း)။ အလုပ်အလိုက် ရွေးသည်။"],
    ["flyback protection", "motor/relay/solenoid လို inductive load များနဲ့ transistor switch သုံးရင် flyback diode တပ်ရသည် — ပိတ်ချိန် voltage spike ကနေ circuit ကာကွယ်။ pump control တွေမှာ မရှိမဖြစ်။"],
  ]),
  rd("elec-voltage-divider", "Voltage Divider", "resistor ၂ ခုနဲ့ voltage လျှော့ချခြင်း။", 8, "voltage divider circuit explained", [
    ["သဘော", "resistor ၂ ခု အတန်းလိုက် ဆက်ရင် ကြားက voltage က resistor အချိုးအလိုက် ခွဲဝေခံရသည် — Vout = Vin × R2/(R1+R2)။ voltage လျှော့ချ, sensor ဖတ်ရာမှာ။"],
    ["sensor reading", "ခုခံအား ပြောင်းလဲတဲ့ sensor (LDR အလင်း, thermistor အပူ, moisture) ကို voltage divider နဲ့ တွဲ၍ ADC က ဖတ်နိုင်တဲ့ voltage အဖြစ် ပြောင်းသည်။"],
    ["level shifting", "5V signal ကို 3.3V board (ESP32) အတွက် voltage divider နဲ့ လျှော့ချနိုင်သည် — မဟုတ်ရင် pin ပျက်။ ဒါပေမဲ့ signal မြန်ရင် logic level shifter က ပိုကောင်း။"],
  ]),
  rd("elec-pull-up-down", "Pull-up / Pull-down Resistor", "input pin ကို တည်ငြိမ်စေခြင်း။", 8, "pull up pull down resistor explained", [
    ["ပြဿনာ", "button နှိပ်မထားချိန် input pin က 'floating' (မတည်ငြိမ်) ဖြစ်ပြီး noise ကြောင့် ဟိုလိုလို/ဒီလိုလို ဖတ်တတ်သည်။ pull resistor က ဒါကို ဖြေရှင်း။"],
    ["pull-up vs pull-down", "pull-up resistor က pin ကို default HIGH ဆွဲ (button က LOW ဆွဲ)၊ pull-down က default LOW။ microcontroller အများစုမှာ internal pull-up ပါလို့ code နဲ့ ဖွင့်နိုင်။"],
    ["I2C နဲ့", "I2C bus မှာ pull-up resistor မဖြစ်မနေ လိုသည် (SDA, SCL နှစ်ခုစလုံး)။ များသောအားဖြင့် 4.7kΩ။ sensor ချိတ်ရာမှာ မမေ့သင့်။"],
  ]),
  rd("elec-pwm", "PWM — Pulse Width Modulation", "digital pin နဲ့ 'analog' ထိန်းချုပ်ခြင်း။", 9, "PWM pulse width modulation explained", [
    ["PWM ဆိုတာ", "PWM က pin ကို အလွန်မြန်စွာ ON/OFF ဖွင့်ပိတ်ခြင်း — 'duty cycle' (ON ရာခိုင်နှုန်း) နဲ့ ပျမ်းမျှ ပါဝါ ထိန်းသည်။ 50% duty ဆို တစ်ဝက် ပါဝါ။"],
    ["အသုံးများ", "LED အလင်း မှိန်/တောက် (dimming), motor အရှိန် ထိန်း, servo angle, buzzer အသံ။ 'analog output' လို အလုပ်လုပ်ပေမဲ့ digital pin ပဲ။"],
    ["farm", "fan အရှိန်, grow light အလင်းအား, water pump flow ကို PWM နဲ့ ချောမွေ့စွာ ထိန်းချုပ်နိုင် — on/off တင်မဟုတ်ဘဲ အဆင့်လိုက် ထိန်းလို့ ပိုကောင်း။"],
  ]),
  rd("elec-adc-dac", "ADC နဲ့ DAC", "analog ↔ digital ပြောင်းလဲခြင်း။", 9, "ADC DAC analog digital converter explained", [
    ["ADC", "ADC (Analog-to-Digital Converter) က ဆက်တိုက် (analog) voltage ကို ဂဏန်း (digital) အဖြစ် ပြောင်းသည် — sensor (အပူ, အလင်း, moisture) ဖတ်ရာမှာ မရှိမဖြစ်။ resolution (10-bit = 0–1023) က တိကျမှု။"],
    ["DAC", "DAC (Digital-to-Analog) က ဂဏန်းကို analog voltage ပြန်ပြောင်း — အသံ ထုတ်, analog signal ပေးရာမှာ။ ESP32 မှာ built-in DAC ပါသည်။"],
    ["sampling", "ADC က တစ်စက္ကန့် ဘယ်နှစ်ကြိမ် ဖတ်လဲ (sampling rate)၊ ဘယ်လောက် တိကျ (bits) က အရေးကြီး။ sensor ဖတ်နှုန်းကို လိုအပ်ချက်အလိုက် ချိန်ပါ။"],
  ]),
  rd("elec-i2c", "I2C Bus", "wire ၂ ချောင်းနဲ့ sensor များစွာ ချိတ်ခြင်း။", 9, "I2C protocol explained tutorial", [
    ["I2C ဆိုတာ", "I2C က wire ၂ ချောင်း (SDA data, SCL clock) နဲ့ device များစွာ ချိတ်နိုင်တဲ့ bus။ device တစ်ခုစီမှာ သီးသန့် address ရှိလို့ master က တစ်ခုချင်း ပြောဆိုနိုင်။"],
    ["အားသာချက်", "pin နည်း (၂ ချောင်းတည်း) နဲ့ sensor ဒါဇင်ချီ ချိတ်နိုင်။ OLED display, RTC clock, များစွာသော sensor တွေ I2C သုံးသည်။ pull-up resistor လိုသည်။"],
    ["address ပြဿнా", "device ၂ ခုက address တူရင် ပြဿნာ ဖြစ်။ များသောအားဖြင့် jumper/solder နဲ့ address ပြောင်းနိုင်။ I2C scanner code နဲ့ device တွေ့/မတွေ့ စစ်နိုင်။"],
  ]),
  rd("elec-spi", "SPI Bus", "မြန်ဆန်တဲ့ device ဆက်သွယ်ရေး။", 8, "SPI protocol explained tutorial", [
    ["SPI ဆိုတာ", "SPI က I2C ထက် မြန်တဲ့ bus — wire ၄ ချောင်း (MOSI, MISO, SCK, CS)။ device တစ်ခုစီအတွက် CS (chip select) pin သီးသန့် လိုသည်။"],
    ["ဘယ်အခါ သုံး", "မြန်ဆန်မှု လိုတဲ့ device — SD card, TFT display, အချို့ sensor, radio module (LoRa, nRF24)။ data အများ မြန်မြန် ပို့ဖို့ SPI က I2C ထက် သင့်တော်။"],
    ["I2C vs SPI", "I2C — pin နည်း, နှေး, device များ; SPI — မြန်, pin များ (device တစ်ခုစီ CS)။ လိုအပ်ချက် (မြန်နှုန်း vs pin အရေအတွက်) အလိုက် ရွေးသည်။"],
  ]),
  rd("elec-uart-serial", "UART / Serial", "board နဲ့ ကွန်ပျူတာ/module ဆက်သွယ်ရေး။", 8, "UART serial communication explained", [
    ["UART ဆိုတာ", "UART (serial) က wire ၂ ချောင်း (TX ပို့, RX ဖတ်) နဲ့ device ၂ ခု တိုက်ရိုက် ပြောဆိုသည်။ baud rate (9600, 115200) တူညီဖို့ လိုသည်။"],
    ["debug", "microcontroller က `Serial.println()` နဲ့ ကွန်ပျူတာသို့ message ပို့၍ debug လုပ်ရာမှာ အသုံးများ — code ဘာဖြစ်နေလဲ ကြည့်တဲ့ အခြေခံ tool။"],
    ["module ချိတ်", "GPS, GSM/4G, RFID reader, အချို့ sensor တွေ UART သုံးသည်။ TX↔RX ကားဆန့်ကျင် ချိတ်ရ (တစ်ခုရဲ့ TX က တစ်ခုရဲ့ RX)၊ voltage level (5V/3.3V) သတိထား။"],
  ]),
  rd("elec-multimeter", "Multimeter သုံးနည်း", "voltage, current, resistance တိုင်းတာခြင်း။", 8, "how to use a multimeter tutorial", [
    ["multimeter ဆိုတာ", "multimeter က voltage (V), current (A), resistance (Ω), continuity တိုင်းတာတဲ့ အခြေခံ tool — electronics လုပ်သူတိုင်း မရှိမဖြစ်။"],
    ["continuity test", "continuity mode (🔊) က wire/joint ဆက်နေ/မဆက် စစ်သည် — ဆက်ရင် အသံမြည်။ short circuit, ကွာနေတဲ့ joint ရှာရာမှာ အလွန်အသုံးဝင်။"],
    ["တိုင်းတာနည်း", "voltage — parallel (ဘေးကပ်)၊ current — series (အတန်းလိုက်, circuit ဖြတ်ထည့်)၊ resistance — ပါဝါဖြုတ်ပြီး။ range/mode မှန်အောင် ရွေးပါ — မဟုတ်ရင် fuse ပျက်တတ်။"],
  ]),
  rd("elec-logic-gates", "Logic Gates", "digital ဆုံးဖြတ်ချက်ရဲ့ အခြေခံ။", 8, "logic gates AND OR NOT explained", [
    ["gate ဆိုတာ", "logic gate က digital input (0/1) ကနေ output (0/1) တွက်သည် — AND (နှစ်ခုလုံး 1 မှ 1), OR (တစ်ခု 1 ဆို 1), NOT (ပြောင်းပြန်), XOR, NAND, NOR။"],
    ["truth table", "gate တစ်ခုစီရဲ့ input/output ပေါင်းစပ်ကို truth table နဲ့ ဖော်ပြသည်။ ဒါက digital logic နားလည်ဖို့ အခြေခံ tool။"],
    ["computer ရဲ့ အခြေခံ", "gate များ ပေါင်းစပ်ခြင်းက adder, memory, processor အထိ တည်ဆောက်နိုင်သည် — computer တစ်ခုလုံးဟာ gate သန်းပေါင်းများစွာ။ microcontroller code ရဲ့ if/and/or နဲ့ ဆက်စပ်။"],
  ]),
  rd("elec-arduino", "Arduino အခြေခံ", "စတင်သူများအတွက် microcontroller board။", 9, "arduino for beginners tutorial", [
    ["Arduino ဆိုတာ", "Arduino က စတင်သူ ဖော်ရွယ်တဲ့ microcontroller board + IDE။ C/C++ နဲ့ ရေးပြီး sensor ဖတ်, motor မောင်း, LED ဖွင့် — physical world ကို code နဲ့ ထိန်းချုပ်။"],
    ["setup/loop", "code မှာ `setup()` (တစ်ကြိမ် — pin သတ်မှတ်) နဲ့ `loop()` (ထပ်ခါထပ်ခါ — အလုပ်လုပ်) ၂ ခု ရှိသည်။ `digitalWrite`, `analogRead`, `delay` က အခြေခံ function။"],
    ["ecosystem", "library ထောင်ချီ, shield (အသင့်တပ် module), community အကြီးအကျယ် — sensor အသစ်တိုင်းအတွက် library နဲ့ ဥပမာ ရှိတတ်လို့ စတင်လွယ်။"],
  ]),
  rd("elec-esp32", "ESP32 / ESP8266", "WiFi ပါတဲ့ IoT microcontroller။", 9, "ESP32 tutorial for beginners", [
    ["ESP32 ဆိုတာ", "ESP32 က WiFi + Bluetooth ပါပြီးသား, စွမ်းအားမြင့်, ဈေးသက်သာတဲ့ microcontroller — IoT project အများစုရဲ့ ရွေးချယ်မှု။ Arduino IDE နဲ့ ရေးနိုင်။"],
    ["3.3V သတိ", "ESP32 က 3.3V logic — 5V sensor/signal တိုက်ရိုက် ချိတ်ရင် pin ပျက်နိုင်။ voltage divider/level shifter သုံးပါ။ GPIO အများစု ADC, PWM, I2C, SPI ရ။"],
    ["cloud ချိတ်", "WiFi ပါလို့ sensor data ကို MQTT/HTTP နဲ့ cloud သို့ တိုက်ရိုက် ပို့နိုင် — gwave farm dashboard လို platform ဆီ real-time data ပို့ရာမှာ အခြေခံ board။"],
  ]),
  rd("elec-raspberry-pi", "Raspberry Pi", "Linux run တဲ့ mini ကွန်ပျူတာ။", 8, "raspberry pi for beginners", [
    ["Pi ဆိုတာ", "Raspberry Pi က Linux OS run တဲ့ mini ကွန်ပျူတာ — microcontroller (Arduino/ESP32) ထက် စွမ်းအားများ, camera, database, web server run နိုင်။ GPIO pin ပါ။"],
    ["ဘယ်အခါ Pi", "camera image processing, local database/dashboard, AI inference, multiple camera (CCTV) လို compute များတဲ့ အလုပ်တွေအတွက်။ ရိုးရိုး sensor ဖတ်ဖို့ ESP32 က ပိုသင့်တော်, ပါဝါသက်သာ။"],
    ["farm hub", "farm မှာ Pi ကို 'gateway' အဖြစ်ထား၍ ESP32 sensor node များထံမှ data စု, local dashboard ပြ, cloud ဆီ ပို့နိုင် — edge computing hub။"],
  ]),
  rd("elec-ph-sensor", "pH Sensor", "မြေဆီ/ရေ ရဲ့ အက်ဆစ်/အယ်ကာလိ တိုင်းတာ။", 8, "pH sensor arduino tutorial", [
    ["pH ဆိုတာ", "pH က ဖျော်ရည်ရဲ့ အက်ဆစ် (0–7) / အယ်ကာလိ (7–14) အတိုင်းအတာ။ အပင်တွေ pH 5.5–6.5 လောက်မှာ အာဟာရ စုပ်ယူ ကောင်းသည် — pH မှားရင် အာဟာရ ရှိလည်း မစုပ်နိုင်။"],
    ["sensor ဖတ်", "pH probe က voltage ထုတ်၍ ADC နဲ့ ဖတ်, calibration (pH 4, 7 buffer solution) နဲ့ ချိန်ညှိရသည်။ hydroponics, မြေဆီ စောင့်ကြည့်ရာမှာ အရေးပါ။"],
    ["ထိန်းသိမ်း", "probe ကို စိုစွတ်အောင် သိမ်း, အသုံးပြုပြီးတိုင်း ဆေး, ပုံမှန် calibrate လုပ်ရသည် — မဟုတ်ရင် reading မှား။ automation နဲ့ pH up/down ဖြည့်တာ ချိတ်နိုင်။"],
  ]),
  rd("elec-ec-sensor", "EC / TDS Sensor", "အာဟာရ ပြင်းအား (ဓာတ်ဆား) တိုင်းတာ။", 8, "EC TDS sensor hydroponics tutorial", [
    ["EC ဆိုတာ", "EC (Electrical Conductivity) က ရေထဲက ပျော်ဝင် ဓာတ်ဆား (အာဟာရ) ပမာဏကို လျှပ်စစ်ကူးစက်နိုင်စွမ်းနဲ့ တိုင်းတာ။ EC များ = အာဟာရ ပြင်း။ hydroponics အတွက် မရှိမဖြစ်။"],
    ["TDS နဲ့", "TDS (Total Dissolved Solids) က EC ကနေ တွက်ထုတ်တဲ့ ppm တန်ဖိုး။ အပင်မျိုးအလိုက် သင့်တော်တဲ့ EC/ppm range ရှိသည် — ပျိုးပင်နည်း, ပွင့်ချိန်များ။"],
    ["automation", "EC sensor + pump နဲ့ အာဟာရ ရော/ဖျော်ခြင်းကို အလိုအလျောက် ထိန်းနိုင်။ pH နဲ့ EC နှစ်ခုပေါင်း စောင့်ကြည့်ခြင်းက data-driven စိုက်ပျိုးရေးရဲ့ အခြေခံ။"],
  ]),
  rd("elec-flow-sensor", "Water Flow Sensor", "ရေစီးနှုန်း/ပမာဏ တိုင်းတာ။", 7, "water flow sensor arduino tutorial", [
    ["flow sensor", "flow sensor ထဲက ဘီး (turbine) က ရေစီးရင် လည်၊ pulse ထုတ်သည်။ pulse ရေတွက်၍ စီးနှုန်း (L/min) နဲ့ စုစုပေါင်း ပမာဏ (litre) တွက်နိုင်။"],
    ["အသုံးချ", "ရေလောင်း ပမာဏ တိုင်း, ရေ ကုန်ကျမှု စောင့်ကြည့်, ရေ ယိုစိမ့်မှု (မမျှော်လင့်တဲ့ flow) ဖမ်း — ရေ ချွေတာရေးအတွက် အသုံးဝင်။"],
    ["pulse counting", "microcontroller က interrupt နဲ့ pulse ရေတွက်ရသည် (မြန်လို့ delay နဲ့ မဖတ်နိုင်)။ sensor တစ်ခုစီရဲ့ calibration factor (pulse/litre) ကွာသည်။"],
  ]),
  rd("elec-ultrasonic", "Ultrasonic Sensor", "အကွာအဝေး/ရေကန် အမြင့် တိုင်းတာ။", 7, "ultrasonic sensor HC-SR04 tutorial", [
    ["ultrasonic ဆိုတာ", "ultrasonic sensor (HC-SR04) က အသံလှိုင်း ပို့, ပြန်လာချိန်ကို တိုင်း၍ အကွာအဝေး တွက်သည် — မထိဘဲ တိုင်းတာနိုင်။ လင်းပြက်လို echo။"],
    ["tank level", "ရေကန်/ဘူး အပေါ်မှာ တပ်၍ ရေမျက်နှာပြင် အမြင့် တိုင်းနိုင် — ရေ ကုန်/ပြည့် သိ၍ pump ဖွင့်/ပိတ် automation။ float switch ထက် တိကျ, မထိ။"],
    ["အကန့်အသတ်", "မွှေးရည်/ရေ ပက်, အငွေ့, အနားသတ် စတာတွေက reading ကို ထိခိုက်စေနိုင်။ ဖတ်ချက်များစွာ ပျမ်းမျှ ယူ, filter လုပ်ခြင်းက တည်ငြိမ်စေသည်။"],
  ]),
  rd("elec-oled-display", "OLED / LCD Display", "ကိန်းဂဏန်း/စာ ပြသတဲ့ screen။", 7, "OLED display arduino I2C tutorial", [
    ["display အမျိုးအစား", "OLED (I2C, သေး, ကြည်, backlight မလို) နဲ့ character LCD (16×2, ဈေးသက်သာ) က IoT project မှာ status ပြရာမှာ အသုံးများ။ TFT က အရောင်ပါ။"],
    ["I2C OLED", "0.96\" OLED က I2C ၂ ချောင်း (SDA, SCL) နဲ့ ချိတ်ရုံ — library (Adafruit SSD1306) နဲ့ စာ, ဂဏန်း, ရိုးရှင်းတဲ့ ဂရပ် ပြနိုင်။"],
    ["farm", "sensor reading (အပူ, စိုထိုင်း, pH), pump status, WiFi ချိတ်မချိတ်ကို field မှာ တိုက်ရိုက် ပြ — ဖုန်း/dashboard မကြည့်ဘဲ ချက်ချင်း သိစေ။"],
  ]),
  rd("elec-sd-logging", "SD Card Data Logging", "sensor data ကို ဖိုင်ထဲ မှတ်တမ်းတင်ခြင်း။", 8, "arduino SD card data logging tutorial", [
    ["ဘာကြောင့် log", "WiFi မရှိတဲ့/ကွာဝေးတဲ့ နေရာမှာ sensor data ကို SD card ထဲ CSV အဖြစ် သိမ်း၍ နောက်မှ ကွန်ပျူတာနဲ့ ဖတ်, chart ဆွဲနိုင်။ offline data logger။"],
    ["RTC နဲ့ တွဲ", "reading တစ်ခုစီမှာ အချိန်တံဆိပ် လိုလို့ RTC (real-time clock) module နဲ့ တွဲသုံးသည် — 'ဘယ်အချိန် ဘယ်လောက်' မှတ်ရန်။"],
    ["SPI ချိတ်", "SD card module က SPI bus သုံးသည်။ CSV format (comma-separated) နဲ့ ရေးထားရင် Excel/pandas နဲ့ လွယ်လွယ် ဖတ်၊ ခွဲခြမ်းစိတ်ဖြာနိုင်။"],
  ]),
  rd("elec-solar-power", "Solar Power for IoT", "နေရောင်ခြည်နဲ့ field sensor node မောင်းခြင်း။", 9, "solar powered arduino iot project", [
    ["ဘာကြောင့် solar", "field ထဲ, ကွာဝေးတဲ့ နေရာမှာ လျှပ်စစ်လိုင်း မရှိ။ solar panel + battery နဲ့ sensor node ကို ကိုယ်ပိုင် ပါဝါနဲ့ မောင်းနိုင် — မြန်မာ့ ကျေးလက် စိုက်ခင်းအတွက် သင့်တော်။"],
    ["အစိတ်အပိုင်း", "solar panel → charge controller (battery ကာကွယ်) → Li-ion/LiFePO4 battery → boost/buck (voltage ချိန်) → ESP32။ deep sleep နဲ့ ပါဝါ ချွေတာ။"],
    ["deep sleep", "ESP32 ကို reading ကြားမှာ deep sleep (μA သာ သုံး) ထား, ခဏခဏ နိုးပြီး ဖတ်/ပို့ — battery ရက်များစွာ ခံစေသည်။ ပါဝါ budget တွက်ချက်မှု အရေးကြီး။"],
  ]),
  rd("elec-voltage-regulator", "Voltage Regulator", "တည်ငြိမ်တဲ့ ပါဝါ ပေးခြင်း။", 7, "voltage regulator linear buck boost", [
    ["ဘာကြောင့် လို", "battery voltage က အားကုန်လာရင် ကျ, motor မောင်းရင် ခုန်။ regulator က input ကွဲပြားလည်း output ကို တည်ငြိမ် (ဥပမာ 3.3V/5V) ပေးသည် — board ကို ကာကွယ်။"],
    ["linear vs switching", "linear (AMS1117, 7805) — ရိုးရှင်း, ဈေးသက်သာ, ဒါပေမဲ့ ကျန်ဗို့ကို အပူအဖြစ် ဖျက်။ switching (buck/boost) — ထိရောက်မှုမြင့် (>90%), battery project အတွက် သင့်။"],
    ["buck vs boost", "buck က voltage လျှော့ (12V→5V), boost က မြှင့် (3.7V battery→5V)။ solar/battery IoT မှာ ဒီ converter တွေ မရှိမဖြစ်။"],
  ]),
  rd("elec-lora", "LoRa — ကွာဝေး ကြိုးမဲ့", "ကီလိုမီတာ အကွာ sensor data ပို့ခြင်း။", 9, "LoRa LoRaWAN explained iot", [
    ["LoRa ဆိုတာ", "LoRa က ပါဝါနည်း, အကွာဝေး (ဆေးလ်ကွင်း ~၂–၁၅ km) ကြိုးမဲ့ နည်းပညာ — WiFi မရောက်တဲ့ ကွာဝေး field sensor များအတွက် သင့်တော်။ data နှုန်း နည်းသည်။"],
    ["farm ဥပမာ", "စိုက်ခင်း အနှံ့ sensor node များကနေ moisture/အပူ data ကို LoRa နဲ့ gateway ဆီ ပို့, gateway က internet သို့ upload — WiFi/mobile signal မရှိတဲ့ ကျေးလက်အတွက် အကောင်းဆုံး။"],
    ["LoRaWAN", "LoRaWAN က LoRa အပေါ်က network protocol — gateway များ, server, device စီမံခန့်ခွဲမှု ပါ။ The Things Network လို အခမဲ့ community network များ ရှိသည်။"],
  ]),
  rd("elec-home-assistant", "Home Assistant / Node-RED", "IoT device များ ချိတ်ဆက်စီမံခြင်း။", 8, "home assistant node-red iot automation", [
    ["Home Assistant", "Home Assistant က open-source smart home platform — device များစွာ (MQTT, WiFi) ကို dashboard တစ်ခုမှာ စု, automation rule ဆွဲ, ဖုန်းက ထိန်းချုပ်။ Raspberry Pi မှာ run နိုင်။"],
    ["Node-RED", "Node-RED က 'flow' (block ဆွဲ) နဲ့ automation logic တည်ဆောက်တဲ့ tool — code မရေးဘဲ 'sensor A > 30 ဆို pump ဖွင့်' လို rule များ လွယ်လွယ် ဆွဲနိုင်။"],
    ["farm dashboard", "gwave ရဲ့ built-in farm/home dashboard နဲ့ ဆင်တူ — sensor data ပြ, rule/alert, remote control။ ဒီ tool များ နားလည်ခြင်းက ကိုယ်ပိုင် system ဆောက်ရာမှာ အထောက်အကူ။"],
  ]),
  rd("elec-ota", "OTA Firmware Update", "ကြိုးမချိတ်ဘဲ code update လုပ်ခြင်း။", 8, "ESP32 OTA update tutorial", [
    ["OTA ဆိုတာ", "OTA (Over-The-Air) update က device ကို ကြိုးဖြင့် မချိတ်ဘဲ WiFi ကနေ firmware update ပို့ခြင်း — field ထဲ, အမိုးပေါ်, ကွာဝေးတဲ့ node များအတွက် မရှိမဖြစ်။"],
    ["ဘာကြောင့် လို", "sensor node ဒါဇင်ချီ တပ်ထားရင် တစ်ခုချင်း ဖြုတ်, ကြိုးချိတ်, flash လုပ်တာ မဖြစ်နိုင်။ OTA နဲ့ အားလုံးကို တစ်ပြိုင်နက် remote update။"],
    ["သတိ", "update ကြားမှာ ပါဝါ ပြတ်ရင် device ပျက် (brick) နိုင်လို့ rollback/dual-partition စနစ် လိုသည်။ update ကို signature နဲ့ စစ်၍ လုံခြုံရေး ထားရမည်။"],
  ]),
  rd("elec-enclosure", "Weatherproof Enclosure", "field device ကို မိုး/နေ/ဖုန်မှ ကာကွယ်ခြင်း။", 7, "weatherproof electronics enclosure iot", [
    ["IP rating", "အပြင် (outdoor) device ကို enclosure ထဲ ထည့်ရသည်။ IP rating (ဥပမာ IP65) က ဖုန် (ပထမဂဏန်း) နဲ့ ရေ (ဒုတိယ) ခံနိုင်စွမ်း — IP65 = ဖုန်လုံး, ရေပက်ခံ။"],
    ["cable gland", "wire ဝင်တဲ့ အပေါက်ကို cable gland နဲ့ ပိတ်ရသည် — မဟုတ်ရင် ရေ/အင်း ဝင်။ ဆက်ရာနေရာများကို silicone/heat-shrink နဲ့ ကာကွယ်။"],
    ["အပူ + condensation", "နေပူထဲ enclosure အတွင်း အပူ တက်တတ်လို့ လေဝင်ပေါက် (breather) သို့ အရိပ်ထား။ ည အအေးမှာ အခိုးရည် (condensation) ဖြစ်နိုင်လို့ desiccant (silica gel) ထည့်ပါ။"],
  ]),
  rd("elec-esd-static", "Static (ESD) Protection", "လျှပ်စစ်ဓာတ်တိုး ဒဏ်မှ component ကာကွယ်ခြင်း။", 7, "ESD static electricity protection electronics", [
    ["ESD ဆိုတာ", "ESD (Electrostatic Discharge) က ကိုယ်ခန္ဓာ/အဝတ်က static ဓာတ် ရုတ်တရက် ကူးခြင်း — မမြင်ရ, မခံစားရပေမဲ့ IC, MOSFET, sensor တွေကို တိတ်တဆိတ် ဖျက်ဆီးနိုင်။"],
    ["ကာကွယ်နည်း", "component ကိုင်မီ metal ကို ထိ (ground)၊ anti-static wrist strap တပ်၊ IC ကို anti-static bag/foam မှာ သိမ်း၊ ခြောက်သွေ့/carpet ပေါ်မှာ မလုပ်။"],
    ["circuit protection", "input pin တွေမှာ TVS diode, series resistor တပ်ခြင်းက ESD/voltage spike ကနေ ကာကွယ်။ USB, sensor connector လို ပြင်ပ ချိတ်ဆက်မှုတွေမှာ အထူး အရေးကြီး။"],
  ]),
  rd("elec-project-soil-monitor", "Project — Soil Monitor", "သင်ယူထားသမျှ ပေါင်း၍ IoT node ဆောက်ခြင်း။", 11, "ESP32 soil moisture monitor project", [
    ["ဒီဇိုင်း", "ESP32 + moisture sensor + အပူ/စိုထိုင်း (DHT22) + OLED + solar/battery ပေါင်း၍ field soil monitor ဆောက်မယ်။ WiFi/LoRa နဲ့ data ပို့, OLED မှာ local ပြ။"],
    ["အဆင့်များ", "① sensor ဖတ် (ADC/I2C) ② OLED မှာ ပြ ③ MQTT/HTTP နဲ့ gwave dashboard ဆီ ပို့ ④ deep sleep နဲ့ battery ချွေတာ ⑤ weatherproof enclosure ထဲ ထည့်။"],
    ["တိုးချဲ့", "moisture နိမ့်ရင် pump ဖွင့် (relay/MOSFET), OTA update, SD card backup, node များစွာ + LoRa gateway — ဒီ project တစ်ခုက electronics/IoT သင်ခန်းစာ အားလုံးကို ချိတ်ဆက်ပေးသည်။"],
  ]),
];
