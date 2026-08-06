"use client";

/// 💾 Scan library — IndexedDB local store (room/object scans)။
///
/// ★ Frame blob တွေက MB အဆင့်ရှိလို့ server မတင်ဘဲ **စက်ထဲမှာပဲ** သိမ်းတယ်
///   (LiDAR app တွေလည်း local library ပဲ)။ Post တင်ချင်ရင် cover ပုံကို
///   ပုံမှန် photo post အဖြစ် share လုပ်လို့ရတယ်။
/// ★ API က Promise wrapper အပါး — schema ပြောင်းရင် DB_VER တိုး။

import type { OrbitFrame } from "./orbit";

const DB_NAME = "gwave-scan3d";
const DB_VER = 1;
const STORE = "scans";

export type ScanMode = "room" | "object";

export type ScanRecord = {
  id: string;
  mode: ScanMode;
  name: string;
  createdAt: number;
  frames: OrbitFrame[];
  cover: Blob | null;
};

export type ScanMeta = Omit<ScanRecord, "frames"> & { frameCount: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB failed"));
        t.oncomplete = () => db.close();
      }),
  );
}

export async function saveScan(rec: ScanRecord): Promise<void> {
  await tx("readwrite", (s) => s.put(rec));
}

export async function listScans(): Promise<ScanMeta[]> {
  const all = await tx<ScanRecord[]>("readonly", (s) => s.getAll());
  return all
    .map(({ frames, ...meta }) => ({ ...meta, frameCount: frames.length }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getScan(id: string): Promise<ScanRecord | null> {
  return (await tx<ScanRecord | undefined>("readonly", (s) => s.get(id))) ?? null;
}

export async function deleteScan(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}
