"use client";

import { useState } from "react";
import { DIETARY_BADGES } from "@/lib/shops/socialAndDietary";
import { ratingColor } from "@/lib/shops/shopHelpers";
import { EVENT_CATEGORIES, categoryOf, formatBusinessEventSchedule } from "@/lib/events/eventHelpers";
import { DatePickerPopover } from "./DatePickerPopover";
import {
  filterShops,
  filterEvents,
  sortShops,
  toggleInList,
  type ContentTypeFilter,
  type DietaryKey,
  type SortOption,
  type DateQuickFilter,
} from "@/lib/filters/filterHelpers";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, EventCategory, UmbrellaEvent } from "@/types/events";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  shops: Shop[];
  businessEvents: BusinessEvent[];
  umbrellaEvents: UmbrellaEvent[];
  onSelectShop: (shopId: number) => void;
  onSelectEvent: (eventId: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  loading?: boolean;
}

const SORT_LABELS: Record<SortOption, string> = {
  "rating-desc": "Hoogste sterren eerst",
  "rating-asc": "Laagste sterren eerst",
  "name-asc": "Naam A-Z",
  "name-desc": "Naam Z-A",
};

export function Sidebar({
  shops,
  businessEvents,
  umbrellaEvents,
  onSelectShop,
  onSelectEvent,
  mobileOpen,
  onCloseMobile,
  loading = false,
}: SidebarProps) {
  const [contentType, setContentType] = useState<ContentTypeFilter>("alles");
  const [query, setQuery] = useState("");
  const [dietary, setDietary] = useState<DietaryKey[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [umbrellaFilter, setUmbrellaFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateQuickFilter>(null);
  const [sort, setSort] = useState<SortOption>("rating-desc");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const showShops = contentType !== "events";
  const showEvents = contentType !== "broodjes";
  const today = new Date().toISOString().slice(0, 10);
  const isCustomDate = dateFilter !== null && dateFilter !== "today" && dateFilter !== "tomorrow";

  const filteredShops = showShops ? sortShops(filterShops(shops, { query, dietary }), sort) : [];
  const filteredEvents = showEvents
    ? filterEvents(businessEvents, { query, categories, umbrellaEventId: umbrellaFilter, dateFilter, today })
    : [];

  const activeUmbrellas = umbrellaEvents;
  const resultsCount = filteredShops.length + filteredEvents.length;
  const activeFilterCount =
    dietary.length + categories.length + (umbrellaFilter ? 1 : 0) + (dateFilter ? 1 : 0) + (query.trim() ? 1 : 0);

  function clearAllFilters() {
    setQuery("");
    setDietary([]);
    setCategories([]);
    setUmbrellaFilter(null);
    setDateFilter(null);
  }

  return (
    <aside className={`${styles.sidebar} ${mobileOpen ? styles.mobileOpen : ""}`}>
      <div className={styles.mobileHeader}>
        <span>Filters</span>
        <button type="button" className={styles.closeMobile} onClick={onCloseMobile} aria-label="Filters sluiten">
          ✕
        </button>
      </div>

      <div className={styles.typeTabs} role="tablist" aria-label="Inhoudstype">
        {(["alles", "broodjes", "events"] as ContentTypeFilter[]).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={contentType === type}
            className={contentType === type ? styles.typeTabActive : styles.typeTab}
            onClick={() => setContentType(type)}
          >
            {type === "alles" ? "Alles" : type === "broodjes" ? "🥪 Broodjes" : "🎉 Events"}
          </button>
        ))}
      </div>

      {activeUmbrellas.length > 0 && (
        <div className={styles.umbrellaPills}>
          {activeUmbrellas.map((u) => (
            <button
              key={u.id}
              type="button"
              className={umbrellaFilter === u.id ? styles.umbrellaPillActive : styles.umbrellaPill}
              style={u.photoUrl ? { backgroundImage: `url(${u.photoUrl})` } : { background: u.color }}
              onClick={() => setUmbrellaFilter(umbrellaFilter === u.id ? null : u.id)}
            >
              <span className={styles.umbrellaPillLabel}>{u.title}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.resultsRow}>
        <span className={styles.resultsCount}>{resultsCount} resultaten</span>
        {activeFilterCount > 0 && (
          <button type="button" className={styles.clearFilters} onClick={clearAllFilters}>
            Wis filters
          </button>
        )}
      </div>

      <button
        type="button"
        className={styles.filtersToggle}
        onClick={() => setFiltersExpanded((v) => !v)}
        aria-expanded={filtersExpanded}
      >
        Meer filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ""}
        <span className={filtersExpanded ? styles.chevronOpen : styles.chevron}>▾</span>
      </button>

      {filtersExpanded && (
        <div className={styles.filtersBody}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Zoek op naam of adres..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Zoeken"
          />

          {showShops && (
            <div className={styles.filterGroup}>
              <span className={styles.filterGroupLabel}>Dieet</span>
              <div className={styles.pillRow}>
                {DIETARY_BADGES.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    className={dietary.includes(b.key) ? styles.filterPillActive : styles.filterPill}
                    onClick={() => setDietary((cur) => toggleInList(cur, b.key))}
                  >
                    {b.emoji} {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showEvents && (
            <div className={styles.filterGroup}>
              <span className={styles.filterGroupLabel}>Categorie</span>
              <div className={styles.pillRow}>
                {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={categories.includes(key) ? styles.filterPillActive : styles.filterPill}
                    onClick={() => setCategories((cur) => toggleInList(cur, key))}
                  >
                    {EVENT_CATEGORIES[key].emoji} {EVENT_CATEGORIES[key].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showEvents && (
            <div className={styles.filterGroup}>
              <span className={styles.filterGroupLabel}>Wanneer</span>
              <div className={styles.pillRow}>
                <button
                  type="button"
                  className={dateFilter === "today" ? styles.filterPillActive : styles.filterPill}
                  onClick={() => setDateFilter((cur) => (cur === "today" ? null : "today"))}
                >
                  Vandaag
                </button>
                <button
                  type="button"
                  className={dateFilter === "tomorrow" ? styles.filterPillActive : styles.filterPill}
                  onClick={() => setDateFilter((cur) => (cur === "tomorrow" ? null : "tomorrow"))}
                >
                  Morgen
                </button>
                <div className={styles.datePickerAnchor}>
                  <button
                    type="button"
                    className={isCustomDate ? styles.filterPillActive : styles.filterPill}
                    onClick={() => setDatePickerOpen((v) => !v)}
                  >
                    📅 {isCustomDate ? dateFilter : "Kies datum"}
                  </button>
                  <DatePickerPopover
                    open={datePickerOpen}
                    onClose={() => setDatePickerOpen(false)}
                    events={businessEvents}
                    today={today}
                    onSelectDate={setDateFilter}
                  />
                </div>
              </div>
            </div>
          )}

          {showShops && (
            <div className={styles.filterGroup}>
              <label className={styles.filterGroupLabel} htmlFor="sidebar-sort">
                Sorteren
              </label>
              <select
                id="sidebar-sort"
                className={styles.sortSelect}
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
              >
                {Object.entries(SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className={styles.list}>
        {loading &&
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={styles.skeletonCard} aria-hidden="true">
              <span className={styles.skeletonPill} />
              <span className={styles.skeletonLines}>
                <span className={styles.skeletonLine} />
                <span className={styles.skeletonLine} />
              </span>
            </div>
          ))}

        {!loading && resultsCount === 0 && <p className={styles.empty}>Geen resultaten gevonden 🥲</p>}

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
                className={styles.row}
                onClick={() => {
                  onSelectEvent(ev.id);
                  onCloseMobile();
                }}
              >
                <span className={styles.eventPill} style={{ background: parentUmbrella?.color ?? "#ec4899" }}>
                  {cat.emoji}
                </span>
                <span className={styles.rowBody}>
                  <span className={styles.rowTitle}>{ev.title}</span>
                  <span className={styles.rowSubtitle}>{formatBusinessEventSchedule(ev)}</span>
                  {parentUmbrella && (
                    <span className={styles.rowUmbrellaCaption}>🏙️ Onderdeel van {parentUmbrella.title}</span>
                  )}
                </span>
              </button>
            );
          })}

        {!loading &&
          filteredShops.map((shop) => (
            <button
              key={shop.id}
              type="button"
              className={styles.row}
              onClick={() => {
                onSelectShop(shop.id);
                onCloseMobile();
              }}
            >
              <span className={styles.shopPill} style={{ background: ratingColor(shop.rating) }}>
                {shop.rating.toFixed(1)}
              </span>
              <span className={styles.rowBody}>
                <span className={styles.rowTitle}>{shop.name}</span>
                <span className={styles.rowSubtitle}>{shop.address}</span>
              </span>
              <span className={styles.pricePill}>{shop.price}</span>
            </button>
          ))}
      </div>
    </aside>
  );
}
