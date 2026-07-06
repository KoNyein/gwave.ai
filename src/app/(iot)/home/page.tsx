import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { SmartHome } from "@/components/home/smart-home";
import { getCurrentProfile } from "@/lib/auth";
import { getDevices, getScenes } from "@/lib/db/iot";

export default async function SmartHomePage() {
  const t = await getTranslations("home");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const [devices, scenes] = await Promise.all([
    getDevices(profile.id),
    getScenes(profile.id),
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
      <SmartHome
        initialSwitches={switches}
        scenes={scenes}
        userId={profile.id}
      />
    </div>
  );
}
