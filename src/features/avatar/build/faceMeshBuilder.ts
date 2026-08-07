"use client";

import * as THREE from "three";

import type { FaceCapture } from "../scan/faceLandmarks";
import { getFaceTriangles } from "../scan/faceLandmarks";

/// 🧬 Landmarks → textured face mesh (spec §4.2/§4.3 — Phase 2 v1)။
///
/// ★ Raw triangulation **မလုပ်ဘူး** — MediaPipe ရဲ့ canonical topology
///   (tesselation ကနေ derive လုပ်တဲ့ fixed triangle list) ပေါ် user ရဲ့
///   landmark position တွေ တင်တာ — fixed-topology deformation ပဲ (spec
///   §13 pitfall ကို ရှောင်တယ်)။ Generic head asset (scalp/နောက်စေ့ပါတဲ့)
///   ရောက်ရင် ဒီ builder ကို barycentric mapping နဲ့ တိုးမယ် — API မပြောင်း။
/// ★ Texture — front frame ကို မျက်နှာ bounding box အလိုက် ဖြတ်ပြီး UV က
///   landmark ရဲ့ frame နေရာအတိုင်း။ ရှေ့တည့်တည့် projection သဘော။
/// ★ Geometry x ကို mirror — selfie မှာ မြင်နေကျ (မှန်ထဲကပုံ) အတိုင်း။

export type BuiltFace = {
  mesh: THREE.Mesh;
  /// GLB ထဲ ဝင်မယ့် texture canvas (1024²) — thumbnail အတွက်လည်း သုံး
  texture: HTMLCanvasElement;
};

/// Avatar ခေါင်းအရွယ်နဲ့ လိုက်အောင် မျက်နှာအကျယ် (metres)
const FACE_WIDTH_M = 0.16;
/// MediaPipe ရဲ့ z (depth) က xy ထက် သိသိသာသာ ပြားတယ် — relief မြှင့်မှ
/// နှာခေါင်း/မေးရိုး 3D ကျတယ်။ 1.25 က likeness မပျက်ဘဲ depth ရတဲ့ ချိန်ခွင်။
const DEPTH_BOOST = 1.25;

/// 🪞 z-only Laplacian smoothing — depth noise (landmark jitter) က z မှာ
/// အများဆုံး။ xy ကို မထိဘူး (likeness ပျက်မယ်)၊ z ကိုပဲ triangle
/// neighbour ပျမ်းမျှဆီ λ နဲ့ ဆွဲတယ် — မျက်နှာပြင် ချောသွားတယ်။
function smoothDepth(pos: Float32Array, tris: number[], iterations = 2) {
  const n = pos.length / 3;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < tris.length; t += 3) {
    const a = tris[t]!, b = tris[t + 1]!, c = tris[t + 2]!;
    adj[a]!.push(b, c);
    adj[b]!.push(a, c);
    adj[c]!.push(a, b);
  }
  const z = new Float32Array(n);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      const nb = adj[i]!;
      if (nb.length === 0) {
        z[i] = pos[i * 3 + 2]!;
        continue;
      }
      let s = 0;
      for (const j of nb) s += pos[j * 3 + 2]!;
      z[i] = pos[i * 3 + 2]! * 0.65 + (s / nb.length) * 0.35;
    }
    for (let i = 0; i < n; i++) pos[i * 3 + 2] = z[i]!;
  }
}

export async function buildFaceMesh(capture: FaceCapture): Promise<BuiltFace> {
  const { landmarks, frame, width, height } = capture;
  const tris = await getFaceTriangles();

  // ── Bounding box (normalized) ──────────────────────────────────────────
  let minX = 1,
    maxX = 0,
    minY = 1,
    maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);

  // ── Texture — face crop (10% padding) ─────────────────────────────────
  const pad = 0.1;
  const cropX = Math.max(0, (minX - spanX * pad) * width);
  const cropY = Math.max(0, (minY - spanY * pad) * height);
  const cropW = Math.min(width - cropX, spanX * (1 + pad * 2) * width);
  const cropH = Math.min(height - cropY, spanY * (1 + pad * 2) * height);
  // Texture resolution — source crop ကြည်ရင် 2048² အထိ တက် (1080p ကင်မရာ
  // + တိုးကပ်ရိုက်ရင် ရတယ်)၊ မကြည်ရင် 1024² — upscale အလကား မလုပ်ဘူး။
  const TEX_SIZE = cropW >= 900 ? 2048 : 1024;
  const texture = document.createElement("canvas");
  texture.width = TEX_SIZE;
  texture.height = TEX_SIZE;
  const tc = texture.getContext("2d");
  if (!tc) throw new Error("canvas unavailable");
  tc.imageSmoothingEnabled = true;
  tc.imageSmoothingQuality = "high";
  tc.drawImage(frame, cropX, cropY, cropW, cropH, 0, 0, TEX_SIZE, TEX_SIZE);

  // ── Geometry ──────────────────────────────────────────────────────────
  const n = landmarks.length;
  const pos = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  // px → metre scale: မျက်နှာအကျယ် (normalized spanX) ကို FACE_WIDTH_M ဖြစ်အောင်
  const scale = FACE_WIDTH_M / spanX;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (let i = 0; i < n; i++) {
    const p = landmarks[i];
    if (!p) continue;
    // Mirror x (selfie), y ကို up ဖြစ်အောင် လှန်, z: mediapipe က ကင်မရာဆီ
    // အနုတ် — အရှေ့ (avatar ရဲ့ +z) ဖြစ်အောင် လှန်
    pos[i * 3] = (cx - p.x) * scale;
    // y: normalized coord တွေက axis တစ်ခုစီ pixel scale ကွဲလို့ frame
    // aspect (height/width) နဲ့ ပြန်ညှိမှ မျက်နှာက မပြားမရှည် မှန်တယ်
    pos[i * 3 + 1] = (cy - p.y) * scale * (height / width);
    pos[i * 3 + 2] = -(p.z ?? 0) * scale * DEPTH_BOOST;
    // UV — crop ထဲက နေရာ (v axis လှန်)
    uv[i * 2] = (p.x * width - cropX) / Math.max(1e-6, cropW);
    uv[i * 2 + 1] = 1 - (p.y * height - cropY) / Math.max(1e-6, cropH);
  }

  smoothDepth(pos, tris);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(tris);
  geo.computeVertexNormals();
  geo.center();

  const tex = new THREE.CanvasTexture(texture);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false; // GLTF convention — exporter က flipY=false မျှော်တယ်
  // flipY=false မို့ UV v ကို ပြန်လှန်
  for (let i = 0; i < n; i++) uv[i * 2 + 1] = 1 - (uv[i * 2 + 1] ?? 0);
  const uvAttr = geo.getAttribute("uv");
  if (uvAttr) uvAttr.needsUpdate = true;

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.75,
    metalness: 0,
    side: THREE.DoubleSide, // tesselation-derived winding က မညီညာနိုင်လို့
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = "scanned-face";
  return { mesh, texture };
}
