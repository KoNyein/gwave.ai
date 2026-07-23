# Gwave — live system status

> Every Claude session: read this before working, update it after shipping.
> Keep entries short; newest changelog entries on top.

## Current state (2026-07-24)

- **Web**: main auto-deploys to gwave.cc (ECR image + `gwave-redeploy` on EC2).
  vercel.app hosts 308-redirect to gwave.cc; the old Vercel project should be
  deleted by the owner.
- **APK**: signed builds publish to the `mobile-latest` release on every push
  to `mobile/**` (main or claude/**). Settings footer shows the build number
  (added in v1.0.104). In-app update banner works from v1.0.99 onward.
- **Calls**: TURN relay (coturn on the EC2 host, 18.139.214.180:3478) is live;
  `/api/webrtc/ice` serves it; SG ports open. App has ringtone/ringback +
  vibration, speaker toggle, 20-min Realtime auth refresh (all v1.0.104).
  Web ring verification is embed-free. **Awaiting user confirmation that
  call audio now works on v1.0.104+.**
- **Live**: browser→LiveKit, app-broadcast→IVS. App watches LiveKit lives via
  `/api/mobile/live/token`; stale `live` rows self-heal when the host left.
  **Recording (egress) NOT configured** — needs `LIVEKIT_EGRESS_S3_BUCKET/
  ACCESS_KEY/SECRET` in `/etc/gwave-web.env` (+ an S3 bucket & IAM key).
- **Presence**: `profiles.last_seen_at` migrated on RDS; green dots live.
- **Repo hygiene**: 100 merged branches + old TWA releases deleted
  (`.github/workflows/cleanup-branches.yml` is a reusable manual cleanup).
  Remaining branches: `main`, `claude/phase-1-implementation-7ysxtj`,
  `feat/live-replay-recording` (unmerged IVS replay work, kept on purpose).

## Known gaps / next candidates

- FCM push notifications (calls/messages don't ring when the app is closed).
- Live recording egress envs + S3 bucket (see above).
- `feat/live-replay-recording` branch: unmerged IVS replay work to evaluate.
- Old Vercel project deletion (user-side).

## Changelog

- 2026-07-24: TURN relay + `/api/webrtc/ice` (PR #336), coturn + SG ports on
  EC2; app v1.0.104: ring sounds, speaker toggle, Realtime auth refresh,
  version footer, live-ended errors. Stale-live self-heal (PR #337).
  CLAUDE.md + this file added.
- 2026-07-23: Green one-story auth screen (v1.0.101); call minimize +
  placeholder-username fix; voice messages, update banner, post sharing
  (v1.0.99); presence (app+web, PR #331); vercel.app redirect (PR #333);
  branch/release cleanup (PR #334); embed-free web ring fix (PR #336);
  presence-setup.sql applied on RDS.
- 2026-07-22: account no-clobber fix (PR #329) after Google-flow back-fill
  destroyed a profile link; project unification — dev==main app (PR #330);
  signed-APK keystore working.
