"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { PrivacyModal } from "@/components/common/PrivacyModal";
import { AdminLoginModal } from "@/components/auth/AdminLoginModal";
import { ratingColor } from "@/lib/shops/shopHelpers";
import { categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
import {
  filterShops,
  filterEvents,
  sortShops,
  dateFilterMatchesRange,
  type ContentTypeFilter,
  type DietaryKey,
  type SortOption,
} from "@/lib/filters/filterHelpers";
import type { MapFilterState, MapFilterActions } from "@/hooks/useMapFilterState";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./MenuModal.module.css";

interface MenuModalProps {
  open: boolean;
  onClose: () => void;
  shops: Shop[];
  businessEvents: BusinessEvent[];
  umbrellaEvents: UmbrellaEvent[];
  onSelectShop: (shopId: number) => void;
  onSelectEvent: (eventId: string) => void;
  loading?: boolean;
  // Shared with the map's floating filter panel — see useMapFilterState's
  // doc comment. Content-type/dietary pills here are "preset" entry points
  // into that same shared state (mirrors the prototype's setMenuType() /
  // setDietaryFilter()), and the rendered list also respects whatever
  // category/date/groot-event filter is active on the map panel, exactly
  // like the prototype's renderMenuReviews().
  filterState: MapFilterState & MapFilterActions;
}

const SORT_LABELS: Record<SortOption, string> = {
  "rating-desc": "Hoogste sterren eerst",
  "rating-asc": "Laagste sterren eerst",
  "name-asc": "Naam (A-Z)",
  "name-desc": "Naam (Z-A)",
};

const today = () => new Date().toISOString().slice(0, 10);

// Full "ALLE 2 HAPPIES" list — mirrors the prototype's #menuOverlay. The
// content-type/dietary pills and the rendered list all read/write the SAME
// filter state as the map's floating filter panel (via `filterState`,
// lifted in MapExperience) — matches the prototype's renderMenuReviews(),
// which reads the map's live search query, active event categories, active
// date filter, and active groot-event filter, not just its own two pills.
export function MenuModal({
  open,
  onClose,
  shops,
  businessEvents,
  umbrellaEvents,
  onSelectShop,
  onSelectEvent,
  loading = false,
  filterState,
}: MenuModalProps) {
  const { isAdmin } = useAuth();
  const { contentType, setContentType, query, dietary, categories, umbrellaFilter, dateFilter, setDietaryPreset } =
    filterState;
  const [sort, setSort] = useState<SortOption>("rating-desc");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Gated on the nested modals below (mirrors ShopDetailModal's
  // open={open && !nestedOpen} pattern) so Escape/Tab only ever affect the
  // topmost open dialog — otherwise this dialog's own trap would stay hot
  // while PrivacyModal/AdminLoginModal are open on top of it.
  useFocusTrap(dialogRef, open && !privacyOpen && !adminLoginOpen, onClose);

  if (!open) return null;

  // A groot event never contains shops — mirrors MapFilterPanel's showShops.
  const showShops = contentType !== "events" && !umbrellaFilter;
  const showEvents = contentType !== "broodjes";
  const todayStr = today();

  // syncDietaryMenuPills(): a single pill reads as "active" only when
  // exactly one dietary key is selected — 2+ (only reachable via the map
  // panel's checkboxes) leaves every menu pill including "Alles" unhighlighted.
  const activeDietaryPreset = dietary.length === 1 ? dietary[0] : "all";

  const filteredShops = showShops ? sortShops(filterShops(shops, { query, dietary }), sort) : [];
  const filteredEvents = showEvents
    ? filterEvents(businessEvents, { query, categories, umbrellaEventId: umbrellaFilter, dateFilter, today: todayStr }).sort(
        (a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`),
      )
    : [];
  // Non-expired umbrellas, also narrowed by the active date filter (treating
  // the umbrella's own start/end range like renderEventMenuHtml does) and by
  // the active groot-event selection — matches that function's
  // visibleUmbrellas exactly, not just the `endDate >= today` half of it.
  const visibleUmbrellas = showEvents
    ? umbrellaEvents
        .filter((u) => u.endDate >= todayStr)
        .filter((u) => dateFilterMatchesRange(u.startDate, u.endDate, dateFilter, todayStr))
        .filter((u) => !umbrellaFilter || u.id === umbrellaFilter)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
    : [];

  const resultsEmpty = filteredShops.length === 0 && filteredEvents.length === 0 && visibleUmbrellas.length === 0;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={styles.container}
        role="dialog"
        aria-modal="true"
        aria-label="Alle 2 Happies"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2>ALLE 2 HAPPIES</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Sluiten">
            ×
          </button>
        </div>

        <div className={styles.filterRow}>
          {(["alles", "broodjes", "events"] as ContentTypeFilter[]).map((type) => (
            <button
              key={type}
              type="button"
              className={contentType === type ? styles.filterBtnActive : styles.filterBtn}
              onClick={() => setContentType(type)}
            >
              {type === "alles" ? "Alles" : type === "broodjes" ? "🥪 Broodjes" : "🎉 Events"}
            </button>
          ))}
        </div>

        {showShops && (
          <div className={styles.sortRow}>
            <label htmlFor="menu-sort">Sorteer op:</label>
            <select id="menu-sort" value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {showShops && (
          <div className={styles.filterRow}>
            {(["all", "glutenvrij", "halal", "vega"] as (DietaryKey | "all")[]).map((key) => (
              <button
                key={key}
                type="button"
                className={activeDietaryPreset === key ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setDietaryPreset(key)}
              >
                {key === "all" ? "Alles" : key === "glutenvrij" ? "🌾 Glutenvrij" : key === "halal" ? "☪️ Halal" : "🌿 Vega"}
              </button>
            ))}
          </div>
        )}

        <div className={styles.list}>
          {loading &&
            Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={styles.skeletonItem} aria-hidden="true">
                <span className={styles.skeletonPill} />
                <span className={styles.skeletonLines}>
                  <span className={styles.skeletonLine} />
                  <span className={styles.skeletonLine} />
                </span>
              </div>
            ))}

          {!loading && resultsEmpty && <p className={styles.empty}>Nog geen reviews beschikbaar</p>}

          {!loading &&
            visibleUmbrellas.map((u) => (
              <div key={u.id} className={styles.item}>
                <span className={styles.pill} style={{ background: u.color }}>
                  🏙️
                </span>
                <div className={styles.info}>
                  <div className={styles.name}>{u.title}</div>
                  <div className={styles.address}>
                    {u.startDate} t/m {u.endDate}
                  </div>
                </div>
              </div>
            ))}

          {!loading &&
            filteredEvents.map((ev) => {
              const cat = categoryOf(ev.category);
              const parentUmbrella = ev.umbrellaEventId
                ? umbrellaEvents.find((u) => u.id === ev.umbrellaEventId)
                : undefined;
              return (
                <button
                  key={ev.id}
                  type="button"
                  className={styles.item}
                  onClick={() => onSelectEvent(ev.id)}
                >
                  <span className={styles.pill} style={{ background: parentUmbrella?.color ?? "#ec4899" }}>
                    {cat.emoji}
                  </span>
                  <div className={styles.info}>
                    <div className={styles.name}>{ev.title}</div>
                    <div className={styles.address}>{formatBusinessEventSchedule(ev)}</div>
                  </div>
                </button>
              );
            })}

          {!loading &&
            filteredShops.map((shop) => (
            <button key={shop.id} type="button" className={styles.item} onClick={() => onSelectShop(shop.id)}>
              <span className={styles.pill} style={{ background: ratingColor(shop.rating) }}>
                {shop.rating.toFixed(1)}
              </span>
              <div className={styles.info}>
                <div className={styles.name}>{shop.name}</div>
                <div className={styles.address}>{shop.address}</div>
              </div>
              <span className={styles.price}>{shop.price}</span>
            </button>
          ))}
        </div>

        {!isAdmin && (
          <button
            type="button"
            className={styles.footerLink}
            aria-label="Beheerder inloggen"
            onClick={() => setAdminLoginOpen(true)}
          >
            🔐
          </button>
        )}
        <button type="button" className={styles.footerLink} onClick={() => setPrivacyOpen(true)}>
          📜 Privacy
        </button>
      </div>

      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <AdminLoginModal open={adminLoginOpen} onClose={() => setAdminLoginOpen(false)} />
    </div>
  );
}
