import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Gwave Metaverse",
  description: "Gwave ရဲ့ 3D virtual world — browser ကနေ တိုက်ရိုက်ဝင်လို့ရတယ်",
};

export const viewport: Viewport = {
  themeColor: "#0a0e24",
  // ဖုန်းမှာ address bar ဖုံးတာ/pinch zoom ကို ပိတ်ထား — joystick နဲ့ camera
  // drag က browser ရဲ့ zoom gesture နဲ့ တိုက်တတ်တယ်။
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/// Metaverse က route group တွေရဲ့ ပြင်ပမှာ ရှိလို့ AppShell (navbar, sidebar)
/// မပါဘူး — 3D canvas က မျက်နှာပြင်တစ်ခုလုံး ယူရမယ်။
export default function MetaverseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0e24] text-white">
      {children}
    </div>
  );
}
