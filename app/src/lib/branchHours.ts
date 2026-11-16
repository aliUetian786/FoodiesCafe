/**
 * Pure opening-hours / schedule time logic (Asia/Karachi, UTC+5). Safe for browser and server.
 * Server-side application of schedules lives in lib/branchSchedule.ts.
 */
const PKT_OFFSET_MIN = 5 * 60;
const HOURS_RE = /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i;

export interface ParsedHours {
  openMin: number; // minutes after local midnight
  closeMin: number;
}

export function parseOpeningHours(hours?: string | null): ParsedHours | null {
  const m = (hours || '').match(HOURS_RE);
  if (!m) return null;
  const toMin = (h: string, mm: string, mer: string) => {
    let hour = parseInt(h, 10) % 12;
    if (mer.toUpperCase() === 'PM') hour += 12;
    return hour * 60 + parseInt(mm, 10);
  };
  return { openMin: toMin(m[1], m[2], m[3]), closeMin: toMin(m[4], m[5], m[6]) };
}

/** "HH:MM" (24h, from <input type="time">) -> "h:MM AM" */
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  const mer = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${mer}`;
}

/** minutes after midnight -> "HH:MM" (24h) */
export function minutesToHHMM(min: number): string {
  return `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function formatOpeningHours(openHHMM: string, closeHHMM: string): string {
  return `${to12h(openHHMM)} - ${to12h(closeHHMM)}`;
}

/** Local (PKT) midnight of the day containing `now`, as a UTC epoch ms. */
function pktMidnightMs(now: Date): number {
  const local = now.getTime() + PKT_OFFSET_MIN * 60_000;
  const midnightLocal = Math.floor(local / 86_400_000) * 86_400_000;
  return midnightLocal - PKT_OFFSET_MIN * 60_000;
}

export interface ScheduleTransition {
  isOpen: boolean;
  at: Date;
  key: string; // unique id of this transition, e.g. "open@2026-11-16T11:00"
}

function transitionsAround(hours: ParsedHours, now: Date): ScheduleTransition[] {
  const out: ScheduleTransition[] = [];
  const midnight = pktMidnightMs(now);
  const overnight = hours.closeMin <= hours.openMin;
  for (const dayOffset of [-2, -1, 0, 1]) {
    const dayStart = midnight + dayOffset * 86_400_000;
    const openAt = new Date(dayStart + hours.openMin * 60_000);
    const closeAt = new Date(dayStart + (hours.closeMin + (overnight ? 1440 : 0)) * 60_000);
    const label = (d: Date) => new Date(d.getTime() + PKT_OFFSET_MIN * 60_000).toISOString().slice(0, 16);
    out.push({ isOpen: true, at: openAt, key: `open@${label(openAt)}` });
    out.push({ isOpen: false, at: closeAt, key: `close@${label(closeAt)}` });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** The most recent scheduled transition at or before `now`. */
export function lastScheduledTransition(hours: ParsedHours, now: Date = new Date()): ScheduleTransition | null {
  const past = transitionsAround(hours, now).filter((t) => t.at.getTime() <= now.getTime());
  return past[past.length - 1] || null;
}

/** The next scheduled transition after `now` (for "closes at 1:00 AM" hints in the UI). */
export function nextScheduledTransition(hours: ParsedHours, now: Date = new Date()): ScheduleTransition | null {
  return transitionsAround(hours, now).find((t) => t.at.getTime() > now.getTime()) || null;
}
