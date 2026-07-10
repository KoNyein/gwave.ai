"use client";

import * as React from "react";
import L from "leaflet";

export interface MapMarker {
  latitude: number;
  longitude: number;
  label: string;
  isMe: boolean;
}

/**
 * Multi-marker Leaflet map for the family locator. Client-only (loaded via
 * next/dynamic, ssr:false). Uses OSM tiles and emoji divIcons so it needs no
 * extra image hosts in the CSP.
 */
export default function FamilyMapInner({ markers }: { markers: MapMarker[] }) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, {
      attributionControl: false,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    if (markers.length === 0) {
      map.setView([20, 96], 4);
    } else {
      const points: [number, number][] = markers.map((m) => [
        m.latitude,
        m.longitude,
      ]);
      for (const m of markers) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="font-size:26px;line-height:1">${m.isMe ? "📍" : "🧑"}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });
        L.marker([m.latitude, m.longitude], { icon })
          .addTo(map)
          .bindTooltip(m.label, { direction: "top", offset: [0, -24] });
      }
      if (points.length === 1) {
        map.setView(points[0]!, 15);
      } else {
        map.fitBounds(L.latLngBounds(points).pad(0.2));
      }
    }

    return () => {
      map.remove();
    };
  }, [markers]);

  return <div ref={ref} className="h-full w-full" />;
}
