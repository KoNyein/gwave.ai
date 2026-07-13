/**
 * Send a signed LiveKit webhook to the deployed app, exactly as the SFU does.
 * Used to verify the end-of-broadcast path end to end.
 *
 *   node scripts/send-test-webhook.mjs <event> <roomName> [participantIdentity]
 */
import { WebhookReceiver } from "livekit-server-sdk";
import { createHash, createHmac } from "node:crypto";

const [, , event = "room_finished", room = "live-test", identity] = process.argv;

const KEY = process.env.LIVEKIT_API_KEY;
const SECRET = process.env.LIVEKIT_API_SECRET;
const URL_ = process.env.WEBHOOK_URL;
if (!KEY || !SECRET || !URL_) {
  throw new Error("Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, WEBHOOK_URL");
}

const payload = JSON.stringify({
  event,
  id: `EV_test_${Date.now()}`,
  createdAt: Math.floor(Date.now() / 1000),
  room: { name: room, sid: "RM_test" },
  ...(identity ? { participant: { identity, sid: "PA_test" } } : {}),
});

// LiveKit signs the body: JWT whose `sha256` claim is the base64 body digest.
const b64 = (o) =>
  Buffer.from(JSON.stringify(o)).toString("base64url");
const header = b64({ alg: "HS256", typ: "JWT" });
const now = Math.floor(Date.now() / 1000);
const claims = b64({
  iss: KEY,
  sub: KEY,
  iat: now,
  exp: now + 300,
  nbf: now,
  sha256: createHash("sha256").update(payload).digest("base64"),
});
const sig = createHmac("sha256", SECRET)
  .update(`${header}.${claims}`)
  .digest("base64url");
const token = `${header}.${claims}.${sig}`;

// Sanity-check our own signature with the real receiver before sending.
await new WebhookReceiver(KEY, SECRET).receive(payload, token);

const res = await fetch(URL_, {
  method: "POST",
  headers: { "Content-Type": "application/webhook+json", Authorization: token },
  body: payload,
});
console.log(`${event} ${room} -> HTTP ${res.status} ${await res.text()}`);
