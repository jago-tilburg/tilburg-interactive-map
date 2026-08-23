"use client";

import { useEffect, useState } from "react";
import { ShopMap } from "@/components/map/ShopMap";
import { ShopDetailModal } from "@/components/shops/ShopDetailModal";
import { ShopFormModal } from "@/components/shops/ShopFormModal";
import { BusinessEventDetailModal } from "@/components/events/BusinessEventDetailModal";
import { UmbrellaEventDetailModal } from "@/components/events/UmbrellaEventDetailModal";
import { useAuth } from "@/hooks/useAuth";
import { subscribeShops } from "@/lib/firebase/shops";
import { subscribeApprovedBusinessEvents } from "@/lib/firebase/businessEvents";
import { subscribeUmbrellaEvents } from "@/lib/firebase/umbrellaEvents";
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
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedUmbrellaId, setSelectedUmbrellaId] = useState<string | null>(null);
  const [shopFormMode, setShopFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [shopBeingEdited, setShopBeingEdited] = useState<Shop | null>(null);

  useEffect(() => {
    const unsubShops = subscribeShops(setShops);
    const unsubEvents = subscribeApprovedBusinessEvents(setBusinessEvents);
    const unsubUmbrellas = subscribeUmbrellaEvents(setUmbrellaEvents);
    return () => {
      unsubShops();
      unsubEvents();
      unsubUmbrellas();
    };
  }, []);

  const selectedShop = shops.find((s) => s.id === selectedShopId) ?? null;
  const selectedEvent = businessEvents.find((e) => e.id === selectedEventId) ?? null;
  const selectedUmbrella = umbrellaEvents.find((u) => u.id === selectedUmbrellaId) ?? null;

  return (
    <div className={styles.wrapper}>
      <ShopMap
        apiKey={apiKey}
        shops={shops}
        businessEvents={businessEvents}
        onShopClick={setSelectedShopId}
        onBusinessEventClick={setSelectedEventId}
      />

      {isAdmin && (
        <button
          type="button"
          className={styles.addShopButton}
          onClick={() => {
            setShopBeingEdited(null);
            setShopFormMode("create");
          }}
        >
          + Nieuwe Review Toevoegen
        </button>
      )}

      <ShopDetailModal
        open={selectedShopId !== null}
        onClose={() => setSelectedShopId(null)}
        shop={selectedShop}
        onEditRequested={(shop) => {
          setSelectedShopId(null);
          setShopBeingEdited(shop);
          setShopFormMode("edit");
        }}
      />

      <ShopFormModal
        open={shopFormMode !== "closed"}
        onClose={() => setShopFormMode("closed")}
        editingShop={shopFormMode === "edit" ? shopBeingEdited : null}
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
