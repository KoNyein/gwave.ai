"use client";

import * as React from "react";

import type { CallStatus } from "./use-call";

// A self-contained call ringtone. The callee hears a two-tone ring (and the
// phone vibrates + shows a notification) while a call is incoming; the caller
// hears a softer ringback while waiting. Tones are synthesised with the Web
// Audio API, so there are no asset files and nothing to load over the network.

type WindowWithWebkitAudio = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/** Play a ring/ringback while `status` is incoming/outgoing; silent otherwise. */
export function useRingtone(
  status: CallStatus,
  peerName: string | null,
  video: boolean,
) {
  React.useEffect(() => {
    const ringing = status === "incoming";
    const ringback = status === "outgoing";
    if (!ringing && !ringback) return;

    const AudioCtx =
      window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    void ctx.resume().catch(() => {});
    let stopped = false;

    // One burst of the ring: two sine tones for the callee, one softer tone for
    // the caller's ringback.
    function burst() {
      if (stopped || ctx.state === "closed") return;
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      const freqs = ringing ? [440, 480] : [420];
      const dur = ringing ? 1.2 : 1.0;
      const vol = ringing ? 0.16 : 0.06;
      const oscillators = freqs.map((f) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = f;
        osc.connect(gain);
        return osc;
      });
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(vol, now + 0.05);
      gain.gain.setValueAtTime(vol, now + dur - 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      oscillators.forEach((osc) => {
        osc.start(now);
        osc.stop(now + dur);
      });
    }

    const period = ringing ? 3000 : 4000;
    burst();
    const ringTimer = window.setInterval(burst, period);

    // Callee: vibrate the phone and, if the tab is backgrounded and the user
    // has already granted permission, raise a notification too.
    let vibrateTimer: number | undefined;
    let notification: Notification | undefined;
    if (ringing) {
      const canVibrate = "vibrate" in navigator;
      if (canVibrate) {
        const pulse = () => navigator.vibrate?.([500, 300, 500]);
        pulse();
        vibrateTimer = window.setInterval(pulse, period);
      }
      try {
        if (
          "Notification" in window &&
          Notification.permission === "granted" &&
          document.visibilityState === "hidden"
        ) {
          notification = new Notification(
            `📞 ${peerName ?? "Someone"}`,
            {
              body: video ? "Incoming video call" : "Incoming call",
              tag: "gw-incoming-call",
              silent: false,
            },
          );
          notification.onclick = () => {
            window.focus();
            notification?.close();
          };
        }
      } catch {
        /* notifications unavailable — ringtone + vibration still cover it */
      }
    }

    return () => {
      stopped = true;
      clearInterval(ringTimer);
      if (vibrateTimer) clearInterval(vibrateTimer);
      if ("vibrate" in navigator) navigator.vibrate?.(0);
      notification?.close();
      void ctx.close().catch(() => {});
    };
  }, [status, peerName, video]);
}
