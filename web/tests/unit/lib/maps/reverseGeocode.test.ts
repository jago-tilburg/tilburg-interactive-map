import { describe, it, expect, vi, beforeEach } from "vitest";
import { reverseGeocode } from "@/lib/maps/reverseGeocode";

const geocode = vi.fn();

beforeEach(() => {
  geocode.mockReset();
  window.google = {
    maps: {
      Geocoder: function Geocoder(this: { geocode: typeof geocode }) {
        this.geocode = geocode;
      },
    },
  } as never;
});

describe("reverseGeocode", () => {
  it("resolves the formatted address on a successful lookup", async () => {
    geocode.mockImplementation((_req, cb) => {
      cb([{ formatted_address: "Heuvelplein 1, Tilburg" }], "OK");
    });

    await expect(reverseGeocode(51.5555, 5.0913)).resolves.toBe("Heuvelplein 1, Tilburg");
  });

  it("falls back to a lat/lng string when the status is not OK", async () => {
    geocode.mockImplementation((_req, cb) => {
      cb(null, "ZERO_RESULTS");
    });

    await expect(reverseGeocode(51.5555, 5.0913)).resolves.toBe("51.555500, 5.091300");
  });

  it("falls back to a lat/lng string when there are no results", async () => {
    geocode.mockImplementation((_req, cb) => {
      cb([], "OK");
    });

    await expect(reverseGeocode(51.5, 5.09)).resolves.toBe("51.500000, 5.090000");
  });
});
