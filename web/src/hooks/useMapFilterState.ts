"use client";

import { useCallback, useMemo, useState } from "react";
import type { ContentTypeFilter, DietaryKey, DateQuickFilter } from "@/lib/filters/filterHelpers";
import type { EventCategory } from "@/types/events";

export interface MapFilterState {
  contentType: ContentTypeFilter;
  query: string;
  dietary: DietaryKey[];
  categories: EventCategory[];
  umbrellaFilter: string | null;
  dateFilter: DateQuickFilter;
}

export interface MapFilterActions {
  setContentType: (v: ContentTypeFilter | ((cur: ContentTypeFilter) => ContentTypeFilter)) => void;
  setQuery: (v: string | ((cur: string) => string)) => void;
  setDietary: (v: DietaryKey[] | ((cur: DietaryKey[]) => DietaryKey[])) => void;
  setCategories: (v: EventCategory[] | ((cur: EventCategory[]) => EventCategory[])) => void;
  setUmbrellaFilter: (v: string | null | ((cur: string | null) => string | null)) => void;
  setDateFilter: (v: DateQuickFilter | ((cur: DateQuickFilter) => DateQuickFilter)) => void;
  // Mirrors the prototype's setDietaryFilter(): a "preset" entry point (used
  // by the hamburger menu's single-row pills) that writes into the SAME
  // underlying multi-select set the map filter panel's checkboxes use —
  // 'all' clears it, any specific key replaces it with just that one key.
  setDietaryPreset: (key: DietaryKey | "all") => void;
  clearAll: () => void;
}

// Single source of truth for the filter state the prototype shares between
// its floating map filter panel and its hamburger-menu list (both read/write
// the same activeContentTypes/activeDietaryFilters/etc. sets there — see
// MapFilterPanel's and MenuModal's own comments for the divergence this
// hook fixes). Lifted here so MapExperience can hand the same state to both.
export function useMapFilterState(): MapFilterState & MapFilterActions {
  const [contentType, setContentType] = useState<ContentTypeFilter>("alles");
  const [query, setQuery] = useState("");
  const [dietary, setDietary] = useState<DietaryKey[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [umbrellaFilter, setUmbrellaFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateQuickFilter>(null);

  const setDietaryPreset = useCallback((key: DietaryKey | "all") => {
    setDietary(key === "all" ? [] : [key]);
  }, []);

  // Mirrors clearAllMapFilters(), which also resets activeContentTypes.
  const clearAll = useCallback(() => {
    setContentType("alles");
    setQuery("");
    setDietary([]);
    setCategories([]);
    setUmbrellaFilter(null);
    setDateFilter(null);
  }, []);

  // Memoized so MapFilterPanel/Header/MenuModal only see a new `filterState`
  // reference when a value inside it actually changed, not on every render
  // of their common ancestor (MapExperience) for unrelated reasons.
  return useMemo(
    () => ({
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
      setDietaryPreset,
      clearAll,
    }),
    [contentType, query, dietary, categories, umbrellaFilter, dateFilter, setDietaryPreset, clearAll],
  );
}
