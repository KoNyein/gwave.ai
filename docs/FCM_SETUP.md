# FCM setup — make calls ring when the phone app is closed

Everything in the code is already wired for Firebase Cloud Messaging (FCM):

- **App**: `mobile/lib/core/push_service.dart` registers the device token and
  forwards `type:"call"` data pushes to the ring inbox; `firebase_core` +
  `firebase_messaging` are in `pubspec.yaml`; the APK workflow injects
  `google-services.json` and applies the `com.google.gms.google-services`
  Gradle plugin automatically.
- **Server**: `src/lib/fcm.ts` (`sendFcmToUser`) + `POST /api/mobile/call/notify`
  fan a high-priority data+notification message out to the callee's registered
  device tokens; `POST /api/mobile/push/register` stores them in `device_tokens`.

Both halves are **env-gated and self-disabling** — with nothing configured the
app and server behave exactly as today (push simply stays off). To turn calls
ringing-when-closed on, provide the two real Firebase artifacts below. This is a
**one-time** setup and needs the Firebase console (a Google account), which is
why it can't be scripted here.

The Android package name is **`ai.gwave.app`** — every step must match it.

---

## 1. Create / open a Firebase project

1. Go to <https://console.firebase.google.com> → **Add project** (or reuse an
   existing Google Cloud project).
2. Once created, **Project settings → General**.

## 2. Register the Android app → `google-services.json`

1. In **Project settings → General → Your apps**, click the **Android** icon.
2. **Android package name**: `ai.gwave.app` (exact — this is the release
   `applicationId`).
3. Nickname / debug SHA-1 are optional for FCM — skip them.
4. Click **Register app**, then **Download `google-services.json`**.
5. Base64-encode it and add it as a **GitHub Actions secret** (Repo →
   Settings → Secrets and variables → Actions → **New repository secret**):
   - **Name**: `GOOGLE_SERVICES_JSON_BASE64`
   - **Value**: output of `base64 -w0 google-services.json`
     (macOS: `base64 -i google-services.json | tr -d '\n'`)

   The APK workflow prefers this secret over any committed file, so this is all
   the app side needs. (No file is committed to the repo.)

## 3. Service account → `FCM_SERVICE_ACCOUNT_JSON` on EC2

1. Firebase console → **Project settings → Service accounts**.
2. Click **Generate new private key** → confirm → a JSON file downloads.
   (This is the same as a Google Cloud service account with the
   *Firebase Cloud Messaging API* enabled — the default Firebase SDK account
   already has it.)
3. On the app EC2 box, add it to the runtime env file as a **single line**
   (the JSON's `private_key` keeps its literal `\n` — the server restores real
   newlines):

   ```bash
   # Turn the downloaded file into one line and append it (keeps the key's \n):
   printf "FCM_SERVICE_ACCOUNT_JSON='%s'\n" "$(jq -c . /path/to/service-account.json)" \
     | sudo tee -a /etc/gwave-web.env
   sudo grep -c FCM_SERVICE_ACCOUNT_JSON /etc/gwave-web.env   # expect 1
   sudo gwave-redeploy                                        # env-only change
   ```

   `FCM_SERVICE_ACCOUNT_JSON` is read at runtime, so no image rebuild is needed —
   `gwave-redeploy` picks it up.

## 4. Rebuild the APK and install

1. Trigger the **Build Flutter APK** workflow (any push to the mobile dev branch,
   or run it manually) — with the secret present, it now bakes the real Firebase
   config into the APK.
2. Install the new APK from `gwave.cc/welcome`, open it, and **allow
   notifications** when prompted (Android 13+ requires the runtime grant).

## 5. Verify

- **Token registered**: after signing in on the phone, a row should appear:

  ```sql
  select user_id, platform, updated_at from device_tokens order by updated_at desc limit 5;
  ```

- **End-to-end**: fully close the app on phone A, then call that account from
  another account (web or a second phone). Phone A should get a ringing
  notification within a few seconds; tapping it opens the app, which reconnects
  the realtime ring inbox and shows the incoming-call screen.

## How it fits the call pipeline

| Callee state        | How the ring arrives                                              |
| ------------------- | ---------------------------------------------------------------- |
| App **open**        | Realtime broadcast on `calls:{userId}` (re-auth'd before join).  |
| App **background/closed** | **FCM data push** wakes the app → it reconnects the ring inbox → catches the caller's re-broadcast ring. |
| **Web** tab         | VAPID web push (`sendPushToUser`) — unchanged.                   |

The realtime path and the push path are complementary: the push is what makes a
*closed* app ring; the realtime broadcast still carries the actual call once the
app is awake. Nothing here changes the in-call WebRTC media (TURN/ICE) path.

## Troubleshooting

- **No `device_tokens` row after sign-in** → the app's `Firebase.initializeApp()`
  failed: the baked `google-services.json` package name isn't `ai.gwave.app`, or
  the secret wasn't set when the APK was built. Rebuild after fixing the secret.
- **Row exists but no ring when closed** → server can't send: check
  `FCM_SERVICE_ACCOUNT_JSON` is present in `/etc/gwave-web.env` and valid JSON,
  and that the service account belongs to the **same** Firebase project as
  `google-services.json`.
- **`403 SenderId mismatch` / `404 UNREGISTERED`** in logs → the two artifacts
  are from different Firebase projects, or the token is stale (auto-pruned).
