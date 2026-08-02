import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Gwave FPV Simulator",
  description:
    "Liftoff-style FPV drone simulator — acro/freestyle/sport/cinematic, controller support, multiplayer",
};

export const viewport: Viewport = {
  themeColor: "#0a0e24",
  // Touch stick တွေက browser zoom gesture နဲ့ တိုက်တတ်လို့ pinch zoom ပိတ်
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/// Metaverse လိုပဲ AppShell မပါ — canvas က မျက်နှာပြင် အပြည့်ယူတယ်။
export default function FpvLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0e24] text-white">
      {children}
    </div>
  );
}
