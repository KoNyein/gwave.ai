/** Browser geolocation as a promise, with friendly errors. */
export function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
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
