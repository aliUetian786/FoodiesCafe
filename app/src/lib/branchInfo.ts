/**
 * Customer-facing branch helpers shared by the branch picker and the store locator (browser-safe).
 */
import type { Branch } from '@/types/cafe';
import { nextScheduledTransition, parseOpeningHours } from '@/lib/branchHours';

export const FRANCHISE_NAME = 'Foodies Cafe';

export interface LatLng {
  lat: number;
  lng: number;
}

export function branchCoords(b: Branch): LatLng | null {
  const lat = Number(b.latitude);
  const lng = Number(b.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : null;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}

export function formatDistance(km: number | null): string {
  if (km === null) return '';
  return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(km < 10 ? 1 : 0)} km away`;
}

/** Google Maps turn-by-turn directions (origin optional: Maps uses the device location if omitted). */
export function googleMapsDirectionsUrl(to: LatLng, from?: LatLng | null): string {
  const params = new URLSearchParams({ api: '1', destination: `${to.lat},${to.lng}`, travelmode: 'driving' });
  if (from) params.set('origin', `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const timeFmt = new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit' });

/** Live status line, e.g. "Open now · closes 1:00 AM" / "Closed · opens 11:00 AM" / "Closed temporarily". */
export function branchStatus(b: Branch, now: Date = new Date()): { open: boolean; label: string } {
  const hours = parseOpeningHours(b.openingHours);
  const next = hours ? nextScheduledTransition(hours, now) : null;
  if (b.isOpen) {
    if (b.isBusy) return { open: true, label: 'Open now · busy, longer wait' };
    return { open: true, label: next && !next.isOpen ? `Open now · closes ${timeFmt.format(next.at)}` : 'Open now' };
  }
  if (next && next.isOpen) return { open: false, label: `Closed · opens ${timeFmt.format(next.at)}` };
  return { open: false, label: 'Closed temporarily' };
}
