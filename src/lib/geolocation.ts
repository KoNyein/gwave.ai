export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

/**
 * Continuously watch the device's position (live GPS). Calls `onFix` on every
 * update and `onError` on failure. Returns a stop function; call it to clear
 * the watch.
 */
export function watchPosition(
  onFix: (fix: GeoFix) => void,
  onError?: (message: string) => void,
): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    onError?.("Location is not available in this browser.");
    return () => undefined;
  }
  const id = navigator.geolocation.watchPosition(
    (position) =>
      onFix({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
      }),
    (error) =>
      onError?.(
        error.code === error.PERMISSION_DENIED
          ? "Location permission was denied."
          : "Couldn't get your location.",
      ),
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/** Browser geolocation as a promise, with friendly errors. */
export function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number | null;
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
        }),
      (error) => {
        reject(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location permission was denied."
              : "Couldn't get your location.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
