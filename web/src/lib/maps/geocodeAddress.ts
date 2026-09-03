export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

const PDOK_FREE_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

// Forward-geocodes a Dutch postcode + huisnummer into coordinates and a
// full street-level address via PDOK's free Locatieserver API (Kadaster's
// official BAG address register — no API key, CORS-open: confirmed
// `Access-Control-Allow-Origin: *`). Used by the business event form's
// "Zoek adres" button.
//
// Previously used the Google Maps Geocoder here instead — replaced
// 2026-09-03 after a live bug report (postcode+huisnummer only ever
// resolving to "<postcode> <city>", no street/house number at all).
// Investigated empirically against the real Geocoder: every query shape
// tried (postcode+number with/without space, dash-joined, reversed,
// componentRestrictions vs. region bias, structured postalCode
// restriction) resolved to postal_code-level precision only, across
// three different real Tilburg postcodes — not a formatting fluke, the
// Geocoder's free-text parser just isn't built to combine a bare NL
// postal code with a trailing house number into a street_address result.
// (Geocoding a known street name + number, e.g. "Heuvelplein 12,
// Tilburg", worked fine — the gap is specific to postcode+number input.)
// PDOK is purpose-built for exactly this lookup and is what Dutch sites
// generally use for it instead of Google for this reason.
//
// Filters to an EXACT match on both postcode and house number (`fq=`,
// Solr filter queries — hard constraints, not relevance ranking) rather
// than putting them in the free-text `q` and relying on ranking to sort
// the right one to the top. This was a real bug found and fixed the same
// day this file was written: with only `fq=huisnummer:` and the postcode
// left in free-text `q`, a nonexistent combination (a real postcode with
// a house number that isn't actually on that postcode) didn't resolve to
// "not found" — it silently matched some *entirely different, unrelated*
// address elsewhere in the Netherlands that happened to share that house
// number and score tolerably on loose text similarity (reproduced live:
// postcode 5045PZ + huisnummer 12, which doesn't exist, returned an
// address in Lelystad, ~130km away). Hard-filtering both fields means a
// nonexistent combination correctly returns zero results instead of a
// wrong real address in a different city. `q=*` is Solr's match-all
// wildcard — no free-text relevance ranking is needed once both fields
// are exact filters.
//
// Resolves null (never throws) on no results, a non-numeric huisnummer,
// or any error, so callers don't need a separate error-handling path.
export async function geocodeAddress(postcode: string, huisnummer: string): Promise<GeocodeResult | null> {
  const normalizedPostcode = postcode.replace(/\s+/g, "").toUpperCase();
  const numericHuisnummer = huisnummer.match(/^\d+/)?.[0];
  if (!normalizedPostcode || !numericHuisnummer) return null;

  const url = new URL(PDOK_FREE_URL);
  url.searchParams.set("q", "*");
  url.searchParams.append("fq", "type:adres");
  url.searchParams.append("fq", `postcode:${normalizedPostcode}`);
  url.searchParams.append("fq", `huisnummer:${numericHuisnummer}`);
  url.searchParams.set("rows", "1");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = await response.json();
    const doc = data?.response?.docs?.[0];
    if (!doc || typeof doc.weergavenaam !== "string") return null;

    // PDOK returns the centroid as WKT "POINT(lon lat)" — note the
    // longitude-first order, the opposite of this app's lat/lng convention.
    const match = /^POINT\(([-\d.]+) ([-\d.]+)\)$/.exec(doc.centroide_ll ?? "");
    if (!match) return null;

    return {
      lat: Number(match[2]),
      lng: Number(match[1]),
      formattedAddress: doc.weergavenaam,
    };
  } catch {
    return null;
  }
}
