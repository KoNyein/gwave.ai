import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Download,
  GraduationCap,
  Leaf,
  MessageCircle,
  ShoppingBag,
  Smartphone,
  Sprout,
  Cpu,
  Users,
  Wrench,
} from "lucide-react";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = {
  title: "Gwave — the super-app for farmers",
  description:
    "Social network, learning, marketplace and smart-farm tech for farmers — all in one app.",
};
export const dynamic = "force-dynamic";

/** Direct download for the native Android app. Served from our own domain
 * (`/download/apk` streams the rolling `mobile-latest` build), so users
 * download straight from gwave.cc instead of being sent to GitHub. */
const APK_URL = "/download/apk";

/** Smaller, device-specific (CPU architecture) builds. The universal APK above
 * runs on any phone; these are lighter downloads for a matching device. */
const APK_VARIANTS = [
  {
    abi: "arm64-v8a",
    label: "64-bit phone",
    hint: "Most phones (2016+)",
  },
  {
    abi: "armeabi-v7a",
    label: "32-bit phone",
    hint: "Older / low-cost phones",
  },
  {
    abi: "x86_64",
    label: "Intel / emulator",
    hint: "x86_64 tablets",
  },
] as const;

const FEATURES = [
  {
    icon: Users,
    title: "Social network",
    body: "Connect with fellow farmers and share posts, photos and videos.",
  },
  {
    icon: MessageCircle,
    title: "Messenger + games",
    body: "Realtime chat, voice/video calls, and play chess and Kyar.",
  },
  {
    icon: GraduationCap,
    title: "Free courses",
    body: "Coding, AI, Electronics, Robotics and Agriculture — 60 lessons each.",
  },
  {
    icon: ShoppingBag,
    title: "Buy + sell",
    body: "Trade products, run dropship/affiliate stores, track deliveries.",
  },
  {
    icon: Cpu,
    title: "Smart Farm IoT",
    body: "Sensors, automatic irrigation, and a dashboard to watch your farm.",
  },
  {
    icon: Wrench,
    title: "Farming tools",
    body: "EC/PPM, VPD, profit calculators, strain and mineral references.",
  },
];

export default async function WelcomePage() {
  // Signed-in users go straight to their feed.
  const profile = await getCurrentProfile();
  if (profile) redirect("/feed");

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="flex items-center gap-2 text-primary">
            <Leaf className="h-6 w-6" />
            <span className="text-lg font-bold">Gwave</span>
          </span>
          <div className="flex items-center gap-1.5">
            <LocaleSwitcher />
            <Button asChild size="sm" variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-8 text-center sm:pt-16">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sprout className="h-3.5 w-3.5 text-primary" /> For farmers
        </span>
        <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          Farming, learning and community —{" "}
          <span className="text-primary">all in one place</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Gwave is a super-app for farmers, bringing together a social
          network, free education, a marketplace and smart-farm technology.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">
              Start free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Already have an account — sign in</Link>
          </Button>
        </div>

        {/* Native Android app download — a recommended universal build plus
            smaller per-device (CPU architecture) builds. Every link streams
            from gwave.cc via /download/apk. */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button
            asChild
            size="lg"
            className="bg-foreground text-background hover:bg-foreground/90"
          >
            <a href={`${APK_URL}?abi=universal`} download>
              <Smartphone className="mr-2 h-5 w-5" />
              Download the Android app
              <Download className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <p className="text-xs text-muted-foreground">
            Recommended · works on every phone · Android 5.0 and above
          </p>

          <div className="mt-1 w-full max-w-md rounded-xl border bg-card/60 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Pick a smaller build for your phone
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {APK_VARIANTS.map((v) => (
                <Button
                  key={v.abi}
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-auto flex-col items-start gap-0.5 py-2"
                >
                  <a href={`${APK_URL}?abi=${v.abi}`} download>
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <Download className="h-3.5 w-3.5" /> {v.label}
                    </span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {v.hint}
                    </span>
                  </a>
                </Button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Not sure? The recommended button above works everywhere.
            </p>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border bg-card p-5 transition-colors hover:bg-muted/40"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="rounded-3xl border bg-primary/5 p-8 text-center">
          <Bot className="mx-auto h-9 w-9 text-primary" />
          <h2 className="mt-3 text-xl font-bold">
            Join the Gwave community today
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            It&apos;s free, and you can install it as an app on your phone.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Create an account <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-foreground/20"
            >
              <a href={APK_URL} download>
                <Download className="mr-2 h-4 w-4" /> Android app
              </a>
            </Button>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Gwave — growers&apos; super-app
        </p>
      </section>
    </div>
  );
}
