import { Music } from "lucide-react";

import { AudioPublishForm } from "@/components/admin/audio-publish-form";
import { Card, CardContent } from "@/components/ui/card";
import { getTracksByKind, type AudioTrack } from "@/lib/db/audio";

export const metadata = { title: "Admin · Audio" };
export const dynamic = "force-dynamic";

export default async function AdminAudioPage() {
  const [music, podcasts, audiobooks] = await Promise.all([
    getTracksByKind("music", 20),
    getTracksByKind("podcast", 20),
    getTracksByKind("audiobook", 20),
  ]);
  const recent: AudioTrack[] = [...music, ...podcasts, ...audiobooks]
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
    .slice(0, 30);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Music className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Audio catalogue</h1>
          <p className="text-sm text-muted-foreground">
            Publish music, podcasts and audiobooks to the store.
          </p>
        </div>
      </div>

      <AudioPublishForm />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Recently published ({recent.length})
        </h2>
        {recent.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No tracks yet — publish the first one above.
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Title</th>
                  <th className="p-2">Kind</th>
                  <th className="p-2">Tier</th>
                  <th className="p-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tk) => (
                  <tr key={tk.id} className="border-t border-border">
                    <td className="p-2">
                      <a href={`/audio/${tk.id}`} className="font-medium hover:underline">
                        {tk.title}
                      </a>
                    </td>
                    <td className="p-2 capitalize text-muted-foreground">{tk.kind}</td>
                    <td className="p-2 text-muted-foreground">
                      {tk.is_premium ? "Premium" : "Free"}
                    </td>
                    <td className="p-2 tabular-nums text-muted-foreground">
                      {tk.is_premium && tk.price ? `${tk.currency} ${tk.price}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
