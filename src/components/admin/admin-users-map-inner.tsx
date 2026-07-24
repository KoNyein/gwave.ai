"use client";

import * as React from "react";
import L from "leaflet";

export interface AdminMapMarker {
  latitude: number;
  longitude: number;
  name: string;
  username: string | null;
  role: string;
  updatedAt: string;
}

/**
 * Admin "users on a map" view. Client-only Leaflet (loaded via next/dynamic,
 * ssr:false). Uses OSM tiles and emoji divIcons so it needs no extra image
 * hosts in the CSP. Marker colour hints how recently the user was seen.
 */
export default function AdminUsersMapInner({
  markers,
}: {
  markers: AdminMapMarker[];
}) {
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

    const now = Date.now();
    if (markers.length === 0) {
      map.setView([20, 96], 4);
    } else {
      const points: [number, number][] = [];
      for (const m of markers) {
        if (
          typeof m.latitude !== "number" ||
          typeof m.longitude !== "number"
        )
          continue;
        points.push([m.latitude, m.longitude]);
        const ageMin = (now - new Date(m.updatedAt).getTime()) / 60000;
        // Fresh (<15m) green, recent (<24h) amber, else grey.
        const dot =
          ageMin < 15 ? "#22c55e" : ageMin < 60 * 24 ? "#f0b429" : "#94a3b8";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;border-radius:50%;background:${dot};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        const when = new Date(m.updatedAt).toLocaleString();
        L.marker([m.latitude, m.longitude], { icon })
          .addTo(map)
          .bindPopup(
            `<b>${escapeHtml(m.name)}</b>${
              m.username ? ` <span style="color:#666">@${escapeHtml(m.username)}</span>` : ""
            }<br/>${escapeHtml(m.role)}<br/><span style="color:#666">${escapeHtml(when)}</span>`,
          );
      }
      if (points.length === 1) {
        map.setView(points[0]!, 13);
      } else if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points).pad(0.2));
      } else {
        map.setView([20, 96], 4);
      }
    }

    return () => {
      map.remove();
    };
  }, [markers]);

  return <div ref={ref} className="h-full w-full" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
