// ကျားထိုး (Myanmar tigers-and-cattle, Alquerque/Bagh-Chal family) — pure
// game rules shared by the messenger board component and tests. 4 tigers
// start on the corners of a 5×5 point grid; the cattle side places 20
// pieces one per turn, then moves. Tigers capture by jumping over an
// adjacent cow onto the empty point beyond; tigers win at 5 captures,
// cattle win by blocking every tiger.

export type KyarPiece = "T" | "G" | null;

export const KYAR_N = 5;
export const GOATS_TOTAL = 20;
export const CAPTURES_TO_WIN = 5;

const N = KYAR_N;

export const kyarIdx = (r: number, c: number): number => r * N + c;
const inBounds = (r: number, c: number) => r >= 0 && r < N && c >= 0 && c < N;

const ORTHO = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
const DIAG = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

/** Directions available from a point — diagonals only on even-parity points. */
function dirsOf(i: number): ReadonlyArray<readonly [number, number]> {
  const r = Math.floor(i / N);
  const c = i % N;
  return (r + c) % 2 === 0 ? [...ORTHO, ...DIAG] : [...ORTHO];
}

export interface KyarMove {
  to: number;
  jumped: number | null;
}

/** Legal moves for the piece standing on point i. */
export function kyarMovesFrom(cells: KyarPiece[], i: number): KyarMove[] {
  const piece = cells[i];
  if (!piece) return [];
  const r = Math.floor(i / N);
  const c = i % N;
  const out: KyarMove[] = [];
  for (const [dr, dc] of dirsOf(i)) {
    const r1 = r + dr;
    const c1 = c + dc;
    if (!inBounds(r1, c1)) continue;
    const step = kyarIdx(r1, c1);
    if (cells[step] === null) {
      out.push({ to: step, jumped: null });
    } else if (piece === "T" && cells[step] === "G") {
      const r2 = r + 2 * dr;
      const c2 = c + 2 * dc;
      if (inBounds(r2, c2) && cells[kyarIdx(r2, c2)] === null) {
        out.push({ to: kyarIdx(r2, c2), jumped: step });
      }
    }
  }
  return out;
}

export function kyarSideHasMove(cells: KyarPiece[], side: "T" | "G"): boolean {
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === side && kyarMovesFrom(cells, i).length > 0) return true;
  }
  return false;
}

export interface KyarState {
  cells: KyarPiece[];
  turn: "T" | "G";
  goatsLeft: number;
  captured: number;
  tiger: string | null; // user id playing the tigers
}

export function kyarFresh(tiger: string | null): KyarState {
  const cells = Array<KyarPiece>(N * N).fill(null);
  cells[kyarIdx(0, 0)] = "T";
  cells[kyarIdx(0, N - 1)] = "T";
  cells[kyarIdx(N - 1, 0)] = "T";
  cells[kyarIdx(N - 1, N - 1)] = "T";
  return { cells, turn: "G", goatsLeft: GOATS_TOTAL, captured: 0, tiger };
}

export function kyarWinnerOf(s: KyarState): "T" | "G" | null {
  if (s.captured >= CAPTURES_TO_WIN) return "T";
  if (s.turn === "T" && !kyarSideHasMove(s.cells, "T")) return "G";
  if (s.turn === "G" && s.goatsLeft === 0 && !kyarSideHasMove(s.cells, "G"))
    return "T";
  return null;
}

/** All point-to-point board segments, for drawing the lines once. */
export const KYAR_SEGMENTS: Array<[number, number]> = (() => {
  const segs: Array<[number, number]> = [];
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N);
    const c = i % N;
    for (const [dr, dc] of dirsOf(i)) {
      if (!inBounds(r + dr, c + dc)) continue;
      const j = kyarIdx(r + dr, c + dc);
      if (j > i) segs.push([i, j]);
    }
  }
  return segs;
})();
