import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

let branchesColumnsMigrated = false;

async function ensureBranchesColumns() {
  if (branchesColumnsMigrated) return;
  try {
    await query(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS max_order_distance_km DOUBLE PRECISION NOT NULL DEFAULT 50`);
    await query(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS table_qr_max_distance_meters INT NOT NULL DEFAULT 300`);
    await query(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS payment_settings JSONB`);
    branchesColumnsMigrated = true;
  } catch (e) {}
}

export async function GET() {
  try {
    // Auto-migrate columns if missing (cached once)
    await ensureBranchesColumns();

    const res = await query(
      `SELECT id, name, city, address, phone, opening_hours as "openingHours",
              is_open as "isOpen", is_busy as "isBusy",
              prep_time_estimate_min as "prepTimeEstimateMin",
              full_edit_window_min as "fullEditWindowMin",
              stop_add_ons_min_before_ready as "stopAddOnsMinBeforeReady",
              delivery_enabled as "deliveryEnabled",
              latitude, longitude,
              COALESCE(max_order_distance_km, 50) as "maxOrderDistanceKm",
              COALESCE(table_qr_max_distance_meters, 300) as "tableQrMaxDistanceMeters",
              payment_settings as "paymentSettings"
       FROM branches
       ORDER BY city ASC, name ASC`
    );
    const rows = res.rows.map((r: any) => ({
      ...r,
      paymentSettings:
        typeof r.paymentSettings === 'string'
          ? (() => {
              try { return JSON.parse(r.paymentSettings); } catch { return r.paymentSettings; }
            })()
          : r.paymentSettings,
    }));
    return NextResponse.json({ branches: rows });
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
    if (settings.maxOrderDistanceKm !== undefined) {
      updates.push(`max_order_distance_km = $${idx++}`);
      values.push(settings.maxOrderDistanceKm);
    }
    if (settings.tableQrMaxDistanceMeters !== undefined) {
      updates.push(`table_qr_max_distance_meters = $${idx++}`);
      values.push(settings.tableQrMaxDistanceMeters);
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
