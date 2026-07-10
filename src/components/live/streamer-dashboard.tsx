import Link from "next/link";
import { Heart, MessageCircle, Radio, Timer, Users, Video } from "lucide-react";

import { timeAgo } from "@/lib/format";
import type { HostDashboard } from "@/lib/db/live";

const STATUS: Record<string, { label: string; cls: string }> = {
  live: { label: "🔴 Live", cls: "bg-destructive/15 text-destructive" },
  idle: { label: "စောင့်ဆိုင်း", cls: "bg-amber-500/15 text-amber-600" },
  ended: { label: "ပြီးဆုံး", cls: "bg-muted text-muted-foreground" },
};

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

export function StreamerDashboard({ data }: { data: HostDashboard }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat
          icon={<Video className="h-3.5 w-3.5" />}
          label="Stream"
          value={String(data.totalStreams)}
        />
        <Stat
          icon={<Radio className="h-3.5 w-3.5" />}
          label="Live ယခု"
          value={String(data.liveNow)}
        />
        <Stat
          icon={<Users className="h-3.5 w-3.5" />}
          label="ကြည့်သူ အမြင့်ဆုံး"
          value={data.peakViewers.toLocaleString("en-US")}
        />
        <Stat
          icon={<Heart className="h-3.5 w-3.5" />}
          label="React"
          value={data.totalReactions.toLocaleString("en-US")}
        />
        <Stat
          icon={<MessageCircle className="h-3.5 w-3.5" />}
          label="Chat"
          value={data.totalMessages.toLocaleString("en-US")}
        />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">📊 Stream အလိုက် စာရင်း</h2>
        {data.streams.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Stream မရှိသေးပါ —{" "}
            <Link href="/live/new" className="text-primary hover:underline">
              စတင်ရန်
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2">ခေါင်းစဉ်</th>
                  <th className="py-2 pr-2">အခြေအနေ</th>
                  <th className="py-2 pr-2 text-right">ကြည့်သူ</th>
                  <th className="py-2 pr-2 text-right">React</th>
                  <th className="py-2 pr-2 text-right">Chat</th>
                  <th className="py-2 text-right">ကြာချိန်</th>
                </tr>
              </thead>
              <tbody>
                {data.streams.map(({ stream, reactions, messages, durationMinutes }) => {
                  const st = STATUS[stream.status] ?? STATUS.ended!;
                  return (
                    <tr key={stream.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <Link
                          href={`/live/${stream.id}`}
                          className="line-clamp-1 font-medium hover:underline"
                        >
                          {stream.title}
                        </Link>
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgo(stream.created_at)}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {stream.viewer_count.toLocaleString("en-US")}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {reactions.toLocaleString("en-US")}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        {messages.toLocaleString("en-US")}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {durationMinutes != null ? (
                          <span className="inline-flex items-center gap-1">
                            <Timer className="h-3 w-3" /> {durationMinutes}m
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
