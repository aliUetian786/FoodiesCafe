import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'live'; // 'live' | 'full'
    const branchId = searchParams.get('branchId');
    const includeOlder = searchParams.get('older') === 'true';

    // 1. ORDERS
    let orderSql = `
      SELECT id, order_number as "orderNumber", branch_id as "branchId",
             customer_id as "customerId", customer_name as "customerName", customer_phone as "customerPhone",
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
    const orderWhere: string[] = [
      "id NOT LIKE 'ord-seed-%'",
      "order_number NOT IN ('FC-6744', 'FC-7819', 'FC-8812', 'FC-9021')"
    ];

    if (branchId && branchId !== 'all') {
      orderParams.push(branchId);
      orderWhere.push(`branch_id = $${orderParams.length}`);
    }

    if (!includeOlder) {
      orderWhere.push(`(created_at >= (NOW() - INTERVAL '24 hours') OR status IN ('placed', 'accepted', 'preparing', 'ready', 'served', 'out_for_delivery'))`);
    }

    orderSql += ` WHERE ` + orderWhere.join(' AND ') + ` ORDER BY created_at DESC LIMIT ${includeOlder ? 300 : 100}`;

    // 2. TABLES
    let tableSql = `
      SELECT id, number, branch_id as "branchId", floor, capacity, chairs,
             status, current_order_id as "currentOrderId",
             seated_at as "seatedAt", reserved_for as "reservedFor", pin,
             qr_code as "qrCode", qr_expires_at as "qrExpiresAt",
             allow_qr_reserved as "allowQrOrderOnReserved"
      FROM tables
    `;
    const tableParams: any[] = [];
    if (branchId && branchId !== 'all') {
      tableSql += ` WHERE branch_id = $1`;
      tableParams.push(branchId);
    }
    tableSql += ` ORDER BY floor ASC, number ASC`;

    // 3. SHIFTS
    let shiftSql = `
      SELECT id, branch_id as "branchId", cashier_id as "cashierId", cashier_name as "cashierName",
             opening_float as "openingFloat", cash_collected as "cashCollected",
             expected_cash as "expectedCash", counted_cash as "countedCash",
             difference, difference_reason as "differenceReason",
             status, opened_at as "openedAt", closed_at as "closedAt"
      FROM cash_shifts
      WHERE id NOT IN ('sh-yesterday-1', 'sh-yesterday-2')
    `;
    const shiftParams: any[] = [];
    if (branchId && branchId !== 'all') {
      shiftSql += ` AND (branch_id = $1 OR branch_id IS NULL)`;
      shiftParams.push(branchId);
    }
    shiftSql += ` ORDER BY opened_at DESC LIMIT 20`;

    // 4. REFUNDS
    const refundSql = `
      SELECT id, order_id as "orderId", branch_id as "branchId",
             amount, reason, status, requested_by as "requestedBy",
             reviewed_by as "reviewedBy", created_at as "createdAt",
             reviewed_at as "reviewedAt"
      FROM refund_requests
      WHERE id NOT LIKE 'ref-%' AND id NOT LIKE 'ref-pending-%' AND id NOT LIKE 'ref-approved-%'
      ORDER BY created_at DESC LIMIT 30
    `;

    // 5. COMPLAINTS
    const complaintSql = `
      SELECT id, customer_id as "customerId", customer_name as "customerName",
             customer_phone as "customerPhone", branch_id as "branchId",
             order_id as "orderId", subject, status,
             created_at as "createdAt", updated_at as "updatedAt",
             messages
      FROM complaints
      ORDER BY updated_at DESC LIMIT 30
    `;

    // 6. SESSIONS
    const sessionSql = `
      SELECT id, table_id as "tableId", branch_id as "branchId",
             table_number as "tableNumber", seated_at as "seatedAt",
             customer_count as "customerCount", order_id as "orderId",
             status
      FROM table_sessions
      WHERE id NOT LIKE 'sess-%'
      ORDER BY seated_at DESC LIMIT 30
    `;

    // Run parallel live queries in a single database round-trip batch
    const [ordersRes, tablesRes, shiftsRes, refundsRes, complaintsRes, sessionsRes] = await Promise.all([
      query(orderSql, orderParams).catch(() => ({ rows: [] })),
      query(tableSql, tableParams).catch(() => ({ rows: [] })),
      query(shiftSql, shiftParams).catch(() => ({ rows: [] })),
      query(refundSql).catch(() => ({ rows: [] })),
      query(complaintSql).catch(() => ({ rows: [] })),
      query(sessionSql).catch(() => ({ rows: [] })),
    ]);

    // Parse items/messages JSON if needed
    const orders = ordersRes.rows.map((o: any) => ({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []),
      customerCoordinates: typeof o.customerCoordinates === 'string' ? JSON.parse(o.customerCoordinates) : o.customerCoordinates,
      originalSubtotal: Number(o.originalSubtotal || 0),
      addOnSubtotal: Number(o.addOnSubtotal || 0),
      tax: Number(o.tax || 0),
      total: Number(o.total || 0),
    }));

    const complaints = complaintsRes.rows.map((c: any) => ({
      ...c,
      messages: typeof c.messages === 'string' ? JSON.parse(c.messages) : (c.messages || []),
    }));

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

    const responsePayload: any = {
      timestamp: new Date().toISOString(),
      orders,
      tables: tablesRes.rows,
      shifts,
      refunds,
      complaints,
      sessions: sessionsRes.rows,
    };

    // If 'full' scope requested (initial boot or manual refresh), also fetch static data
    if (scope === 'full') {
      const [branchesRes, menuRes, catRes, mktRes, usersRes] = await Promise.all([
        query(`
          SELECT id, name, city, address, phone, opening_hours as "openingHours",
                 is_open as "isOpen", is_busy as "isBusy",
                 prep_time_estimate_min as "prepTimeEstimateMin",
                 full_edit_window_min as "fullEditWindowMin",
                 stop_add_ons_min_before_ready as "stopAddOnsMinBeforeReady",
                 delivery_enabled as "deliveryEnabled",
                 latitude, longitude,
                 COALESCE(max_order_distance_km, 50) as "maxOrderDistanceKm",
                 COALESCE(table_qr_max_distance_meters, 300) as "tableQrMaxDistanceMeters",
                 payment_settings as "paymentSettings"
          FROM branches
          ORDER BY city ASC, name ASC
        `).catch(() => ({ rows: [] })),
        query(`
          SELECT id, name, category, description, base_price as "basePrice",
                 image_url as "imageUrl", is_available as "isAvailable",
                 branch_availability as "branchAvailability",
                 branch_price_overrides as "branchPriceOverrides",
                 custom_options as "customOptions", sizes
          FROM menu_items
          ORDER BY category ASC, name ASC
        `).catch(() => ({ rows: [] })),
        query(`SELECT name FROM categories ORDER BY display_order ASC, name ASC`).catch(() => ({ rows: [] })),
        query(`SELECT * FROM footer_settings LIMIT 1`).catch(() => ({ rows: [] })),
        query(`
          SELECT id, name, phone, email, address, role,
                 branch_id as "branchId", status, no_show_count as "noShowCount",
                 rider_availability as "riderAvailability",
                 rider_total_deliveries as "riderTotalDeliveries",
                 rider_active_order_id as "riderActiveOrderId",
                 created_at as "createdAt", updated_at as "updatedAt"
          FROM users
          ORDER BY created_at ASC
        `).catch(() => ({ rows: [] })),
      ]);

      responsePayload.branches = branchesRes.rows.map((r: any) => ({
        ...r,
        paymentSettings: typeof r.paymentSettings === 'string' ? JSON.parse(r.paymentSettings) : r.paymentSettings,
      }));

      responsePayload.menuItems = menuRes.rows.map((r: any) => ({
        ...r,
        basePrice: Number(r.basePrice || 0),
        branchAvailability: typeof r.branchAvailability === 'string' ? JSON.parse(r.branchAvailability) : r.branchAvailability,
        branchPriceOverrides: typeof r.branchPriceOverrides === 'string' ? JSON.parse(r.branchPriceOverrides) : r.branchPriceOverrides,
        customOptions: typeof r.customOptions === 'string' ? JSON.parse(r.customOptions) : r.customOptions,
        sizes: typeof r.sizes === 'string' ? JSON.parse(r.sizes) : r.sizes,
      }));

      responsePayload.categories = catRes.rows.map((c: any) => c.name);
      responsePayload.users = usersRes.rows.map((u: any) => ({
        ...u,
        riderAvailability: u.role === 'delivery_staff' ? (u.riderAvailability || 'available') : u.riderAvailability,
        riderTotalDeliveries: u.riderTotalDeliveries ? Number(u.riderTotalDeliveries) : 0,
      }));

      if (mktRes.rows.length > 0) {
        const f = mktRes.rows[0];
        responsePayload.footerSettings = {
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
        };
      }
    }

    return NextResponse.json(responsePayload);
  } catch (err: any) {
    return NextResponse.json({ error: 'Sync failed', details: err?.message }, { status: 500 });
  }
}

