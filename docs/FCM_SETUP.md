# FCM setup — make calls ring when the phone app is closed

The whole pipeline is already wired for Firebase Cloud Messaging (FCM):

- **App**: `mobile/lib/core/push_service.dart` registers the device token and
  forwards `type:"call"` data pushes to the ring inbox; `firebase_core` +
  `firebase_messaging` are in `pubspec.yaml`; the APK workflow injects
  `google-services.json` and applies the `com.google.gms.google-services`
  Gradle plugin automatically.
- **Server**: `src/lib/fcm.ts` (`sendFcmToUser`) + `POST /api/mobile/call/notify`
  fan a high-priority data+notification message out to the callee's registered
  device tokens; `POST /api/mobile/push/register` stores them in `device_tokens`.

Both halves are **env-gated and self-disabling** — with nothing configured the
app and server behave exactly as before (push simply stays off).

## App identity

The native app's Android **applicationId is `com.green.gwave`** (Firebase
project `gen-lang-client-0745825519`). The APK workflow scaffolds it with
`flutter create --org com.green --project-name gwave`, and
`mobile/google-services.json` (committed) carries the registered
`com.green.gwave` client, so the on-device Firebase init + `getToken()` succeed
out of the box. Keep the two in lock-step: **if you ever change the Firebase
project or the package name, update both** the `--org` in the workflow and the
committed `google-services.json` (or supply a new one via the
`GOOGLE_SERVICES_JSON_BASE64` repo secret, which the workflow prefers over the
committed file).

## The one remaining step — server send key (`FCM_SERVICE_ACCOUNT_JSON` on EC2)

The app already registers device tokens; the server just needs a key to *send*.

1. Firebase console → **Project settings → Service accounts** →
   **Generate new private key** → a JSON file downloads. (Same Firebase project
   as `google-services.json`: `gen-lang-client-0745825519`.)
2. On the app EC2 box, add it to the runtime env file as **one line** — the
   JSON's `private_key` keeps its literal `\n`; the server restores real
   newlines (`src/lib/fcm.ts`):

   ```bash
   printf "FCM_SERVICE_ACCOUNT_JSON='%s'\n" "$(jq -c . /path/to/service-account.json)" \
     | sudo tee -a /etc/gwave-web.env
   sudo grep -c FCM_SERVICE_ACCOUNT_JSON /etc/gwave-web.env   # expect 1
   sudo gwave-redeploy                                        # runtime-env change, no rebuild
   ```

That's it — no image rebuild, `gwave-redeploy` reads it at runtime.

## Build, install, verify

1. The mobile dev branch push already triggers a fresh **Build Flutter APK**
   with `com.green.gwave` + the committed Firebase config baked in.
2. Install that APK from `gwave.cc/welcome`, open it, and **allow
   notifications** when prompted (Android 13+ needs the runtime grant).
3. **Token registered** — after signing in, a row should appear:

   ```sql
   select user_id, platform, updated_at from device_tokens order by updated_at desc limit 5;
   ```

4. **End-to-end** — fully close the app on phone A, then call that account from
   another account. Phone A should get a ringing notification within seconds;
   tapping it opens the app, which reconnects the realtime ring inbox and shows
   the incoming-call screen.

## How it fits the call pipeline

| Callee state              | How the ring arrives                                             |
| ------------------------- | --------------------------------------------------------------- |
| App **open**              | Realtime broadcast on `calls:{userId}` (re-auth'd before join). |
| App **background/closed** | **FCM data push** wakes the app → it reconnects the ring inbox → catches the caller's re-broadcast ring. |
| **Web** tab               | VAPID web push (`sendPushToUser`) — unchanged.                  |

The realtime path carries the actual call once the app is awake; the push is
only what makes a *closed* app ring. Nothing here touches the in-call WebRTC
media (TURN/ICE) path.

## Troubleshooting

- **No `device_tokens` row after sign-in** → on-device `Firebase.initializeApp()`
  failed: the APK's applicationId (`com.green.gwave`) doesn't match a client in
  the baked `google-services.json`. Confirm the workflow used `--org com.green`
  and the committed config still has the `com.green.gwave` client.
- **Row exists but no ring when closed** → server can't send: check
  `FCM_SERVICE_ACCOUNT_JSON` is present in `/etc/gwave-web.env`, is valid JSON,
  and belongs to the **same** Firebase project as `google-services.json`.
- **`403 SenderId mismatch` / `404 UNREGISTERED`** in logs → the two artifacts
  are from different Firebase projects, or the token is stale (auto-pruned).
