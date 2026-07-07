import { redirect } from "next/navigation";

import { QrGenerator } from "@/components/tools/qr-generator";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "QR Code Generator" };

export default async function QrToolPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">QR Code Generator</h1>
        <p className="text-sm text-muted-foreground">
          Paste a link or any text — the QR code updates live. Download as PNG
          or SVG for print.
        </p>
      </div>
      <QrGenerator />
    </div>
  );
}
