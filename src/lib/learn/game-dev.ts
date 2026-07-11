// Ultimate JavaScript Game Development Bootcamp — a runnable Canvas track for
// /learn. Every lesson opens in the HTML/CSS/JS playground with a live <canvas>
// demo the learner can edit and Run. Burmese-primary teaching, an SVG diagram
// on the first section, and a "watch on YouTube" query per lesson (audio
// read-aloud is provided globally by the lesson page). Pure data.

import type { Track } from "@/lib/learn/lessons";

const IMG = "/learn/gamedev";

// A canvas skeleton shared by every code lesson — learners edit the JS.
function canvas(js: string, w = 320, h = 200): { html: string; css: string; js: string } {
  return {
    html: `<canvas id="game" width="${w}" height="${h}"></canvas>`,
    css: "body{margin:0;background:#0f172a;display:grid;place-items:center;height:100vh}\ncanvas{background:#111827;border-radius:8px;box-shadow:0 4px 20px #0006}",
    js,
  };
}

export const gameDevTrack: Track = {
  slug: "game-dev",
  title: "JS Game Development Bootcamp",
  description:
    "အခြေခံကနေ ကိုယ်ပိုင် game engine အသေးစားတစ်ခု တည်ဆောက်နိုင်တဲ့အထိ — Canvas နဲ့ ဂိမ်း ၂ မျိုး လက်တွေ့ ရေးမယ်။",
  icon: "Gamepad2",
  bands: ["teen", "adult"],
  lessons: [
    {
      slug: "gamedev-intro",
      title: "Bootcamp Overview",
      summary: "ဒီသင်တန်းမှာ ဘာတွေ တည်ဆောက်မလဲ — engine ၄ အဆင့် + master project ၂ ခု။",
      minutes: 6,
      kind: "code",
      youtubeQuery: "javascript game development canvas tutorial for beginners",
      sections: [
        {
          heading: "ကိုယ်ပိုင် game engine ဆောက်ကြမယ်",
          body: "ဒီ bootcamp က library မသုံးဘဲ — browser ရဲ့ HTML5 Canvas နဲ့ JavaScript သက်သက်နဲ့ ဂိမ်း engine အသေးစားတစ်ခု အစအဆုံး တည်ဆောက်ပုံကို သင်ပေးမှာပါ။ အဆင့် ၄ ဆင့် — (1) Core Foundations (game loop, input, state), (2) Physics & Math (collision, velocity, gravity), (3) Graphics & Audio (sprite, parallax, sound, particle), (4) Architecture (pooling, tilemap, camera, save). နောက်ဆုံးမှာ ဒီအသိတွေ ပေါင်းစပ်ပြီး Master Project ၂ ခု — Top-Down Shooter နဲ့ 2D Platformer — ရေးရမှာပါ။",
          image: {
            src: `${IMG}/game-loop.svg`,
            alt: "The core update-render game loop",
            caption: "ဂိမ်းတိုင်းရဲ့ နှလုံးသား — update → render loop",
          },
        },
        {
          heading: "Canvas ဆိုတာ ဘာလဲ",
          body: "`<canvas>` က browser ထဲက ပုံဆွဲစရာ 'သင်ပုန်း' တစ်ခုပါ။ JavaScript ရဲ့ 2D context (`ctx`) နဲ့ လေးထောင့်၊ စက်ဝိုင်း၊ စာသား၊ ပုံ တွေ ဆွဲနိုင်ပါတယ်။ ဂိမ်းဆိုတာ — ဒီသင်ပုန်းကို frame တိုင်း ဖျက်၊ အသစ်ပြန်ဆွဲ၊ ဇာတ်ကောင်တွေ အနည်းငယ်စီ ရွှေ့ — ဒါကို မြန်မြန် (60fps) လုပ်လိုက်တာ ရုပ်ရှင်လို လှုပ်ရှားသွားတာပါ။ ညာဘက် playground မှာ Run နှိပ်ကြည့်ပါ — box လေး ရွေ့နေတာ တွေ့ရမယ်။",
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nlet x = 20;\nfunction loop() {\n  ctx.clearRect(0, 0, 320, 200);        // သင်ပုန်း ဖျက်\n  ctx.fillStyle = '#22d3ee';\n  ctx.fillRect(x, 90, 30, 30);          // box ဆွဲ\n  x = (x + 2) % 320;                    // ရွေ့\n  requestAnimationFrame(loop);          // ထပ်\n}\nloop();",
      ),
    },

    // ── Phase 1: Core Foundations ────────────────────────────────────────────
    {
      slug: "game-loop",
      title: "Phase 1 · The Game Loop",
      summary: "requestAnimationFrame နဲ့ 60 FPS နှလုံးခုန်နှုန်း တည်ဆောက်ခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "requestAnimationFrame game loop javascript",
      sections: [
        {
          heading: "update() နဲ့ render() ခွဲ",
          body: "ဂိမ်း loop ရဲ့ အလုပ် ၂ ခုပါ — **update()** က တွက်ချက်မှု (position, အခြေအနေ, AI) လုပ်တယ်၊ **render()** က ရလဒ်ကို canvas ပေါ် ဆွဲတယ်။ ဒီနှစ်ခုကို ခွဲထားတာ engine ကို ရှင်းရှင်းလင်းလင်း ဖြစ်စေတယ်။ browser ရဲ့ `requestAnimationFrame(loop)` က မျက်နှာပြင် refresh (ပုံမှန် ၆၀Hz) နဲ့ ကိုက်အောင် loop ကို ပြန်ခေါ်ပေးတာမို့ — ချောမွေ့ပြီး power သက်သာတယ်။ `setInterval` ထက် အမြဲ ပိုကောင်းတယ်။",
          image: {
            src: `${IMG}/game-loop.svg`,
            alt: "update then render, repeated by requestAnimationFrame",
            caption: "frame တိုင်း — update → render → requestAnimationFrame",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nconst player = { x: 40, y: 90, vx: 1.5 };\n\nfunction update() {\n  player.x += player.vx;\n  if (player.x < 0 || player.x > 290) player.vx *= -1; // နံရံ ခုန်\n}\nfunction render() {\n  ctx.clearRect(0, 0, 320, 200);\n  ctx.fillStyle = '#4ade80';\n  ctx.fillRect(player.x, player.y, 30, 30);\n}\nfunction loop() { update(); render(); requestAnimationFrame(loop); }\nloop();",
      ),
    },
    {
      slug: "delta-time",
      title: "Phase 1 · Delta Time",
      summary: "စက်အနှေး/အမြန် မတူညီလည်း ဂိမ်းမြန်နှုန်း တူညီစေရန်။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "delta time game loop explained",
      sections: [
        {
          heading: "အချိန်နဲ့ မြှောက်ပါ",
          body: "PC တစ်လုံးက ၁၂၀fps run နိုင်ပြီး၊ တစ်လုံးက ၃၀fps ဆိုရင် — frame တိုင်း အတိအကျ တန်ဖိုးတူ ပေါင်းရင် မြန်တဲ့စက်မှာ ဇာတ်ကောင် ၄ဆ မြန်သွားမယ်။ ဖြေရှင်းနည်းက **delta time (dt)** — frame ၂ ခုကြား ကုန်တဲ့ အချိန် (စက္ကန့်) ပါ။ ရွေ့လျားမှုကို `speed * dt` နဲ့ တွက်ရင် — frame ဘယ်လောက်မြန်မြန် တစ်စက္ကန့်မှာ တူညီ ခရီးရောက်တယ်။",
          image: {
            src: `${IMG}/delta-time.svg`,
            alt: "Same distance per second regardless of frame rate",
            caption: "x += speed * dt — frame မတူလည်း တစ်စက္ကန့် တူ",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nlet last = performance.now();\nlet x = 20;\nconst SPEED = 120; // pixels per second\n\nfunction loop(now) {\n  const dt = (now - last) / 1000; // စက္ကန့်\n  last = now;\n  x += SPEED * dt;                // အမြန်နှုန်း × အချိန်\n  if (x > 320) x = -30;\n  ctx.clearRect(0, 0, 320, 200);\n  ctx.fillStyle = '#f59e0b';\n  ctx.fillRect(x, 85, 30, 30);\n  requestAnimationFrame(loop);\n}\nrequestAnimationFrame(loop);",
      ),
    },
    {
      slug: "input-management",
      title: "Phase 1 · Input Management",
      summary: "Keyboard (WASD/Arrows) နှင့် Mouse ကို event listener ဖြင့် ဖမ်းယူခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript keyboard input game keys object",
      sections: [
        {
          heading: "keys state ကို object ထဲ မှတ်",
          body: "Event ထဲမှာ တိုက်ရိုက် ဇာတ်ကောင် ရွှေ့တာ မလုပ်သင့်ပါ — `keydown` က key ဖိထားစဉ် တစ်ကြိမ်တည်း fire ဖြစ်တတ်လို့ ချောမွေ့မှု ပျက်တယ်။ အစား — key ဖိ/လွှတ်ကို `keys` object ထဲ `true/false` မှတ်ထားပြီး၊ **update() loop ထဲမှာ** အဲ့ state ကို ဖတ်ပြီး ရွှေ့ပါ။ ဒါဆို key ၂ ခု တစ်ပြိုင်နက် (ဥပမာ တစ်ချိန်တည်း အပေါ်+ညာ) ဖိတာလည်း အဆင်ပြေတယ်။",
          image: {
            src: `${IMG}/input.svg`,
            alt: "keydown/keyup set a keys object read in the loop",
            caption: "event → keys{} မှတ် → loop ထဲ ဖတ်",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nconst keys = {};\naddEventListener('keydown', e => keys[e.key] = true);\naddEventListener('keyup',   e => keys[e.key] = false);\n\nconst p = { x: 145, y: 85, s: 3 };\nfunction loop() {\n  if (keys['ArrowLeft']  || keys['a']) p.x -= p.s;\n  if (keys['ArrowRight'] || keys['d']) p.x += p.s;\n  if (keys['ArrowUp']    || keys['w']) p.y -= p.s;\n  if (keys['ArrowDown']  || keys['s']) p.y += p.s;\n  ctx.clearRect(0, 0, 320, 200);\n  ctx.fillStyle = '#a78bfa';\n  ctx.fillRect(p.x, p.y, 30, 30);\n  requestAnimationFrame(loop);\n}\nloop();\n// canvas ကို click ပြီး WASD/arrow နှိပ်ကြည့်ပါ",
      ),
    },
    {
      slug: "state-machine",
      title: "Phase 1 · Game State Machine",
      summary: "Menu, Play, Pause, Game Over အခြေအနေများ ကူးပြောင်းခြင်း။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "game state machine menu play pause gameover",
      sections: [
        {
          heading: "state တစ်ခုချင်း သီးသန့်",
          body: "ဂိမ်းတစ်ခုမှာ Menu, Play, Pause, Game Over စတဲ့ အခြေအနေ (state) တွေ ရှိတယ်။ တစ်ခုချင်းစီအတွက် update/render ကွဲကွဲ ရေးပြီး၊ လက်ရှိ state ကို variable တစ်ခုနဲ့ မှတ်ထားရင် — code ရှုပ်ထွေးမှု အများကြီး လျော့တယ်။ if/else သို့ switch နဲ့ လက်ရှိ state အလိုက် သင့်တော်တဲ့ logic ကိုသာ run ပါ။",
          image: {
            src: `${IMG}/state-machine.svg`,
            alt: "Menu, Play, Pause and Game Over transitions",
            caption: "MENU → PLAY ⇄ PAUSE → GAME OVER",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nlet state = 'MENU';\naddEventListener('keydown', e => {\n  if (state === 'MENU' && e.key === 'Enter') state = 'PLAY';\n  else if (state === 'PLAY' && e.key === 'p') state = 'PAUSE';\n  else if (state === 'PAUSE' && e.key === 'p') state = 'PLAY';\n});\nfunction text(t, c) { ctx.fillStyle = c; ctx.font = '20px sans-serif';\n  ctx.textAlign = 'center'; ctx.fillText(t, 160, 105); }\nfunction loop() {\n  ctx.clearRect(0, 0, 320, 200);\n  if (state === 'MENU')  text('Enter နှိပ်ပါ', '#e2e8f0');\n  if (state === 'PLAY')  text('PLAY (p=pause)', '#4ade80');\n  if (state === 'PAUSE') text('PAUSE', '#f59e0b');\n  requestAnimationFrame(loop);\n}\nloop();\n// canvas click → Enter → p",
      ),
    },

    // ── Phase 2: Physics & Math ──────────────────────────────────────────────
    {
      slug: "aabb-collision",
      title: "Phase 2 · AABB Collision",
      summary: "လေးထောင့် ဇာတ်ကောင်များ ဝင်တိုက်ခြင်း ရှိ/မရှိ စစ်ဆေးခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "AABB collision detection javascript",
      sections: [
        {
          heading: "ဝင်ရိုး ၂ ခုစလုံး ထပ်မှ ထိ",
          body: "AABB (Axis-Aligned Bounding Box) က လေးထောင့် ၂ ခု ထပ်နေလား စစ်တဲ့ အမြန်ဆုံး နည်းပါ။ x-ဝင်ရိုးမှာ ထပ်ပြီး y-ဝင်ရိုးမှာလည်း ထပ်မှ — တကယ် ဝင်တိုက်တာ။ လေးချက် စစ်ရုံပါပဲ — မြန်ပြီး ဂိမ်းအများစုမှာ လုံလောက်တယ်။",
          image: {
            src: `${IMG}/aabb.svg`,
            alt: "Two rectangles overlapping on both axes",
            caption: "x နဲ့ y ဝင်ရိုး နှစ်ခုစလုံး ထပ်မှ collision",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nconst a = { x: 40, y: 85, w: 40, h: 40, vx: 1.4 };\nconst b = { x: 200, y: 80, w: 50, h: 50 };\nfunction hit(a, b) {\n  return a.x < b.x + b.w && a.x + a.w > b.x &&\n         a.y < b.y + b.h && a.y + a.h > b.y;\n}\nfunction loop() {\n  a.x += a.vx;\n  if (a.x < 0 || a.x > 280) a.vx *= -1;\n  const h = hit(a, b);\n  ctx.clearRect(0, 0, 320, 200);\n  ctx.fillStyle = '#38bdf8'; ctx.fillRect(a.x, a.y, a.w, a.h);\n  ctx.fillStyle = h ? '#ef4444' : '#22c55e';\n  ctx.fillRect(b.x, b.y, b.w, b.h);\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "circle-collision",
      title: "Phase 2 · Circle Collision",
      summary: "Pythagorean theorem သုံး၍ စက်ဝိုင်း ၂ ခု အကွာအဝေး တိုင်းတာခြင်း။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "circle collision distance pythagorean javascript",
      sections: [
        {
          heading: "အကွာအဝေး vs radius ပေါင်း",
          body: "စက်ဝိုင်းအတွက် — အလယ်ချက် ၂ ခုကြား အကွာအဝေး (dist) ကို Pythagoras (√(dx²+dy²)) နဲ့ တွက်ပြီး၊ radius ၂ ခု ပေါင်းထက် နည်းရင် ထိတယ်။ ကျည်ဆန်၊ ball၊ round ဇာတ်ကောင်တွေအတွက် AABB ထက် ပိုတိကျတယ်။ (မြန်ချင်ရင် √ မတွက်ဘဲ dist² vs (r1+r2)² နှိုင်းလို့လည်း ရတယ်။)",
          image: {
            src: `${IMG}/circle-collision.svg`,
            alt: "Distance between centres versus sum of radii",
            caption: "dist < r1 + r2 → ထိ",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nconst a = { x: 60, y: 100, r: 26, vx: 1.6 };\nconst b = { x: 230, y: 100, r: 30 };\nfunction hit(a, b) {\n  const dx = a.x - b.x, dy = a.y - b.y;\n  return Math.hypot(dx, dy) < a.r + b.r;\n}\nfunction ball(o, c) { ctx.beginPath();\n  ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fillStyle = c; ctx.fill(); }\nfunction loop() {\n  a.x += a.vx;\n  if (a.x < a.r || a.x > 320 - a.r) a.vx *= -1;\n  ctx.clearRect(0, 0, 320, 200);\n  ball(a, '#38bdf8');\n  ball(b, hit(a, b) ? '#ef4444' : '#22c55e');\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "movement-logic",
      title: "Phase 2 · Movement (Velocity & Friction)",
      summary: "Velocity, Acceleration နှင့် Friction တွက်ချက်ခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "velocity acceleration friction game physics javascript",
      sections: [
        {
          heading: "အမြန်နှုန်း → အရှိန် → ပွတ်တိုက်",
          body: "တိကျတဲ့ လှုပ်ရှားမှုအတွက် position ကို တိုက်ရိုက် မပြောင်းဘဲ — **velocity** (vx, vy) ကို position ထဲ ပေါင်းတယ်။ key ဖိရင် **acceleration** နဲ့ velocity တိုးတယ်။ **friction** (velocity ကို 0.9 လို ကိန်းနဲ့ မြှောက်) က ဖြည်းဖြည်း ရပ်စေတယ် — ရေခဲပြင်ပေါ် လျှောသလို သဘာဝကျတဲ့ လှုပ်ရှားမှု ရတယ်။",
          image: {
            src: `${IMG}/vectors.svg`,
            alt: "Velocity, acceleration and friction vectors",
            caption: "vx += ax · vx *= 0.9 · x += vx",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nconst keys = {};\naddEventListener('keydown', e => keys[e.key] = true);\naddEventListener('keyup',   e => keys[e.key] = false);\nconst p = { x: 145, y: 85, vx: 0, vy: 0, a: 0.5, f: 0.9 };\nfunction loop() {\n  if (keys['ArrowLeft'])  p.vx -= p.a;\n  if (keys['ArrowRight']) p.vx += p.a;\n  if (keys['ArrowUp'])    p.vy -= p.a;\n  if (keys['ArrowDown'])  p.vy += p.a;\n  p.vx *= p.f; p.vy *= p.f;      // friction\n  p.x += p.vx; p.y += p.vy;      // velocity → position\n  ctx.clearRect(0, 0, 320, 200);\n  ctx.fillStyle = '#f472b6';\n  ctx.fillRect(p.x, p.y, 28, 28);\n  requestAnimationFrame(loop);\n}\nloop(); // canvas click → arrows (glide!)",
      ),
    },
    {
      slug: "gravity-jump",
      title: "Phase 2 · Gravity & Jumping",
      summary: "ဆွဲငင်အား (Gravity) နှင့် ခုန်ခြင်း (Jumping) သဘောတရားများ။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "gravity jump platformer physics javascript",
      sections: [
        {
          heading: "gravity အမြဲဆွဲ · jump တစ်ချက်တွန်း",
          body: "Platformer ရဲ့ အနှစ်သာရ — **gravity** က frame တိုင်း vy ကို အနည်းငယ်စီ တိုးပေး (အောက်ဆွဲ) တယ်။ **jump** က ကြမ်းပြင်ပေါ်ရှိစဉ် vy ကို အနုတ် (အပေါ်) တစ်ချက် ပေးလိုက်တာပါ — gravity က ပြန်ဆွဲချတဲ့အထိ အထက်တက်ပြီး ပြန်ကျတယ်။ ကြမ်းပြင်ထိရင် vy=0 ပြန်ထား၊ ခုန်ခွင့် ပြန်ပေး။",
          image: {
            src: `${IMG}/gravity-jump.svg`,
            alt: "Jump gives upward velocity, gravity pulls down",
            caption: "vy += G (ဆွဲ) · jump = vy negative (တွန်း)",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nconst G = 0.6, GROUND = 160;\nconst p = { x: 150, y: GROUND, vy: 0, onGround: true };\naddEventListener('keydown', e => {\n  if (e.key === ' ' && p.onGround) { p.vy = -11; p.onGround = false; }\n});\nfunction loop() {\n  p.vy += G;              // gravity\n  p.y  += p.vy;\n  if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.onGround = true; }\n  ctx.clearRect(0, 0, 320, 200);\n  ctx.fillStyle = '#334155'; ctx.fillRect(0, GROUND + 30, 320, 10);\n  ctx.fillStyle = '#fbbf24'; ctx.fillRect(p.x, p.y, 30, 30);\n  requestAnimationFrame(loop);\n}\nloop(); // canvas click → Space to jump",
      ),
    },

    // ── Phase 3: Graphics & Audio ────────────────────────────────────────────
    {
      slug: "sprite-animation",
      title: "Phase 3 · Sprite Animation",
      summary: "Sprite sheet မှ frame များ ဖြတ်ယူ၍ frame-by-frame animation။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "sprite sheet animation canvas drawImage",
      sections: [
        {
          heading: "sheet ကနေ frame ဖြတ်ပြ",
          body: "ဇာတ်ကောင် လှုပ်ရှားပုံကို ပုံ တစ်ချပ် (sprite sheet) ထဲ frame အများ ဘေးချင်းယှဉ် ထားတယ်။ `drawImage` ရဲ့ ရှည်တဲ့ ဗားရှင်း — source ထဲက ဘယ်နေရာ (fx*w) ကို ဖြတ်ယူပြီး canvas ပေါ် ဘယ်နေရာ ဆွဲမလဲ ပြောလို့ရတယ်။ frame index ကို အချိန်နဲ့ တိုးသွားရင် — လမ်းလျှောက်/ပြေးပုံ ရွေ့လာတယ်။ (ဒီ demo မှာ ပုံမလိုဘဲ canvas နဲ့ frame ၄ ခု ဆွဲပြထားပါတယ်။)",
          image: {
            src: `${IMG}/sprite-sheet.svg`,
            alt: "Extracting one frame from a sprite sheet",
            caption: "drawImage(sheet, fx*w, 0, w, h, x, y, w, h)",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nconst colors = ['#22c55e','#4ade80','#16a34a','#4ade80'];\nlet frame = 0, timer = 0;\nfunction loop() {\n  timer++;\n  if (timer % 12 === 0) frame = (frame + 1) % 4; // frame ပြောင်း\n  ctx.clearRect(0, 0, 320, 200);\n  // frame index အလိုက် အသွင်ပြောင်း (walk cycle အတု)\n  ctx.fillStyle = colors[frame];\n  const legs = frame % 2 === 0 ? 0 : 8;\n  ctx.fillRect(140, 70, 40, 50);\n  ctx.fillRect(140, 120, 12, 20 + legs);\n  ctx.fillRect(168, 120, 12, 28 - legs);\n  ctx.fillStyle = '#e2e8f0'; ctx.font = '12px sans-serif';\n  ctx.fillText('frame ' + frame, 130, 150);\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "parallax",
      title: "Phase 3 · Parallax Backgrounds",
      summary: "နောက်ခံ အလွှာများကို အနှေး/အမြန် မတူ ရွှေ့၍ အနက် (depth) ဖန်တီးခြင်း။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "parallax scrolling background canvas game",
      sections: [
        {
          heading: "အနီးက မြန် · အဝေးက နှေး",
          body: "Parallax က အလွှာ (layer) မျိုးစုံကို မတူညီတဲ့ အမြန်နှုန်းနဲ့ ရွှေ့တာပါ — အနီးဆုံး ကြမ်းပြင် အမြန်ဆုံး၊ အလယ် သစ်ပင် အလယ်အလတ်၊ အဝေးဆုံး တိမ်/တောင် အနှေးဆုံး။ ဒါက ၂ဖက်မြင် ဂိမ်းမှာ 3D ဆန်တဲ့ အနက် ခံစားမှု ဖန်တီးပေးတယ်။",
          image: {
            src: `${IMG}/parallax.svg`,
            alt: "Background layers scrolling at different speeds",
            caption: "far ×0.2 · mid ×0.5 · near ×1.0",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nlet t = 0;\nfunction layer(y, h, speed, color) {\n  const off = (t * speed) % 340;\n  ctx.fillStyle = color;\n  for (let x = -off; x < 320; x += 60) ctx.fillRect(x, y, 40, h);\n}\nfunction loop() {\n  t += 2;\n  ctx.clearRect(0, 0, 320, 200);\n  layer(40, 30, 0.2, '#1e3a8a');  // far — နှေး\n  layer(90, 40, 0.5, '#15803d');  // mid\n  layer(150, 40, 1.0, '#a16207'); // near — မြန်\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "audio-api",
      title: "Phase 3 · Web Audio API",
      summary: "နောက်ခံတေးဂီတ (BGM) နှင့် အထူးပြုအသံများ (SFX) ထည့်သွင်းခြင်း။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "web audio api game sound effects javascript",
      sections: [
        {
          heading: "AudioContext နဲ့ အသံ ထုတ်",
          body: "Web Audio API က browser ထဲမှာ အသံ ဖန်တီး/ဖွင့်စရာ စနစ်ပါ။ ဂိမ်းမှာ — နောက်ခံတေး (BGM) loop နဲ့ ဖွင့်၊ ဖြစ်ရပ် (ခုန်, ပစ်, သေ) အလိုက် အသံတို (SFX) ဖွင့်တယ်။ browser က user တစ်ချက် click/keypress ပြီးမှ audio ခွင့်ပြုတာမို့ — ပထမဆုံး ခလုတ်နဲ့ AudioContext ကို 'resume' လုပ်ရတယ်။ ဒီ demo မှာ oscillator နဲ့ 'beep' တစ်ချက် ထုတ်ပြထားတယ်။",
          image: {
            src: `${IMG}/audio.svg`,
            alt: "AudioContext playing BGM and SFX",
            caption: "load → decode → play · user click ပြီးမှ",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nlet ac;\nfunction beep(freq) {\n  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();\n  const o = ac.createOscillator(), g = ac.createGain();\n  o.frequency.value = freq; o.connect(g); g.connect(ac.destination);\n  g.gain.setValueAtTime(0.2, ac.currentTime);\n  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);\n  o.start(); o.stop(ac.currentTime + 0.2);\n}\ndocument.getElementById('game').onclick = () => beep(660);\nctx.fillStyle = '#e2e8f0'; ctx.font = '16px sans-serif';\nctx.textAlign = 'center';\nctx.fillText('canvas ကို click → beep 🔊', 160, 105);",
      ),
    },
    {
      slug: "particles",
      title: "Phase 3 · Particle Systems",
      summary: "Array သုံး၍ ပေါက်ကွဲမှု၊ မီးခိုး၊ မိုး စသည့် effect များ ဖန်တီးခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "particle system explosion canvas javascript",
      sections: [
        {
          heading: "အမှုန်လေး အများ = effect",
          body: "Particle system က အမှုန်လေး (particle) အများကို array ထဲ ထားပြီး တစ်ခုချင်း update/render လုပ်တာပါ။ particle တစ်ခုစီမှာ position, velocity, life (သက်တမ်း) ရှိတယ်။ frame တိုင်း ရွှေ့၊ life လျှော့၊ life ကုန်ရင် ဖျက်။ ဒါနဲ့ ပေါက်ကွဲမှု၊ မီးခိုး၊ မိုး၊ မီးပွား စတဲ့ effect တွေ ရတယ်။ canvas ကို click ပြီး ပေါက်ကွဲမှု ကြည့်ပါ။",
          image: {
            src: `${IMG}/particles.svg`,
            alt: "An array of particles exploding outward",
            caption: "push{x,y,vx,vy,life} · life ကုန် → ဖျက်",
          },
        },
      ],
      code: canvas(
        "const cv = document.getElementById('game'), ctx = cv.getContext('2d');\nlet ps = [];\nfunction boom(x, y) {\n  for (let i = 0; i < 40; i++) {\n    const a = Math.random() * 7, s = 1 + Math.random() * 4;\n    ps.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 1 });\n  }\n}\ncv.onclick = e => boom(e.offsetX, e.offsetY);\nfunction loop() {\n  ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, 320, 200);\n  ps = ps.filter(p => p.life > 0);\n  for (const p of ps) {\n    p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 0.02;\n    ctx.globalAlpha = p.life;\n    ctx.fillStyle = '#f97316';\n    ctx.fillRect(p.x, p.y, 3, 3);\n  }\n  ctx.globalAlpha = 1;\n  requestAnimationFrame(loop);\n}\nloop(); // canvas click 💥",
      ),
    },

    // ── Phase 4: Architecture & Optimization ─────────────────────────────────
    {
      slug: "object-pooling",
      title: "Phase 4 · Object Pooling",
      summary: "ကျည်ဆန်/ရန်သူများကို ပြန်သုံး၍ memory နှင့် GC သက်သာစေခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "object pooling game optimization javascript",
      sections: [
        {
          heading: "အသစ်မလုပ်ဘဲ ပြန်သုံး",
          body: "ကျည်ဆန် သို့ ရန်သူ ထောင်ချီ တစ်ခါတည်း ဖန်တီး/ဖျက်ရင် — JavaScript ရဲ့ garbage collector (GC) မကြာခဏ အလုပ်လုပ်ရပြီး ဂိမ်း တုန့်ဆိုင်းတယ်။ **Object pool** — object အုပ်စု တစ်ခု ကြိုဆောက်ထားပြီး၊ လိုတဲ့အခါ 'idle' တစ်ခုကို 'active' လုပ်၊ သေရင် 'active=false' ပြန်ထား (ဖျက်စရာမလို)။ ဒါက performance ကို သိသိသာသာ တိုးစေတယ်။",
          image: {
            src: `${IMG}/object-pool.svg`,
            alt: "Reusing inactive objects instead of creating new ones",
            caption: "active ↔ idle — ဖျက်စရာမလို, GC သက်သာ",
          },
        },
      ],
      code: canvas(
        "const cv = document.getElementById('game'), ctx = cv.getContext('2d');\nconst pool = Array.from({ length: 60 }, () => ({ active: false, x:0, y:0, vx:0 }));\nfunction spawn(x, y) {\n  const b = pool.find(p => !p.active); // idle တစ်ခု ရှာ\n  if (b) { b.active = true; b.x = x; b.y = y; b.vx = 3; }\n}\ncv.onclick = e => spawn(e.offsetX, e.offsetY);\nfunction loop() {\n  ctx.clearRect(0, 0, 320, 200);\n  let n = 0;\n  for (const b of pool) {\n    if (!b.active) continue;\n    b.x += b.vx; n++;\n    if (b.x > 320) b.active = false; // ဖျက်မဲ့အစား ပြန်သုံးဖို့\n    ctx.fillStyle = '#facc15'; ctx.fillRect(b.x, b.y, 8, 3);\n  }\n  ctx.fillStyle = '#e2e8f0'; ctx.font = '12px sans-serif';\n  ctx.fillText('active: ' + n + ' / pool 60', 8, 16);\n  requestAnimationFrame(loop);\n}\nloop(); // click ပြီး ကျည် ပစ်",
      ),
    },
    {
      slug: "tilemap",
      title: "Phase 4 · Tile-based Mapping",
      summary: "2D Array ဖြင့် ဂိမ်းမြေပုံ (Level) များ ဖန်တီးခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "tile map 2d array game level javascript",
      sections: [
        {
          heading: "ဂဏန်း array = မြေပုံ",
          body: "Level ကြီးတွေကို ဇာတ်ကောင် တစ်ခုချင်း လက်နဲ့ နေရာချစရာ မလိုပါ — **2D array** (ဂဏန်း grid) နဲ့ ဖော်ပြတယ်။ 1=အုတ်ခဲ, 0=ဟာ, 2=item စသဖြင့်။ loop နဲ့ array ကို ဖြတ်ပြီး ဂဏန်းအလိုက် tile ဆွဲရုံပါ။ ဒါက level ဖန်တီး/တည်းဖြတ်/သိမ်း လွယ်စေပြီး၊ collision စစ်ရာမှာလည်း အသုံးဝင်တယ်။",
          image: {
            src: `${IMG}/tilemap.svg`,
            alt: "A 2D number array rendered as a tile grid",
            caption: "1=အုတ် · 0=ဟာ · 2=item → grid",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nconst T = 20;\nconst map = [\n  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],\n  [1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,1],\n  [1,0,0,1,1,0,0,0,0,0,0,1,1,0,0,1],\n  [1,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1],\n  [1,0,1,1,0,0,1,1,1,0,0,1,0,0,0,1],\n  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],\n  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],\n];\nctx.clearRect(0, 0, 320, 200);\nfor (let r = 0; r < map.length; r++)\n  for (let c = 0; c < map[r].length; c++) {\n    const t = map[r][c];\n    ctx.fillStyle = t === 1 ? '#92400e' : t === 2 ? '#facc15' : '#1e293b';\n    ctx.fillRect(c*T, r*T, T-1, T-1);\n  }\n// map array ကို ပြင်ပြီး Run — level ပြောင်း",
      ),
    },
    {
      slug: "camera-system",
      title: "Phase 4 · Camera System",
      summary: "ဇာတ်ကောင်နောက် လိုက်ပါသည့် ကင်မရာ စနစ် ရေးဆွဲခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "2d camera follow player canvas javascript",
      sections: [
        {
          heading: "ကမ္ဘာကို ရွှေ့ · player အလယ်",
          body: "ဂိမ်းကမ္ဘာက screen ထက် ကျယ်တဲ့အခါ — **camera** က player ကို screen အလယ်မှာ ထားပြီး ကျန်ကမ္ဘာကို ဆန့်ကျင်ဘက် ရွှေ့ပြတယ်။ `ctx.translate(-cam.x, -cam.y)` နဲ့ ဆွဲမှုအားလုံးကို ရွှေ့လိုက်ရုံပါ။ cam.x ကို player.x − screenWidth/2 နဲ့ တွက်တယ်။ ဒါက platformer/RPG တိုင်းမှာ မရှိမဖြစ်ပါ။",
          image: {
            src: `${IMG}/camera.svg`,
            alt: "Viewport following the player across a wide world",
            caption: "cam.x = player.x − screenW/2 · translate",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nconst keys = {};\naddEventListener('keydown', e => keys[e.key] = true);\naddEventListener('keyup',   e => keys[e.key] = false);\nconst WORLD = 900;\nconst p = { x: 100, y: 120, s: 4 };\nfunction loop() {\n  if (keys['ArrowLeft'])  p.x = Math.max(0, p.x - p.s);\n  if (keys['ArrowRight']) p.x = Math.min(WORLD, p.x + p.s);\n  const cam = Math.max(0, Math.min(WORLD - 320, p.x - 160));\n  ctx.clearRect(0, 0, 320, 200);\n  ctx.save(); ctx.translate(-cam, 0);\n  for (let x = 0; x < WORLD; x += 100) { // ကမ္ဘာ landmark\n    ctx.fillStyle = '#334155'; ctx.fillRect(x, 150, 60, 30);\n    ctx.fillStyle = '#475569'; ctx.fillText((x/100)|0, x, 145);\n  }\n  ctx.fillStyle = '#22d3ee'; ctx.fillRect(p.x, p.y, 24, 30);\n  ctx.restore();\n  requestAnimationFrame(loop);\n}\nloop(); // canvas click → arrows",
      ),
    },
    {
      slug: "data-persistence",
      title: "Phase 4 · Data Persistence",
      summary: "Local Storage သုံး၍ High Score, Progress, Settings သိမ်းဆည်းခြင်း။",
      minutes: 8,
      kind: "code",
      youtubeQuery: "localstorage high score save game javascript",
      sections: [
        {
          heading: "localStorage နဲ့ သိမ်း",
          body: "Browser ရဲ့ **localStorage** က key-value သိမ်းစရာပါ — page ပိတ်/ပြန်ဖွင့်လည်း ကျန်နေတယ်။ High score, level progress, settings (အသံ on/off) တွေ သိမ်းဖို့ အသင့်တော်ဆုံး။ object တွေ သိမ်းရင် `JSON.stringify` နဲ့ string ပြောင်း၊ ဖတ်ရင် `JSON.parse`။ (server မလို — device ပေါ်တင် သိမ်း။)",
          image: {
            src: `${IMG}/state-machine.svg`,
            alt: "Saving game data locally",
            caption: "localStorage — page ပိတ်လည်း high score ကျန်",
          },
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nlet high = Number(localStorage.getItem('hi') || 0);\nlet score = 0;\ndocument.getElementById('game').onclick = () => {\n  score += Math.floor(Math.random() * 50);\n  if (score > high) { high = score; localStorage.setItem('hi', high); }\n};\nfunction loop() {\n  ctx.clearRect(0, 0, 320, 200);\n  ctx.fillStyle = '#e2e8f0'; ctx.font = '16px sans-serif';\n  ctx.textAlign = 'center';\n  ctx.fillText('Score: ' + score, 160, 80);\n  ctx.fillStyle = '#facc15';\n  ctx.fillText('High: ' + high + ' (saved)', 160, 115);\n  ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif';\n  ctx.fillText('click = +score · reload ကြည့်ပါ', 160, 150);\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },

    {
      slug: "touch-controls",
      title: "Phase 4 · Touch & Mobile Controls",
      summary: "Touch event နှင့် virtual joystick — ဖုန်းမှာ ကစားနိုင်အောင်။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript touch controls virtual joystick canvas game",
      sections: [
        {
          heading: "keyboard မရှိတဲ့ device အတွက်",
          body: "ကစားသူ အများစုက ဖုန်းနဲ့ ကစားကြတယ် — keyboard မရှိဘူး။ `touchstart`, `touchmove`, `touchend` event တွေက touch ကို ဖမ်းပေးတယ်။ `e.touches` array က လက်ချောင်း အများ (multi-touch) ကို ထောက်ပံ့တယ် — ဘယ်လက်နဲ့ ရွေ့ရင်း ညာလက်နဲ့ ပစ်လို့ရတယ်။ ပုံမှန် pattern — screen ဘယ်ခြမ်းမှာ **virtual joystick** (ထိတဲ့နေရာနဲ့ ဆွဲတဲ့နေရာကြား vector = direction)၊ ညာခြမ်းမှာ ခလုတ်။ mouse ရော touch ရော နှစ်မျိုးလုံး ထောက်ပံ့ရင် — device တိုင်း ကစားနိုင်တယ်။",
          image: {
            src: `${IMG}/touch-controls.svg`,
            alt: "Virtual joystick and buttons on a phone screen",
            caption: "ဘယ် joystick · ညာ ခလုတ် — e.touches[i]",
          },
        },
      ],
      code: canvas(
        "const cv = document.getElementById('game'), ctx = cv.getContext('2d');\nconst p = { x: 160, y: 100 };\nlet stick = null; // {sx,sy,dx,dy}\nfunction pos(e) {\n  const r = cv.getBoundingClientRect();\n  const t = e.touches ? e.touches[0] : e;\n  return { x: t.clientX - r.left, y: t.clientY - r.top };\n}\nfunction start(e) { e.preventDefault(); const q = pos(e);\n  stick = { sx: q.x, sy: q.y, dx: 0, dy: 0 }; }\nfunction move(e)  { if (!stick) return; e.preventDefault(); const q = pos(e);\n  stick.dx = (q.x - stick.sx) / 30; stick.dy = (q.y - stick.sy) / 30; }\nfunction end()    { stick = null; }\n// touch + mouse နှစ်မျိုးလုံး\ncv.addEventListener('touchstart', start); cv.addEventListener('mousedown', start);\ncv.addEventListener('touchmove', move);   cv.addEventListener('mousemove', move);\ncv.addEventListener('touchend', end);     cv.addEventListener('mouseup', end);\nfunction loop() {\n  if (stick) {\n    p.x = Math.max(10, Math.min(310, p.x + stick.dx));\n    p.y = Math.max(10, Math.min(190, p.y + stick.dy));\n  }\n  ctx.clearRect(0, 0, 320, 200);\n  if (stick) { // joystick ဆွဲပြ\n    ctx.strokeStyle = '#475569';\n    ctx.beginPath(); ctx.arc(stick.sx, stick.sy, 24, 0, 7); ctx.stroke();\n    ctx.fillStyle = '#38bdf8';\n    ctx.beginPath();\n    ctx.arc(stick.sx + stick.dx*8, stick.sy + stick.dy*8, 10, 0, 7); ctx.fill();\n  }\n  ctx.fillStyle = '#4ade80'; ctx.fillRect(p.x - 10, p.y - 10, 20, 20);\n  requestAnimationFrame(loop);\n}\nloop(); // canvas ကို ဖိဆွဲ (touch/mouse) — joystick",
      ),
    },

    // ── Master Projects ──────────────────────────────────────────────────────
    {
      slug: "project-topdown",
      title: "Master Project 1 · Top-Down Shooter",
      summary: "အပေါ်စီးရှုထောင့် · 360° ရွေ့ · friction · ရန်သူ AI · ကျည် pooling။",
      minutes: 16,
      kind: "code",
      youtubeQuery: "top down shooter game javascript canvas tutorial",
      sections: [
        {
          heading: "Phase အားလုံး ပေါင်းစပ်",
          body: "ပထမ project က **Top-Down Shooter** ပါ — အပေါ်စီးမှ မြင်ရပြီး (bird-eye view)၊ player က X+Y ဝင်ရိုး ၃၆၀° ရွေ့နိုင်တယ်။ velocity+friction (Phase 2) နဲ့ ချောမွေ့ ရွေ့၊ ကျည်ဆန်တွေ object pool (Phase 4) ကနေ ထုတ်၊ ရန်သူတွေ player ဆီ **လိုက်လာတဲ့ AI** — player ဆီ ဦးတည်တဲ့ vector နဲ့ ရွေ့ — circle collision (Phase 2) နဲ့ ထိမှု စစ်တယ်။",
          image: {
            src: `${IMG}/project-topdown.svg`,
            alt: "Top-down shooter combining all phases",
            caption: "360° ရွေ့ · ရန်သူ AI လိုက် · ကျည် pool + circle hit",
          },
        },
        {
          heading: "စမ်းကစားပါ",
          body: "ညာဘက် playground မှာ Run နှိပ်ပါ — canvas ကို click ပြီး WASD နဲ့ ရွေ့၊ mouse ဆီ ကျည် အလိုအလျောက် ပစ်ပါ။ ရန်သူ (အနီ) တွေ သင့်ဆီ လိုက်လာပြီး၊ ကျည်နဲ့ ထိရင် ပျောက်တယ်။ code ကို ဖတ်ပြီး — ရန်သူ အမြန်နှုန်း၊ ကျည်နှုန်း၊ spawn ကြားချိန် တွေ ပြောင်းစမ်းပါ။",
        },
      ],
      code: canvas(
        "const cv = document.getElementById('game'), ctx = cv.getContext('2d');\nconst keys = {}; let mx = 160, my = 100;\naddEventListener('keydown', e => keys[e.key] = true);\naddEventListener('keyup',   e => keys[e.key] = false);\ncv.onmousemove = e => { mx = e.offsetX; my = e.offsetY; };\nconst p = { x: 160, y: 100, vx: 0, vy: 0 };\nconst bullets = Array.from({length: 40}, () => ({ active: false }));\nlet enemies = [], t = 0;\nfunction shoot() {\n  const b = bullets.find(b => !b.active); if (!b) return;\n  const a = Math.atan2(my - p.y, mx - p.x);\n  b.active = true; b.x = p.x; b.y = p.y;\n  b.vx = Math.cos(a)*5; b.vy = Math.sin(a)*5;\n}\nfunction loop() {\n  t++;\n  if (keys['a']) p.vx -= 0.4; if (keys['d']) p.vx += 0.4;\n  if (keys['w']) p.vy -= 0.4; if (keys['s']) p.vy += 0.4;\n  p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx; p.y += p.vy;\n  if (t % 10 === 0) shoot();\n  if (t % 60 === 0) {\n    const e = Math.random()*7;\n    enemies.push({ x: 160+Math.cos(e)*200, y: 100+Math.sin(e)*160 });\n  }\n  for (const en of enemies) {\n    const a = Math.atan2(p.y - en.y, p.x - en.x);\n    en.x += Math.cos(a)*0.8; en.y += Math.sin(a)*0.8; // AI လိုက်\n  }\n  for (const b of bullets) {\n    if (!b.active) continue;\n    b.x += b.vx; b.y += b.vy;\n    if (b.x<0||b.x>320||b.y<0||b.y>200) b.active = false;\n    enemies = enemies.filter(en => {\n      if (Math.hypot(en.x-b.x, en.y-b.y) < 12) { b.active=false; return false; }\n      return true;\n    });\n  }\n  ctx.fillStyle = '#0f172a'; ctx.fillRect(0,0,320,200);\n  ctx.fillStyle = '#ef4444';\n  for (const en of enemies) { ctx.beginPath(); ctx.arc(en.x,en.y,9,0,7); ctx.fill(); }\n  ctx.fillStyle = '#facc15';\n  for (const b of bullets) if (b.active) ctx.fillRect(b.x-2,b.y-2,4,4);\n  ctx.fillStyle = '#22d3ee'; ctx.fillRect(p.x-10, p.y-10, 20, 20);\n  requestAnimationFrame(loop);\n}\nloop(); // click → WASD + mouse aim",
      ),
    },
    {
      slug: "project-platformer",
      title: "Master Project 2 · 2D Platformer",
      summary: "ဘေးတိုက်ရှုထောင့် · X ပြေး/Y ခုန် · gravity · platform collision · camera။",
      minutes: 16,
      kind: "code",
      youtubeQuery: "2d platformer game javascript canvas tutorial",
      sections: [
        {
          heading: "Mario-style platformer",
          body: "ဒုတိယ project က **2D Platformer** ပါ — ဘေးတိုက် မြင်ရ (side-scrolling)၊ player က X ဝင်ရိုး ပြေးပြီး Y ဝင်ရိုး ခုန်တယ်။ **gravity** (Phase 2) က အောက်ဆွဲ၊ platform တွေပေါ် **AABB collision** (Phase 2) နဲ့ မကျအောင် ရပ်၊ tilemap (Phase 4) နဲ့ level ဖွဲ့၊ **camera** (Phase 4) က player နောက် လိုက်တယ်။ ဒါက engine တစ်ခုလုံး လက်တွေ့ အသုံးချတဲ့ project ပါ။",
          image: {
            src: `${IMG}/project-platformer.svg`,
            alt: "Side-scrolling platformer combining all phases",
            caption: "X ပြေး · Y ခုန် · gravity · platform collision · camera",
          },
        },
        {
          heading: "စမ်းကစားပါ",
          body: "Run နှိပ်ပြီး canvas ကို click ပါ — ← → နဲ့ ပြေး၊ Space နဲ့ ခုန်၊ platform တွေပေါ် ခုန်တက်ပါ။ camera က သင့်နောက် လိုက်လာတာ သတိထားပါ။ code ထဲက platforms array၊ gravity G၊ jump အား တွေ ပြောင်းပြီး ကိုယ်ပိုင် level ဆောက်ကြည့်ပါ။",
        },
      ],
      code: canvas(
        "const ctx = document.getElementById('game').getContext('2d');\nconst keys = {};\naddEventListener('keydown', e => keys[e.key] = true);\naddEventListener('keyup',   e => keys[e.key] = false);\nconst G = 0.6;\nconst plats = [ {x:0,y:180,w:400,h:20}, {x:120,y:140,w:70,h:12},\n  {x:240,y:110,w:70,h:12}, {x:380,y:150,w:90,h:12},\n  {x:520,y:120,w:80,h:12}, {x:640,y:170,w:200,h:20} ];\nconst p = { x: 20, y: 150, w: 22, h: 28, vx: 0, vy: 0, onGround: false };\nfunction loop() {\n  if (keys['ArrowLeft'])  p.vx = -3;\n  else if (keys['ArrowRight']) p.vx = 3; else p.vx = 0;\n  if (keys[' '] && p.onGround) { p.vy = -11; p.onGround = false; }\n  p.vy += G; p.x += p.vx; p.y += p.vy; p.onGround = false;\n  for (const t of plats) {\n    if (p.x < t.x+t.w && p.x+p.w > t.x &&\n        p.y+p.h > t.y && p.y+p.h < t.y+t.h+16 && p.vy >= 0) {\n      p.y = t.y - p.h; p.vy = 0; p.onGround = true; // platform ပေါ် ရပ်\n    }\n  }\n  if (p.y > 260) { p.x = 20; p.y = 150; p.vy = 0; } // ကျ → reset\n  const cam = Math.max(0, p.x - 140);\n  ctx.fillStyle = '#0f172a'; ctx.fillRect(0,0,320,200);\n  ctx.save(); ctx.translate(-cam, 0);\n  ctx.fillStyle = '#a16207';\n  for (const t of plats) ctx.fillRect(t.x, t.y, t.w, t.h);\n  ctx.fillStyle = '#22c55e'; ctx.fillRect(p.x, p.y, p.w, p.h);\n  ctx.restore();\n  requestAnimationFrame(loop);\n}\nloop(); // click → ← → run, Space jump",
      ),
    },

    {
      slug: "deployment",
      title: "Deployment — ဂိမ်း တင်ပြီး Share",
      summary: "GitHub Pages / Vercel မှာ တင်၍ သူငယ်ချင်းများဆီ link ပို့ခြင်း။",
      minutes: 9,
      kind: "reading",
      youtubeQuery: "deploy html game github pages vercel",
      sections: [
        {
          heading: "ဂိမ်းက static site — တင်ရ လွယ်",
          body: "Canvas ဂိမ်းက HTML + JS ဖိုင်တွေပဲ — server မလိုတဲ့ **static site** ဖြစ်လို့ အခမဲ့ hosting တွေမှာ တင်လို့ရတယ်။ ဖိုင်ဖွဲ့စည်းပုံ ရိုးရိုး — `index.html` (canvas tag ပါ), `game.js` (ဂိမ်း code), `assets/` (ပုံ/အသံ)။ index.html ထဲက `<script src=\"game.js\"></script>` နဲ့ ချိတ်ရုံပါ။",
          image: {
            src: `${IMG}/deployment.svg`,
            alt: "Game files to GitHub to Pages or Vercel",
            caption: "ဖိုင် → GitHub → Pages/Vercel → URL 🔗",
          },
        },
        {
          heading: "GitHub Pages — အဆင့် ၄ ဆင့်",
          body: "(၁) github.com မှာ repo အသစ် ဆောက် (ဥပမာ `my-game`)။ (၂) ဂိမ်းဖိုင်တွေ upload သို့ `git push`။ (၃) repo ရဲ့ **Settings → Pages** မှာ Source ကို `main` branch ရွေးပြီး Save။ (၄) မိနစ်အနည်းငယ်အတွင်း — `https://username.github.io/my-game/` မှာ ဂိမ်း live ဖြစ်သွားပြီ။ code ပြင်ပြီး push တိုင်း အလိုအလျောက် update ဖြစ်တယ်။",
          code: "# terminal ကနေ တင်နည်း\ngit init\ngit add index.html game.js assets/\ngit commit -m \"my first game\"\ngit remote add origin https://github.com/USER/my-game.git\ngit push -u origin main\n# ပြီးရင် — Settings → Pages → Source: main → Save",
        },
        {
          heading: "Vercel — drag & drop",
          body: "vercel.com မှာ account ဖွင့်ပြီး — **Add New Project** → GitHub repo ချိတ် (သို့ folder ကို drag-drop) → Deploy။ စက္ကန့်ပိုင်းအတွင်း `my-game.vercel.app` URL ရတယ်။ GitHub ချိတ်ထားရင် push တိုင်း auto-deploy။ ဖုန်းမှာ ကစားလို့ရအောင် — `<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">` ထည့်ပြီး touch controls (အရင် lesson) ပါ ထည့်ဖို့ မမေ့ပါနဲ့။ URL ရပြီဆို — messenger/social မှာ share ပြီး ကိုယ့်ဂိမ်းကို ကမ္ဘာက ကစားစေပါ! 🎉",
        },
      ],
    },

    // ── Final quiz ───────────────────────────────────────────────────────────
    {
      slug: "gamedev-quiz",
      title: "Bootcamp Quiz",
      summary: "Game loop, physics, graphics နဲ့ architecture — သင်ယူထားသမျှ စစ်ဆေးပါ။",
      minutes: 6,
      kind: "quiz",
      quiz: [
        {
          q: "ဂိမ်း loop အတွက် ဘယ်ဟာ အကောင်းဆုံးလဲ။",
          options: ["setInterval", "requestAnimationFrame", "while(true)", "setTimeout 0"],
          answer: 1,
          explain: "requestAnimationFrame က မျက်နှာပြင် refresh နဲ့ ကိုက်ညီ၊ ချောမွေ့ပြီး power သက်သာတယ်။",
        },
        {
          q: "Delta time (dt) ကို ဘာကြောင့် သုံးတာလဲ။",
          options: [
            "ပုံ ပိုလှအောင်",
            "စက်အမြန်နှုန်း မတူညီလည်း ဂိမ်းမြန်နှုန်း တူညီစေဖို့",
            "memory သက်သာဖို့",
            "အသံ ချောဖို့",
          ],
          answer: 1,
          explain: "speed × dt နဲ့ တွက်ရင် frame rate မတူလည်း တစ်စက္ကန့်မှာ တူညီ ခရီးရောက်တယ်။",
        },
        {
          q: "AABB collision မှာ ဘယ်နှစ်ဝင်ရိုး ထပ်မှ ထိတာလဲ။",
          options: ["x တစ်ခုတည်း", "y တစ်ခုတည်း", "x နဲ့ y နှစ်ခုစလုံး", "ဘယ်ဟာမှမလို"],
          answer: 2,
          explain: "x-ဝင်ရိုးမှာရော y-ဝင်ရိုးမှာပါ ထပ်မှသာ တကယ် ဝင်တိုက်တာ။",
        },
        {
          q: "Jump လုပ်ဖို့ velocity y (vy) ကို ဘာလုပ်ရမလဲ။",
          options: ["အပေါ် (negative) ပေး", "0 ထား", "အောက် (positive) ပေး", "မပြောင်း"],
          answer: 0,
          explain: "vy ကို အနုတ် ပေးရင် အပေါ်တက်ပြီး gravity က ပြန်ဆွဲချတယ်။",
        },
        {
          q: "Object pooling ရဲ့ အဓိက အကျိုးက ဘာလဲ။",
          options: [
            "ပုံ ပိုကြည်",
            "အသစ်ဖန်တီး/ဖျက်မြဲ မလုပ်ဘဲ ပြန်သုံး၍ GC/memory သက်သာ",
            "internet မလို",
            "code တို",
          ],
          answer: 1,
          explain: "object ပြန်သုံးရင် garbage collection လျော့ပြီး performance တိုးတယ်။",
        },
        {
          q: "High score ကို page ပိတ်လည်း ကျန်အောင် ဘယ်မှာ သိမ်းမလဲ။",
          options: ["variable ထဲ", "localStorage", "canvas ပေါ်", "array ထဲ"],
          answer: 1,
          explain: "localStorage က browser ထဲ တည်တံ့စွာ သိမ်းပေးတယ် — reload လည်း ကျန်တယ်။",
        },
        {
          q: "ဖုန်း touch ကို ဖမ်းဖို့ ဘယ် event တွေ သုံးလဲ။",
          options: [
            "keydown / keyup",
            "touchstart / touchmove / touchend",
            "click တစ်ခုတည်း",
            "scroll",
          ],
          answer: 1,
          explain: "touch event ၃ မျိုးနဲ့ ဖမ်းပြီး e.touches array က multi-touch ထောက်ပံ့တယ်။",
        },
        {
          q: "Canvas ဂိမ်းကို အခမဲ့ တင်ဖို့ ဘယ်ဟာ သင့်တော်လဲ။",
          options: [
            "database server ငှား",
            "GitHub Pages / Vercel (static hosting)",
            "USB နဲ့ ပေး",
            "မတင်နိုင်",
          ],
          answer: 1,
          explain: "HTML+JS ဖိုင်သက်သက်မို့ — static hosting မှာ အခမဲ့ တင်ပြီး URL share လို့ရတယ်။",
        },
      ],
    },
  ],
};
