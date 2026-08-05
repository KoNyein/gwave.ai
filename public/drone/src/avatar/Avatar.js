// avatar/Avatar.js — gwave 3D-scan human avatar
// Skeleton standard: Mixamo bone names → scanned rigged GLB နဲ့ procedural mannequin
// နှစ်မျိုးလုံးကို Motions.js တစ်ခုတည်းက မောင်းနိုင်သည် (bone-name driven)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export const BONES = {
  hips: 'Hips', spine: 'Spine', spine1: 'Spine1', spine2: 'Spine2',
  neck: 'Neck', head: 'Head',
  shoulderL: 'LeftShoulder', armL: 'LeftArm', foreL: 'LeftForeArm', handL: 'LeftHand',
  shoulderR: 'RightShoulder', armR: 'RightArm', foreR: 'RightForeArm', handR: 'RightHand',
  upLegL: 'LeftUpLeg', legL: 'LeftLeg', footL: 'LeftFoot', toeL: 'LeftToeBase',
  upLegR: 'RightUpLeg', legR: 'RightLeg', footR: 'RightFoot', toeR: 'RightToeBase',
};

// bone name fuzzy match — "mixamorig:Hips" / "mixamorigHips" / "Hips" အားလုံးမိစေ
function matchBone(root, name) {
  let found = null;
  const low = name.toLowerCase();
  root.traverse(o => {
    if (found || !o.isBone) return;
    const n = o.name.toLowerCase().replace(/^mixamorig[:_]?/, '');
    if (n === low) found = o;
  });
  return found;
}

export class Avatar {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();          // world transform (position/heading)
    scene.add(this.root);
    this.bones = {};                        // key → THREE.Bone
    this.rest = {};                         // key → rest quaternion (clone)
    this.height = 1.7;
    this.source = 'MANNEQUIN';              // MANNEQUIN | SCAN_RIGGED | SCAN_STATIC
    this._buildMannequin();
  }

  // ---------- gwave 3D scan GLB ----------
  async loadScan(url) {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/');
    loader.setDRACOLoader(draco);
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;

    // rigged scan? — Hips bone ရှာ
    const hips = matchBone(model, 'Hips');
    this.root.clear();
    this.bones = {}; this.rest = {};

    if (hips) {
      this.source = 'SCAN_RIGGED';
      for (const [key, name] of Object.entries(BONES)) {
        const b = matchBone(model, name);
        if (b) { this.bones[key] = b; this.rest[key] = b.quaternion.clone(); }
      }
    } else {
      this.source = 'SCAN_STATIC';          // rig မပါ — static ပြရုံ (production: auto-rig service)
    }
    // normalize height → 1.7m
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    if (h > 0.1) model.scale.setScalar(1.7 / h);
    model.traverse(o => { o.castShadow = true; });
    this.root.add(model);
    return this.source;
  }

  // ---------- procedural mannequin (scan မရသေးရင် default) ----------
  _buildMannequin() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x9aa7b8, roughness: 0.8 });
    const acc = new THREE.MeshStandardMaterial({ color: 0x35e0b8, roughness: 0.6 });
    const mk = (key, parentKey, pos, meshDef) => {
      const b = new THREE.Bone();
      b.name = BONES[key];
      b.position.set(...pos);
      (parentKey ? this.bones[parentKey] : this.root).add(b);
      this.bones[key] = b;
      this.rest[key] = b.quaternion.clone();
      if (meshDef) {
        const m = new THREE.Mesh(meshDef.geo, meshDef.acc ? acc : mat);
        m.position.set(...(meshDef.at ?? [0, 0, 0]));
        m.castShadow = true;
        b.add(m);
      }
      return b;
    };
    const cap = (r, h) => new THREE.CapsuleGeometry(r, h, 3, 8);

    mk('hips',   null,     [0, 0.95, 0], { geo: new THREE.BoxGeometry(0.30, 0.16, 0.18) });
    mk('spine',  'hips',   [0, 0.12, 0]);
    mk('spine1', 'spine',  [0, 0.12, 0], { geo: new THREE.BoxGeometry(0.32, 0.26, 0.18), at: [0, 0.06, 0] });
    mk('spine2', 'spine1', [0, 0.14, 0]);
    mk('neck',   'spine2', [0, 0.10, 0]);
    mk('head',   'neck',   [0, 0.08, 0], { geo: new THREE.SphereGeometry(0.11, 12, 10), at: [0, 0.10, 0] });
    // arms (T-pose: down along body via rest rotation below)
    for (const s of ['L', 'R']) {
      const sign = s === 'L' ? -1 : 1;
      mk('shoulder' + s, 'spine2', [sign * 0.09, 0.08, 0]);
      mk('arm' + s,  'shoulder' + s, [sign * 0.11, 0, 0], { geo: cap(0.045, 0.20), at: [sign * 0.13, 0, 0] });
      mk('fore' + s, 'arm' + s,  [sign * 0.27, 0, 0], { geo: cap(0.04, 0.18), at: [sign * 0.12, 0, 0] });
      mk('hand' + s, 'fore' + s, [sign * 0.25, 0, 0], { geo: new THREE.BoxGeometry(0.07, 0.03, 0.09), acc: true });
      // rotate upper arm down (rest pose = A-pose)
      this.bones['arm' + s].rotation.z = sign * 1.25;
      this.rest['arm' + s] = this.bones['arm' + s].quaternion.clone();
    }
    // legs
    for (const s of ['L', 'R']) {
      const sign = s === 'L' ? -1 : 1;
      mk('upLeg' + s, 'hips', [sign * 0.10, -0.06, 0], { geo: cap(0.06, 0.30), at: [0, -0.20, 0] });
      mk('leg' + s,  'upLeg' + s, [0, -0.44, 0], { geo: cap(0.05, 0.28), at: [0, -0.19, 0] });
      mk('foot' + s, 'leg' + s,  [0, -0.44, 0], { geo: new THREE.BoxGeometry(0.09, 0.05, 0.22), at: [0, -0.03, 0.06], acc: true });
      this.rest['upLeg' + s] = this.bones['upLeg' + s].quaternion.clone();
    }
    // upper-leg bones point down already via position; store rests done in mk
    this.source = 'MANNEQUIN';
  }

  // Motions.js helper — rest pose ကနေ euler offset apply
  setBone(key, x = 0, y = 0, z = 0) {
    const b = this.bones[key];
    if (!b) return;
    b.quaternion.copy(this.rest[key]);
    if (x || y || z) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
      b.quaternion.multiply(q);
    }
  }
}
