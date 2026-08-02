import { cookies } from "next/headers";

/// Cookie the Flutter app sets on its WebView before loading any page.
export const EMBED_COOKIE = "gw_embed";

/**
 * True when this request is being rendered inside the Gwave app's WebView.
 *
 * ★ Why this exists: the app has its own header and its own bottom tab bar.
 *   When a page rendered the site's navbar and mobile nav on top of those, the
 *   user saw two headers stacked and two rows of tabs, the lower one clipped
 *   off the bottom of the screen. Every WebView page in the app looked broken
 *   in the same way.
 * ★ Why a cookie rather than a query parameter: the parameter survives only
 *   the first load. The moment someone taps a link inside the page the app is
 *   gone from the URL and the chrome comes back mid-session. A cookie is set
 *   once by the WebView and holds for every navigation within it.
 * ★ This hides chrome only. It never changes what the page is allowed to show
 *   — anything to do with permissions stays on the server, keyed to the
 *   session, where a cookie the client controls cannot reach it.
 */
export async function isEmbedded(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(EMBED_COOKIE)?.value === "1";
}
