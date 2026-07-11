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
      if (raw != null) setState(JSON.parse(raw) as T);
    } catch {
      // Ignore malformed/blocked storage — fall back to `initial`.
    }
    loaded.current = true;
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
