"use client";

/// 📦 Scan exchange — scan တွေကို **ထုတ်/သွင်း/download** လုပ်တဲ့ layer
/// (user: "scanner မှ ရရှိသော object များ save, download, import, export")။
///
/// ★ Format က `.gwscan.json` — JSON သက်သက် (dependency မလို၊ zip မလို)၊
///   frame တွေက data: URL အဖြစ် ထဲမှာ ပါတယ်။ ဖိုင်တစ်ခုတည်းမို့ Messenger/
///   Drive/USB ဘယ်ကနေမဆို ပို့လို့ရတယ်၊ ပြန်သွင်းရင် အတိအကျ ပြန်ရတယ်။
/// ★ Cover ပုံကို PNG/JPEG အဖြစ် သီးသန့် download လုပ်လို့လည်း ရတယ် —
///   post တင်ဖို့/ပရင့်ထုတ်ဖို့ အလွယ်ဆုံး။
/// ★ သွင်းတဲ့အခါ id အသစ် ထုတ်တယ် — ဖိုင်တစ်ခုကို ၂ ခါသွင်းရင် ရှိပြီးသား
///   scan ကို မဖျက်မိဘူး။

import { getScan, saveScan, type ScanMode, type ScanRecord } from "./db";

const FILE_VERSION = 1;

type WireFrame = { sector: number; data: string; type: string };
type WireScan = {
  gwscan: number;
  id: string;
  mode: ScanMode;
  name: string;
  createdAt: number;
  cover: string | null;
  coverType?: string;
  frames: WireFrame[];
};

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error ?? new Error("read failed"));
    r.readAsDataURL(b);
  });

const dataUrlToBlob = async (u: string) => (await fetch(u)).blob();

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  // revoke နောက်ကျမှ — ချက်ချင်းဖျက်ရင် browser တချို့မှာ download ပျက်တယ်
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const safeName = (s: string) =>
  s.replace(/[^\p{L}\p{N}_ -]/gu, "").trim() || "gwave-scan";

/// Scan တစ်ခုလုံးကို ဖိုင်တစ်ခုအဖြစ် ထုတ် (frame အားလုံးပါ)
export async function exportScan(id: string): Promise<void> {
  const rec = await getScan(id);
  if (!rec) throw new Error("scan not found");
  const wire: WireScan = {
    gwscan: FILE_VERSION,
    id: rec.id,
    mode: rec.mode,
    name: rec.name,
    createdAt: rec.createdAt,
    cover: rec.cover ? await blobToDataUrl(rec.cover) : null,
    frames: await Promise.all(
      rec.frames.map(async (f) => ({
        sector: f.sector,
        data: await blobToDataUrl(f.blob),
        type: f.blob.type || "image/jpeg",
      })),
    ),
  };
  download(
    `${safeName(rec.name)}.gwscan.json`,
    new Blob([JSON.stringify(wire)], { type: "application/json" }),
  );
}

/// Cover ပုံသက်သက် download (post တင်ဖို့/မျှဖို့)
export async function downloadCover(id: string): Promise<void> {
  const rec = await getScan(id);
  if (!rec?.cover) throw new Error("no cover");
  const ext = rec.cover.type.includes("png") ? "png" : "jpg";
  download(`${safeName(rec.name)}.${ext}`, rec.cover);
}

/// `.gwscan.json` ဖိုင်ကို library ထဲ ပြန်သွင်း — id အသစ်နဲ့ သိမ်းတယ်
export async function importScanFile(file: File): Promise<ScanRecord> {
  const wire = JSON.parse(await file.text()) as WireScan;
  if (!wire || wire.gwscan !== FILE_VERSION || !Array.isArray(wire.frames)) {
    throw new Error("ဖိုင်ပုံစံ မမှန်ပါ (.gwscan.json ဖြစ်ရမယ်)");
  }
  const rec: ScanRecord = {
    id: crypto.randomUUID(),
    mode: wire.mode === "object" ? "object" : "room",
    name: `${wire.name || "Scan"} (သွင်းထား)`,
    createdAt: Date.now(),
    cover: wire.cover ? await dataUrlToBlob(wire.cover) : null,
    frames: await Promise.all(
      wire.frames.map(async (f) => ({
        sector: Number(f.sector) || 0,
        blob: await dataUrlToBlob(f.data),
      })),
    ),
  };
  await saveScan(rec);
  return rec;
}

/// နာမည်ပြောင်း (edit) — record ကို ဖတ်ပြီး name ပဲ လဲပြီး ပြန်သိမ်း
export async function renameScan(id: string, name: string): Promise<void> {
  const rec = await getScan(id);
  if (!rec) return;
  await saveScan({ ...rec, name: name.trim().slice(0, 60) || rec.name });
}
