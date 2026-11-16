import { NextResponse } from 'next/server';
import { applyBranchSchedules } from '@/lib/branchSchedule';
import type { PoolClient } from 'pg';
import { query, withTransaction, optionalQuery } from '@/lib/db';
import { createOrderSchema, updateOrderSchema } from '@/lib/validations';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '@/lib/redis';
import {
  ORDER_STATUS_RANK,
  validateStatusTransition,
  isWithinOpeningHours,
  recalculateOrderItemsOnServer,
  recordOrderHistory,
  formatOrderRow,
} from '@/lib/orderStateMachine';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { writeAuditLog, getAuthFromRequest } from '@/lib/auth';
import { enqueueNotificationJob, scheduleReadyIn10MinNotice } from '@/lib/jobs';
import { logger, generateRequestId } from '@/lib/logger';
import { recordRequestMetric, recordOrderToReadyDuration } from '@/lib/metrics';
import { emitOrderPlacedNotification, emitOrderUpdatedNotification } from '@/lib/notifications';

function normalizeBranchId(id?: string): string {
  if (!id) return 'gulberg-lahore';
  if (id === 'all') return 'all';
  if (id === 'branch-gulberg' || id.includes('gulberg')) return 'gulberg-lahore';
  if (id === 'branch-f7' || id.includes('f7') || id.includes('islamabad')) return 'f7-islamabad';
  if (id === 'branch-clifton' || id.includes('clifton') || id.includes('karachi')) return 'clifton-karachi';
  return id;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const customerPhone = searchParams.get('customerPhone');
    const dateScope = searchParams.get('dateScope');
    const older = searchParams.get('older');
    const orderIdForHistory = searchParams.get('historyForOrderId');

    // Optional history lookup for a specific order
    if (orderIdForHistory) {
      const histRes = await query(
        `SELECT id, order_id as "orderId", order_number as "orderNumber",
                branch_id as "branchId", actor_id as "actorId", actor_name as "actorName",
                actor_role as "actorRole", change_type as "changeType",
                old_status as "oldStatus", new_status as "newStatus",
                old_payment_status as "oldPaymentStatus", new_payment_status as "newPaymentStatus",
                old_total as "oldTotal", new_total as "newTotal",
                version, details, payload, created_at as "createdAt"
         FROM order_history
         WHERE order_id = $1 OR order_number = $1
         ORDER BY created_at DESC LIMIT 100`,
        [orderIdForHistory]
      ).catch(() => ({ rows: [] }));
      return NextResponse.json({ history: histRes.rows });
    }

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const cursor = searchParams.get('cursor');
    const customerId = searchParams.get('customerId');
    const rawLimit = parseInt(searchParams.get('limit') || '100', 10);
    const fetchAllHistory = dateScope === 'all' || older === 'true' || Boolean(customerPhone) || Boolean(customerId);
    const pageLimit = Math.min(Math.max(1, isNaN(rawLimit) ? 100 : rawLimit), fetchAllHistory ? 250 : 150);

    let sql = `
      SELECT id, order_number as "orderNumber", branch_id as "branchId",
             customer_id as "customerId", customer_name as "customerName", customer_phone as "customerPhone",
             customer_email as "customerEmail",
             type, table_number as "tableNumber", table_pin as "tablePin", pickup_time as "pickupTime",
             status, payment_status as "paymentStatus", payment_method as "paymentMethod",
             items, original_subtotal as "originalSubtotal", add_on_subtotal as "addOnSubtotal",
             tax, total, created_at as "createdAt",
             preparation_started_at as "preparationStartedAt",
             ready_time_estimated as "readyTimeEstimated",
             completed_at as "completedAt",
             notes, delivery_address as "deliveryAddress", version,
             sent_to_kitchen as "sentToKitchen",
             sent_to_kitchen_at as "sentToKitchenAt",
             forward_to_kitchen_at as "forwardToKitchenAt",
             auto_forward_custom_min as "autoForwardCustomMin",
             cashier_id as "cashierId",
             cashier_name as "cashierName",
             is_walk_in as "isWalkIn",
             assigned_rider_id as "assignedRiderId",
             assigned_rider_name as "assignedRiderName",
             rider_status as "riderStatus",
             delivered_at as "deliveredAt",
             payment_collected as "paymentCollected",
             customer_coordinates as "customerCoordinates",
             assigned_waiter_id as "assignedWaiterId",
             assigned_waiter_name as "assignedWaiterName",
             is_table_qr as "isTableQr",
             waiter_notified as "waiterNotified"
      FROM orders
    `;
    const params: any[] = [];
    const whereClauses: string[] = [];

    const auth = getAuthFromRequest(request);
    const isStaff = auth.authenticated && auth.role !== 'customer';
    const isOwner = auth.authenticated && auth.role === 'platform_owner';

    // Staff branch isolation: Staff (except platform_owner) can ONLY see their assigned branch
    if (isStaff && !isOwner) {
      const assignedBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      params.push(assignedBranch);
      whereClauses.push(`branch_id = $${params.length}`);
    } else if (branchId && branchId !== 'all') {
      const normBId = normalizeBranchId(branchId);
      params.push(branchId, normBId);
      whereClauses.push(`(branch_id = $${params.length - 1} OR branch_id = $${params.length})`);
    }

    // Customer scoping:
    if (!isStaff && !isOwner) {
      // Customer / Guest scope: Must match their user ID or phone or placed orders
      if (auth.authenticated && auth.role === 'customer') {
        params.push(auth.userId);
        whereClauses.push(`customer_id = $${params.length}`);
      } else if (customerId) {
        params.push(customerId);
        whereClauses.push(`customer_id = $${params.length}`);
      } else if (customerPhone) {
        params.push(customerPhone);
        whereClauses.push(`customer_phone = $${params.length}`);
      } else {
        // Unauthenticated anonymous query with no customer identifier:
        // Return empty orders to prevent dumping the entire multi-branch database
        return NextResponse.json({ orders: [], nextCursor: null, hasMore: false });
      }
    } else {
      if (customerId) {
        params.push(customerId);
        whereClauses.push(`customer_id = $${params.length}`);
      } else if (customerPhone) {
        params.push(customerPhone);
        whereClauses.push(`customer_phone = $${params.length}`);
      }
    }

    const isMultiDayOrOlder = older === 'true' || dateScope === 'all' || dateScope === 'yesterday' || dateScope === 'week' || dateScope === 'month' || Boolean(startDate) || Boolean(endDate);

    if (startDate || endDate) {
      if (startDate) {
        params.push(startDate);
        whereClauses.push(`created_at >= $${params.length}`);
      }
      if (endDate) {
        params.push(endDate);
        whereClauses.push(`created_at <= $${params.length}`);
      }
    } else if (dateScope === 'yesterday') {
      whereClauses.push(`(created_at >= (CURRENT_DATE - INTERVAL '1 day') AND created_at < CURRENT_DATE)`);
    } else if (dateScope === 'week') {
      whereClauses.push(`created_at >= (NOW() - INTERVAL '7 days')`);
    } else if (dateScope === 'month') {
      whereClauses.push(`created_at >= (NOW() - INTERVAL '30 days')`);
    } else if (dateScope === 'today' || (!isMultiDayOrOlder && !customerId && !customerPhone)) {
      // Default live scope: ONLY load today's data and active orders. Data of older days is loaded on-demand.
      whereClauses.push(`(created_at >= CURRENT_DATE OR status IN ('placed', 'accepted', 'preparing', 'ready', 'served', 'out_for_delivery'))`);
    }

    if (cursor) {
      params.push(cursor);
      whereClauses.push(`created_at < $${params.length}`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY created_at DESC LIMIT ${pageLimit + 1}`;

    const res = await query(sql, params);
    const hasMore = res.rows.length > pageLimit;
    const slicedRows = hasMore ? res.rows.slice(0, pageLimit) : res.rows;
    const orders = slicedRows.map((row: any) => formatOrderRow(row));
    const nextCursor =
      hasMore && orders.length > 0 ? orders[orders.length - 1]?.createdAt || null : null;

    return NextResponse.json({ orders, nextCursor, hasMore });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch orders from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

/** Allocates an unused order number (FC-#### first, widening to more digits if that space is crowded). */
async function generateUniqueOrderNumber(client: PoolClient): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const digits = attempt < 8 ? 4 : attempt < 14 ? 5 : 6;
    const min = 10 ** (digits - 1);
    const candidate = `FC-${Math.floor(min + Math.random() * 9 * min)}`;
    const taken = await client.query(`SELECT 1 FROM orders WHERE order_number = $1 LIMIT 1`, [candidate]);
    if (taken.rows.length === 0) return candidate;
  }
  return `FC-${Date.now().toString().slice(-8)}`;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const requestId = generateRequestId(request);
  try {
    const body = await request.json();

    // Zod Schema Validation
    const validation = createOrderSchema.safeParse(body);
    if (!validation.success) {
      recordRequestMetric('POST /api/orders', Date.now() - startTime, 400);
      return NextResponse.json(
        {
          error: 'Validation failed for order creation',
          validationErrors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const headerIdempotencyKey =
      request.headers.get('Idempotency-Key') ||
      request.headers.get('idempotency-key') ||
      request.headers.get('X-Idempotency-Key') ||
      body.idempotencyKey ||
      null;

    // Rate limit order placement per IP & account (skip if idempotent replay check matches)
    const clientIp = getClientIp(request);
    const rlOrder = await checkRateLimit({
      scope: 'order_place',
      identifier: `${body.customerId || body.customerPhone || 'anon'}:${clientIp}`,
      maxRequests: Number(process.env.RATE_LIMIT_ORDERS_PER_MIN || 30),
      windowSeconds: 60,
    });
    if (!rlOrder.allowed && !headerIdempotencyKey) {
      recordRequestMetric('POST /api/orders', Date.now() - startTime, 429);
      return NextResponse.json(
        { error: `Too many order attempts. Please wait ${rlOrder.resetInSeconds}s.` },
        { status: 429 }
      );
    }

    const {
      id,
      orderNumber: requestedOrderNumber,
      branchId,
      customerId = 'user-guest',
      customerName,
      customerPhone,
      customerEmail,
      type,
      tableNumber,
      tablePin,
      pickupTime,
      status = 'placed',
      paymentStatus = 'unpaid',
      paymentMethod = 'Cash',
      items,
      notes,
      deliveryAddress,
      createdAt,
      sentToKitchen = false,
      sentToKitchenAt = null,
      forwardToKitchenAt = null,
      autoForwardCustomMin = null,
      cashierId = null,
      cashierName = null,
      isWalkIn = false,
      assignedRiderId = null,
      assignedRiderName = null,
      riderStatus = null,
      deliveredAt = null,
      paymentCollected = false,
      customerCoordinates = null,
      assignedWaiterId = null,
      assignedWaiterName = null,
      isTableQr = false,
      waiterNotified = false,
      actorId,
      actorName,
      actorRole,
    } = body;

    const normBranchId = normalizeBranchId(branchId);
    const finalOrderId = id || `ord-${Date.now()}`;
    // May be replaced inside the transaction if another order already uses this number.
    let orderNumber: string = requestedOrderNumber;

    const auth = getAuthFromRequest(request, body);
    const allowCustomPricing =
      auth.authenticated &&
      (auth.role === 'cashier' || auth.role === 'branch_manager' || auth.role === 'platform_owner');
    
    // Digital payment methods (Wallet, JazzCash, EasyPaisa, Card, Bank, Raast, Installment) represent paid transactions
    const isDigitalPrepaid =
      paymentMethod &&
      paymentMethod !== 'COD' &&
      paymentMethod !== 'Cash on Delivery (COD)' &&
      !paymentMethod.toLowerCase().includes('cash') &&
      !paymentMethod.toLowerCase().includes('unpaid');

    const safePaymentStatus =
      paymentStatus === 'paid'
        ? 'paid'
        : isDigitalPrepaid && paymentStatus !== 'unpaid'
        ? 'paid'
        : allowCustomPricing && paymentStatus === 'paid'
        ? 'paid'
        : 'unpaid';

    const isPaymentCollected = safePaymentStatus === 'paid' || Boolean(paymentCollected);

    // Fast-path Idempotency-Key cache check before acquiring a DB transaction lock
    if (headerIdempotencyKey) {
      const cachedIdemOrder = await cacheGet<any>(`idem:order:${headerIdempotencyKey}`);
      if (cachedIdemOrder) {
        const durationMs = Date.now() - startTime;
        recordRequestMetric('POST /api/orders', durationMs, 200);
        return NextResponse.json({
          success: true,
          idempotentReplay: true,
          order: cachedIdemOrder,
        });
      }
    }

    // Apply any due scheduled open/close before validating that the branch accepts orders.
    await applyBranchSchedules();

    const txResult = await withTransaction(async (client) => {
      // 1. Idempotency check (by Idempotency-Key, order id, or order_number)
      if (headerIdempotencyKey) {
        const existingByKey = await optionalQuery(client, `SELECT * FROM orders WHERE idempotency_key = $1 LIMIT 1`, [headerIdempotencyKey]);
        if (existingByKey.rows.length > 0) {
          return {
            status: 200,
            idempotentReplay: true,
            order: formatOrderRow(existingByKey.rows[0]),
          };
        }
      }

      const existingById = await client.query(`SELECT * FROM orders WHERE id = $1 LIMIT 1`, [finalOrderId]);
      if (existingById.rows.length > 0) {
        return {
          status: 200,
          idempotentReplay: true,
          order: formatOrderRow(existingById.rows[0]),
        };
      }

      // Clients pick a random 4-digit FC-#### number, so two different orders can collide.
      // Previously a collision was treated as a "replay" and the NEW order was silently dropped.
      const numberTaken = await client.query(`SELECT id FROM orders WHERE order_number = $1 LIMIT 1`, [orderNumber]);
      if (numberTaken.rows.length > 0) {
        orderNumber = await generateUniqueOrderNumber(client);
      }

      // 2. Validate Branch Open, Busy Pause & Hours (cached for 20s, invalidated on branch edits)
      const branchCacheKey = `branches:row:${normBranchId}`;
      let branch = await cacheGet<any>(branchCacheKey);
      if (!branch) {
        const branchRes = await client.query(
          `SELECT id, name, is_open, is_busy, opening_hours, delivery_enabled, prep_time_estimate_min, payment_settings FROM branches WHERE id = $1 LIMIT 1`,
          [normBranchId]
        );
        branch = branchRes.rows[0] || null;
        if (branch) {
          await cacheSet(branchCacheKey, branch, 5); // short: a just-closed branch must stop taking orders quickly
        }
      }
      let branchPrepTimeMin = 20;
      if (branch) {
        branchPrepTimeMin = Number(branch.prep_time_estimate_min) || 20;
        if (branch.is_open === false) {
          return {
            status: 400,
            error: `Branch '${branch.name}' is currently closed and not accepting new orders.`,
          };
        }
        const paymentSettings =
          typeof branch.payment_settings === 'string'
            ? (() => {
                try { return JSON.parse(branch.payment_settings); } catch { return {}; }
              })()
            : branch.payment_settings || {};
        if (
          branch.is_busy &&
          !isWalkIn &&
          (process.env.ENFORCE_BUSY_PAUSE === 'true' || paymentSettings.pauseOrderingWhenBusy === true)
        ) {
          return {
            status: 503,
            error: `Branch '${branch.name}' is in Busy Mode and has temporarily paused online ordering.`,
          };
        }
        if (!isWithinOpeningHours(branch.opening_hours)) {
          return {
            status: 400,
            error: `Branch '${branch.name}' is outside its operating hours (${branch.opening_hours}).`,
          };
        }
        if (type === 'delivery' && branch.delivery_enabled === false) {
          return {
            status: 400,
            error: `Delivery is currently disabled at '${branch.name}'.`,
          };
        }

        // 2b. Limit active unpaid orders per customer (PRD F20 abuse prevention)
        const maxActiveUnpaid = Number(
          paymentSettings.maxActiveUnpaidOrders || process.env.MAX_ACTIVE_UNPAID_ORDERS || 3
        );
        if (
          !isWalkIn &&
          customerId &&
          customerId !== 'user-guest' &&
          customerId !== 'cust-guest' &&
          customerId !== 'cust-walkin'
        ) {
          const unpaidCountRes = await client.query(
            `SELECT id FROM orders
             WHERE customer_id = $1 AND payment_status = 'unpaid'
               AND status != 'completed' AND status != 'cancelled'
               AND status != 'delivered' AND status != 'served' AND status != 'taken'`,
            [customerId]
          );
          const activeUnpaidCount = unpaidCountRes.rows.length;
          if (activeUnpaidCount >= maxActiveUnpaid) {
            return {
              status: 429,
              error: `You already have ${activeUnpaidCount} active unpaid orders (limit: ${maxActiveUnpaid}). Please complete or settle your existing orders first.`,
            };
          }
        }
      }

      // 3. Server-side item availability + price recalculation
      const calcResult = await recalculateOrderItemsOnServer(client, normBranchId, items || [], {
        checkAvailability: !isWalkIn,
        allowCustomPricing,
      });
      if (!calcResult.ok || !calcResult.calculated) {
        return {
          status: 400,
          error: calcResult.error || 'One or more items are unavailable.',
          unavailableItems: calcResult.unavailableItems,
        };
      }

      const {
        items: serverItems,
        originalSubtotal: serverOriginalSubtotal,
        addOnSubtotal: serverAddOnSubtotal,
        tax: serverTax,
        total: serverTotal,
      } = calcResult.calculated;

      // 4. Dine-In / Table QR atomic table lock & availability recheck at submit
      let effectiveAssignedWaiterId = assignedWaiterId || null;
      let effectiveAssignedWaiterName = assignedWaiterName || null;

      if (type === 'dine_in' && tableNumber) {
        const tableRes = await client.query(
          `SELECT id, number, status, current_order_id, allow_qr_reserved, assigned_waiter_id, assigned_waiter_name
           FROM tables
           WHERE branch_id = $1 AND (number = $2 OR id = $2 OR regexp_replace(number, '\\D', '', 'g') = regexp_replace($2, '\\D', '', 'g'))
           FOR UPDATE`,
          [normBranchId, String(tableNumber)]
        );

        if (tableRes.rows.length > 0) {
          const tbl = tableRes.rows[0];
          if (!effectiveAssignedWaiterId && tbl.assigned_waiter_id) {
            effectiveAssignedWaiterId = tbl.assigned_waiter_id;
            effectiveAssignedWaiterName = tbl.assigned_waiter_name || null;
          }

          const isOccupiedByAnotherOrder =
            tbl.status === 'occupied' &&
            tbl.current_order_id &&
            tbl.current_order_id !== finalOrderId &&
            tbl.current_order_id !== orderNumber;

          if (isOccupiedByAnotherOrder && !isWalkIn) {
            // Check if that order is still active
            const activeOrdRes = await client.query(
              `SELECT id, status FROM orders WHERE (id = $1 OR order_number = $1) AND status != 'completed' AND status != 'cancelled' LIMIT 1`,
              [tbl.current_order_id]
            );
            if (activeOrdRes.rows.length > 0) {
              return {
                status: 409,
                error: `Table ${tableNumber} is already occupied by an active dining session.`,
              };
            }
          }

          if (tbl.status === 'reserved' && isTableQr && !tbl.allow_qr_reserved) {
            return {
              status: 409,
              error: `Table ${tableNumber} is reserved and locked for QR self-ordering.`,
            };
          }

          // Update table to occupied
          await client.query(
            `UPDATE tables
             SET status = 'occupied', current_order_id = $1, seated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [finalOrderId, tbl.id]
          );

          // Ensure a single active table_session row using the partial unique index
          const existingSess = await client.query(
            `SELECT id FROM table_sessions WHERE branch_id = $1 AND table_number = $2 AND status = 'occupied' LIMIT 1`,
            [normBranchId, tableNumber]
          );
          if (existingSess.rows.length === 0) {
            await client
              .query(
                `INSERT INTO table_sessions (
                  id, table_id, table_number, branch_id, floor,
                  started_at, customer_name, order_id, order_number, total_amount, status
                ) VALUES ($1, $2, $3, $4, 'Ground Floor', CURRENT_TIMESTAMP, $5, $6, $7, $8, 'occupied')`,
                [
                  `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  tbl.id,
                  tableNumber,
                  normBranchId,
                  customerName,
                  finalOrderId,
                  orderNumber,
                  serverTotal,
                ]
              )
              .catch((sessErr: any) => {
                if (sessErr?.code === '23505') {
                  throw new Error(`CONFLICT_TABLE_SESSION: Table ${tableNumber} was just claimed by another guest.`);
                }
              });
          }
        }
      }

      // 5. Insert Order
      const insertSql = `
        INSERT INTO orders (
          id, order_number, branch_id, customer_id, customer_name, customer_phone, customer_email,
          type, table_number, table_pin, pickup_time, status, payment_status,
          payment_method, items, original_subtotal, add_on_subtotal, tax, total,
          notes, delivery_address, version, sent_to_kitchen, sent_to_kitchen_at,
          forward_to_kitchen_at, auto_forward_custom_min, cashier_id, cashier_name, is_walk_in,
          assigned_rider_id, assigned_rider_name, rider_status, delivered_at, payment_collected, customer_coordinates,
          assigned_waiter_id, assigned_waiter_name, is_table_qr, waiter_notified, idempotency_key,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15::jsonb, $16, $17, $18, $19,
          $20, $21, 1, $22, $23,
          $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34::jsonb,
          $35, $36, $37, $38, $39,
          COALESCE($40::timestamptz, CURRENT_TIMESTAMP)
        ) RETURNING *
      `;

      const insertValues = [
        finalOrderId,
        orderNumber,
        normBranchId,
        customerId,
        customerName,
        customerPhone,
        customerEmail || null,
        type,
        tableNumber || null,
        tablePin || null,
        pickupTime || null,
        status,
        safePaymentStatus,
        paymentMethod,
        JSON.stringify(serverItems),
        serverOriginalSubtotal,
        serverAddOnSubtotal,
        serverTax,
        serverTotal,
        notes || null,
        deliveryAddress || null,
        Boolean(sentToKitchen),
        sentToKitchenAt,
        forwardToKitchenAt,
        autoForwardCustomMin,
        cashierId || null,
        cashierName || null,
        Boolean(isWalkIn),
        assignedRiderId || null,
        assignedRiderName || null,
        riderStatus || null,
        deliveredAt || null,
        Boolean(isPaymentCollected),
        customerCoordinates ? JSON.stringify(customerCoordinates) : null,
        effectiveAssignedWaiterId || null,
        effectiveAssignedWaiterName || null,
        Boolean(isTableQr),
        Boolean(waiterNotified),
        headerIdempotencyKey,
        createdAt || new Date().toISOString(),
      ];

      const insRes = await client.query(insertSql, insertValues);
      const createdRow = insRes.rows[0];

      // 6. Write initial order_history row
      await recordOrderHistory(client, {
        orderId: createdRow.id,
        orderNumber: createdRow.order_number,
        branchId: normBranchId,
        actorId: actorId || cashierId || customerId || 'customer',
        actorName: actorName || cashierName || customerName || 'Customer',
        actorRole: actorRole || (isWalkIn ? 'cashier' : 'customer'),
        changeType: 'order_created',
        oldStatus: null,
        newStatus: createdRow.status,
        oldPaymentStatus: null,
        newPaymentStatus: createdRow.payment_status,
        oldTotal: 0,
        newTotal: serverTotal,
        version: 1,
        details: `Order #${createdRow.order_number} placed (${type}) with ${serverItems.length} item(s). Server total: Rs. ${serverTotal}`,
        payload: { itemsCount: serverItems.length, tableNumber: tableNumber || null },
      });

      return {
        status: 200,
        idempotentReplay: false,
        prepTimeMin: branchPrepTimeMin,
        order: formatOrderRow(createdRow),
      };
    });

    if (txResult.error) {
      recordRequestMetric('POST /api/orders', Date.now() - startTime, txResult.status || 400);
      return NextResponse.json(
        {
          error: txResult.error,
          unavailableItems: txResult.unavailableItems,
        },
        { status: txResult.status || 400 }
      );
    }

    if (headerIdempotencyKey && txResult.order) {
      await cacheSet(`idem:order:${headerIdempotencyKey}`, txResult.order, 300);
    }

    if (!txResult.idempotentReplay && txResult.order) {
      try {
        cacheInvalidatePrefix('sync:payload').catch(() => {});
        cacheInvalidatePrefix(`sync:payload:live:${txResult.order.branchId}`).catch(() => {});
        cacheInvalidatePrefix(`sync:payload:live:all`).catch(() => {});
        broadcastRealtimeEvent({
          type: 'ORDER_CREATED',
          branchId: txResult.order.branchId,
          orderId: txResult.order.id,
          customerId: txResult.order.customerId,
          data: txResult.order,
        });

        // Post-commit real-time notification in notifications table + SSE + job queue
        await emitOrderPlacedNotification(txResult.order);

        await enqueueNotificationJob({
          type: 'ORDER_STATUS_NOTIFICATION',
          orderId: txResult.order.id,
          orderNumber: txResult.order.orderNumber,
          branchId: txResult.order.branchId,
          customerId: txResult.order.customerId,
          customerPhone: txResult.order.customerPhone,
          title: 'Order Placed Successfully!',
          message: `Order #${txResult.order.orderNumber} has been received at ${txResult.order.branchId}.`,
        });

        if (auth.authenticated && (auth.role === 'cashier' || auth.role === 'branch_manager')) {
          await writeAuditLog({
            actorId: auth.userId,
            actorName: auth.userName || auth.role,
            actorRole: auth.role,
            branchId: txResult.order.branchId,
            action: 'order_created_by_staff',
            details: `Order #${txResult.order.orderNumber} (${txResult.order.type}) created at the counter: Rs. ${txResult.order.total}, payment ${txResult.order.paymentStatus}`,
            newValue: String(txResult.order.total),
          });
        }
      } catch {}
    }

    const durationMs = Date.now() - startTime;
    recordRequestMetric('POST /api/orders', durationMs, 200);
    logger.info('Order placement completed', {
      requestId,
      route: 'POST /api/orders',
      orderId: txResult.order?.id,
      branchId: txResult.order?.branchId,
      userId: txResult.order?.customerId,
      idempotentReplay: txResult.idempotentReplay,
      durationMs,
      statusCode: 200,
    });

    return NextResponse.json({
      success: true,
      idempotentReplay: txResult.idempotentReplay,
      order: txResult.order,
    });
  } catch (error: any) {
    if (error?.message?.startsWith('CONFLICT_TABLE_SESSION:') || error?.code === '23505') {
      recordRequestMetric('POST /api/orders', Date.now() - startTime, 409);
      return NextResponse.json(
        { error: error.message || 'Duplicate order or table session conflict' },
        { status: 409 }
      );
    }
    recordRequestMetric('POST /api/orders', Date.now() - startTime, 500);
    logger.error('Failed to create order', {
      requestId,
      route: 'POST /api/orders',
      error: error?.message,
    });
    return NextResponse.json(
      { error: 'Failed to create order in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const startTime = Date.now();
  const requestId = generateRequestId(request);
  try {
    const body = await request.json();

    // Zod Schema Validation
    const validation = updateOrderSchema.safeParse(body);
    if (!validation.success) {
      recordRequestMetric('PATCH /api/orders', Date.now() - startTime, 400);
      return NextResponse.json(
        {
          error: 'Validation failed for order update',
          validationErrors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const orderId = body.orderId || body.id;
    if (!orderId) {
      recordRequestMetric('PATCH /api/orders', Date.now() - startTime, 400);
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const {
      branchId,
      status,
      paymentStatus,
      items,
      notes,
      version,
      expectedVersion,
      sentToKitchen,
      sentToKitchenAt,
      forwardToKitchenAt,
      autoForwardCustomMin,
      cashierId,
      cashierName,
      isWalkIn,
      assignedRiderId,
      assignedRiderName,
      riderStatus,
      deliveredAt,
      paymentCollected,
      customerCoordinates,
      assignedWaiterId,
      assignedWaiterName,
      isTableQr,
      waiterNotified,
      actorId,
      actorName,
      actorRole,
    } = body;

    const toValidIsoOrNull = (val: any): string | null => {
      if (!val || typeof val !== 'string') return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d.toISOString();
    };

    const txResult = await withTransaction(async (client) => {
      // 1. Lock the order row (SELECT ... FOR UPDATE)
      let existingRes = await client.query(
        `SELECT * FROM orders WHERE id = $1 OR order_number = $1 FOR UPDATE`,
        [orderId]
      );

      // Self-heal cold serverless instances if the order snapshot arrived with this PATCH
      if (existingRes.rows.length === 0 && body.orderSnapshot && body.orderSnapshot.id) {
        const snap = body.orderSnapshot;
        const snapBranchId = normalizeBranchId(snap.branchId || branchId || 'gulberg-lahore');
        await optionalQuery(client, `INSERT INTO orders (
              id, order_number, branch_id, customer_id, customer_name, customer_phone, customer_email,
              type, table_number, table_pin, pickup_time, status, payment_status,
              payment_method, items, original_subtotal, add_on_subtotal, tax, total,
              notes, delivery_address, version, sent_to_kitchen, sent_to_kitchen_at,
              forward_to_kitchen_at, auto_forward_custom_min, cashier_id, cashier_name, is_walk_in,
              assigned_rider_id, assigned_rider_name, rider_status, delivered_at, payment_collected, customer_coordinates,
              assigned_waiter_id, assigned_waiter_name, is_table_qr, waiter_notified, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12, $13,
              $14, $15::jsonb, $16, $17, $18, $19,
              $20, $21, $22, $23, $24,
              $25, $26, $27, $28, $29,
              $30, $31, $32, $33, $34, $35::jsonb,
              $36, $37, $38, $39, COALESCE($40::timestamptz, CURRENT_TIMESTAMP)
            ) ON CONFLICT (id) DO NOTHING`,
            [
              snap.id,
              snap.orderNumber || `FC-${Date.now().toString().slice(-4)}`,
              snapBranchId,
              snap.customerId || 'user-guest',
              snap.customerName || 'Guest Customer',
              snap.customerPhone || '+92 300 0000000',
              snap.customerEmail || null,
              snap.type || 'takeaway',
              snap.tableNumber || null,
              snap.tablePin || null,
              snap.pickupTime || null,
              snap.status || 'placed',
              snap.paymentStatus || 'unpaid',
              snap.paymentMethod || 'Cash',
              JSON.stringify(Array.isArray(snap.items) ? snap.items : []),
              Number(snap.originalSubtotal ?? snap.total ?? 0) || 0,
              Number(snap.addOnSubtotal ?? 0) || 0,
              Number(snap.tax ?? 0) || 0,
              Number(snap.total ?? 0) || 0,
              snap.notes || null,
              snap.deliveryAddress || null,
              Number(snap.version ?? 1) || 1,
              Boolean(snap.sentToKitchen),
              toValidIsoOrNull(snap.sentToKitchenAt),
              toValidIsoOrNull(snap.forwardToKitchenAt),
              snap.autoForwardCustomMin ?? null,
              snap.cashierId || null,
              snap.cashierName || null,
              Boolean(snap.isWalkIn),
              snap.assignedRiderId || null,
              snap.assignedRiderName || null,
              snap.riderStatus || null,
              toValidIsoOrNull(snap.deliveredAt),
              Boolean(snap.paymentCollected || snap.paymentStatus === 'paid'),
              snap.customerCoordinates ? JSON.stringify(snap.customerCoordinates) : null,
              snap.assignedWaiterId || null,
              snap.assignedWaiterName || null,
              Boolean(snap.isTableQr),
              Boolean(snap.waiterNotified),
              toValidIsoOrNull(snap.createdAt) || new Date().toISOString(),
            ]);

        existingRes = await client.query(
          `SELECT * FROM orders WHERE id = $1 OR order_number = $1 FOR UPDATE`,
          [orderId]
        );
      }

      if (existingRes.rows.length === 0) {
        return { status: 404, error: `Order '${orderId}' not found.` };
      }

      const currentOrder = existingRes.rows[0];
      const currentVersion = Number(currentOrder.version) || 1;
      const currentStatus = String(currentOrder.status || 'placed');
      const currentPaymentStatus = String(currentOrder.payment_status || 'unpaid');
      const currentTotal = Number(currentOrder.total) || 0;
      const targetBranchId = branchId
        ? normalizeBranchId(branchId)
        : String(currentOrder.branch_id || 'gulberg-lahore');

      // 2. Optimistic Concurrency Check (expectedVersion)
      // Only enforce strict expectedVersion for item edits (PRD F10) so status updates, payments, and cancellations are never blocked
      if (items !== undefined && expectedVersion !== undefined && Number(expectedVersion) !== currentVersion) {
        return {
          status: 409,
          error: `Stale order write rejected: expected version ${expectedVersion}, but current order version is ${currentVersion}.`,
          currentOrder: formatOrderRow(currentOrder),
        };
      }

      // Also if client edits items and passes `version` where `version <= currentVersion`, reject stale item edit
      if (items !== undefined && version !== undefined && Number(version) <= currentVersion) {
        return {
          status: 409,
          error: `Stale order item edit rejected: client sent version ${version}, but order is already at version ${currentVersion}.`,
          currentOrder: formatOrderRow(currentOrder),
        };
      }

      const auth = getAuthFromRequest(request, body);
      const isRiderAction = Boolean(body.assignedRiderId || body.riderStatus || status === 'delivered' || status === 'out_for_delivery');
      const effectiveActorRole = (body.actorRole && body.actorRole !== 'customer')
        ? body.actorRole
        : (auth.authenticated && auth.role !== 'customer')
        ? auth.role
        : (body.actorRole || (body.cashierId ? 'cashier' : (isRiderAction ? 'delivery_staff' : 'customer')));
      const effectiveActorId = (body.actorId && body.actorId !== 'customer')
        ? body.actorId
        : (auth.authenticated ? auth.userId : (actorId || body.cashierId || (isRiderAction ? (body.assignedRiderId || 'user-rider') : 'user-cashier')));
      const effectiveActorName = auth.authenticated && auth.role !== 'customer' ? (auth.userName || auth.role) : (actorName || body.cashierName || (isRiderAction ? (body.assignedRiderName || 'Delivery Rider') : 'Cashier'));

      // Cross-branch modification check: relaxed so staff across terminals/mobile can update active orders
      // 3. Business Rule: Allow staff (Cashier, Waiter/Floor Staff, Rider, Support, Manager, Owner) and order settlements to mark paid
      const isFinishingOrder =
        status === 'completed' ||
        status === 'delivered' ||
        status === 'served' ||
        status === 'taken' ||
        Boolean(paymentCollected) ||
        Boolean(body.paymentCollected) ||
        Boolean(body.cashierId);
      if (
        paymentStatus === 'paid' &&
        !isFinishingOrder &&
        effectiveActorRole !== 'cashier' &&
        effectiveActorRole !== 'floor_staff' &&
        effectiveActorRole !== 'delivery_staff' &&
        effectiveActorRole !== 'branch_representative' &&
        effectiveActorRole !== 'branch_manager' &&
        effectiveActorRole !== 'platform_owner'
      ) {
        return {
          status: 403,
          error: `Role '${effectiveActorRole}' is not authorized to mark an order as paid.`,
        };
      }

      // PRD F10: Two-stage editing checks
      if (items !== undefined) {
        if (
          currentStatus === 'ready' ||
          currentStatus === 'completed' ||
          currentStatus === 'delivered' ||
          currentStatus === 'served' ||
          currentStatus === 'taken' ||
          currentStatus === 'cancelled'
        ) {
          return {
            status: 400,
            error: `Order in status '${currentStatus}' is locked and cannot be edited.`,
          };
        }
        if (currentStatus === 'preparing') {
          const stopMin = Number(currentOrder.stop_add_ons_min_before_ready || 5);
          if (currentOrder.ready_time_estimated) {
            const readyTime = new Date(currentOrder.ready_time_estimated).getTime();
            if (!isNaN(readyTime) && Date.now() > readyTime - stopMin * 60 * 1000) {
              return {
                status: 400,
                error: `Order is within ${stopMin} minutes of ready time. Add-on modifications are locked.`,
              };
            }
          }
        }
      }

      // Cancellation checks: Customer can only cancel while order is in 'placed' state before support accepts
      let effectiveNotes = notes;
      if (status === 'cancelled') {
        if (effectiveActorRole === 'customer') {
          if (currentStatus !== 'placed' || currentOrder.sent_to_kitchen) {
            return {
              status: 403,
              error: 'Order has already been accepted by customer support / kitchen and cannot be cancelled.',
            };
          }
        }
        if (currentStatus === 'ready' || currentStatus === 'out_for_delivery' || currentStatus === 'completed' || currentStatus === 'served' || currentStatus === 'delivered') {
          if (!effectiveNotes && !body.reason && !body.cancellationReason) {
            effectiveNotes = effectiveActorRole === 'customer' ? 'Cancelled by customer' : 'Cancelled by Staff';
          }
        }
      }

      // Completion normalization: Only transition to terminal 'completed' when fulfillment is finished AND paid.
      let effectiveStatus = status;
      let effectiveRiderStatus = riderStatus;
      let effectivePaymentStatus = paymentStatus;
      let effectivePaymentCollected = paymentCollected;

      if (currentPaymentStatus === 'paid' && effectivePaymentStatus !== 'refunded') {
        effectivePaymentStatus = 'paid';
        effectivePaymentCollected = true;
      }

      const effectiveOrderType = body.type || currentOrder.type;
      const isNowOrAlreadyPaid =
        effectivePaymentStatus === 'paid' ||
        Boolean(effectivePaymentCollected) ||
        currentPaymentStatus === 'paid' ||
        Boolean(currentOrder.payment_collected);
      const nextOrCurrentStatus = effectiveStatus || currentStatus;
      const nextOrCurrentRiderStatus = effectiveRiderStatus || currentOrder.rider_status;

      const isDeliveryFinished =
        effectiveOrderType === 'delivery' &&
        isNowOrAlreadyPaid &&
        (nextOrCurrentStatus === 'delivered' || nextOrCurrentStatus === 'completed' || nextOrCurrentRiderStatus === 'delivered');

      const isDineInFinished =
        effectiveOrderType === 'dine_in' &&
        isNowOrAlreadyPaid &&
        (nextOrCurrentStatus === 'served' || nextOrCurrentStatus === 'completed');

      const isTakeawayFinished =
        effectiveOrderType === 'takeaway' &&
        isNowOrAlreadyPaid &&
        (nextOrCurrentStatus === 'taken' || nextOrCurrentStatus === 'completed');

      const isOrderSettledAndFinished =
        effectiveStatus === 'completed' ||
        currentStatus === 'completed' ||
        isDeliveryFinished ||
        isDineInFinished ||
        isTakeawayFinished;

      if (isOrderSettledAndFinished) {
        effectiveStatus = 'completed';
        effectivePaymentStatus = effectivePaymentStatus === 'refunded' ? 'refunded' : 'paid';
        effectivePaymentCollected = true;
        if (effectiveOrderType === 'delivery') {
          effectiveRiderStatus = 'delivered';
        }
      }

      // Monotonic safeguard: never downgrade an order's advanced lifecycle status on stale PATCH calls
      if (
        effectiveStatus !== undefined &&
        effectiveStatus !== 'cancelled' &&
        currentStatus !== 'cancelled' &&
        (ORDER_STATUS_RANK[currentStatus] || 0) > (ORDER_STATUS_RANK[effectiveStatus] || 0)
      ) {
        effectiveStatus = currentStatus;
      }

      // Rider assignment guard. The row is locked FOR UPDATE, so this is race-free across
      // cashier terminals and rider phones:
      //  - Once a rider has accepted (or is on the trip), nobody else can be assigned and
      //    no other rider can accept it.
      //  - A rider accepting an order claims it (assigned_rider_id = that rider).
      //  - Auto-assign (onlyIfUnassigned) never replaces an existing assignment.
      const LOCKED_RIDER_STATUSES = ['accepted', 'picked_up', 'en_route', 'on_trip', 'delivered'];
      const currentRiderId = currentOrder.assigned_rider_id ? String(currentOrder.assigned_rider_id) : '';
      const currentRiderName = String(currentOrder.assigned_rider_name || 'another rider');
      const isCurrentRiderLocked =
        Boolean(currentRiderId) && LOCKED_RIDER_STATUSES.includes(String(currentOrder.rider_status || ''));
      let effectiveAssignedRiderId = assignedRiderId;
      let effectiveAssignedRiderName = assignedRiderName;

      if (riderStatus === 'accepted') {
        const accepterId = String(
          assignedRiderId || (effectiveActorRole === 'delivery_staff' ? effectiveActorId : '') || ''
        );
        if (currentRiderId && accepterId && currentRiderId !== accepterId) {
          return {
            status: 409,
            error: `This order is already assigned to ${currentRiderName}.`,
            currentOrder: formatOrderRow(currentOrder),
          };
        }
        if (!currentRiderId && accepterId) {
          effectiveAssignedRiderId = accepterId;
          effectiveAssignedRiderName = assignedRiderName || effectiveActorName;
        }
      }

      // Cancelling clears the rider on purpose, so it is exempt from the lock.
      if (assignedRiderId !== undefined && effectiveStatus !== 'cancelled' && status !== 'cancelled') {
        const nextRiderId = String(assignedRiderId || '');
        if (isCurrentRiderLocked && nextRiderId !== currentRiderId) {
          return {
            status: 409,
            error: `${currentRiderName} has already accepted this order. The rider cannot be changed.`,
            currentOrder: formatOrderRow(currentOrder),
          };
        }
        if (body.onlyIfUnassigned && currentRiderId && nextRiderId !== currentRiderId) {
          return {
            status: 409,
            error: `This order is already assigned to ${currentRiderName}.`,
            currentOrder: formatOrderRow(currentOrder),
          };
        }

        // A rider who marked themselves busy/offline cannot receive a NEW assignment
        // (they become assignable again once they mark themselves free).
        // Pure assignments get a 409; for a combined write (e.g. a self-heal that also
        // carries status/payment) only the rider change is dropped.
        const isSelfAccept = riderStatus === 'accepted' && effectiveActorRole === 'delivery_staff';
        if (nextRiderId && nextRiderId !== currentRiderId && !isSelfAccept) {
          const riderRes = await client.query(
            `SELECT name, rider_availability FROM users WHERE id = $1`,
            [nextRiderId]
          );
          const availability = String(riderRes.rows[0]?.rider_availability || 'available');
          if (availability === 'busy' || availability === 'offline') {
            const riderLabel = String(riderRes.rows[0]?.name || assignedRiderName || 'This rider');
            const isPureAssignment =
              status === undefined && paymentStatus === undefined && paymentCollected === undefined;
            if (isPureAssignment) {
              return {
                status: 409,
                error: `${riderLabel} is ${availability === 'busy' ? 'busy' : 'offline'} and cannot be assigned new orders right now.`,
                currentOrder: formatOrderRow(currentOrder),
              };
            }
            effectiveAssignedRiderId = undefined;
            effectiveAssignedRiderName = undefined;
            if (effectiveRiderStatus === 'assigned') effectiveRiderStatus = undefined;
          }
        }
      }

      // 4. Server State Machine Validation for Status Transitions
      if (effectiveStatus !== undefined && effectiveStatus !== currentStatus) {
        const check = validateStatusTransition(currentStatus, effectiveStatus, effectiveActorRole);
        if (!check.valid) {
          return {
            status: 409,
            error: check.reason || `Illegal status transition from '${currentStatus}' to '${effectiveStatus}'.`,
            currentOrder: formatOrderRow(currentOrder),
          };
        }
      }

      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      let nextTotal = currentTotal;
      let nextOriginalSubtotal = Number(currentOrder.original_subtotal) || 0;
      let nextAddOnSubtotal = Number(currentOrder.add_on_subtotal) || 0;

      // 5. If items are edited, recalculate prices on the server
      if (items !== undefined) {
        const calcResult = await recalculateOrderItemsOnServer(client, targetBranchId, items, {
          checkAvailability: false,
        });
        if (!calcResult.ok || !calcResult.calculated) {
          return {
            status: 400,
            error: calcResult.error || 'Failed to recalculate updated order items.',
          };
        }
        nextOriginalSubtotal = calcResult.calculated.originalSubtotal;
        nextAddOnSubtotal = calcResult.calculated.addOnSubtotal;
        nextTotal = calcResult.calculated.total;

        updates.push(`items = $${idx++}::jsonb`);
        values.push(JSON.stringify(calcResult.calculated.items));
        updates.push(`original_subtotal = $${idx++}`);
        values.push(nextOriginalSubtotal);
        updates.push(`add_on_subtotal = $${idx++}`);
        values.push(nextAddOnSubtotal);
        updates.push(`total = $${idx++}`);
        values.push(nextTotal);
      }

      if (branchId !== undefined) {
        updates.push(`branch_id = $${idx++}`);
        values.push(targetBranchId);
      }
      if (cashierId !== undefined) {
        updates.push(`cashier_id = $${idx++}`);
        values.push(cashierId);
      }
      if (cashierName !== undefined) {
        updates.push(`cashier_name = $${idx++}`);
        values.push(cashierName);
      }
      if (isWalkIn !== undefined) {
        updates.push(`is_walk_in = $${idx++}`);
        values.push(Boolean(isWalkIn));
      }

      if (effectiveStatus !== undefined) {
        updates.push(`status = $${idx++}`);
        values.push(effectiveStatus);

        if (effectiveStatus === 'preparing' && !currentOrder.preparation_started_at) {
          updates.push(`preparation_started_at = CURRENT_TIMESTAMP`);
        } else if (effectiveStatus === 'completed' || effectiveStatus === 'delivered' || effectiveStatus === 'served' || effectiveStatus === 'taken') {
          updates.push(`completed_at = CURRENT_TIMESTAMP`);
          if (effectiveStatus === 'delivered' || isOrderSettledAndFinished || currentOrder.type === 'delivery') {
            updates.push(`delivered_at = CURRENT_TIMESTAMP`);
            if (effectiveRiderStatus === undefined) {
              updates.push(`rider_status = 'delivered'`);
            }
          }
        }
      }

      if (effectivePaymentStatus !== undefined) {
        updates.push(`payment_status = $${idx++}`);
        values.push(effectivePaymentStatus);
        if (effectivePaymentStatus === 'paid') {
          updates.push(`payment_collected = true`);
        }
      }
      if (effectivePaymentCollected !== undefined && effectivePaymentStatus !== 'paid') {
        updates.push(`payment_collected = $${idx++}`);
        values.push(Boolean(effectivePaymentCollected));
      }
      if (effectiveNotes !== undefined) {
        updates.push(`notes = $${idx++}`);
        values.push(effectiveNotes);
      }
      if (sentToKitchen !== undefined) {
        updates.push(`sent_to_kitchen = $${idx++}`);
        values.push(sentToKitchen);
      }
      if (sentToKitchenAt !== undefined) {
        updates.push(`sent_to_kitchen_at = $${idx++}`);
        values.push(sentToKitchenAt);
      }
      if (forwardToKitchenAt !== undefined) {
        updates.push(`forward_to_kitchen_at = $${idx++}`);
        values.push(forwardToKitchenAt);
      }
      if (autoForwardCustomMin !== undefined) {
        updates.push(`auto_forward_custom_min = $${idx++}`);
        values.push(autoForwardCustomMin);
      }
      if (effectiveAssignedRiderId !== undefined) {
        updates.push(`assigned_rider_id = $${idx++}`);
        values.push(effectiveAssignedRiderId || null);
      }
      if (effectiveAssignedRiderName !== undefined) {
        updates.push(`assigned_rider_name = $${idx++}`);
        values.push(effectiveAssignedRiderName || null);
      }
      if (effectiveRiderStatus !== undefined) {
        updates.push(`rider_status = $${idx++}`);
        values.push(effectiveRiderStatus || null);
      }
      if (deliveredAt !== undefined && !isOrderSettledAndFinished) {
        updates.push(`delivered_at = $${idx++}`);
        values.push(deliveredAt || null);
      }
      if (customerCoordinates !== undefined) {
        const curIdx = idx++;
        updates.push(`customer_coordinates = CASE WHEN $${curIdx} IS NULL THEN NULL ELSE $${curIdx}::jsonb END`);
        values.push(customerCoordinates ? JSON.stringify(customerCoordinates) : null);
      }
      if (assignedWaiterId !== undefined) {
        updates.push(`assigned_waiter_id = $${idx++}`);
        values.push(assignedWaiterId || null);
      }
      if (assignedWaiterName !== undefined) {
        updates.push(`assigned_waiter_name = $${idx++}`);
        values.push(assignedWaiterName || null);
      }
      // If dine-in order doesn't have an assigned waiter yet, auto-assign from the table's assigned waiter
      if (
        assignedWaiterId === undefined &&
        !currentOrder.assigned_waiter_id &&
        (currentOrder.type === 'dine_in' || body.type === 'dine_in') &&
        (currentOrder.table_number || body.tableNumber)
      ) {
        const tblNum = String(body.tableNumber || currentOrder.table_number);
        const tblRes = await client.query(
          `SELECT assigned_waiter_id, assigned_waiter_name FROM tables WHERE branch_id = $1 AND (number = $2 OR id = $2 OR regexp_replace(number, '\\D', '', 'g') = regexp_replace($2, '\\D', '', 'g')) LIMIT 1`,
          [targetBranchId, tblNum]
        );
        if (tblRes.rows.length > 0 && tblRes.rows[0].assigned_waiter_id) {
          updates.push(`assigned_waiter_id = $${idx++}`);
          values.push(tblRes.rows[0].assigned_waiter_id);
          updates.push(`assigned_waiter_name = $${idx++}`);
          values.push(tblRes.rows[0].assigned_waiter_name || null);
        }
      }
      if (isTableQr !== undefined) {
        updates.push(`is_table_qr = $${idx++}`);
        values.push(Boolean(isTableQr));
      }
      if (waiterNotified !== undefined) {
        updates.push(`waiter_notified = $${idx++}`);
        values.push(Boolean(waiterNotified));
      }

      if (updates.length === 0) {
        return {
          status: 200,
          oldStatus: currentStatus,
          order: formatOrderRow(currentOrder),
        };
      }

      const nextVersion = currentVersion + 1;
      updates.push(`version = $${idx++}`);
      values.push(nextVersion);

      values.push(currentOrder.id);
      const sql = `
        UPDATE orders
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${idx}
        RETURNING *
      `;
      const updRes = await client.query(sql, values);
      const updatedRow = updRes.rows[0];

      // 6. Release table & close active table_session on completion or cancellation —
      //    and (rule) as soon as a dine-in order is PAID, the table becomes available automatically.
      const dineInJustPaid =
        (updatedRow.type || currentOrder.type) === 'dine_in' &&
        updatedRow.payment_status === 'paid' &&
        currentPaymentStatus !== 'paid';
      if (dineInJustPaid || effectiveStatus === 'completed' || effectiveStatus === 'cancelled' || status === 'completed' || status === 'cancelled') {
        if (currentOrder.table_number) {
          await client.query(
            `UPDATE tables
             SET status = 'available', current_order_id = NULL, seated_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE current_order_id = $1 OR current_order_id = $2 OR (number = $3 AND branch_id = $4)`,
            [currentOrder.id, currentOrder.order_number, String(currentOrder.table_number), currentOrder.branch_id]
          );
        } else {
          await client.query(
            `UPDATE tables
             SET status = 'available', current_order_id = NULL, seated_at = NULL, updated_at = CURRENT_TIMESTAMP
             WHERE current_order_id = $1 OR current_order_id = $2`,
            [currentOrder.id, currentOrder.order_number]
          );
        }
        const sessRows = await optionalQuery(client, `SELECT id, started_at FROM table_sessions WHERE (order_id = $1 OR order_number = $2) AND status = 'occupied'`,
            [currentOrder.id, currentOrder.order_number]);
        for (const s of sessRows.rows) {
          const started = s.started_at ? new Date(s.started_at).getTime() : Date.now();
          const durMin = Math.max(1, Math.round((Date.now() - started) / 60000));
          await optionalQuery(client, `UPDATE table_sessions SET status = 'completed', ended_at = CURRENT_TIMESTAMP, duration_min = $1 WHERE id = $2`,
              [durMin, s.id]);
        }
      }

      // Free assigned rider if order is cancelled
      if (effectiveStatus === 'cancelled' || status === 'cancelled') {
        if (currentOrder.assigned_rider_id) {
          await optionalQuery(client, `UPDATE users
               SET rider_active_order_id = NULL, rider_availability = 'available'
               WHERE id = $1 AND (rider_active_order_id = $2 OR rider_active_order_id = $3)`,
              [currentOrder.assigned_rider_id, currentOrder.id, currentOrder.order_number]);
        }
      }

      // 6c. If order is marked paid and cash was collected, credit the branch's active open cash shift
      if ((updatedRow.payment_status === 'paid' || Boolean(updatedRow.payment_collected)) && currentPaymentStatus !== 'paid') {
        const pMethod = String(updatedRow.payment_method || '').toLowerCase();
        const isCashOrCod = pMethod.includes('cash') || pMethod.includes('cod') || !pMethod;
        if (isCashOrCod) {
          const ordTotal = Number(updatedRow.total) || 0;
          if (ordTotal > 0) {
            await optionalQuery(client, `UPDATE cash_shifts
               SET cash_collected = cash_collected + $1,
                   expected_cash = expected_cash + $1,
                   updated_at = CURRENT_TIMESTAMP
               WHERE status = 'open' AND (branch_id = $2 OR branch_id IS NULL)`,
              [ordTotal, targetBranchId]);
          }
        }
      }

      // 6b. No-show counter hook (PRD F20): if an unpaid order is cancelled after prep started, increment customer no_show_count
      if (
        status === 'cancelled' &&
        currentPaymentStatus === 'unpaid' &&
        (currentStatus === 'preparing' || currentStatus === 'ready' || currentStatus === 'out_for_delivery') &&
        currentOrder.customer_id &&
        currentOrder.customer_id !== 'user-guest'
      ) {
        await optionalQuery(client, `UPDATE users SET no_show_count = COALESCE(no_show_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [currentOrder.customer_id]);
      }

      // 7. Write order_history entry
      const changeType =
        items !== undefined
          ? 'items_edited'
          : status !== undefined && status !== currentStatus
          ? 'status_transition'
          : paymentStatus !== undefined && paymentStatus !== currentPaymentStatus
          ? 'payment_updated'
          : 'order_updated';

      await recordOrderHistory(client, {
        orderId: updatedRow.id,
        orderNumber: updatedRow.order_number,
        branchId: updatedRow.branch_id,
        actorId: effectiveActorId,
        actorName: effectiveActorName,
        actorRole: effectiveActorRole,
        changeType,
        oldStatus: currentStatus,
        newStatus: updatedRow.status,
        oldPaymentStatus: currentPaymentStatus,
        newPaymentStatus: updatedRow.payment_status,
        oldTotal: currentTotal,
        newTotal: Number(updatedRow.total) || 0,
        version: nextVersion,
        details:
          changeType === 'items_edited'
            ? `Order items edited (v${currentVersion} -> v${nextVersion}): total Rs. ${currentTotal} -> Rs. ${updatedRow.total}`
            : changeType === 'status_transition'
            ? `Status changed '${currentStatus}' -> '${updatedRow.status}' (v${nextVersion})`
            : `Order updated (${changeType}, v${nextVersion})`,
      });

      return {
        status: 200,
        changeType,
        oldTotal: currentTotal,
        oldStatus: currentStatus,
        oldPaymentStatus: currentPaymentStatus,
        previousWaiterId: currentOrder.assigned_waiter_id || null,
        previousRiderId: currentOrder.assigned_rider_id || null,
        previousRiderStatus: currentOrder.rider_status || null,
        actorId: effectiveActorId,
        actorName: effectiveActorName,
        actorRole: effectiveActorRole,
        order: formatOrderRow(updatedRow),
      };
    });

    if (txResult.error) {
      recordRequestMetric('PATCH /api/orders', Date.now() - startTime, txResult.status || 400);
      return NextResponse.json(
        {
          error: txResult.error,
          order: txResult.currentOrder,
        },
        { status: txResult.status || 400 }
      );
    }

    const updatedOrder = txResult.order;
    if (updatedOrder) {
      try {
        cacheInvalidatePrefix('sync:payload').catch(() => {});
        cacheInvalidatePrefix('orders:').catch(() => {});
        broadcastRealtimeEvent({
          type: 'ORDER_UPDATED',
          branchId: updatedOrder.branchId,
          orderId: updatedOrder.id,
          customerId: updatedOrder.customerId,
          data: updatedOrder,
        });

        await emitOrderUpdatedNotification({
          order: updatedOrder,
          oldStatus: txResult.oldStatus,
          newStatus: updatedOrder.status,
          sentToKitchen: Boolean(sentToKitchen),
          assignedWaiterId,
          assignedWaiterName,
          assignedRiderId,
          assignedRiderName,
          riderStatus: updatedOrder.riderStatus,
          paymentStatus: updatedOrder.paymentStatus,
          oldPaymentStatus: txResult.oldPaymentStatus,
          previousWaiterId: (txResult as any).previousWaiterId,
          previousRiderId: (txResult as any).previousRiderId,
          previousRiderStatus: (txResult as any).previousRiderStatus,
          actorId: txResult.actorId,
          actorName: txResult.actorName,
          actorRole: txResult.actorRole,
        });

        // Post-commit background notifications & metrics
        if (status && status !== txResult.oldStatus) {
          await enqueueNotificationJob({
            type: 'ORDER_STATUS_NOTIFICATION',
            orderId: updatedOrder.id,
            orderNumber: updatedOrder.orderNumber,
            branchId: updatedOrder.branchId,
            customerId: updatedOrder.customerId,
            customerPhone: updatedOrder.customerPhone,
            title: `Order #${updatedOrder.orderNumber} ${status.toUpperCase()}`,
            message: `Your order status is now ${status.replace(/_/g, ' ')}.`,
          });

          if (status === 'preparing') {
            await scheduleReadyIn10MinNotice({
              orderId: updatedOrder.id,
              orderNumber: updatedOrder.orderNumber,
              branchId: updatedOrder.branchId,
              customerId: updatedOrder.customerId,
              customerPhone: updatedOrder.customerPhone,
              prepTimeEstimateMin: 20,
            });
          }

          if (status === 'ready' && updatedOrder.createdAt) {
            const createdMs = new Date(updatedOrder.createdAt).getTime();
            if (!isNaN(createdMs) && createdMs > 0) {
              recordOrderToReadyDuration(Math.round((Date.now() - createdMs) / 1000));
            }
          }

          if (status === 'cancelled') {
            await writeAuditLog({
              actorId: txResult.actorId || 'staff',
              actorName: txResult.actorName || 'Staff / Customer',
              actorRole: txResult.actorRole || 'staff',
              branchId: updatedOrder.branchId,
              action: 'order_cancelled',
              details: `Order #${updatedOrder.orderNumber} cancelled from status '${txResult.oldStatus}'. Notes: ${notes || 'N/A'}`,
              oldValue: txResult.oldStatus,
              newValue: 'cancelled',
            });
          }
        }

        // Owner audit trail: every change a cashier or branch manager makes to an order
        const auditActorRole = txResult.actorRole;
        if (
          (auditActorRole === 'cashier' || auditActorRole === 'branch_manager') &&
          updatedOrder.status !== 'cancelled'
        ) {
          const tx: any = txResult;
          const paymentChanged = updatedOrder.paymentStatus !== txResult.oldPaymentStatus;
          const statusChanged = updatedOrder.status !== txResult.oldStatus;
          const itemsEdited = tx.changeType === 'items_edited';
          if (paymentChanged || statusChanged || itemsEdited) {
            const parts: string[] = [];
            if (itemsEdited) parts.push(`items edited (total Rs. ${tx.oldTotal} -> Rs. ${updatedOrder.total})`);
            if (statusChanged) parts.push(`status '${txResult.oldStatus}' -> '${updatedOrder.status}'`);
            if (paymentChanged) parts.push(`payment '${txResult.oldPaymentStatus}' -> '${updatedOrder.paymentStatus}' (Rs. ${updatedOrder.total})`);
            await writeAuditLog({
              actorId: txResult.actorId,
              actorName: txResult.actorName || auditActorRole,
              actorRole: auditActorRole,
              branchId: updatedOrder.branchId,
              action: paymentChanged
                ? `order_payment_${updatedOrder.paymentStatus}`
                : itemsEdited
                ? 'order_items_edited'
                : 'order_status_changed',
              details: `Order #${updatedOrder.orderNumber}: ${parts.join('; ')}`,
              oldValue: paymentChanged ? txResult.oldPaymentStatus : txResult.oldStatus,
              newValue: paymentChanged ? updatedOrder.paymentStatus : updatedOrder.status,
            });
          }
        }
      } catch {}
    }

    const durationMs = Date.now() - startTime;
    recordRequestMetric('PATCH /api/orders', durationMs, 200);
    logger.info('Order updated', {
      requestId,
      route: 'PATCH /api/orders',
      orderId: updatedOrder?.id,
      branchId: updatedOrder?.branchId,
      newStatus: updatedOrder?.status,
      durationMs,
      statusCode: 200,
    });

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    recordRequestMetric('PATCH /api/orders', Date.now() - startTime, 500);
    logger.error('Failed to update order', {
      requestId,
      route: 'PATCH /api/orders',
      error: error?.message,
    });
    return NextResponse.json(
      { error: 'Failed to update order in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export const PUT = PATCH;

export async function DELETE(request: Request) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    let purge = searchParams.get('purge');
    let orderId = searchParams.get('orderId');

    // Also support JSON body if passed
    if (!purge && !orderId) {
      try {
        const body = await request.json().catch(() => ({}));
        purge = body.purge || purge;
        orderId = body.orderId || body.id || orderId;
      } catch {}
    }

    let deletedRows: any[] = [];

    if (purge === 'end_of_day') {
      // Purge all cancelled orders for the day and past days (end of that day)
      // First unbind any table session references
      await query(
        `UPDATE table_sessions 
         SET order_id = NULL, order_number = NULL 
         WHERE order_id IN (
           SELECT id FROM orders 
           WHERE status IN ('cancelled', 'canceled') 
             AND created_at::date <= CURRENT_DATE
         )`
      ).catch(() => {});

      // Remove any refund requests for these cancelled orders
      await query(
        `DELETE FROM refund_requests 
         WHERE order_id IN (
           SELECT id FROM orders 
           WHERE status IN ('cancelled', 'canceled') 
             AND created_at::date <= CURRENT_DATE
         )`
      ).catch(() => {});

      // Delete cancelled orders (cascades to order_history)
      const res = await query(
        `DELETE FROM orders 
         WHERE status IN ('cancelled', 'canceled') 
           AND created_at::date <= CURRENT_DATE 
         RETURNING id, order_number as "orderNumber", branch_id as "branchId"`
      );
      deletedRows = res.rows || [];
    } else if (purge === 'all_cancelled' || purge === 'cancelled' || purge === 'true') {
      await query(
        `UPDATE table_sessions 
         SET order_id = NULL, order_number = NULL 
         WHERE order_id IN (
           SELECT id FROM orders WHERE status IN ('cancelled', 'canceled')
         )`
      ).catch(() => {});

      await query(
        `DELETE FROM refund_requests 
         WHERE order_id IN (
           SELECT id FROM orders WHERE status IN ('cancelled', 'canceled')
         )`
      ).catch(() => {});

      const res = await query(
        `DELETE FROM orders 
         WHERE status IN ('cancelled', 'canceled') 
         RETURNING id, order_number as "orderNumber", branch_id as "branchId"`
      );
      deletedRows = res.rows || [];
    } else if (orderId) {
      // Only cancelled orders can be purged
      const checkRes = await query(
        `SELECT id, status, order_number as "orderNumber", branch_id as "branchId" 
         FROM orders WHERE id = $1 OR order_number = $1`,
        [orderId]
      );
      if (checkRes.rows.length === 0) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      const ord = checkRes.rows[0];
      if (ord.status !== 'cancelled' && ord.status !== 'canceled') {
        return NextResponse.json(
          { error: 'Only cancelled orders can be deleted from the database' },
          { status: 400 }
        );
      }

      await query(
        `UPDATE table_sessions SET order_id = NULL, order_number = NULL WHERE order_id = $1`,
        [ord.id]
      ).catch(() => {});

      await query(
        `DELETE FROM refund_requests WHERE order_id = $1`,
        [ord.id]
      ).catch(() => {});

      const res = await query(
        `DELETE FROM orders WHERE id = $1 RETURNING id, order_number as "orderNumber", branch_id as "branchId"`,
        [ord.id]
      );
      deletedRows = res.rows || [];
    } else {
      // Default: purge cancelled orders whose day has ended
      await query(
        `UPDATE table_sessions 
         SET order_id = NULL, order_number = NULL 
         WHERE order_id IN (
           SELECT id FROM orders 
           WHERE status IN ('cancelled', 'canceled') 
             AND (created_at::date < CURRENT_DATE OR created_at < NOW() - INTERVAL '24 hours')
         )`
      ).catch(() => {});

      await query(
        `DELETE FROM refund_requests 
         WHERE order_id IN (
           SELECT id FROM orders 
           WHERE status IN ('cancelled', 'canceled') 
             AND (created_at::date < CURRENT_DATE OR created_at < NOW() - INTERVAL '24 hours')
         )`
      ).catch(() => {});

      const res = await query(
        `DELETE FROM orders 
         WHERE status IN ('cancelled', 'canceled') 
           AND (created_at::date < CURRENT_DATE OR created_at < NOW() - INTERVAL '24 hours') 
         RETURNING id, order_number as "orderNumber", branch_id as "branchId"`
      );
      deletedRows = res.rows || [];
    }

    // Invalidate caches
    try {
      await cacheInvalidatePrefix('orders:');
    } catch {}

    const auth = getAuthFromRequest(request);
    if (deletedRows.length > 0) {
      writeAuditLog({
        actorId: auth.userId || 'system',
        actorName: auth.userName || 'System Auto-Purge',
        actorRole: auth.role || 'system',
        branchId: auth.branchId || 'gulberg-lahore',
        action: 'ORDER_PURGED',
        details: `Deleted ${deletedRows.length} cancelled order(s) from database at end of day`,
      }).catch(() => {});

      // Broadcast order deletion event to live clients
      try {
        broadcastRealtimeEvent({
          type: 'ORDER_UPDATED',
          branchId: 'all',
          data: {
            action: 'ORDER_PURGED',
            purgedCount: deletedRows.length,
            purgedOrders: deletedRows.map((r: any) => ({ id: r.id, orderNumber: r.orderNumber })),
          },
        });
      } catch {}
    }

    const durationMs = Date.now() - startTime;
    recordRequestMetric('DELETE /api/orders', durationMs, 200);

    return NextResponse.json({
      success: true,
      deletedCount: deletedRows.length,
      deletedOrders: deletedRows,
    });
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    recordRequestMetric('DELETE /api/orders', durationMs, 500);
    logger.error('Failed to delete cancelled orders', {
      requestId,
      route: 'DELETE /api/orders',
      error: error?.message,
    });
    return NextResponse.json(
      { error: 'Failed to delete cancelled orders from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
