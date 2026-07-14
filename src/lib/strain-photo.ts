import type { Strain, StrainType } from "@/types/database";

// Type-coloured gradients for the sample placeholder (indica=purple,
// sativa=amber, hybrid=teal) — matches STRAIN_TYPE_STYLES.
const GRADIENT: Record<StrainType, [string, string]> = {
  indica: ["#6b21a8", "#c084fc"],
  sativa: ["#a16207", "#fbbf24"],
  hybrid: ["#0f766e", "#5eead4"],
};

/**
 * A strain's photo: the real `image_url` when an admin has set one, otherwise a
 * deterministic, self-contained SVG placeholder (type-coloured gradient with
 * the strain's initials). Works offline and needs no external image host — the
 * app's CSP already allows `data:` images.
 */
export function strainPhoto(
  strain: Pick<Strain, "name" | "type" | "image_url">,
): string {
  if (strain.image_url) return strain.image_url;
  const [c1, c2] = GRADIENT[strain.type];
  const initials = strain.name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 3)
    .toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>` +
    `</linearGradient></defs>` +
    `<rect width="400" height="240" fill="url(#g)"/>` +
    `<text x="200" y="116" font-family="system-ui,sans-serif" font-size="72" ` +
    `font-weight="700" fill="#ffffff" fill-opacity="0.92" text-anchor="middle" ` +
    `dominant-baseline="central">${initials}</text>` +
    `<text x="200" y="200" font-family="system-ui,sans-serif" font-size="20" ` +
    `fill="#ffffff" fill-opacity="0.85" text-anchor="middle" letter-spacing="2">` +
    `${strain.type.toUpperCase()}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
