import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '@/lib/redis';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { requireAuth, writeAuditLog } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    let payload = await cacheGet<{ branches: any[]; etag: string }>('branches:all');

    if (!payload) {
      let res;
      try {
        res = await query(
          `SELECT id, name, city, address, phone, opening_hours as "openingHours",
                  is_open as "isOpen", is_busy as "isBusy",
                  prep_time_estimate_min as "prepTimeEstimateMin",
                  full_edit_window_min as "fullEditWindowMin",
                  stop_add_ons_min_before_ready as "stopAddOnsMinBeforeReady",
                  delivery_enabled as "deliveryEnabled",
                  COALESCE(latitude, CASE WHEN id = 'gulberg-lahore' THEN 31.5126 WHEN id = 'f7-islamabad' THEN 33.7215 WHEN id = 'clifton-karachi' THEN 24.8252 ELSE 31.5126 END) as "latitude",
                  COALESCE(longitude, CASE WHEN id = 'gulberg-lahore' THEN 74.3436 WHEN id = 'f7-islamabad' THEN 73.0552 WHEN id = 'clifton-karachi' THEN 67.0305 ELSE 74.3436 END) as "longitude",
                  COALESCE(max_order_distance_km, 50) as "maxOrderDistanceKm",
                  COALESCE(table_qr_max_distance_meters, 300) as "tableQrMaxDistanceMeters",
                  COALESCE(min_delivery_amount, 500) as "minDeliveryAmount",
                  payment_settings as "paymentSettings"
           FROM branches
           ORDER BY city ASC, name ASC`
        );
      } catch (err: any) {
        if (err?.message?.includes('min_delivery_amount')) {
          await query(`ALTER TABLE branches ADD COLUMN IF NOT EXISTS min_delivery_amount INT NOT NULL DEFAULT 500`).catch(() => {});
          res = await query(
            `SELECT id, name, city, address, phone, opening_hours as "openingHours",
                    is_open as "isOpen", is_busy as "isBusy",
                    prep_time_estimate_min as "prepTimeEstimateMin",
                    full_edit_window_min as "fullEditWindowMin",
                    stop_add_ons_min_before_ready as "stopAddOnsMinBeforeReady",
                    delivery_enabled as "deliveryEnabled",
                    COALESCE(latitude, CASE WHEN id = 'gulberg-lahore' THEN 31.5126 WHEN id = 'f7-islamabad' THEN 33.7215 WHEN id = 'clifton-karachi' THEN 24.8252 ELSE 31.5126 END) as "latitude",
                    COALESCE(longitude, CASE WHEN id = 'gulberg-lahore' THEN 74.3436 WHEN id = 'f7-islamabad' THEN 73.0552 WHEN id = 'clifton-karachi' THEN 67.0305 ELSE 74.3436 END) as "longitude",
                    COALESCE(max_order_distance_km, 50) as "maxOrderDistanceKm",
                    COALESCE(table_qr_max_distance_meters, 300) as "tableQrMaxDistanceMeters",
                    500 as "minDeliveryAmount",
                    payment_settings as "paymentSettings"
             FROM branches
             ORDER BY city ASC, name ASC`
          );
        } else {
          throw err;
        }
      }
      const rows = res.rows.map((r: any) => ({
        ...r,
        latitude: Number(r.latitude) || (r.city === 'Islamabad' ? 33.7215 : r.city === 'Karachi' ? 24.8252 : 31.5126),
        longitude: Number(r.longitude) || (r.city === 'Islamabad' ? 73.0552 : r.city === 'Karachi' ? 67.0305 : 74.3436),
        minDeliveryAmount: Number(r.minDeliveryAmount) || 500,
        minDeliveryOrderValue: Number(r.minDeliveryAmount) || 500,
        paymentSettings:
          typeof r.paymentSettings === 'string'
            ? (() => {
                try { return JSON.parse(r.paymentSettings); } catch { return r.paymentSettings; }
              })()
            : r.paymentSettings,
      }));
      const etag = `"branches-${crypto
        .createHash('sha1')
        .update(JSON.stringify(rows))
        .digest('hex')
        .slice(0, 16)}"`;
      payload = { branches: rows, etag };
      await cacheSet('branches:all', payload, 20);
    }

    if (request.headers.get('if-none-match') === payload.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: payload.etag,
          'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
        },
      });
    }

    return NextResponse.json(
      { branches: payload.branches },
      {
        headers: {
          ETag: payload.etag,
          'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch branches from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

function normalizeBranchId(id?: string): string {
  if (!id) return 'gulberg-lahore';
  if (id === 'all') return 'all';
  if (id === 'branch-gulberg' || id.includes('gulberg')) return 'gulberg-lahore';
  if (id === 'branch-f7' || id.includes('f7') || id.includes('islamabad')) return 'f7-islamabad';
  if (id === 'branch-clifton' || id.includes('clifton') || id.includes('karachi')) return 'clifton-karachi';
  return id;
}

export async function PATCH(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager']);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const rawBranchId = body.branchId || body.id;
    const settings = body.settings || body;

    if (!rawBranchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }
    const normBranchId = normalizeBranchId(rawBranchId);

    if (auth.role === 'branch_manager') {
      const assignedBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      if (normBranchId !== assignedBranch) {
        return NextResponse.json(
          { error: `Cross-branch modification denied: staff cannot modify branch '${normBranchId}'.` },
          { status: 403 }
        );
      }
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
      values.push(Number(settings.latitude));
    }
    if (settings.longitude !== undefined) {
      updates.push(`longitude = $${idx++}`);
      values.push(Number(settings.longitude));
    }
    if (settings.isOpen !== undefined || settings.is_open !== undefined) {
      updates.push(`is_open = $${idx++}`);
      values.push(Boolean(settings.isOpen ?? settings.is_open));
    }
    if (settings.isBusy !== undefined || settings.is_busy !== undefined) {
      updates.push(`is_busy = $${idx++}`);
      values.push(Boolean(settings.isBusy ?? settings.is_busy));
    }
    if (settings.prepTimeEstimateMin !== undefined || settings.prep_time_estimate_min !== undefined) {
      updates.push(`prep_time_estimate_min = $${idx++}`);
      values.push(Number(settings.prepTimeEstimateMin ?? settings.prep_time_estimate_min));
    }
    if (settings.fullEditWindowMin !== undefined || settings.full_edit_window_min !== undefined) {
      updates.push(`full_edit_window_min = $${idx++}`);
      values.push(Number(settings.fullEditWindowMin ?? settings.full_edit_window_min));
    }
    if (settings.stopAddOnsMinBeforeReady !== undefined || settings.stop_add_ons_min_before_ready !== undefined) {
      updates.push(`stop_add_ons_min_before_ready = $${idx++}`);
      values.push(Number(settings.stopAddOnsMinBeforeReady ?? settings.stop_add_ons_min_before_ready));
    }
    const maxOrderDist = settings.maxOrderDistanceKm ?? settings.max_order_distance_km;
    if (maxOrderDist !== undefined) {
      updates.push(`max_order_distance_km = $${idx++}`);
      values.push(Number(maxOrderDist) || 50);
    }
    const tableQrRadius = settings.tableQrMaxDistanceMeters ?? settings.table_qr_max_distance_meters;
    if (tableQrRadius !== undefined) {
      updates.push(`table_qr_max_distance_meters = $${idx++}`);
      values.push(Number(tableQrRadius) || 300);
    }
    const minDeliveryAmt = settings.minDeliveryAmount ?? settings.min_delivery_amount ?? settings.minDeliveryOrderValue ?? settings.min_delivery_order_value;
    if (minDeliveryAmt !== undefined) {
      updates.push(`min_delivery_amount = $${idx++}`);
      values.push(Number(minDeliveryAmt) || 500);
    }
    if (settings.paymentSettings !== undefined || settings.payment_settings !== undefined) {
      updates.push(`payment_settings = $${idx++}`);
      values.push(JSON.stringify(settings.paymentSettings ?? settings.payment_settings));
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'No valid updates provided' });
    }

    values.push(normBranchId, rawBranchId);
    const sql = `UPDATE branches SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} OR id = $${idx + 1} RETURNING *`;
    const res = await query(sql, values);

    await Promise.all([
      cacheInvalidatePrefix('branches:'),
      cacheInvalidatePrefix('catalog:'),
      cacheInvalidatePrefix('sync:payload:'),
    ]);

    const r = res.rows[0];
    const formattedBranch = r ? {
      ...r,
      openingHours: r.opening_hours || r.openingHours,
      isOpen: r.is_open ?? r.isOpen,
      isBusy: r.is_busy ?? r.isBusy,
      prepTimeEstimateMin: Number(r.prep_time_estimate_min ?? r.prepTimeEstimateMin) || 20,
      fullEditWindowMin: Number(r.full_edit_window_min ?? r.fullEditWindowMin) || 15,
      stopAddOnsMinBeforeReady: Number(r.stop_add_ons_min_before_ready ?? r.stopAddOnsMinBeforeReady) || 10,
      deliveryEnabled: r.delivery_enabled ?? r.deliveryEnabled,
      latitude: Number(r.latitude) || 31.5126,
      longitude: Number(r.longitude) || 74.3436,
      maxOrderDistanceKm: Number(r.max_order_distance_km ?? r.maxOrderDistanceKm) || 50,
      tableQrMaxDistanceMeters: Number(r.table_qr_max_distance_meters ?? r.tableQrMaxDistanceMeters) || 300,
      minDeliveryAmount: Number(r.min_delivery_amount ?? r.minDeliveryAmount) || 500,
      minDeliveryOrderValue: Number(r.min_delivery_amount ?? r.minDeliveryAmount) || 500,
      paymentSettings:
        typeof r.payment_settings === 'string'
          ? (() => {
              try { return JSON.parse(r.payment_settings); } catch { return r.payment_settings; }
            })()
          : (r.payment_settings || r.paymentSettings),
    } : null;

    try {
      broadcastRealtimeEvent({
        type: 'BRANCH_UPDATED',
        branchId: normBranchId,
        data: {
          branchId: normBranchId,
          branch: formattedBranch,
          paymentSettings: formattedBranch?.paymentSettings,
          isOpen: formattedBranch?.isOpen,
          isBusy: formattedBranch?.isBusy,
          deliveryEnabled: formattedBranch?.deliveryEnabled,
          ...settings,
        },
      });
    } catch {}

    return NextResponse.json({ success: true, branch: formattedBranch });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update branch in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner']);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const id = body.id || `branch-${Date.now()}`;
    const name = body.name || 'New Branch';
    const city = body.city || 'Lahore';
    const address = body.address || '';
    const phone = body.phone || '+92 300 0000000';
    const openingHours = body.openingHours || '11:00 AM - 1:00 AM';
    const isOpen = body.isOpen !== false;
    const isBusy = !!body.isBusy;
    const prepTime = Number(body.prepTimeEstimateMin) || 20;
    const fullEdit = Number(body.fullEditWindowMin) || 5;
    const stopAddons = Number(body.stopAddOnsMinBeforeReady) || 5;
    const deliveryEnabled = body.deliveryEnabled !== false;
    const lat = Number(body.latitude) || 31.5204;
    const lng = Number(body.longitude) || 74.3587;
    const maxDist = Number(body.maxOrderDistanceKm) || 50;
    const qrDist = Number(body.tableQrMaxDistanceMeters) || 300;
    const payment = body.paymentSettings ? JSON.stringify(body.paymentSettings) : null;

    const sql = `
      INSERT INTO branches (
        id, name, city, address, phone, opening_hours, is_open, is_busy,
        prep_time_estimate_min, full_edit_window_min, stop_add_ons_min_before_ready,
        delivery_enabled, latitude, longitude, max_order_distance_km, table_qr_max_distance_meters,
        payment_settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        city = EXCLUDED.city,
        address = EXCLUDED.address,
        phone = EXCLUDED.phone
      RETURNING *
    `;

    const res = await query(sql, [
      id, name, city, address, phone, openingHours, isOpen, isBusy,
      prepTime, fullEdit, stopAddons, deliveryEnabled, lat, lng,
      maxDist, qrDist, payment,
    ]);

    await Promise.all([
      cacheInvalidatePrefix('branches:'),
      cacheInvalidatePrefix('catalog:'),
      cacheInvalidatePrefix('sync:payload:'),
    ]);

    try {
      broadcastRealtimeEvent({ type: 'BRANCH_UPDATED', branchId: res.rows[0]?.id, data: res.rows[0] });
    } catch {}

    return NextResponse.json({ success: true, branch: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create branch in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export const PUT = PATCH;
