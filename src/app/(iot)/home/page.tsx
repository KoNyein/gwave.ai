import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { HomeAlerts } from "@/components/home/home-alerts";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { SmartHome } from "@/components/home/smart-home";
import { getCurrentProfile } from "@/lib/auth";
import { getAlerts, getDevices, getLatestReadings, getScenes } from "@/lib/db/iot";

export default async function SmartHomePage() {
  const t = await getTranslations("home");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [devices, scenes, readings, alerts] = await Promise.all([
    getDevices(profile.id),
    getScenes(profile.id),
    getLatestReadings(),
    getAlerts(profile.id, 30),
  ]);
  const switches = devices.filter((device) => device.type === "switch");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">{t("title")}</h1>
        <Link
          href="/farm/devices"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("manageDevices")}
        </Link>
      </div>

      <HomeDashboard
        devices={devices}
        scenesCount={scenes.length}
        readings={readings}
      />

      <HomeAlerts initialAlerts={alerts} userId={profile.id} />

      <SmartHome
        initialSwitches={switches}
        scenes={scenes}
        userId={profile.id}
      />
    </div>
  );
}
