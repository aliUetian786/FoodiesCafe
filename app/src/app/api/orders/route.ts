import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

let ordersColumnsMigrated = false;

async function ensureOrdersColumns() {
  if (ordersColumnsMigrated) return;
  try {
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS sent_to_kitchen BOOLEAN DEFAULT false`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS sent_to_kitchen_at TIMESTAMPTZ`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS forward_to_kitchen_at TIMESTAMPTZ`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_forward_custom_min INT`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_id VARCHAR(64)`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(255)`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN DEFAULT false`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_rider_id VARCHAR(64)`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_rider_name VARCHAR(255)`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS rider_status VARCHAR(30)`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_collected BOOLEAN DEFAULT false`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_coordinates JSONB`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_waiter_id VARCHAR(64)`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_waiter_name VARCHAR(255)`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_table_qr BOOLEAN DEFAULT false`);
    await query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_notified BOOLEAN DEFAULT false`);
    ordersColumnsMigrated = true;
  } catch (e) {}
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const customerPhone = searchParams.get('customerPhone');
    const dateScope = searchParams.get('dateScope');
    const older = searchParams.get('older');

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const fetchAllHistory = dateScope === 'all' || older === 'true' || Boolean(customerPhone);

    // Auto-migrate orders columns if missing (cached once)
    await ensureOrdersColumns();

    let sql = `
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
    const params: any[] = [];
    const whereClauses: string[] = [
      "id NOT LIKE 'ord-seed-%'",
      "order_number NOT IN ('FC-6744', 'FC-7819', 'FC-8812', 'FC-9021')"
    ];

    if (branchId && branchId !== 'all') {
      params.push(branchId);
      whereClauses.push(`branch_id = $${params.length}`);
    }

    if (customerPhone) {
      params.push(customerPhone);
      whereClauses.push(`customer_phone = $${params.length}`);
    } else if (startDate || endDate) {
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
    } else if (!fetchAllHistory) {
      // By default, only fetch today's data or active in-flight orders to keep initial load lightweight and fast
      whereClauses.push(`(created_at >= (NOW() - INTERVAL '24 hours') OR status IN ('placed', 'accepted', 'preparing', 'ready', 'served', 'out_for_delivery'))`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY created_at DESC LIMIT ${fetchAllHistory || startDate || dateScope ? 350 : 100}`;

    let res;
    try {
      res = await query(sql, params);
    } catch (err) {
      // Fallback if migration hasn't run
      const fallbackWhere = whereClauses.length > 0 ? ` WHERE ` + whereClauses.join(' AND ') : '';
      const fallbackSql = `
        SELECT id, order_number as "orderNumber", branch_id as "branchId",
               customer_id as "customerId", customer_name as "customerName", customer_phone as "customerPhone",
               type, table_number as "tableNumber", table_pin as "tablePin", pickup_time as "pickupTime",
               status, payment_status as "paymentStatus", payment_method as "paymentMethod",
               items, original_subtotal as "originalSubtotal", add_on_subtotal as "addOnSubtotal",
               tax, total, created_at as "createdAt",
               preparation_started_at as "preparationStartedAt",
               ready_time_estimated as "readyTimeEstimated",
               completed_at as "completedAt",
               notes, delivery_address as "deliveryAddress", version
        FROM orders
        ${fallbackWhere}
        ORDER BY created_at DESC LIMIT ${fetchAllHistory ? 300 : 100}
      `;
      res = await query(fallbackSql, params);
    }

    const orders = res.rows.map((row: any) => ({
      ...row,
      originalSubtotal: Number(row.originalSubtotal) || 0,
      addOnSubtotal: Number(row.addOnSubtotal) || 0,
      tax: Number(row.tax) || 0,
      total: Number(row.total) || 0,
      version: Number(row.version) || 1,
      sentToKitchen: row.sentToKitchen !== undefined ? Boolean(row.sentToKitchen) : (row.status !== 'placed'),
      sentToKitchenAt: row.sentToKitchenAt || null,
      forwardToKitchenAt: row.forwardToKitchenAt || null,
      autoForwardCustomMin: row.autoForwardCustomMin ? Number(row.autoForwardCustomMin) : undefined,
      assignedRiderId: row.assignedRiderId || undefined,
      assignedRiderName: row.assignedRiderName || undefined,
      riderStatus: row.riderStatus || undefined,
      deliveredAt: row.deliveredAt || undefined,
      paymentCollected: Boolean(row.paymentCollected),
      customerCoordinates: row.customerCoordinates || undefined,
      items: (Array.isArray(row.items) ? row.items : JSON.parse(row.items || '[]')).map((it: any) => ({
        ...it,
        unitPrice: Number(it.unitPrice) || 0,
        quantity: Number(it.quantity) || 1,
      })),
    }));
    return NextResponse.json({ orders });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch orders from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      orderNumber,
      branchId,
      customerId,
      customerName,
      customerPhone,
      type,
      tableNumber,
      tablePin,
      pickupTime,
      status = 'placed',
      paymentStatus = 'unpaid',
      paymentMethod = 'Cash',
      items,
      originalSubtotal,
      addOnSubtotal = 0,
      tax = 0,
      total,
      notes,
      deliveryAddress,
      version = 1,
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
    } = body;

    let res;
    try {
      const sql = `
        INSERT INTO orders (
          id, order_number, branch_id, customer_id, customer_name, customer_phone,
          type, table_number, table_pin, pickup_time, status, payment_status,
          payment_method, items, original_subtotal, add_on_subtotal, tax, total,
          notes, delivery_address, version, sent_to_kitchen, sent_to_kitchen_at,
          forward_to_kitchen_at, auto_forward_custom_min, cashier_id, cashier_name, is_walk_in,
          assigned_rider_id, assigned_rider_name, rider_status, delivered_at, payment_collected, customer_coordinates,
          assigned_waiter_id, assigned_waiter_name, is_table_qr, waiter_notified
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14::jsonb, $15, $16, $17, $18,
          $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
          $29, $30, $31, $32, $33, $34::jsonb,
          $35, $36, $37, $38
        ) RETURNING *
      `;

      const values = [
        id || `ord-${Date.now()}`,
        orderNumber,
        branchId,
        customerId,
        customerName,
        customerPhone,
        type,
        tableNumber || null,
        tablePin || null,
        pickupTime || null,
        status,
        paymentStatus,
        paymentMethod,
        JSON.stringify(items || []),
        originalSubtotal,
        addOnSubtotal,
        tax,
        total,
        notes || null,
        deliveryAddress || null,
        version,
        sentToKitchen,
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
        Boolean(paymentCollected),
        customerCoordinates ? JSON.stringify(customerCoordinates) : null,
        assignedWaiterId || null,
        assignedWaiterName || null,
        Boolean(isTableQr),
        Boolean(waiterNotified),
      ];

      res = await query(sql, values);
    } catch (err) {
      // Fallback without new columns
      const fallbackSql = `
        INSERT INTO orders (
          id, order_number, branch_id, customer_id, customer_name, customer_phone,
          type, table_number, table_pin, pickup_time, status, payment_status,
          payment_method, items, original_subtotal, add_on_subtotal, tax, total,
          notes, delivery_address, version
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14::jsonb, $15, $16, $17, $18,
          $19, $20, $21
        ) RETURNING *
      `;
      const fallbackValues = [
        id || `ord-${Date.now()}`,
        orderNumber,
        branchId,
        customerId,
        customerName,
        customerPhone,
        type,
        tableNumber || null,
        tablePin || null,
        pickupTime || null,
        status,
        paymentStatus,
        paymentMethod,
        JSON.stringify(items || []),
        originalSubtotal,
        addOnSubtotal,
        tax,
        total,
        notes || null,
        deliveryAddress || null,
        version,
      ];
      res = await query(fallbackSql, fallbackValues);
    }

    if (type === 'dine_in' && tableNumber && branchId) {
      try {
        await query(
          `UPDATE tables SET status = 'occupied', current_order_id = $1, seated_at = CURRENT_TIMESTAMP WHERE number = $2 AND branch_id = $3`,
          [id || orderNumber, tableNumber, branchId]
        );
      } catch (e) {}
    }

    return NextResponse.json({ success: true, order: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create order in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const orderId = body.orderId || body.id;
    const {
      status,
      paymentStatus,
      items,
      total,
      originalSubtotal,
      addOnSubtotal,
      notes,
      version,
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
    } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

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

    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);

      if (status === 'preparing') {
        updates.push(`preparation_started_at = CURRENT_TIMESTAMP`);
      } else if (status === 'completed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }
    if (paymentStatus !== undefined) {
      updates.push(`payment_status = $${idx++}`);
      values.push(paymentStatus);
    }
    if (items !== undefined) {
      updates.push(`items = $${idx++}::jsonb`);
      values.push(JSON.stringify(items));
    }
    if (total !== undefined) {
      updates.push(`total = $${idx++}`);
      values.push(total);
    }
    if (originalSubtotal !== undefined) {
      updates.push(`original_subtotal = $${idx++}`);
      values.push(originalSubtotal);
    }
    if (addOnSubtotal !== undefined) {
      updates.push(`add_on_subtotal = $${idx++}`);
      values.push(addOnSubtotal);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${idx++}`);
      values.push(notes);
    }
    if (version !== undefined) {
      updates.push(`version = $${idx++}`);
      values.push(version);
    }
    if (sentToKitchen !== undefined) {
      try {
        updates.push(`sent_to_kitchen = $${idx++}`);
        values.push(sentToKitchen);
      } catch (e) {}
    }
    if (sentToKitchenAt !== undefined) {
      try {
        updates.push(`sent_to_kitchen_at = $${idx++}`);
        values.push(sentToKitchenAt);
      } catch (e) {}
    }
    if (forwardToKitchenAt !== undefined) {
      try {
        updates.push(`forward_to_kitchen_at = $${idx++}`);
        values.push(forwardToKitchenAt);
      } catch (e) {}
    }
    if (autoForwardCustomMin !== undefined) {
      try {
        updates.push(`auto_forward_custom_min = $${idx++}`);
        values.push(autoForwardCustomMin);
      } catch (e) {}
    }
    if (assignedRiderId !== undefined) {
      updates.push(`assigned_rider_id = $${idx++}`);
      values.push(assignedRiderId || null);
    }
    if (assignedRiderName !== undefined) {
      updates.push(`assigned_rider_name = $${idx++}`);
      values.push(assignedRiderName || null);
    }
    if (riderStatus !== undefined) {
      updates.push(`rider_status = $${idx++}`);
      values.push(riderStatus || null);
    }
    if (deliveredAt !== undefined) {
      updates.push(`delivered_at = $${idx++}`);
      values.push(deliveredAt || null);
    }
    if (paymentCollected !== undefined) {
      updates.push(`payment_collected = $${idx++}`);
      values.push(Boolean(paymentCollected));
    }
    if (customerCoordinates !== undefined) {
      updates.push(`customer_coordinates = $${idx++}::jsonb`);
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
    if (isTableQr !== undefined) {
      updates.push(`is_table_qr = $${idx++}`);
      values.push(Boolean(isTableQr));
    }
    if (waiterNotified !== undefined) {
      updates.push(`waiter_notified = $${idx++}`);
      values.push(Boolean(waiterNotified));
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'No updates provided' });
    }

    values.push(orderId);
    let res;
    try {
      const sql = `UPDATE orders SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} OR order_number = $${idx} RETURNING *`;
      res = await query(sql, values);
    } catch (err) {
      // Fallback to update only core fields if extra columns missing
      const coreUpdates = updates.filter(u => !u.includes('sent_to_kitchen') && !u.includes('forward_to_kitchen_at') && !u.includes('auto_forward_custom_min'));
      if (coreUpdates.length > 0) {
        const coreValues = values.slice(0, coreUpdates.length);
        coreValues.push(orderId);
        const fallbackSql = `UPDATE orders SET ${coreUpdates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${coreValues.length} OR order_number = $${coreValues.length} RETURNING *`;
        res = await query(fallbackSql, coreValues);
      }
    }

    if (status === 'completed' || status === 'cancelled') {
      try {
        await query(
          `UPDATE tables SET status = 'available', current_order_id = NULL, seated_at = NULL WHERE current_order_id = $1 OR current_order_id = (SELECT id FROM orders WHERE id = $1 OR order_number = $1)`,
          [orderId]
        );
      } catch (e) {}
    }

    return NextResponse.json({ success: true, order: res?.rows?.[0] || null });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update order in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
