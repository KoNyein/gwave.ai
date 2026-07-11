// Advanced Canvas Graphics — a runnable graphics track for /learn, the sequel
// to the Game Dev Bootcamp. Each lesson opens a live <canvas> demo in the
// HTML/CSS/JS playground: transforms, gradients, curves, compositing, pixel
// manipulation, a mini physics engine, isometric projection and a real-time
// visualizer. Burmese-primary, an SVG diagram on the first section, and a
// per-lesson YouTube query (audio read-aloud is global). Pure data.

import type { Track } from "@/lib/learn/lessons";

const IMG = "/learn/advcanvas";

function canvas(js: string, w = 320, h = 200): { html: string; css: string; js: string } {
  return {
    html: `<canvas id="c" width="${w}" height="${h}"></canvas>`,
    css: "body{margin:0;background:#0f172a;display:grid;place-items:center;height:100vh}\ncanvas{background:#111827;border-radius:8px;box-shadow:0 4px 20px #0006}",
    js: "const cv = document.getElementById('c');\nconst ctx = cv.getContext('2d');\n\n" + js,
  };
}

export const advancedCanvasTrack: Track = {
  slug: "advanced-canvas",
  title: "Advanced Canvas Graphics",
  description:
    "Transform, gradient, Bézier, compositing, pixel filter, mini physics engine, isometric — Canvas 2D ရဲ့ အဆင့်မြင့် graphics ကို လက်တွေ့ run ပြီး ကျွမ်းကျင်အောင်။",
  icon: "Palette",
  bands: ["teen", "adult"],
  lessons: [
    {
      slug: "advcanvas-intro",
      title: "Advanced Canvas — Overview",
      summary: "Game Dev Bootcamp ရဲ့ နောက်ဆက်တွဲ — canvas graphics အဆင့်မြင့်။",
      minutes: 5,
      kind: "code",
      youtubeQuery: "html5 canvas advanced tutorial graphics",
      sections: [
        {
          heading: "Canvas ရဲ့ အနက်ကို ဆက်တူး",
          body: "Game Dev Bootcamp မှာ canvas အခြေခံ (loop, shape, sprite) သင်ပြီးပါပြီ။ ဒီသင်ရိုးက အဲ့ဒါ့အပေါ် ဆက်တက်ပြီး — transform (translate/rotate/scale), gradient နဲ့ pattern, Bézier curve, compositing (blend/glow), pixel-level filter, mini physics engine, isometric (2.5D) projection, real-time visualizer စတဲ့ အဆင့်မြင့် graphics နည်းပညာတွေ သင်ပေးမှာပါ။ သင်ခန်းစာတိုင်း canvas ကို Run/ပြင်လို့ရတယ်။",
          image: {
            src: `${IMG}/transforms.svg`,
            alt: "Canvas transform operations",
            caption: "translate · rotate · scale — coordinate system ပြောင်း",
          },
        },
      ],
      code: canvas(
        "const g = ctx.createLinearGradient(0, 0, 320, 0);\ng.addColorStop(0, '#2563eb'); g.addColorStop(1, '#22d3ee');\nctx.fillStyle = g; ctx.fillRect(0, 0, 320, 200);\nctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif';\nctx.textAlign = 'center';\nctx.fillText('Advanced Canvas 🎨', 160, 105);",
      ),
    },
    {
      slug: "transforms",
      title: "Transforms — translate, rotate, scale",
      summary: "canvas ရဲ့ coordinate system ကို ရွှေ့/လှည့်/ချုံ့ခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "canvas translate rotate scale transform",
      sections: [
        {
          heading: "coordinate system ကို ရွှေ့",
          body: "Canvas မှာ object ကို လှည့်/ချုံ့ဖို့ — object ရဲ့ point တွေကို တွက်စရာမလိုဘဲ **coordinate system ကိုယ်တိုင်** ကို `translate` (ရွှေ့), `rotate` (လှည့်), `scale` (ချုံ့/ချဲ့) လုပ်လိုက်တာ ပိုလွယ်တယ်။ ဆွဲမှုအားလုံး လိုက်ပြောင်းတယ်။ rotate က origin (0,0) ပတ်လည် လှည့်တာမို့ — အရင် object နေရာ ကို translate လုပ်ပြီးမှ rotate လုပ်ပါ။",
          image: {
            src: `${IMG}/transforms.svg`,
            alt: "translate, rotate and scale a square",
            caption: "translate → rotate → scale",
          },
        },
      ],
      code: canvas(
        "let a = 0;\nfunction loop() {\n  ctx.clearRect(0, 0, 320, 200);\n  ctx.save();\n  ctx.translate(160, 100);   // origin ကို အလယ် ရွှေ့\n  ctx.rotate(a);             // လှည့်\n  ctx.scale(1 + Math.sin(a) * 0.3, 1); // ချုံ့/ချဲ့\n  ctx.fillStyle = '#38bdf8';\n  ctx.fillRect(-30, -30, 60, 60); // အလယ်မှာ ဆွဲ\n  ctx.restore();\n  a += 0.03;\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "save-restore",
      title: "State Stack — save() / restore()",
      summary: "transform/style တွေ သိမ်း/ပြန်ယူ၍ sprite တစ်ခုစီ သီးသန့်ဆွဲခြင်း။",
      minutes: 8,
      kind: "code",
      youtubeQuery: "canvas save restore state stack",
      sections: [
        {
          heading: "transform ပြီး ပြန်ရှင်း",
          body: "`ctx.save()` က လက်ရှိ state (transform, fillStyle, alpha, ...) ကို stack ပေါ် သိမ်းတယ်။ `ctx.restore()` က နောက်ဆုံး သိမ်းထားတာကို ပြန်ယူတယ်။ object တစ်ခုစီ ဆွဲရာမှာ — save → transform → draw → restore လုပ်ရင် တစ်ခုရဲ့ transform က နောက်တစ်ခုကို မကူးစက်ဘူး။ ဒါ canvas မှာ မရှိမဖြစ် pattern ပါ။",
          image: {
            src: `${IMG}/save-restore.svg`,
            alt: "The canvas state stack",
            caption: "save → draw → restore — state သီးသန့်",
          },
        },
      ],
      code: canvas(
        "const boxes = [{x:60,a:0.3},{x:160,a:0.9},{x:260,a:1.5}];\nfunction loop() {\n  ctx.clearRect(0, 0, 320, 200);\n  for (const b of boxes) {\n    ctx.save();                 // ⬇ သိမ်း\n    ctx.translate(b.x, 100);\n    ctx.rotate(b.a);\n    ctx.fillStyle = '#4ade80';\n    ctx.fillRect(-20, -20, 40, 40);\n    ctx.restore();              // ⬆ ပြန်ယူ (နောက်တစ်ခု မကူး)\n    b.a += 0.02;\n  }\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "gradients",
      title: "Gradients & Patterns",
      summary: "linear / radial gradient နှင့် createPattern။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "canvas linear radial gradient tutorial",
      sections: [
        {
          heading: "အရောင် အဆင့်ဆင့်",
          body: "`createLinearGradient(x0,y0,x1,y1)` က မျဉ်းတစ်လျှောက် အရောင် ကူးပြောင်း၊ `createRadialGradient` က စက်ဝိုင်း အလယ်ကနေ အပြင် ကူးပြောင်းတယ်။ `addColorStop(offset 0–1, color)` နဲ့ အရောင် အမှတ် ထည့်တယ်။ sky, sunset, metal, glow effect တွေ ဒါနဲ့ ရတယ်။ `createPattern(img, 'repeat')` နဲ့ ပုံ/texture ထပ်ခါ ဖြန့်ခင်းလို့လည်း ရတယ်။",
          image: {
            src: `${IMG}/gradient.svg`,
            alt: "Linear and radial gradients",
            caption: "linear (မျဉ်း) · radial (စက်ဝိုင်း) · colorStop",
          },
        },
      ],
      code: canvas(
        "// sky gradient\nconst sky = ctx.createLinearGradient(0, 0, 0, 200);\nsky.addColorStop(0, '#1e3a8a'); sky.addColorStop(1, '#f59e0b');\nctx.fillStyle = sky; ctx.fillRect(0, 0, 320, 200);\n// sun glow (radial)\nconst sun = ctx.createRadialGradient(160, 150, 5, 160, 150, 60);\nsun.addColorStop(0, '#fde68a'); sun.addColorStop(1, 'rgba(253,230,138,0)');\nctx.fillStyle = sun; ctx.fillRect(80, 70, 160, 160);",
      ),
    },
    {
      slug: "paths-bezier",
      title: "Paths & Bézier Curves",
      summary: "quadratic / cubic curve နှင့် ရှုပ်ထွေးသော path များ။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "canvas bezier quadratic curve path",
      sections: [
        {
          heading: "control point နဲ့ ကွေး",
          body: "မျဉ်းဖြောင့် (`lineTo`) အပြင် — `quadraticCurveTo(cpx, cpy, x, y)` (control point ၁ ခု) နဲ့ `bezierCurveTo(cp1, cp2, x, y)` (control point ၂ ခု) တို့နဲ့ ချောမွေ့ကွေးမျဉ်း ဆွဲနိုင်တယ်။ control point တွေက မျဉ်းကို 'ဆွဲ' တဲ့ သံလိုက်လို — မျဉ်း အဲ့ဒီဆီ ကွေးသွားတယ်။ လှိုင်း, road, ပုံသဏ္ဌာန်, path animation တွေအတွက် အသုံးဝင်တယ်။",
          image: {
            src: `${IMG}/bezier.svg`,
            alt: "A cubic Bézier curve with control points",
            caption: "control point တွေက မျဉ်းကို ဆွဲ",
          },
        },
      ],
      code: canvas(
        "let t = 0;\nfunction loop() {\n  ctx.clearRect(0, 0, 320, 200);\n  const cp = 100 + Math.sin(t) * 60;\n  ctx.beginPath();\n  ctx.moveTo(30, 150);\n  ctx.bezierCurveTo(110, cp, 210, 200 - cp, 290, 100);\n  ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 3; ctx.stroke();\n  ctx.beginPath();          // waterline\n  ctx.moveTo(0, 170);\n  ctx.quadraticCurveTo(160, 150 + Math.cos(t)*20, 320, 170);\n  ctx.strokeStyle = '#4ade80'; ctx.stroke();\n  t += 0.03;\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "compositing",
      title: "Compositing & Blending",
      summary: "globalCompositeOperation နှင့် globalAlpha — glow, mask, transparency။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "canvas globalCompositeOperation blend modes",
      sections: [
        {
          heading: "အလွှာ ပေါင်းစပ်ပုံ ထိန်း",
          body: "`ctx.globalCompositeOperation` က — အသစ်ဆွဲတဲ့ ပုံက ရှိပြီးသား ပုံနဲ့ ဘယ်လို ပေါင်းစပ်မလဲ ထိန်းတယ်။ `'source-over'` (default) = အပေါ်တင်၊ `'lighter'` = အရောင်ပေါင်း (glow/fire)၊ `'multiply'` = မှောင်စပ်၊ `'destination-out'` = ဖျက် (mask/eraser)။ `ctx.globalAlpha` (0–1) က ဖောက်ထင်း (transparency) ထိန်းတယ်။ light, smoke, spotlight effect တွေ ဒါတွေနဲ့ ဖန်တီးတယ်။",
          image: {
            src: `${IMG}/compositing.svg`,
            alt: "source-over, lighter and multiply blend modes",
            caption: "source-over · lighter (glow) · multiply",
          },
        },
      ],
      code: canvas(
        "function loop(t) {\n  ctx.globalCompositeOperation = 'source-over';\n  ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 320, 200);\n  ctx.globalCompositeOperation = 'lighter'; // အရောင်ပေါင်း glow\n  const cols = ['#2563eb','#dc2626','#16a34a'];\n  for (let i = 0; i < 3; i++) {\n    const x = 160 + Math.cos(t/500 + i*2.1) * 50;\n    const y = 100 + Math.sin(t/500 + i*2.1) * 40;\n    const g = ctx.createRadialGradient(x, y, 0, x, y, 55);\n    g.addColorStop(0, cols[i]); g.addColorStop(1, 'transparent');\n    ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 200);\n  }\n  requestAnimationFrame(loop);\n}\nrequestAnimationFrame(loop);",
      ),
    },
    {
      slug: "shadows-text",
      title: "Shadows & Text",
      summary: "shadowBlur, shadowColor နှင့် text rendering / measureText။",
      minutes: 8,
      kind: "code",
      youtubeQuery: "canvas shadow text measureText",
      sections: [
        {
          heading: "အရိပ်နဲ့ စာသား",
          body: "`ctx.shadowColor`, `shadowBlur`, `shadowOffsetX/Y` သတ်မှတ်ရင် — နောက်က ဆွဲသမျှ (shape, text) မှာ အရိပ်/glow ပါလာတယ်။ စာသားအတွက် `font`, `textAlign`, `textBaseline` သတ်မှတ်ပြီး `fillText`/`strokeText` နဲ့ ဆွဲတယ်။ `measureText(str).width` နဲ့ စာသား အကျယ် တိုင်း၍ — အလယ်ချ, wrap, button size တွက်လို့ရတယ်။ score, title, HUD တွေအတွက် မရှိမဖြစ်။",
          image: {
            src: `${IMG}/compositing.svg`,
            alt: "Text with drop shadow and glow",
            caption: "shadowBlur + text — HUD, title, score",
          },
        },
      ],
      code: canvas(
        "function loop(t) {\n  ctx.clearRect(0, 0, 320, 200);\n  ctx.save();\n  ctx.shadowColor = '#22d3ee';\n  ctx.shadowBlur = 12 + Math.sin(t/300) * 8; // glow ဖိတ်\n  ctx.fillStyle = '#e2e8f0';\n  ctx.font = 'bold 30px sans-serif';\n  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';\n  ctx.fillText('SCORE 42', 160, 100);\n  ctx.restore();\n  const w = ctx.measureText('SCORE 42').width;\n  ctx.fillStyle = '#64748b'; ctx.font = '11px sans-serif';\n  ctx.fillText('width = ' + w.toFixed(0) + 'px', 160, 150);\n  requestAnimationFrame(loop);\n}\nrequestAnimationFrame(loop);",
      ),
    },
    {
      slug: "pixel-manipulation",
      title: "Pixel Manipulation & Filters",
      summary: "getImageData / putImageData — grayscale, invert, threshold။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "canvas getImageData pixel manipulation filter",
      sections: [
        {
          heading: "pixel array တိုက်ရိုက် ပြင်",
          body: "`getImageData(x,y,w,h)` က pixel တွေရဲ့ RGBA တန်ဖိုးတွေကို flat array (`data`) အဖြစ် ပြန်ပေးတယ် — pixel တစ်ခုစီ ၄ လုံး (R,G,B,A)။ array ကို loop ပြီး တန်ဖိုး ပြင် (ဥပမာ R=G=B ထားရင် grayscale), ပြီးရင် `putImageData` နဲ့ ပြန်ရေးတယ်။ ဒါက grayscale, invert, brightness, chroma-key စတဲ့ filter တွေ ဖန်တီးပေးတယ်။ (image processing ရဲ့ အခြေခံ။)",
          image: {
            src: `${IMG}/pixels.svg`,
            alt: "Reading and editing the RGBA pixel array",
            caption: "getImageData → RGBA ပြင် → putImageData",
          },
        },
      ],
      code: canvas(
        "// gradient ဆွဲပြီး grayscale filter\nconst g = ctx.createLinearGradient(0, 0, 320, 200);\ng.addColorStop(0, '#dc2626'); g.addColorStop(.5, '#16a34a'); g.addColorStop(1, '#2563eb');\nctx.fillStyle = g; ctx.fillRect(0, 0, 320, 100);\nconst img = ctx.getImageData(0, 0, 320, 100);\nconst d = img.data;\nfor (let i = 0; i < d.length; i += 4) {\n  const gray = 0.3*d[i] + 0.59*d[i+1] + 0.11*d[i+2];\n  d[i] = d[i+1] = d[i+2] = gray; // grayscale\n}\nctx.putImageData(img, 0, 100); // အောက်မှာ filtered\nctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif';\nctx.fillText('original ↑   grayscale ↓', 8, 96);",
      ),
    },
    {
      slug: "physics-engine",
      title: "Mini Physics Engine",
      summary: "gravity + restitution — bounce, wall collision, damping။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "javascript canvas bouncing balls physics",
      sections: [
        {
          heading: "gravity + bounce",
          body: "ball တစ်ခုစီမှာ position (x,y) နဲ့ velocity (vx,vy) ရှိတယ်။ frame တိုင်း — gravity က vy တိုး၊ position update၊ နံရံ/ကြမ်းထိရင် velocity ရဲ့ direction ပြောင်း (×−1) ပြီး restitution (×0.7) နဲ့ အား လျော့ (damping)။ ဒါက ခုန်တိုင်း အနိမ့်ချ ခုန်တဲ့ သဘာဝကျ physics ရတယ်။ ball အများ ထည့်ပြီး ball-to-ball collision ဆက်ထည့်လို့ရတယ်။",
          image: {
            src: `${IMG}/physics.svg`,
            alt: "A ball bouncing with gravity and damping",
            caption: "vy += g · ground → vy *= −0.7 (bounce)",
          },
        },
      ],
      code: canvas(
        "const balls = Array.from({length: 8}, () => ({\n  x: 30 + Math.random()*260, y: 20, r: 6 + Math.random()*10,\n  vx: (Math.random()-.5)*4, vy: 0,\n  c: `hsl(${Math.random()*360},70%,60%)`\n}));\nconst G = 0.3, BOUNCE = 0.75;\nfunction loop() {\n  ctx.clearRect(0, 0, 320, 200);\n  for (const b of balls) {\n    b.vy += G; b.x += b.vx; b.y += b.vy;\n    if (b.y + b.r > 200) { b.y = 200 - b.r; b.vy *= -BOUNCE; }\n    if (b.x - b.r < 0 || b.x + b.r > 320) b.vx *= -1;\n    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7);\n    ctx.fillStyle = b.c; ctx.fill();\n  }\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "particle-fx",
      title: "Advanced Particle FX",
      summary: "trail, fade, gravity ပါသော particle — fire, smoke, fountain။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "canvas particle effects fire smoke",
      sections: [
        {
          heading: "trail နဲ့ fade",
          body: "Game Dev Bootcamp မှာ particle အခြေခံ သင်ခဲ့ပြီးပြီ။ ဒီမှာ — clearRect အစား **ဖောက်ထင်း အမည်း** (`rgba(0,0,0,0.1)`) နဲ့ ဖုံးရင် — အဟောင်း တဖြည်းဖြည်း မှိန်ပြီး **trail (အမြီး)** effect ရတယ်။ particle တစ်ခုစီ life, size, color ချိန်ညှိပြီး gravity ထည့်ရင် — fire (အပေါ်တက်), fountain (ကျ), smoke (ပျံ့) စတဲ့ effect ကွဲပြားတွေ ရတယ်။",
          image: {
            src: `${IMG}/project-viz.svg`,
            alt: "Particles with trails fading over time",
            caption: "ဖောက်ထင်း ဖုံး → trail · life fade · gravity",
          },
        },
      ],
      code: canvas(
        "let ps = [];\nfunction loop() {\n  ctx.fillStyle = 'rgba(15,23,42,0.2)'; // clear မဟုတ် → trail\n  ctx.fillRect(0, 0, 320, 200);\n  for (let i = 0; i < 4; i++) {\n    const a = -Math.PI/2 + (Math.random()-.5);\n    ps.push({ x:160, y:180, vx:Math.cos(a)*3, vy:Math.sin(a)*5, life:1 });\n  }\n  ps = ps.filter(p => p.life > 0);\n  for (const p of ps) {\n    p.vy += 0.08; p.x += p.vx; p.y += p.vy; p.life -= 0.015;\n    ctx.globalAlpha = p.life;\n    ctx.fillStyle = `hsl(${30 + p.life*30},100%,60%)`; // fire hue\n    ctx.fillRect(p.x, p.y, 4, 4);\n  }\n  ctx.globalAlpha = 1;\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "isometric",
      title: "Isometric Projection (2.5D)",
      summary: "2D grid ကို isometric (diamond) tile အဖြစ် ပြသခြင်း။",
      minutes: 10,
      kind: "code",
      youtubeQuery: "isometric projection canvas tile game",
      sections: [
        {
          heading: "grid → diamond",
          body: "Isometric (2.5D) က — 2D array grid ကို ရှေ့တိုက် မဟုတ်ဘဲ 'diamond' ထောင့်ကနေ ပြတာပါ (SimCity, Age of Empires လို)။ ဖော်မြူလာ — screen `sx = (col − row) * tileW/2`, `sy = (col + row) * tileH/2`။ ဒါက grid ကို လှည့်/ဇယဉ်ထားသလို မြင်ရစေပြီး depth ခံစားမှု ရတယ်။ render order (နောက်ကနေ ရှေ့) မှန်အောင် ဆွဲရတယ်။",
          image: {
            src: `${IMG}/isometric.svg`,
            alt: "A 2D grid drawn as isometric diamond tiles",
            caption: "sx=(c−r)*w/2 · sy=(c+r)*h/2",
          },
        },
      ],
      code: canvas(
        "const TW = 40, TH = 20, N = 6;\nfunction tile(cx, cy, col) {\n  ctx.beginPath();\n  ctx.moveTo(cx, cy - TH/2); ctx.lineTo(cx + TW/2, cy);\n  ctx.lineTo(cx, cy + TH/2); ctx.lineTo(cx - TW/2, cy);\n  ctx.closePath(); ctx.fillStyle = col; ctx.fill();\n  ctx.strokeStyle = '#0f172a'; ctx.stroke();\n}\nctx.clearRect(0, 0, 320, 200);\nfor (let r = 0; r < N; r++)\n  for (let c = 0; c < N; c++) {\n    const sx = 160 + (c - r) * TW/2;\n    const sy = 40 + (c + r) * TH/2;\n    tile(sx, sy, (r + c) % 2 ? '#16a34a' : '#22c55e');\n  }",
      ),
    },
    {
      slug: "animation-easing",
      title: "Easing & Interpolation",
      summary: "lerp နှင့် easing function — ချောမွေ့ animation။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "easing functions lerp animation javascript",
      sections: [
        {
          heading: "linear မဟုတ်ဘဲ ချောချော",
          body: "**Lerp** (linear interpolation): `a + (b − a) * t` — t (0→1) အလိုက် a ကနေ b ဆီ။ တန်ဖိုးကို frame တိုင်း target ဆီ lerp လုပ်ရင် (ဥပမာ `x += (target − x) * 0.1`) — ချောမွေ့စွာ ချဉ်းကပ်တယ် (camera, UI)။ **Easing function** (easeInOut, bounce, elastic) တွေက t ကို ပြောင်းလဲ mapping လုပ်ပြီး — ရုတ်တရက် စ/ရပ် မဟုတ်ဘဲ သဘာဝကျ လှုပ်ရှားမှု ပေးတယ်။",
          image: {
            src: `${IMG}/bezier.svg`,
            alt: "Easing curve mapping progress to motion",
            caption: "lerp · easeInOut — ချောမွေ့ ချဉ်းကပ်",
          },
        },
      ],
      code: canvas(
        "const lerp = (a, b, t) => a + (b - a) * t;\nconst easeInOut = t => t < .5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;\nlet t = 0;\nfunction loop() {\n  ctx.clearRect(0, 0, 320, 200);\n  const p = (Math.sin(t) + 1) / 2;         // 0→1 ping-pong\n  const linX = lerp(30, 290, p);\n  const easeX = lerp(30, 290, easeInOut(p));\n  ctx.fillStyle = '#64748b'; ctx.fillRect(linX-8, 60, 16, 16);\n  ctx.fillStyle = '#22d3ee'; ctx.fillRect(easeX-8, 120, 16, 16);\n  ctx.fillStyle = '#94a3b8'; ctx.font = '11px sans-serif';\n  ctx.fillText('linear', 8, 55); ctx.fillText('easeInOut', 8, 115);\n  t += 0.03;\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "offscreen-performance",
      title: "Performance & Offscreen Canvas",
      summary: "pre-render, layer caching, dirty-rect — 60 FPS ထိန်းခြင်း။",
      minutes: 9,
      kind: "code",
      youtubeQuery: "canvas performance optimization offscreen prerender",
      sections: [
        {
          heading: "မပြောင်းတာ ကြိုဆွဲထား",
          body: "Frame တိုင်း ရှုပ်ထွေးတဲ့ ပုံ (background, static shape) ကို အသစ်ဆွဲရင် နှေးတယ်။ ဖြေရှင်းနည်း — **offscreen canvas** (မမြင်ရတဲ့ canvas) ပေါ်မှာ တစ်ကြိမ်တည်း ကြိုဆွဲ (pre-render) ထားပြီး၊ frame တိုင်း `drawImage` နဲ့ ကူးချ။ အခြား နည်း — ပြောင်းတဲ့ အပိုင်း (dirty rect) ကိုသာ ပြန်ဆွဲ၊ layer ခွဲ (static/dynamic)၊ integer coordinate သုံး၊ shadow/blur လျှော့။ ဒါတွေက 60 FPS ထိန်းပေးတယ်။",
          image: {
            src: `${IMG}/save-restore.svg`,
            alt: "Pre-rendering static content to an offscreen canvas",
            caption: "offscreen ကြိုဆွဲ → frame တိုင်း drawImage",
          },
        },
      ],
      code: canvas(
        "// static starfield ကို offscreen မှာ တစ်ကြိမ်တည်း ဆွဲ\nconst off = document.createElement('canvas');\noff.width = 320; off.height = 200;\nconst octx = off.getContext('2d');\noctx.fillStyle = '#0f172a'; octx.fillRect(0, 0, 320, 200);\noctx.fillStyle = '#e2e8f0';\nfor (let i = 0; i < 120; i++)\n  octx.fillRect(Math.random()*320, Math.random()*200, 2, 2);\nlet x = 0;\nfunction loop() {\n  ctx.drawImage(off, 0, 0);          // ကြိုဆွဲထားတာ ကူးချ (မြန်)\n  ctx.fillStyle = '#22d3ee';\n  ctx.beginPath(); ctx.arc(x, 100, 10, 0, 7); ctx.fill();\n  x = (x + 2) % 320;\n  requestAnimationFrame(loop);\n}\nloop();",
      ),
    },
    {
      slug: "project-visualizer",
      title: "Project — Real-Time Visualizer",
      summary: "gradient + transform + particle + easing ပေါင်းစပ် — live visualizer။",
      minutes: 14,
      kind: "code",
      youtubeQuery: "canvas audio visualizer bars javascript",
      sections: [
        {
          heading: "အားလုံး ပေါင်းစပ်",
          body: "နောက်ဆုံး project — သင်ယူထားသမျှ (gradient, transform, compositing/glow, particle, easing) ပေါင်းစပ်ပြီး **real-time visualizer** ဆောက်မယ်။ ဒီ demo မှာ — လှိုင်း (sine) data ကို bar အဖြစ် ပြပြီး၊ glow နဲ့ ချောမွေ့ lerp လုပ်ထားတယ်။ တကယ့် app မှာ — Web Audio API ရဲ့ `AnalyserNode.getByteFrequencyData()` ကနေ တေးဂီတ frequency data ယူပြီး bar height အဖြစ် သုံးရင် — သီချင်းနဲ့ လှုပ်တဲ့ visualizer ဖြစ်တယ်။",
          image: {
            src: `${IMG}/project-viz.svg`,
            alt: "A real-time bar + waveform visualizer",
            caption: "gradient + glow + easing → live visualizer",
          },
        },
        {
          heading: "စမ်းကြည့်ပါ",
          body: "Run နှိပ်ပြီး — bar တွေ ချောမွေ့ လှုပ်နေတာ၊ glow ဖိတ်နေတာ ကြည့်ပါ။ code ထဲက bar အရေအတွက်၊ အရောင် (hue)၊ lerp နှုန်း၊ glow blur တွေ ပြောင်းစမ်းပါ။ Web Audio နဲ့ ချိတ်ချင်ရင် — AudioContext + AnalyserNode ထည့်ပြီး frequency array ကို `vals` အစား သုံးလိုက်ရုံပါပဲ။",
        },
      ],
      code: canvas(
        "const N = 32;\nconst vals = new Array(N).fill(0), target = new Array(N).fill(0);\nfunction loop(t) {\n  for (let i = 0; i < N; i++) {\n    target[i] = (Math.sin(t/300 + i*0.4) * 0.5 + 0.5) * 150 * Math.random();\n    vals[i] += (target[i] - vals[i]) * 0.2;      // easing lerp\n  }\n  ctx.fillStyle = 'rgba(15,23,42,0.35)'; ctx.fillRect(0, 0, 320, 200);\n  ctx.globalCompositeOperation = 'lighter';       // glow\n  const bw = 320 / N;\n  for (let i = 0; i < N; i++) {\n    const h = vals[i];\n    const g = ctx.createLinearGradient(0, 200, 0, 200 - h);\n    g.addColorStop(0, `hsl(${180+i*4},90%,55%)`);\n    g.addColorStop(1, `hsl(${180+i*4},90%,70%)`);\n    ctx.fillStyle = g;\n    ctx.fillRect(i*bw + 1, 200 - h, bw - 2, h);\n  }\n  ctx.globalCompositeOperation = 'source-over';\n  requestAnimationFrame(loop);\n}\nrequestAnimationFrame(loop);",
      ),
    },
    {
      slug: "advcanvas-quiz",
      title: "Advanced Canvas Quiz",
      summary: "transform, gradient, compositing, pixel, physics — စစ်ဆေးပါ။",
      minutes: 6,
      kind: "quiz",
      quiz: [
        {
          q: "object တစ်ခုစီ transform က နောက်တစ်ခုကို မကူးအောင် ဘာသုံးလဲ။",
          options: ["clearRect", "save() / restore()", "beginPath", "globalAlpha"],
          answer: 1,
          explain: "save() က state သိမ်း၊ restore() က ပြန်ယူ — sprite တစ်ခုစီ သီးသန့်။",
        },
        {
          q: "ctx.rotate() က ဘယ်နေရာ ပတ်လည် လှည့်လဲ။",
          options: ["object အလယ်", "origin (0,0)", "canvas အလယ်", "mouse"],
          answer: 1,
          explain: "origin ပတ်လည် လှည့်လို့ — အရင် translate လုပ်ပြီးမှ rotate ပါ။",
        },
        {
          q: "glow / fire effect အတွက် ဘယ် composite mode သင့်တော်လဲ။",
          options: ["source-over", "lighter", "destination-out", "multiply"],
          answer: 1,
          explain: "'lighter' က အရောင်တွေ ပေါင်းလို့ — ထပ်တဲ့နေရာ ပိုတောက်၊ glow ရတယ်။",
        },
        {
          q: "pixel-level filter (grayscale) အတွက် ဘာသုံးလဲ။",
          options: ["fillRect", "getImageData / putImageData", "drawImage", "createPattern"],
          answer: 1,
          explain: "getImageData နဲ့ RGBA array ဖတ်၊ ပြင်၊ putImageData နဲ့ ပြန်ရေး။",
        },
        {
          q: "ball bounce မှာ ကြမ်းထိတိုင်း အား လျော့စေဖို့ ဘာလုပ်လဲ။",
          options: ["vy = 0", "vy *= -0.7 (restitution)", "vy += 10", "x = 0"],
          answer: 1,
          explain: "direction ပြောင်း (×−1) ပြီး 1 အောက် ကိန်း (0.7) နဲ့ မြှောက်ရင် ခုန်တိုင်း အနိမ့်ချ။",
        },
        {
          q: "static background ကို frame တိုင်း ပြန်မဆွဲဘဲ performance တိုးဖို့?",
          options: [
            "shadow ထည့်",
            "offscreen canvas မှာ ကြိုဆွဲပြီး drawImage",
            "font ကြီးကြီး",
            "globalAlpha 0",
          ],
          answer: 1,
          explain: "မပြောင်းတာ တစ်ကြိမ် pre-render → frame တိုင်း drawImage နဲ့ ကူးချ — မြန်တယ်။",
        },
      ],
    },
  ],
};
