"use client";

import * as React from "react";
import dynamic from "next/dynamic";

import "leaflet/dist/leaflet.css";

// Leaflet touches `window` on import, so the whole map is client-only and
// loaded lazily — it never ships in the server bundle. OSM raster tiles are
// allowed through the CSP img-src (see next.config.mjs).
const MapInner = dynamic(() => import("./location-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
      …
    </div>
  ),
});

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Read-only mini map centered on a point. */
export function LocationMap({
  latitude,
  longitude,
  className,
}: LatLng & { className?: string }) {
  return (
    <div className={className ?? "h-48 w-full overflow-hidden rounded-lg"}>
      <MapInner latitude={latitude} longitude={longitude} />
    </div>
  );
}
