"use client";

import * as React from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

import type { GeoFix, MapPerson } from "@/lib/geolocation";

/**
 * Interactive Google Maps GPS view (client-only). Mirrors the OSM/Leaflet
 * inner: a live "you are here" marker with an accuracy circle, re-centering
 * when `recenter` increments (locate button / live-follow). Satellite +
 * zoom controls come from Google. Loaded only when a Maps key is configured.
 */
export default function GpsMapGoogleInner({
  fix,
  recenter,
  apiKey,
  people = [],
}: {
  fix: GeoFix | null;
  recenter: number;
  apiKey: string;
  people?: MapPerson[];
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<google.maps.Map | null>(null);
  const markerRef = React.useRef<google.maps.Marker | null>(null);
  const circleRef = React.useRef<google.maps.Circle | null>(null);
  const peopleRef = React.useRef<Map<string, google.maps.Marker>>(new Map());
  const [failed, setFailed] = React.useState(false);

  // Create the map once.
  React.useEffect(() => {
    let cancelled = false;
    setOptions({ key: apiKey, v: "weekly" });
    importLibrary("maps")
      .then(({ Map }) => {
        if (cancelled || !ref.current || mapRef.current) return;
        mapRef.current = new Map(ref.current, {
          center: { lat: 19.75, lng: 96.1 }, // Myanmar until a fix arrives.
          zoom: 5,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Update marker + accuracy circle whenever the fix changes.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !fix || typeof google === "undefined") return;
    const point = { lat: fix.latitude, lng: fix.longitude };

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({ map, position: point });
    } else {
      markerRef.current.setPosition(point);
    }

    const radius = fix.accuracy ?? 0;
    if (radius > 0) {
      if (!circleRef.current) {
        circleRef.current = new google.maps.Circle({
          map,
          center: point,
          radius,
          strokeColor: "#3b6d11",
          strokeOpacity: 0.6,
          strokeWeight: 1,
          fillColor: "#3b6d11",
          fillOpacity: 0.12,
        });
      } else {
        circleRef.current.setCenter(point);
        circleRef.current.setRadius(radius);
      }
    }
  }, [fix]);

  // Snap back to the fix on locate / live-follow.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !fix) return;
    map.panTo({ lat: fix.latitude, lng: fix.longitude });
    if ((map.getZoom() ?? 0) < 15) map.setZoom(16);
  }, [recenter, fix]);

  // Family member markers.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof google === "undefined") return;
    const seen = new Set<string>();
    for (const p of people) {
      seen.add(p.id);
      const position = { lat: p.latitude, lng: p.longitude };
      const existing = peopleRef.current.get(p.id);
      if (existing) {
        existing.setPosition(position);
      } else {
        peopleRef.current.set(
          p.id,
          new google.maps.Marker({
            map,
            position,
            title: p.name,
            label: {
              text: p.kind === "sos" ? "🆘" : "🧑",
              fontSize: p.kind === "sos" ? "22px" : "18px",
            },
            zIndex: p.kind === "sos" ? 1000 : undefined,
          }),
        );
      }
    }
    for (const [id, marker] of peopleRef.current) {
      if (!seen.has(id)) {
        marker.setMap(null);
        peopleRef.current.delete(id);
      }
    }
  }, [people]);

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
        Google Map ဖွင့်၍ မရပါ — key ကို စစ်ပါ။
      </div>
    );
  }
  return <div ref={ref} className="h-full w-full" />;
}
