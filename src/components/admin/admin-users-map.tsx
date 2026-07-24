"use client";

import dynamic from "next/dynamic";

import "leaflet/dist/leaflet.css";
import type { AdminMapMarker } from "./admin-users-map-inner";

// Leaflet touches `window`, so the map is client-only and lazily loaded.
const MapInner = dynamic(() => import("./admin-users-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
      Loading map…
    </div>
  ),
});

/** Admin map of users who share their location. */
export function AdminUsersMap({
  markers,
  className,
}: {
  markers: AdminMapMarker[];
  className?: string;
}) {
  return (
    <div
      className={
        className ?? "h-[70vh] w-full overflow-hidden rounded-xl border"
      }
    >
      <MapInner markers={markers} />
    </div>
  );
}
