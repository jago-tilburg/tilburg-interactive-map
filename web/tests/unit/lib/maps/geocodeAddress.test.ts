import { describe, it, expect, vi, beforeEach } from "vitest";
import { geocodeAddress } from "@/lib/maps/geocodeAddress";

const fetchMock = vi.fn();

function pdokResponse(docs: unknown[]) {
  return { response: { docs } };
}

function fakeDoc(overrides: Record<string, unknown> = {}) {
  return {
    weergavenaam: "Heuvelplein 12, 5038 AB Tilburg",
    centroide_ll: "POINT(5.0913 51.5555)",
    huisnummer: 12,
    postcode: "5038AB",
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("geocodeAddress", () => {
  it("resolves lat/lng and the full street-level address on a successful lookup", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => pdokResponse([fakeDoc()]) });

    await expect(geocodeAddress("5038 AB", "12")).resolves.toEqual({
      lat: 51.5555,
      lng: 5.0913,
      formattedAddress: "Heuvelplein 12, 5038 AB Tilburg",
    });
  });

  it("queries PDOK with a normalized postcode and an exact numeric huisnummer filter", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => pdokResponse([fakeDoc()]) });

    await geocodeAddress("5038 ab", "12");

    const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.origin + requestedUrl.pathname).toBe(
      "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free",
    );
    expect(requestedUrl.searchParams.get("q")).toBe("5038AB 12");
    expect(requestedUrl.searchParams.getAll("fq")).toEqual(["type:adres", "huisnummer:12"]);
  });

  it("resolves null when huisnummer has no leading digits (never calls PDOK)", async () => {
    await expect(geocodeAddress("5038 AB", "abc")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves null when postcode is empty", async () => {
    await expect(geocodeAddress("", "12")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves null when PDOK returns zero results (e.g. the huisnummer doesn't exist)", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => pdokResponse([]) });
    await expect(geocodeAddress("5038 AB", "9999")).resolves.toBeNull();
  });

  it("resolves null when the HTTP response is not ok", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(geocodeAddress("5038 AB", "12")).resolves.toBeNull();
  });

  it("resolves null when the centroid can't be parsed", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => pdokResponse([fakeDoc({ centroide_ll: "garbage" })]) });
    await expect(geocodeAddress("5038 AB", "12")).resolves.toBeNull();
  });

  it("resolves null when fetch itself throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(geocodeAddress("5038 AB", "12")).resolves.toBeNull();
  });
});
