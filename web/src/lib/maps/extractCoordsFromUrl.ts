export interface Coords {
  lat: number;
  lng: number;
}

// Extracts lat/lng from a pasted Google Maps URL, trying the same patterns
// (in the same order) as the original app: @lat,lng, a place/…/@lat,lng
// permalink, ll=, and q=. Shared by the shop form and business event form —
// both offer the same "paste a Maps link, extract coordinates" affordance.
export function extractCoordsFromMapsUrl(url: string): Coords | null {
  if (!url) return null;
  try {
    let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    match = url.match(/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    /* v8 ignore next 3 -- unreachable as ported: any URL matching this place/…/@lat,lng
       pattern also contains the same @lat,lng substring the unanchored regex above
       already matches first, so this branch never fires. Inherited verbatim from the
       original app's extractCoordsFromUrl(); kept for behavioral parity, not fixed here. */
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    match = url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    match = url.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

    return null;
  } catch {
    return null;
  }
}
