/// Burmese HUD (blueprint: user-facing text = Burmese). DOM overlay — cheap,
/// crisp on every DPI, no canvas text baking.

export type Hud = {
  setHp(hp: number): void;
  setAmmo(mag: number, reserve: number, reloading: boolean): void;
  setScore(blue: number, red: number): void;
  kill(text: string): void;
  hitmarker(head: boolean): void;
  damage(): void;
  banner(text: string): void;
  setLocked(locked: boolean): void;
  root: HTMLElement;
};

export function createHud(parent: HTMLElement): Hud {
  const root = document.createElement("div");
  root.style.cssText =
    "position:absolute;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;user-select:none";
  parent.appendChild(root);

  // Phone layout: the desktop HUD put HP/ammo in the bottom corners — right
  // where the touch joystick and fire buttons sit — and the banner text ran
  // into the start-screen title. On touch everything compacts: HP+ammo become
  // pills under the ⚙ gear (top-left), the feed/score shrink, and the start
  // screen explains the TOUCH controls, not WASD.
  const touch =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

  const hpBox = touch
    ? "left:10px;top:54px;display:flex;gap:8px;align-items:baseline;background:rgba(0,0,0,.4);border-radius:16px;padding:3px 10px"
    : "left:16px;bottom:14px;display:flex;gap:14px;align-items:baseline";
  const ammoBox = touch
    ? "left:10px;top:92px;text-align:left;background:rgba(0,0,0,.4);border-radius:16px;padding:3px 10px"
    : "right:16px;bottom:14px;text-align:right";
  const bigFont = touch ? 20 : 30;
  const startText = touch
    ? "မျက်နှာပြင်ကို တို့ပြီး စတင်ပါ<br>ဘယ်ဘက် ⭕ ရွှေ့ · ညာဘက် ဆွဲပြီး ချိန် · 🔫 ပစ် · 🎯 ချိန်ကွင်း · 🔄 ကျည်ဖြည့် · ⬆ ခုန်"
    : "ကလစ်နှိပ်ပြီး စတင်ပါ — WASD ရွှေ့ · Mouse ချိန် · Left ပစ် · Right ချိန်ကွင်း · R ကျည်ဖြည့် · Shift ပြေး";

  root.innerHTML = `
    <div id="xh" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:18px;opacity:.9">＋</div>
    <div id="hm" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:26px;opacity:0;color:#ff5544;transition:opacity .15s">✕</div>
    <div style="position:absolute;${hpBox};text-shadow:0 1px 3px #000">
      <span style="font-size:12px;opacity:.8">❤️</span>
      <span id="hp" style="font-size:${bigFont}px;font-weight:700">100</span>
    </div>
    <div style="position:absolute;${ammoBox};text-shadow:0 1px 3px #000">
      <div id="ammo" style="font-size:${bigFont}px;font-weight:700">30 / 90</div>
      <div id="rl" style="font-size:11px;color:#ffd76a;visibility:hidden">ကျည်ဖြည့်နေသည်…</div>
    </div>
    <div id="score" style="position:absolute;left:50%;top:${touch ? 6 : 10}px;transform:translateX(-50%);display:flex;gap:10px;font-weight:700;font-size:${touch ? 15 : 20}px;text-shadow:0 1px 3px #000">
      <span style="color:#7fa8ff">0</span><span style="opacity:.6;font-size:${touch ? 11 : 13}px;align-self:center">BLUE — RED</span><span style="color:#ff9080">0</span>
    </div>
    <div id="kf" style="position:absolute;right:10px;top:${touch ? 122 : 52}px;display:flex;flex-direction:column;gap:4px;align-items:flex-end;font-size:${touch ? 11 : 12}px;max-width:46vw"></div>
    <div id="bn" style="position:absolute;left:50%;top:${touch ? "13%" : "26%"};transform:translateX(-50%);width:max-content;max-width:86vw;text-align:center;font-size:${touch ? 14 : 22}px;font-weight:700;background:rgba(4,8,14,.6);border-radius:10px;padding:6px 14px;text-shadow:0 2px 6px #000;opacity:0;transition:opacity .3s"></div>
    <div id="dmg" style="position:absolute;inset:0;box-shadow:inset 0 0 120px rgba(255,30,30,.55);opacity:0;transition:opacity .25s"></div>
    <div id="lock" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,10,16,.72)">
      <div style="text-align:center;max-width:86vw">
        <div style="font-size:${touch ? 26 : 34}px;font-weight:800;letter-spacing:2px">GWAVE <span style="color:#39d98a">STRIKE</span></div>
        <div style="margin-top:10px;font-size:${touch ? 13 : 14}px;opacity:.85;line-height:1.7">${startText}</div>
      </div>
    </div>`;

  const el = <T extends HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`)!;
  const hp = el<HTMLElement>("hp");
  const ammo = el<HTMLElement>("ammo");
  const rl = el<HTMLElement>("rl");
  const score = el<HTMLElement>("score");
  const kf = el<HTMLElement>("kf");
  const bn = el<HTMLElement>("bn");
  const hm = el<HTMLElement>("hm");
  const dmg = el<HTMLElement>("dmg");
  const lock = el<HTMLElement>("lock");

  let hmT = 0;
  let bnT = 0;

  return {
    root,
    setHp(v) {
      hp.textContent = String(Math.max(0, Math.round(v)));
      hp.style.color = v > 60 ? "#fff" : v > 30 ? "#ffd76a" : "#ff6655";
    },
    setAmmo(m, r, reloading) {
      ammo.textContent = `${m} / ${r}`;
      rl.style.visibility = reloading ? "visible" : "hidden";
    },
    setScore(b, r) {
      score.innerHTML = `<span style="color:#7fa8ff">${b}</span><span style="opacity:.6;font-size:13px;align-self:center">BLUE — RED</span><span style="color:#ff9080">${r}</span>`;
    },
    kill(text) {
      const row = document.createElement("div");
      row.style.cssText =
        "background:rgba(0,0,0,.45);padding:2px 8px;border-radius:4px;backdrop-filter:blur(2px)";
      row.textContent = text;
      kf.prepend(row);
      while (kf.children.length > 5) kf.lastChild?.remove();
      setTimeout(() => row.remove(), 6000);
    },
    hitmarker(head) {
      hm.style.color = head ? "#ffd025" : "#ff5544";
      hm.style.opacity = "1";
      clearTimeout(hmT);
      hmT = window.setTimeout(() => (hm.style.opacity = "0"), 120);
    },
    damage() {
      dmg.style.opacity = "1";
      setTimeout(() => (dmg.style.opacity = "0"), 220);
    },
    banner(text) {
      bn.textContent = text;
      bn.style.opacity = "1";
      clearTimeout(bnT);
      bnT = window.setTimeout(() => (bn.style.opacity = "0"), 2600);
    },
    setLocked(locked) {
      lock.style.display = locked ? "none" : "flex";
    },
  };
}
