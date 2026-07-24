import { redirect } from "next/navigation";
import { Flower2, HeartPulse, Radio, Sparkles, Wind } from "lucide-react";

import { MeditationTimer } from "@/components/wellness/meditation-timer";
import { WimHofBreathing } from "@/components/wellness/wim-hof-breathing";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/data/server";
import type { WellnessItem } from "@/types/database";

export const metadata = { title: "Wellness" };
export const dynamic = "force-dynamic";

export default async function WellnessPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const db = await createClient();
  const { data } = await db
    .from("wellness_items")
    .select("*")
    .order("position", { ascending: true });
  const items = (data ?? []) as WellnessItem[];

  const byKind = (kind: WellnessItem["kind"]) =>
    items.filter((i) => i.kind === kind);

  const dhamma = byKind("dhamma");
  const meditation = byKind("meditation");
  const radio = byKind("radio");
  const health = byKind("health");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Wellness &amp; Dhamma</h1>
        <p className="text-sm text-muted-foreground">
          A calm space for reflection, meditation, and gentle wellbeing.
        </p>
      </div>

      {/* Dhamma */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-primary" /> Dhamma reflections
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {dhamma.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{item.title}</p>
                  {item.duration_minutes && (
                    <span className="text-xs text-muted-foreground">
                      {item.duration_minutes} min
                    </span>
                  )}
                </div>
                {item.body && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.body}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Guided breathing (Wim Hof method) */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Wind className="h-4 w-4 text-primary" /> Guided breathing
        </h2>
        <WimHofBreathing />
      </section>

      {/* Meditation timer */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Flower2 className="h-4 w-4 text-primary" /> Meditation
        </h2>
        <MeditationTimer
          presets={meditation.map((m) => ({
            title: m.title,
            minutes: m.duration_minutes ?? 5,
            body: m.body,
          }))}
        />
      </section>

      {/* Radio / listening */}
      {radio.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Radio className="h-4 w-4 text-primary" /> Listen
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {radio.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <p className="font-semibold">{item.title}</p>
                  {item.body && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.body}
                    </p>
                  )}
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      Open ↗
                    </a>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Coming soon
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Health guidance */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <HeartPulse className="h-4 w-4 text-primary" /> Health &amp; care
        </h2>
        <div className="space-y-3">
          {health.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <p className="font-semibold">{item.title}</p>
                {item.body && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.body}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          This information is for general wellbeing only and is not medical
          advice or a diagnosis. Always consult a qualified healthcare
          professional, and contact your local emergency number in an
          emergency.
        </p>
      </section>
    </div>
  );
}
