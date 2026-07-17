import "server-only";

import { fitbit } from "@/lib/health/fitbit";
import { googleFit } from "@/lib/health/google-fit";
import type { HealthProvider } from "@/lib/health/types";

/** Every wearable/cloud provider. Adding one = import + a line here. */
const ALL: HealthProvider[] = [fitbit, googleFit];

export function getProvider(id: string): HealthProvider | null {
  return ALL.find((p) => p.id === id) ?? null;
}

/** The providers an operator has configured — drives the connect buttons. */
export function enabledProviders(): { id: string; label: string }[] {
  return ALL.filter((p) => p.isEnabled()).map((p) => ({
    id: p.id,
    label: p.label,
  }));
}
