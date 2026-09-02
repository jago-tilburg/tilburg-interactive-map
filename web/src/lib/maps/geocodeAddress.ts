export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

// Forward-geocodes a Dutch postcode + huisnummer into coordinates and a
// formatted address via the Google Maps Geocoder — the other direction of
// reverseGeocode.ts's lat/lng-to-address lookup, same technique, no new
// dependency. Used by the business event form's "Zoek adres" button.
// Resolves null (never throws) on no results or an error, so callers don't
// need a separate error-handling path — same contract as reverseGeocode,
// just without a fallback value to resolve with, since there's nothing
// sensible to derive coordinates from here if the lookup fails.
export function geocodeAddress(postcode: string, huisnummer: string): Promise<GeocodeResult | null> {
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode(
      { address: `${postcode} ${huisnummer}`, componentRestrictions: { country: "nl" } },
      (results, status) => {
        if (status === "OK" && results && results[0]) {
          resolve({
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
            formattedAddress: results[0].formatted_address,
          });
        } else {
          resolve(null);
        }
      },
    );
  });
}
