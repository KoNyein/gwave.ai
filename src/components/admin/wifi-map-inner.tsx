"use client";

import * as React from "react";
import L from "leaflet";

export interface WifiMapPoint {
  latitude: number;
  longitude: number;
  ssid: string | null;
  bssid: string;
  security: string | null;
  bestSignal: number | null;
  observations: number;
}

/**
 * Coverage map of every access point users have contributed. Client-only
 * Leaflet (next/dynamic, ssr:false), OSM tiles, divIcon dots so no extra
 * image host is needed in the CSP. Dot colour = signal strength; open
 * networks get a red ring, because "which of these is unsecured" is the
 * question an admin actually asks of this data.
 */
export default function WifiMapInner({ points }: { points: WifiMapPoint[] }) {
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

    const coords: [number, number][] = [];
    for (const p of points) {
      if (typeof p.latitude !== "number" || typeof p.longitude !== "number") {
        continue;
      }
      coords.push([p.latitude, p.longitude]);
      const rssi = p.bestSignal ?? -99;
      const colour =
        rssi >= -55 ? "#22c55e" : rssi >= -70 ? "#84cc16" : rssi >= -85 ? "#f0b429" : "#94a3b8";
      const open = (p.security ?? "").toUpperCase() === "OPEN";
      const size = Math.min(8 + p.observations, 18);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${colour};border:2px solid ${
          open ? "#dc2626" : "#fff"
        };box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      L.marker([p.latitude, p.longitude], { icon })
        .addTo(map)
        .bindPopup(
          `<b>${escapeHtml(p.ssid || "(hidden)")}</b><br/>` +
            `<span style="color:#666">${escapeHtml(p.bssid)}</span><br/>` +
            `${escapeHtml(p.security || "?")}${open ? " ⚠" : ""} · ${
              p.bestSignal ?? "?"
            } dBm · ${p.observations} scans`,
        );
    }

    if (coords.length === 1) {
      map.setView(coords[0]!, 15);
    } else if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords).pad(0.2));
    } else {
      map.setView([20, 96], 4);
    }

    return () => {
      map.remove();
    };
  }, [points]);

  return <div ref={ref} className="h-full w-full" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
