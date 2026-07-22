import "server-only";

/**
 * A configuration self-check for the operator. It reports only whether each
 * integration's environment variables are *present* — never their values — so
 * an admin can see at a glance what is wired up and what still needs setting,
 * instead of discovering a missing key through a 500 error at runtime.
 */
export interface StatusGroup {
  /** Feature name (Burmese). */
  title: string;
  /** What it powers, in one line. */
  enables: string;
  /** True when every required env var is set. */
  configured: boolean;
  /** Critical features break the whole site when unset; others degrade gracefully. */
  critical: boolean;
  /** Env var names that still need a value. */
  missing: string[];
  /** All env var names this feature reads (shown for reference). */
  vars: string[];
}

function isSet(name: string): boolean {
  return Boolean(process.env[name] && process.env[name]!.trim().length > 0);
}

function group(
  title: string,
  enables: string,
  vars: string[],
  critical: boolean,
): StatusGroup {
  const missing = vars.filter((name) => !isSet(name));
  return { title, enables, vars, critical, missing, configured: missing.length === 0 };
}

/** Ordered list of integration checks for the admin System Status page. */
export function getSystemStatus(): StatusGroup[] {
  return [
    group(
      "Core (Database)",
      "Database၊ login၊ storage — site တစ်ခုလုံး ဒီအပေါ်မှာ",
      [
        // Data plane = self-hosted PostgREST/Realtime at NEXT_PUBLIC_DATA_API_URL
        // (gwave.cc/sb → RDS). The privileged path mints its own service_role
        // token (lib/auth/tokens.ts), so no static service-role key is needed.
        "NEXT_PUBLIC_DATA_API_URL",
        "NEXT_PUBLIC_DATA_API_KEY",
        "NEXT_PUBLIC_SITE_URL",
      ],
      true,
    ),
    group(
      "Live streaming (LiveKit)",
      "browser live broadcast + co-host",
      ["NEXT_PUBLIC_LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
      false,
    ),
    group(
      "Payments (Stripe)",
      "membership + G-Pay top-up",
      ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
      false,
    ),
    group(
      "Phone OTP (Twilio)",
      "G-Pay ဖုန်း OTP အတည်ပြုချက်",
      ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"],
      false,
    ),
    group(
      "Push notifications (VAPID)",
      "PWA web push",
      ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"],
      false,
    ),
    group(
      "CCTV media server",
      "camera RTSP → HLS playback",
      ["NEXT_PUBLIC_CCTV_HLS_ORIGINS", "CCTV_MEDIA_API_URL"],
      false,
    ),
    group(
      "Maps (Google)",
      "location share + map",
      ["NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"],
      false,
    ),
  ];
}

/** A cheap database reachability probe (no secret values used). */
export async function probeDatabase(): Promise<"ok" | "unreachable" | string> {
  // Read literally, new name first, old name as fallback — same compatibility
  // window as lib/env.ts (the old NEXT_PUBLIC_SUPABASE_* names are still baked
  // into the running production image).
  const url =
    process.env.NEXT_PUBLIC_DATA_API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.NEXT_PUBLIC_DATA_API_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return "not configured";
  try {
    const res = await fetch(
      `${url}/rest/v1/membership_plans?select=id&limit=1`,
      {
        headers: { apikey: anon },
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      },
    );
    return res.ok ? "ok" : `error:${res.status}`;
  } catch {
    return "unreachable";
  }
}
