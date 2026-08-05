import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentProfile } from "@/lib/auth";
import { PlatformDashboard } from "@/components/home/platform-dashboard";

/// 🏠 Gwave Home PLATFORM (the unified IoT engine: registry + traits + MQTT
/// + rules) — distinct from the older /home smart-home page, which keeps
/// working untouched; this is the ESP32/auto-discovery generation.

export const metadata: Metadata = {
  title: "🏠 Gwave Home Platform — Smart Home/Farm",
};

export default async function IotPlatformPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=/iot");
  return (
    <main className="min-h-dvh bg-[#0b0f17] text-white">
      <header className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
        <Link href="/" className="text-white/60 hover:text-white">
          ←
        </Link>
        <h1 className="text-sm font-semibold">
          🏠 Gwave Home Platform — Smart Home/Farm
        </h1>
      </header>
      <PlatformDashboard />
    </main>
  );
}
