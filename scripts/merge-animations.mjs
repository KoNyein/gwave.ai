#!/usr/bin/env node
/* ================================================================
   GWAVE — Animation GLB များကို တစ်ခုတည်းပေါင်းခြင်း
   ----------------------------------------------------------------
     node merge-animations.mjs ./anims --base soldier.glb --out soldier-full.glb

   ★ ဘာလို့လိုလဲ —
   Mixamo က animation တစ်ခုချင်း ဖိုင်တစ်ခုစီပေးတယ်။
   Idle, Walk, Run, Aim, Shoot, Reload, Death ဆို ဖိုင် ၇ ခု။
   ဒါတွေကို ဂိမ်းမှာ တစ်ခုချင်းဒေါင်းရင် —
     · HTTP request ၇ ခု
     · Mesh ၇ ခါ ထပ်ဒေါင်း (တူညီတဲ့ mesh!)
     · ဖိုင်အရွယ် ၇ ဆ

   ★ ဒီ script က mesh တစ်ခုနဲ့ animation clip အားလုံးပါတဲ့
     GLB တစ်ခုတည်းအဖြစ် ပေါင်းပေးတယ်
   ================================================================ */

import fs from 'fs';
import path from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const argv = process.argv.slice(2);
const dir = argv.find(a => !a.startsWith('--'));
const opt = Object.fromEntries(argv.reduce((a, v, i) =>
  v.startsWith('--') ? [...a, [v.slice(2), argv[i + 1]]] : a, []));

if (!dir) {
  console.error('သုံးပုံ: node merge-animations.mjs <anim-folder> [--base base.glb] [--out out.glb]');
  process.exit(1);
}

/* ★ KHR extension တွေ (unlit material စသဖြင့်) ပါတဲ့ GLB — Kenney kit /
   Mixamo export တချို့ — ဖတ်လို့ရအောင် extension အားလုံး register */
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

/** ★ ဖိုင်နာမည်ကနေ clip နာမည်ရှင်း
 *  "Rifle Walk.glb" → "walk"  ·  "mixamo.com" → ဖိုင်နာမည်သုံး */
function clipName(file) {
  return path.basename(file, path.extname(file))
    .replace(/mixamo\.?com/gi, '')
    .replace(/\((\d+)\)/g, '')
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-') || 'clip';
}

const files = fs.readdirSync(dir).filter(f => /\.(glb|gltf)$/i.test(f)).sort();
if (!files.length) { console.error('GLB မတွေ့ပါ:', dir); process.exit(1); }

/* ★ Base — mesh/skeleton ယူမယ့်ဖိုင်။ မသတ်မှတ်ရင် ပထမဆုံးဖိုင် */
const baseFile = opt.base
  ? (fs.existsSync(opt.base) ? opt.base : path.join(dir, opt.base))
  : path.join(dir, files[0]);

console.log(`Base: ${path.basename(baseFile)}`);
const doc = await io.read(baseFile);
const root = doc.getRoot();

/* ★ Base ရဲ့ node တွေကို နာမည်နဲ့ index လုပ်ထား —
   animation channel တွေက node ကို ညွှန်းလို့ */
const nodesByName = new Map();
for (const n of root.listNodes()) {
  const nm = n.getName();
  if (nm) nodesByName.set(nm, n);
}
console.log(`  Node ${root.listNodes().length} · Mesh ${root.listMeshes().length} · Skin ${root.listSkins().length}`);

/* ★ Base ထဲက animation ရှိပြီးသားဆို နာမည်ပြောင်း */
for (const a of root.listAnimations()) {
  if (!a.getName()) a.setName(clipName(baseFile));
}

const added = [];
const failed = [];

for (const f of files) {
  const full = path.join(dir, f);
  if (path.resolve(full) === path.resolve(baseFile)) continue;

  try {
    const src = await io.read(full);
    const srcRoot = src.getRoot();
    const anims = srcRoot.listAnimations();
    if (!anims.length) { failed.push(`${f} — animation မပါ`); continue; }

    for (const anim of anims) {
      /* ★ Clip နာမည် — GLB ထဲက clip ကိုယ်ပိုင်နာမည်ကို ဦးစားပေး (တစ်ဖိုင်
         clip များများပါရင် ဖိုင်နာမည်တည်းဆို အကုန်ထပ်နေမယ်)၊ မရှိမှ
         ဖိုင်နာမည်။ ထပ်နေသေးရင် -2, -3 ဆက်တွဲ။ */
      const own = anim.getName()?.trim();
      let name = own
        ? own.toLowerCase().replace(/[_.\s]+/g, '-')
        : clipName(f);
      const used = new Set(root.listAnimations().map(a => a.getName()));
      if (used.has(name)) {
        let i = 2;
        while (used.has(`${name}-${i}`)) i++;
        name = `${name}-${i}`;
      }

      /* ★ Animation ကို base document ထဲ ကူးထည့်
         Channel တစ်ခုချင်း — target node ကို နာမည်နဲ့ရှာ */
      const newAnim = doc.createAnimation(name);
      let ok = 0, miss = 0;

      for (const ch of anim.listChannels()) {
        const targetNode = ch.getTargetNode();
        const tName = targetNode?.getName();
        // ★ Skeleton နာမည် တူညီရမယ် — Mixamo က "mixamorig:Hips" စသဖြင့်
        const destNode = tName ? nodesByName.get(tName) : null;
        if (!destNode) { miss++; continue; }

        const sampler = ch.getSampler();
        if (!sampler) { miss++; continue; }

        const inAcc = sampler.getInput(), outAcc = sampler.getOutput();
        if (!inAcc || !outAcc) { miss++; continue; }

        // ★ Accessor တွေကို base document ထဲ ပြန်ဆောက်
        const buf = root.listBuffers()[0] ?? doc.createBuffer();
        const newIn = doc.createAccessor()
          .setArray(inAcc.getArray().slice())
          .setType(inAcc.getType()).setBuffer(buf);
        const newOut = doc.createAccessor()
          .setArray(outAcc.getArray().slice())
          .setType(outAcc.getType()).setBuffer(buf);

        const newSampler = doc.createAnimationSampler()
          .setInput(newIn).setOutput(newOut)
          .setInterpolation(sampler.getInterpolation());

        newAnim.addSampler(newSampler);
        newAnim.addChannel(
          doc.createAnimationChannel()
            .setTargetNode(destNode)
            .setTargetPath(ch.getTargetPath())
            .setSampler(newSampler)
        );
        ok++;
      }

      if (ok === 0) { newAnim.dispose(); failed.push(`${f} — node နာမည် မကိုက်ပါ`); continue; }
      added.push({ name, channels: ok, missing: miss });
    }
  } catch (err) {
    failed.push(`${f} — ${err.message}`);
  }
}

const out = opt.out || 'character-full.glb';
await io.write(out, doc);

const sizeKb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`\n✓ ${out}  (${sizeKb} KB)`);
console.log(`  Clip ${root.listAnimations().length} ခု:`);
for (const a of root.listAnimations()) {
  const extra = added.find(x => x.name === a.getName());
  console.log(`    · ${a.getName()}${extra && extra.missing ? `  ⚠️ node ${extra.missing} ခု မကိုက်` : ''}`);
}
if (failed.length) {
  console.log(`\n  ⚠️ မအောင်မြင် ${failed.length}:`);
  failed.slice(0, 8).forEach(f => console.log('    ·', f));
  console.log('  ★ node နာမည်မကိုက်ရင် — Mixamo မှာ "Without Skin" မဟုတ်ဘဲ');
  console.log('    တူညီတဲ့ character ကနေ animation အားလုံး ဒေါင်းထားပါ');
}

console.log('\n  three.js မှာသုံးပုံ:');
console.log("    const gltf = await loader.loadAsync('character-full.glb');");
console.log("    const mixer = new THREE.AnimationMixer(gltf.scene);");
console.log("    const walk = mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'walk'));");
