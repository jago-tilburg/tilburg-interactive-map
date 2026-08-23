"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/maps/loadGoogleMaps";
import {
  buildShopIconDataUrl,
  DROP_ICON_SIZE,
  DROP_ICON_ANCHOR,
  EVENT_STAR_PATH,
  BUSINESS_EVENT_COLOR,
  EVENT_ICON_ANCHOR,
} from "@/lib/maps/markerIcons";
import type { Shop } from "@/types/shops";
import type { BusinessEvent } from "@/types/events";
import styles from "./ShopMap.module.css";

const TILBURG_CENTER = { lat: 51.5555, lng: 5.0913 };

// Same warm-vintage custom style as the monolith's initMap().
const CUSTOM_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "administrative", elementType: "all", stylers: [{ visibility: "on" }, { lightness: 33 }] },
  { featureType: "landscape", elementType: "all", stylers: [{ color: "#f2e5d4" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#c5dac6" }] },
  { featureType: "poi.park", elementType: "labels", stylers: [{ visibility: "on" }, { lightness: 20 }] },
  { featureType: "road", elementType: "all", stylers: [{ lightness: 20 }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#c5c6c6" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e4d7c6" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#fbfaf7" }] },
  { featureType: "water", elementType: "all", stylers: [{ visibility: "on" }, { color: "#acbcc9" }] },
];

interface ShopMapProps {
  apiKey: string;
  shops: Shop[];
  businessEvents: BusinessEvent[];
  onShopClick: (shopId: number) => void;
  onBusinessEventClick: (eventId: string) => void;
}

export function ShopMap({ apiKey, shops, businessEvents, onShopClick, onBusinessEventClick }: ShopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const shopMarkersRef = useRef(new Map<number, google.maps.Marker>());
  const eventMarkersRef = useRef(new Map<string, google.maps.Marker>());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new google.maps.Map(containerRef.current, {
          center: TILBURG_CENTER,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: CUSTOM_MAP_STYLE,
        });
        setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Kaart laden mislukt.");
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const markers = shopMarkersRef.current;
    const currentIds = new Set(shops.map((s) => s.id));

    for (const [id, marker] of markers) {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        markers.delete(id);
      }
    }

    for (const shop of shops) {
      const existing = markers.get(shop.id);
      if (existing) {
        existing.setPosition({ lat: shop.lat, lng: shop.lng });
        continue;
      }
      const marker = new google.maps.Marker({
        position: { lat: shop.lat, lng: shop.lng },
        map,
        title: shop.name,
        icon: {
          url: buildShopIconDataUrl(shop.rating),
          scaledSize: new google.maps.Size(DROP_ICON_SIZE.width, DROP_ICON_SIZE.height),
          anchor: new google.maps.Point(DROP_ICON_ANCHOR.x, DROP_ICON_ANCHOR.y),
        },
      });
      marker.addListener("click", () => onShopClick(shop.id));
      markers.set(shop.id, marker);
    }
  }, [ready, shops, onShopClick]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const markers = eventMarkersRef.current;
    const currentIds = new Set(businessEvents.map((e) => e.id));

    for (const [id, marker] of markers) {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        markers.delete(id);
      }
    }

    for (const event of businessEvents) {
      if (markers.has(event.id)) continue;
      const marker = new google.maps.Marker({
        position: { lat: event.lat, lng: event.lng },
        map,
        title: event.title,
        icon: {
          path: EVENT_STAR_PATH,
          fillColor: BUSINESS_EVENT_COLOR,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 1.8,
          anchor: new google.maps.Point(EVENT_ICON_ANCHOR.x, EVENT_ICON_ANCHOR.y),
        },
      });
      marker.addListener("click", () => onBusinessEventClick(event.id));
      markers.set(event.id, marker);
    }
  }, [ready, businessEvents, onBusinessEventClick]);

  return (
    <div className={styles.wrapper}>
      {loadError && (
        <p role="alert" className={styles.error}>
          {loadError}
        </p>
      )}
      <div ref={containerRef} data-testid="map-container" className={styles.map} />
    </div>
  );
}
