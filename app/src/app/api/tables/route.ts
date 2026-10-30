import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

let tablesColumnsMigrated = false;

async function ensureTablesColumns() {
  if (tablesColumnsMigrated) return;
  try {
    await query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS qr_code TEXT`);
    await query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS qr_expires_at TIMESTAMPTZ`);
    await query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS allow_qr_reserved BOOLEAN DEFAULT false`);
    tablesColumnsMigrated = true;
  } catch (e) {}
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    // Auto-migrate tables columns if missing (cached once)
    await ensureTablesColumns();

    let sql = `
      SELECT id, number, branch_id as "branchId", floor, capacity, chairs,
             status, current_order_id as "currentOrderId",
             seated_at as "seatedAt", reserved_for as "reservedFor", pin,
             qr_code as "qrCode", qr_expires_at as "qrExpiresAt",
             allow_qr_reserved as "allowQrOrderOnReserved"
      FROM tables
    `;
    const params: any[] = [];

    if (branchId) {
      sql += ` WHERE branch_id = $1`;
      params.push(branchId);
    }

    sql += ` ORDER BY floor ASC, number ASC`;

    const res = await query(sql, params);
    return NextResponse.json({ tables: res.rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch tables from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { tableId, tableNumber, branchId, status, pin, reservedFor, currentOrderId, qrCode, qrExpiresAt, allowQrOrderOnReserved } = body;

    if (!tableId && !tableNumber) {
      return NextResponse.json({ error: 'tableId or tableNumber is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);

      if (status === 'occupied') {
        updates.push(`seated_at = CURRENT_TIMESTAMP`);
      } else if (status === 'available') {
        updates.push(`seated_at = NULL`);
        updates.push(`current_order_id = NULL`);
        updates.push(`reserved_for = NULL`);
      } else if (status === 'cleaning') {
        updates.push(`current_order_id = NULL`);
        updates.push(`reserved_for = NULL`);
      } else if (status === 'reserved') {
        updates.push(`current_order_id = NULL`);
      }
    }
    if (pin !== undefined) {
      updates.push(`pin = $${idx++}`);
      values.push(pin);
    }
    if (reservedFor !== undefined) {
      updates.push(`reserved_for = $${idx++}`);
      values.push(reservedFor);
    }
    if (currentOrderId !== undefined && status !== 'available') {
      updates.push(`current_order_id = $${idx++}`);
      values.push(currentOrderId);
    }
    if (qrCode !== undefined) {
      updates.push(`qr_code = $${idx++}`);
      values.push(qrCode);
    }
    if (qrExpiresAt !== undefined) {
      updates.push(`qr_expires_at = $${idx++}`);
      values.push(qrExpiresAt);
    }
    if (allowQrOrderOnReserved !== undefined) {
      updates.push(`allow_qr_reserved = $${idx++}`);
      values.push(allowQrOrderOnReserved);
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'No updates provided' });
    }

    let sql = '';
    if (tableId) {
      values.push(tableId);
      sql = `UPDATE tables SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`;
    } else {
      values.push(tableNumber);
      if (branchId) {
        values.push(branchId);
        sql = `UPDATE tables SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE number = $${idx++} AND branch_id = $${idx} RETURNING *`;
      } else {
        sql = `UPDATE tables SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE number = $${idx} RETURNING *`;
      }
    }

    const res = await query(sql, values);

    return NextResponse.json({ success: true, table: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update table in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
