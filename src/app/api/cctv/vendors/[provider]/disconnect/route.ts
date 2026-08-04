import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { invalidateVendorDiscovery } from "@/lib/cctv/vendor-service";
import { getCameraVendorConnector } from "@/lib/cctv/vendors/registry";
import {
  disconnectVendorConnection,
  getDecryptedVendorTokens,
  getVendorConnectionForOwner,
  isVendorCloudEnabled,
} from "@/lib/db/cctv-vendors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ connectionId: z.string().uuid() });

/**
 * POST /api/cctv/vendors/[provider]/disconnect (§11.6).
 *
 * Order matters: revoke at the vendor (best effort), then DELETE the sealed
 * secrets, then mark the metadata row disconnected. A working refresh token
 * must never survive a successful disconnect — which is why the secrets
 * delete throws on failure instead of carrying on to "disconnected".
 * Imported cameras stay (they are the user's data); their playback will
 * demand a relink. Uses getCameraVendorConnector (not the enabled variant)
 * so an operator turning a provider OFF does not strand its users' links.
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ provider: string }> },
) {
  const params = await props.params;
  if (!(await isVendorCloudEnabled())) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const connector = getCameraVendorConnector(params.provider);
  if (!connector) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const connection = await getVendorConnectionForOwner(
    user.id,
    parsed.data.connectionId,
  );
  if (!connection || connection.provider !== connector.id) {
    return NextResponse.json({ error: "no_connection" }, { status: 404 });
  }

  try {
    const tokens = await getDecryptedVendorTokens(connection.id);
    if (tokens) {
      try {
        await connector.revoke(tokens);
      } catch {
        // Best effort: vendor-side revocation failing must not keep OUR
        // copy of the tokens alive — the delete below is the guarantee.
      }
    }
    await disconnectVendorConnection(connection.id);
    invalidateVendorDiscovery(connection.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "disconnect_failed" }, { status: 500 });
  }
}
