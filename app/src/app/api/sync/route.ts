import { NextResponse } from 'next/server';
import { applyBranchSchedules } from '@/lib/branchSchedule';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { cacheGet, cacheSet } from '@/lib/redis';
import { INITIAL_MENU, INITIAL_CATEGORIES } from '@/database/embeddedSeed';
import { getAuthFromRequest } from '@/lib/auth';
import { formatOrderRow } from '@/lib/orderStateMachine';
import {
  ensureNotificationsTable,
  getNotificationSettings,
  getReceiverNotificationSettingsMap,
  mapNotificationRow,
} from '@/lib/notifications';

function normalizeBranchId(id?: string | null): string {
  if (!id) return 'gulberg-lahore';
  if (id === 'all') return 'all';
  if (id === 'branch-gulberg' || id.includes('gulberg')) return 'gulberg-lahore';
  if (id === 'branch-f7' || id.includes('f7') || id.includes('islamabad')) return 'f7-islamabad';
  if (id === 'branch-clifton' || id.includes('clifton') || id.includes('karachi')) return 'clifton-karachi';
  return id;
}

async function getCachedCatalogData(includeFooter: boolean) {
  const cacheKey = includeFooter ? 'catalog:full' : 'catalog:live';
  const cached = await cacheGet<any>(cacheKey);
  if (cached) return cached;

  const branchSql = `
    SELECT id, name, city, address, phone, opening_hours as "openingHours",
           is_open as "isOpen", is_busy as "isBusy",
           prep_time_estimate_min as "prepTimeEstimateMin",
           full_edit_window_min as "fullEditWindowMin",
           stop_add_ons_min_before_ready as "stopAddOnsMinBeforeReady",
           delivery_enabled as "deliveryEnabled",
           COALESCE(latitude, CASE WHEN id = 'gulberg-lahore' THEN 31.5126 WHEN id = 'f7-islamabad' THEN 33.7215 WHEN id = 'clifton-karachi' THEN 24.8252 ELSE 31.5126 END) as "latitude",
           COALESCE(longitude, CASE WHEN id = 'gulberg-lahore' THEN 74.3436 WHEN id = 'f7-islamabad' THEN 73.0552 WHEN id = 'clifton-karachi' THEN 67.0305 ELSE 74.3436 END) as "longitude",
           COALESCE(max_order_distance_km, 50) as "maxOrderDistanceKm",
           COALESCE(table_qr_max_distance_meters, 300) as "tableQrMaxDistanceMeters",
           payment_settings as "paymentSettings",
           COALESCE(auto_schedule_enabled, false) as "autoScheduleEnabled"
    FROM branches
    ORDER BY city ASC, name ASC
  `;

  const [branchesRes, menuRes, announcementsRes, catRes, mktRes] = await Promise.all([
    query(branchSql).catch(() => ({ rows: [] })),
    query(`
      SELECT id, name, category, description, base_price as "basePrice",
             image, is_available as "isAvailable",
             branch_availability as "branchAvailability",
             branch_price_overrides as "branchPriceOverrides",
             sizes, extras
      FROM menu_items
      ORDER BY category ASC, name ASC
    `).catch(() => ({ rows: [] })),
    query(`
      SELECT id, title, tag, description,
             valid_until as "validUntil",
             branch_id as "branchId",
             branch_name as "branchName",
             discount_percent as "discountPercent",
             badge_color as "badgeColor",
             created_at as "createdAt"
      FROM announcements
      ORDER BY created_at DESC
    `).catch(() => ({ rows: [] })),
    query(`SELECT name FROM categories ORDER BY display_order ASC, name ASC`).catch(() => ({ rows: [] })),
    includeFooter
      ? query(`SELECT * FROM footer_settings LIMIT 1`).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
  ]);

  const branches = branchesRes.rows.map((r: any) => ({
    ...r,
    latitude: Number(r.latitude) || (r.city === 'Islamabad' ? 33.7215 : r.city === 'Karachi' ? 24.8252 : 31.5126),
    longitude: Number(r.longitude) || (r.city === 'Islamabad' ? 73.0552 : r.city === 'Karachi' ? 67.0305 : 74.3436),
    maxOrderDistanceKm: Number(r.maxOrderDistanceKm) || 50,
    tableQrMaxDistanceMeters: Number(r.tableQrMaxDistanceMeters) || 300,
    paymentSettings:
      typeof r.paymentSettings === 'string'
        ? (() => {
            try { return JSON.parse(r.paymentSettings); } catch { return r.paymentSettings; }
          })()
        : r.paymentSettings,
  }));

  const parsedMenuItems = menuRes.rows.map((r: any) => ({
    ...r,
    basePrice: Number(r.basePrice || 0),
    branchAvailability: typeof r.branchAvailability === 'string' ? JSON.parse(r.branchAvailability) : (r.branchAvailability || {}),
    branchPriceOverrides: typeof r.branchPriceOverrides === 'string' ? JSON.parse(r.branchPriceOverrides) : (r.branchPriceOverrides || {}),
    sizes: typeof r.sizes === 'string' ? JSON.parse(r.sizes) : (r.sizes || []),
    extras: typeof r.extras === 'string' ? JSON.parse(r.extras) : (r.extras || []),
  }));

  const parsedCategories = catRes.rows.length > 0 ? catRes.rows.map((c: any) => c.name) : [...INITIAL_CATEGORIES];
  parsedMenuItems.forEach((m: any) => {
    if (m.category && !parsedCategories.includes(m.category)) {
      parsedCategories.push(m.category);
    }
  });

  let footerSettings: any = undefined;
  if (includeFooter && mktRes.rows.length > 0) {
    const f = mktRes.rows[0];
    footerSettings = {
      helpline: f.helpline || '+92 300 1234567',
      email: f.email || 'support@foodiescafe.pk',
      hours: f.hours || '11:00 AM - 1:00 AM Daily',
      whatsapp: f.whatsapp || '+92 300 1234567',
      instagram: f.instagram || '@foodiescafe.pk',
      facebook: f.facebook || 'foodiescafe.pk',
      tiktok: f.tiktok || '@foodiescafe',
      orderRoutingSupportFirst: f.order_routing_support_first !== false,
      autoForwardKitchenMin: Number(f.auto_forward_kitchen_min || 3),
      autoForwardMode: f.auto_forward_mode || 'timed',
      homeNotificationEnabled: f.home_notification_enabled !== false,
      homeNotificationBadge: f.home_notification_badge || undefined,
      homeNotificationTitle: f.home_notification_title || undefined,
      homeNotificationMessage: f.home_notification_message || undefined,
      homeNotificationType: f.home_notification_type || undefined,
      homeNotificationUpdatedBy: f.home_notification_updated_by || undefined,
      homeNotificationUpdatedAt: f.home_notification_updated_at || undefined,
    };
  }

  const catalog = {
    branches,
    menuItems: parsedMenuItems.length > 0 ? parsedMenuItems : INITIAL_MENU,
    categories: parsedCategories,
    announcements: announcementsRes.rows || [],
    footerSettings,
  };

  await cacheSet(cacheKey, catalog, 15); // short: branch open/closed must propagate quickly across instances
  return catalog;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'live'; // 'live' | 'full'
    await applyBranchSchedules(); // throttled; opens/closes branches whose scheduled time has passed
    const rawBranchId = searchParams.get('branchId');
    const customerId = searchParams.get('customerId');
    const customerPhone = searchParams.get('customerPhone');
    const orderIdsParam = searchParams.get('orderIds');
    const since = searchParams.get('since');

    // Extract cryptographic auth from session token or cookies, with fallback to role param
    const queryRole = searchParams.get('role');
    const auth = getAuthFromRequest(request);
    const isStaff = (auth.authenticated && auth.role !== 'customer') || Boolean(queryRole && queryRole !== 'customer');
    const isOwner = (auth.authenticated && auth.role === 'platform_owner') || queryRole === 'platform_owner';
    const effectiveRole = isOwner ? 'platform_owner' : isStaff ? (auth.role || queryRole || 'staff') : 'customer';

    // Enforce scoping: platform_owner receives all branches ('all')
    const scopedBranchId = isOwner
      ? 'all'
      : isStaff
      ? normalizeBranchId(auth.branchId || rawBranchId || 'gulberg-lahore')
      : normalizeBranchId(rawBranchId || 'gulberg-lahore');

    const effectiveCustomerId = auth.authenticated && auth.role === 'customer' ? auth.userId : customerId;
    const syncCacheKey = `sync:payload:${scope}:${scopedBranchId}:${effectiveRole}:${effectiveCustomerId || ''}:${customerPhone || ''}:${orderIdsParam ? orderIdsParam.slice(0, 30) : 'anon'}`;
    // Staff operational live polls always read direct from PostgreSQL for instant cashier/kitchen dispatch
    const cachedSync = (!isStaff || scope !== 'live')
      ? await cacheGet<{
          etag: string;
          responseBody: string;
        }>(syncCacheKey)
      : null;
    if (cachedSync) {
      const ifNoneMatch = request.headers.get('if-none-match');
      if (ifNoneMatch && ifNoneMatch === cachedSync.etag) {
        return new NextResponse(null, {
          status: 304,
          headers: {
            ETag: cachedSync.etag,
            'Cache-Control': 'private, no-cache',
          },
        });
      }
      return new NextResponse(cachedSync.responseBody, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ETag: cachedSync.etag,
          'Cache-Control': 'private, no-cache',
        },
      });
    }

    // 1. ORDERS — Strictly scoped by role
    let orderSql = `
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
    const orderParams: any[] = [];
    const orderWhere: string[] = [];

    if (!isStaff) {
      // Customer sync: return that customer's orders matching customerId, customerPhone, or placed orderIds
      const customerConditions: string[] = [];

      if (effectiveCustomerId && effectiveCustomerId !== 'user-guest' && effectiveCustomerId !== 'cust-guest') {
        orderParams.push(effectiveCustomerId);
        customerConditions.push(`customer_id = $${orderParams.length}`);
      }

      if (customerPhone) {
        const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
        if (cleanPhone) {
          orderParams.push(`%${cleanPhone}`);
          customerConditions.push(`customer_phone LIKE $${orderParams.length}`);
        }
      }

      if (orderIdsParam) {
        const idList = orderIdsParam.split(',').map((s) => s.trim()).filter(Boolean);
        if (idList.length > 0) {
          orderParams.push(idList);
          customerConditions.push(`(id = ANY($${orderParams.length}) OR order_number = ANY($${orderParams.length}))`);
        }
      }

      if (customerConditions.length > 0) {
        orderWhere.push(`(${customerConditions.join(' OR ')})`);
      } else {
        // Guest with zero identifiers receives no global orders from sync
        orderWhere.push(`1 = 0`);
      }
    } else if (scopedBranchId !== 'all') {
      orderParams.push(scopedBranchId);
      const riderUserId = searchParams.get('userId') || searchParams.get('riderId');
      if (riderUserId) {
        orderParams.push(riderUserId);
        orderWhere.push(`(branch_id = $${orderParams.length - 1} OR assigned_rider_id = $${orderParams.length})`);
      } else {
        orderWhere.push(`branch_id = $${orderParams.length}`);
      }
    }

    if (orderWhere.length > 0) {
      orderSql += ` WHERE ` + orderWhere.join(' AND ');
    }
    orderSql += ` ORDER BY created_at DESC LIMIT 200`;

    // 2. TABLES (cached for 5s per branch to avoid N*500 table queries during rush)
    const tableCacheKey = `tables:branch:${scopedBranchId}`;
    let cachedTables = await cacheGet<any[]>(tableCacheKey);
    let tablesPromise: Promise<{ rows: any[] }>;
    if (cachedTables) {
      tablesPromise = Promise.resolve({ rows: cachedTables });
    } else {
      let tableSql = `
        SELECT id, number, branch_id as "branchId", floor, capacity, chairs,
               status, current_order_id as "currentOrderId",
               seated_at as "seatedAt", reserved_for as "reservedFor", pin,
               qr_code as "qrCode", qr_expires_at as "qrExpiresAt",
               allow_qr_reserved as "allowQrOrderOnReserved",
               assigned_waiter_id as "assignedWaiterId",
               assigned_waiter_name as "assignedWaiterName"
        FROM tables
      `;
      const tableParams: any[] = [];
      if (scopedBranchId !== 'all') {
        tableSql += ` WHERE branch_id = $1`;
        tableParams.push(scopedBranchId);
      }
      tableSql += ` ORDER BY floor ASC, number ASC`;
      tablesPromise = query(tableSql, tableParams)
        .then(async (res) => {
          await cacheSet(tableCacheKey, res.rows, 4); // short TTL: without Redis each instance has its own cache
          return res;
        })
        .catch(() => ({ rows: [] }));
    }

    // Staff-only operational queries
    let shiftPromise: Promise<{ rows: any[] }> = Promise.resolve({ rows: [] });
    let refundPromise: Promise<{ rows: any[] }> = Promise.resolve({ rows: [] });
    let sessionPromise: Promise<{ rows: any[] }> = Promise.resolve({ rows: [] });
    let usersPromise: Promise<{ rows: any[] }> = Promise.resolve({ rows: [] });

    if (isStaff) {
      let shiftSql = `
        SELECT id, branch_id as "branchId", cashier_id as "cashierId", cashier_name as "cashierName",
               opening_float as "openingFloat", cash_collected as "cashCollected",
               expected_cash as "expectedCash", counted_cash as "countedCash",
               difference, difference_reason as "differenceReason",
               status, opened_at as "openedAt", closed_at as "closedAt"
        FROM cash_shifts
      `;
      const shiftParams: any[] = [];
      if (scopedBranchId !== 'all') {
        shiftSql += ` WHERE (branch_id = $1 OR branch_id IS NULL)`;
        shiftParams.push(scopedBranchId);
      }
      shiftSql += ` ORDER BY opened_at DESC LIMIT 20`;
      shiftPromise = query(shiftSql, shiftParams).catch(() => ({ rows: [] }));

      const refundBranchFilter = scopedBranchId !== 'all' ? `WHERE branch_id = $1` : '';
      const refundParams = scopedBranchId !== 'all' ? [scopedBranchId] : [];
      refundPromise = query(
        `SELECT id, order_id as "orderId", branch_id as "branchId",
                amount, reason, status, requested_by as "requestedBy",
                approved_by as "approvedBy", created_at as "createdAt",
                approved_at as "approvedAt"
         FROM refund_requests ${refundBranchFilter}
         ORDER BY created_at DESC LIMIT 30`,
        refundParams
      ).catch(() => ({ rows: [] }));

      const sessionBranchFilter = scopedBranchId !== 'all' ? `WHERE branch_id = $1` : '';
      const sessionParams = scopedBranchId !== 'all' ? [scopedBranchId] : [];
      sessionPromise = query(
        `SELECT id, table_id as "tableId", branch_id as "branchId",
                table_number as "tableNumber", started_at as "startedAt",
                ended_at as "endedAt", duration_min as "durationMin",
                customer_name as "customerName", order_id as "orderId",
                order_number as "orderNumber", waiter_name as "waiterName",
                total_amount as "totalAmount", status, created_at as "createdAt"
         FROM table_sessions ${sessionBranchFilter}
         ORDER BY started_at DESC LIMIT 30`,
        sessionParams
      ).catch(() => ({ rows: [] }));

      // Never return password_hash in sync payload.
      // Staff only: customer accounts live in the same table, and once they pushed the row count past
      // the cap, riders created later fell off the list and the Cashier Orders Hub had no riders to pick.
      usersPromise = query(`
        SELECT id, name, phone, email, address, role,
               branch_id as "branchId", status, no_show_count as "noShowCount",
               rider_availability as "riderAvailability",
               rider_total_deliveries as "riderTotalDeliveries",
               rider_active_order_id as "riderActiveOrderId",
               assigned_floor as "assignedFloor",
               assigned_table_numbers as "assignedTableNumbers",
               created_at as "createdAt", updated_at as "updatedAt"
        FROM users
        WHERE role IS NULL OR role <> 'customer'
        ORDER BY created_at ASC LIMIT 500
      `).catch(() => ({ rows: [] }));
    }

    const notificationsPromise: Promise<{ rows: any[] }> = ensureNotificationsTable()
      .then(() =>
        query(
          `SELECT * FROM notifications ORDER BY created_at DESC LIMIT 80`
        ).catch(() => ({ rows: [] }))
      )
      .catch(() => ({ rows: [] }));

    const [ordersRes, tablesRes, shiftsRes, refundsRes, sessionsRes, usersRes, notificationsRes, notificationSettings, receiverNotificationSettingsMap, catalog] =
      await Promise.all([
        query(orderSql, orderParams).catch((err) => {
          console.error('[Sync Order Query Error]:', err);
          return { rows: [] };
        }),
        tablesPromise,
        shiftPromise,
        refundPromise,
        sessionPromise,
        usersPromise,
        notificationsPromise,
        getNotificationSettings(),
        getReceiverNotificationSettingsMap(),
        getCachedCatalogData(scope === 'full'),
      ]);

    const notifications = (notificationsRes.rows || []).map(mapNotificationRow);

    const orders = ordersRes.rows.map(formatOrderRow).filter(Boolean);

    const shifts = shiftsRes.rows.map((s: any) => ({
      ...s,
      openingFloat: Number(s.openingFloat || 0),
      cashCollected: Number(s.cashCollected || 0),
      expectedCash: Number(s.expectedCash || 0),
      countedCash: s.countedCash !== null ? Number(s.countedCash) : undefined,
      difference: s.difference !== null ? Number(s.difference) : undefined,
    }));

    const refunds = refundsRes.rows.map((r: any) => ({
      ...r,
      amount: Number(r.amount || 0),
    }));

    const parsedUsers = usersRes.rows.map((u: any) => ({
      ...u,
      riderAvailability:
        u.role === 'delivery_staff' ? (u.riderAvailability || 'available') : u.riderAvailability,
      riderTotalDeliveries: u.riderTotalDeliveries ? Number(u.riderTotalDeliveries) : 0,
      assignedTableNumbers:
        typeof u.assignedTableNumbers === 'string'
          ? JSON.parse(u.assignedTableNumbers)
          : (u.assignedTableNumbers || []),
    }));

    // Compute state ETag for 304 Not Modified optimization
    const stateSignature = JSON.stringify({
      orders: orders.map((o: any) => `${o.id}:${o.status}:${o.paymentStatus}:${o.version}:${o.riderStatus}:${o.assignedRiderId || ''}:${o.assignedWaiterId || ''}:${Boolean(o.sentToKitchen)}:${o.sentToKitchenAt || ''}:${o.forwardToKitchenAt || ''}`),
      tables: tablesRes.rows.map((t: any) => `${t.id}:${t.status}:${t.currentOrderId}`),
      branches: catalog.branches.map((b: any) => `${b.id}:${b.isOpen}:${b.isBusy}:${JSON.stringify(b.paymentSettings || '')}:${b.deliveryEnabled}:${b.prepTimeEstimateMin}`),
      riders: parsedUsers.filter((u: any) => u.role === 'delivery_staff').map((r: any) => `${r.id}:${r.riderAvailability || 'available'}:${r.status}:${r.riderActiveOrderId || ''}`),
      notifications: notifications.slice(0, 30).map((n: any) => `${n.id}:${(n.readBy || []).length}`),
      notificationSettingsUpdatedAt: notificationSettings?.updatedAt || JSON.stringify(notificationSettings?.events || {}),
      receiverNotificationSettingsSig: JSON.stringify(Object.keys(receiverNotificationSettingsMap || {}).map((k) => `${k}:${receiverNotificationSettingsMap[k]?.updatedAt || ''}`)),
      homeNotificationUpdatedAt: catalog.footerSettings?.homeNotificationUpdatedAt || '',
      menuSignature: catalog.menuItems.map((m: any) => `${m.id}:${m.basePrice}:${m.isAvailable}:${JSON.stringify(m.branchAvailability || {})}:${JSON.stringify(m.branchPriceOverrides || {})}`),
      categories: catalog.categories,
      scope,
    });
    const etag = `"sync-${crypto.createHash('sha1').update(stateSignature).digest('hex').slice(0, 16)}"`;

    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'private, no-cache',
        },
      });
    }

    const responsePayload: any = {
      timestamp: new Date().toISOString(),
      etag,
      orders,
      tables: tablesRes.rows,
      shifts,
      refunds,
      sessions: sessionsRes.rows,
      branches: catalog.branches,
      users: parsedUsers,
      menuItems: catalog.menuItems,
      categories: catalog.categories,
      announcements: catalog.announcements,
      notifications,
      notificationSettings,
      receiverNotificationSettingsMap,
      footerSettings: catalog.footerSettings,
    };

    const serializedBody = JSON.stringify(responsePayload);
    await cacheSet(syncCacheKey, { etag, responseBody: serializedBody }, 5);

    return new NextResponse(serializedBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ETag: etag,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Sync failed', details: err?.message }, { status: 500 });
  }
}
