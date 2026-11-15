import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { cacheInvalidatePrefix } from '@/lib/redis';
import { requireAuth, writeAuditLog } from '@/lib/auth';
import {
  ensureNotificationsTable,
  getNotificationSettings,
  getReceiverNotificationSettingsMap,
  insertAndBroadcastNotification,
  mapNotificationRow,
  resolveOrderWaiterAndRider,
  updateNotificationSettings,
  upsertReceiverNotificationSettings,
} from '@/lib/notifications';

const AUTHORIZED_SETTINGS_ROLES = ['platform_owner', 'branch_manager', 'cashier'] as const;

async function handleSettingsUpdate(request: Request, body: any) {
  const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager', 'cashier']);
  if (errorResponse) return errorResponse;

  const settingsPayload = body.settings || body;
  const actorName = body.actorName || auth.userName || auth.userId || 'Authorized Staff';
  const updated = await updateNotificationSettings(settingsPayload, {
    name: String(actorName),
    role: auth.role,
  });

  await writeAuditLog({
    actorId: auth.userId,
    actorName: String(actorName),
    actorRole: auth.role,
    branchId: auth.branchId || 'all',
    action: 'notification_settings_updated',
    details: `Notification rules updated by ${actorName} (${auth.role}) • Platform=${updated.defaultPlatform}`,
    newValue: JSON.stringify(updated.events),
  });

  return NextResponse.json({ success: true, ok: true, notificationSettings: updated });
}

async function handleReceiverSettingsUpdate(body: any) {
  const receiverKey = String(body.receiverKey || '').trim();
  if (!receiverKey) {
    return NextResponse.json({ error: 'receiverKey is required' }, { status: 400 });
  }
  const settingsPayload = body.settings || {};
  const result = await upsertReceiverNotificationSettings(receiverKey, settingsPayload);
  return NextResponse.json({
    success: true,
    ok: true,
    receiverKey: result.receiverKey,
    settings: result.settings,
    receiverSettingsMap: result.receiverSettingsMap,
  });
}

export async function GET(request: Request) {
  try {
    await ensureNotificationsTable();
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const limitParam = Number(searchParams.get('limit') || 100);
    const limit = Math.min(Math.max(1, isNaN(limitParam) ? 100 : limitParam), 200);

    let sql = `SELECT * FROM notifications`;
    const params: any[] = [];
    if (branchId && branchId !== 'all') {
      sql += ` WHERE branch_id = $1 OR branch_id = 'all' OR branch_id IS NULL`;
      params.push(branchId);
    }
    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const [res, notificationSettings, receiverSettingsMap] = await Promise.all([
      query(sql, params),
      getNotificationSettings(),
      getReceiverNotificationSettingsMap(),
    ]);
    const notifications = res.rows.map(mapNotificationRow);
    return NextResponse.json({ notifications, notificationSettings, receiverSettingsMap });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to load notifications', details: err?.message, notifications: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === 'update_receiver_settings') {
      return await handleReceiverSettingsUpdate(body);
    }

    if (body.action === 'update_receiver_settings') {
      return await handleReceiverSettingsUpdate(body);
    }

    if (body.action === 'update_settings') {
      return await handleSettingsUpdate(request, body);
    }

    const title = String(body.title || '').trim();
    const message = String(body.message || '').trim();

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Both title and message are required' },
        { status: 400 }
      );
    }

    let targetWaiterId = body.targetWaiterId;
    let targetWaiterName = body.targetWaiterName;
    let targetRiderId = body.targetRiderId;
    let targetRiderName = body.targetRiderName;
    let resolvedOrderType = body.orderType;

    // Resolve concerned waiter / rider automatically when tied to an order
    if ((body.orderId || body.orderNumber) && (!targetWaiterId || !targetRiderId || !resolvedOrderType)) {
      try {
        const ordRes = await query(
          `SELECT id, order_number, type, table_number, branch_id,
                  assigned_waiter_id, assigned_waiter_name,
                  assigned_rider_id, assigned_rider_name
           FROM orders
           WHERE id = $1 OR order_number = $2
           LIMIT 1`,
          [body.orderId || '', body.orderNumber ? String(body.orderNumber) : '']
        );
        if (ordRes.rows[0]) {
          const ordRow = ordRes.rows[0];
          resolvedOrderType = resolvedOrderType || ordRow.type;
          const resolved = await resolveOrderWaiterAndRider(ordRow);
          if (!targetWaiterId && resolved.waiterId) {
            targetWaiterId = resolved.waiterId;
            targetWaiterName = targetWaiterName || resolved.waiterName;
          }
          if (!targetRiderId && resolved.riderId) {
            targetRiderId = resolved.riderId;
            targetRiderName = targetRiderName || resolved.riderName;
          }
        }
      } catch {}
    }

    const notification = await insertAndBroadcastNotification({
      id: body.id,
      title,
      message,
      type: body.type || 'info',
      category: body.category || 'staff_alert',
      branchId: body.branchId || 'all',
      orderId: body.orderId,
      orderNumber: body.orderNumber ? String(body.orderNumber) : undefined,
      orderType: resolvedOrderType,
      senderId: body.senderId || 'staff',
      senderName: body.senderName || 'Staff',
      senderRole: body.senderRole || 'cashier',
      targetRoles: Array.isArray(body.targetRoles) && body.targetRoles.length > 0 ? body.targetRoles : ['all'],
      targetPlatform: body.targetPlatform === 'web' || body.targetPlatform === 'app' ? body.targetPlatform : 'all',
      targetUserId: body.targetUserId,
      targetCustomerPhone: body.targetCustomerPhone,
      targetCustomerName: body.targetCustomerName,
      targetWaiterId,
      targetWaiterName,
      targetRiderId,
      targetRiderName,
      readBy: Array.isArray(body.readBy) ? body.readBy : [],
      createdAt: body.createdAt,
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Failed to save notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, notification });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to send notification', details: err?.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (body.action === 'update_receiver_settings') {
      return await handleReceiverSettingsUpdate(body);
    }
    return await handleSettingsUpdate(request, body);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to update notification settings', details: err?.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureNotificationsTable();
    const body = await request.json();

    if (body.action === 'update_receiver_settings') {
      return await handleReceiverSettingsUpdate(body);
    }

    if (body.action === 'update_settings') {
      return await handleSettingsUpdate(request, body);
    }

    const userId = String(body.userId || body.userKey || '').trim();
    const id = body.id ? String(body.id) : undefined;
    const markAllRead = Boolean(body.markAllRead ?? body.markAll);

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (markAllRead) {
      const res = await query(`SELECT id, read_by FROM notifications ORDER BY created_at DESC LIMIT 150`);
      for (const row of res.rows) {
        const currentReadBy: string[] = Array.isArray(row.read_by)
          ? row.read_by
          : typeof row.read_by === 'string'
          ? JSON.parse(row.read_by || '[]')
          : [];
        if (!currentReadBy.includes(userId)) {
          const nextReadBy = [...currentReadBy, userId];
          await query(`UPDATE notifications SET read_by = $1::jsonb WHERE id = $2`, [
            JSON.stringify(nextReadBy),
            row.id,
          ]);
        }
      }
    } else if (id) {
      const res = await query(`SELECT id, read_by FROM notifications WHERE id = $1 LIMIT 1`, [id]);
      if (res.rows.length > 0) {
        const currentReadBy: string[] = Array.isArray(res.rows[0].read_by)
          ? res.rows[0].read_by
          : typeof res.rows[0].read_by === 'string'
          ? JSON.parse(res.rows[0].read_by || '[]')
          : [];
        if (!currentReadBy.includes(userId)) {
          const nextReadBy = [...currentReadBy, userId];
          await query(`UPDATE notifications SET read_by = $1::jsonb WHERE id = $2`, [
            JSON.stringify(nextReadBy),
            id,
          ]);
        }
      }
    }

    try {
      cacheInvalidatePrefix('sync:payload').catch(() => {});
      broadcastRealtimeEvent({
        type: 'NOTIFICATION_UPDATED',
        branchId: 'all',
        data: { id, userId, markAllRead },
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to update notification read status', details: err?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureNotificationsTable();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const branchId = searchParams.get('branchId');

    if (id) {
      await query(`DELETE FROM notifications WHERE id = $1`, [id]);
    } else if (branchId && branchId !== 'all') {
      await query(`DELETE FROM notifications WHERE branch_id = $1`, [branchId]);
    } else {
      await query(`DELETE FROM notifications`);
    }

    try {
      cacheInvalidatePrefix('sync:payload').catch(() => {});
      broadcastRealtimeEvent({
        type: 'NOTIFICATION_UPDATED',
        branchId: branchId || 'all',
        data: { cleared: true, id },
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to delete notifications', details: err?.message },
      { status: 500 }
    );
  }
}
