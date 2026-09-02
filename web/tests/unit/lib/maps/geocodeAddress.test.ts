import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeAddress } from "@/lib/maps/geocodeAddress";

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

describe("geocodeAddress", () => {
  it("resolves lat/lng and the formatted address on a successful lookup", async () => {
    geocode.mockImplementation((req, cb) => {
      expect(req).toEqual({ address: "5038 AB 12", componentRestrictions: { country: "nl" } });
      cb(
        [
          {
            formatted_address: "Heuvelplein 12, 5038 AB Tilburg",
            geometry: { location: { lat: () => 51.5555, lng: () => 5.0913 } },
          },
        ],
        "OK",
      );
    });

    await expect(geocodeAddress("5038 AB", "12")).resolves.toEqual({
      lat: 51.5555,
      lng: 5.0913,
      formattedAddress: "Heuvelplein 12, 5038 AB Tilburg",
    });
  });

  it("resolves null when the status is not OK", async () => {
    geocode.mockImplementation((_req, cb) => {
      cb(null, "ZERO_RESULTS");
    });

    await expect(geocodeAddress("0000 ZZ", "1")).resolves.toBeNull();
  });

  it("resolves null when there are no results", async () => {
    geocode.mockImplementation((_req, cb) => {
      cb([], "OK");
    });

    await expect(geocodeAddress("0000 ZZ", "1")).resolves.toBeNull();
  });
});
