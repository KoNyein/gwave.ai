/** Public API scopes (shared between server auth and the dev UI). */
export const API_SCOPES = [
  "read:posts",
  "read:knowledge",
  "read:sensors",
  "read:pos",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];
