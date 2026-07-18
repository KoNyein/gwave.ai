/**
 * Minimal EXIF date reader for JPEGs. Facebook photo exports keep the camera's
 * original capture time in EXIF even when the post JSON (with timestamps) is
 * absent, so this recovers the real date for a restored photo. Returns epoch
 * milliseconds, or null when there's no usable EXIF date.
 *
 * Only the two date tags are parsed (DateTimeOriginal 0x9003, DateTimeDigitized
 * 0x9004, falling back to DateTime 0x0132) — no dependency, no full EXIF parse.
 */
export function readExifDate(buf: ArrayBuffer): number | null {
  const view = new DataView(buf);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not JPEG

  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      // APP1 — check for "Exif\0\0"
      if (
        view.getUint32(offset + 4) === 0x45786966 &&
        view.getUint16(offset + 8) === 0x0000
      ) {
        return parseExif(view, offset + 10);
      }
    }
    // Stop at Start-of-Scan; no metadata past it.
    if (marker === 0xda) break;
    offset += 2 + size;
  }
  return null;
}

function parseExif(view: DataView, tiff: number): number | null {
  const le = view.getUint16(tiff) === 0x4949; // II = little-endian
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);

  const ifd0 = tiff + u32(tiff + 4);
  const best = { date: null as string | null, rank: 99 };

  const scan = (dirStart: number) => {
    if (dirStart + 2 > view.byteLength) return;
    const count = u16(dirStart);
    for (let i = 0; i < count; i++) {
      const entry = dirStart + 2 + i * 12;
      if (entry + 12 > view.byteLength) break;
      const tag = u16(entry);
      // 0x8769 = Exif sub-IFD pointer; recurse into it for the capture tags.
      if (tag === 0x8769) {
        scan(tiff + u32(entry + 8));
        continue;
      }
      const rank =
        tag === 0x9003 ? 0 : tag === 0x9004 ? 1 : tag === 0x0132 ? 2 : 99;
      if (rank === 99 || rank >= best.rank) continue;
      const valOffset = tiff + u32(entry + 8); // ASCII "YYYY:MM:DD HH:MM:SS"
      let s = "";
      for (let j = 0; j < 19 && valOffset + j < view.byteLength; j++) {
        s += String.fromCharCode(view.getUint8(valOffset + j));
      }
      if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
        best.date = s;
        best.rank = rank;
      }
    }
  };
  scan(ifd0);

  if (!best.date) return null;
  // "YYYY:MM:DD HH:MM:SS" → treat as local time.
  const [d, t] = best.date.split(" ");
  const [y, mo, da] = d!.split(":").map(Number);
  const [h, mi, se] = t!.split(":").map(Number);
  const ms = new Date(y!, mo! - 1, da!, h!, mi!, se!).getTime();
  return Number.isFinite(ms) ? ms : null;
}
