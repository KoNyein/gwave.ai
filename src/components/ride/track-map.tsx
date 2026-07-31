"use client";

import * as React from "react";
import L from "leaflet";

/**
 * The follower's map: where the car is, where it started, where it is going.
 *
 * Client-only Leaflet (next/dynamic, ssr:false) with OSM tiles and divIcons, so
 * no extra image host is needed in the CSP — the same approach as the mine map.
 *
 * The car marker moves in place rather than being torn down and re-added on
 * each update: recreating it makes the icon blink every few seconds, which on a
 * page someone is watching because they are worried reads as the connection
 * dropping.
 */
export default function TrackMap({
  pickup,
  dropoff,
  car,
}: {
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  car: { lat: number; lng: number } | null;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const carRef = React.useRef<L.Marker | null>(null);
  const fittedRef = React.useRef(false);

  React.useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      attributionControl: false,
      zoomControl: true,
    }).setView([pickup.lat, pickup.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    const dot = (color: string) =>
      L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

    L.marker([pickup.lat, pickup.lng], { icon: dot("#7AC943") }).addTo(map);
    L.marker([dropoff.lat, dropoff.lng], { icon: dot("#E23B3B") }).addTo(map);
    L.polyline(
      [
        [pickup.lat, pickup.lng],
        [dropoff.lat, dropoff.lng],
      ],
      { color: "#3B6D11", weight: 3, opacity: 0.4, dashArray: "6 8" },
    ).addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      carRef.current = null;
    };
  }, [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!car) {
      carRef.current?.remove();
      carRef.current = null;
      return;
    }

    if (carRef.current) {
      carRef.current.setLatLng([car.lat, car.lng]);
    } else {
      carRef.current = L.marker([car.lat, car.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#3B6D11;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.45);font-size:15px">🚗</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        zIndexOffset: 500,
      }).addTo(map);
    }

    // Fit once, then leave the view alone. Re-fitting on every position update
    // fights the follower whenever they pan or zoom to look at something.
    if (!fittedRef.current) {
      fittedRef.current = true;
      map.fitBounds(
        L.latLngBounds([
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
          [car.lat, car.lng],
        ]).pad(0.25),
      );
    }
  }, [car, pickup.lat, pickup.lng, dropoff.lat, dropoff.lng]);

  return <div ref={ref} className="h-full w-full" />;
}
