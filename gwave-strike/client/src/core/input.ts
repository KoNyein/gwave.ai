/// Keyboard + mouse input with pointer lock (touch arrives in Phase 5).

export type InputState = {
  f: number;
  s: number; // strafe: -1 left, +1 right
  run: boolean;
  crouch: boolean;
  jump: boolean;
  fire: boolean;
  ads: boolean;
  reload: boolean;
  yaw: number;
  pitch: number;
};

export class Input {
  readonly state: InputState = {
    f: 0,
    s: 0,
    run: false,
    crouch: false,
    jump: false,
    fire: false,
    ads: false,
    reload: false,
    yaw: 0,
    pitch: 0,
  };
  sensitivity = 0.0023;
  private keys = new Set<string>();
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
    el.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    el.addEventListener("click", () => {
      if (document.pointerLockElement !== el) el.requestPointerLock();
    });
  }

  get locked(): boolean {
    return document.pointerLockElement === this.el;
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.type === "keydown") this.keys.add(e.code);
    else this.keys.delete(e.code);
    const k = this.keys;
    const s = this.state;
    s.f = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    s.s = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    s.run = k.has("ShiftLeft") || k.has("ShiftRight");
    s.crouch = k.has("ControlLeft") || k.has("KeyC");
    s.jump = k.has("Space");
    s.reload = k.has("KeyR");
    if (e.type === "keydown" && e.code === "Space") e.preventDefault();
  };

  private onMouseDown = (e: MouseEvent) => {
    if (!this.locked) return;
    if (e.button === 0) this.state.fire = true;
    if (e.button === 2) this.state.ads = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.state.fire = false;
    if (e.button === 2) this.state.ads = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return;
    this.state.yaw -= e.movementX * this.sensitivity;
    this.state.pitch -= e.movementY * this.sensitivity;
    const lim = Math.PI / 2 - 0.02;
    this.state.pitch = Math.max(-lim, Math.min(lim, this.state.pitch));
  };

  /// Recoil kicks the view — server-validated spread stays separate
  kick(pitchUp: number, yawDrift: number) {
    this.state.pitch = Math.min(Math.PI / 2 - 0.02, this.state.pitch + pitchUp);
    this.state.yaw += yawDrift;
  }
}
