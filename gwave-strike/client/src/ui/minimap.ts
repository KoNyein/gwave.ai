import { MAP_HALF } from "@gwave-strike/shared";

/// Canvas minimap (blueprint §6) — top-right, self + teammates + spotted
/// enemies as dots, view cone for self.

export type MapDot = { x: number; z: number; team: number; me?: boolean };

export function createMinimap(parent: HTMLElement) {
  const c = document.createElement("canvas");
  const SIZE = 132;
  c.width = c.height = SIZE * (window.devicePixelRatio || 1);
  c.style.cssText = `position:absolute;top:10px;right:10px;width:${SIZE}px;height:${SIZE}px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(6,12,18,.55);pointer-events:none`;
  parent.appendChild(c);
  const ctx = c.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  return {
    draw(dots: MapDot[], yaw: number) {
      if (!ctx) return;
      const S = SIZE * dpr;
      ctx.clearRect(0, 0, S, S);
      const toPx = (v: number) => ((v + MAP_HALF) / (MAP_HALF * 2)) * S;
      for (const d of dots) {
        ctx.beginPath();
        ctx.fillStyle = d.me ? "#ffffff" : d.team === 0 ? "#6f9dff" : "#ff7f70";
        ctx.arc(toPx(d.x), toPx(d.z), (d.me ? 4 : 3) * dpr, 0, Math.PI * 2);
        ctx.fill();
        if (d.me) {
          ctx.strokeStyle = "rgba(255,255,255,.55)";
          ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath();
          ctx.moveTo(toPx(d.x), toPx(d.z));
          ctx.lineTo(
            toPx(d.x) + Math.sin(-yaw) * 12 * dpr,
            toPx(d.z) - Math.cos(-yaw) * 12 * dpr,
          );
          ctx.stroke();
        }
      }
    },
  };
}
