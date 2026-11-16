/**
 * Automatic branch opening / closing from each branch's opening_hours ("11:00 AM - 01:00 AM"),
 * in Pakistan time (Asia/Karachi, UTC+5, no DST).
 *
 * Vercel's free plan only allows a once-a-day cron, so schedules are applied lazily: API routes that
 * staff/customers poll call applyBranchSchedules() (throttled to once per 20 s per server instance).
 * A schedule only acts AT its transition moments: a manager's manual close during opening hours is
 * kept until the next scheduled opening. Each transition is applied exactly once across instances
 * (atomic UPDATE on schedule_last_applied) and notifies that branch's manager and the owner.
 */
import { query } from '@/lib/db';
import { cacheInvalidatePrefix } from '@/lib/redis';
import { broadcastRealtimeEvent } from '@/lib/realtime';

import { parseOpeningHours, lastScheduledTransition } from '@/lib/branchHours';
export * from '@/lib/branchHours';

declare global {
  // eslint-disable-next-line no-var
  var __foodiesScheduleLastRun: number | undefined;
  // eslint-disable-next-line no-var
  var __foodiesScheduleInFlight: Promise<void> | undefined;
}

const THROTTLE_MS = 20_000;

/** Applies due open/close transitions. Cheap to call often: throttled and never throws. */
export function applyBranchSchedules(force = false): Promise<void> {
  const now = Date.now();
  if (!force && global.__foodiesScheduleLastRun && now - global.__foodiesScheduleLastRun < THROTTLE_MS) {
    return global.__foodiesScheduleInFlight || Promise.resolve();
  }
  global.__foodiesScheduleLastRun = now;
  global.__foodiesScheduleInFlight = runSchedules().catch((err) => {
    console.error('[branchSchedule] apply failed:', err?.message || err);
  });
  return global.__foodiesScheduleInFlight;
}

async function runSchedules(): Promise<void> {
  const res = await query(
    `SELECT id, name, is_open, opening_hours, schedule_last_applied
       FROM branches
      WHERE auto_schedule_enabled = true`
  ).catch(() => ({ rows: [] as any[] }));

  for (const b of res.rows) {
    const hours = parseOpeningHours(b.opening_hours);
    if (!hours) continue;
    const due = lastScheduledTransition(hours);
    if (!due || b.schedule_last_applied === due.key) continue;

    // Atomic claim: only one instance applies this transition.
    const upd = await query(
      `UPDATE branches
          SET is_open = $1, schedule_last_applied = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND schedule_last_applied IS DISTINCT FROM $2
        RETURNING id, name, is_open`,
      [due.isOpen, due.key, b.id]
    );
    if (upd.rows.length === 0) continue;

    const changed = Boolean(b.is_open) !== due.isOpen;
    await Promise.all([
      cacheInvalidatePrefix('branches:'),
      cacheInvalidatePrefix('catalog:'),
      cacheInvalidatePrefix('sync:payload:'),
    ]).catch(() => {});
    if (!changed) continue;

    try {
      broadcastRealtimeEvent({
        type: 'BRANCH_UPDATED',
        branchId: b.id,
        data: { branchId: b.id, isOpen: due.isOpen, source: 'schedule' },
      });
    } catch {}
    const { emitBranchStatusNotification } = await import('@/lib/notifications');
    await emitBranchStatusNotification({
      branchId: b.id,
      branchName: b.name,
      isOpen: due.isOpen,
      reason: 'schedule',
      transitionKey: due.key,
    });
  }
}
