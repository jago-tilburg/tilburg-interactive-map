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

  it("queries PDOK with hard filters on type, postcode, and exact numeric huisnummer (not free-text ranking)", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => pdokResponse([fakeDoc()]) });

    await geocodeAddress("5038 ab", "12");

    const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.origin + requestedUrl.pathname).toBe(
      "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free",
    );
    expect(requestedUrl.searchParams.get("q")).toBe("*");
    expect(requestedUrl.searchParams.getAll("fq")).toEqual(["type:adres", "postcode:5038AB", "huisnummer:12"]);
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

  // Regression test for a real bug found and fixed the same day this file
  // was written: with postcode only in the free-text `q` (not also a hard
  // `fq` filter), a nonexistent postcode+huisnummer combination didn't
  // resolve to null — it silently matched a real but *entirely unrelated*
  // address elsewhere in the Netherlands that happened to share the house
  // number and score tolerably on loose text similarity. This asserts the
  // mock never has a legitimate way to return anything for a combination
  // that doesn't exist as a document — the hard postcode+huisnummer fq
  // filters are what guarantee that, not this test alone (see geocodeAddress.ts).
  it("resolves null, not a wrong address, when the postcode+huisnummer combination doesn't exist together", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => pdokResponse([]) });
    await expect(geocodeAddress("5045PZ", "12")).resolves.toBeNull();
    const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.searchParams.getAll("fq")).toContain("postcode:5045PZ");
    expect(requestedUrl.searchParams.getAll("fq")).toContain("huisnummer:12");
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
