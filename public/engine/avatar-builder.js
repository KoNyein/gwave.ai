// gWave — shared procedural avatar builder.
// buildAvatar(THREE, cfg) -> THREE.Group  (used by the customizer, Studio play, multiplayer, XR)
// Keeps every user's avatar consistent everywhere in gWave.

export const DEFAULT_AVATAR = {
  version: 1,
  name: "Explorer",
  height: 1.0,          // 0.7 .. 1.3 multiplier
  bodyColor: "#5aa9ff",
  skin: "#ffd9b0",
  head: "round",        // round | square | robot
  hat: "none",          // none | cap | crown | antenna | halo
  face: "smile",        // smile | cool | star | dot
  accessory: "none",    // none | cape | backpack | wings | tail
  accentColor: "#7de3c3",
  glbUrl: null,         // optional custom mesh / VRM (overrides procedural)
};

export function buildAvatar(THREE, cfgIn) {
  const c = { ...DEFAULT_AVATAR, ...(cfgIn || {}) };
  const g = new THREE.Group();
  g.userData.avatar = c;
  const mat = (col, rough = 0.55, metal = 0.05) =>
    new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal });
  const h = c.height;

  // ---- body ----
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.9 * h, 6, 14), mat(c.bodyColor));
  body.position.y = (0.85) * h; body.castShadow = true; g.add(body);

  // ---- head ----
  let headGeo;
  if (c.head === "square") headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  else if (c.head === "robot") headGeo = new THREE.BoxGeometry(0.62, 0.5, 0.55);
  else headGeo = new THREE.SphereGeometry(0.32, 22, 16);
  const head = new THREE.Mesh(headGeo, mat(c.skin, 0.6));
  head.position.y = (1.68) * h; head.castShadow = true; g.add(head);
  const hy = head.position.y;

  // ---- face ----
  const eyeMat = mat(0x222222, 0.4);
  const eye = x => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeMat); m.position.set(x, hy + 0.03, 0.29); return m; };
  if (c.face === "cool") {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.05), mat(0x111318, 0.3));
    bar.position.set(0, hy + 0.03, 0.29); g.add(bar);
  } else if (c.face === "star") {
    g.add(eye(-0.11)); const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.07), mat(c.accentColor)); s.position.set(0.12, hy + 0.03, 0.29); g.add(s);
  } else { g.add(eye(-0.11), eye(0.11)); }
  if (c.face === "smile") {
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 8, 12, Math.PI), mat(0x7a3b32));
    mouth.rotation.z = Math.PI; mouth.position.set(0, hy - 0.09, 0.29); g.add(mouth);
  }

  // ---- hat ----
  if (c.hat === "cap") {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(c.accentColor));
    cap.position.y = hy + 0.16; g.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 18, 1, false, 0, Math.PI), mat(c.accentColor));
    brim.position.set(0, hy + 0.12, 0.2); g.add(brim);
  } else if (c.hat === "crown") {
    const cr = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.28, 5), mat(0xffd85e, 0.3, 0.6));
    cr.position.y = hy + 0.32; g.add(cr);
  } else if (c.hat === "antenna") {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35), mat(0x888888)); rod.position.y = hy + 0.42; g.add(rod);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat(c.accentColor)); ball.position.y = hy + 0.62; g.add(ball);
  } else if (c.hat === "halo") {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 10, 24), mat(0xffe37d, 0.2, 0.4));
    halo.rotation.x = Math.PI / 2; halo.position.y = hy + 0.4; g.add(halo);
  }

  // ---- accessory ----
  if (c.accessory === "cape") {
    const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0 * h), new THREE.MeshStandardMaterial({ color: c.accentColor, side: THREE.DoubleSide, roughness: 0.6 }));
    cape.position.set(0, 1.0 * h, -0.3); cape.rotation.x = 0.2; g.add(cape);
  } else if (c.accessory === "backpack") {
    const bp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.2), mat(c.accentColor)); bp.position.set(0, 1.0 * h, -0.34); g.add(bp);
  } else if (c.accessory === "wings") {
    const wingMat = new THREE.MeshStandardMaterial({ color: c.accentColor, side: THREE.DoubleSide, roughness: 0.5, transparent: true, opacity: 0.85 });
    [-1, 1].forEach(s => { const w = new THREE.Mesh(new THREE.CircleGeometry(0.45, 3), wingMat); w.position.set(s * 0.35, 1.05 * h, -0.28); w.rotation.set(0.2, s * 0.7, s * 0.4); g.add(w); });
  } else if (c.accessory === "tail") {
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.6, 8), mat(c.accentColor)); tail.position.set(0, 0.5 * h, -0.3); tail.rotation.x = -0.8; g.add(tail);
  }

  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// small helper: load avatar cfg from browser storage (set by the customizer)
export function loadSavedAvatar() {
  try { const s = localStorage.getItem("gwave_avatar"); return s ? JSON.parse(s) : { ...DEFAULT_AVATAR }; }
  catch { return { ...DEFAULT_AVATAR }; }
}
