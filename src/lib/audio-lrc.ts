/**
 * Parse a lyrics document. LRC format uses `[mm:ss.xx]` timestamps per line for
 * a karaoke-style highlight; plain text has none. Returns time-tagged lines
 * (t = seconds, or null when the doc isn't synced).
 */
export interface LyricLine {
  t: number | null;
  text: string;
}

const LRC_RE = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

export function parseLyrics(raw: string): { synced: boolean; lines: LyricLine[] } {
  const rawLines = raw.replace(/\r/g, "").split("\n");
  const out: LyricLine[] = [];
  let synced = false;

  for (const line of rawLines) {
    LRC_RE.lastIndex = 0;
    const stamps: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = LRC_RE.exec(line)) !== null) {
      const min = Number(m[1]);
      const sec = Number(m[2]);
      const frac = m[3] ? Number(`0.${m[3]}`) : 0;
      stamps.push(min * 60 + sec + frac);
    }
    const text = line.replace(LRC_RE, "").trim();
    if (stamps.length > 0) {
      synced = true;
      for (const t of stamps) out.push({ t, text });
    } else if (text.length > 0) {
      out.push({ t: null, text });
    }
  }

  if (synced) out.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  return { synced, lines: out };
}

/** Index of the active line for a given playback time (or -1). */
export function activeLineIndex(lines: LyricLine[], time: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]?.t;
    if (t != null && t <= time) idx = i;
    else if (t != null && t > time) break;
  }
  return idx;
}
