"use client";

import * as React from "react";
import L from "leaflet";

import { metalStyle } from "./mine-data";

export interface MinePin {
  id: string;
  metal: string;
  name: string;
  latitude: number;
  longitude: number;
  township: string;
}

/**
 * The community mine-site map. Client-only Leaflet (next/dynamic, ssr:false),
 * OSM tiles, coloured divIcons so no extra image host is needed in the CSP.
 * Each pin is tinted by mineral, which is what makes a region readable at a
 * glance: a wall of green in Hpakant is jade, a scatter of grey in Tanintharyi
 * is tin.
 *
 * Clicking a pin selects the site; the parent shows the full detail card rather
 * than a cramped popup, because the point of the map is the complete listing —
 * photos, township, access notes.
 *
 * `pickMode` turns the map into a coordinate picker for the add form: tapping
 * anywhere reports that point back, which is how a user pins a site they are
 * standing at when GPS is off.
 */
export default function MineMapInner({
  pins,
  onSelect,
  pickMode = false,
  onPick,
  focus,
}: {
  pins: MinePin[];
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
    // Centred on Myanmar at country zoom — the map's whole subject.
    const map = L.map(ref.current, {
      attributionControl: false,
      zoomControl: true,
    }).setView([21.0, 96.5], 5);
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
      const style = metalStyle(p.metal);
      const icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:${style.color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"><span style="transform:rotate(45deg);font-size:13px;line-height:1">${style.emoji}</span></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      L.marker([p.latitude, p.longitude], { icon, title: p.name })
        .addTo(layer)
        .on("click", () => selectRef.current(p.id));
    }
    if (coords.length === 1) {
      map.setView(coords[0]!, 13);
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
    pickMarkerRef.current = L.marker([focus.lat, focus.lng], { icon }).addTo(
      map,
    );
    map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 14));
  }, [focus]);

  return (
    <div
      ref={ref}
      className={`h-full w-full ${pickMode ? "cursor-crosshair" : ""}`}
    />
  );
}
