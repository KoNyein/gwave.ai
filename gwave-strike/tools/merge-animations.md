# Mixamo Vanguard → soldier-full.glb (Phase 2 asset work)

This step needs a Mixamo login (browser), so it is user-side. Everything in
the client is already wired for the result — drop the file in and it works.

## 1. Download (mixamo.com)

1. Characters → search **Vanguard By T. Choonyung** → use as character.
2. Animations — download each as **FBX Binary, Without Skin, 30 fps**:
   - `Firing Rifle`, `Rifle Aiming Idle`, `Reloading`
   - `Death From The Back`, `Crouch Idle`, `Rifle Run`
   - `Strafe Left`, `Strafe Right`, `Rifle Walk`, `Idle`
3. Also download the character itself once **With Skin** (T-pose FBX).

## 2. Merge in Blender

1. Import the with-skin Vanguard FBX.
2. For each animation FBX: File → Import → FBX (uncheck "Import Normals"
   noise is fine). Each import adds an Action.
3. Open the **Nonlinear Animation** editor → push every action down onto the
   Vanguard armature.
4. In the Action editor rename actions exactly:
   `Fire, Aim, Reload, Death, Crouch, RunRifle, StrafeL, StrafeR, Walk, Idle`
   (these are the names the client FSM's CLIP_MAP looks up first).
5. Delete the imported animation armatures (keep only the skinned one).
6. Export → glTF 2.0 (.glb): ✔ Animations, ✔ Skinning, Sampling 30 fps →
   `soldier-full.glb`.

## 3. Compress + install

```bash
node tools/compress-assets.mjs soldier-full.glb client/public/assets/soldier.min.glb
```

Then flip the asset constant in `client/src/main.ts`:

```ts
const SOLDIER_URL = "/assets/soldier.min.glb";
```

Gun model: Sketchfab → search a CC0 "M4" → download GLB → same compress
command → `client/public/assets/rifle.min.glb` (the ADS alignment empty/bone
is read in Phase 5 polish; the box viewmodel keeps working until then).
