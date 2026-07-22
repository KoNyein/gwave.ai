"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/posts";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/data/admin";
import { createClient } from "@/lib/data/server";
import { getCurrentUser } from "@/lib/auth";
import type { SafetyStatus } from "@/types/database";

const schema = z.object({
  status: z.enum(["safe", "need_help"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
});

/**
 * Record a safety check-in ("I'm safe" / "I need help") and notify the user's
 * family circles so relatives know their status right away.
 */
export async function safetyCheckIn(
  input: z.infer<typeof schema>,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid check-in." };

  const db = await createClient();
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await db.from("safety_checkins").insert({
    user_id: user.id,
    status: parsed.data.status,
    note: parsed.data.note || null,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
  });
  if (error) return { ok: false, error: error.message };

  // Notify family (best-effort). Service role so we can resolve everyone in the
  // caller's circles and their push subscriptions.
  void notifyFamily(user.id, parsed.data.status);

  revalidatePath("/map");
  return { ok: true, data: undefined };
}

async function notifyFamily(userId: string, status: SafetyStatus) {
  try {
    const admin = createAdminClient();
    const { data: mine } = await admin
      .from("family_memberships")
      .select("circle_id")
      .eq("user_id", userId)
      .returns<{ circle_id: string }[]>();
    const circleIds = (mine ?? []).map((r) => r.circle_id);
    if (circleIds.length === 0) return;

    const { data: members } = await admin
      .from("family_memberships")
      .select("user_id")
      .in("circle_id", circleIds)
      .neq("user_id", userId)
      .returns<{ user_id: string }[]>();
    const ids = [...new Set((members ?? []).map((m) => m.user_id))];
    if (ids.length === 0) return;

    const { data: me } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", userId)
      .maybeSingle();
    const name =
      (me?.full_name as string | null) ||
      (me?.username as string | null) ||
      "မိသားစုဝင်";
    const body =
      status === "safe"
        ? `${name} — ✅ ဘေးကင်းကြောင်း အသိပေးလိုက်ပါသည်`
        : `${name} — ⚠️ အကူအညီ လိုအပ်နေပါသည်`;

    await Promise.all(
      ids.map((id) =>
        sendPushToUser(id, {
          title: "🛡️ မိသားစု အခြေအနေ",
          body,
          url: "/map",
          tag: "safety",
        }),
      ),
    );
  } catch {
    /* best-effort */
  }
}
