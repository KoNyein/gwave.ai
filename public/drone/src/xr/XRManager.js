// xr/XRManager.js — WebXR VR + AR modes
// VR: 'SCREEN' comfort mode (floating FPV screen) | 'FULL' immersive FPV
// AR: tabletop miniature (hit-test placement, 1:50 scale)
import * as THREE from 'three';

export class XRManager {
  constructor(renderer, scene, worldGroup, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.world = worldGroup;          // scalable world (AR miniature)
    this.camera = camera;
    this.mode = 'NONE';               // NONE | VR | AR
    this.vrView = 'SCREEN';           // SCREEN | FULL
    this.session = null;
    this.sticks = null;               // {lx,ly,rx,ry} — VR controller gimbals
    this.hitTestSource = null;
    this.reticle = null;
    this.placed = false;

    renderer.xr.enabled = true;

    // ---- comfort environment (VR SCREEN mode) ----
    this.comfortRoom = new THREE.Group();
    const grid = new THREE.GridHelper(10, 20, 0x2c3a5e, 0x18223a);
    this.comfortRoom.add(grid);
    // FPV virtual screen (16:9 @ 2.2m)
    this.rt = new THREE.WebGLRenderTarget(1280, 720);
    this.screenMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.35),
      new THREE.MeshBasicMaterial({ map: this.rt.texture }));
    this.screenMesh.position.set(0, 1.5, -2.2);
    this.comfortRoom.add(this.screenMesh);
    this.comfortRoom.visible = false;
    scene.add(this.comfortRoom);

    // AR reticle
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.1, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x35e0b8 }));
    this.reticle.visible = false;
    scene.add(this.reticle);
  }

  // ---------- session entry ----------
  async supported() {
    if (!navigator.xr) return { vr: false, ar: false };
    const [vr, ar] = await Promise.all([
      navigator.xr.isSessionSupported('immersive-vr').catch(() => false),
      navigator.xr.isSessionSupported('immersive-ar').catch(() => false),
    ]);
    return { vr, ar };
  }

  async enterVR() {
    const s = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor'],
    });
    this._bindSession(s, 'VR');
    this.renderer.xr.setReferenceSpaceType('local-floor');
    await this.renderer.xr.setSession(s);
    this.setVRView(this.vrView);
  }

  async enterAR() {
    const s = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: document.getElementById('osd') },
    });
    this._bindSession(s, 'AR');
    this.renderer.xr.setReferenceSpaceType('local');
    await this.renderer.xr.setSession(s);
    // world → miniature, hide until placed
    this.world.visible = false;
    this.placed = false;
    const space = await s.requestReferenceSpace('viewer');
    this.hitTestSource = await s.requestHitTestSource({ space });
    // tap to place
    s.addEventListener('select', () => {
      if (!this.placed && this.reticle.visible) {
        this.world.position.setFromMatrixPosition(this.reticle.matrix);
        this.world.scale.setScalar(1 / 50);        // 1:50 tabletop
        this.world.visible = true;
        this.placed = true;
        this.reticle.visible = false;
      }
    });
  }

  _bindSession(s, mode) {
    this.session = s;
    this.mode = mode;
    s.addEventListener('end', () => {
      this.mode = 'NONE'; this.session = null; this.sticks = null;
      this.comfortRoom.visible = false;
      this.world.visible = true;
      this.world.scale.setScalar(1);
      this.world.position.set(0, 0, 0);
      this.hitTestSource = null;
    });
  }

  exit() { this.session?.end(); }

  setVRView(v) {
    this.vrView = v;
    if (this.mode === 'VR') this.comfortRoom.visible = (v === 'SCREEN');
  }

  // ---------- per-frame (call inside renderer.setAnimationLoop) ----------
  update(frame, dronePose) {
    if (this.mode === 'NONE') return;
    this._pollControllers();

    if (this.mode === 'AR' && frame && this.hitTestSource && !this.placed) {
      const hits = frame.getHitTestResults(this.hitTestSource);
      if (hits.length) {
        const pose = hits[0].getPose(this.renderer.xr.getReferenceSpace());
        this.reticle.visible = true;
        this.reticle.matrix.fromArray(pose.transform.matrix);
        this.reticle.matrixAutoUpdate = false;
      } else this.reticle.visible = false;
    }

    if (this.mode === 'VR' && this.vrView === 'SCREEN') {
      // keep screen in front of headset yaw
      const cam = this.renderer.xr.getCamera();
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      fwd.y = 0; fwd.normalize();
      this.screenMesh.position.copy(cam.position).addScaledVector(fwd, 2.2);
      this.screenMesh.position.y = cam.position.y + 0.1;
      this.screenMesh.lookAt(cam.position);
    }
  }

  // VR FULL mode: teleport XR rig to drone pose (experienced pilots only)
  applyFullFPV(rig, dronePos, droneQuat, camAngleDeg) {
    if (this.mode !== 'VR' || this.vrView !== 'FULL') return false;
    rig.position.copy(dronePos);
    rig.quaternion.copy(droneQuat);
    rig.rotateX(camAngleDeg * Math.PI / 180);
    return true;
  }

  // render drone-cam → virtual screen (SCREEN mode)
  renderToScreen(fpvCamera) {
    if (this.mode !== 'VR' || this.vrView !== 'SCREEN') return;
    const prevTarget = this.renderer.getRenderTarget();
    const prevXr = this.renderer.xr.enabled;
    this.renderer.xr.enabled = false;              // render FPV view with normal camera
    this.comfortRoom.visible = false;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene, fpvCamera);
    this.renderer.setRenderTarget(prevTarget);
    this.renderer.xr.enabled = prevXr;
    this.comfortRoom.visible = true;
  }

  // VR controller thumbsticks → virtual radio gimbals (Mode 2)
  _pollControllers() {
    const s = this.session;
    if (!s?.inputSources) return;
    let l = null, r = null;
    for (const src of s.inputSources) {
      if (!src.gamepad) continue;
      if (src.handedness === 'left') l = src.gamepad;
      if (src.handedness === 'right') r = src.gamepad;
    }
    if (l || r) {
      this.sticks = {
        lx: l?.axes[2] ?? 0, ly: l?.axes[3] ?? 0,   // xr-standard: axes[2,3] = thumbstick
        rx: r?.axes[2] ?? 0, ry: r?.axes[3] ?? 0,
        trigger: (r?.buttons[0]?.pressed || l?.buttons[0]?.pressed) ?? false,
        squeeze: (r?.buttons[1]?.pressed || l?.buttons[1]?.pressed) ?? false,
      };
      // per-hand haptics
      this._hapt = (hand, mag, ms) => {
        const g = hand === 'left' ? l : r;
        g?.hapticActuators?.[0]?.pulse?.(mag, ms);
      };
    } else this.sticks = null;
  }

  haptic(hand, mag, ms) { this._hapt?.(hand, mag, ms); }
}
