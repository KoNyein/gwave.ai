// A compact but correct chess engine: legal move generation with self-check
// prevention, pawn promotion (auto-queen) and check / checkmate / stalemate
// detection. No side effects. Castling and en passant are intentionally left
// out of this first version to keep the rules bullet-proof.

export type Color = "w" | "b";
export type PieceType = "P" | "N" | "B" | "R" | "Q" | "K";
/** e.g. "wP", "bK", or null for an empty square. */
export type Piece = `${Color}${PieceType}` | null;
export type Board = Piece[][]; // board[row][col], row 0 = rank 8 (black home).
export interface Sq {
  r: number;
  c: number;
}

export function initialBoard(): Board {
  const empty = (): Piece[] => Array<Piece>(8).fill(null);
  const back = (color: Color): Piece[] =>
    ["R", "N", "B", "Q", "K", "B", "N", "R"].map(
      (t) => `${color}${t}` as Piece,
    );
  const pawns = (color: Color): Piece[] =>
    Array<Piece>(8).fill(`${color}P` as Piece);
  return [
    back("b"),
    pawns("b"),
    empty(),
    empty(),
    empty(),
    empty(),
    pawns("w"),
    back("w"),
  ];
}

export function colorOf(p: Piece): Color | null {
  return p ? (p[0] as Color) : null;
}
export function typeOf(p: Piece): PieceType | null {
  return p ? (p[1] as PieceType) : null;
}
const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

const KNIGHT = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const KING = [...DIAG, ...ORTH];

/** Is square (r,c) attacked by any piece of `by`? */
export function isAttacked(board: Board, r: number, c: number, by: Color): boolean {
  // Pawns: a `by`-pawn attacking (r,c) sits one rank "behind" it.
  const dir = by === "w" ? 1 : -1; // white pawns sit below (higher row).
  for (const dc of [-1, 1]) {
    const pr = r + dir;
    const pc = c + dc;
    if (inBounds(pr, pc) && board[pr]![pc] === `${by}P`) return true;
  }
  // Knights.
  for (const [dr, dc] of KNIGHT) {
    const nr = r + dr!;
    const nc = c + dc!;
    if (inBounds(nr, nc) && board[nr]![nc] === `${by}N`) return true;
  }
  // King.
  for (const [dr, dc] of KING) {
    const nr = r + dr!;
    const nc = c + dc!;
    if (inBounds(nr, nc) && board[nr]![nc] === `${by}K`) return true;
  }
  // Sliding: bishop/queen on diagonals, rook/queen on orthogonals.
  const sliders: { rays: number[][]; kinds: PieceType[] }[] = [
    { rays: DIAG, kinds: ["B", "Q"] },
    { rays: ORTH, kinds: ["R", "Q"] },
  ];
  for (const { rays, kinds } of sliders) {
    for (const [dr, dc] of rays) {
      let nr = r + dr!;
      let nc = c + dc!;
      while (inBounds(nr, nc)) {
        const p = board[nr]?.[nc] ?? null;
        if (p) {
          const t = typeOf(p);
          if (colorOf(p) === by && t !== null && kinds.includes(t)) return true;
          break;
        }
        nr += dr!;
        nc += dc!;
      }
    }
  }
  return false;
}

export function kingSquare(board: Board, color: Color): Sq | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r]![c] === `${color}K`) return { r, c };
  return null;
}

export function inCheck(board: Board, color: Color): boolean {
  const k = kingSquare(board, color);
  if (!k) return false;
  return isAttacked(board, k.r, k.c, color === "w" ? "b" : "w");
}

/** Pseudo-legal destinations for the piece at (r,c) (ignores self-check). */
function pseudoMoves(board: Board, r: number, c: number): Sq[] {
  const p = board[r]![c];
  if (!p) return [];
  const color = colorOf(p)!;
  const type = typeOf(p)!;
  const out: Sq[] = [];
  const push = (nr: number, nc: number) => {
    if (!inBounds(nr, nc)) return false;
    const t = board[nr]![nc];
    if (!t) {
      out.push({ r: nr, c: nc });
      return true; // empty — sliders continue
    }
    if (colorOf(t) !== color) out.push({ r: nr, c: nc });
    return false; // blocked
  };

  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const start = color === "w" ? 6 : 1;
    if (inBounds(r + dir, c) && !board[r + dir]![c]) {
      out.push({ r: r + dir, c });
      if (r === start && !board[r + 2 * dir]![c]) {
        out.push({ r: r + 2 * dir, c });
      }
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir;
      const nc = c + dc;
      if (inBounds(nr, nc)) {
        const t = board[nr]![nc];
        if (t && colorOf(t) !== color) out.push({ r: nr, c: nc });
      }
    }
  } else if (type === "N") {
    for (const [dr, dc] of KNIGHT) push(r + dr!, c + dc!);
  } else if (type === "K") {
    for (const [dr, dc] of KING) push(r + dr!, c + dc!);
  } else {
    const rays = type === "B" ? DIAG : type === "R" ? ORTH : KING;
    for (const [dr, dc] of rays) {
      let nr = r + dr!;
      let nc = c + dc!;
      while (push(nr, nc)) {
        nr += dr!;
        nc += dc!;
      }
    }
  }
  return out;
}

/** Apply a move on a copy, auto-promoting a pawn that reaches the last rank. */
export function applyMove(board: Board, from: Sq, to: Sq): Board {
  const next = board.map((row) => row.slice());
  let piece: Piece = next[from.r]?.[from.c] ?? null;
  if (piece && typeOf(piece) === "P" && (to.r === 0 || to.r === 7)) {
    piece = `${colorOf(piece)}Q` as Piece;
  }
  next[to.r]![to.c] = piece;
  next[from.r]![from.c] = null;
  return next;
}

/** Fully-legal destinations from (r,c) for `turn` (won't leave own king in check). */
export function legalMoves(board: Board, from: Sq, turn: Color): Sq[] {
  const p = board[from.r]?.[from.c] ?? null;
  if (!p || colorOf(p) !== turn) return [];
  return pseudoMoves(board, from.r, from.c).filter((to) => {
    const after = applyMove(board, from, to);
    return !inCheck(after, turn);
  });
}

export function hasAnyLegalMove(board: Board, turn: Color): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (colorOf(board[r]?.[c] ?? null) === turn && legalMoves(board, { r, c }, turn).length)
        return true;
  return false;
}

export type GameStatus = "playing" | "check" | "checkmate" | "stalemate";

export function statusOf(board: Board, turn: Color): GameStatus {
  const any = hasAnyLegalMove(board, turn);
  const check = inCheck(board, turn);
  if (!any) return check ? "checkmate" : "stalemate";
  return check ? "check" : "playing";
}

/** Unicode glyph for a piece. */
export function glyph(p: Piece): string {
  if (!p) return "";
  const map: Record<string, string> = {
    wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
    bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟",
  };
  return map[p] ?? "";
}
