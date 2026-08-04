import * as THREE from "three";
import type RAPIER_NS from "@dimforge/rapier3d-compat";

import { MAP_HALF } from "@gwave-strike/shared";

/// Open-world terrain + lighting + cover crates (blueprint §2.2).
/// The prototype's sin/cos terrain becomes a Rapier heightfield collider so
/// the character controller can walk it 1:1 with what is rendered.

export function terrainHeight(x: number, z: number): number {
  return (
    Math.sin(x * 0.045) * Math.cos(z * 0.038) * 2.2 +
    Math.sin(x * 0.012 + 1.7) * 3.5 +
    Math.cos(z * 0.017 + 0.4) * 2.6
  );
}

export type World = {
  scene: THREE.Scene;
  /// Solid colliders for hitscan + movement
  physics: RAPIER_NS.World;
  crates: THREE.Mesh[];
};

export function buildWorld(RAPIER: typeof RAPIER_NS): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87a8c8);
  scene.fog = new THREE.Fog(0x87a8c8, 60, 240);

  // ── Lighting ──
  const sun = new THREE.DirectionalLight(0xfff2df, 2.4);
  sun.position.set(60, 90, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbdd4ee, 0x4a5136, 0.9));

  // ── Physics world ──
  const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  // ── Terrain mesh + heightfield collider ──
  const N = 96; // samples per side
  const size = MAP_HALF * 2;
  const geo = new THREE.PlaneGeometry(size, size, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: 0x5e7a45, roughness: 1 }),
  );
  terrain.receiveShadow = true;
  scene.add(terrain);

  // Rapier heightfield: column-major heights over (nrows+1)*(ncols+1) grid
  const heights = new Float32Array((N + 1) * (N + 1));
  for (let col = 0; col <= N; col++) {
    for (let row = 0; row <= N; row++) {
      const x = (col / N) * size - MAP_HALF;
      const z = (row / N) * size - MAP_HALF;
      heights[col * (N + 1) + row] = terrainHeight(x, z);
    }
  }
  physics.createCollider(
    RAPIER.ColliderDesc.heightfield(N, N, heights, {
      x: size,
      y: 1,
      z: size,
    }),
  );

  // ── Cover crates (deterministic scatter) ──
  const crates: THREE.Mesh[] = [];
  const crateGeo = new THREE.BoxGeometry(2, 2, 2);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6b43, roughness: 0.9 });
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < 40; i++) {
    const x = (rand() * 2 - 1) * (MAP_HALF - 8);
    const z = (rand() * 2 - 1) * (MAP_HALF - 8);
    const y = terrainHeight(x, z) + 1;
    const m = new THREE.Mesh(crateGeo, crateMat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    crates.push(m);
    physics.createCollider(
      RAPIER.ColliderDesc.cuboid(1, 1, 1).setTranslation(x, y, z),
    );
  }

  // ── Boundary walls (keep the fight inside) ──
  for (const [x, z, w, d] of [
    [0, -MAP_HALF, MAP_HALF, 1],
    [0, MAP_HALF, MAP_HALF, 1],
    [-MAP_HALF, 0, 1, MAP_HALF],
    [MAP_HALF, 0, 1, MAP_HALF],
  ] as const) {
    physics.createCollider(
      RAPIER.ColliderDesc.cuboid(w, 30, d).setTranslation(x, 10, z),
    );
  }

  return { scene, physics, crates };
}
