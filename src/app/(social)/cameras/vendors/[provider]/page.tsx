import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { VendorCameraImport } from "@/components/cctv/vendor/vendor-camera-import";
import { getCurrentProfile } from "@/lib/auth";
import { getCameraVendorConnector } from "@/lib/cctv/vendors/registry";
import { isVendorCloudEnabled } from "@/lib/db/cctv-vendors";

export const metadata = { title: "Import cameras" };
export const dynamic = "force-dynamic";

/**
 * The camera import page a successful vendor callback lands on. Everything
 * data-driven happens client-side in VendorCameraImport against the vendor
 * API routes; this shell only gates auth + feature flag.
 */
export default async function VendorImportPage(props: {
  params: Promise<{ provider: string }>;
}) {
  const params = await props.params;
  if (!(await isVendorCloudEnabled())) notFound();
  const connector = getCameraVendorConnector(params.provider);
  if (!connector) notFound();

  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?redirectTo=${encodeURIComponent("/cameras")}`);

  const t = await getTranslations("cctv");
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link
        href="/cameras"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("title")}
      </Link>
      <div>
        <h1 className="text-lg font-semibold">
          {t("vendorImportTitle", { provider: connector.label })}
        </h1>
        <p className="text-sm text-muted-foreground">{t("vendorImportHint")}</p>
      </div>
      <VendorCameraImport provider={connector.id} />
    </div>
  );
}
