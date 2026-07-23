import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ICE (STUN/TURN) config for messenger calls, shared by the web client and the
// mobile app. TURN_* are read at request time, so they live in the EC2
// override env file and adding a relay never needs an image rebuild.
//
//   TURN_URL         comma-separated, e.g. turn:1.2.3.4:3478?transport=udp
//   TURN_USERNAME    coturn long-term credential user
//   TURN_CREDENTIAL  ...and its password
export function GET() {
  const servers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }> = [{ urls: "stun:stun.l.google.com:19302" }];

  const turnUrls = (process.env.TURN_URL ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (turnUrls.length) {
    servers.push({
      urls: turnUrls,
      username: process.env.TURN_USERNAME || undefined,
      credential: process.env.TURN_CREDENTIAL || undefined,
    });
  }

  return NextResponse.json({ iceServers: servers });
}
