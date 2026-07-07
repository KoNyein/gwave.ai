// Pure, dependency-free age helpers. Safe to import from client components.

export type AgeBand = "child" | "preteen" | "teen" | "adult" | "unknown";

export function ageBandOf(birthDate: string | null): AgeBand {
  if (!birthDate) return "unknown";
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return "unknown";
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  if (age < 12) return "child";
  if (age < 16) return "preteen";
  if (age < 18) return "teen";
  return "adult";
}

export function isAdultBirthDate(birthDate: string | null): boolean {
  return ageBandOf(birthDate) === "adult";
}

export function isMinorBirthDate(birthDate: string | null): boolean {
  const band = ageBandOf(birthDate);
  return band === "child" || band === "preteen" || band === "teen";
}
