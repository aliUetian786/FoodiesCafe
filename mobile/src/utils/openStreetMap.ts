export interface OsmCoordinates {
  lat: number;
  lng: number;
}

export type OsmMarkerKind =
  | 'branch'
  | 'selected_branch'
  | 'customer'
  | 'delivery_pin'
  | 'rider_stop';

export interface OsmMarkerItem {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  kind?: OsmMarkerKind;
  badgeText?: string;
}

export interface OsmSearchResult {
  placeId: string;
  displayName: string;
  shortAddress: string;
  city: string;
  lat: number;
  lng: number;
}

export interface OsmReverseGeocodeResult {
  address: string;
  city: string;
  area?: string;
}

export const OSM_TILE_SIZE = 256;
export const OSM_DEFAULT_CENTER: OsmCoordinates = { lat: 31.5204, lng: 74.3587 };

export const LOCAL_PAKISTAN_LANDMARKS: OsmSearchResult[] = [
  {
    placeId: 'pk-lhr-gulberg',
    displayName: 'Main Boulevard Gulberg III, Lahore, Punjab, Pakistan',
    shortAddress: 'Main Boulevard Gulberg III, Lahore',
    city: 'Lahore',
    lat: 31.5204,
    lng: 74.3587,
  },
  {
    placeId: 'pk-lhr-dha',
    displayName: 'Y-Block Commercial, DHA Phase 3, Lahore, Punjab, Pakistan',
    shortAddress: 'Y-Block Commercial, DHA Phase 3, Lahore',
    city: 'Lahore',
    lat: 31.4697,
    lng: 74.3762,
  },
  {
    placeId: 'pk-lhr-johar',
    displayName: 'G1 Market, Johar Town, Lahore, Punjab, Pakistan',
    shortAddress: 'G1 Market, Johar Town, Lahore',
    city: 'Lahore',
    lat: 31.469,
    lng: 74.2728,
  },
  {
    placeId: 'pk-lhr-modeltown',
    displayName: 'Model Town C Block, Lahore, Punjab, Pakistan',
    shortAddress: 'C Block Commercial, Model Town, Lahore',
    city: 'Lahore',
    lat: 31.4832,
    lng: 74.3247,
  },
  {
    placeId: 'pk-lhr-bahria',
    displayName: 'Talwar Chowk, Bahria Town, Lahore, Punjab, Pakistan',
    shortAddress: 'Talwar Chowk, Bahria Town, Lahore',
    city: 'Lahore',
    lat: 31.3679,
    lng: 74.1815,
  },
  {
    placeId: 'pk-khi-clifton',
    displayName: 'Boat Basin, Clifton Block 5, Karachi, Sindh, Pakistan',
    shortAddress: 'Boat Basin, Clifton Block 5, Karachi',
    city: 'Karachi',
    lat: 24.8138,
    lng: 67.0299,
  },
  {
    placeId: 'pk-khi-dha',
    displayName: 'Bukhari Commercial, DHA Phase 6, Karachi, Sindh, Pakistan',
    shortAddress: 'Bukhari Commercial, DHA Phase 6, Karachi',
    city: 'Karachi',
    lat: 24.7916,
    lng: 67.0644,
  },
  {
    placeId: 'pk-isb-f7',
    displayName: 'Jinnah Super Market, Sector F-7 Markaz, Islamabad, Pakistan',
    shortAddress: 'F-7 Markaz, Jinnah Super, Islamabad',
    city: 'Islamabad',
    lat: 33.7215,
    lng: 73.0561,
  },
  {
    placeId: 'pk-rwp-saddar',
    displayName: 'Bank Road, Saddar, Rawalpindi, Punjab, Pakistan',
    shortAddress: 'Bank Road, Saddar, Rawalpindi',
    city: 'Rawalpindi',
    lat: 33.5968,
    lng: 73.0528,
  },
  {
    placeId: 'pk-mux-cantt',
    displayName: 'Abdali Road, Multan Cantt, Multan, Punjab, Pakistan',
    shortAddress: 'Abdali Road, Multan Cantt, Multan',
    city: 'Multan',
    lat: 30.1978,
    lng: 71.4697,
  },
];

export function clampLatitude(lat: number): number {
  return Math.max(-85.05112878, Math.min(85.05112878, lat));
}

export function normalizeLongitude(lng: number): number {
  let normalized = lng;
  while (normalized < -180) normalized += 360;
  while (normalized > 180) normalized -= 360;
  return normalized;
}

export function latLngToWorldPixel(
  lat: number,
  lng: number,
  zoom: number
): { x: number; y: number } {
  const safeLat = clampLatitude(lat);
  const safeLng = normalizeLongitude(lng);
  const scale = OSM_TILE_SIZE * Math.pow(2, zoom);
  const x = ((safeLng + 180) / 360) * scale;
  const sinLat = Math.sin((safeLat * Math.PI) / 180);
  const clampedSin = Math.max(-0.999999, Math.min(0.999999, sinLat));
  const y =
    (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function worldPixelToLatLng(
  x: number,
  y: number,
  zoom: number
): OsmCoordinates {
  const scale = OSM_TILE_SIZE * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return {
    lat: Number(clampLatitude(lat).toFixed(6)),
    lng: Number(normalizeLongitude(lng).toFixed(6)),
  };
}

export function getOsmTileUrl(x: number, y: number, z: number): string {
  const tileCount = Math.pow(2, z);
  const wrappedX = ((x % tileCount) + tileCount) % tileCount;
  if (y < 0 || y >= tileCount) {
    return '';
  }

  // If a CARTO Basemaps API key is provided, use Carto Voyager with authorized key
  const cartoApiKey =
    (typeof process !== 'undefined' &&
      (process.env.EXPO_PUBLIC_CARTO_API_KEY ||
        process.env.NEXT_PUBLIC_CARTO_API_KEY ||
        process.env.CARTO_API_KEY)) ||
    '';

  if (cartoApiKey) {
    const subdomains = ['a', 'b', 'c', 'd'];
    const sub = subdomains[Math.abs(wrappedX + y) % subdomains.length];
    return `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${wrappedX}/${y}.png?key=${encodeURIComponent(cartoApiKey)}`;
  }

  // 100% FREE OpenStreetMap raster tiles (Zero API key required, zero watermark, fast caching)
  return `https://tile.openstreetmap.de/${z}/${wrappedX}/${y}.png`;
}

export function getOsmFallbackTileUrl(x: number, y: number, z: number): string {
  const tileCount = Math.pow(2, z);
  const wrappedX = ((x % tileCount) + tileCount) % tileCount;
  if (y < 0 || y >= tileCount) {
    return '';
  }
  // Humanitarian OpenStreetMap Team (HOT) fallback tiles (100% free, no API key required)
  const subdomains = ['a', 'b', 'c'];
  const sub = subdomains[Math.abs(wrappedX + y) % subdomains.length];
  return `https://${sub}.tile.openstreetmap.fr/hot/${z}/${wrappedX}/${y}.png`;
}

export function calculateHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function inferNearestFallbackArea(lat: number, lng: number): OsmReverseGeocodeResult {
  let nearest = LOCAL_PAKISTAN_LANDMARKS[0];
  let bestDist = Infinity;
  for (const item of LOCAL_PAKISTAN_LANDMARKS) {
    const d = calculateHaversineKm(lat, lng, item.lat, item.lng);
    if (d < bestDist) {
      bestDist = d;
      nearest = item;
    }
  }
  return {
    address: `Near ${nearest.shortAddress} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    city: nearest.city,
    area: nearest.shortAddress,
  };
}

function formatNominatimAddress(addrObj: Record<string, string> | undefined, displayName?: string): OsmReverseGeocodeResult {
  if (!addrObj) {
    return {
      address: displayName || 'Pinned Location',
      city: 'Lahore',
    };
  }
  const house = addrObj.house_number || '';
  const road =
    addrObj.road ||
    addrObj.pedestrian ||
    addrObj.residential ||
    addrObj.amenity ||
    addrObj.building ||
    '';
  const area =
    addrObj.suburb ||
    addrObj.neighbourhood ||
    addrObj.quarter ||
    addrObj.city_district ||
    addrObj.town ||
    '';
  const city =
    addrObj.city ||
    addrObj.town ||
    addrObj.village ||
    addrObj.state_district ||
    addrObj.county ||
    'Lahore';

  const streetPart = [house, road].filter(Boolean).join(' ').trim();
  const parts = [streetPart, area, city].filter(Boolean);
  const formatted = parts.length > 0 ? parts.join(', ') : displayName || city;

  return {
    address: formatted,
    city,
    area: area || undefined,
  };
}

export async function searchOpenStreetMap(query: string): Promise<OsmSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const localMatches = LOCAL_PAKISTAN_LANDMARKS.filter(
    (l) =>
      l.displayName.toLowerCase().includes(trimmed.toLowerCase()) ||
      l.shortAddress.toLowerCase().includes(trimmed.toLowerCase()) ||
      l.city.toLowerCase().includes(trimmed.toLowerCase())
  );

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&accept-language=en&q=${encodeURIComponent(
      trimmed
    )}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FoodiesCafeApp/1.0',
      },
      signal: controller ? controller.signal : undefined,
    });
    if (timeoutId) clearTimeout(timeoutId);
    if (!res.ok) return localMatches;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return localMatches;

    return data.map((item: any, idx: number): OsmSearchResult => {
      const formatted = formatNominatimAddress(item.address, item.display_name);
      return {
        placeId: String(item.place_id || `osm-${idx}`),
        displayName: String(item.display_name || formatted.address),
        shortAddress: formatted.address,
        city: formatted.city,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      };
    });
  } catch {
    return localMatches;
  }
}

export async function reverseGeocodeOpenStreetMap(
  lat: number,
  lng: number
): Promise<OsmReverseGeocodeResult> {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'FoodiesCafeApp/1.0',
      },
      signal: controller ? controller.signal : undefined,
    });
    if (timeoutId) clearTimeout(timeoutId);
    if (!res.ok) return inferNearestFallbackArea(lat, lng);
    const data = await res.json();
    if (!data || data.error) return inferNearestFallbackArea(lat, lng);
    return formatNominatimAddress(data.address, data.display_name);
  } catch {
    return inferNearestFallbackArea(lat, lng);
  }
}

export function getOsmPlaceUrl(lat: number, lng: number, zoom = 16): string {
  const safeLat = Number(lat).toFixed(6);
  const safeLng = Number(lng).toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${safeLat}&mlon=${safeLng}#map=${zoom}/${safeLat}/${safeLng}`;
}

export function getOsmSearchUrl(query: string, lat?: number, lng?: number): string {
  if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return getOsmPlaceUrl(lat, lng, 16);
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

export function getOsmDirectionsUrl(
  from: OsmCoordinates | null | undefined,
  to: OsmCoordinates,
  zoom = 14
): string {
  if (
    from &&
    typeof from.lat === 'number' &&
    typeof from.lng === 'number' &&
    !Number.isNaN(from.lat) &&
    !Number.isNaN(from.lng)
  ) {
    const fLat = Number(from.lat).toFixed(6);
    const fLng = Number(from.lng).toFixed(6);
    const tLat = Number(to.lat).toFixed(6);
    const tLng = Number(to.lng).toFixed(6);
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${fLat}%2C${fLng}%3B${tLat}%2C${tLng}#map=${zoom}/${tLat}/${tLng}`;
  }
  return getOsmPlaceUrl(to.lat, to.lng, 16);
}

export function getOsmMultiStopRouteUrl(
  origin: OsmCoordinates,
  stops: OsmCoordinates[]
): string {
  if (!stops || stops.length === 0) {
    return getOsmPlaceUrl(origin.lat, origin.lng, 15);
  }
  const target = stops[stops.length - 1];
  return getOsmDirectionsUrl(origin, target, 13);
}
