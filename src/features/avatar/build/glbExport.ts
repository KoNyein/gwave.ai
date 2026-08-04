"use client";

import type * as THREE from "three";

/// 🧬 GLB export + upload (spec §4.5)။
///
/// ★ GLTFExporter က KTX2 မထုတ်နိုင် (spec §13) — CanvasTexture က JPEG/PNG
///   အဖြစ် embed ဝင်တယ်၊ library asset တွေကိုသာ offline gltfpack လုပ်မယ်။
/// ★ Upload — presigned PUT နှစ်ချက် (glb + thumb) → config save က
///   caller ဘက်မှာ (URL နှစ်ခုလုံး ရမှ တစ်ခါတည်း PUT /api/avatar)။

export async function exportGlb(root: THREE.Object3D): Promise<Blob> {
  const { GLTFExporter } = await import(
    "three/examples/jsm/exporters/GLTFExporter.js"
  );
  const exporter = new GLTFExporter();
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      root,
      (res) => {
        if (res instanceof ArrayBuffer) resolve(res);
        else reject(new Error("binary export expected"));
      },
      (err) => reject(err),
      { binary: true },
    );
  });
  return new Blob([buffer], { type: "model/gltf-binary" });
}

/// Scan file တစ်ခုကို presigned URL နဲ့ တင် — CDN/S3 path ပြန်ရတယ်
export async function uploadScanFile(
  kind: "scan-face.glb" | "face-texture.jpg" | "thumb.png",
  blob: Blob,
): Promise<string> {
  const pres = await fetch("/api/avatar/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind }),
  });
  const d = (await pres.json().catch(() => null)) as
    | { url?: string; path?: string; error?: string }
    | null;
  if (!pres.ok || !d?.url || !d?.path) {
    throw new Error(d?.error ?? "Upload ခွင့် မရပါ");
  }
  const put = await fetch(d.url, {
    method: "PUT",
    headers: { "content-type": blob.type },
    body: blob,
  });
  if (!put.ok) throw new Error("S3 upload မအောင်မြင်ပါ");
  // CDN URL (mediaUrl pattern) — avatar API ရဲ့ owned-folder check က URL
  // pathname ထဲ avatars/{uid}/ ပါလား ကြည့်လို့ ဒီ URL နဲ့ ကိုက်တယ်
  const { mediaUrl } = await import("@/lib/media-url");
  return mediaUrl(d.path);
}
