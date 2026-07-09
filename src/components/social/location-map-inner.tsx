"use client";

import * as React from "react";
import L from "leaflet";

/**
 * The actual Leaflet map, mounted only on the client (loaded via next/dynamic
 * with ssr:false). Kept dependency-light: a single OSM tile layer and one
 * marker, no react-leaflet wrapper.
 */
export default function LocationMapInner({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, {
      center: [latitude, longitude],
      zoom: 15,
      attributionControl: false,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    // Marker icon via a divIcon so we don't depend on Leaflet's image assets
    // (which would need extra CSP/host config).
    const icon = L.divIcon({
      className: "",
      html: '<div style="font-size:28px;line-height:1">📍</div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });
    L.marker([latitude, longitude], { icon }).addTo(map);

    return () => {
      map.remove();
    };
  }, [latitude, longitude]);

  return <div ref={ref} className="h-full w-full" />;
}
