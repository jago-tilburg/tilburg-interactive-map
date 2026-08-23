"use client";

import { useEffect, useState } from "react";
import { ShopMap } from "@/components/map/ShopMap";
import { MapFilterPanel } from "@/components/mapfilter/MapFilterPanel";
import { Header } from "@/components/layout/Header";
import { ShopDetailModal } from "@/components/shops/ShopDetailModal";
import { ShopFormModal } from "@/components/shops/ShopFormModal";
import { BusinessEventDetailModal } from "@/components/events/BusinessEventDetailModal";
import { UmbrellaEventDetailModal } from "@/components/events/UmbrellaEventDetailModal";
import { useAuth } from "@/hooks/useAuth";
import { subscribeShops } from "@/lib/firebase/shops";
import { subscribeApprovedBusinessEvents } from "@/lib/firebase/businessEvents";
import { subscribeUmbrellaEvents } from "@/lib/firebase/umbrellaEvents";
import { reverseGeocode } from "@/lib/maps/reverseGeocode";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./MapExperience.module.css";

interface MapExperienceProps {
  apiKey: string;
}

// Selection state tracks ids, not object references, so the detail modals
// stay live-updated as the shops/(business)events subscriptions push new
// data (e.g. a like or rating landing right after the modal opened) instead
// of freezing on a stale snapshot from the moment the marker was clicked.
export function MapExperience({ apiKey }: MapExperienceProps) {
  const { isAdmin } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [businessEvents, setBusinessEvents] = useState<BusinessEvent[]>([]);
  const [umbrellaEvents, setUmbrellaEvents] = useState<UmbrellaEvent[]>([]);
  // Narrowed by MapFilterPanel — the map markers reflect the same filters
  // as the panel, not just its own results count.
  const [visibleShops, setVisibleShops] = useState<Shop[]>([]);
  const [visibleEvents, setVisibleEvents] = useState<BusinessEvent[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedUmbrellaId, setSelectedUmbrellaId] = useState<string | null>(null);
  const [shopFormMode, setShopFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [shopBeingEdited, setShopBeingEdited] = useState<Shop | null>(null);
  const [shopPrefill, setShopPrefill] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [shopsLoaded, setShopsLoaded] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  useEffect(() => {
    const unsubShops = subscribeShops((next) => {
      setShops(next);
      setShopsLoaded(true);
    });
    const unsubEvents = subscribeApprovedBusinessEvents((next) => {
      setBusinessEvents(next);
      setEventsLoaded(true);
    });
    const unsubUmbrellas = subscribeUmbrellaEvents(setUmbrellaEvents);
    return () => {
      unsubShops();
      unsubEvents();
      unsubUmbrellas();
    };
  }, []);

  async function handleLongPressAdd(lat: number, lng: number) {
    const address = await reverseGeocode(lat, lng);
    setShopPrefill({ lat, lng, address });
    setShopBeingEdited(null);
    setShopFormMode("create");
  }

  const selectedShop = shops.find((s) => s.id === selectedShopId) ?? null;
  const selectedEvent = businessEvents.find((e) => e.id === selectedEventId) ?? null;
  const selectedUmbrella = umbrellaEvents.find((u) => u.id === selectedUmbrellaId) ?? null;

  return (
    <div className={styles.appContainer}>
      <Header
        shops={shops}
        businessEvents={businessEvents}
        umbrellaEvents={umbrellaEvents}
        onSelectShop={setSelectedShopId}
        onSelectEvent={setSelectedEventId}
        loading={!shopsLoaded || !eventsLoaded}
      />

      <div className={styles.mainContent}>
        <ShopMap
          apiKey={apiKey}
          shops={visibleShops}
          businessEvents={visibleEvents}
          umbrellaEvents={umbrellaEvents}
          onShopClick={setSelectedShopId}
          onBusinessEventClick={setSelectedEventId}
          isAdmin={isAdmin}
          onLongPressAdd={handleLongPressAdd}
        />

        <MapFilterPanel
          shops={shops}
          businessEvents={businessEvents}
          umbrellaEvents={umbrellaEvents}
          mobileOpen={mobileFilterOpen}
          onOpenMobile={() => setMobileFilterOpen(true)}
          onCloseMobile={() => setMobileFilterOpen(false)}
          onFilteredResultsChange={(nextShops, nextEvents) => {
            setVisibleShops(nextShops);
            setVisibleEvents(nextEvents);
          }}
        />
      </div>

      <ShopDetailModal
        open={selectedShopId !== null}
        onClose={() => setSelectedShopId(null)}
        shop={selectedShop}
        onEditRequested={(shop) => {
          setSelectedShopId(null);
          setShopBeingEdited(shop);
          setShopPrefill(null);
          setShopFormMode("edit");
        }}
      />

      <ShopFormModal
        open={shopFormMode !== "closed"}
        onClose={() => {
          setShopFormMode("closed");
          setShopPrefill(null);
        }}
        editingShop={shopFormMode === "edit" ? shopBeingEdited : null}
        prefill={shopFormMode === "create" ? shopPrefill : null}
      />

      <BusinessEventDetailModal
        open={selectedEventId !== null}
        onClose={() => setSelectedEventId(null)}
        event={selectedEvent}
        umbrellaEvents={umbrellaEvents}
        onOpenUmbrella={(umbrellaId) => {
          setSelectedEventId(null);
          setSelectedUmbrellaId(umbrellaId);
        }}
      />

      <UmbrellaEventDetailModal
        open={selectedUmbrellaId !== null}
        onClose={() => setSelectedUmbrellaId(null)}
        umbrella={selectedUmbrella}
        approvedBusinessEvents={businessEvents}
        onOpenEvent={(eventId) => {
          setSelectedUmbrellaId(null);
          setSelectedEventId(eventId);
        }}
      />
    </div>
  );
}
