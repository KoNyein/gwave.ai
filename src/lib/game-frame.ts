// Which origins the catalog player is allowed to embed in an iframe. This MUST
// match the CSP frame-src in next.config.mjs, or the browser will block the
// frame. Games hosted anywhere else simply will not play until their origin is
// added to the allowlist — a deliberate safety boundary, since admins paste
// arbitrary URLs.
//
// Add your own AWS S3 / CloudFront origin (and any other trusted game host) via
// the NEXT_PUBLIC_GAME_FRAME_ORIGINS env var, space-separated, e.g.
//   NEXT_PUBLIC_GAME_FRAME_ORIGINS="https://games.greenwave.example https://d1234.cloudfront.net"

/** Trusted educational game origins that ship allow-listed out of the box. */
export const BUILTIN_GAME_ORIGINS = ["https://phet.colorado.edu"];

/** Extra origins configured by the operator (their AWS host, etc.). */
export function envGameOrigins(): string[] {
  return (process.env.NEXT_PUBLIC_GAME_FRAME_ORIGINS ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** All origins the catalog player may embed. */
export function allowedGameOrigins(): string[] {
  return [...BUILTIN_GAME_ORIGINS, ...envGameOrigins()];
}

/** True when a game URL's origin is on the allowlist (so it will actually play). */
export function isGameEmbeddable(url: string): boolean {
  try {
    const origin = new URL(url).origin;
    return allowedGameOrigins().includes(origin);
  } catch {
    return false;
  }
}
