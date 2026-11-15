import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { writeAuditLog, requireAuth, normalizeBranchId } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function GET(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager', 'cashier']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    let sql = `
      SELECT id, order_id as "orderId", order_number as "orderNumber",
             branch_id as "branchId", amount, reason, requested_by as "requestedBy",
             status, created_at as "createdAt", approved_by as "approvedBy",
             approved_at as "approvedAt"
      FROM refund_requests
    `;
    const params: any[] = [];

    if (auth.role !== 'platform_owner') {
      const assignedBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      sql += ` WHERE branch_id = $1`;
      params.push(assignedBranch);
    } else if (branchId && branchId !== 'all') {
      sql += ` WHERE branch_id = $1`;
      params.push(normalizeBranchId(branchId));
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
    const { auth, errorResponse } = requireAuth(request, ['cashier', 'branch_manager', 'platform_owner']);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const {
      id = `ref-${Date.now()}`,
      orderId,
      orderNumber,
      branchId,
      amount,
      reason,
    } = body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid positive refund amount is required.' }, { status: 400 });
    }

    const targetBranch =
      auth.role === 'platform_owner'
        ? normalizeBranchId(branchId || 'gulberg-lahore')
        : normalizeBranchId(auth.branchId || 'gulberg-lahore');

    const sql = `
      INSERT INTO refund_requests (
        id, order_id, order_number, branch_id, amount, reason, requested_by, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'requested', CURRENT_TIMESTAMP
      ) RETURNING *
    `;
    const values = [
      id,
      orderId,
      orderNumber,
      targetBranch,
      Number(amount),
      reason || 'Customer refund request',
      auth.userId,
    ];

    const res = await query(sql, values);

    await writeAuditLog({
      actorId: auth.userId,
      actorName: auth.userName || auth.role,
      actorRole: auth.role,
      branchId: targetBranch,
      action: 'refund_requested',
      details: `Refund requested for Order #${orderNumber || orderId} (Rs. ${amount}): ${reason || 'N/A'}`,
      newValue: String(amount),
    });

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
    const { auth, errorResponse } = requireAuth(request, ['branch_manager', 'platform_owner']);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { refundId, status } = body;

    if (!refundId) {
      return NextResponse.json({ error: 'refundId is required' }, { status: 400 });
    }
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
    }

    const checkRes = await query(`SELECT * FROM refund_requests WHERE id = $1`, [refundId]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Refund request not found' }, { status: 404 });
    }
    const currentRef = checkRes.rows[0];
    const refundAmount = Number(currentRef.amount) || 0;

    // PRD F13 Policy: Manager approval limit Rs. 3,000; Owner required above Rs. 3,000
    if (auth.role === 'branch_manager') {
      const managerBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      if (normalizeBranchId(currentRef.branch_id) !== managerBranch) {
        return NextResponse.json(
          { error: 'Cross-branch refund approval denied: staff cannot approve refunds for another branch.' },
          { status: 403 }
        );
      }
      if (refundAmount > 3000) {
        return NextResponse.json(
          {
            error: `Refund amount of Rs. ${refundAmount} exceeds Branch Manager approval limit (Rs. 3,000). Platform Owner approval is required.`,
          },
          { status: 403 }
        );
      }
    }

    const sql = `
      UPDATE refund_requests
      SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const res = await query(sql, [status, auth.userId, refundId]);
    const updatedRefund = res.rows[0];

    // If approved, update order payment_status to 'refunded'
    if (updatedRefund && status === 'approved') {
      try {
        await query(
          `UPDATE orders SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = $1 OR order_number = $2`,
          [updatedRefund.order_id, updatedRefund.order_number]
        );
        broadcastRealtimeEvent({
          type: 'ORDER_UPDATED',
          branchId: updatedRefund.branch_id,
          orderId: updatedRefund.order_id,
        });
      } catch {}
    }

    await writeAuditLog({
      actorId: auth.userId,
      actorName: auth.userName || auth.role,
      actorRole: auth.role,
      branchId: updatedRefund?.branch_id || null,
      action: `refund_${status}`,
      details: `Refund ${refundId} for Order #${updatedRefund?.order_number || updatedRefund?.order_id} (Rs. ${refundAmount}) marked '${status}' by ${auth.userName || auth.role}.`,
      newValue: status,
    });

    return NextResponse.json({ success: true, refund: updatedRefund });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update refund in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export const PUT = PATCH;
