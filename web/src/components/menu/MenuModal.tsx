"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PrivacyModal } from "@/components/common/PrivacyModal";
import { AdminLoginModal } from "@/components/auth/AdminLoginModal";
import { ratingColor } from "@/lib/shops/shopHelpers";
import { categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
import { filterShops, filterEvents, sortShops, type ContentTypeFilter, type SortOption } from "@/lib/filters/filterHelpers";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, UmbrellaEvent } from "@/types/events";
import styles from "./MenuModal.module.css";

type DietaryFilter = "all" | "glutenvrij" | "halal" | "vega";

interface MenuModalProps {
  open: boolean;
  onClose: () => void;
  shops: Shop[];
  businessEvents: BusinessEvent[];
  umbrellaEvents: UmbrellaEvent[];
  onSelectShop: (shopId: number) => void;
  onSelectEvent: (eventId: string) => void;
  loading?: boolean;
}

const SORT_LABELS: Record<SortOption, string> = {
  "rating-desc": "Hoogste sterren eerst",
  "rating-asc": "Laagste sterren eerst",
  "name-asc": "Naam (A-Z)",
  "name-desc": "Naam (Z-A)",
};

const today = () => new Date().toISOString().slice(0, 10);

// Full "ALLE 2 HAPPIES" list — mirrors the prototype's #menuOverlay.
// NOTE: in the prototype, setMenuType()/setDietaryFilter() write directly
// into the map filter panel's own activeContentTypes/activeDietaryFilters
// sets (renderMenuReviews() also reads the map's live search query, active
// event categories, active date filter, and active groot-event filter) — the
// hamburger menu list and the map's floating filter panel share ONE global
// filter state there, not two independent ones. This component still keeps
// its own local state, unsynced with MapFilterPanel — a real, known
// divergence from the prototype, not fixed in this pass (it needs lifting
// the map panel's filter state up to a shared ancestor).
export function MenuModal({
  open,
  onClose,
  shops,
  businessEvents,
  umbrellaEvents,
  onSelectShop,
  onSelectEvent,
  loading = false,
}: MenuModalProps) {
  const { isAdmin } = useAuth();
  const [contentType, setContentType] = useState<ContentTypeFilter>("alles");
  const [sort, setSort] = useState<SortOption>("rating-desc");
  const [dietaryFilter, setDietaryFilter] = useState<DietaryFilter>("all");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);

  if (!open) return null;

  const showShops = contentType !== "events";
  const showEvents = contentType !== "broodjes";

  const filteredShops = showShops
    ? sortShops(
        filterShops(shops, { query: "", dietary: dietaryFilter === "all" ? [] : [dietaryFilter] }),
        sort,
      )
    : [];
  const filteredEvents = showEvents
    ? filterEvents(businessEvents, { query: "", categories: [], umbrellaEventId: null, dateFilter: null, today: today() }).sort(
        (a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`),
      )
    : [];
  // Only non-expired umbrellas, chronological — matches renderEventMenuHtml's
  // visibleUmbrellas (`u.endDate >= today`, sorted by startDate).
  const visibleUmbrellas = showEvents
    ? umbrellaEvents.filter((u) => u.endDate >= today()).sort((a, b) => a.startDate.localeCompare(b.startDate))
    : [];

  const resultsEmpty = filteredShops.length === 0 && filteredEvents.length === 0 && visibleUmbrellas.length === 0;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div className={styles.container} role="dialog" aria-label="Alle 2 Happies" onClick={(e) => e.stopPropagation()}>
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
            {(["all", "glutenvrij", "halal", "vega"] as DietaryFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                className={dietaryFilter === key ? styles.filterBtnActive : styles.filterBtn}
                onClick={() => setDietaryFilter(key)}
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
          <button type="button" className={styles.footerLink} onClick={() => setAdminLoginOpen(true)}>
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
