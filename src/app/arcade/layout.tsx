import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Gwave Edu Arcade",
  description: "three.js ပညာရေး 3D ဂိမ်းများ — သင်္ချာ, စာလုံးပေါင်း, အရောင်, memory",
};

export const viewport: Viewport = {
  themeColor: "#101a33",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

/// Metaverse/FPV လိုပဲ AppShell မပါ — canvas မျက်နှာပြင်အပြည့်
export default function ArcadeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-[#101a33] text-white">
      {children}
    </div>
  );
}
