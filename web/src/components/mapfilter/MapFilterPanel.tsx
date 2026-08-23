"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { DIETARY_BADGES } from "@/lib/shops/socialAndDietary";
import { EVENT_CATEGORIES } from "@/lib/events/eventHelpers";
import { DatePickerPopover } from "./DatePickerPopover";
import {
  filterShops,
  filterEvents,
  toggleInList,
  type ContentTypeFilter,
  type DietaryKey,
  type DateQuickFilter,
} from "@/lib/filters/filterHelpers";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, EventCategory, UmbrellaEvent } from "@/types/events";
import styles from "./MapFilterPanel.module.css";

interface MapFilterPanelProps {
  shops: Shop[];
  businessEvents: BusinessEvent[];
  umbrellaEvents: UmbrellaEvent[];
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenMobile: () => void;
  // Reports the filtered subsets up so the map markers reflect the same
  // filters as this panel — the prototype's dietary/category/date filters
  // narrow both the list *and* the map markers, not just one or the other.
  onFilteredResultsChange: (shops: Shop[], events: BusinessEvent[]) => void;
}

// Floating card over the map (top-left), not a docked sidebar — mirrors the
// prototype's #mapFilterPanel exactly. Only Broodjes/Events toggle (no
// "Alles" — that only exists in the separate hamburger-menu list) plus
// groot-event-pills, results count, and the collapsible "Meer filters" body.
export function MapFilterPanel({
  shops,
  businessEvents,
  umbrellaEvents,
  mobileOpen,
  onCloseMobile,
  onOpenMobile,
  onFilteredResultsChange,
}: MapFilterPanelProps) {
  const [contentType, setContentType] = useState<ContentTypeFilter>("alles");
  const [query, setQuery] = useState("");
  const [dietary, setDietary] = useState<DietaryKey[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [umbrellaFilter, setUmbrellaFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateQuickFilter>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const showShops = contentType !== "events";
  const showEvents = contentType !== "broodjes";
  const today = new Date().toISOString().slice(0, 10);
  const isCustomDate = dateFilter !== null && dateFilter !== "today" && dateFilter !== "tomorrow";

  const filteredShops = useMemo(
    () => (showShops ? filterShops(shops, { query, dietary }) : []),
    [showShops, shops, query, dietary],
  );
  const filteredEvents = useMemo(
    () =>
      showEvents
        ? filterEvents(businessEvents, { query, categories, umbrellaEventId: umbrellaFilter, dateFilter, today })
        : [],
    [showEvents, businessEvents, query, categories, umbrellaFilter, dateFilter, today],
  );

  useEffect(() => {
    onFilteredResultsChange(filteredShops, filteredEvents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredShops, filteredEvents]);

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

  const dietaryCounts = Object.fromEntries(
    DIETARY_BADGES.map((b) => [
      b.key,
      filterShops(shops, { query, dietary: [] }).filter((s) => s.dietaryOptions?.[b.key]).length,
    ]),
  );
  const categoryCounts = Object.fromEntries(
    (Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((key) => [
      key,
      filterEvents(businessEvents, { query, categories: [], umbrellaEventId: umbrellaFilter, dateFilter: null, today })
        .filter((e) => e.category === key).length,
    ]),
  );

  return (
    <Fragment>
      {!mobileOpen && (
        <button type="button" className={styles.mobileToggle} onClick={onOpenMobile}>
          🔍 Filters
          {activeFilterCount > 0 && <span className={styles.mobileBadge}>{activeFilterCount}</span>}
        </button>
      )}

    <div className={`${styles.panel} ${mobileOpen ? styles.mobileOpen : ""}`}>
      <div className={styles.mobileHeader}>
        <strong>Filters</strong>
        <button type="button" className={styles.mobileCloseBtn} onClick={onCloseMobile} aria-label="Filters sluiten">
          ✕
        </button>
      </div>

      <div className={styles.typeRow}>
        <button
          type="button"
          className={contentType === "broodjes" ? styles.typeBtnActive : styles.typeBtn}
          onClick={() => setContentType((c) => (c === "broodjes" ? "alles" : "broodjes"))}
        >
          🥪 Broodjes <span className={styles.count}>({filterShops(shops, { query, dietary: [] }).length})</span>
        </button>
        <button
          type="button"
          className={contentType === "events" ? styles.typeBtnActive : styles.typeBtn}
          onClick={() => setContentType((c) => (c === "events" ? "alles" : "events"))}
        >
          🎉 Events{" "}
          <span className={styles.count}>
            ({filterEvents(businessEvents, { query, categories: [], umbrellaEventId: null, dateFilter: null, today }).length})
          </span>
        </button>
      </div>

      {showEvents && umbrellaEvents.length > 0 && (
        <div className={styles.umbrellaPills}>
          {umbrellaEvents.map((u) => (
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
        <span>{resultsCount} resultaten</span>
        {activeFilterCount > 0 && (
          <button type="button" className={styles.clearBtn} onClick={clearAllFilters}>
            Wis filters
          </button>
        )}
      </div>

      <div className={styles.panelHeader} onClick={() => setFiltersExpanded((v) => !v)}>
        <span>Meer filters</span>
        <button
          type="button"
          className={filtersExpanded ? styles.collapseBtnOpen : styles.collapseBtn}
          onClick={(e) => {
            e.stopPropagation();
            setFiltersExpanded((v) => !v);
          }}
        >
          ▼
        </button>
      </div>

      {filtersExpanded && (
        <div className={styles.panelBody}>
          <div className={styles.searchRow}>
            <input
              type="text"
              placeholder="Zoek op naam, locatie, organisator..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Zoeken"
            />
          </div>

          {showShops && (
            <>
              <div className={styles.groupLabel}>Dieetwensen</div>
              <div className={styles.checkboxList}>
                {DIETARY_BADGES.map((b) => (
                  <label key={b.key} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={dietary.includes(b.key)}
                      onChange={() => setDietary((cur) => toggleInList(cur, b.key))}
                    />
                    <span>
                      {b.emoji} {b.label}
                    </span>
                    <span className={styles.checkboxCount}>{dietaryCounts[b.key]}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {showEvents && (
            <>
              <div className={styles.groupLabel}>Soort event</div>
              <div className={styles.checkboxList}>
                {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((key) => (
                  <label key={key} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={categories.includes(key)}
                      onChange={() => setCategories((cur) => toggleInList(cur, key))}
                    />
                    <span>
                      {EVENT_CATEGORIES[key].emoji} {EVENT_CATEGORIES[key].label}
                    </span>
                    <span className={styles.checkboxCount}>{categoryCounts[key]}</span>
                  </label>
                ))}
              </div>

              <div className={styles.groupLabel}>Wanneer</div>
              <div className={styles.checkboxList}>
                <label className={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={dateFilter === "today"}
                    onChange={() => setDateFilter((cur) => (cur === "today" ? null : "today"))}
                  />
                  <span>Vandaag</span>
                </label>
                <label className={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={dateFilter === "tomorrow"}
                    onChange={() => setDateFilter((cur) => (cur === "tomorrow" ? null : "tomorrow"))}
                  />
                  <span>Morgen</span>
                </label>
              </div>
              <div className={styles.datePickerAnchor}>
                <button
                  type="button"
                  className={isCustomDate ? styles.typeBtnActive : styles.typeBtn}
                  style={{ width: "100%" }}
                  onClick={() => setDatePickerOpen((v) => !v)}
                >
                  📅 {isCustomDate ? dateFilter : "Kies specifieke datum"}
                </button>
                <DatePickerPopover
                  open={datePickerOpen}
                  onClose={() => setDatePickerOpen(false)}
                  events={businessEvents}
                  today={today}
                  onSelectDate={setDateFilter}
                />
              </div>
            </>
          )}
        </div>
      )}

      <div className={styles.mobileFooter}>
        <button type="button" className={styles.mobileApplyBtn} onClick={onCloseMobile}>
          Toon resultaten
        </button>
      </div>
    </div>
    </Fragment>
  );
}
