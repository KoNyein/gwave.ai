#!/usr/bin/env node
// Asset compression pipeline (blueprint §3.2): DRACO geometry + KTX2/Basis
// textures. Target < 3 MB per character.
//
//   node tools/compress-assets.mjs input.glb output.min.glb
//
// Uses gltf-transform CLI via npx (no permanent heavy devDependency).
// KTX2 needs `toktx` (KTX-Software) on PATH; without it we fall back to
// DRACO-only and say so, instead of failing the whole pipeline.

import { execSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node tools/compress-assets.mjs <in.glb> <out.glb>");
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`input not found: ${input}`);
  process.exit(1);
}

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

let hasToktx = true;
try {
  execSync("toktx --version", { stdio: "ignore" });
} catch {
  hasToktx = false;
  console.warn(
    "⚠ toktx (KTX-Software) not on PATH — compressing geometry only.\n" +
      "  Install https://github.com/KhronosGroup/KTX-Software for KTX2 textures.",
  );
}

const tex = hasToktx ? "--texture-compress ktx2" : "";
run(
  `npx --yes @gltf-transform/cli optimize "${input}" "${output}" --compress draco ${tex}`,
);

const mb = statSync(output).size / 1024 / 1024;
console.log(`✓ ${output}: ${mb.toFixed(2)} MB ${mb > 3 ? "(⚠ over 3 MB budget)" : ""}`);
