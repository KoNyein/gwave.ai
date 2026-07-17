import { NextResponse } from "next/server";

import {
  findByTerraId,
  insertMetrics,
  markConnectionRevoked,
  recomputeDailySummaries,
  upsertConnection,
} from "@/lib/db/health";
import { isTerraEnabled } from "@/lib/env";
import { normalizePayload, verifyTerraSignature } from "@/lib/health/terra";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Terra webhook (signature verified). Terra POSTs one payload per data slice:
 *  - type "auth"                     → a device just connected → link Terra id ↔ user
 *  - type "deauth"/"access_revoked"  → mark the connection revoked
 *  - type "daily"/"activity"/"sleep" → normalize + store metrics, refresh summary
 *
 * Always answers 200 on a valid signature (even for shapes we ignore) so Terra
 * doesn't retry forever; a bad/absent signature is rejected.
 */
export async function POST(request: Request) {
  if (!isTerraEnabled()) {
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }
  const raw = await request.text();
  if (!verifyTerraSignature(raw, request.headers.get("terra-signature"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let payload: {
    type?: string;
    user?: { user_id?: string; provider?: string; reference_id?: string };
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ received: true });
  }

  const type = payload.type;
  const terraUserId = payload.user?.user_id;
  const provider = payload.user?.provider ?? "unknown";

  try {
    if (type === "auth") {
      const referenceId = payload.user?.reference_id;
      if (referenceId && terraUserId) {
        await upsertConnection({
          userId: referenceId,
          provider,
          terraUserId,
        });
      }
      return NextResponse.json({ received: true });
    }

    if (type === "deauth" || type === "access_revoked") {
      if (terraUserId) await markConnectionRevoked(terraUserId);
      return NextResponse.json({ received: true });
    }

    // Data payloads: attribute to our user, then store.
    if (terraUserId) {
      const owner = await findByTerraId(terraUserId);
      if (owner) {
        const metrics = normalizePayload(payload);
        if (metrics.length > 0) {
          await insertMetrics(owner.userId, owner.provider, metrics);
          await recomputeDailySummaries(
            owner.userId,
            metrics.map((m) => m.recorded_at.slice(0, 10)),
          );
          // Extension point: raise a heat-stress push here when heart_rate is
          // sustained-high during field work (uses the existing web-push lib).
        }
      }
    }
  } catch {
    // A processing failure (DB/network) must NOT be ACKed: Terra only retries on
    // a non-2xx, so a 200 here would permanently drop an authenticated batch.
    // Signal an error so it's redelivered — our writes are idempotent. Bad or
    // ignorable payload shapes are ACKed above, not here.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
