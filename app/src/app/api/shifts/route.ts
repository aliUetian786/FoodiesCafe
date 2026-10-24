import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
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

    if (branchId) {
      sql += ` WHERE branch_id = $1`;
      params.push(branchId);
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
    const body = await request.json();
    const {
      id = `sh-${Date.now()}`,
      cashierId,
      cashierName,
      branchId,
      openingFloat = 0,
      cashCollected = 0,
      expectedCash = openingFloat,
      status = 'open',
    } = body;

    const sql = `
      INSERT INTO cash_shifts (
        id, cashier_id, cashier_name, branch_id, opened_at,
        opening_float, cash_collected, expected_cash, status
      ) VALUES (
        $1, $2, $3, $4, CURRENT_TIMESTAMP,
        $5, $6, $7, $8
      ) RETURNING *
    `;
    const values = [id, cashierId, cashierName, branchId, openingFloat, cashCollected, expectedCash, status];

    const res = await query(sql, values);
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
    const body = await request.json();
    const {
      shiftId,
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

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (cashCollected !== undefined) {
      updates.push(`cash_collected = $${idx++}`);
      values.push(cashCollected);
    }
    if (expectedCash !== undefined) {
      updates.push(`expected_cash = $${idx++}`);
      values.push(expectedCash);
    }
    if (countedCash !== undefined) {
      updates.push(`counted_cash = $${idx++}`);
      values.push(countedCash);
    }
    if (difference !== undefined) {
      updates.push(`difference = $${idx++}`);
      values.push(difference);
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

    return NextResponse.json({ success: true, shift: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update shift in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
