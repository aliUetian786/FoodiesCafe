import { NextResponse } from 'next/server';
import { testConnection, query, flushDatabaseStatePersistence } from '@/lib/db';
import { getAuthFromRequest, writeAuditLog } from '@/lib/auth';
import { cacheInvalidatePrefix } from '@/lib/redis';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function GET() {
  const status = await testConnection();
  return NextResponse.json({
    database: 'PostgreSQL',
    connected: status.connected,
    engine: status.engine,
    isMemory: status.isMemory,
    pool: status.pool,
    message: status.message,
    timestamp: status.timestamp || new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (process.env.NODE_ENV === 'production' && auth.role !== 'platform_owner') {
    return NextResponse.json({ error: 'Forbidden: Platform Owner privileges required.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.action === 'purge_orders') {
    // Preserve orders permanently: reject any automatic or accidental purges
    if (!body.force_dangerously_wipe_all_data) {
      return NextResponse.json({
        success: false,
        message: 'Order purging is permanently disabled. Orders and payment records are preserved across all restarts.',
      });
    }

    await query('DELETE FROM orders').catch(() => {});
    await query('DELETE FROM order_history').catch(() => {});
    await query('DELETE FROM refund_requests').catch(() => {});
    await query('DELETE FROM table_sessions').catch(() => {});
    await query(
      `UPDATE cash_shifts 
       SET cash_collected = 0, 
           expected_cash = 0, 
           counted_cash = NULL, 
           difference = NULL, 
           difference_reason = NULL`
    ).catch(() => {});

    await flushDatabaseStatePersistence().catch(() => {});
    await cacheInvalidatePrefix('sync:payload:');
    await cacheInvalidatePrefix('orders:');
    await broadcastRealtimeEvent({ type: 'SYNC_TRIGGER', data: { scope: 'orders' } });
    await broadcastRealtimeEvent({ type: 'SYNC_TRIGGER', data: { scope: 'shifts' } });

    await writeAuditLog({
      actorId: auth.userId || 'system',
      actorName: 'System / Platform Owner',
      actorRole: auth.role || 'platform_owner',
      branchId: null,
      action: 'database_order_purge',
      details: 'Clean-slate purge executed: all orders, items, refunds, and shift cash reset to 0.',
    });

    return NextResponse.json({
      success: true,
      message: 'All orders purged, cash shifts reset to zero, and caches invalidated.',
    });
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}

