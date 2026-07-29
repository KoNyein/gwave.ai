import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ICE (STUN/TURN) config for messenger calls, shared by the web client and the
// mobile app. TURN_* are read at request time, so they live in the EC2
// override env file and adding a relay never needs an image rebuild.
//
//   TURN_URL         comma-separated, e.g. turn:1.2.3.4:3478?transport=udp
//   TURN_USERNAME    coturn long-term credential user
//   TURN_CREDENTIAL  ...and its password
//
// Each TURN url is emitted as its OWN entry with `urls` a plain string, never
// a single entry carrying a `urls` array. Browsers accept both — a trickle-ICE
// test from the iPad produced a relay candidate off the array form — but the
// app never produced one from the same network, and the native binding drops
// username/credential when `urls` arrives as a list. The app was therefore
// asking coturn for an allocation with no credentials, getting refused, and
// ending up with no relay candidate at all, so every app↔browser call stalled
// at "Connecting". One url per entry is the shape every client parses.
export function GET() {
  const servers: Array<{
    urls: string;
    username?: string;
    credential?: string;
  }> = [{ urls: "stun:stun.l.google.com:19302" }];

  const turnUrls = (process.env.TURN_URL ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const username = process.env.TURN_USERNAME || undefined;
  const credential = process.env.TURN_CREDENTIAL || undefined;
  for (const urls of turnUrls) {
    servers.push({ urls, username, credential });
  }

  return NextResponse.json({ iceServers: servers });
}
