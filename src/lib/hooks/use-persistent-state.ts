"use client";

import * as React from "react";

/**
 * useState that remembers its value in localStorage, so a tool's inputs are
 * still there when the user comes back. The first render always uses `initial`
 * (matching the server) and the stored value is applied right after mount, so
 * there's no hydration mismatch.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<T>(initial);
  const loaded = React.useRef(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        const parsed = JSON.parse(raw) as unknown;
        // JSON.parse succeeds on "null" and on the wrong shape entirely, and a
        // value of the wrong type then blows up wherever it's used (`.map` of
        // null took the whole app shell down). Only accept something that looks
        // like what the caller asked for.
        const sameShape =
          parsed !== null &&
          typeof parsed === typeof initial &&
          Array.isArray(parsed) === Array.isArray(initial);
        if (sameShape) setState(parsed as T);
      }
    } catch {
      // Ignore malformed/blocked storage — fall back to `initial`.
    }
    loaded.current = true;
    // `initial` is only read for its shape; re-running on a new object identity
    // would clobber state the user has already changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  React.useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Storage may be unavailable (private mode / quota) — non-fatal.
    }
  }, [key, state]);

  return [state, setState];
}
