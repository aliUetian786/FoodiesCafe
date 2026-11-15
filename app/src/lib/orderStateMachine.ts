import { PoolClient } from 'pg';
import { cacheGet, cacheSet } from '@/lib/redis';

export const ORDER_STATUS_RANK: Record<string, number> = {
  placed: 1,
  accepted: 2,
  preparing: 3,
  ready: 4,
  out_for_delivery: 5,
  served: 6,
  delivered: 6,
  taken: 6,
  completed: 7,
  cancelled: 99,
};

/**
 * Valid forward transitions on the server state machine:
 * placed -> accepted -> preparing -> ready -> (out_for_delivery | served | delivered | taken) -> completed
 * plus cancellation (before completed).
 */
const ALLOWED_NEXT_STATUSES: Record<string, Set<string>> = {
  placed: new Set(['placed', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'served', 'delivered', 'taken', 'completed', 'cancelled']),
  accepted: new Set(['accepted', 'preparing', 'ready', 'out_for_delivery', 'served', 'delivered', 'taken', 'completed', 'cancelled']),
  preparing: new Set(['preparing', 'ready', 'out_for_delivery', 'served', 'delivered', 'taken', 'completed', 'cancelled']),
  ready: new Set(['ready', 'out_for_delivery', 'served', 'delivered', 'taken', 'completed', 'cancelled']),
  out_for_delivery: new Set(['out_for_delivery', 'delivered', 'completed', 'cancelled']),
  served: new Set(['served', 'completed', 'cancelled']),
  delivered: new Set(['delivered', 'completed', 'cancelled']),
  taken: new Set(['taken', 'completed', 'cancelled']),
  completed: new Set(['completed']),
  cancelled: new Set(['cancelled']),
};

export function validateStatusTransition(
  currentStatus: string,
  nextStatus: string,
  actorRole?: string | null
): { valid: boolean; reason?: string } {
  if (!nextStatus || currentStatus === nextStatus) {
    return { valid: true };
  }

  // Cashier and authorized staff can cancel an order regardless of what state the order is in.
  if (nextStatus === 'cancelled') {
    if (actorRole === 'customer') {
      if (currentStatus !== 'placed') {
        return {
          valid: false,
          reason: `Order cannot be cancelled once accepted by customer support (current status: '${currentStatus}'). Contact customer support for assistance.`,
        };
      }
    }
    // For cashier, manager, owner, or general staff: cancellation is permitted from any state
    return { valid: true };
  }

  if (currentStatus === 'completed') {
    return {
      valid: false,
      reason: `Cannot transition order from terminal status 'completed' to '${nextStatus}'.`,
    };
  }

  if (currentStatus === 'cancelled') {
    return {
      valid: false,
      reason: `Cannot transition order from terminal status 'cancelled' to '${nextStatus}'.`,
    };
  }

  const allowedSet = ALLOWED_NEXT_STATUSES[currentStatus];
  if (!allowedSet || !allowedSet.has(nextStatus)) {
    const currRank = ORDER_STATUS_RANK[currentStatus] ?? 0;
    const nextRank = ORDER_STATUS_RANK[nextStatus] ?? 0;
    if (nextRank < currRank) {
      return {
        valid: false,
        reason: `Illegal backward status transition from '${currentStatus}' to '${nextStatus}'.`,
      };
    }
    return {
      valid: false,
      reason: `Illegal status transition from '${currentStatus}' to '${nextStatus}'.`,
    };
  }

  return { valid: true };
}

/**
 * Parses openingHours strings like "11:00 AM - 1:00 AM" or "12:00 PM - 12:00 AM".
 * Returns true if current time in Pakistan Standard Time (UTC+5) is within the window,
 * or if the format is custom/unparseable.
 */
export function isWithinOpeningHours(openingHours?: string | null): boolean {
  if (!openingHours || typeof openingHours !== 'string') return true;
  const match = openingHours.match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );
  if (!match) return true;

  // Enforce strict hours check only when ENFORCE_OPENING_HOURS=true is set in env,
  // since branch.is_open is the primary live switch toggled by managers/owners during tests/rushes.
  if (process.env.ENFORCE_OPENING_HOURS !== 'true') {
    return true;
  }

  const toMinutes = (hStr: string, mStr: string, mer: string) => {
    let h = parseInt(hStr, 10) % 12;
    if (mer.toUpperCase() === 'PM') h += 12;
    return h * 60 + parseInt(mStr, 10);
  };

  const openMin = toMinutes(match[1], match[2], match[3]);
  const closeMin = toMinutes(match[4], match[5], match[6]);

  // Pakistan Standard Time (UTC+5)
  const nowUtcMs = Date.now() + new Date().getTimezoneOffset() * 60000;
  const pktDate = new Date(nowUtcMs + 5 * 3600 * 1000);
  const currentMin = pktDate.getHours() * 60 + pktDate.getMinutes();

  if (closeMin <= openMin) {
    // Overnight window (e.g. 11:00 AM to 01:00 AM)
    return currentMin >= openMin || currentMin <= closeMin;
  }
  return currentMin >= openMin && currentMin <= closeMin;
}

export interface ServerRecalculatedTotals {
  items: any[];
  originalSubtotal: number;
  addOnSubtotal: number;
  tax: number;
  total: number;
}

/**
 * Recalculates item unit prices and order totals on the server using PostgreSQL menu_items
 * and branch_price_overrides.
 */
export async function recalculateOrderItemsOnServer(
  client: PoolClient,
  branchId: string,
  rawItems: any[],
  options: { checkAvailability?: boolean; allowCustomPricing?: boolean } = { checkAvailability: true, allowCustomPricing: false }
): Promise<{
  ok: boolean;
  error?: string;
  unavailableItems?: string[];
  calculated?: ServerRecalculatedTotals;
}> {
  let menuRows = await cacheGet<any[]>('menu:raw_rows');
  if (!menuRows) {
    const menuRes = await client.query(
      `SELECT id, name, base_price, is_available, branch_availability, branch_price_overrides, sizes, extras
       FROM menu_items`
    );
    menuRows = menuRes.rows;
    await cacheSet('menu:raw_rows', menuRows, 20);
  }

  const byId = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const row of menuRows) {
    byId.set(row.id, row);
    if (row.name) byName.set(String(row.name).toLowerCase().trim(), row);
  }

  const unavailableItems: string[] = [];
  let originalSubtotal = 0;
  let addOnSubtotal = 0;

  const recalculatedItems = rawItems.map((item) => {
    const dbDish =
      byId.get(item.menuItemId) ||
      byId.get(item.id) ||
      (item.name ? byName.get(String(item.name).toLowerCase().trim()) : undefined);

    const qty = Math.max(1, Number(item.quantity) || 1);

    if (!dbDish) {
      if (!options.allowCustomPricing) {
        unavailableItems.push(item.name || 'Custom Item (Staff Only)');
      }
      // If custom/walk-in item not in menu_items table and custom pricing is allowed:
      const fallbackPrice = Math.max(0, Number(item.unitPrice) || 0);
      if (item.isAddOn) {
        addOnSubtotal += fallbackPrice * qty;
      } else {
        originalSubtotal += fallbackPrice * qty;
      }
      return {
        ...item,
        unitPrice: fallbackPrice,
        quantity: qty,
      };
    }

    const branchAvail =
      typeof dbDish.branch_availability === 'string'
        ? JSON.parse(dbDish.branch_availability || '{}')
        : dbDish.branch_availability || {};

    if (options.checkAvailability && !item.isAddOn) {
      if (dbDish.is_available === false || branchAvail[branchId] === false) {
        unavailableItems.push(dbDish.name || item.name);
      }
    }

    const overrides =
      typeof dbDish.branch_price_overrides === 'string'
        ? JSON.parse(dbDish.branch_price_overrides || '{}')
        : dbDish.branch_price_overrides || {};

    let unitPrice =
      overrides[branchId] !== undefined &&
      overrides[branchId] !== null &&
      !isNaN(Number(overrides[branchId])) &&
      Number(overrides[branchId]) > 0
        ? Number(overrides[branchId])
        : Number(dbDish.base_price) || 0;

    const sizes =
      typeof dbDish.sizes === 'string' ? JSON.parse(dbDish.sizes || '[]') : dbDish.sizes || [];
    if (item.size && Array.isArray(sizes)) {
      const matchedSize = sizes.find(
        (s: any) => String(s.name).toLowerCase() === String(item.size).toLowerCase()
      );
      if (matchedSize) {
        unitPrice += Number(matchedSize.priceDelta) || 0;
      }
    }

    const extras =
      typeof dbDish.extras === 'string' ? JSON.parse(dbDish.extras || '[]') : dbDish.extras || [];
    if (Array.isArray(item.extras) && Array.isArray(extras)) {
      for (const extName of item.extras) {
        const matchedExtra = extras.find(
          (e: any) => String(e.name).toLowerCase() === String(extName).toLowerCase()
        );
        if (matchedExtra) {
          unitPrice += Number(matchedExtra.price) || 0;
        }
      }
    }

    unitPrice = Math.max(0, unitPrice);

    if (item.isAddOn) {
      addOnSubtotal += unitPrice * qty;
    } else {
      originalSubtotal += unitPrice * qty;
    }

    return {
      ...item,
      menuItemId: dbDish.id,
      name: dbDish.name || item.name,
      unitPrice,
      quantity: qty,
    };
  });

  if (unavailableItems.length > 0) {
    return {
      ok: false,
      error: `Unavailable item(s) at selected branch: ${unavailableItems.join(', ')}`,
      unavailableItems,
    };
  }

  const tax = 0; // Cash-inclusive pricing across FoodiesCafe branches
  const total = originalSubtotal + addOnSubtotal + tax;

  return {
    ok: true,
    calculated: {
      items: recalculatedItems,
      originalSubtotal,
      addOnSubtotal,
      tax,
      total,
    },
  };
}

/**
 * Records an immutable row in order_history inside the active transaction.
 */
export async function ensureOrderHistoryTable(client: PoolClient): Promise<void> {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_history (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        order_number VARCHAR(50) NOT NULL,
        branch_id VARCHAR(64) NOT NULL,
        actor_id VARCHAR(64) NOT NULL DEFAULT 'system',
        actor_name VARCHAR(255) NOT NULL DEFAULT 'System',
        actor_role VARCHAR(50) NOT NULL DEFAULT 'system',
        change_type VARCHAR(50) NOT NULL,
        old_status VARCHAR(30),
        new_status VARCHAR(30),
        old_payment_status VARCHAR(30),
        new_payment_status VARCHAR(30),
        old_total NUMERIC(10, 2),
        new_total NUMERIC(10, 2),
        version INT NOT NULL DEFAULT 1,
        details TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch {}
}

/**
 * Record an immutable audit log entry of order state changes.
 */
export async function recordOrderHistory(
  client: PoolClient,
  entry: {
    orderId: string;
    orderNumber: string;
    branchId: string;
    actorId?: string | null;
    actorName?: string | null;
    actorRole?: string | null;
    changeType: string;
    oldStatus?: string | null;
    newStatus?: string | null;
    oldPaymentStatus?: string | null;
    newPaymentStatus?: string | null;
    oldTotal?: number | null;
    newTotal?: number | null;
    version: number;
    details?: string | null;
    payload?: any;
  }
) {
  try {
    await ensureOrderHistoryTable(client);
    const historyId = `oh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await client.query(
      `INSERT INTO order_history (
        id, order_id, order_number, branch_id,
        actor_id, actor_name, actor_role, change_type,
        old_status, new_status, old_payment_status, new_payment_status,
        old_total, new_total, version, details, payload, created_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17::jsonb, CURRENT_TIMESTAMP
      )`,
      [
        historyId,
        entry.orderId,
        entry.orderNumber,
        entry.branchId,
        entry.actorId || 'system',
        entry.actorName || 'System',
        entry.actorRole || 'system',
        entry.changeType,
        entry.oldStatus || null,
        entry.newStatus || null,
        entry.oldPaymentStatus || null,
        entry.newPaymentStatus || null,
        entry.oldTotal ?? null,
        entry.newTotal ?? null,
        entry.version,
        entry.details || null,
        entry.payload ? JSON.stringify(entry.payload) : null,
      ]
    );
  } catch (err) {
    // Non-fatal if order_history logging encounters an issue; order status update must never be aborted
    console.warn('[recordOrderHistory] Non-fatal history write warning:', err);
  }
}

export function formatOrderRow(row: any) {
  if (!row) return null;
  const rawItems = row.items;
  const parsedItems = Array.isArray(rawItems)
    ? rawItems
    : typeof rawItems === 'string'
    ? JSON.parse(rawItems || '[]')
    : [];
  let status = row.status || 'placed';
  const rawPaymentStatus = row.paymentStatus ?? row.payment_status ?? 'unpaid';
  const rawPaymentCollected = Boolean(row.paymentCollected ?? row.payment_collected);
  const rawRiderStatus = row.riderStatus ?? row.rider_status ?? undefined;

  // Normalization: When an order is delivered, paid and served, or staff marks it paid, it is terminal COMPLETED
  const isPaidSettled = rawPaymentStatus === 'paid' || rawPaymentCollected;
  if (
    status === 'completed' ||
    (row.type === 'delivery' && isPaidSettled && (status === 'delivered' || rawRiderStatus === 'delivered')) ||
    (row.type === 'dine_in' && isPaidSettled && (status === 'served' || status === 'completed')) ||
    (row.type === 'takeaway' && isPaidSettled && (status === 'taken' || status === 'completed'))
  ) {
    status = 'completed';
  }

  const sentToKitchenRaw = row.sentToKitchen ?? row.sent_to_kitchen;
  return {
    id: row.id,
    orderNumber: row.orderNumber ?? row.order_number,
    branchId: row.branchId ?? row.branch_id,
    customerId: row.customerId ?? row.customer_id,
    customerName: row.customerName ?? row.customer_name,
    customerPhone: row.customerPhone ?? row.customer_phone,
    customerEmail: row.customerEmail ?? row.customer_email ?? undefined,
    type: row.type,
    tableNumber: row.tableNumber ?? row.table_number ?? undefined,
    tablePin: row.tablePin ?? row.table_pin ?? undefined,
    pickupTime: row.pickupTime ?? row.pickup_time ?? undefined,
    status,
    paymentStatus: (status === 'completed' || isPaidSettled) && rawPaymentStatus !== 'refunded' ? 'paid' : rawPaymentStatus,
    paymentMethod: row.paymentMethod ?? row.payment_method ?? 'Cash',
    items: parsedItems.map((it: any) => ({
      ...it,
      unitPrice: Number(it.unitPrice) || 0,
      quantity: Number(it.quantity) || 1,
    })),
    originalSubtotal: Number(row.originalSubtotal ?? row.original_subtotal) || 0,
    addOnSubtotal: Number(row.addOnSubtotal ?? row.add_on_subtotal) || 0,
    tax: Number(row.tax) || 0,
    total: Number(row.total) || 0,
    createdAt: row.createdAt ?? row.created_at,
    preparationStartedAt: row.preparationStartedAt ?? row.preparation_started_at ?? undefined,
    readyTimeEstimated: row.readyTimeEstimated ?? row.ready_time_estimated ?? undefined,
    completedAt: row.completedAt ?? row.completed_at ?? undefined,
    notes: row.notes ?? undefined,
    deliveryAddress: row.deliveryAddress ?? row.delivery_address ?? undefined,
    version: Number(row.version) || 1,
    sentToKitchen: sentToKitchenRaw !== undefined ? Boolean(sentToKitchenRaw) : status !== 'placed',
    sentToKitchenAt: row.sentToKitchenAt ?? row.sent_to_kitchen_at ?? null,
    forwardToKitchenAt: row.forwardToKitchenAt ?? row.forward_to_kitchen_at ?? null,
    autoForwardCustomMin:
      (row.autoForwardCustomMin ?? row.auto_forward_custom_min)
        ? Number(row.autoForwardCustomMin ?? row.auto_forward_custom_min)
        : undefined,
    cashierId: row.cashierId ?? row.cashier_id ?? undefined,
    cashierName: row.cashierName ?? row.cashier_name ?? undefined,
    isWalkIn: Boolean(row.isWalkIn ?? row.is_walk_in),
    assignedRiderId: row.assignedRiderId ?? row.assigned_rider_id ?? undefined,
    assignedRiderName: row.assignedRiderName ?? row.assigned_rider_name ?? undefined,
    riderStatus: row.riderStatus ?? row.rider_status ?? undefined,
    deliveredAt: row.deliveredAt ?? row.delivered_at ?? undefined,
    paymentCollected: Boolean(row.paymentCollected ?? row.payment_collected),
    customerCoordinates: row.customerCoordinates ?? row.customer_coordinates ?? undefined,
    assignedWaiterId: row.assignedWaiterId ?? row.assigned_waiter_id ?? undefined,
    assignedWaiterName: row.assignedWaiterName ?? row.assigned_waiter_name ?? undefined,
    isTableQr: Boolean(row.isTableQr ?? row.is_table_qr),
    waiterNotified: Boolean(row.waiterNotified ?? row.waiter_notified),
  };
}

