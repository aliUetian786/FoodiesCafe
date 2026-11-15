import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { cacheInvalidatePrefix } from '@/lib/redis';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { generateRotatableTableQrToken, writeAuditLog, requireAuth, normalizeBranchId } from '@/lib/auth';

let tablesColumnsMigrated = false;

function formatTableRow(row: any) {
  if (!row) return row;
  return {
    id: row.id,
    number: String(row.number),
    branchId: row.branchId || row.branch_id,
    floor: row.floor || 'Ground Floor',
    capacity: Number(row.capacity) || 4,
    chairs: Number(row.chairs ?? row.capacity) || 4,
    status: row.status || 'available',
    currentOrderId: row.currentOrderId ?? row.current_order_id ?? null,
    seatedAt: row.seatedAt ?? row.seated_at ?? null,
    reservedFor: row.reservedFor ?? row.reserved_for ?? null,
    pin: row.pin ? String(row.pin) : undefined,
    qrCode: row.qrCode ?? row.qr_code ?? undefined,
    qrExpiresAt: row.qrExpiresAt ?? row.qr_expires_at ?? undefined,
    allowQrOrderOnReserved: Boolean(row.allowQrOrderOnReserved ?? row.allow_qr_reserved),
    assignedWaiterId: row.assignedWaiterId ?? row.assigned_waiter_id ?? undefined,
    assignedWaiterName: row.assignedWaiterName ?? row.assigned_waiter_name ?? undefined,
  };
}

async function ensureTablesColumns() {
  if (tablesColumnsMigrated) return;
  try {
    await query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS assigned_waiter_id VARCHAR(64);`).catch(() => {});
    await query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS assigned_waiter_name VARCHAR(255);`).catch(() => {});
    tablesColumnsMigrated = true;
  } catch {}
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
             allow_qr_reserved as "allowQrOrderOnReserved",
             assigned_waiter_id as "assignedWaiterId",
             assigned_waiter_name as "assignedWaiterName"
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

export async function POST(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['branch_manager', 'platform_owner', 'floor_staff', 'cashier']);
    if (errorResponse) return errorResponse;

    await ensureTablesColumns();
    const body = await request.json();
    const {
      id = `table-${Date.now()}`,
      number,
      branchId = 'gulberg-lahore',
      floor = 'Ground Floor',
      capacity = 4,
      chairs = capacity,
      status = 'available',
      pin = Math.floor(1000 + Math.random() * 9000).toString(),
    } = body;

    if (!number) {
      return NextResponse.json({ error: 'Table number is required' }, { status: 400 });
    }

    const normBranch = normalizeBranchId(branchId);
    const sql = `
      INSERT INTO tables (id, number, branch_id, floor, capacity, chairs, status, pin)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        number = EXCLUDED.number,
        floor = EXCLUDED.floor,
        capacity = EXCLUDED.capacity,
        chairs = EXCLUDED.chairs,
        status = EXCLUDED.status,
        pin = EXCLUDED.pin,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, number, branch_id as "branchId", floor, capacity, chairs, status, pin
    `;
    const res = await query(sql, [
      id,
      String(number),
      normBranch,
      floor,
      Number(capacity) || 4,
      Number(chairs ?? capacity) || 4,
      status,
      String(pin),
    ]);

    await Promise.all([
      cacheInvalidatePrefix('tables:'),
      cacheInvalidatePrefix('sync:payload:'),
    ]);

    const formattedTable = formatTableRow(res.rows[0]);
    try {
      broadcastRealtimeEvent({
        type: 'TABLE_UPDATED',
        branchId: normBranch,
        tableNumber: String(number),
        data: formattedTable,
      });
    } catch {}

    return NextResponse.json({ success: true, table: formattedTable });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create table in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, [
      'floor_staff',
      'cashier',
      'branch_manager',
      'platform_owner',
      'customer',
    ]);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const {
      tableId,
      tableNumber,
      branchId,
      floor,
      capacity,
      chairs,
      status,
      pin,
      reservedFor,
      currentOrderId,
      qrCode,
      qrExpiresAt,
      rotateQr,
      allowQrOrderOnReserved,
      assignedWaiterId,
      assignedWaiterName,
      actorId,
      actorName,
      actorRole,
    } = body;

    if (!tableId && !tableNumber) {
      return NextResponse.json({ error: 'tableId or tableNumber is required' }, { status: 400 });
    }

    const effectiveQrCode =
      rotateQr && (branchId || tableId) && tableNumber
        ? generateRotatableTableQrToken(branchId || 'gulberg-lahore', Number(tableNumber))
        : qrCode;

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
    if (effectiveQrCode !== undefined) {
      updates.push(`qr_code = $${idx++}`);
      values.push(effectiveQrCode);
    }
    if (qrExpiresAt !== undefined) {
      updates.push(`qr_expires_at = $${idx++}`);
      values.push(qrExpiresAt);
    }
    if (allowQrOrderOnReserved !== undefined) {
      updates.push(`allow_qr_reserved = $${idx++}`);
      values.push(allowQrOrderOnReserved);
    }
    if (assignedWaiterId !== undefined) {
      updates.push(`assigned_waiter_id = $${idx++}`);
      values.push(assignedWaiterId || null);
    }
    if (assignedWaiterName !== undefined) {
      updates.push(`assigned_waiter_name = $${idx++}`);
      values.push(assignedWaiterName || null);
    }
    if (floor !== undefined) {
      updates.push(`floor = $${idx++}`);
      values.push(floor);
    }
    if (capacity !== undefined) {
      updates.push(`capacity = $${idx++}`);
      values.push(Number(capacity) || 4);
    }
    if (chairs !== undefined) {
      updates.push(`chairs = $${idx++}`);
      values.push(Number(chairs) || 4);
    }
    if (tableNumber !== undefined && tableId) {
      updates.push(`number = $${idx++}`);
      values.push(String(tableNumber));
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
    await Promise.all([
      cacheInvalidatePrefix('tables:'),
      cacheInvalidatePrefix('sync:payload:'),
    ]);

    const updatedTable = formatTableRow(res.rows[0]);
    if (updatedTable && (status !== undefined || effectiveQrCode !== undefined)) {
      await writeAuditLog({
        actorId: actorId || 'staff-table',
        actorName: actorName || 'Floor/Branch Staff',
        actorRole: actorRole || 'floor_staff',
        branchId: branchId || updatedTable.branchId || 'gulberg-lahore',
        action: rotateQr ? 'table_qr_rotated' : 'table_status_override',
        details: `Table ${updatedTable.number} updated (status=${updatedTable.status}${rotateQr ? ', QR rotated' : ''})`,
        newValue: String(updatedTable.status || ''),
      });
    }
    try {
      broadcastRealtimeEvent({
        type: 'TABLE_UPDATED',
        branchId: branchId || updatedTable?.branchId,
        tableNumber: updatedTable?.number,
        data: updatedTable,
      });
    } catch (e) {}

    return NextResponse.json({ success: true, table: updatedTable });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update table in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export const PUT = PATCH;

export async function DELETE(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['branch_manager', 'platform_owner', 'cashier']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || searchParams.get('tableId');
    if (!id) {
      return NextResponse.json({ error: 'Table ID is required' }, { status: 400 });
    }

    await query(`DELETE FROM tables WHERE id = $1 OR number = $1`, [id]);
    await Promise.all([
      cacheInvalidatePrefix('tables:'),
      cacheInvalidatePrefix('sync:payload:'),
    ]);

    try {
      broadcastRealtimeEvent({ type: 'TABLE_UPDATED' });
    } catch {}

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete table from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
