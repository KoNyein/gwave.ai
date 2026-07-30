"use client";

import * as React from "react";
import L from "leaflet";

export interface PlacePin {
  id: string;
  kind: "shop" | "farm" | "clinic";
  name: string;
  latitude: number;
  longitude: number;
  city: string | null;
}

const EMOJI: Record<PlacePin["kind"], string> = {
  shop: "🏪",
  farm: "🌱",
  clinic: "🏥",
};

/**
 * The community cannabis map. Client-only Leaflet (next/dynamic, ssr:false),
 * OSM tiles, emoji divIcons so no extra image host is needed in the CSP.
 * Clicking a pin selects the place; the parent shows its full detail card
 * rather than a cramped popup, because the whole point of this map is the
 * complete listing — photos, address, phone.
 *
 * `pickMode` turns the map into a coordinate picker for the add form: tapping
 * anywhere reports that point back, which is how a user pins a shop they are
 * standing in front of when GPS is off.
 */
export default function PlacesMapInner({
  pins,
  onSelect,
  pickMode = false,
  onPick,
  focus,
}: {
  pins: PlacePin[];
  onSelect: (id: string) => void;
  pickMode?: boolean;
  onPick?: (lat: number, lng: number) => void;
  focus?: { lat: number; lng: number } | null;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  // Handlers change every render; keeping them in refs means the map is built
  // once instead of being torn down and re-created on each parent update.
  const selectRef = React.useRef(onSelect);
  const pickRef = React.useRef(onPick);
  selectRef.current = onSelect;
  pickRef.current = onPick;
  const pickModeRef = React.useRef(pickMode);
  pickModeRef.current = pickMode;

  React.useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      attributionControl: false,
      zoomControl: true,
    }).setView([13.75, 100.5], 6); // Bangkok-ish default
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (pickModeRef.current) {
        pickRef.current?.(e.latlng.lat, e.latlng.lng);
      }
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Markers live in their own layer so re-rendering pins doesn't touch the map.
  const layerRef = React.useRef<L.LayerGroup | null>(null);
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layerRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    layerRef.current = layer;

    const coords: [number, number][] = [];
    for (const p of pins) {
      if (typeof p.latitude !== "number" || typeof p.longitude !== "number") {
        continue;
      }
      coords.push([p.latitude, p.longitude]);
      const icon = L.divIcon({
        className: "",
        html: `<div style="font-size:22px;line-height:22px;text-shadow:0 1px 2px rgba(0,0,0,.4)">${EMOJI[p.kind]}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([p.latitude, p.longitude], { icon, title: p.name })
        .addTo(layer)
        .on("click", () => selectRef.current(p.id));
    }
    if (coords.length === 1) {
      map.setView(coords[0]!, 15);
    } else if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords).pad(0.2));
    }
  }, [pins]);

  // A picked point gets its own marker so the user sees what they chose.
  const pickMarkerRef = React.useRef<L.Marker | null>(null);
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    pickMarkerRef.current?.remove();
    pickMarkerRef.current = null;
    if (!focus) return;
    const icon = L.divIcon({
      className: "",
      html:
        '<div style="width:16px;height:16px;border-radius:50%;background:#dc2626;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3)"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    pickMarkerRef.current = L.marker([focus.lat, focus.lng], { icon }).addTo(map);
    map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 15));
  }, [focus]);

  return (
    <div
      ref={ref}
      className={`h-full w-full ${pickMode ? "cursor-crosshair" : ""}`}
    />
  );
}
