import type HlsType from "hls.js";
import Hls from "hls.js";

/**
 * One tuned home for every hls.js player on the web app. Before this, each card
 * spun up `new Hls({ capLevelToPlayerSize: true })` with no error handling, so a
 * single network/media hiccup froze the video and the card looked broken. These
 * helpers add automatic recovery + sensible buffering so playback is smooth and
 * self-heals, and split two quality profiles:
 *
 *  - preview  — muted feed/rail cards: bandwidth-friendly (caps to the small
 *               player size) but still auto-recovers so it never stalls dead.
 *  - full     — the watch page: uncapped ABR that climbs to the sharpest level
 *               the connection allows, larger buffer, low-latency while live.
 */

type Attach = { destroy: () => void };

function wireRecovery(hls: HlsType): void {
  let mediaRecoveries = 0;
  hls.on(Hls.Events.ERROR, (_evt, data) => {
    if (!data.fatal) return;
    switch (data.type) {
      case Hls.ErrorTypes.NETWORK_ERROR:
        // Transient network drop (segment 404, timeout) — reconnect instead of
        // freezing on the last frame.
        hls.startLoad();
        break;
      case Hls.ErrorTypes.MEDIA_ERROR:
        // Buffer-append / decode glitch — recover once, then rebuild the buffer
        // if it happens again, before giving up.
        if (mediaRecoveries < 2) {
          mediaRecoveries += 1;
          hls.recoverMediaError();
        } else {
          hls.swapAudioCodec();
          hls.recoverMediaError();
        }
        break;
      default:
        hls.destroy();
    }
  });
}

/** Muted preview cards (feed live card, live rail, live grid). */
export function attachPreviewHls(video: HTMLVideoElement, src: string): Attach {
  // Safari / iOS decode m3u8 natively — no worker, best battery.
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = src;
    void video.play().catch(() => undefined);
    return {
      destroy: () => {
        video.removeAttribute("src");
        video.load();
      },
    };
  }
  if (!Hls.isSupported()) return { destroy: () => undefined };

  const hls = new Hls({
    enableWorker: true, // parse off the main thread → no scroll jank
    capLevelToPlayerSize: true, // small card ⇒ small rendition ⇒ light data
    maxBufferLength: 12,
    backBufferLength: 8,
    liveSyncDurationCount: 3,
  });
  wireRecovery(hls);
  hls.loadSource(src);
  hls.attachMedia(video);
  void video.play().catch(() => undefined);
  return { destroy: () => hls.destroy() };
}

/** Full-screen watch player: sharpest quality the link can carry. */
export function attachFullHls(
  video: HTMLVideoElement,
  src: string,
  opts: { live?: boolean } = {},
): Attach {
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = src;
    void video.play().catch(() => undefined);
    return {
      destroy: () => {
        video.removeAttribute("src");
        video.load();
      },
    };
  }
  if (!Hls.isSupported()) return { destroy: () => undefined };

  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: Boolean(opts.live),
    capLevelToPlayerSize: false, // let ABR reach the top rendition
    startLevel: -1, // auto-pick, then climb
    maxBufferLength: 30,
    backBufferLength: 30,
    // Climb to higher renditions promptly, hold them a touch conservatively so
    // we don't yo-yo the resolution.
    abrEwmaDefaultEstimate: 1_000_000,
    abrBandWidthFactor: 0.95,
    abrBandWidthUpFactor: 0.75,
  });
  wireRecovery(hls);
  hls.loadSource(src);
  hls.attachMedia(video);
  void video.play().catch(() => undefined);
  return { destroy: () => hls.destroy() };
}
