"use strict";

/// Load test — bot များနဲ့ server ကို ဖိစမ်းတယ် (spec 6.2 / 13.4)။
///
/// ```bash
/// node loadtest.js                 # bot ၅၀, ၂၀ စက္ကန့်
/// BOTS=200 SECONDS=60 node loadtest.js
/// ```
///
/// ★ `npm test` ထဲ **မထည့်ဘူး** — ၂၀ စက္ကန့်ကြာပြီး CPU ကို ဖိသုံးတာမို့
///   CI မှာ run ရင် တခြား test တွေကို နှေးစေတယ်။ လိုတဲ့အခါ လက်နဲ့ run ရမယ်။
/// ★ CPU ကို `/proc/<pid>/stat` ကနေ တိုင်းတယ် — `top` က container ထဲမှာ
///   host တစ်ခုလုံးရဲ့ ကိန်းဂဏန်း ပြတတ်တယ်။

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const WebSocket = require("ws");

const BOTS = Number(process.env.BOTS || 50);
const SECONDS = Number(process.env.SECONDS || 20);
const PORT = Number(process.env.PORT || 18500);
const SEND_HZ = 15;

/// utime + stime (clock tick) — process ရဲ့ စုစုပေါင်း CPU အချိန်
function cpuTicks(pid) {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8");
  // comm မှာ space ပါနိုင်လို့ ')' နောက်ကနေ ဖြတ်ရတယ်
  const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return Number(rest[11]) + Number(rest[12]); // utime, stime
}

const HZ = 100; // Linux ရဲ့ ပုံမှန် USER_HZ

function rssMb(pid) {
  const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
  const m = /VmRSS:\s+(\d+) kB/.exec(status);
  return m ? Math.round(Number(m[1]) / 1024) : 0;
}

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    env: { ...process.env, PORT: String(PORT), REQUIRE_AUTH: "false" },
    stdio: "ignore",
  });
  const t0 = Date.now();
  await new Promise((res, rej) => {
    const tick = () =>
      fetch(`http://127.0.0.1:${PORT}/health`).then((r) => (r.ok ? res() : retry())).catch(retry);
    const retry = () => (Date.now() - t0 > 8000 ? rej(new Error("no start")) : setTimeout(tick, 150));
    tick();
  });

  console.log(`server pid ${server.pid} — connecting ${BOTS} bot(s)…`);
  const bots = [];
  for (let i = 0; i < BOTS; i++) {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/?room=city`);
    ws.on("error", () => {});
    bots.push({ ws, angle: (i / BOTS) * Math.PI * 2, r: 8 + (i % 12) * 3, in: 0 });
    ws.on("message", () => {
      const b = bots[i];
      if (b) b.in++;
    });
    // ★ တစ်ပြိုင်နက် မဖွင့်ဘူး — တကယ့် player တွေက တစ်ယောက်ချင်း ဝင်တာမို့
    await new Promise((r) => setTimeout(r, 8));
  }
  await new Promise((r) => setTimeout(r, 1500));

  const startTicks = cpuTicks(server.pid);
  const startAt = Date.now();
  let sent = 0;

  // ★ bot တစ်ကောင်စီ timer မထားဘူး — timer ၅၀ က test client ကိုယ်တိုင်ကို
  // ဖိပြီး တိုင်းတာချက် မမှန်တော့ဘူး။ timer တစ်ခုတည်းက အားလုံးကို ရွှေ့တယ်။
  const mover = setInterval(() => {
    const t = (Date.now() - startAt) / 1000;
    for (const b of bots) {
      if (b.ws.readyState !== 1) continue;
      const a = b.angle + t * 0.35;
      b.ws.send(
        JSON.stringify({
          type: "update",
          x: Math.cos(a) * b.r,
          y: 0,
          z: Math.sin(a) * b.r,
          ry: a,
        }),
      );
      sent++;
    }
  }, 1000 / SEND_HZ);

  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  clearInterval(mover);

  const usedTicks = cpuTicks(server.pid) - startTicks;
  const elapsed = (Date.now() - startAt) / 1000;
  const cpuPct = (usedTicks / HZ / elapsed) * 100;
  const health = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
  const received = bots.reduce((n, b) => n + b.in, 0);

  console.log("");
  console.log(`bots            ${BOTS}`);
  console.log(`duration        ${elapsed.toFixed(1)}s`);
  console.log(`players seen    ${health.players}`);
  console.log(`msgs sent       ${sent} (${Math.round(sent / elapsed)}/s)`);
  console.log(`msgs received   ${received} (${Math.round(received / elapsed)}/s)`);
  console.log(`server CPU      ${cpuPct.toFixed(1)}%  ${cpuPct < 60 ? "PASS (<60%)" : "FAIL"}`);
  console.log(`server RSS      ${rssMb(server.pid)} MB`);

  for (const b of bots) b.ws.close();
  server.kill("SIGTERM");
  process.exitCode = cpuPct < 60 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
