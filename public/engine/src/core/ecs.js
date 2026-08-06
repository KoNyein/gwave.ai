// core/ecs.js — gwave-engine ECS (spec §3)
// Entity = id + component map · Component = data only · System = logic over a
// component query. Systems talk through the event bus, never to each other.

export class EventBus {
  constructor() {
    this.handlers = new Map(); // event -> Set<fn>
  }
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.handlers.get(event)?.delete(fn);
  }
  emit(event, payload) {
    for (const fn of this.handlers.get(event) ?? []) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[ecs] handler for "${event}" threw`, err);
      }
    }
  }
  clear() {
    this.handlers.clear();
  }
}

let nextId = 1;

export class Entity {
  constructor(world, name) {
    this.id = `e${nextId++}`;
    this.name = name ?? this.id;
    this.world = world;
    this.components = new Map(); // type -> data object
    this.state = {}; // scratch space for behaviors/scripts (never saved)
    this.alive = true;
  }
  add(type, data = {}) {
    this.components.set(type, data);
    this.world._index(this, type);
    return this;
  }
  get(type) {
    return this.components.get(type);
  }
  has(type) {
    return this.components.has(type);
  }
  remove(type) {
    this.components.delete(type);
    this.world._unindex(this, type);
  }
}

export class System {
  /** override: component types this system iterates */
  query = [];
  world = null;
  get entities() {
    return this.world.query(this.query);
  }
  init() {}
  fixedUpdate(_dt) {}
  update(_dt, _alpha) {}
  dispose() {}
}

export class World {
  constructor() {
    this.entities = new Map(); // id -> Entity
    this.byComponent = new Map(); // type -> Set<Entity>
    this.systems = [];
    this.events = new EventBus();
    /// game-state variables (score, hp …) — HUD binds via events
    this.vars = { score: 0, time: 0 };
  }

  createEntity(name) {
    const e = new Entity(this, name);
    this.entities.set(e.id, e);
    return e;
  }

  destroy(entity) {
    if (!entity || !entity.alive) return;
    entity.alive = false;
    for (const type of entity.components.keys()) this._unindex(entity, type);
    this.entities.delete(entity.id);
    this.events.emit("entityDestroyed", { entity });
  }

  _index(e, type) {
    if (!this.byComponent.has(type)) this.byComponent.set(type, new Set());
    this.byComponent.get(type).add(e);
  }
  _unindex(e, type) {
    this.byComponent.get(type)?.delete(e);
  }

  /** entities having ALL the given component types */
  query(types) {
    if (types.length === 0) return [];
    let smallest = null;
    for (const t of types) {
      const set = this.byComponent.get(t);
      if (!set || set.size === 0) return [];
      if (!smallest || set.size < smallest.size) smallest = set;
    }
    const out = [];
    for (const e of smallest) {
      if (e.alive && types.every((t) => e.components.has(t))) out.push(e);
    }
    return out;
  }

  addSystem(system) {
    system.world = this;
    this.systems.push(system);
    system.init();
    return system;
  }

  fixedUpdate(dt) {
    this.vars.time += dt;
    for (const s of this.systems) s.fixedUpdate(dt);
  }

  update(dt, alpha) {
    for (const s of this.systems) s.update(dt, alpha);
  }

  clearEntities() {
    for (const e of [...this.entities.values()]) this.destroy(e);
    this.vars = { score: 0, time: 0 };
  }
}
