import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { publishEvent } from '@/lib/realtime';
import { requireAuth, normalizeBranchId } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, [
      'floor_staff',
      'cashier',
      'branch_manager',
      'platform_owner',
    ]);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    let sql = `
      SELECT id, table_id as "tableId", table_number as "tableNumber",
             branch_id as "branchId", floor, started_at as "startedAt",
             ended_at as "endedAt", duration_min as "durationMin",
             customer_name as "customerName", order_id as "orderId",
             order_number as "orderNumber", waiter_name as "waiterName",
             total_amount as "totalAmount", status, created_at as "createdAt"
      FROM table_sessions
    `;
    const params: any[] = [];

    if (auth.role !== 'platform_owner') {
      const assignedBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      sql += ` WHERE branch_id = $1`;
      params.push(assignedBranch);
    } else if (branchId) {
      sql += ` WHERE branch_id = $1`;
      params.push(normalizeBranchId(branchId));
    }

    sql += ` ORDER BY started_at DESC LIMIT 100`;

    const res = await query(sql, params);
    const sessions = res.rows.map((row: any) => ({
      ...row,
      durationMin: row.durationMin !== null ? Number(row.durationMin) : undefined,
      totalAmount: Number(row.totalAmount) || 0,
    }));

    return NextResponse.json({ sessions });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch table sessions from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tableId,
      tableNumber,
      branchId,
      floor = 'Ground Floor',
      customerName,
      orderId,
      orderNumber,
      waiterName = 'Kashif Ali (Floor Staff)',
      totalAmount = 0,
      status = 'occupied',
    } = body;

    if (!branchId || (tableNumber === undefined && !tableId)) {
      return NextResponse.json(
        { error: 'branchId and tableNumber (or tableId) are required' },
        { status: 400 }
      );
    }

    const result = await withTransaction(async (client) => {
      // Lock the table row to prevent simultaneous QR claims
      const tableRes = tableNumber !== undefined
        ? await client.query(
            `SELECT id, number, floor, status, current_order_id FROM tables WHERE branch_id = $1 AND number = $2 FOR UPDATE`,
            [branchId, Number(tableNumber)]
          )
        : await client.query(
            `SELECT id, number, floor, status, current_order_id FROM tables WHERE branch_id = $1 AND id = $2 FOR UPDATE`,
            [branchId, tableId]
          );

      const tbl = tableRes.rows[0];
      const resolvedTableId = tbl ? tbl.id : (tableId || `tbl-${branchId}-${tableNumber}`);
      const resolvedTableNumber = tbl ? Number(tbl.number) : Number(tableNumber);
      const resolvedFloor = tbl?.floor || floor;

      if (status === 'occupied') {
        const activeSessionRes = await client.query(
          `SELECT id, order_id, customer_name FROM table_sessions WHERE branch_id = $1 AND table_number = $2 AND status = 'occupied'`,
          [branchId, resolvedTableNumber]
        );
        if (activeSessionRes.rows.length > 0) {
          const existing = activeSessionRes.rows[0];
          if (!orderId || (existing.order_id && existing.order_id !== orderId)) {
            return {
              conflict: true,
              error: `Table ${resolvedTableNumber} already has an active dining session.`,
              activeSession: existing,
            };
          }
        }

        if (tbl && tbl.status === 'occupied' && tbl.current_order_id && orderId && tbl.current_order_id !== orderId) {
          return {
            conflict: true,
            error: `Table ${resolvedTableNumber} is currently occupied by another order.`,
          };
        }
      }

      const sql = `
        INSERT INTO table_sessions (
          id, table_id, table_number, branch_id, floor,
          started_at, customer_name, order_id, order_number,
          waiter_name, total_amount, status
        ) VALUES (
          $1, $2, $3, $4, $5,
          CURRENT_TIMESTAMP, $6, $7, $8,
          $9, $10, $11
        ) RETURNING *
      `;
      const values = [
        id,
        resolvedTableId,
        resolvedTableNumber,
        branchId,
        resolvedFloor,
        customerName || null,
        orderId || null,
        orderNumber || null,
        waiterName,
        totalAmount,
        status,
      ];

      const res = await client.query(sql, values);

      if (tbl && status === 'occupied') {
        await client.query(
          `UPDATE tables SET status = 'occupied', current_order_id = COALESCE($1, current_order_id) WHERE id = $2`,
          [orderId || null, tbl.id]
        );
      }

      return { conflict: false, session: res.rows[0] };
    });

    if (result.conflict) {
      return NextResponse.json({ error: result.error, activeSession: result.activeSession }, { status: 409 });
    }

    publishEvent('table_updated', {
      branchId,
      tableId: result.session?.table_id || tableId,
      tableNumber: result.session?.table_number || tableNumber,
      status,
    });

    return NextResponse.json({ success: true, session: result.session });
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'Table already has an active dining session (concurrent claim rejected).' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create table session in PostgreSQL', details: error.message },
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
    ]);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { sessionId, tableId, branchId, status = 'completed' } = body;

    let sql = '';
    let values: any[] = [];

    let existingSession = null;
    if (sessionId) {
      const existingRes = await query(`SELECT id, started_at FROM table_sessions WHERE id = $1`, [sessionId]);
      existingSession = existingRes.rows[0];
    } else if (tableId && branchId) {
      const existingRes = await query(
        `SELECT id, started_at FROM table_sessions WHERE table_id = $1 AND branch_id = $2 AND status = 'occupied'`,
        [tableId, branchId]
      );
      existingSession = existingRes.rows[0];
    } else {
      return NextResponse.json({ error: 'sessionId or tableId+branchId required' }, { status: 400 });
    }

    const startedTime = existingSession?.started_at ? new Date(existingSession.started_at).getTime() : Date.now();
    const durMin = Math.max(1, Math.round((Date.now() - startedTime) / 60000));

    if (sessionId) {
      sql = `
        UPDATE table_sessions
        SET status = $1, ended_at = CURRENT_TIMESTAMP, duration_min = $2
        WHERE id = $3
        RETURNING *
      `;
      values = [status, durMin, sessionId];
    } else {
      sql = `
        UPDATE table_sessions
        SET status = $1, ended_at = CURRENT_TIMESTAMP, duration_min = $2
        WHERE table_id = $3 AND branch_id = $4 AND status = 'occupied'
        RETURNING *
      `;
      values = [status, durMin, tableId, branchId];
    }

    const res = await query(sql, values);
    return NextResponse.json({ success: true, session: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update table session in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
