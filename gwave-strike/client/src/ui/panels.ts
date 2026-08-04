import type * as THREE from "three";

import type { Input } from "../core/input";

/// Settings panel (graphics Low/Med/High + sensitivity, persisted) and the
/// Tab scoreboard (blueprint §6).

export type Quality = "low" | "med" | "high";

export function applyQuality(renderer: THREE.WebGLRenderer, q: Quality) {
  renderer.setPixelRatio(
    q === "low" ? 1 : Math.min(window.devicePixelRatio, q === "med" ? 1.5 : 2),
  );
  renderer.shadowMap.enabled = q !== "low";
}

export function createSettings(
  parent: HTMLElement,
  renderer: THREE.WebGLRenderer,
  input: Input,
) {
  let q = (localStorage.getItem("strike:quality") as Quality) || "med";
  const sens = Number(localStorage.getItem("strike:sens")) || 1;
  input.sensitivity = 0.0023 * sens;
  applyQuality(renderer, q);

  const gear = document.createElement("button");
  gear.textContent = "⚙";
  gear.style.cssText =
    "position:absolute;top:10px;left:10px;pointer-events:auto;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.4);color:#fff;font-size:16px";
  parent.appendChild(gear);

  const panel = document.createElement("div");
  panel.style.cssText =
    "position:absolute;top:52px;left:10px;display:none;pointer-events:auto;background:rgba(8,12,20,.92);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:12px;color:#fff;font-size:12px;width:210px";
  panel.innerHTML = `
    <div style="margin-bottom:8px;font-weight:700">⚙ ချိန်ညှိချက်</div>
    <div style="margin-bottom:4px">ရုပ်ထွက်အရည်အသွေး</div>
    <div id="qrow" style="display:flex;gap:6px;margin-bottom:10px">
      <button data-q="low">နိမ့်</button><button data-q="med">လယ်</button><button data-q="high">မြင့်</button>
    </div>
    <div style="margin-bottom:4px">ချိန်ရွယ်နှုန်း (sensitivity)</div>
    <input id="sens" type="range" min="0.3" max="2.5" step="0.1" value="${sens}" style="width:100%">`;
  parent.appendChild(panel);
  panel.querySelectorAll("button").forEach((b) => {
    (b as HTMLElement).style.cssText =
      "flex:1;padding:4px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:#fff";
  });

  const paint = () => {
    panel.querySelectorAll<HTMLButtonElement>("[data-q]").forEach((b) => {
      b.style.background =
        b.dataset["q"] === q ? "rgba(57,217,138,.35)" : "rgba(255,255,255,.08)";
    });
  };
  paint();
  panel.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).dataset["q"] as Quality | undefined;
    if (t) {
      q = t;
      localStorage.setItem("strike:quality", q);
      applyQuality(renderer, q);
      paint();
    }
  });
  panel.querySelector<HTMLInputElement>("#sens")!.addEventListener("input", (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    localStorage.setItem("strike:sens", String(v));
    input.sensitivity = 0.0023 * v;
  });
  gear.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
}

export type ScoreRow = {
  name: string;
  team: number;
  kills: number;
  deaths: number;
  me: boolean;
};

export function createScoreboard(parent: HTMLElement) {
  const el = document.createElement("div");
  el.style.cssText =
    "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:none;background:rgba(6,10,18,.92);border:1px solid rgba(255,255,255,.15);border-radius:12px;padding:14px 18px;color:#fff;font-size:13px;min-width:300px;pointer-events:none";
  parent.appendChild(el);
  return {
    toggle(show: boolean, rows: ScoreRow[]) {
      el.style.display = show ? "block" : "none";
      if (!show) return;
      const side = (team: number) =>
        rows
          .filter((r) => r.team === team)
          .sort((a, b) => b.kills - a.kills)
          .map(
            (r) =>
              `<div style="display:flex;justify-content:space-between;gap:14px;${r.me ? "color:#39d98a;font-weight:700" : ""}">
                 <span>${r.name.replace(/[<>&]/g, "")}</span><span>${r.kills} / ${r.deaths}</span>
               </div>`,
          )
          .join("");
      el.innerHTML = `
        <div style="display:flex;gap:26px">
          <div style="flex:1"><div style="color:#7fa8ff;font-weight:700;margin-bottom:6px">BLUE</div>${side(0)}</div>
          <div style="flex:1"><div style="color:#ff9080;font-weight:700;margin-bottom:6px">RED</div>${side(1)}</div>
        </div>`;
    },
  };
}
