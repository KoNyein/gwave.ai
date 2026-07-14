"use client";

import * as React from "react";

import type { RealtimeChannel } from "@supabase/supabase-js";

import { sendMessage } from "@/lib/actions/messages";
import { createClient } from "@/lib/supabase/client";
import type { AuthorSummary } from "@/types/social";

// WebRTC audio/video calls for the 1:1 messenger. Supabase Realtime
// broadcast channels carry the signaling (ring / accept / offer / answer /
// ICE / hangup); the media itself flows peer-to-peer over WebRTC.
//
//   caller                                callee
//   ── ring ──────────▶ calls:{calleeId}  (personal ring channel)
//                       call:{callId} ◀── accept ──
//   ── offer ─────────▶
//                       ◀── answer ──
//   ◀─ ice ─▶  (trickle, both directions)
//   ── hangup ────────▶  (either side)
//
// STUN is Google's public server; an optional TURN relay can be configured
// with NEXT_PUBLIC_TURN_URL/USERNAME/CREDENTIAL for strict NATs.

export type CallStatus =
  | "idle"
  | "incoming" // ringing on our side
  | "outgoing" // waiting for the peer to accept
  | "connecting" // accepted, WebRTC handshake in flight
  | "active"; // media flowing

export interface CallState {
  status: CallStatus;
  peer: AuthorSummary | null;
  video: boolean;
  /** Seconds since the call connected (active only). */
  duration: number;
  muted: boolean;
  cameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export interface CallApi extends CallState {
  startCall: (
    peer: AuthorSummary,
    conversationId: string,
    video: boolean,
  ) => void;
  accept: () => void;
  decline: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

const RING_TIMEOUT_MS = 45_000;

/**
 * Identifies this browser tab. Every tab a user has open subscribes to the same
 * `calls:{userId}` channel and so receives the same ring, which is what let a
 * second tab keep ringing after the first had answered — and answer the call a
 * second time. Broadcasts between a user's own tabs carry this so a tab can tell
 * itself apart from its siblings.
 */
const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/** A call-log message the caller just wrote, so the UI can show it immediately. */
export interface CallLogMessage {
  id: string;
  conversationId: string;
  content: string;
}

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

interface Session {
  callId: string;
  conversationId: string;
  peer: AuthorSummary;
  video: boolean;
  isCaller: boolean;
  channel: RealtimeChannel;
  pc: RTCPeerConnection | null;
  localStream: MediaStream | null;
  ringChannel: RealtimeChannel | null;
  ringTimer: ReturnType<typeof setTimeout> | null;
  durationTimer: ReturnType<typeof setInterval> | null;
  connectedAt: number | null;
  /** The peer actively declined, as opposed to never picking up. */
  declined?: boolean;
  /**
   * An `accept` has been taken for this call. Set synchronously so a second
   * `accept` — from another of the callee's tabs — can't start a second
   * negotiation on top of a call that is already up.
   */
  accepted?: boolean;
  /** In-flight setupMedia, so concurrent callers share one peer connection. */
  mediaPromise?: Promise<RTCPeerConnection> | null;
  /** ICE candidates that arrived before the remote description was set. */
  pendingIce: RTCIceCandidateInit[];
}

export function useCall(
  currentUser: AuthorSummary,
  onCallLog?: (message: CallLogMessage) => void,
): CallApi {
  const [state, setState] = React.useState<CallState>({
    status: "idle",
    peer: null,
    video: false,
    duration: 0,
    muted: false,
    cameraOff: false,
    localStream: null,
    remoteStream: null,
  });

  const session = React.useRef<Session | null>(null);
  const incoming = React.useRef<{
    callId: string;
    conversationId: string;
    from: AuthorSummary;
    video: boolean;
  } | null>(null);
  /** Our subscribed `calls:{userId}` channel — also how we reach our own tabs. */
  const ringInbox = React.useRef<RealtimeChannel | null>(null);
  /** Stops the ring if the caller's tab dies without ever sending `cancel`. */
  const incomingTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest callback without making every useCallback below depend on it.
  const onCallLogRef = React.useRef(onCallLog);
  onCallLogRef.current = onCallLog;

  const patch = React.useCallback((update: Partial<CallState>) => {
    setState((previous) => ({ ...previous, ...update }));
  }, []);

  const clearIncomingTimer = React.useCallback(() => {
    if (incomingTimer.current) {
      clearTimeout(incomingTimer.current);
      incomingTimer.current = null;
    }
  }, []);

  /** Tear everything down and (as caller) log the call into the chat. */
  const cleanup = React.useCallback(
    (log: boolean) => {
      const s = session.current;
      session.current = null;
      incoming.current = null;
      clearIncomingTimer();
      if (s) {
        if (s.ringTimer) clearTimeout(s.ringTimer);
        if (s.durationTimer) clearInterval(s.durationTimer);
        s.localStream?.getTracks().forEach((track) => track.stop());
        s.pc?.close();
        const supabase = createClient();
        void supabase.removeChannel(s.channel);
        if (s.ringChannel) void supabase.removeChannel(s.ringChannel);

        // One call-log message per call, written by the caller.
        if (log && s.isCaller) {
          const kind = s.video ? "video" : "audio";
          const content = s.connectedAt
            ? `📞 ${kind === "video" ? "Video" : "Audio"} call · ${formatDuration(Math.round((Date.now() - s.connectedAt) / 1000))}`
            : s.declined
              ? `📞 Declined ${kind} call`
              : `📞 Missed ${kind} call`;
          const conversationId = s.conversationId;
          void (async () => {
            const result = await sendMessage({
              conversationId,
              content,
              imagePath: null,
            });
            // The messenger drops realtime INSERTs it sent itself (its optimistic
            // path covers those), and this insert doesn't go through that path —
            // so hand the row back or the caller won't see their own call log
            // until they reload.
            if (result.ok) {
              onCallLogRef.current?.({
                id: result.data.messageId,
                conversationId,
                content,
              });
            }
          })();
        }
      }
      patch({
        status: "idle",
        peer: null,
        video: false,
        duration: 0,
        muted: false,
        cameraOff: false,
        localStream: null,
        remoteStream: null,
      });
    },
    [clearIncomingTimer, patch],
  );

  /**
   * Create the RTCPeerConnection and local media for an accepted call.
   *
   * Exactly once per session. This used to blindly overwrite `s.pc`/`s.localStream`,
   * so a second `accept` (a second tab answering) orphaned the first peer
   * connection and its stream: cleanup could only ever stop the *last* one, and
   * the camera light stayed on until the tab was closed.
   */
  const setupMedia = React.useCallback(
    (s: Session): Promise<RTCPeerConnection> => {
      if (s.pc) return Promise.resolve(s.pc);
      if (s.mediaPromise) return s.mediaPromise;

      s.mediaPromise = (async () => {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: s.video
            ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
            : false,
        });
        // The call can end while the permission prompt is still up — declined,
        // hung up, or the tab unmounted. cleanup() already ran and saw a null
        // stream, so nothing will ever stop these tracks but us.
        if (session.current !== s) {
          localStream.getTracks().forEach((track) => track.stop());
          throw new Error("Call ended before media was ready.");
        }
        const pc = new RTCPeerConnection({ iceServers: iceServers() });
        s.pc = pc;
        s.localStream = localStream;
        localStream
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStream));

        const remoteStream = new MediaStream();
        pc.ontrack = (event) => {
          event.streams[0]?.getTracks().forEach((track) => {
            if (!remoteStream.getTracks().includes(track)) {
              remoteStream.addTrack(track);
            }
          });
          patch({ remoteStream });
        };
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            void s.channel.send({
              type: "broadcast",
              event: "ice",
              payload: { candidate: event.candidate.toJSON() },
            });
          }
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected" && session.current === s) {
            s.connectedAt = s.connectedAt ?? Date.now();
            if (!s.durationTimer) {
              s.durationTimer = setInterval(() => {
                if (s.connectedAt) {
                  patch({
                    duration: Math.round((Date.now() - s.connectedAt) / 1000),
                  });
                }
              }, 1000);
            }
            patch({ status: "active" });
          } else if (
            // "disconnected" is transient — a Wi-Fi/LTE handover or a couple of
            // lost packets routinely lands here and then recovers on its own.
            // Treating it as terminal hung up the call after a two-second blip
            // (and wrote a call-log message about it). Only "failed" is final.
            (pc.connectionState === "failed" ||
              pc.connectionState === "closed") &&
            session.current === s
          ) {
            cleanup(true);
          }
        };

        patch({ localStream });
        return pc;
      })();

      return s.mediaPromise;
    },
    [cleanup, patch],
  );

  /** Apply any ICE candidates queued while the remote SDP was pending. */
  const drainIce = React.useCallback(async (s: Session) => {
    if (!s.pc?.remoteDescription) return;
    const queued = s.pendingIce.splice(0);
    for (const candidate of queued) {
      try {
        await s.pc.addIceCandidate(candidate);
      } catch {
        // Late/duplicate candidates are harmless.
      }
    }
  }, []);

  /**
   * Registers the per-call signaling handlers (both roles). The caller of
   * this function is responsible for subscribing the channel exactly once.
   */
  const joinCallChannel = React.useCallback(
    (s: Session) => {
      // Media/SDP failure (e.g. the user denied the camera prompt): tell the
      // peer before tearing down, so they don't hang in "connecting".
      const handleFatal = () => {
        if (session.current !== s) return;
        void s.channel.send({
          type: "broadcast",
          event: "hangup",
          payload: {},
        });
        cleanup(true);
      };

      s.channel
        .on("broadcast", { event: "accept" }, async () => {
          // Caller side: peer accepted → offer.
          if (!s.isCaller || session.current !== s) return;
          // Take the first accept only. If the callee had two tabs open, both
          // could answer, and this handler would run setupMedia a second time —
          // renegotiating against the second tab and orphaning the peer
          // connection (and camera) already established with the first.
          if (s.accepted) return;
          s.accepted = true;
          if (s.ringTimer) clearTimeout(s.ringTimer);
          patch({ status: "connecting" });
          try {
            const pc = await setupMedia(s);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            void s.channel.send({
              type: "broadcast",
              event: "offer",
              payload: { sdp: offer },
            });
          } catch {
            handleFatal();
          }
        })
        .on("broadcast", { event: "offer" }, async (message) => {
          // Callee side: answer the offer.
          if (s.isCaller || session.current !== s) return;
          try {
            const pc = s.pc ?? (await setupMedia(s));
            await pc.setRemoteDescription(
              message.payload.sdp as RTCSessionDescriptionInit,
            );
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await drainIce(s);
            void s.channel.send({
              type: "broadcast",
              event: "answer",
              payload: { sdp: answer },
            });
          } catch {
            handleFatal();
          }
        })
        .on("broadcast", { event: "answer" }, async (message) => {
          if (!s.isCaller || session.current !== s || !s.pc) return;
          try {
            await s.pc.setRemoteDescription(
              message.payload.sdp as RTCSessionDescriptionInit,
            );
            await drainIce(s);
          } catch {
            handleFatal();
          }
        })
        .on("broadcast", { event: "ice" }, async (message) => {
          if (session.current !== s) return;
          const candidate = message.payload.candidate as RTCIceCandidateInit;
          if (!s.pc?.remoteDescription) {
            s.pendingIce.push(candidate);
            return;
          }
          try {
            await s.pc.addIceCandidate(candidate);
          } catch {
            // Late/duplicate candidates are harmless.
          }
        })
        .on("broadcast", { event: "decline" }, () => {
          // Only the caller acts on a decline — and only before the call is up.
          // Both were bugs: the callee's own session also listened here, so a
          // second (still-ringing) tab hitting Decline tore down the live call
          // its sibling had already answered, and logged it as "Declined".
          if (!s.isCaller || session.current !== s) return;
          if (s.accepted || s.connectedAt) return;
          s.declined = true;
          cleanup(true);
        })
        .on("broadcast", { event: "hangup" }, () => {
          if (session.current === s) cleanup(s.isCaller);
        });
    },
    [cleanup, drainIce, patch, setupMedia],
  );

  // Personal ring channel — listens for incoming calls while the messenger
  // is open. Ring payloads are peer-supplied, so before showing any UI the
  // claimed caller is verified against the conversation's participant list
  // (RLS: only readable when WE are a participant too). A ring whose
  // conversation doesn't include both parties is dropped — nobody can ring
  // us under someone else's name — and the caller identity we display comes
  // from the database, never from the broadcast payload.
  React.useEffect(() => {
    const supabase = createClient();

    async function verifyRing(payload: {
      conversationId: string;
      fromId: string;
    }): Promise<AuthorSummary | null> {
      const { data } = await supabase
        .from("conversation_participants")
        .select(
          "user_id, profile:profiles!conversation_participants_user_id_fkey(id, username, full_name, avatar_url)",
        )
        .eq("conversation_id", payload.conversationId)
        .returns<{ user_id: string; profile: AuthorSummary }[]>();
      const includesMe = data?.some((row) => row.user_id === currentUser.id);
      const caller = data?.find((row) => row.user_id === payload.fromId);
      return includesMe && caller ? caller.profile : null;
    }

    const channel = supabase
      .channel(`calls:${currentUser.id}`)
      .on("broadcast", { event: "ring" }, (message) => {
        const payload = message.payload as {
          callId?: string;
          conversationId?: string;
          video?: boolean;
          from?: AuthorSummary;
        };
        if (
          !payload.callId ||
          !payload.conversationId ||
          !payload.from?.id ||
          payload.from.id === currentUser.id ||
          session.current ||
          incoming.current
        ) {
          return; // busy or malformed — let it ring out on the caller side
        }
        const ring = {
          callId: payload.callId,
          conversationId: payload.conversationId,
          video: Boolean(payload.video),
        };
        void verifyRing({
          conversationId: ring.conversationId,
          fromId: payload.from.id,
        }).then((verifiedCaller) => {
          // Re-check state: a call may have started while verifying.
          if (!verifiedCaller || session.current || incoming.current) return;
          incoming.current = { ...ring, from: verifiedCaller };
          // The caller sends `cancel` when it gives up — but if the caller's tab
          // dies first, nothing ever arrives and we ring forever. Time it out.
          clearIncomingTimer();
          incomingTimer.current = setTimeout(() => {
            if (incoming.current?.callId !== ring.callId || session.current) return;
            incoming.current = null;
            patch({ status: "idle", peer: null, video: false });
          }, RING_TIMEOUT_MS + 5_000);
          patch({
            status: "incoming",
            peer: verifiedCaller,
            video: ring.video,
          });
        });
      })
      .on("broadcast", { event: "cancel" }, (message) => {
        if (incoming.current?.callId === (message.payload as { callId?: string }).callId) {
          clearIncomingTimer();
          incoming.current = null;
          if (!session.current) patch({ status: "idle", peer: null });
        }
      })
      .on("broadcast", { event: "answered" }, (message) => {
        // One of our *other* tabs picked this call up. `cancel` is only ever sent
        // for a call that never connects, so without this we'd ring forever — and
        // could answer the same call a second time on top of the live one.
        const payload = message.payload as { callId?: string; tabId?: string };
        if (payload.tabId === TAB_ID) return;
        if (incoming.current?.callId !== payload.callId) return;
        clearIncomingTimer();
        incoming.current = null;
        if (!session.current) {
          patch({ status: "idle", peer: null, video: false });
        }
      })
      .subscribe();
    ringInbox.current = channel;

    return () => {
      ringInbox.current = null;
      void supabase.removeChannel(channel);
      cleanup(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.id]);

  const startCall = React.useCallback(
    (peer: AuthorSummary, conversationId: string, video: boolean) => {
      if (session.current || incoming.current) return;
      const supabase = createClient();
      const callId = crypto.randomUUID();

      const s: Session = {
        callId,
        conversationId,
        peer,
        video,
        isCaller: true,
        channel: supabase.channel(`call:${callId}`),
        pc: null,
        localStream: null,
        ringChannel: null,
        ringTimer: null,
        durationTimer: null,
        connectedAt: null,
        pendingIce: [],
      };
      session.current = s;
      joinCallChannel(s);

      // Join our own call channel FIRST — only ring the peer once we are
      // subscribed, otherwise a fast "accept" broadcast could be missed.
      s.channel.subscribe((callStatus) => {
        if (callStatus !== "SUBSCRIBED" || session.current !== s) return;
        if (s.ringChannel) return; // already ringing (subscribe callbacks repeat)
        const ringChannel = supabase.channel(`calls:${peer.id}`);
        s.ringChannel = ringChannel;
        ringChannel.subscribe((ringStatus) => {
          if (ringStatus === "SUBSCRIBED") {
            void ringChannel.send({
              type: "broadcast",
              event: "ring",
              payload: {
                callId,
                conversationId,
                video,
                from: {
                  id: currentUser.id,
                  username: currentUser.username,
                  full_name: currentUser.full_name,
                  avatar_url: currentUser.avatar_url,
                },
              },
            });
          }
        });
      });

      s.ringTimer = setTimeout(() => {
        if (session.current === s && !s.connectedAt) {
          void s.ringChannel?.send({
            type: "broadcast",
            event: "cancel",
            payload: { callId },
          });
          cleanup(true); // logs a missed call
        }
      }, RING_TIMEOUT_MS);

      patch({ status: "outgoing", peer, video });
    },
    [cleanup, currentUser, joinCallChannel, patch],
  );

  const accept = React.useCallback(() => {
    const ring = incoming.current;
    if (!ring || session.current) return;
    clearIncomingTimer();
    // Silence our other tabs. They're ringing the same call on the same shared
    // `calls:{userId}` channel, and no `cancel` will ever come for a call that
    // connects — so this is the only thing that stops them.
    void ringInbox.current?.send({
      type: "broadcast",
      event: "answered",
      payload: { callId: ring.callId, tabId: TAB_ID },
    });
    const supabase = createClient();
    const s: Session = {
      callId: ring.callId,
      conversationId: ring.conversationId,
      peer: ring.from,
      video: ring.video,
      isCaller: false,
      channel: supabase.channel(`call:${ring.callId}`),
      pc: null,
      localStream: null,
      ringChannel: null,
      ringTimer: null,
      durationTimer: null,
      connectedAt: null,
      pendingIce: [],
    };
    session.current = s;
    incoming.current = null;
    joinCallChannel(s);
    s.channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void s.channel.send({ type: "broadcast", event: "accept", payload: {} });
      }
    });
    patch({ status: "connecting" });
  }, [clearIncomingTimer, joinCallChannel, patch]);

  const decline = React.useCallback(() => {
    const ring = incoming.current;
    incoming.current = null;
    clearIncomingTimer();
    if (ring) {
      const supabase = createClient();
      const channel = supabase.channel(`call:${ring.callId}`);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel
            .send({ type: "broadcast", event: "decline", payload: {} })
            .finally(() => void supabase.removeChannel(channel));
        }
      });
    }
    patch({ status: "idle", peer: null, video: false });
  }, [clearIncomingTimer, patch]);

  const hangUp = React.useCallback(() => {
    const s = session.current;
    if (!s) return;
    void s.channel.send({ type: "broadcast", event: "hangup", payload: {} });
    if (s.isCaller && !s.connectedAt && s.ringChannel) {
      void s.ringChannel.send({
        type: "broadcast",
        event: "cancel",
        payload: { callId: s.callId },
      });
    }
    cleanup(true);
  }, [cleanup]);

  const toggleMute = React.useCallback(() => {
    const s = session.current;
    if (!s?.localStream) return;
    const enabled = !s.localStream.getAudioTracks()[0]?.enabled;
    s.localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    patch({ muted: !enabled });
  }, [patch]);

  const toggleCamera = React.useCallback(() => {
    const s = session.current;
    if (!s?.localStream) return;
    const enabled = !s.localStream.getVideoTracks()[0]?.enabled;
    s.localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
    patch({ cameraOff: !enabled });
  }, [patch]);

  return {
    ...state,
    startCall,
    accept,
    decline,
    hangUp,
    toggleMute,
    toggleCamera,
  };
}
