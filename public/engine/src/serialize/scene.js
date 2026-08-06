// serialize/scene.js — .gwave.json v2 save/load + v1 auto-upgrade (spec §11)
// v1 = the MVP seed format (world-maker/mvp.html); the loader upgrades it so
// worlds built in the old editor keep opening forever.

export const SCENE_VERSION = 2;

/** ECS world → scene JSON (only editor-authored entities, no player) */
export function saveScene(world, meta) {
  const entities = [];
  for (const e of world.entities.values()) {
    if (e.state.runtime) continue; // player/spawned-at-play entities
    const t = e.get("Transform");
    const m = e.get("MeshRef");
    if (!t || !m) continue;
    entities.push({
      id: e.name,
      meshRef: {
        kind: m.kind,
        color: m.color,
        glbUrl: m.glbUrl,
        isCharacter: m.isCharacter || undefined,
        animLib: m.animLib || undefined,
        cullDistance: m.cullDistance || undefined,
        lod: Array.isArray(m.lod) && m.lod.length ? m.lod : undefined,
      },
      transform: {
        pos: [...t.pos],
        rotY: t.euler?.[1] ?? 0,
        scale: t.scale ?? 1,
      },
      rigidBody: e.get("RigidBody") ?? undefined,
      behaviors: e.get("Behavior") ?? [],
      character: e.get("Character") ?? undefined,
    });
  }
  return {
    version: SCENE_VERSION,
    name: meta.name ?? "My Game",
    env: { preset: meta.env ?? "night" },
    settings: { winCondition: meta.winCondition ?? "none" },
    entities,
  };
}

/** scene JSON (v1 or v2) → normalized v2 shape */
export function normalizeScene(data) {
  if (!data || typeof data !== "object") throw new Error("not a scene file");
  if (data.version === 2 && Array.isArray(data.entities) && data.entities[0]?.meshRef !== undefined) {
    return data;
  }
  // v1 (MVP seed) upgrade
  const entities = (data.entities ?? []).map((o, i) => ({
    id: o.name ?? `object_${i}`,
    meshRef: {
      kind: o.type === "glb" || o.type === "character" ? undefined : o.type,
      color: o.color ? parseInt(o.color.replace("#", ""), 16) : undefined,
      glbUrl: o.glbUrl ?? undefined,
      isCharacter: o.isChar || undefined,
    },
    transform: {
      pos: o.transform?.pos ?? [0, 0.5, 0],
      rotY: o.transform?.rotY ?? 0,
      scale: o.transform?.scale ?? 1,
    },
    rigidBody:
      o.rigidType && o.rigidType !== "static" ? { type: o.rigidType } : undefined,
    behaviors: o.behaviors ?? [],
    character: o.character ?? undefined,
  }));
  return {
    version: SCENE_VERSION,
    name: data.name ?? "Game",
    env: { preset: typeof data.env === "string" ? data.env : (data.env?.preset ?? "night") },
    settings: { winCondition: data.winCondition ?? data.settings?.winCondition ?? "none" },
    entities,
  };
}

/** scene JSON → ECS entities (editor-authored set) */
export function loadScene(world, data) {
  const scene = normalizeScene(data);
  for (const o of scene.entities) {
    const e = world.createEntity(o.id);
    e.add("Transform", {
      pos: [...(o.transform.pos ?? [0, 0.5, 0])],
      euler: [0, o.transform.rotY ?? 0, 0],
      scale: o.transform.scale ?? 1,
    });
    e.add("MeshRef", { ...o.meshRef });
    if (o.rigidBody) e.add("RigidBody", { ...o.rigidBody });
    e.add("Behavior", (o.behaviors ?? []).map((b) => ({ ...b })));
    if (o.character) e.add("Character", { ...o.character });
  }
  return scene;
}
