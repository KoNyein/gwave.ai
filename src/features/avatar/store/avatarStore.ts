"use client";

import { create } from "zustand";

import {
  DEFAULT_SCAN_AVATAR,
  sanitizeMorphs,
  type AvatarConfig,
  type MorphKey,
} from "../types";

/// 🗂 Editor state (Zustand — spec §2)။
///
/// ★ `dirty` — server မှာ သိမ်းပြီးသားနဲ့ ကွာနေလား။ Unsaved-changes guard
///   (spec §8) က ဒါကို ကြည့်တယ်။
/// ★ save() က server ကပြန်လာတဲ့ sanitized config ကို ပြန်တင်တယ် —
///   server က ဘာဖယ်လိုက်လဲ UI က ချက်ချင်း သိရအောင်။

type AvatarStore = {
  config: AvatarConfig;
  /// DB row ရဲ့ updated_at — "နောက်ဆုံးသိမ်းချိန်" DB panel အတွက်
  updatedAt: string | null;
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;

  load(): Promise<void>;
  save(): Promise<boolean>;
  setMorph(key: MorphKey, value: number): void;
  patch(p: Partial<AvatarConfig>): void;
  resetError(): void;
};

export const useAvatarStore = create<AvatarStore>((set, get) => ({
  config: DEFAULT_SCAN_AVATAR,
  updatedAt: null,
  dirty: false,
  loading: false,
  saving: false,
  error: null,

  async load() {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/avatar", { cache: "no-store" });
      if (!res.ok) throw new Error("avatar load failed");
      const d = (await res.json()) as {
        config: AvatarConfig;
        updatedAt?: string | null;
      };
      set({
        config: d.config,
        updatedAt: d.updatedAt ?? null,
        dirty: false,
        loading: false,
      });
    } catch {
      // Load မရလည်း default နဲ့ ဆက်ပြင်လို့ရတယ် — offline-first
      set({ loading: false, error: "Avatar ဖတ်လို့ မရသေးပါ" });
    }
  },

  async save() {
    const { config } = get();
    set({ saving: true, error: null });
    try {
      const res = await fetch("/api/avatar", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const d = (await res.json().catch(() => null)) as
        | { config?: AvatarConfig; updatedAt?: string | null; error?: string }
        | null;
      if (!res.ok || !d?.config) {
        throw new Error(d?.error ?? "သိမ်းလို့ မရပါ");
      }
      set({
        config: d.config,
        updatedAt: d.updatedAt ?? null,
        dirty: false,
        saving: false,
      });
      return true;
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "သိမ်းလို့ မရပါ",
      });
      return false;
    }
  },

  setMorph(key, value) {
    const { config } = get();
    set({
      config: {
        ...config,
        morphs: sanitizeMorphs({ ...config.morphs, [key]: value }),
      },
      dirty: true,
    });
  },

  patch(p) {
    set({ config: { ...get().config, ...p }, dirty: true });
  },

  resetError() {
    set({ error: null });
  },
}));
