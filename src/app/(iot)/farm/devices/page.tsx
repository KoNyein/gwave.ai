import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DeviceRow } from "@/components/farm/device-row";
import { RegisterDeviceDialog } from "@/components/farm/register-device-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { getDevices } from "@/lib/db/iot";

export default async function DevicesPage() {
  const t = await getTranslations("farm");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const devices = await getDevices(profile.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-xl font-bold">{t("devicesTitle")}</h1>
        <RegisterDeviceDialog />
      </div>

      <Card>
        <CardContent className="divide-y px-4 py-1">
          {devices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noDevices")}
            </p>
          ) : (
            devices.map((device) => (
              <DeviceRow key={device.id} device={device} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
