// ============================================================
// EnemyBot.js — GWAVE STRIKE ရန်သူ AI Bot (RED team)
// State: wander (လျှောက်လည်) → chase (လိုက်) → shoot (ပစ်)
// LoS (Line of Sight) ကို Physics colliders ဖြင့် စစ်သည် — နံရံနောက်ကွယ်မမြင်
// ============================================================
import * as THREE from 'three';

const _ray = new THREE.Ray();
const _tmp = new THREE.Vector3();

export class EnemyBot {
  constructor({ name, spawn, physics }) {
    this.name = name;
    this.spawnPoint = spawn.clone();
    this.physics = physics;
    this.hp = 100;
    this.alive = true;
    this.speed = 3.2;
    this.fireTimer = 1 + Math.random() * 2;
    this.respawnTimer = 0;
    this.waitTimer = 0;

    this.group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.0, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8324a, roughness: 0.55 })
    );
    body.position.y = 0.95; body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a2f3a })
    );
    head.position.y = 1.75;
    this.bodyMesh = body; this.headMesh = head;
    body.userData.bot = this; head.userData.bot = this; // ပစ်မှတ်စစ်ရန်
    this.group.add(body, head);
    this.group.position.copy(this.spawnPoint);
    this.pickTarget();
  }

  get position() { return this.group.position; }
  get headPos() { return _tmp.set(this.position.x, this.position.y + 1.7, this.position.z).clone(); }

  pickTarget() {
    const a = Math.random() * Math.PI * 2;
    this.target = new THREE.Vector3(
      this.spawnPoint.x + Math.cos(a) * 10, 0, this.spawnPoint.z + Math.sin(a) * 10
    );
    this.waitTimer = 0.5 + Math.random() * 2;
  }

  hasLoS(playerHead) {
    const from = this.headPos;
    const dir = playerHead.clone().sub(from);
    const dist = dir.length();
    if (dist > 45) return false; // မြင်ကွင်းအကွာအဝေး
    _ray.set(from, dir.normalize());
    return !this.physics.blocked(_ray, dist - 0.5, _tmp);
  }

  takeDamage(dmg) {
    if (!this.alive) return false;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.alive = false;
      this.group.visible = false;
      this.respawnTimer = 4; // ၄ စက္ကန့်အကြာ ပြန်ထွက်မည်
      return true; // သေဆုံး
    }
    return false;
  }

  // ပြန်တွက် — fire လုပ်သင့်လျှင် true ပြန် (StrikeRoom က ကျည်/damage ကိုင်တွယ်)
  update(dt, playerPos, playerHead) {
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.alive = true; this.hp = 100;
        this.group.visible = true;
        this.group.position.copy(this.spawnPoint);
      }
      return false;
    }

    const pos = this.group.position;
    const distToPlayer = pos.distanceTo(playerPos);
    const seesPlayer = distToPlayer < 45 && this.hasLoS(playerHead);

    if (seesPlayer && distToPlayer > 12) {
      // Chase — ကစားသမားဆီ ချဉ်းကပ်
      const dir = _tmp.subVectors(playerPos, pos).setY(0).normalize();
      pos.addScaledVector(dir, this.speed * dt);
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    } else if (!seesPlayer) {
      // Wander
      const dir = _tmp.subVectors(this.target, pos).setY(0);
      if (dir.length() > 0.4) {
        dir.normalize();
        pos.addScaledVector(dir, this.speed * 0.5 * dt);
        this.group.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        this.waitTimer -= dt;
        if (this.waitTimer <= 0) this.pickTarget();
      }
    } else {
      // အနီးရောက်ပြီ — ကစားသမားဘက် မျက်နှာမူ
      const dir = _tmp.subVectors(playerPos, pos);
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
    }

    this.physics.resolveHorizontal(pos, 0.4, 1.8);

    // ပစ်ခတ်မှု အချိန်ကိုက်
    this.fireTimer -= dt;
    if (seesPlayer && this.fireTimer <= 0) {
      this.fireTimer = 1.2 + Math.random() * 0.8;
      return true; // StrikeRoom → tracer + damage
    }
    return false;
  }
}
