// Table-QR geofence: a scanned table QR may only order when the customer's GPS fix is
// within the branch's `tableQrMaxDistanceMeters` (default 300 m). Shared by the customer
// web (CustomerMenu QR mode) and the orders API (server-side re-check).

export const DEFAULT_TABLE_QR_RADIUS_METERS = 300;

const CITY_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  Islamabad: { lat: 33.7215, lng: 73.0552 },
  Karachi: { lat: 24.8252, lng: 67.0305 },
  Lahore: { lat: 31.5126, lng: 74.3436 },
};

/** Haversine distance in whole meters. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function resolveBranchCoords(branch: {
  latitude?: number | string | null;
  longitude?: number | string | null;
  city?: string | null;
}): { lat: number; lng: number } {
  const lat = Number(branch.latitude);
  const lng = Number(branch.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
  return CITY_FALLBACK_COORDS[String(branch.city || '')] || CITY_FALLBACK_COORDS.Lahore;
}

export function resolveTableQrRadius(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TABLE_QR_RADIUS_METERS;
}

export function isValidGeoPoint(p: unknown): p is { lat: number; lng: number } {
  if (!p || typeof p !== 'object') return false;
  const { lat, lng } = p as { lat: unknown; lng: unknown };
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}
