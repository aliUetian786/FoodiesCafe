import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { writeAuditLog, requireAuth, normalizeBranchId } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function GET(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['cashier', 'branch_manager', 'platform_owner']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    let sql = `
      SELECT id, cashier_id as "cashierId", cashier_name as "cashierName",
             branch_id as "branchId", opened_at as "openedAt", closed_at as "closedAt",
             opening_float as "openingFloat", cash_collected as "cashCollected",
             expected_cash as "expectedCash", counted_cash as "countedCash",
             difference, difference_reason as "differenceReason", status
      FROM cash_shifts
    `;
    const params: any[] = [];

    if (auth.role !== 'platform_owner') {
      const assignedBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      sql += ` WHERE (branch_id = $1 OR branch_id IS NULL)`;
      params.push(assignedBranch);
    } else if (branchId && branchId !== 'all') {
      sql += ` WHERE (branch_id = $1 OR branch_id IS NULL)`;
      params.push(normalizeBranchId(branchId));
    }

    sql += ` ORDER BY opened_at DESC LIMIT 100`;

    const res = await query(sql, params);
    const shifts = res.rows.map((row: any) => ({
      ...row,
      openingFloat: Number(row.openingFloat) || 0,
      cashCollected: Number(row.cashCollected) || 0,
      expectedCash: Number(row.expectedCash) || 0,
      countedCash: row.countedCash !== null ? Number(row.countedCash) : undefined,
      difference: row.difference !== null ? Number(row.difference) : undefined,
    }));

    return NextResponse.json({ shifts });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch shifts from PostgreSQL', details: error.message },
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
      id = `sh-${Date.now()}`,
      branchId,
      openingFloat = 0,
    } = body;

    const targetBranch =
      auth.role === 'platform_owner'
        ? normalizeBranchId(branchId || 'gulberg-lahore')
        : normalizeBranchId(auth.branchId || 'gulberg-lahore');

    const sql = `
      INSERT INTO cash_shifts (
        id, cashier_id, cashier_name, branch_id, opened_at,
        opening_float, cash_collected, expected_cash, status
      ) VALUES (
        $1, $2, $3, $4, CURRENT_TIMESTAMP,
        $5, 0, $5, 'open'
      ) RETURNING *
    `;
    const values = [
      id,
      auth.userId,
      auth.userName || auth.role,
      targetBranch,
      Number(openingFloat) || 0,
    ];

    const res = await query(sql, values);
    broadcastRealtimeEvent({ type: 'SHIFT_UPDATED', branchId: targetBranch });
    return NextResponse.json({ success: true, shift: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create shift in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['cashier', 'branch_manager', 'platform_owner']);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const {
      shiftId,
      openingFloat,
      cashCollected,
      expectedCash,
      countedCash,
      difference,
      differenceReason,
      status,
    } = body;

    if (!shiftId) {
      return NextResponse.json({ error: 'shiftId is required' }, { status: 400 });
    }

    const checkRes = await query(`SELECT * FROM cash_shifts WHERE id = $1`, [shiftId]);
    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }
    const currentShift = checkRes.rows[0];

    if (auth.role !== 'platform_owner') {
      const assignedBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      if (currentShift.branch_id && normalizeBranchId(currentShift.branch_id) !== assignedBranch) {
        return NextResponse.json(
          { error: 'Cross-branch shift modification denied: staff cannot close a shift for another branch.' },
          { status: 403 }
        );
      }
    }

    // PRD F12: When closing a shift with a cash discrepancy, differenceReason is mandatory
    if (
      status === 'closed' &&
      difference !== undefined &&
      Number(difference) !== 0 &&
      (!differenceReason || !String(differenceReason).trim())
    ) {
      return NextResponse.json(
        { error: 'A differenceReason is required when closing a shift with a cash discrepancy.' },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    let computedExpectedCash = expectedCash;
    let computedDifference = difference;

    if (openingFloat !== undefined) {
      if (auth.role !== 'branch_manager' && auth.role !== 'platform_owner') {
        return NextResponse.json(
          { error: 'Only Branch Manager or Platform Owner can edit a shift opening balance.' },
          { status: 403 }
        );
      }
      const nextOpening = Math.max(0, Number(openingFloat) || 0);
      const effectiveCashCollected =
        cashCollected !== undefined ? Number(cashCollected) : Number(currentShift.cash_collected || 0);
      computedExpectedCash =
        expectedCash !== undefined ? Number(expectedCash) : nextOpening + effectiveCashCollected;
      if (
        difference === undefined &&
        currentShift.counted_cash !== null &&
        currentShift.counted_cash !== undefined
      ) {
        computedDifference = Number(currentShift.counted_cash) - computedExpectedCash;
      }

      updates.push(`opening_float = $${idx++}`);
      values.push(nextOpening);
    }

    if (cashCollected !== undefined) {
      updates.push(`cash_collected = $${idx++}`);
      values.push(cashCollected);
    }
    if (computedExpectedCash !== undefined) {
      updates.push(`expected_cash = $${idx++}`);
      values.push(computedExpectedCash);
    }
    if (countedCash !== undefined) {
      updates.push(`counted_cash = $${idx++}`);
      values.push(countedCash);
    }
    if (computedDifference !== undefined) {
      updates.push(`difference = $${idx++}`);
      values.push(computedDifference);
    }
    if (differenceReason !== undefined) {
      updates.push(`difference_reason = $${idx++}`);
      values.push(differenceReason);
    }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
      if (status === 'closed') {
        updates.push(`closed_at = CURRENT_TIMESTAMP`);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'No updates provided' });
    }

    values.push(shiftId);
    const sql = `UPDATE cash_shifts SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await query(sql, values);
    const shiftRow = res.rows[0];

    if (openingFloat !== undefined) {
      await writeAuditLog({
        actorId: auth.userId,
        actorName: auth.userName || auth.role,
        actorRole: auth.role,
        branchId: shiftRow?.branch_id || null,
        action: 'shift_opening_balance_edited',
        details: `Opening balance for shift ${shiftId} (${currentShift.cashier_name || 'Cashier'}) updated by ${auth.userName || auth.role} from Rs. ${currentShift.opening_float} to Rs. ${shiftRow?.opening_float}. New Expected Till: Rs. ${shiftRow?.expected_cash}`,
        oldValue: String(currentShift.opening_float ?? 0),
        newValue: String(shiftRow?.opening_float ?? 0),
      });
    }

    if (status === 'closed' || (difference !== undefined && Number(difference) !== 0)) {
      await writeAuditLog({
        actorId: auth.userId,
        actorName: auth.userName || auth.role,
        actorRole: auth.role,
        branchId: shiftRow?.branch_id || null,
        action: 'shift_closed',
        details: `Shift ${shiftId} closed by ${auth.userName || auth.role}. Expected: Rs. ${shiftRow?.expected_cash}, Counted: Rs. ${shiftRow?.counted_cash}, Difference: Rs. ${shiftRow?.difference}. Reason: ${shiftRow?.difference_reason || 'Exact match'}`,
        oldValue: String(shiftRow?.expected_cash || 0),
        newValue: String(shiftRow?.counted_cash || 0),
      });
    }

    broadcastRealtimeEvent({ type: 'SHIFT_UPDATED', branchId: shiftRow?.branch_id });
    return NextResponse.json({ success: true, shift: shiftRow });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update shift in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
