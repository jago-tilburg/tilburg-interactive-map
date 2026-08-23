import { describe, it, expect } from "vitest";
import {
  EVENT_CATEGORIES,
  categoryOf,
  dateRangeArray,
  formatBusinessEventSchedule,
  extractCoordsFromMapsUrl,
  isMultiDay,
  activeUmbrellaEvents,
  businessEventStatusLabel,
} from "@/lib/events/eventHelpers";

describe("categoryOf", () => {
  it("returns the matching category", () => {
    expect(categoryOf("muziek")).toEqual(EVENT_CATEGORIES.muziek);
  });

  it("falls back to 'anders' for an unknown category", () => {
    expect(categoryOf("unknown")).toEqual(EVENT_CATEGORIES.anders);
  });
});

describe("dateRangeArray", () => {
  it("returns a single-element array for a same-day range", () => {
    expect(dateRangeArray("2026-09-01", "2026-09-01")).toEqual(["2026-09-01"]);
  });

  it("returns an inclusive list across multiple days", () => {
    expect(dateRangeArray("2026-09-01", "2026-09-03")).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
    ]);
  });

  it("stays correct across a month boundary regardless of local timezone", () => {
    expect(dateRangeArray("2026-08-30", "2026-09-01")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
    ]);
  });
});

describe("formatBusinessEventSchedule", () => {
  it("formats a single-day event with a single time range", () => {
    expect(
      formatBusinessEventSchedule({
        startDate: "2026-09-01",
        endDate: "2026-09-01",
        startTime: "10:00",
        endTime: "18:00",
      }),
    ).toBe("2026-09-01 · 10:00–18:00");
  });

  it("formats a multi-day event with a shared time range", () => {
    expect(
      formatBusinessEventSchedule({
        startDate: "2026-09-01",
        endDate: "2026-09-03",
        startTime: "10:00",
        endTime: "18:00",
      }),
    ).toBe("2026-09-01 t/m 2026-09-03 · 10:00–18:00");
  });

  it("formats per-day times, sorted by date, when dailyTimes is present", () => {
    expect(
      formatBusinessEventSchedule({
        startDate: "2026-09-01",
        endDate: "2026-09-02",
        startTime: "10:00",
        endTime: "18:00",
        dailyTimes: {
          "2026-09-02": { startTime: "12:00", endTime: "20:00" },
          "2026-09-01": { startTime: "09:00", endTime: "17:00" },
        },
      }),
    ).toBe("2026-09-01 t/m 2026-09-02 · 2026-09-01: 09:00–17:00, 2026-09-02: 12:00–20:00");
  });

  it("ignores an empty dailyTimes object and falls back to the single range", () => {
    expect(
      formatBusinessEventSchedule({
        startDate: "2026-09-01",
        endDate: "2026-09-01",
        startTime: "10:00",
        endTime: "18:00",
        dailyTimes: {},
      }),
    ).toBe("2026-09-01 · 10:00–18:00");
  });
});

describe("extractCoordsFromMapsUrl", () => {
  it("returns null for an empty url", () => {
    expect(extractCoordsFromMapsUrl("")).toBeNull();
  });

  it("extracts coords from an @lat,lng pattern", () => {
    expect(extractCoordsFromMapsUrl("https://maps.google.com/@51.5555,5.0913,15z")).toEqual({
      lat: 51.5555,
      lng: 5.0913,
    });
  });

  it("extracts coords from a place/…/@lat,lng permalink", () => {
    expect(
      extractCoordsFromMapsUrl("https://maps.google.com/maps/place/Heuvelplein/@51.5555,5.0913,17z"),
    ).toEqual({ lat: 51.5555, lng: 5.0913 });
  });

  it("extracts coords from an ll= query param", () => {
    expect(extractCoordsFromMapsUrl("https://maps.google.com/?ll=51.5555,5.0913")).toEqual({
      lat: 51.5555,
      lng: 5.0913,
    });
  });

  it("extracts coords from a q= query param", () => {
    expect(extractCoordsFromMapsUrl("https://maps.google.com/?q=51.5555,5.0913")).toEqual({
      lat: 51.5555,
      lng: 5.0913,
    });
  });

  it("returns null when no pattern matches", () => {
    expect(extractCoordsFromMapsUrl("https://example.com/not-a-maps-link")).toBeNull();
  });

  it("returns null instead of throwing when given a truthy non-string value", () => {
    expect(extractCoordsFromMapsUrl(12345 as unknown as string)).toBeNull();
  });
});

describe("isMultiDay", () => {
  it("is false for a same-day range or missing dates", () => {
    expect(isMultiDay("2026-09-01", "2026-09-01")).toBe(false);
    expect(isMultiDay("", "")).toBe(false);
  });

  it("is true when start and end differ", () => {
    expect(isMultiDay("2026-09-01", "2026-09-02")).toBe(true);
  });
});

describe("activeUmbrellaEvents", () => {
  it("keeps only umbrella events that haven't ended yet", () => {
    const umbrellas = [{ endDate: "2026-01-01" }, { endDate: "2026-12-31" }];
    expect(activeUmbrellaEvents(umbrellas, "2026-06-01")).toEqual([{ endDate: "2026-12-31" }]);
  });
});

describe("businessEventStatusLabel", () => {
  it("maps each status to its Dutch label", () => {
    expect(businessEventStatusLabel("approved")).toBe("Goedgekeurd");
    expect(businessEventStatusLabel("rejected")).toBe("Afgewezen");
    expect(businessEventStatusLabel("pending")).toBe("In afwachting");
  });
});
