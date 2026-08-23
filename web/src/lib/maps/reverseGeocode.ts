// Reverse-geocodes a lat/lng into a human-readable address via the Google
// Maps Geocoder — used by the admin long-press-to-add shortcut to pre-fill
// the shop form's address field. Falls back to a plain "lat, lng" string if
// the Geocoder finds nothing or errors, so the shortcut still works (the
// admin can just edit the address by hand) rather than blocking the flow.
export function reverseGeocode(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        resolve(results[0].formatted_address);
      } else {
        resolve(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      }
    });
  });
}
