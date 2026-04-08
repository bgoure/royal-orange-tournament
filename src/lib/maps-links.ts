/**
 * Build map URLs for Google Maps, Waze, and Apple Maps (web).
 * Coordinates are preferred when both are present.
 */
export function googleMapsUrl(lat: number | null, lon: number | null, query: string): string {
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function wazeUrl(lat: number | null, lon: number | null, query: string): string {
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(query)}`;
}

export function appleMapsUrl(lat: number | null, lon: number | null, query: string): string {
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(query)}`;
  }
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}
