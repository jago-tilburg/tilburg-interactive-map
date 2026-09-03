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
// Filters to an exact numeric house-number match (`fq=huisnummer:`)
// rather than relying on free-text relevance ranking — confirmed via the
// same investigation that an ranking-only match can silently return a
// *different*, nearby real address when the requested number doesn't
// exist, which would be worse than "not found".
//
// Resolves null (never throws) on no results, a non-numeric huisnummer,
// or any error, so callers don't need a separate error-handling path.
export async function geocodeAddress(postcode: string, huisnummer: string): Promise<GeocodeResult | null> {
  const normalizedPostcode = postcode.replace(/\s+/g, "").toUpperCase();
  const numericHuisnummer = huisnummer.match(/^\d+/)?.[0];
  if (!normalizedPostcode || !numericHuisnummer) return null;

  const url = new URL(PDOK_FREE_URL);
  url.searchParams.set("q", `${normalizedPostcode} ${huisnummer}`);
  url.searchParams.append("fq", "type:adres");
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
