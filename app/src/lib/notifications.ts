import { flushDatabaseStatePersistence, getPoolMetrics, query } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { cacheInvalidatePrefix } from '@/lib/redis';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES,
  DEFAULT_RECIPIENT_NOTIFICATION_RULES,
  type AppNotification,
  type NotificationCategory,
  type NotificationEventKey,
  type NotificationSettings,
  type NotificationTargetPlatform,
  type OrderType,
  type ReceiverNotificationPreferences,
  type RecipientNotificationRules,
  type Role,
} from '@/types/cafe';

let tableInitialized = false;

export async function ensureNotificationsTable(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(30) NOT NULL DEFAULT 'info',
        category VARCHAR(50) NOT NULL DEFAULT 'system',
        branch_id VARCHAR(100) DEFAULT 'all',
        order_id VARCHAR(100),
        order_number VARCHAR(64),
        order_type VARCHAR(30),
        sender_id VARCHAR(100),
        sender_name VARCHAR(150),
        sender_role VARCHAR(50),
        target_roles JSONB NOT NULL DEFAULT '["all"]'::jsonb,
        target_platform VARCHAR(20) NOT NULL DEFAULT 'all',
        target_user_id VARCHAR(100),
        target_customer_phone VARCHAR(50),
        target_customer_name VARCHAR(150),
        target_waiter_id VARCHAR(100),
        target_waiter_name VARCHAR(150),
        target_rider_id VARCHAR(100),
        target_rider_name VARCHAR(150),
        read_by JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_platform VARCHAR(20) DEFAULT 'all';`).catch(() => {});
    await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_waiter_id VARCHAR(100);`).catch(() => {});
    await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_waiter_name VARCHAR(150);`).catch(() => {});
    await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_rider_id VARCHAR(100);`).catch(() => {});
    await query(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_rider_name VARCHAR(150);`).catch(() => {});

    await query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id VARCHAR(64) PRIMARY KEY DEFAULT 'global',
        default_platform VARCHAR(20) NOT NULL DEFAULT 'all',
        notify_customer BOOLEAN NOT NULL DEFAULT true,
        notify_concerned_rider BOOLEAN NOT NULL DEFAULT true,
        notify_concerned_waiter BOOLEAN NOT NULL DEFAULT true,
        notify_kitchen BOOLEAN NOT NULL DEFAULT true,
        notify_cashier_and_manager BOOLEAN NOT NULL DEFAULT true,
        events JSONB NOT NULL DEFAULT '${JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS.events)}'::jsonb,
        recipient_rules JSONB NOT NULL DEFAULT '${JSON.stringify(DEFAULT_RECIPIENT_NOTIFICATION_RULES)}'::jsonb,
        updated_by VARCHAR(150),
        updated_by_role VARCHAR(50),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS recipient_rules JSONB;`).catch(() => {});
    await query(`
      CREATE TABLE IF NOT EXISTS receiver_notification_settings (
        receiver_key VARCHAR(150) PRIMARY KEY,
        settings JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    tableInitialized = true;
  } catch {
    // Table may already exist or db initializing
  }
}

function normalizeRecipientRules(raw: any): RecipientNotificationRules {
  const parsed =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        })()
      : raw || {};

  return {
    customer: {
      ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.customer,
      ...(parsed.customer || {}),
    },
    rider: {
      ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.rider,
      ...(parsed.rider || {}),
    },
    waiter: {
      ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.waiter,
      ...(parsed.waiter || {}),
    },
    kitchen: {
      ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.kitchen,
      ...(parsed.kitchen || {}),
    },
    cashierAndManager: {
      ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.cashierAndManager,
      ...(parsed.cashierAndManager || {}),
    },
  };
}

function normalizeEvents(rawEvents: any): Record<NotificationEventKey, boolean> {
  const parsed =
    typeof rawEvents === 'string'
      ? (() => {
          try {
            return JSON.parse(rawEvents);
          } catch {
            return {};
          }
        })()
      : rawEvents || {};

  return {
    ...DEFAULT_NOTIFICATION_SETTINGS.events,
    ...(parsed && typeof parsed === 'object' ? parsed : {}),
  };
}

export function mapNotificationSettingsRow(row: any): NotificationSettings {
  if (!row) {
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      events: { ...DEFAULT_NOTIFICATION_SETTINGS.events },
      recipientRules: { ...DEFAULT_RECIPIENT_NOTIFICATION_RULES },
    };
  }

  const rawPlatform = row.default_platform ?? row.defaultPlatform ?? 'all';
  const defaultPlatform: NotificationTargetPlatform =
    rawPlatform === 'web' || rawPlatform === 'app' ? rawPlatform : 'all';

  return {
    id: row.id || 'global',
    defaultPlatform,
    notifyCustomer: (row.notify_customer ?? row.notifyCustomer) !== false,
    notifyConcernedRider: (row.notify_concerned_rider ?? row.notifyConcernedRider) !== false,
    notifyConcernedWaiter: (row.notify_concerned_waiter ?? row.notifyConcernedWaiter) !== false,
    notifyKitchen: (row.notify_kitchen ?? row.notifyKitchen) !== false,
    notifyCashierAndManager: (row.notify_cashier_and_manager ?? row.notifyCashierAndManager) !== false,
    events: normalizeEvents(row.events),
    recipientRules: normalizeRecipientRules(row.recipient_rules ?? row.recipientRules),
    updatedBy: row.updated_by ?? row.updatedBy ?? undefined,
    updatedByRole: row.updated_by_role ?? row.updatedByRole ?? undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt || undefined,
  };
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    await ensureNotificationsTable();
    const res = await query(`SELECT * FROM notification_settings WHERE id = 'global' LIMIT 1`);
    if (res.rows.length === 0) {
      await query(
        `INSERT INTO notification_settings (
          id, default_platform, notify_customer, notify_concerned_rider,
          notify_concerned_waiter, notify_kitchen, notify_cashier_and_manager, events, recipient_rules
        ) VALUES ('global', $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
        ON CONFLICT (id) DO NOTHING`,
        [
          DEFAULT_NOTIFICATION_SETTINGS.defaultPlatform,
          DEFAULT_NOTIFICATION_SETTINGS.notifyCustomer,
          DEFAULT_NOTIFICATION_SETTINGS.notifyConcernedRider,
          DEFAULT_NOTIFICATION_SETTINGS.notifyConcernedWaiter,
          DEFAULT_NOTIFICATION_SETTINGS.notifyKitchen,
          DEFAULT_NOTIFICATION_SETTINGS.notifyCashierAndManager,
          JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS.events),
          JSON.stringify(DEFAULT_RECIPIENT_NOTIFICATION_RULES),
        ]
      ).catch(() => {});
      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        events: { ...DEFAULT_NOTIFICATION_SETTINGS.events },
        recipientRules: { ...DEFAULT_RECIPIENT_NOTIFICATION_RULES },
      };
    }
    return mapNotificationSettingsRow(res.rows[0]);
  } catch {
    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      events: { ...DEFAULT_NOTIFICATION_SETTINGS.events },
      recipientRules: { ...DEFAULT_RECIPIENT_NOTIFICATION_RULES },
    };
  }
}

export async function updateNotificationSettings(
  updates: Partial<NotificationSettings>,
  actor?: { name?: string; role?: string }
): Promise<NotificationSettings> {
  await ensureNotificationsTable();
  const current = await getNotificationSettings();
  const nextSettings: NotificationSettings = {
    id: 'global',
    defaultPlatform:
      updates.defaultPlatform === 'web' || updates.defaultPlatform === 'app' || updates.defaultPlatform === 'all'
        ? updates.defaultPlatform
        : current.defaultPlatform,
    notifyCustomer: updates.notifyCustomer ?? current.notifyCustomer,
    notifyConcernedRider: updates.notifyConcernedRider ?? current.notifyConcernedRider,
    notifyConcernedWaiter: updates.notifyConcernedWaiter ?? current.notifyConcernedWaiter,
    notifyKitchen: updates.notifyKitchen ?? current.notifyKitchen,
    notifyCashierAndManager: updates.notifyCashierAndManager ?? current.notifyCashierAndManager,
    events: {
      ...current.events,
      ...(updates.events || {}),
    },
    recipientRules: normalizeRecipientRules(updates.recipientRules || current.recipientRules),
    updatedBy: actor?.name || updates.updatedBy || current.updatedBy || 'Authorized Staff',
    updatedByRole: actor?.role || updates.updatedByRole || current.updatedByRole || 'cashier',
    updatedAt: new Date().toISOString(),
  };

  const insertSql = `INSERT INTO notification_settings (
      id, default_platform, notify_customer, notify_concerned_rider,
      notify_concerned_waiter, notify_kitchen, notify_cashier_and_manager,
      events, recipient_rules, updated_by, updated_by_role, updated_at
    ) VALUES (
      'global', $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11
    )
    ON CONFLICT (id) DO UPDATE SET
      default_platform = EXCLUDED.default_platform,
      notify_customer = EXCLUDED.notify_customer,
      notify_concerned_rider = EXCLUDED.notify_concerned_rider,
      notify_concerned_waiter = EXCLUDED.notify_concerned_waiter,
      notify_kitchen = EXCLUDED.notify_kitchen,
      notify_cashier_and_manager = EXCLUDED.notify_cashier_and_manager,
      events = EXCLUDED.events,
      recipient_rules = EXCLUDED.recipient_rules,
      updated_by = EXCLUDED.updated_by,
      updated_by_role = EXCLUDED.updated_by_role,
      updated_at = EXCLUDED.updated_at
    RETURNING *`;
  const insertParams = [
    nextSettings.defaultPlatform,
    nextSettings.notifyCustomer,
    nextSettings.notifyConcernedRider,
    nextSettings.notifyConcernedWaiter,
    nextSettings.notifyKitchen,
    nextSettings.notifyCashierAndManager,
    JSON.stringify(nextSettings.events),
    JSON.stringify(nextSettings.recipientRules),
    nextSettings.updatedBy || null,
    nextSettings.updatedByRole || null,
    nextSettings.updatedAt,
  ];

  let res: any;
  try {
    res = await query(insertSql, insertParams);
  } catch (err: any) {
    if (err?.message?.includes('recipient_rules') || err?.message?.includes('column')) {
      await query(`ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS recipient_rules JSONB;`).catch(() => {});
      res = await query(insertSql, insertParams);
    } else {
      throw err;
    }
  }

  if (getPoolMetrics().isMemory) {
    await flushDatabaseStatePersistence().catch(() => {});
  }

  try {
    await cacheInvalidatePrefix('sync:payload:');
    await cacheInvalidatePrefix('sync:');
    broadcastRealtimeEvent({
      type: 'NOTIFICATION_UPDATED',
      branchId: 'all',
      data: { notificationSettings: nextSettings },
    });
  } catch {}

  return res.rows[0] ? mapNotificationSettingsRow(res.rows[0]) : nextSettings;
}

export function normalizeReceiverPreferences(raw: any): ReceiverNotificationPreferences {
  const parsed =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        })()
      : raw || {};
  return {
    receiverKey: parsed?.receiverKey,
    receiverLabel: parsed?.receiverLabel,
    receiveNotifications: parsed?.receiveNotifications !== false,
    showLiveToast: parsed?.showLiveToast !== false,
    mutedCategories: Array.isArray(parsed?.mutedCategories) ? parsed.mutedCategories : [],
    events: {
      ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES.events,
      ...(parsed?.events && typeof parsed.events === 'object' ? parsed.events : {}),
    },
    updatedAt: parsed?.updatedAt || undefined,
  };
}

export async function getReceiverNotificationSettingsMap(): Promise<
  Record<string, ReceiverNotificationPreferences>
> {
  try {
    await ensureNotificationsTable();
    const res = await query(`SELECT receiver_key, settings, updated_at FROM receiver_notification_settings`);
    const map: Record<string, ReceiverNotificationPreferences> = {};
    for (const row of res.rows) {
      if (!row.receiver_key) continue;
      const prefs = normalizeReceiverPreferences(row.settings);
      map[row.receiver_key] = {
        ...prefs,
        receiverKey: row.receiver_key,
        updatedAt: prefs.updatedAt || (row.updated_at ? new Date(row.updated_at).toISOString() : undefined),
      };
    }
    return map;
  } catch {
    return {};
  }
}

export async function upsertReceiverNotificationSettings(
  receiverKey: string,
  updates: Partial<ReceiverNotificationPreferences>
): Promise<{
  receiverKey: string;
  settings: ReceiverNotificationPreferences;
  receiverSettingsMap: Record<string, ReceiverNotificationPreferences>;
}> {
  await ensureNotificationsTable();
  const cleanKey = String(receiverKey || '').trim().slice(0, 150) || 'role:customer';
  const existingMap = await getReceiverNotificationSettingsMap();
  const current = existingMap[cleanKey] || {
    ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES,
    events: { ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES.events },
  };

  const nextPrefs: ReceiverNotificationPreferences = {
    ...current,
    ...updates,
    receiverKey: cleanKey,
    receiveNotifications: updates.receiveNotifications ?? current.receiveNotifications ?? true,
    showLiveToast: updates.showLiveToast ?? current.showLiveToast ?? true,
    mutedCategories: Array.isArray(updates.mutedCategories)
      ? updates.mutedCategories
      : (current.mutedCategories || []),
    events: {
      ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES.events,
      ...(current.events || {}),
      ...(updates.events || {}),
    },
    updatedAt: new Date().toISOString(),
  };

  await query(
    `INSERT INTO receiver_notification_settings (receiver_key, settings, updated_at)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (receiver_key) DO UPDATE SET
       settings = EXCLUDED.settings,
       updated_at = EXCLUDED.updated_at`,
    [cleanKey, JSON.stringify(nextPrefs), nextPrefs.updatedAt]
  );

  if (getPoolMetrics().isMemory) {
    await flushDatabaseStatePersistence().catch(() => {});
  }

  try {
    await cacheInvalidatePrefix('sync:payload:');
    await cacheInvalidatePrefix('sync:');
    broadcastRealtimeEvent({
      type: 'NOTIFICATION_UPDATED',
      branchId: 'all',
      data: { receiverKey: cleanKey, receiverSettings: nextPrefs },
    });
  } catch {}

  const updatedMap = {
    ...existingMap,
    [cleanKey]: nextPrefs,
  };
  return { receiverKey: cleanKey, settings: nextPrefs, receiverSettingsMap: updatedMap };
}

export async function resolveOrderWaiterAndRider(order: any): Promise<{
  waiterId?: string;
  waiterName?: string;
  riderId?: string;
  riderName?: string;
}> {
  if (!order) return {};
  let waiterId: string | undefined = order.assignedWaiterId ?? order.assigned_waiter_id ?? undefined;
  let waiterName: string | undefined = order.assignedWaiterName ?? order.assigned_waiter_name ?? undefined;
  const riderId: string | undefined = order.assignedRiderId ?? order.assigned_rider_id ?? undefined;
  const riderName: string | undefined = order.assignedRiderName ?? order.assigned_rider_name ?? undefined;

  const orderType = order.type || order.orderType;
  const tableNumber = order.tableNumber ?? order.table_number;
  const branchId = order.branchId ?? order.branch_id;

  if (orderType === 'dine_in' && !waiterId && tableNumber) {
    try {
      const tableRes = await query(
        `SELECT assigned_waiter_id, assigned_waiter_name
         FROM tables
         WHERE (number = $1 OR id = $1)${branchId ? ' AND branch_id = $2' : ''}
         LIMIT 1`,
        branchId ? [String(tableNumber), String(branchId)] : [String(tableNumber)]
      );
      if (tableRes.rows[0]) {
        waiterId = tableRes.rows[0].assigned_waiter_id || undefined;
        waiterName = waiterName || tableRes.rows[0].assigned_waiter_name || undefined;
      }
    } catch {}
  }

  return { waiterId, waiterName, riderId, riderName };
}

export function mapNotificationRow(r: any): AppNotification {
  const rawTargetRoles = r.target_roles ?? r.targetRoles;
  const parsedTargetRoles: Array<Role | 'all'> = Array.isArray(rawTargetRoles)
    ? rawTargetRoles
    : typeof rawTargetRoles === 'string'
    ? (() => {
        try {
          return JSON.parse(rawTargetRoles);
        } catch {
          return ['all'];
        }
      })()
    : ['all'];

  const rawReadBy = r.read_by ?? r.readBy;
  const parsedReadBy: string[] = Array.isArray(rawReadBy)
    ? rawReadBy
    : typeof rawReadBy === 'string'
    ? (() => {
        try {
          return JSON.parse(rawReadBy);
        } catch {
          return [];
        }
      })()
    : [];

  const rawPlatform = r.target_platform ?? r.targetPlatform ?? 'all';
  const targetPlatform: NotificationTargetPlatform =
    rawPlatform === 'web' || rawPlatform === 'app' ? rawPlatform : 'all';

  return {
    id: String(r.id),
    title: String(r.title || ''),
    message: String(r.message || ''),
    type: (r.type as AppNotification['type']) || 'info',
    category: (r.category as NotificationCategory) || 'system',
    branchId: r.branch_id ?? r.branchId ?? 'all',
    orderId: r.order_id ?? r.orderId ?? undefined,
    orderNumber: (r.order_number ?? r.orderNumber) ? String(r.order_number ?? r.orderNumber) : undefined,
    orderType: (r.order_type ?? r.orderType) as OrderType | undefined,
    senderId: r.sender_id ?? r.senderId ?? undefined,
    senderName: r.sender_name ?? r.senderName ?? undefined,
    senderRole: (r.sender_role ?? r.senderRole) as AppNotification['senderRole'],
    targetRoles: parsedTargetRoles,
    targetPlatform,
    targetUserId: r.target_user_id ?? r.targetUserId ?? undefined,
    targetCustomerPhone: r.target_customer_phone ?? r.targetCustomerPhone ?? undefined,
    targetCustomerName: r.target_customer_name ?? r.targetCustomerName ?? undefined,
    targetWaiterId: r.target_waiter_id ?? r.targetWaiterId ?? undefined,
    targetWaiterName: r.target_waiter_name ?? r.targetWaiterName ?? undefined,
    targetRiderId: r.target_rider_id ?? r.targetRiderId ?? undefined,
    targetRiderName: r.target_rider_name ?? r.targetRiderName ?? undefined,
    readBy: parsedReadBy,
    createdAt: r.created_at
      ? new Date(r.created_at).toISOString()
      : r.createdAt || new Date().toISOString(),
  };
}

export async function insertAndBroadcastNotification(
  input: Partial<AppNotification> & { title: string; message: string }
): Promise<AppNotification | null> {
  try {
    await ensureNotificationsTable();
    const id =
      input.id ||
      `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const branchId = input.branchId || 'all';
    const targetRoles: Array<Role | 'all'> =
      Array.isArray(input.targetRoles) && input.targetRoles.length > 0
        ? input.targetRoles
        : ['all'];
    const targetPlatform: NotificationTargetPlatform =
      input.targetPlatform === 'web' || input.targetPlatform === 'app' ? input.targetPlatform : 'all';
    const readBy: string[] = Array.isArray(input.readBy) ? input.readBy : [];
    const createdAt = input.createdAt || new Date().toISOString();

    const res = await query(
      `INSERT INTO notifications (
        id, title, message, type, category, branch_id,
        order_id, order_number, order_type,
        sender_id, sender_name, sender_role,
        target_roles, target_platform,
        target_user_id, target_customer_phone, target_customer_name,
        target_waiter_id, target_waiter_name, target_rider_id, target_rider_name,
        read_by, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12,
        $13::jsonb, $14,
        $15, $16, $17,
        $18, $19, $20, $21,
        $22::jsonb, $23
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        message = EXCLUDED.message
      RETURNING *`,
      [
        id,
        input.title,
        input.message,
        input.type || 'info',
        input.category || 'system',
        branchId,
        input.orderId || null,
        input.orderNumber ? String(input.orderNumber) : null,
        input.orderType || null,
        input.senderId || 'system',
        input.senderName || 'Foodies Cafe',
        input.senderRole || 'system',
        JSON.stringify(targetRoles),
        targetPlatform,
        input.targetUserId || null,
        input.targetCustomerPhone || null,
        input.targetCustomerName || null,
        input.targetWaiterId || null,
        input.targetWaiterName || null,
        input.targetRiderId || null,
        input.targetRiderName || null,
        JSON.stringify(readBy),
        createdAt,
      ]
    );

    const notification = res.rows[0]
      ? mapNotificationRow(res.rows[0])
      : {
          id,
          title: input.title,
          message: input.message,
          type: input.type || 'info',
          category: input.category || 'system',
          branchId,
          orderId: input.orderId,
          orderNumber: input.orderNumber,
          orderType: input.orderType,
          senderId: input.senderId || 'system',
          senderName: input.senderName || 'Foodies Cafe',
          senderRole: input.senderRole || 'system',
          targetRoles,
          targetPlatform,
          targetUserId: input.targetUserId,
          targetCustomerPhone: input.targetCustomerPhone,
          targetCustomerName: input.targetCustomerName,
          targetWaiterId: input.targetWaiterId,
          targetWaiterName: input.targetWaiterName,
          targetRiderId: input.targetRiderId,
          targetRiderName: input.targetRiderName,
          readBy,
          createdAt,
        };

    try {
      cacheInvalidatePrefix('sync:payload').catch(() => {});
      broadcastRealtimeEvent({
        type: 'NOTIFICATION_CREATED',
        branchId,
        orderId: notification.orderId,
        customerId: notification.targetUserId,
        data: notification,
      });
    } catch {}

    return notification;
  } catch (err) {
    console.error('[Notifications Insert Error]:', err);
    return null;
  }
}

function buildFilteredTargetRoles(
  settings: NotificationSettings,
  orderType: OrderType,
  opts: {
    includeCustomer?: boolean;
    includeKitchen?: boolean;
    includeWaiter?: boolean;
    includeRider?: boolean;
    includeCashierManager?: boolean;
    eventKey?: NotificationEventKey;
  }
): Array<Role | 'all'> {
  const roles = new Set<Role | 'all'>();
  const rules = settings.recipientRules || DEFAULT_RECIPIENT_NOTIFICATION_RULES;

  // Check customer
  if (opts.includeCustomer && settings.notifyCustomer) {
    let customerAllowed = true;
    if (opts.eventKey) {
      if (opts.eventKey === 'orderPlaced') customerAllowed = rules.customer.orderPlaced;
      else if (opts.eventKey === 'cooking' || opts.eventKey === 'sentToKitchen') customerAllowed = rules.customer.cooking;
      else if (opts.eventKey === 'orderReady') customerAllowed = rules.customer.orderReady;
      else if (opts.eventKey === 'outForDelivery') customerAllowed = rules.customer.outForDelivery;
      else if (opts.eventKey === 'orderCompleted' || opts.eventKey === 'orderServed') customerAllowed = rules.customer.orderCompleted;
      else if (opts.eventKey === 'orderCancelled') customerAllowed = rules.customer.orderCancelled;
    }
    if (customerAllowed) {
      roles.add('customer');
    }
  }

  // Check kitchen
  if (opts.includeKitchen && settings.notifyKitchen) {
    let kitchenAllowed = true;
    if (opts.eventKey) {
      if (opts.eventKey === 'orderPlaced' || opts.eventKey === 'sentToKitchen') kitchenAllowed = rules.kitchen.newOrderPlaced;
      else if (opts.eventKey === 'orderCancelled') kitchenAllowed = rules.kitchen.orderCancelled;
      else kitchenAllowed = false; // Kitchen should not receive status changes like ready, out for delivery, served, etc.
    }
    if (kitchenAllowed) {
      roles.add('kitchen_staff');
    }
  }

  // Check waiter
  if (orderType === 'dine_in' && opts.includeWaiter && settings.notifyConcernedWaiter) {
    let waiterAllowed = true;
    if (opts.eventKey) {
      if (opts.eventKey === 'waiterAssigned') waiterAllowed = rules.waiter.orderAssigned;
      else if (opts.eventKey === 'orderReady') waiterAllowed = rules.waiter.orderReady;
      else if (opts.eventKey === 'orderCancelled') waiterAllowed = rules.waiter.orderCancelled;
    }
    if (waiterAllowed) {
      roles.add('floor_staff');
    }
  }

  // Check rider
  if (orderType === 'delivery' && opts.includeRider && settings.notifyConcernedRider) {
    let riderAllowed = true;
    if (opts.eventKey) {
      if (opts.eventKey === 'riderAssigned') riderAllowed = rules.rider.orderAssigned;
      else if (opts.eventKey === 'orderReady') riderAllowed = rules.rider.orderReady;
      else if (opts.eventKey === 'orderCancelled') riderAllowed = rules.rider.orderCancelled;
    }
    if (riderAllowed) {
      roles.add('delivery_staff');
    }
  }

  // Check cashier & manager
  if (opts.includeCashierManager && settings.notifyCashierAndManager) {
    let cmAllowed = true;
    if (opts.eventKey) {
      if (opts.eventKey === 'orderPlaced') cmAllowed = rules.cashierAndManager.orderPlaced;
      else if (opts.eventKey === 'orderCancelled') cmAllowed = rules.cashierAndManager.orderCancelled;
      else if (opts.eventKey === 'paymentReceived') cmAllowed = rules.cashierAndManager.paymentReceived;
    }
    if (cmAllowed) {
      roles.add('cashier');
      roles.add('branch_manager');
      roles.add('platform_owner');
    }
  }

  return Array.from(roles);
}

export async function emitOrderPlacedNotification(order: any): Promise<void> {
  if (!order) return;
  const settings = await getNotificationSettings();
  if (!settings.events.orderPlaced) return;

  const orderType: OrderType = order.type || 'dine_in';
  const orderNumber = String(order.orderNumber || order.id || '');
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;
  const total = Number(order.total || 0);
  const { waiterId, waiterName, riderId, riderName } = await resolveOrderWaiterAndRider(order);

  let title = `Order Confirmed • #${orderNumber}`;
  let message = `Your order #${orderNumber} has been confirmed (${itemCount} items • Rs. ${total}). Sent to kitchen!`;
  let category: NotificationCategory = 'order_placed';

  if (orderType === 'takeaway') {
    title = `Order Confirmed • Takeaway #${orderNumber}`;
    message = `Your Takeaway order #${orderNumber} is confirmed (Rs. ${total}). Preparing for pickup at our counter!`;
    category = 'takeaway';
  } else if (orderType === 'dine_in') {
    title = `Order Confirmed • Dine-In #${orderNumber}`;
    message = `Your Dine-In order #${orderNumber}${order.tableNumber ? ` (Table ${order.tableNumber})` : ''} is confirmed (Rs. ${total}). Kitchen preparing now!`;
    category = 'dine_in';
  } else if (orderType === 'delivery') {
    title = `Order Confirmed • Delivery #${orderNumber}`;
    message = `Your Delivery order #${orderNumber} is confirmed (Rs. ${total}). Kitchen preparing for delivery dispatch!`;
    category = 'delivery';
  }

  const targetRoles = buildFilteredTargetRoles(settings, orderType, {
    includeCustomer: true,
    includeKitchen: true,
    includeWaiter: orderType === 'dine_in',
    includeRider: orderType === 'delivery',
    includeCashierManager: true,
    eventKey: 'orderPlaced',
  });
  if (targetRoles.length === 0) return;

  await insertAndBroadcastNotification({
    id: `notif-placed-${order.id}`,
    title,
    message,
    type: 'success',
    category,
    branchId: order.branchId || 'gulberg-lahore',
    orderId: order.id,
    orderNumber,
    orderType,
    senderId: order.cashierId || order.customerId || 'system',
    senderName: order.cashierName || order.customerName || 'Order Desk',
    senderRole: order.isWalkIn ? 'cashier' : 'customer',
    targetRoles,
    targetPlatform: settings.defaultPlatform || 'all',
    targetUserId: order.customerId,
    targetCustomerPhone: order.customerPhone,
    targetCustomerName: order.customerName,
    targetWaiterId: orderType === 'dine_in' ? waiterId : undefined,
    targetWaiterName: orderType === 'dine_in' ? waiterName : undefined,
    targetRiderId: orderType === 'delivery' ? riderId : undefined,
    targetRiderName: orderType === 'delivery' ? riderName : undefined,
  });
}

export async function emitOrderUpdatedNotification(params: {
  order: any;
  oldStatus?: string;
  newStatus?: string;
  sentToKitchen?: boolean;
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  assignedRiderId?: string;
  assignedRiderName?: string;
  riderStatus?: string;
  paymentStatus?: string;
  oldPaymentStatus?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
}): Promise<void> {
  const { order, oldStatus, newStatus, sentToKitchen, assignedWaiterId, assignedWaiterName, assignedRiderId, assignedRiderName, riderStatus, paymentStatus, oldPaymentStatus, actorId, actorName, actorRole } = params;
  if (!order) return;

  const settings = await getNotificationSettings();
  const orderNumber = String(order.orderNumber || order.id || '');
  const orderType: OrderType = order.type || 'dine_in';
  const branchId = order.branchId || 'gulberg-lahore';
  const baseCategory: NotificationCategory =
    orderType === 'takeaway' ? 'takeaway' : orderType === 'delivery' ? 'delivery' : 'dine_in';
  const resolvedStaff = await resolveOrderWaiterAndRider(order);
  const waiterId = assignedWaiterId || resolvedStaff.waiterId;
  const waiterName = assignedWaiterName || resolvedStaff.waiterName;
  const riderId = assignedRiderId || resolvedStaff.riderId;
  const riderName = assignedRiderName || resolvedStaff.riderName;

  if (sentToKitchen && newStatus !== 'preparing' && newStatus !== 'ready' && settings.events.sentToKitchen) {
    const targetRoles = buildFilteredTargetRoles(settings, orderType, {
      includeCustomer: true,
      includeKitchen: true,
      includeWaiter: orderType === 'dine_in',
      includeRider: false,
      includeCashierManager: true,
      eventKey: 'sentToKitchen',
    });
    if (targetRoles.length > 0) {
      await insertAndBroadcastNotification({
        title: `Order #${orderNumber} Sent to Kitchen`,
        message: `${orderType === 'takeaway' ? 'Takeaway' : orderType === 'delivery' ? 'Delivery' : 'Dine-In'} order #${orderNumber} has been forwarded to the kitchen for preparation.`,
        type: 'info',
        category: 'kitchen',
        branchId,
        orderId: order.id,
        orderNumber,
        orderType,
        senderId: actorId || 'system',
        senderName: actorName || 'Cashier / Support',
        senderRole: (actorRole as Role) || 'cashier',
        targetRoles,
        targetPlatform: settings.defaultPlatform || 'all',
        targetUserId: order.customerId,
        targetCustomerPhone: order.customerPhone,
        targetCustomerName: order.customerName,
        targetWaiterId: orderType === 'dine_in' ? waiterId : undefined,
        targetWaiterName: orderType === 'dine_in' ? waiterName : undefined,
      });
    }
  }

  if (newStatus && newStatus !== oldStatus) {
    let eventEnabled = true;
    let title = `Order #${orderNumber} ${newStatus.replace(/_/g, ' ').toUpperCase()}`;
    let message = `Order #${orderNumber} is now ${newStatus.replace(/_/g, ' ')}.`;
    let type: AppNotification['type'] = 'info';
    let category: NotificationCategory = baseCategory;
    let targetRoles: Array<Role | 'all'> = [];

    if (newStatus === 'preparing') {
      eventEnabled = settings.events.cooking;
      title = `Order #${orderNumber} • Cooking in Kitchen 👨‍🍳`;
      message = `Our chefs are actively preparing your fresh ${orderType === 'takeaway' ? 'Takeaway' : orderType === 'delivery' ? 'Delivery' : 'Dine-In'} order #${orderNumber}.`;
      category = 'kitchen';
      targetRoles = buildFilteredTargetRoles(settings, orderType, {
        includeCustomer: true,
        includeKitchen: true,
        includeWaiter: orderType === 'dine_in',
        includeRider: orderType === 'delivery',
        includeCashierManager: true,
        eventKey: 'cooking',
      });
    } else if (newStatus === 'ready') {
      eventEnabled = settings.events.orderReady;
      type = 'success';
      if (orderType === 'takeaway') {
        title = `Order #${orderNumber} • Ready for Pickup! 🛍️`;
        message = `Your Takeaway order #${orderNumber} is hot, packed, and ready at the counter!`;
        category = 'takeaway';
      } else if (orderType === 'dine_in') {
        title = `Order #${orderNumber} • Ready to Serve 🍽️`;
        message = `Your Dine-In order #${orderNumber}${order.tableNumber ? ` (Table ${order.tableNumber})` : ''} is ready and being served to your table!`;
        category = 'dine_in';
      } else {
        title = `Order #${orderNumber} • Packed & Ready 🛵`;
        message = `Your Delivery order #${orderNumber} is packed and ready for rider dispatch.`;
        category = 'delivery';
      }
      targetRoles = buildFilteredTargetRoles(settings, orderType, {
        includeCustomer: true,
        includeKitchen: false,
        includeWaiter: orderType === 'dine_in',
        includeRider: orderType === 'delivery',
        includeCashierManager: true,
        eventKey: 'orderReady',
      });
    } else if (newStatus === 'out_for_delivery') {
      eventEnabled = settings.events.outForDelivery;
      title = `Order #${orderNumber} • Out for Delivery 🛵`;
      message = `${riderName || 'Your delivery rider'} is on the way with your order #${orderNumber}!`;
      category = 'delivery';
      targetRoles = buildFilteredTargetRoles(settings, 'delivery', {
        includeCustomer: true,
        includeRider: true,
        includeCashierManager: true,
        eventKey: 'outForDelivery',
      });
    } else if (newStatus === 'served') {
      eventEnabled = settings.events.orderServed;
      type = 'success';
      title = `Order #${orderNumber} • Served 🍽️`;
      message = `Your order #${orderNumber} has been served at Table ${order.tableNumber || '-'}. Enjoy your meal!`;
      category = 'dine_in';
      targetRoles = buildFilteredTargetRoles(settings, 'dine_in', {
        includeCustomer: true,
        includeWaiter: true,
        includeCashierManager: true,
        eventKey: 'orderServed',
      });
    } else if (newStatus === 'completed' || newStatus === 'delivered' || newStatus === 'taken') {
      eventEnabled = settings.events.orderCompleted;
      type = 'success';
      title =
        orderType === 'takeaway'
          ? `Takeaway Order #${orderNumber} Picked Up ✓`
          : orderType === 'delivery'
          ? `Order #${orderNumber} Delivered ✓`
          : `Order #${orderNumber} Completed ✓`;
      message = `Your order #${orderNumber} has been completed. Thank you for dining with Foodies Cafe!`;
      targetRoles = buildFilteredTargetRoles(settings, orderType, {
        includeCustomer: true,
        includeWaiter: orderType === 'dine_in',
        includeRider: orderType === 'delivery',
        includeCashierManager: true,
        eventKey: 'orderCompleted',
      });
    } else if (newStatus === 'cancelled') {
      eventEnabled = settings.events.orderCancelled;
      type = 'error';
      title = `Order #${orderNumber} • Cancelled`;
      message = `Order #${orderNumber} was cancelled${order.notes ? `: ${order.notes}` : '.'}`;
      targetRoles = buildFilteredTargetRoles(settings, orderType, {
        includeCustomer: true,
        includeKitchen: true,
        includeWaiter: orderType === 'dine_in',
        includeRider: orderType === 'delivery',
        includeCashierManager: true,
        eventKey: 'orderCancelled',
      });
    } else {
      targetRoles = buildFilteredTargetRoles(settings, orderType, {
        includeCustomer: true,
        includeWaiter: orderType === 'dine_in',
        includeRider: orderType === 'delivery',
        includeCashierManager: true,
      });
    }

    if (eventEnabled && targetRoles.length > 0) {
      await insertAndBroadcastNotification({
        title,
        message,
        type,
        category,
        branchId,
        orderId: order.id,
        orderNumber,
        orderType,
        senderId: actorId || 'system',
        senderName: actorName || 'Foodies Cafe',
        senderRole: (actorRole as Role) || 'cashier',
        targetRoles,
        targetPlatform: settings.defaultPlatform || 'all',
        targetUserId: order.customerId,
        targetCustomerPhone: order.customerPhone,
        targetCustomerName: order.customerName,
        targetWaiterId: orderType === 'dine_in' ? waiterId : undefined,
        targetWaiterName: orderType === 'dine_in' ? waiterName : undefined,
        targetRiderId: orderType === 'delivery' ? riderId : undefined,
        targetRiderName: orderType === 'delivery' ? riderName : undefined,
      });
    }
  }

  if (assignedWaiterId && newStatus !== 'cancelled' && settings.events.waiterAssigned) {
    const targetRoles = buildFilteredTargetRoles(settings, 'dine_in', {
      includeCustomer: true,
      includeWaiter: true,
      includeCashierManager: true,
      eventKey: 'waiterAssigned',
    });
    if (targetRoles.length > 0) {
      await insertAndBroadcastNotification({
        title: `Waiter Assigned • Order #${orderNumber}`,
        message: `${waiterName || 'Floor Staff'} is now serving Table ${order.tableNumber || ''} (Order #${orderNumber}).`,
        type: 'info',
        category: 'dine_in',
        branchId,
        orderId: order.id,
        orderNumber,
        orderType: 'dine_in',
        senderId: actorId || 'system',
        senderName: actorName || 'Cashier / Manager',
        senderRole: (actorRole as Role) || 'cashier',
        targetRoles,
        targetPlatform: settings.defaultPlatform || 'all',
        targetUserId: order.customerId,
        targetCustomerPhone: order.customerPhone,
        targetCustomerName: order.customerName,
        targetWaiterId: waiterId,
        targetWaiterName: waiterName,
      });
    }
  }

  if ((assignedRiderId || riderStatus === 'accepted') && newStatus !== 'cancelled' && settings.events.riderAssigned) {
    const targetRoles = buildFilteredTargetRoles(settings, 'delivery', {
      includeCustomer: true,
      includeRider: true,
      includeCashierManager: true,
      eventKey: 'riderAssigned',
    });
    if (targetRoles.length > 0) {
      await insertAndBroadcastNotification({
        title: riderStatus === 'accepted' ? `Rider Accepted Order #${orderNumber}` : `Rider Assigned • Order #${orderNumber}`,
        message: `${riderName || 'Delivery Rider'} ${riderStatus === 'accepted' ? 'accepted and started' : 'was assigned to'} Delivery Order #${orderNumber}.`,
        type: 'info',
        category: 'delivery',
        branchId,
        orderId: order.id,
        orderNumber,
        orderType: 'delivery',
        senderId: actorId || 'system',
        senderName: actorName || 'Dispatch Desk',
        senderRole: (actorRole as Role) || 'cashier',
        targetRoles,
        targetPlatform: settings.defaultPlatform || 'all',
        targetUserId: order.customerId,
        targetCustomerPhone: order.customerPhone,
        targetCustomerName: order.customerName,
        targetRiderId: riderId,
        targetRiderName: riderName,
      });
    }
  }

  if (paymentStatus === 'paid' && oldPaymentStatus !== 'paid' && settings.events.paymentReceived) {
    const targetRoles = buildFilteredTargetRoles(settings, orderType, {
      includeCustomer: true,
      includeWaiter: orderType === 'dine_in',
      includeRider: orderType === 'delivery',
      includeCashierManager: true,
    });
    if (targetRoles.length > 0) {
      await insertAndBroadcastNotification({
        title: `Payment Received • Order #${orderNumber}`,
        message: `Rs. ${Number(order.total || 0).toLocaleString()} settled for Order #${orderNumber} (${order.paymentMethod || 'Cash'}).`,
        type: 'success',
        category: baseCategory,
        branchId,
        orderId: order.id,
        orderNumber,
        orderType,
        senderId: actorId || 'system',
        senderName: actorName || 'Cashier',
        senderRole: (actorRole as Role) || 'cashier',
        targetRoles,
        targetPlatform: settings.defaultPlatform || 'all',
        targetUserId: order.customerId,
        targetCustomerPhone: order.customerPhone,
        targetCustomerName: order.customerName,
        targetWaiterId: orderType === 'dine_in' ? waiterId : undefined,
        targetWaiterName: orderType === 'dine_in' ? waiterName : undefined,
        targetRiderId: orderType === 'delivery' ? riderId : undefined,
        targetRiderName: orderType === 'delivery' ? riderName : undefined,
      });
    }
  }
}
