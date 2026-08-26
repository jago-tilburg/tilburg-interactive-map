"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ShopMap } from "@/components/map/ShopMap";
import { MapFilterPanel } from "@/components/mapfilter/MapFilterPanel";
import { Header } from "@/components/layout/Header";
import { ShopDetailModal } from "@/components/shops/ShopDetailModal";
import { ShopFormModal } from "@/components/shops/ShopFormModal";
import { BusinessEventDetailModal } from "@/components/events/BusinessEventDetailModal";
import { UmbrellaEventDetailModal } from "@/components/events/UmbrellaEventDetailModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useMapFilterState } from "@/hooks/useMapFilterState";
import { subscribeShops } from "@/lib/firebase/shops";
import { subscribeApprovedBusinessEvents } from "@/lib/firebase/businessEvents";
import { subscribeUmbrellaEvents } from "@/lib/firebase/umbrellaEvents";
import { reverseGeocode } from "@/lib/maps/reverseGeocode";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./MapExperience.module.css";

// A deep-linked shop/event/umbrella, resolved from the matching /shop/[id]
// /event/[id] /umbrella/[id] route (see app/_components/MapPageShell.tsx) —
// opens that item's detail modal immediately, before any marker is ever
// clicked.
export type InitialSelection =
  | { type: "shop"; id: number }
  | { type: "event"; id: string }
  | { type: "umbrella"; id: string };

interface MapExperienceProps {
  apiKey: string;
  initialSelection?: InitialSelection;
  paymentStatus?: "success" | "cancelled";
}

// Selection state tracks ids, not object references, so the detail modals
// stay live-updated as the shops/(business)events subscriptions push new
// data (e.g. a like or rating landing right after the modal opened) instead
// of freezing on a stale snapshot from the moment the marker was clicked.
export function MapExperience({ apiKey, initialSelection, paymentStatus }: MapExperienceProps) {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  // Shared with MenuModal (via Header) — see useMapFilterState's doc comment
  // for why this is one lifted state, not two independent copies.
  const filterState = useMapFilterState();
  const [shops, setShops] = useState<Shop[]>([]);
  const [businessEvents, setBusinessEvents] = useState<BusinessEvent[]>([]);
  const [umbrellaEvents, setUmbrellaEvents] = useState<UmbrellaEvent[]>([]);
  // Narrowed by MapFilterPanel — the map markers reflect the same filters
  // as the panel, not just its own results count.
  const [visibleShops, setVisibleShops] = useState<Shop[]>([]);
  const [visibleEvents, setVisibleEvents] = useState<BusinessEvent[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(
    initialSelection?.type === "shop" ? initialSelection.id : null,
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    initialSelection?.type === "event" ? initialSelection.id : null,
  );
  const [selectedUmbrellaId, setSelectedUmbrellaId] = useState<string | null>(
    initialSelection?.type === "umbrella" ? initialSelection.id : null,
  );
  const [shopFormMode, setShopFormMode] = useState<"closed" | "create" | "edit">("closed");
  const [shopBeingEdited, setShopBeingEdited] = useState<Shop | null>(null);
  const [shopPrefill, setShopPrefill] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [shopsLoaded, setShopsLoaded] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [umbrellasLoaded, setUmbrellasLoaded] = useState(false);

  useEffect(() => {
    const unsubShops = subscribeShops((next) => {
      setShops(next);
      setShopsLoaded(true);
    });
    const unsubEvents = subscribeApprovedBusinessEvents((next) => {
      setBusinessEvents(next);
      setEventsLoaded(true);
    });
    const unsubUmbrellas = subscribeUmbrellaEvents((next) => {
      setUmbrellaEvents(next);
      setUmbrellasLoaded(true);
    });
    return () => {
      unsubShops();
      unsubEvents();
      unsubUmbrellas();
    };
  }, []);

  // Keeps the URL in sync with whichever detail modal (if any) is open —
  // replace, not push, so clicking through several markers in a row
  // doesn't pile up one history entry per click (the tradeoff: the back
  // button doesn't "close" a modal opened this way).
  useEffect(() => {
    const path =
      selectedShopId !== null
        ? `/shop/${selectedShopId}`
        : selectedEventId !== null
          ? `/event/${selectedEventId}`
          : selectedUmbrellaId !== null
            ? `/umbrella/${selectedUmbrellaId}`
            : "/";
    if (path !== pathname) router.replace(path, { scroll: false });
  }, [selectedShopId, selectedEventId, selectedUmbrellaId, pathname, router]);

  // A return trip from Stripe Checkout (see BusinessDashboard's handlePay
  // and functions/index.js's createCheckoutSession success_url/cancel_url).
  // The event isn't necessarily paid *yet* at this exact moment — Stripe's
  // webhook is what actually flips paid/status, asynchronously — this is
  // just user feedback on the redirect itself; the live subscription above
  // picks up the real status change whenever the webhook lands. Strips the
  // query param afterward so a refresh doesn't re-show the toast.
  useEffect(() => {
    if (!paymentStatus) return;
    if (paymentStatus === "success") {
      showToast("Betaling gelukt — je evenement is nu live op de kaart.", "success");
    } else {
      showToast("Betaling geannuleerd.", "info");
    }
    router.replace(pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatus]);

  // Clears a selection that doesn't match any real record, once its data
  // has actually loaded — covers both a stale/bad deep link (e.g. a typo'd
  // id) and a shop/event/umbrella being deleted while someone has it open.
  // Adjusted during render (not in an effect) per the same pattern
  // ShopDetailModal's errorShownForShopId uses: checking the *current*
  // selection keeps this self-limiting — once cleared, selectedShopId is
  // null, so the condition can't fire again for the same id.
  if (selectedShopId !== null && shopsLoaded && !shops.some((s) => s.id === selectedShopId)) {
    setSelectedShopId(null);
  }
  if (selectedEventId !== null && eventsLoaded && !businessEvents.some((e) => e.id === selectedEventId)) {
    setSelectedEventId(null);
  }
  if (selectedUmbrellaId !== null && umbrellasLoaded && !umbrellaEvents.some((u) => u.id === selectedUmbrellaId)) {
    setSelectedUmbrellaId(null);
  }

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
        filterState={filterState}
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
          filterState={filterState}
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
