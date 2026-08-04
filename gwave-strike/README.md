# GWAVE STRIKE

Two-team (BLUE vs RED) open-world FPS — three.js + Rapier + Colyseus →
game.gwave.cc. Blueprint: the uploaded CLAUDE_1.md (phases 1–5).

## Dev

```bash
cd gwave-strike
npm install
npm run dev        # client on :5173 — playable TDM vs bots
npm run typecheck  # all workspaces
npm run build
```

## Phase status

- [x] **Phase 1 — client core**: modern renderer defaults, Rapier kinematic
  capsule + heightfield terrain + character controller, data-driven hitscan
  weapons (ADS FOV lerp, CS-style 30-shot spray, reload), soldier GLB
  animation FSM (crossfades; placeholder rig — see below), client-side team
  bots, Burmese HUD (hp/ammo/killfeed/score/hitmarker), tracers + muzzle
  flash.
- [x] **Phase 2 — assets**: DRACO+KTX2 loaders (decoders vendored),
  compress-assets.mjs pipeline, Mixamo Vanguard merge runbook
  (tools/merge-animations.md — needs the user's mixamo login).
- [x] **Phase 3 — multiplayer**: Colyseus server-authoritative sim (input
  integration, fire-rate/origin validation, 1s lag-comp rewind, server-side
  bots, TDM to 50), client prediction + soft reconciliation + 100ms remote
  interpolation. Offline fallback = Phase 1 bots.
- [x] **Phase 4 — deploy**: deploy-strike.yml (build always; deploys once
  STRIKE_EC2_HOST/STRIKE_EC2_SSH_KEY secrets exist), nginx conf, PM2,
  setup-ec2.sh, user runbook (deploy/README-strike.md).
- [x] **Phase 5 — mobile + polish**: touch joystick/aim/fire/ADS/jump/reload,
  PWA (manifest + SW precache), graphics Low/Med/High + sensitivity,
  canvas minimap, Tab scoreboard, WebAudio gunshot/hit/footsteps.

User-side to go live: Route 53 A record + nginx/certbot + GitHub secrets
(deploy/README-strike.md), and the Mixamo asset merge for the realistic
soldier (tools/merge-animations.md).

## Placeholder soldier

`client/public/assets/soldier-placeholder.glb` is a rigged kit character
(from the metaverse asset set) standing in for the Mixamo Vanguard. The FSM's
CLIP_MAP already lists the Mixamo action names first, so dropping in
`soldier-full.glb` from the Phase 2 Blender merge is an asset swap only.
