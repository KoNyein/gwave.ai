"use client";

import "@livekit/components-styles";

import * as React from "react";
import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  LiveKitRoom,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import {
  Check,
  Hand,
  Link2,
  Loader2,
  LogOut,
  Radio,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { UserAvatar } from "@/components/social/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  approveCohost,
  getCohostStageToken,
  listCohostGuests,
  removeCohost,
  searchCohostCandidates,
} from "@/lib/actions/cohost";
import { displayName } from "@/lib/format";
import { createClient } from "@/lib/data/client";
import type { AuthorSummary } from "@/types/social";

interface Conn {
  url: string;
  token: string;
  canPublish: boolean;
  isHost: boolean;
}

type RaisePayload = { userId: string; name: string };

/**
 * Co-host Live over the LiveKit SFU. A small set of publishers (the host and
 * approved co-hosts) send camera/mic; the media server fans those streams out
 * to everyone else, so the room scales to thousands of viewers.
 *
 * Two ways onto the stage, so the host is never stuck waiting: a viewer can
 * raise a hand, or the host can invite someone directly by name.
 */
export function CohostStage({
  code,
  currentUser,
}: {
  code: string;
  currentUser: AuthorSummary;
}) {
  const [conn, setConn] = React.useState<Conn | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const reconnect = React.useCallback(() => setReloadKey((k) => k + 1), []);

  React.useEffect(() => {
    let active = true;
    getCohostStageToken(code).then((res) => {
      if (!active) return;
      if (res.ok) {
        setConn(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
    });
    return () => {
      active = false;
    };
  }, [code, reloadKey]);

  if (error) {
    return (
      <div className="rounded-xl border p-8 text-center text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (!conn) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <LiveKitRoom
      // Remount when publish permission changes so we reconnect with the new
      // token after the host promotes this viewer (or takes them back off).
      key={conn.canPublish ? "publisher" : "viewer"}
      serverUrl={conn.url}
      token={conn.token}
      connect
      video={conn.canPublish}
      audio={conn.canPublish}
      data-lk-theme="default"
      className="overflow-hidden rounded-xl border bg-black"
      style={{ height: "72vh" }}
    >
      <StageBody
        code={code}
        currentUser={currentUser}
        canPublish={conn.canPublish}
        isHost={conn.isHost}
        onPermissionChange={reconnect}
      />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

function StageBody({
  code,
  currentUser,
  canPublish,
  isHost,
  onPermissionChange,
}: {
  code: string;
  currentUser: AuthorSummary;
  canPublish: boolean;
  isHost: boolean;
  onPermissionChange: () => void;
}) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: false },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const db = React.useMemo(() => createClient(), []);
  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const [requests, setRequests] = React.useState<RaisePayload[]>([]);
  const [raised, setRaised] = React.useState(false);
  const [guests, setGuests] = React.useState<AuthorSummary[]>([]);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshGuests = React.useCallback(async () => {
    const res = await listCohostGuests(code);
    if (res.ok) setGuests(res.data);
  }, [code]);

  React.useEffect(() => {
    if (isHost) void refreshGuests();
  }, [isHost, refreshGuests]);

  React.useEffect(() => {
    const channel = db.channel(`cohost-stage-${code}`, {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: "raise" }, ({ payload }) => {
      if (!isHost) return;
      const p = payload as RaisePayload;
      setRequests((prev) =>
        prev.some((x) => x.userId === p.userId) ? prev : [...prev, p],
      );
    });
    // Promoted onto the stage, or taken back off it — either way this client
    // needs a fresh token with the new publish grant.
    channel.on("broadcast", { event: "promoted" }, ({ payload }) => {
      if ((payload as { userId: string }).userId === currentUser.id) {
        setRaised(false);
        onPermissionChange();
      }
    });
    channel.on("broadcast", { event: "demoted" }, ({ payload }) => {
      if ((payload as { userId: string }).userId === currentUser.id) {
        onPermissionChange();
      }
    });
    channel.subscribe();
    channelRef.current = channel;
    return () => {
      db.removeChannel(channel);
      channelRef.current = null;
    };
  }, [code, isHost, currentUser.id, onPermissionChange, db]);

  async function raiseHand() {
    setRaised(true);
    await channelRef.current?.send({
      type: "broadcast",
      event: "raise",
      payload: { userId: currentUser.id, name: displayName(currentUser) },
    });
  }

  /** Host: put someone on stage — from a raised hand or from the invite search. */
  async function promote(userId: string) {
    setError(null);
    const res = await approveCohost(code, userId);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await channelRef.current?.send({
      type: "broadcast",
      event: "promoted",
      payload: { userId },
    });
    setRequests((prev) => prev.filter((x) => x.userId !== userId));
    await refreshGuests();
  }

  /** Host removes a co-host, or a co-host steps down themselves. */
  async function demote(userId: string) {
    setError(null);
    const res = await removeCohost(code, userId);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await channelRef.current?.send({
      type: "broadcast",
      event: "demoted",
      payload: { userId },
    });
    if (userId === currentUser.id) {
      onPermissionChange();
      return;
    }
    await refreshGuests();
  }

  const isGuestPublisher = canPublish && !isHost;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 bg-black/60 px-3 py-2 text-white">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Radio className="h-3.5 w-3.5 text-red-500" /> LIVE
          <ViewerCount />
        </span>

        <div className="flex items-center gap-1.5">
          <ShareRoomButton code={code} />

          {isHost ? (
            <Dialog open={manageOpen} onOpenChange={setManageOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <UserPlus className="mr-1 h-4 w-4" />
                  Co-host ထည့်ရန်
                  {requests.length > 0 ? (
                    <span className="ml-1.5 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                      {requests.length}
                    </span>
                  ) : null}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Co-host စီမံခန့်ခွဲရန်</DialogTitle>
                </DialogHeader>
                <ManagePanel
                  code={code}
                  requests={requests}
                  guests={guests}
                  error={error}
                  onApprove={promote}
                  onReject={(userId) =>
                    setRequests((prev) => prev.filter((x) => x.userId !== userId))
                  }
                  onRemove={demote}
                />
              </DialogContent>
            </Dialog>
          ) : null}

          {isGuestPublisher ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => demote(currentUser.id)}
            >
              <LogOut className="mr-1 h-4 w-4" /> Co-host မှ ထွက်မည်
            </Button>
          ) : null}

          {!canPublish ? (
            raised ? (
              <span className="flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1.5 text-xs font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Host ခွင့်ပြုမှု စောင့်နေသည်…
              </span>
            ) : (
              <Button size="sm" variant="secondary" onClick={raiseHand}>
                <Hand className="mr-1 h-4 w-4" />
                Co-host ဝင်ရန် တောင်းမည်
              </Button>
            )
          ) : null}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {tracks.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/70">
            ကင်မရာ စောင့်နေသည်… host ကင်မရာ ဖွင့်သည်နှင့် ဒီမှာ ပေါ်လာပါမည်။
          </div>
        ) : (
          <GridLayout tracks={tracks} className="h-full">
            <ParticipantTile />
          </GridLayout>
        )}
      </div>

      {/* Raised hands stay visible on the stage too, so a busy host can approve
          with one tap without opening the dialog. */}
      {isHost && requests.length > 0 ? (
        <div className="space-y-1.5 bg-black/70 px-3 py-2">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-white/80">
            <Hand className="h-3.5 w-3.5" /> Co-host ဝင်ခွင့် တောင်းထားသူများ
          </p>
          <div className="flex flex-wrap gap-1.5">
            {requests.map((r) => (
              <span
                key={r.userId}
                className="flex items-center gap-1 rounded-full bg-white/10 py-0.5 pl-2.5 pr-0.5 text-xs text-white"
              >
                {r.name}
                <button
                  onClick={() => promote(r.userId)}
                  aria-label={`${r.name} ကို ခွင့်ပြုမည်`}
                  className="ml-0.5 rounded-full bg-primary p-1 text-primary-foreground hover:bg-primary/90"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() =>
                    setRequests((prev) =>
                      prev.filter((x) => x.userId !== r.userId),
                    )
                  }
                  aria-label={`${r.name} ကို ငြင်းပယ်မည်`}
                  className="rounded-full p-1 text-white/70 hover:bg-white/15 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {canPublish ? (
        <ControlBar
          variation="minimal"
          controls={{
            microphone: true,
            camera: true,
            screenShare: true,
            chat: false,
            leave: false,
          }}
        />
      ) : null}
    </div>
  );
}

/** Copy the room link — the fastest way to get people into the room. */
function ShareRoomButton({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    const url = `${window.location.origin}/live/cohost/${code}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Link ကို ကူးယူပါ:", url);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button size="sm" variant="secondary" onClick={copy}>
      {copied ? (
        <Check className="mr-1 h-4 w-4" />
      ) : (
        <Link2 className="mr-1 h-4 w-4" />
      )}
      {copied ? "ကူးပြီး" : "Link မျှဝေရန်"}
    </Button>
  );
}

/** Host's co-host control panel: invite, approve raised hands, remove. */
function ManagePanel({
  code,
  requests,
  guests,
  error,
  onApprove,
  onReject,
  onRemove,
}: {
  code: string;
  requests: RaisePayload[];
  guests: AuthorSummary[];
  error: string | null;
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<AuthorSummary[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const res = await searchCohostCandidates(code, q);
      setResults(res.ok ? res.data : []);
      setSearching(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, code, guests]);

  return (
    <div className="space-y-4 text-sm">
      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 font-semibold">
          <Search className="h-4 w-4 text-primary" /> လူရှာပြီး ဖိတ်ခေါ်ရန်
        </p>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="နာမည် သို့မဟုတ် username ရိုက်ပါ…"
        />
        {searching ? (
          <p className="text-xs text-muted-foreground">ရှာနေသည်…</p>
        ) : null}
        {results.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <UserAvatar profile={p} linked={false} className="h-8 w-8" />
            <span className="min-w-0 flex-1 truncate">{displayName(p)}</span>
            <Button size="sm" onClick={() => onApprove(p.id)}>
              <UserPlus className="mr-1 h-3.5 w-3.5" /> ဖိတ်မည်
            </Button>
          </div>
        ))}
        {query.trim().length >= 2 && !searching && results.length === 0 ? (
          <p className="text-xs text-muted-foreground">မတွေ့ပါ။</p>
        ) : null}
      </div>

      {requests.length > 0 ? (
        <div className="space-y-2 border-t pt-3">
          <p className="flex items-center gap-1.5 font-semibold">
            <Hand className="h-4 w-4 text-primary" /> လက်ထောင်ထားသူများ (
            {requests.length})
          </p>
          {requests.map((r) => (
            <div key={r.userId} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <Button size="sm" onClick={() => onApprove(r.userId)}>
                <Check className="mr-1 h-3.5 w-3.5" /> ခွင့်ပြု
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReject(r.userId)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2 border-t pt-3">
        <p className="flex items-center gap-1.5 font-semibold">
          <Users className="h-4 w-4 text-primary" /> အခု Co-host လုပ်နေသူများ (
          {guests.length})
        </p>
        {guests.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            မရှိသေးပါ။ အပေါ်က ရှာပြီး ဖိတ်ခေါ်နိုင်ပါတယ်။
          </p>
        ) : (
          guests.map((g) => (
            <div key={g.id} className="flex items-center gap-2">
              <UserAvatar profile={g} linked={false} className="h-8 w-8" />
              <span className="min-w-0 flex-1 truncate">{displayName(g)}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemove(g.id)}
                className="text-destructive hover:text-destructive"
              >
                <X className="mr-1 h-3.5 w-3.5" /> ဖယ်မည်
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Live viewer/participant count read from the room without re-rendering per join. */
function ViewerCount() {
  const room = useRoomContext();
  const [n, setN] = React.useState(room.numParticipants);
  React.useEffect(() => {
    const update = () => setN(room.numParticipants);
    room
      .on(RoomEvent.ParticipantConnected, update)
      .on(RoomEvent.ParticipantDisconnected, update)
      .on(RoomEvent.Connected, update);
    update();
    return () => {
      room
        .off(RoomEvent.ParticipantConnected, update)
        .off(RoomEvent.ParticipantDisconnected, update)
        .off(RoomEvent.Connected, update);
    };
  }, [room]);
  return (
    <span className="ml-1 flex items-center gap-1 text-white/80">
      <Users className="h-3.5 w-3.5" /> {n + 1}
    </span>
  );
}
