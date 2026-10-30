import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    let sql = `
      SELECT id, order_id as "orderId", order_number as "orderNumber",
             branch_id as "branchId", amount, reason, requested_by as "requestedBy",
             status, created_at as "createdAt", approved_by as "approvedBy",
             approved_at as "approvedAt"
      FROM refund_requests
      WHERE id NOT LIKE 'ref-pending-%' 
        AND id NOT LIKE 'ref-approved-%'
        AND id NOT IN ('ref-pending-1', 'ref-approved-1')
        AND order_number NOT IN ('FC-8812', 'FC-9021', 'FC-8492', 'FC-6744', 'FC-7819')
    `;
    const params: any[] = [];

    if (branchId) {
      sql += ` AND branch_id = $1`;
      params.push(branchId);
    }

    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const res = await query(sql, params);
    const refunds = res.rows.map((row: any) => ({
      ...row,
      amount: Number(row.amount) || 0,
    }));

    return NextResponse.json({ refunds });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch refunds from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id = `ref-${Date.now()}`,
      orderId,
      orderNumber,
      branchId,
      amount,
      reason,
      requestedBy,
      status = 'requested',
    } = body;

    const sql = `
      INSERT INTO refund_requests (
        id, order_id, order_number, branch_id, amount, reason, requested_by, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP
      ) RETURNING *
    `;
    const values = [id, orderId, orderNumber, branchId, amount, reason, requestedBy, status];

    const res = await query(sql, values);
    return NextResponse.json({ success: true, refund: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create refund request in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { refundId, status, approvedBy } = body;

    if (!refundId) {
      return NextResponse.json({ error: 'refundId is required' }, { status: 400 });
    }

    const sql = `
      UPDATE refund_requests
      SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const res = await query(sql, [status, approvedBy || null, refundId]);
    const updatedRefund = res.rows[0];

    // If approved, update order payment_status to 'refunded'
    if (updatedRefund && status === 'approved') {
      try {
        await query(
          `UPDATE orders SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = $1 OR order_number = $2`,
          [updatedRefund.order_id, updatedRefund.order_number]
        );
      } catch (e) {}
    }

    return NextResponse.json({ success: true, refund: updatedRefund });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update refund in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
