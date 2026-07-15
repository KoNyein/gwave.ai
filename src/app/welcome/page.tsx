import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  GraduationCap,
  Leaf,
  MessageCircle,
  ShoppingBag,
  Sprout,
  Cpu,
  Users,
  Wrench,
} from "lucide-react";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = {
  title: "Gwave — တောင်သူများအတွက် ဆိုရှယ်နက်ဝက်",
  description:
    "မြန်မာ တောင်သူ၊ စိုက်ပျိုးရေးသမားများအတွက် ဆိုရှယ်မီဒီယာ၊ သင်ယူမှု၊ စျေးဝယ်၊ smart farm — အားလုံး တစ်နေရာတည်း။",
};
export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: Users,
    title: "လူမှုကွန်ရက်",
    body: "မိတ်ဆွေ တောင်သူများနှင့် ချိတ်ဆက်၊ ပို့စ်၊ ဓာတ်ပုံ၊ ဗီဒီယို မျှဝေ။",
  },
  {
    icon: MessageCircle,
    title: "Messenger + ဂိမ်း",
    body: "Realtime စကားပြော၊ အသံ/ဗီဒီယို ခေါ်ဆို၊ စစ်တုရင်နှင့် ကျားထိုး ကစား။",
  },
  {
    icon: GraduationCap,
    title: "အခမဲ့ သင်တန်းများ",
    body: "Coding, AI, Electronics, Robotics, စိုက်ပျိုးရေး — မြန်မာလို သင်ခန်းစာ ၆၀ စီ။",
  },
  {
    icon: ShoppingBag,
    title: "စျေးဝယ် + ရောင်း",
    body: "ကုန်ပစ္စည်း ရောင်း/ဝယ်၊ dropship/affiliate၊ ပို့ဆောင်မှု ခြေရာခံ။",
  },
  {
    icon: Cpu,
    title: "Smart Farm IoT",
    body: "Sensor များ၊ အလိုအလျောက် ရေလောင်း၊ dashboard နဲ့ စိုက်ခင်း စောင့်ကြည့်။",
  },
  {
    icon: Wrench,
    title: "စိုက်ပျိုးရေး Tools",
    body: "EC/PPM, VPD, အမြတ်တွက်စက်၊ မျိုးကွဲ/သတ္တု အချက်အလက် စသည်။",
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
              <Link href="/login">ဝင်မည်</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">စတင်မည်</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-8 text-center sm:pt-16">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sprout className="h-3.5 w-3.5 text-primary" /> မြန်မာ တောင်သူများအတွက်
        </span>
        <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          စိုက်ပျိုးရေး၊ သင်ယူမှုနှင့် အသိုင်းအဝိုင်း —{" "}
          <span className="text-primary">အားလုံး တစ်နေရာတည်း</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Gwave သည် တောင်သူ၊ စိုက်ပျိုးရေးသမားများအတွက် ဆိုရှယ်နက်ဝက်၊ အခမဲ့
          ပညာရေး၊ စျေးကွက်နှင့် smart farm နည်းပညာ ပေါင်းစပ်ထားသော super-app
          ဖြစ်သည်။
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/register">
              အခမဲ့ စတင်မည် <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">အကောင့်ရှိပြီး — ဝင်မည်</Link>
          </Button>
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
            ဒီနေ့ပဲ Gwave အသိုင်းအဝိုင်းထဲ ဝင်လိုက်ပါ
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            အခမဲ့ဖြစ်ပြီး ဖုန်းမှာ app အဖြစ် install လုပ်၍ သုံးနိုင်သည်။
          </p>
          <Button asChild size="lg" className="mt-5">
            <Link href="/register">
              အကောင့်ဖွင့်မည် <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Gwave — growers&apos; super-app
        </p>
      </section>
    </div>
  );
}
