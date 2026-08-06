# gWave 3D Platform — Architecture & Roadmap

**Domain:** gwave.cc · **Host:** AWS · **Vision:** Auto 3D generator + object/room scanner + editable metaverse with third-party connectors.

> ဒီ document က platform တစ်ခုလုံးရဲ့ blueprint ပါ။ Module ၈ ခု၊ ဘယ် tech သုံးမလဲ၊ AWS မှာ ဘယ်လို deploy မလဲ၊ ဘယ် phase ကနေ စမလဲ၊ ခန့်မှန်း ကုန်ကျစရိတ် — အကုန် ပါပါတယ်။

---

## 1. System Overview

```
                        ┌─────────────────────────────────────────┐
                        │              gwave.cc (Web)              │
                        │  React + react-three-fiber (three.js)    │
                        │  Viewer · Editor · Scanner UI · Gallery  │
                        └───────────────┬─────────────────────────┘
                                        │ HTTPS / WebSocket
                        ┌───────────────▼─────────────────────────┐
                        │            API Gateway (Nginx)           │
                        │      Auth · Rate limit · Routing         │
                        └───┬───────────┬───────────┬─────────────┘
                            │           │           │
          ┌─────────────────▼──┐  ┌─────▼──────┐  ┌─▼─────────────┐
          │  Core API (Node)   │  │ 3D Worker  │  │ Realtime      │
          │  users, scenes,    │  │ (Python,   │  │ (Colyseus /   │
          │  assets, connectors│  │  GPU)      │  │  WebSocket)   │
          └──────┬─────────────┘  └─────┬──────┘  └───────────────┘
                 │                       │
        ┌────────▼────────┐   ┌──────────▼──────────┐
        │ Postgres        │   │  AWS S3 + CloudFront │
        │ (Supabase/RDS)  │   │  GLB / textures / img│
        └─────────────────┘   └─────────────────────┘
```

**မူ (principle):** GPU-heavy အလုပ်တွေ (3D generation, scanning) ကို **worker service** သီးသန့်ခွဲထား၊ web/API က light-weight ဖြစ်နေအောင်။ ဒါက scale လုပ်ရ လွယ်စေတယ် (GPU node တွေကို လိုသလို ထပ်ဖြည့်လို့ရ)။

---

## 2. The 8 Modules

### Module 1 — 3D Generator (image / text → 3D)  ⭐ MVP
- **Input:** ဓာတ်ပုံ ၁ ပုံ (သို့) စာသား prompt
- **Output:** `.glb` mesh (+ texture)
- **Self-host models (AWS GPU):**
  - `TripoSR` — အပေါ့ဆုံး, ~6GB VRAM, image ၁ ပုံ, ~1–2s/generation. **MVP အတွက် ဒါသုံး။**
  - `Hunyuan3D-2` (Tencent) — quality မြင့်, texture ပိုကောင်း, VRAM ~16–24GB. Phase 2 upgrade.
  - `TRELLIS` (Microsoft) — image/text နှစ်မျိုးလုံး, quality ကောင်း.
- **GPU:** AWS `g5.xlarge` (A10G 24GB) — TripoSR ရော Hunyuan3D ရော run နိုင်.
- **API-based fallback:** Meshy / Tripo / Rodin (GPU မဝယ်ချင်သေးရင် စမ်းဖို့).

### Module 2 — Object Scanner (photos → 3D)
- **နည်း ၂ မျိုး:**
  - *Photogrammetry:* COLMAP → mesh (ဓာတ်ပုံ ၂၀–၁၀၀ လို)
  - *Gaussian Splatting / NeRF:* `Nerfstudio`, `gsplat` — ပိုလှ, ပိုမြန် (video ကနေရ)
- **Mobile capture:** phone camera နဲ့ ဗီဒီယို/ပုံ ရိုက် → upload → server မှာ reconstruct
- **GPU:** `g5.2xlarge`+ (Gaussian splatting က VRAM စား)

### Module 3 — Room Scanner (အခန်း scan)
- **iOS (LiDAR):** Apple **RoomPlan** API — iPhone/iPad Pro နဲ့ အခန်းလိုက် USDZ/floor-plan ထုတ် (native app လို)
- **Cross-platform:** Gaussian Splatting နဲ့ အခန်းလုံး reconstruct (video ကနေ)
- **Output:** room mesh + object segmentation (furniture တစ်ခုချင်း ခွဲ)

### Module 4 — Metaverse World
- **Renderer:** three.js (react-three-fiber) — web-first
- **Networking:** `Colyseus` (open-source, self-host) သို့ `Photon` — multiplayer, avatar sync
- **Physics:** `Rapier` (rust/wasm, မြန်) သို့ `cannon-es`
- **Scene format:** glTF/GLB scene graph + JSON layout (object transform, metadata)
- **Streaming:** object များများဆို LOD + instancing + Draco compression

### Module 5 — In-World Editor (create / edit tools)
- three.js **TransformControls** — ရွှေ့ (translate) / လှည့် (rotate) / ချဲ့ (scale) gizmo
- Object library / drag-drop from gallery
- Material & lighting editor
- Undo/redo (command pattern)
- Snapping, grid, grouping
- Save → scene JSON to Postgres, assets to S3

### Module 6 — Backend & Storage
- **API:** Node.js (NestJS/Express) or FastAPI
- **DB:** Postgres — `users`, `assets`, `scenes`, `jobs`, `connectors`
- **Object storage:** AWS **S3** (GLB, textures, source images)
- **CDN:** CloudFront (asset delivery မြန်စေ)
- **Job queue:** Redis + BullMQ / Celery — GPU job တွေကို async ဖြင့် queue
- **Auth:** AWS Cognito / Supabase Auth / Auth0 (OAuth, JWT)

### Module 7 — Connectors (third-party ချိတ်ဆက်)
- **Public REST + GraphQL API** — external app တွေ ချိတ်ဖို့
- **OAuth 2.0 provider** — "Connect with gWave" ခလုတ်
- **Webhooks** — asset ready / scene updated event push
- **Import connectors:** Sketchfab, Poly Haven, ready-made 3D marketplaces
- **Export connectors:** Blender, Unity, Unreal, USDZ (Apple)
- **Plugin SDK** — developer တွေ tool အသစ်ထည့်နိုင်တဲ့ framework

### Module 8 — UI/UX (3D mesh design system)
- **Stack:** React + TypeScript + `@react-three/fiber` + `@react-three/drei`
- **Components:** 3D viewer card, gallery grid, upload dropzone, generation progress, editor toolbar
- **Design:** dark-mode 3D-first UI, mesh thumbnails (auto-render), skeleton loaders
- **State:** Zustand / Redux

---

## 3. Tech Stack Summary

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | React + react-three-fiber | three.js ကို React ထဲ ချောချောမွေ့မွေ့ |
| 3D render | three.js | web standard, ecosystem ကြီး |
| 3D-gen model | TripoSR → Hunyuan3D-2 | self-host, GPU control |
| Scanner | COLMAP + Nerfstudio (gsplat) | open-source, quality |
| Room scan | Apple RoomPlan + gsplat | LiDAR + cross-platform |
| Backend API | Node.js (NestJS) | async, ecosystem |
| GPU worker | Python + FastAPI + PyTorch | ML stack |
| Realtime | Colyseus (WebSocket) | multiplayer, self-host |
| DB | Postgres (Supabase/RDS) | relational + JSON |
| Storage | S3 + CloudFront | scalable asset delivery |
| Queue | Redis + BullMQ | GPU job orchestration |
| Auth | Cognito / Supabase Auth | OAuth, JWT |
| Container | Docker + docker-compose → ECS/EKS | deploy |

---

## 4. AWS Deployment Topology

```
Route53 (gwave.cc)
   │
CloudFront ──── S3 (static frontend build + assets bucket)
   │
ALB (Application Load Balancer)
   ├── ECS Fargate: core-api (Node)        [cheap, autoscale]
   ├── ECS Fargate: realtime (Colyseus)
   └── EC2 GPU (g5.xlarge): 3d-worker      [GPU, on-demand/spot]
   │
RDS Postgres (or Supabase) · ElastiCache Redis
```

- **GPU node:** `g5.xlarge` (1× A10G 24GB) — MVP အတွက် လုံလောက်.
- **Cost control:** GPU ကို **spot instance** သို့ **auto-stop when idle** (job မရှိရင် ပိတ်) ထားရင် ငွေ အများကြီး သက်သာ.
- **Scale-out:** job queue depth ကြည့်ပြီး GPU node အရေအတွက် auto-scale.

### ခန့်မှန်း ကုန်ကျစရိတ် (monthly, အကြမ်း)
| Item | Est. USD/mo |
|------|-------------|
| g5.xlarge GPU (on-demand ~$1.0/hr, 8hr/day) | ~$240 |
| g5.xlarge (spot, ~70% off) | ~$70 |
| ECS Fargate (API + realtime) | ~$40–80 |
| RDS Postgres (t4g.small) | ~$30 |
| S3 + CloudFront (100GB) | ~$15–30 |
| Redis (cache.t4g.micro) | ~$15 |
| **MVP total (spot GPU)** | **~$180–250/mo** |

> GPU ကို 24/7 မဖွင့်ဘဲ **on-demand job အတွက်ပဲ ဖွင့်** ရင် အများဆုံး သက်သာတယ်။

---

## 5. Roadmap (Phase by Phase)

### 🟢 Phase 0 — MVP (ယခု ဆောက်ပေးထားတဲ့ code)  · 1–2 ပတ်
- [x] Image upload → TripoSR → GLB
- [x] three.js viewer + OrbitControls + basic TransformControls (edit)
- [x] FastAPI backend + Docker
- [ ] S3 storage wire-up + user's AWS credential
- [ ] gwave.cc domain + HTTPS (Nginx/Caddy)

### 🟡 Phase 1 — Real product core · 3–6 ပတ်
- User auth (login/signup, JWT)
- Asset gallery (my 3D models) + Postgres
- Async job queue (Redis) + progress bar
- Text→3D (TRELLIS) ထည့်
- Quality upgrade → Hunyuan3D-2

### 🟠 Phase 2 — Scanner · 6–10 ပတ်
- Object scanner (photogrammetry / Gaussian splatting)
- Mobile capture flow
- Room scanner (RoomPlan iOS app + web viewer)

### 🔵 Phase 3 — Metaverse + Editor · 10–16 ပတ်
- Multi-object scene editor (full TransformControls, snapping, undo/redo)
- Multiplayer world (Colyseus) — avatar, presence
- Physics (Rapier)
- Scene save/load/share

### 🟣 Phase 4 — Connectors + Platform · 16 ပတ်+
- Public REST/GraphQL API + OAuth provider
- Sketchfab / marketplace import
- Unity / Unreal / USDZ export
- Webhooks + Plugin SDK
- Marketplace (buy/sell 3D assets)

---

## 6. Data Model (core tables)

```sql
users(id, email, name, created_at)
assets(id, owner_id, name, type, glb_url, thumb_url, source_img_url,
       poly_count, created_at, meta jsonb)
scenes(id, owner_id, name, layout jsonb, is_public, updated_at)
scene_objects(id, scene_id, asset_id, transform jsonb, meta jsonb)
jobs(id, owner_id, kind, status, input_url, output_url, error, created_at)
connectors(id, owner_id, provider, oauth_token, config jsonb, active)
```

---

## 7. Security & Ops (မမေ့ရန်)
- HTTPS everywhere (Caddy/Nginx + Let's Encrypt)
- S3 buckets **private** + presigned URLs (public bucket မထားရ)
- GPU worker ကို internal network ထဲ ထား, API ကနေပဲ ခေါ်
- Rate limit + auth on 3D-gen (GPU က ဈေးကြီးတယ် — abuse မခံရအောင်)
- Uploaded image validation (size, type, malware scan)
- Job timeout + GPU memory guard

---

## 7b. Generated Asset → Game Character Pipeline ⭐

> ဖန်တီးလိုက်တဲ့ mesh တိုင်းကို metaverse ထဲ **playable / NPC ဇာတ်ကောင်** အဖြစ် တန်းသုံးလို့ရအောင် — auto-rig + character-config + controller pipeline။ (Code: `character/` folder ကြည့်)

**Flow:**
```
image/scan → GLB mesh → [auto-rig] → [attach animation lib] → character-config.json → metaverse
```

**1) Auto-rigging (mesh ကို ရုပ်လှုပ်လို့ရအောင် အရိုးထည့်):**
- `UniRig` (open-source, 2024) — auto humanoid/generic rig, self-host GPU
- `Anything World` API — auto-rig + animate (API)
- `Mixamo` (Adobe) — humanoid auto-rig + animation library (semi-manual)
- Skeleton standard: **Mixamo rig** သို့ **VRM** (avatar standard, VRoid ecosystem)

**2) Animation library (retarget):**
- shared humanoid clips (idle/walk/run/jump/wave) ကို character အသစ်တိုင်းပေါ် **retarget**
- three.js `AnimationMixer` + `SkeletonUtils.retargetClip()` သို့ Mixamo clips
- ဒါဆို character တစ်ကောင် generate လုပ်တာနဲ့ animation set အပြည့် အလိုအလျောက် ရ

**3) character-config.json (အသေးစိတ် setting):**
generated asset တိုင်းမှာ ပါမယ့် settings — `character/character-schema.json` မှာ schema အပြည့်၊ `character-example.json` မှာ နမူနာ။ အဓိက fields:
- `rig` — humanoid/generic/static, skeleton type, eye height
- `animations` — idle/walk/run/jump/wave clip names
- `physics` — capsule collider, moveSpeed, runSpeed, jumpForce, gravity, mass
- `camera` — thirdPerson/firstPerson/orbit, distance
- `stats` — hp, level, team (RPG/game logic)
- `interaction` — clickable, dialogue, onInteract event, grabbable
- `spawn` — position, rotation, world id
- `lod` — auto-LOD, max triangles, Draco compression (crowd performance)
- `network` — Colyseus transform/animation sync, authority

**4) Character controller (metaverse ထဲ ကစားလို့ရ):**
- `character/metaverse-demo.html` — playable third-person demo:
  - WASD/Shift/Space + mobile joystick, gravity+jump, camera-relative movement
  - animation state machine (idle ↔ walk ↔ run ↔ jump) — GLB clips ရှိရင် auto
  - generator ရဲ့ `/outputs/xxx.glb` URL ကို paste လုပ်ပြီး တန်းစမ်းလို့ရ
- Production: Rapier physics capsule + Colyseus multiplayer sync (Phase 3)

**မှတ်ချက်:** အခု demo က static mesh (rig မရှိ) ဆိုရင် mesh လုံးလိုက် ရွှေ့ပေးတယ်။ Rig + animation ပါတဲ့ GLB (UniRig/Mixamo ဖြတ်ထားတာ) ဆိုရင် ခြေလက် လှုပ်ပြီး လမ်းလျှောက်/ပြေး animation တွေ အလုပ်လုပ်တယ်။ ဒါကြောင့် Phase 1 မှာ **auto-rig step** ကို generation pipeline ထဲ ချိတ်ဖို့ အရေးကြီး။

---

## 8. နောက်ခြေလှမ်း (Next steps)
1. ပါလာတဲ့ MVP code ကို AWS GPU instance မှာ deploy (deploy guide ကြည့်) 
2. gwave.cc → server ကို point (Route53/DNS)
3. S3 bucket ဖွဲ့ + credential ထည့်
4. စမ်းသုံး → Phase 1 (auth + gallery) ဆက်

*Generated for gwave.cc — gWave 3D Platform*
