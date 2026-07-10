"use client";

import dynamic from "next/dynamic";

import "leaflet/dist/leaflet.css";
import type { MapMarker } from "./family-map-inner";

// Leaflet touches `window`, so the map is client-only and lazily loaded.
const MapInner = dynamic(() => import("./family-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
      …
    </div>
  ),
});

/** Family locator map: OSM tiles with one marker per sharing member. */
export function FamilyMap({
  markers,
  className,
}: {
  markers: MapMarker[];
  className?: string;
}) {
  return (
    <div className={className ?? "h-72 w-full overflow-hidden rounded-xl border"}>
      <MapInner markers={markers} />
    </div>
  );
}
