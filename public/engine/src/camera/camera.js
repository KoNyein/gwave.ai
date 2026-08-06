// camera/camera.js — third-person spring camera for play mode (spec §8)
// Edit mode uses OrbitControls (editor.js); this runs only while playing.

import * as THREE from "three";

export function createFollowCam(camera, canvas) {
  let yaw = Math.PI;
  let pitch = 0.35;
  let dist = 6;
  let dragging = false;
  let px = 0;
  let py = 0;
  let enabled = false;

  canvas.addEventListener("pointerdown", (e) => {
    if (!enabled || e.target.closest?.("[data-ui]")) return;
    dragging = true;
    px = e.clientX;
    py = e.clientY;
  });
  addEventListener("pointerup", () => (dragging = false));
  addEventListener("pointermove", (e) => {
    if (!dragging || !enabled) return;
    yaw -= (e.clientX - px) * 0.005;
    pitch = THREE.MathUtils.clamp(pitch - (e.clientY - py) * 0.005, -0.1, 1.05);
    px = e.clientX;
    py = e.clientY;
  });
  addEventListener("wheel", (e) => {
    if (enabled) dist = THREE.MathUtils.clamp(dist + e.deltaY * 0.01, 2, 14);
  });

  return {
    get yaw() {
      return yaw;
    },
    setEnabled(v) {
      enabled = v;
    },
    follow(pos, dt) {
      const cx = Math.sin(yaw) * Math.cos(pitch) * dist;
      const cy = Math.sin(pitch) * dist + 1.6;
      const cz = Math.cos(yaw) * Math.cos(pitch) * dist;
      camera.position.lerp(
        new THREE.Vector3(pos[0] - cx, pos[1] + cy, pos[2] - cz),
        1 - Math.pow(0.002, dt),
      );
      camera.lookAt(pos[0], pos[1] + 1.3, pos[2]);
    },
  };
}
