"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/maps/loadGoogleMaps";
import {
  buildShopIconDataUrl,
  DROP_ICON_SIZE,
  DROP_ICON_ANCHOR,
  computeMarkerSize,
  buildEventCardIconDataUrl,
  computeIconScaledSize,
  fetchEventPhotoDataUrl,
  shadeColor,
  DEFAULT_CARD_BORDER,
} from "@/lib/maps/markerIcons";
import { categoryOf, isEventHappeningNow } from "@/lib/events/eventHelpers";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
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

const LONG_PRESS_MS = 800;

interface ShopMapProps {
  apiKey: string;
  shops: Shop[];
  businessEvents: BusinessEvent[];
  umbrellaEvents?: UmbrellaEvent[];
  onShopClick: (shopId: number) => void;
  onBusinessEventClick: (eventId: string) => void;
  isAdmin?: boolean;
  onLongPressAdd?: (lat: number, lng: number) => void;
}

export function ShopMap({
  apiKey,
  shops,
  businessEvents,
  umbrellaEvents = [],
  onShopClick,
  onBusinessEventClick,
  isAdmin = false,
  onLongPressAdd,
}: ShopMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const shopMarkersRef = useRef(new Map<number, google.maps.Marker>());
  const eventMarkersRef = useRef(new Map<string, google.maps.Marker>());
  // Resolved photoUrl -> data URL, populated as fetchEventPhotoDataUrl()
  // resolves (see the effect below) so a re-render/rebuild for an
  // already-fetched photo doesn't re-fetch or flash back to the emoji.
  const eventPhotoDataRef = useRef(new Map<string, string>());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(13);
  const [now, setNow] = useState(() => new Date());

  // Rebuilds event marker icons every 60s so the "happening now" glow turns
  // on/off as events start/end, without needing a page reload — mirrors the
  // prototype's checkHappeningNowChanges().
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

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
        mapRef.current.addListener("zoom_changed", () => {
          /* v8 ignore next */
          setZoom(mapRef.current?.getZoom() ?? 13);
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
    const photoDataCache = eventPhotoDataRef.current;
    const currentIds = new Set(businessEvents.map((e) => e.id));
    const { w, h } = computeMarkerSize(zoom);

    for (const [id, marker] of markers) {
      if (!currentIds.has(id)) {
        marker.setMap(null);
        markers.delete(id);
      }
    }

    function buildIcon(event: BusinessEvent, photoUrl: string | undefined): google.maps.Icon {
      const parentUmbrella = event.umbrellaEventId
        ? umbrellaEvents.find((u) => u.id === event.umbrellaEventId)
        : undefined;
      const borderColors: [string, string] = parentUmbrella
        ? [parentUmbrella.color, shadeColor(parentUmbrella.color, -30)]
        : DEFAULT_CARD_BORDER;
      const iconMeta = buildEventCardIconDataUrl({
        photoUrl,
        categoryEmoji: categoryOf(event.category).emoji,
        borderColors,
        happeningNow: isEventHappeningNow(event, now),
      });
      const { scaledSize, anchor } = computeIconScaledSize(iconMeta, w, h);
      return {
        url: iconMeta.url,
        scaledSize: new google.maps.Size(scaledSize.width, scaledSize.height),
        anchor: new google.maps.Point(anchor.x, anchor.y),
      };
    }

    for (const event of businessEvents) {
      const resolvedPhoto = event.photoUrl ? photoDataCache.get(event.photoUrl) : undefined;
      const icon = buildIcon(event, resolvedPhoto);

      const existing = markers.get(event.id);
      if (existing) {
        existing.setPosition({ lat: event.lat, lng: event.lng });
        existing.setIcon(icon);
      } else {
        const marker = new google.maps.Marker({
          position: { lat: event.lat, lng: event.lng },
          map,
          title: event.title,
          icon,
        });
        marker.addListener("click", () => onBusinessEventClick(event.id));
        markers.set(event.id, marker);
      }

      // photoUrl is a plain external URL (not yet a data URL) — kick off the
      // CORS-safe conversion and swap the icon in once it resolves, matching
      // the prototype's getEventPhotoDataUrl(). See fetchEventPhotoDataUrl's
      // own comment for why embedding the raw URL directly doesn't work.
      if (event.photoUrl && !resolvedPhoto) {
        const photoUrl = event.photoUrl;
        fetchEventPhotoDataUrl(photoUrl).then((dataUrl) => {
          if (!dataUrl) return;
          photoDataCache.set(photoUrl, dataUrl);
          const marker = markers.get(event.id);
          marker?.setIcon(buildIcon(event, dataUrl));
        });
      }
    }
  }, [ready, businessEvents, umbrellaEvents, zoom, now, onBusinessEventClick]);

  // Admin-only long-press-to-add: hold the map (not a marker) for 800ms to
  // trigger onLongPressAdd at that point. Uses the Maps API's own mouse
  // events (event.latLng is pre-resolved) rather than raw DOM + projection
  // math. Cancelled by a drag (map pan) so it never fires mid-pan.
  useEffect(() => {
    if (!ready || !mapRef.current || !isAdmin || !onLongPressAdd) return;
    const map = mapRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    const downListener = map.addListener("mousedown", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      clear();
      timer = setTimeout(() => onLongPressAdd(lat, lng), LONG_PRESS_MS);
    });
    const upListener = map.addListener("mouseup", clear);
    const dragListener = map.addListener("dragstart", clear);

    return () => {
      clear();
      google.maps.event.removeListener(downListener);
      google.maps.event.removeListener(upListener);
      google.maps.event.removeListener(dragListener);
    };
  }, [ready, isAdmin, onLongPressAdd]);

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
