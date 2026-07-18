import { ScreenTimeRecorder } from "@/components/health/screen-time-recorder";
import { GlobalCallListener } from "@/components/messenger/global-call-listener";
import { getCurrentProfile } from "@/lib/auth";

/**
 * Signed-in background services mounted once in the root layout:
 * - GlobalCallListener — incoming calls ring (sound + vibration + overlay)
 *   on every page, not just the messenger.
 * - ScreenTimeRecorder — Gwave screen time accumulates on every page.
 * getCurrentProfile() is cache()-deduplicated with the page's own lookup, so
 * this adds no extra query on pages that already load the profile.
 */
export async function GlobalServices() {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  return (
    <>
      <GlobalCallListener
        currentUser={{
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }}
      />
      <ScreenTimeRecorder />
    </>
  );
}
