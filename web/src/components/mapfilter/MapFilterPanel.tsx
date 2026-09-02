"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { DIETARY_BADGES } from "@/lib/shops/socialAndDietary";
import { EVENT_CATEGORIES } from "@/lib/events/eventHelpers";
import { DatePickerPopover } from "./DatePickerPopover";
import { filterShops, filterEvents, toggleInList } from "@/lib/filters/filterHelpers";
import { photoVariantUrl } from "@/lib/photos/photoVariants";
import { trackEvent } from "@/lib/analytics/trackEvent";
import type { MapFilterState, MapFilterActions } from "@/hooks/useMapFilterState";
import type { Shop } from "@/types/shops";
import type { BusinessEvent, EventCategory, UmbrellaEvent } from "@/types/events";
import styles from "./MapFilterPanel.module.css";

// Stable references (not fresh `[]` literals on every render) — feeding a
// new array identity into onFilteredResultsChange's effect below on every
// render, while its parent's state setter always sees a "changed" value and
// re-renders in response, is a real infinite render loop, not just wasted
// work: every render recomputes a new [] when a side is hidden, the effect's
// dependency array sees that as changed and fires, the parent's setState
// gets a new (if empty) array reference and re-renders, and the cycle never
// settles. Confirmed via MapExperience.test.tsx hanging/OOMing whenever a
// scenario hides shops or events (Events-only, or a groot event selected).
const EMPTY_SHOPS: Shop[] = [];
const EMPTY_EVENTS: BusinessEvent[] = [];

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
  // Shared with the hamburger menu (MenuModal) via a single lifted hook in
  // MapExperience — the prototype's activeContentTypes/activeDietaryFilters/
  // etc. sets are ONE shared state read by both surfaces, not two
  // independent copies. See useMapFilterState's own doc comment.
  filterState: MapFilterState & MapFilterActions;
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
  filterState,
}: MapFilterPanelProps) {
  const {
    contentType,
    setContentType,
    query,
    setQuery,
    dietary,
    setDietary,
    categories,
    setCategories,
    umbrellaFilter,
    setUmbrellaFilter,
    dateFilter,
    setDateFilter,
    clearAll,
  } = filterState;
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // A groot event (umbrella) never contains shops, so filtering on one hides
  // shops entirely, regardless of the Broodjes/Events toggle — mirrors the
  // prototype's showsBroodjes().
  const showShops = contentType !== "events" && !umbrellaFilter;
  const showEvents = contentType !== "broodjes";
  const today = new Date().toISOString().slice(0, 10);
  const isCustomDate = dateFilter !== null && dateFilter !== "today" && dateFilter !== "tomorrow";

  // Search+dietary-filtered shops / fully-filtered events, computed
  // independent of the Broodjes/Events toggle so button badges and
  // zero-result hiding below stay accurate even while a type is hidden.
  const shopsFinal = useMemo(() => filterShops(shops, { query, dietary }), [shops, query, dietary]);
  const eventsFinal = useMemo(
    () => filterEvents(businessEvents, { query, categories, umbrellaEventId: umbrellaFilter, dateFilter, today }),
    [businessEvents, query, categories, umbrellaFilter, dateFilter, today],
  );

  const filteredShops = showShops ? shopsFinal : EMPTY_SHOPS;
  const filteredEvents = showEvents ? eventsFinal : EMPTY_EVENTS;

  useEffect(() => {
    onFilteredResultsChange(filteredShops, filteredEvents);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredShops, filteredEvents]);

  const resultsCount = filteredShops.length + filteredEvents.length;
  // Matches the prototype's activeFilterCount, which counts the
  // Broodjes/Events toggle itself as an active filter, not just the "Meer
  // filters" body's own selections.
  const activeFilterCount =
    (contentType !== "alles" ? 1 : 0) +
    dietary.length +
    categories.length +
    (umbrellaFilter ? 1 : 0) +
    (dateFilter ? 1 : 0) +
    (query.trim() ? 1 : 0);


  const shopsMatchingSearch = useMemo(() => filterShops(shops, { query, dietary: [] }), [shops, query]);
  const dietaryCounts = Object.fromEntries(
    DIETARY_BADGES.map((b) => [b.key, shopsMatchingSearch.filter((s) => s.dietaryOptions?.[b.key]).length]),
  );
  // Category counts respect the currently active date filter (matching the
  // prototype's matchesEventDateFilter check on categoryRows) — only the
  // category being counted itself is left unconstrained.
  const categoryCounts = Object.fromEntries(
    (Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((key) => [
      key,
      filterEvents(businessEvents, { query, categories: [], umbrellaEventId: umbrellaFilter, dateFilter, today }).filter(
        (e) => e.category === key,
      ).length,
    ]),
  );
  const vandaagCount = filterEvents(businessEvents, {
    query,
    categories,
    umbrellaEventId: umbrellaFilter,
    dateFilter: "today",
    today,
  }).length;
  const morgenCount = filterEvents(businessEvents, {
    query,
    categories,
    umbrellaEventId: umbrellaFilter,
    dateFilter: "tomorrow",
    today,
  }).length;

  // Hide a filter option once it would yield zero results, unless it's the
  // one currently active (otherwise you couldn't turn it back off) — mirrors
  // the prototype's renderMapFilterPanel() visibility rules throughout.
  const showBroodjesBtn = shopsFinal.length > 0 || contentType === "broodjes";
  const showEventsBtn = eventsFinal.length > 0 || contentType === "events";
  const visibleDietaryBadges = DIETARY_BADGES.filter((b) => dietaryCounts[b.key] > 0 || dietary.includes(b.key));
  const visibleCategories = (Object.keys(EVENT_CATEGORIES) as EventCategory[]).filter(
    (key) => categoryCounts[key] > 0 || categories.includes(key),
  );
  const showVandaag = vandaagCount > 0 || dateFilter === "today";
  const showMorgen = morgenCount > 0 || dateFilter === "tomorrow";

  const visibleUmbrellas = umbrellaEvents
    .filter((u) => u.endDate >= today)
    .map((u) => ({
      u,
      count: filterEvents(businessEvents, { query, categories, umbrellaEventId: u.id, dateFilter, today }).length,
    }))
    .filter(({ count, u }) => count > 0 || umbrellaFilter === u.id);

  return (
    <Fragment>
      {!mobileOpen && (
        <button
          type="button"
          className={`${styles.mobileToggle} ${activeFilterCount > 0 ? styles.mobileToggleActive : ""}`}
          onClick={onOpenMobile}
          // Active filters colour the button itself rather than hanging a
          // count badge off it. The count is still worth having for screen
          // readers, which get no signal from a background colour, so it
          // moves into the accessible name.
          aria-label={activeFilterCount > 0 ? `Filters (${activeFilterCount} actief)` : "Filters"}
        >
          🔍 Filters
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
        {showBroodjesBtn && (
          <button
            type="button"
            className={contentType === "broodjes" ? styles.typeBtnActive : styles.typeBtn}
            onClick={() => setContentType((c) => (c === "broodjes" ? "alles" : "broodjes"))}
          >
            🥪 Broodjes <span className={styles.count}>({shopsFinal.length})</span>
          </button>
        )}
        {showEventsBtn && (
          <button
            type="button"
            className={contentType === "events" ? styles.typeBtnActive : styles.typeBtn}
            onClick={() => setContentType((c) => (c === "events" ? "alles" : "events"))}
          >
            🎉 Events <span className={styles.count}>({eventsFinal.length})</span>
          </button>
        )}
      </div>

      {showEvents && visibleUmbrellas.length > 0 && (
        <div className={styles.umbrellaPills}>
          {visibleUmbrellas.map(({ u }) => (
            <button
              key={u.id}
              type="button"
              className={umbrellaFilter === u.id ? styles.umbrellaPillActive : styles.umbrellaPill}
              style={
                u.photoUrl
                  ? { backgroundImage: `url(${photoVariantUrl(u.photoUrl, "thumb")})` }
                  : { background: u.color }
              }
              onClick={() => {
                trackEvent("filter_applied", { filter_type: "umbrella" });
                setUmbrellaFilter(umbrellaFilter === u.id ? null : u.id);
              }}
            >
              <span className={styles.umbrellaPillLabel}>{u.title}</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.resultsRow}>
        <span>{resultsCount} resultaten</span>
        {activeFilterCount > 0 && (
          <button type="button" className={styles.clearBtn} onClick={clearAll}>
            Wis filters
          </button>
        )}
      </div>

      <div className={styles.panelHeader} onClick={() => setFiltersExpanded((v) => !v)}>
        <span>Meer filters</span>
        <button
          type="button"
          className={filtersExpanded ? styles.collapseBtnOpen : styles.collapseBtn}
          aria-label="Meer filters"
          aria-expanded={filtersExpanded}
          onClick={(e) => {
            e.stopPropagation();
            setFiltersExpanded((v) => !v);
          }}
        >
          ▼
        </button>
      </div>

      {/* On mobile the "Meer filters" header/toggle is hidden entirely (see
          MapFilterPanel.module.css) — the open full-screen sheet always shows
          the body, ignoring the desktop collapse state, mirroring the
          prototype's #mapFilterPanelBody forced `display:block!important`
          under `.mobile-open`. */}
      {(filtersExpanded || mobileOpen) && (
        <div className={styles.panelBody}>
          <div className={styles.searchRow}>
            <input
              type="text"
              placeholder="Zoek op naam, locatie, organisator..."
              value={query}
              onChange={(e) => {
                // Fires once per fresh search (the empty->first-character
                // transition), not on every keystroke — a per-keystroke
                // event would be pure noise for "was search used" analysis.
                if (query === "" && e.target.value !== "") trackEvent("search_used");
                setQuery(e.target.value);
              }}
              aria-label="Zoeken"
            />
          </div>

          {showShops && (
            <>
              <div className={styles.groupLabel}>Dieetwensen</div>
              <div className={styles.checkboxList}>
                {visibleDietaryBadges.map((b) => (
                  <label key={b.key} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={dietary.includes(b.key)}
                      onChange={() => {
                        trackEvent("filter_applied", { filter_type: "dietary" });
                        setDietary((cur) => toggleInList(cur, b.key));
                      }}
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
                {visibleCategories.map((key) => (
                  <label key={key} className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={categories.includes(key)}
                      onChange={() => {
                        trackEvent("filter_applied", { filter_type: "category" });
                        setCategories((cur) => toggleInList(cur, key));
                      }}
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
                {showVandaag && (
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={dateFilter === "today"}
                      onChange={() => {
                        trackEvent("filter_applied", { filter_type: "date" });
                        setDateFilter((cur) => (cur === "today" ? null : "today"));
                      }}
                    />
                    <span>Vandaag</span>
                    <span className={styles.checkboxCount}>({vandaagCount})</span>
                  </label>
                )}
                {showMorgen && (
                  <label className={styles.checkboxItem}>
                    <input
                      type="checkbox"
                      checked={dateFilter === "tomorrow"}
                      onChange={() => {
                        trackEvent("filter_applied", { filter_type: "date" });
                        setDateFilter((cur) => (cur === "tomorrow" ? null : "tomorrow"));
                      }}
                    />
                    <span>Morgen</span>
                    <span className={styles.checkboxCount}>({morgenCount})</span>
                  </label>
                )}
              </div>
              <div className={styles.datePickerRow}>
                <DatePickerPopover
                  triggerClassName={isCustomDate ? styles.typeBtnActive : styles.typeBtn}
                  triggerLabel={`📅 ${isCustomDate ? dateFilter : "Kies specifieke datum"}`}
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
