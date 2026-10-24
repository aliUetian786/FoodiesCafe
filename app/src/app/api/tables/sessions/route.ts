import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
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

    if (branchId) {
      sql += ` WHERE branch_id = $1`;
      params.push(branchId);
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
      id = `sess-${Date.now()}`,
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
      tableId,
      tableNumber,
      branchId,
      floor,
      customerName || null,
      orderId || null,
      orderNumber || null,
      waiterName,
      totalAmount,
      status,
    ];

    const res = await query(sql, values);
    return NextResponse.json({ success: true, session: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create table session in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, tableId, branchId, status = 'completed' } = body;

    let sql = '';
    let values: any[] = [];

    if (sessionId) {
      sql = `
        UPDATE table_sessions
        SET status = $1, ended_at = CURRENT_TIMESTAMP,
            duration_min = ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) / 60)
        WHERE id = $2
        RETURNING *
      `;
      values = [status, sessionId];
    } else if (tableId && branchId) {
      sql = `
        UPDATE table_sessions
        SET status = $1, ended_at = CURRENT_TIMESTAMP,
            duration_min = ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)) / 60)
        WHERE table_id = $2 AND branch_id = $3 AND status = 'occupied'
        RETURNING *
      `;
      values = [status, tableId, branchId];
    } else {
      return NextResponse.json({ error: 'sessionId or tableId+branchId required' }, { status: 400 });
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
