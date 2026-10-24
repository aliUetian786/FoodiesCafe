import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query(
      `SELECT id, name, city, address, phone, opening_hours as "openingHours",
              is_open as "isOpen", is_busy as "isBusy",
              prep_time_estimate_min as "prepTimeEstimateMin",
              full_edit_window_min as "fullEditWindowMin",
              stop_add_ons_min_before_ready as "stopAddOnsMinBeforeReady",
              delivery_enabled as "deliveryEnabled",
              latitude, longitude,
              payment_settings as "paymentSettings"
       FROM branches
       ORDER BY city ASC, name ASC`
    );
    return NextResponse.json({ branches: res.rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch branches from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { branchId, settings } = body;

    if (!branchId || !settings) {
      return NextResponse.json({ error: 'branchId and settings are required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (settings.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(settings.name);
    }
    if (settings.city !== undefined) {
      updates.push(`city = $${idx++}`);
      values.push(settings.city);
    }
    if (settings.address !== undefined) {
      updates.push(`address = $${idx++}`);
      values.push(settings.address);
    }
    if (settings.phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      values.push(settings.phone);
    }
    if (settings.latitude !== undefined) {
      updates.push(`latitude = $${idx++}`);
      values.push(settings.latitude);
    }
    if (settings.longitude !== undefined) {
      updates.push(`longitude = $${idx++}`);
      values.push(settings.longitude);
    }
    if (settings.isOpen !== undefined) {
      updates.push(`is_open = $${idx++}`);
      values.push(settings.isOpen);
    }
    if (settings.isBusy !== undefined) {
      updates.push(`is_busy = $${idx++}`);
      values.push(settings.isBusy);
    }
    if (settings.prepTimeEstimateMin !== undefined) {
      updates.push(`prep_time_estimate_min = $${idx++}`);
      values.push(settings.prepTimeEstimateMin);
    }
    if (settings.fullEditWindowMin !== undefined) {
      updates.push(`full_edit_window_min = $${idx++}`);
      values.push(settings.fullEditWindowMin);
    }
    if (settings.stopAddOnsMinBeforeReady !== undefined) {
      updates.push(`stop_add_ons_min_before_ready = $${idx++}`);
      values.push(settings.stopAddOnsMinBeforeReady);
    }
    if (settings.paymentSettings !== undefined) {
      updates.push(`payment_settings = $${idx++}`);
      values.push(JSON.stringify(settings.paymentSettings));
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'No valid updates provided' });
    }

    values.push(branchId);
    const sql = `UPDATE branches SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`;
    const res = await query(sql, values);

    return NextResponse.json({ success: true, branch: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update branch in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
