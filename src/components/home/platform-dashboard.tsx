"use client";

import { useCallback, useEffect, useState } from "react";

/// 🏠 Gwave Home PLATFORM dashboard — trait-driven UI over the /api/home
/// proxy. The client never knows a device's brand: it renders whatever the
/// device's declared traits say it can do (Google-Home style).
///
/// Tabs: devices (live states, relay toggles, sensor chart) · rules
/// (if-then builder) · add-device (ESP32 provisioning + guide).

type Site = { id: string; name: string };
type Device = {
  id: string;
  site_id: string;
  name: string;
  type: string;
  connector: string;
  traits: Record<string, unknown>;
  is_online: boolean;
};
type DeviceState = { online?: boolean; values?: Record<string, number> };
type Rule = {
  id: string;
  site_id: string;
  name: string;
  enabled: boolean;
  definition: {
    trigger?: { device?: string; trait?: string; condition?: string; value?: number };
  };
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/home/${path}`, {
    ...init,
    headers: { "content-type": "application/json" },
    cache: "no-store",
  });
  const d = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!res.ok || !d) {
    throw new Error((d as { error?: string } | null)?.error ?? "မအောင်မြင်ပါ");
  }
  return d;
}

const TRAIT_MM: Record<string, string> = {
  "sensor.temperature": "🌡 အပူချိန်",
  "sensor.humidity": "💧 စိုထိုင်းဆ",
  "sensor.soil_moisture": "🌱 မြေအစိုဓာတ်",
  "sensor.water_level": "🚰 ရေအမြင့်",
  "sensor.light": "☀️ အလင်း",
  "sensor.ph": "🧪 pH",
  "sensor.ec": "🧪 EC",
  "sensor.contact": "🚪 တံခါး",
  "actuator.relay": "🔌 ဖွင့်/ပိတ်",
  "camera.live": "📹 Live",
};

export function PlatformDashboard() {
  const [tab, setTab] = useState<"devices" | "rules" | "add">("devices");
  const [sites, setSites] = useState<Site[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [states, setStates] = useState<Record<string, DeviceState>>({});
  const [rules, setRules] = useState<Rule[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [chartFor, setChartFor] = useState<{ id: string; trait: string } | null>(null);
  const [chart, setChart] = useState<{ time: string; value: number }[]>([]);

  const load = useCallback(async () => {
    try {
      const [s, d, r] = await Promise.all([
        api<Site[]>("sites"),
        api<Device[]>("devices"),
        api<Rule[]>("rules"),
      ]);
      setSites(s);
      setDevices(d);
      setRules(r);
      setErr(null);
      const st: Record<string, DeviceState> = {};
      await Promise.all(
        d.slice(0, 24).map(async (dev) => {
          try {
            st[dev.id] = await api<DeviceState>(`devices/${dev.id}/state`);
          } catch {
            st[dev.id] = {};
          }
        }),
      );
      setStates(st);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ဆွဲလို့မရပါ");
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!chartFor) return;
    void api<{ time: string; value: number }[]>(
      `devices/${chartFor.id}/history?trait=${encodeURIComponent(chartFor.trait)}&hours=24`,
    )
      .then(setChart)
      .catch(() => setChart([]));
  }, [chartFor]);

  const toggleRelay = async (dev: Device, on: boolean) => {
    try {
      await api(`devices/${dev.id}/execute`, {
        method: "POST",
        body: JSON.stringify({ command: "setOn", params: { on } }),
      });
      setMsg(`${dev.name} → ${on ? "ဖွင့်" : "ပိတ်"} ခိုင်းလိုက်ပါပြီ`);
      window.setTimeout(() => setMsg(null), 2500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "မအောင်မြင်ပါ");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      {err && (
        <p
          className="cursor-pointer rounded-lg bg-red-500/15 px-3 py-2 text-[13px] text-red-300"
          onClick={() => setErr(null)}
        >
          ⚠️ {err}
        </p>
      )}
      {msg && (
        <p className="rounded-lg bg-emerald-500/15 px-3 py-2 text-[13px] text-emerald-200">
          ✓ {msg}
        </p>
      )}

      <div className="flex gap-1">
        {(
          [
            ["devices", "📟 ကိရိယာများ"],
            ["rules", "⚙️ Auto စည်းမျဉ်း"],
            ["add", "➕ ကိရိယာထည့်"],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-2 text-[13px] font-semibold ${
              tab === t
                ? "bg-emerald-500/25 text-emerald-200"
                : "bg-white/5 text-white/70"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "devices" && (
        <DevicesTab
          sites={sites}
          devices={devices}
          states={states}
          onToggle={toggleRelay}
          onChart={(id, trait) => setChartFor({ id, trait })}
          onCreatedSite={load}
        />
      )}
      {tab === "rules" && (
        <RulesTab sites={sites} devices={devices} rules={rules} onChanged={load} />
      )}
      {tab === "add" && <AddTab sites={sites} />}

      {chartFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setChartFor(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0d1220] p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-[14px] font-semibold">
              {TRAIT_MM[chartFor.trait] ?? chartFor.trait} — ၂၄ နာရီ
            </p>
            <HistoryChart data={chart} />
            <button
              onClick={() => setChartFor(null)}
              className="mt-3 w-full rounded-lg border border-white/20 py-2 text-[13px] text-white/70"
            >
              ပိတ်မယ်
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DevicesTab({
  sites,
  devices,
  states,
  onToggle,
  onChart,
  onCreatedSite,
}: {
  sites: Site[];
  devices: Device[];
  states: Record<string, DeviceState>;
  onToggle: (d: Device, on: boolean) => void;
  onChart: (id: string, trait: string) => void;
  onCreatedSite: () => void;
}) {
  const [siteName, setSiteName] = useState("");
  if (sites.length === 0) {
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-[14px]">
        <p className="font-semibold">👋 ပထမဆုံး Site (ခြံ/အိမ်) တစ်ခု ဆောက်ပါ</p>
        <p className="text-[13px] text-white/70">
          Site ဆိုတာ ကိရိယာတွေ စုထားတဲ့ နေရာပါ — ဥပမာ「အိမ်」「ခြံ」။
        </p>
        <div className="flex gap-2">
          <input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="ဥပမာ — ကျွန်တော့်ခြံ"
            className="flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-[14px]"
          />
          <button
            onClick={async () => {
              if (!siteName.trim()) return;
              await api("sites", {
                method: "POST",
                body: JSON.stringify({ name: siteName.trim() }),
              }).catch(() => undefined);
              setSiteName("");
              onCreatedSite();
            }}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-[14px] font-semibold text-black"
          >
            ဆောက်မယ်
          </button>
        </div>
      </div>
    );
  }
  if (devices.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] text-white/70">
        ကိရိယာ မရှိသေးပါ —「➕ ကိရိယာထည့်」tab မှာ ESP32 credentials ထုတ်ပြီး
        ချိတ်ပါ။ ချိတ်ပြီးတာနဲ့ ဒီမှာ အလိုအလျောက် ပေါ်လာပါမယ် (auto-discovery)။
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {devices.map((d) => {
        const st = states[d.id];
        const online = st?.online ?? d.is_online;
        const values = st?.values ?? {};
        return (
          <div key={d.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[14px] font-semibold">{d.name}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  online
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-white/10 text-white/50"
                }`}
              >
                {online ? "● online" : "○ offline"}
              </span>
            </div>
            <div className="space-y-1.5">
              {Object.keys(d.traits ?? {}).map((trait) => {
                const v = values[trait];
                if (trait === "actuator.relay") {
                  return (
                    <div key={trait} className="flex items-center justify-between">
                      <span className="text-[13px] text-white/75">
                        {TRAIT_MM[trait]}
                      </span>
                      <span className="flex gap-1.5">
                        <button
                          onClick={() => onToggle(d, true)}
                          className="rounded-lg bg-emerald-500 px-3 py-1 text-[12px] font-bold text-black"
                        >
                          ဖွင့်
                        </button>
                        <button
                          onClick={() => onToggle(d, false)}
                          className="rounded-lg bg-white/10 px-3 py-1 text-[12px] text-white/80"
                        >
                          ပိတ်
                        </button>
                      </span>
                    </div>
                  );
                }
                if (trait.startsWith("sensor.")) {
                  return (
                    <button
                      key={trait}
                      onClick={() => onChart(d.id, trait)}
                      className="flex w-full items-center justify-between rounded-lg bg-black/25 px-2 py-1.5 text-left"
                    >
                      <span className="text-[13px] text-white/75">
                        {TRAIT_MM[trait] ?? trait}
                      </span>
                      <span className="text-[14px] font-bold text-emerald-200">
                        {typeof v === "number" ? v : "—"}{" "}
                        <span className="text-[11px] font-normal text-white/40">
                          📈
                        </span>
                      </span>
                    </button>
                  );
                }
                return (
                  <p key={trait} className="text-[12px] text-white/50">
                    {TRAIT_MM[trait] ?? trait}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryChart({ data }: { data: { time: string; value: number }[] }) {
  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-[13px] text-white/50">
        Data မလုံလောက်သေးပါ — sensor က ဆက်တင်နေရင် ဒီမှာ chart ပေါ်လာပါမယ်
      </p>
    );
  }
  const w = 460;
  const h = 160;
  const vs = data.map((p) => p.value);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const pts = data
    .map((p, i) => {
      const x = (i / (data.length - 1)) * (w - 20) + 10;
      const y = h - 20 - ((p.value - min) / span) * (h - 40);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-lg bg-black/30">
      <polyline points={pts} fill="none" stroke="#34d399" strokeWidth="2" />
      <text x="10" y="14" fill="#ffffff88" fontSize="11">
        max {max}
      </text>
      <text x="10" y={h - 6} fill="#ffffff88" fontSize="11">
        min {min}
      </text>
    </svg>
  );
}

function RulesTab({
  sites,
  devices,
  rules,
  onChanged,
}: {
  sites: Site[];
  devices: Device[];
  rules: Rule[];
  onChanged: () => void;
}) {
  const sensors = devices.filter((d) =>
    Object.keys(d.traits ?? {}).some((t) => t.startsWith("sensor.")),
  );
  const relays = devices.filter((d) => "actuator.relay" in (d.traits ?? {}));
  const [name, setName] = useState("");
  const [trigDev, setTrigDev] = useState("");
  const [trigTrait, setTrigTrait] = useState("");
  const [cond, setCond] = useState("lt");
  const [value, setValue] = useState("30");
  const [actDev, setActDev] = useState("");
  const [runSecs, setRunSecs] = useState("600");
  const [notifyMsg, setNotifyMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const trigTraits = Object.keys(
    devices.find((d) => d.id === trigDev)?.traits ?? {},
  ).filter((t) => t.startsWith("sensor."));

  const createRule = async () => {
    const site = sites[0];
    if (!site || !name.trim() || !trigDev || !trigTrait || !actDev) return;
    setBusy(true);
    try {
      const actions: unknown[] = [
        { type: "device", device: actDev, command: "setOn", params: { on: true } },
      ];
      const secs = Number(runSecs);
      if (secs > 0) {
        actions.push({ type: "delay", seconds: secs });
        actions.push({
          type: "device",
          device: actDev,
          command: "setOn",
          params: { on: false },
        });
      }
      if (notifyMsg.trim()) {
        actions.push({ type: "notify", message: notifyMsg.trim() });
      }
      await api("rules", {
        method: "POST",
        body: JSON.stringify({
          siteId: site.id,
          name: name.trim(),
          definition: {
            trigger: {
              type: "state",
              device: trigDev,
              trait: trigTrait,
              condition: cond,
              value: Number(value),
            },
            conditions: [],
            actions,
            cooldown_seconds: 3600,
          },
        }),
      });
      setName("");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const sel =
    "w-full rounded-lg border border-white/20 bg-black/30 px-2 py-2 text-[13px]";
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {rules.length === 0 && (
          <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-[13px] text-white/70">
            Auto စည်းမျဉ်း မရှိသေးပါ — အောက်မှာ「မြေခြောက်ရင် ရေပေး」လို
            စည်းမျဉ်း ဆောက်လို့ရပါတယ်။
          </p>
        )}
        {rules.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <div>
              <p className="text-[14px] font-semibold">{r.name}</p>
              <p className="text-[12px] text-white/50">
                {r.definition.trigger?.trait} {r.definition.trigger?.condition}{" "}
                {r.definition.trigger?.value}
              </p>
            </div>
            <button
              onClick={async () => {
                await api(`rules/${r.id}`, { method: "DELETE" }).catch(
                  () => undefined,
                );
                onChanged();
              }}
              className="rounded-lg bg-red-500/15 px-3 py-1.5 text-[12px] text-red-300"
            >
              ဖျက်
            </button>
          </div>
        ))}
      </div>

      {sensors.length > 0 && relays.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-3">
          <p className="text-[14px] font-semibold">➕ စည်းမျဉ်းအသစ် (if → then)</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="နာမည် — ဥပမာ: မြေခြောက်ရင် ရေပေး"
            className={sel}
          />
          <div className="grid grid-cols-2 gap-2">
            <select value={trigDev} onChange={(e) => setTrigDev(e.target.value)} className={sel}>
              <option value="">IF — sensor ရွေး</option>
              {sensors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={trigTrait}
              onChange={(e) => setTrigTrait(e.target.value)}
              className={sel}
            >
              <option value="">တိုင်းတာချက်</option>
              {trigTraits.map((t) => (
                <option key={t} value={t}>
                  {TRAIT_MM[t] ?? t}
                </option>
              ))}
            </select>
            <select value={cond} onChange={(e) => setCond(e.target.value)} className={sel}>
              <option value="lt">&lt; ထက်နည်းရင်</option>
              <option value="gt">&gt; ထက်များရင်</option>
              <option value="lte">≤</option>
              <option value="gte">≥</option>
            </select>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type="number"
              className={sel}
            />
            <select value={actDev} onChange={(e) => setActDev(e.target.value)} className={sel}>
              <option value="">THEN — ဖွင့်မယ့်ကိရိယာ</option>
              {relays.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              value={runSecs}
              onChange={(e) => setRunSecs(e.target.value)}
              type="number"
              placeholder="ဘယ်နှစက္ကန့် ဖွင့်ထားမလဲ"
              className={sel}
            />
          </div>
          <input
            value={notifyMsg}
            onChange={(e) => setNotifyMsg(e.target.value)}
            placeholder="အကြောင်းကြားစာ (မဖြစ်မနေ မဟုတ်)"
            className={sel}
          />
          <button
            onClick={createRule}
            disabled={busy}
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-[14px] font-bold text-black disabled:opacity-40"
          >
            {busy ? "သိမ်းနေသည်…" : "💾 စည်းမျဉ်း သိမ်းမယ်"}
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-white/50">
          စည်းမျဉ်းဆောက်ဖို့ sensor တစ်ခုနဲ့ ဖွင့်/ပိတ်ကိရိယာ (relay) တစ်ခု
          အနည်းဆုံး လိုပါတယ်။
        </p>
      )}
    </div>
  );
}

function AddTab({ sites }: { sites: Site[] }) {
  const [deviceKey, setDeviceKey] = useState("");
  const [creds, setCreds] = useState<{
    mqttUsername: string;
    mqttPassword: string;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const site = sites[0];
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[13px] leading-relaxed text-white/80">
        <p className="mb-1 text-[14px] font-semibold text-white">
          📟 ESP32 ကိရိယာ ချိတ်နည်း (အဆင့် ၄ ဆင့်)
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>အောက်မှာ ကိရိယာနာမည်ထည့်ပြီး credentials ထုတ်ပါ (တစ်ခါပဲ ပြပါမယ်)</li>
          <li>
            ESP32 ကို ESPHome နဲ့ flash — server:{" "}
            <code className="rounded bg-black/40 px-1">gwave.cc:1883</code> +
            အဲ့ credentials
          </li>
          <li>
            ကိရိယာဖွင့်တာနဲ့ ကိုယ့် traits ကိုယ်ကြေညာပြီး ဒီ app ထဲ
            အလိုအလျောက် ပေါ်လာမယ်
          </li>
          <li>「⚙️ Auto စည်းမျဉ်း」မှာ if-then ဆောက်ရင် အလိုအလျောက် အလုပ်လုပ်ပြီ</li>
        </ol>
        <p className="mt-2 text-[12px] text-white/50">
          Firmware နမူနာ: repo ရဲ့ gwave-home/esphome/farm-node.yaml (DHT22 +
          မြေအစိုဓာတ် sensor + ရေစက် relay)
        </p>
      </div>
      {site ? (
        <div className="flex gap-2">
          <input
            value={deviceKey}
            onChange={(e) =>
              setDeviceKey(e.target.value.replace(/[^a-z0-9_]/g, ""))
            }
            placeholder="ကိရိယာ key (a-z0-9) — ဥပမာ node1"
            className="flex-1 rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-[14px]"
          />
          <button
            onClick={async () => {
              if (!deviceKey) return;
              try {
                setCreds(
                  await api("provision", {
                    method: "POST",
                    body: JSON.stringify({ siteId: site.id, deviceKey }),
                  }),
                );
                setErr(null);
              } catch (e) {
                setErr(e instanceof Error ? e.message : "မအောင်မြင်ပါ");
              }
            }}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-[14px] font-semibold text-black"
          >
            ထုတ်မယ်
          </button>
        </div>
      ) : (
        <p className="text-[13px] text-white/60">
          အရင်ဆုံး「📟 ကိရိယာများ」tab မှာ site ဆောက်ပါ။
        </p>
      )}
      {err && <p className="text-[13px] text-red-300">⚠️ {err}</p>}
      {creds && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-[13px]">
          <p className="mb-1 font-semibold text-amber-200">
            🔑 MQTT Credentials — တစ်ခါပဲ ပြပါမယ်၊ ကူးထားပါ
          </p>
          <p className="font-mono">username: {creds.mqttUsername}</p>
          <p className="font-mono">password: {creds.mqttPassword}</p>
        </div>
      )}
    </div>
  );
}
