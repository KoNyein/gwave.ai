/**
 * Hardened CSP injected at position 0 of every community-game document.
 *
 * The srcdoc iframe's sandbox="allow-scripts" gives the game an opaque
 * origin, but sandboxing alone does NOT block network requests — and the
 * inherited page CSP allows hosts like *.supabase.co, which would be an
 * exfiltration channel for untrusted code. A meta CSP combines with the
 * page policy by intersection (it can only tighten it), so prepending this
 * tag enforces the "no network" guarantee: no fetch/XHR/WebSocket/beacon,
 * no external subresources — only inline code and data:/blob: assets.
 *
 * Leading metadata content always lands in the implied <head> before any
 * game markup is parsed, so the policy is active before the first script.
 */
const GAME_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "media-src data: blob:",
  "font-src data:",
  "connect-src 'none'",
  "form-action 'none'",
].join("; ");

/** Wraps submitted game code for safe execution inside the sandbox iframe. */
export function buildGameDoc(code: string): string {
  return `<meta http-equiv="Content-Security-Policy" content="${GAME_CSP}">${code}`;
}
