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
- [ ] Phase 2 — assets (Mixamo Vanguard merge guide, DRACO+KTX2 pipeline)
- [ ] Phase 3 — Colyseus multiplayer (prediction, interpolation, lag comp)
- [ ] Phase 4 — AWS deploy (game.gwave.cc)
- [ ] Phase 5 — mobile touch controls, PWA, settings, audio

## Placeholder soldier

`client/public/assets/soldier-placeholder.glb` is a rigged kit character
(from the metaverse asset set) standing in for the Mixamo Vanguard. The FSM's
CLIP_MAP already lists the Mixamo action names first, so dropping in
`soldier-full.glb` from the Phase 2 Blender merge is an asset swap only.
