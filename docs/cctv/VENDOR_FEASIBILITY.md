# Vendor cloud camera feasibility register

Phase-zero deliverable of `docs/tasks/VENDOR_CLOUD_CAMERA_INTEGRATION.md` §6.

**Rule: no production connector is written until every row below is verified
for that provider from official vendor documentation and approved partner
credentials.** Do not fill this table from unofficial sources or
reverse-engineered libraries.

> **2026-08-04 — Hikvision removed.** The typed Hikvision stub, its
> `HIKVISION_*` env plumbing, and the Hikvision RTSP preset were removed
> from the codebase by product decision (partner application on hold). The
> framework (registry/fake provider/secret storage) is vendor-agnostic —
> reintroducing Hikvision or adding any other vendor later is a single
> connector PR against `src/lib/cctv/vendors/`. The matrix below is kept as
> the research register for whichever provider is pursued first.

Legend: ❓ unverified · ✅ verified (link the source) · ❌ confirmed unavailable

| Item | Hikvision (Hik-Connect) | Dahua | Reolink | Amcrest | Tapo / TP-Link |
|---|---|---|---|---|---|
| Official developer-program URL | ❓ | ❓ | ❓ | ❓ | ❓ |
| Partner approval status | ❓ not applied | ❓ | ❓ | ❓ | ❓ |
| Supported countries/regions | ❓ (must include MM/TH) | ❓ | ❓ | ❓ | ❓ |
| Authentication mechanism | ❓ (OAuth? AK/SK?) | ❓ | ❓ | ❓ | ❓ |
| Camera-discovery endpoint | ❓ | ❓ | ❓ | ❓ | ❓ |
| Live-view method | ❓ | ❓ | ❓ | ❓ | ❓ |
| Stream type returned | ❓ (HLS/WebRTC/RTSP?) | ❓ | ❓ | ❓ | ❓ |
| Session expiry | ❓ | ❓ | ❓ | ❓ | ❓ |
| PTZ support | ❓ | ❓ | ❓ | ❓ | ❓ |
| Snapshot/event support | ❓ | ❓ | ❓ | ❓ | ❓ |
| Rate limits | ❓ | ❓ | ❓ | ❓ | ❓ |
| Pricing/licensing | ❓ | ❓ | ❓ | ❓ | ❓ |
| CORS/browser restrictions | ❓ | ❓ | ❓ | ❓ | ❓ |
| Recording/redistribution rights | ❓ | ❓ | ❓ | ❓ | ❓ |
| Public-sharing restrictions | ❓ (assume forbidden) | ❓ | ❓ | ❓ | ❓ |
| Test account/device availability | ❓ | ❓ | ❓ | ❓ | ❓ |
| Local-gateway fallback | ✅ RTSP/ONVIF | ✅ RTSP/ONVIF | ✅ some models | ✅ RTSP/ONVIF | ✅ some powered models |

## Owner actions (user-side, not a Claude task)

1. Choose the first vendor to pursue, apply to its partner/developer
   program, and obtain: client credentials, official API documentation, a
   sandbox or test account, and written confirmation of third-party
   live-view rights for the target regions.
2. Register the production redirect URI
   (`https://gwave.cc/api/cctv/vendors/<provider>/callback`).
3. Confirm terms for relay/recording/redistribution before any UI mentions
   the vendor by name.

## Sign-off log

| Date | Provider | Verified by | Result |
|---|---|---|---|
| — | — | — | — |
