"use client";

import * as React from "react";
import L from "leaflet";

import type { GeoFix, MapPerson } from "@/lib/geolocation";

/**
 * Interactive GPS map (client-only, OSM tiles). Shows a live "you are here"
 * marker with an accuracy circle, plus a marker per shared family member. When
 * `recenter` increments, the view snaps back to the current fix — used by the
 * "locate me" button and live-follow.
 */
export default function GpsMapInner({
  fix,
  recenter,
  people = [],
}: {
  fix: GeoFix | null;
  recenter: number;
  people?: MapPerson[];
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markerRef = React.useRef<L.Marker | null>(null);
  const circleRef = React.useRef<L.Circle | null>(null);
  const peopleRef = React.useRef<Map<string, L.Marker>>(new Map());
  const centredRef = React.useRef(false);

  // Create the map once.
  React.useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { attributionControl: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    map.setView([19.75, 96.1], 5); // Myanmar until we get a fix.
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update marker + accuracy circle whenever the fix changes.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !fix) return;
    const point: [number, number] = [fix.latitude, fix.longitude];

    if (!markerRef.current) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="font-size:30px;line-height:1">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });
      markerRef.current = L.marker(point, { icon }).addTo(map);
    } else {
      markerRef.current.setLatLng(point);
    }

    const radius = fix.accuracy ?? 0;
    if (radius > 0) {
      if (!circleRef.current) {
        circleRef.current = L.circle(point, {
          radius,
          color: "#2563eb",
          weight: 1,
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
        }).addTo(map);
      } else {
        circleRef.current.setLatLng(point);
        circleRef.current.setRadius(radius);
      }
    }

    if (!centredRef.current) {
      centredRef.current = true;
      map.setView(point, 16);
    }
  }, [fix]);

  // Explicit recenter (locate button / follow).
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !fix || recenter === 0) return;
    map.setView([fix.latitude, fix.longitude], Math.max(map.getZoom(), 16));
  }, [recenter, fix]);

  // Family member markers: add/move present ones, drop the rest.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const p of people) {
      seen.add(p.id);
      const point: [number, number] = [p.latitude, p.longitude];
      const existing = peopleRef.current.get(p.id);
      if (existing) {
        existing.setLatLng(point);
      } else {
        const icon = L.divIcon({
          className: "",
          html: `<div style="font-size:26px;line-height:1">🧑</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        });
        const marker = L.marker(point, { icon })
          .addTo(map)
          .bindTooltip(p.name, { direction: "top", offset: [0, -24] });
        peopleRef.current.set(p.id, marker);
      }
    }
    for (const [id, marker] of peopleRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        peopleRef.current.delete(id);
      }
    }
  }, [people]);

  return <div ref={ref} className="h-full w-full" />;
}
