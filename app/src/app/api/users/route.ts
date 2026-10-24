import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');

    // Auto-migrate users columns if missing
    try {
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rider_availability VARCHAR(30) DEFAULT 'available'`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rider_total_deliveries INT DEFAULT 0`);
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rider_active_order_id VARCHAR(64)`);
    } catch (e) {}

    let sql = `
      SELECT id, name, phone, email, address, role,
             branch_id as "branchId", status, no_show_count as "noShowCount",
             password_hash as "password",
             rider_availability as "riderAvailability",
             rider_total_deliveries as "riderTotalDeliveries",
             rider_active_order_id as "riderActiveOrderId",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM users
    `;
    const params: any[] = [];

    if (branchId) {
      params.push(branchId);
      sql += ` WHERE branch_id = $1 OR branch_id IS NULL`;
    }

    sql += ` ORDER BY created_at ASC`;

    const res = await query(sql, params);
    const users = res.rows.map((u: any) => ({
      ...u,
      riderAvailability: u.role === 'delivery_staff' ? (u.riderAvailability || 'available') : u.riderAvailability,
      riderTotalDeliveries: u.riderTotalDeliveries ? Number(u.riderTotalDeliveries) : 0,
      riderActiveOrderId: u.riderActiveOrderId || undefined,
    }));
    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch users from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, phone, email, address, role, branchId, status, password, riderAvailability, riderTotalDeliveries, riderActiveOrderId } = body;

    if (!name || !phone || !role) {
      return NextResponse.json(
        { error: 'Name, phone, and role are required' },
        { status: 400 }
      );
    }

    const userId = id || `user-${Date.now()}`;
    const userStatus = status || 'active';
    const userPassword = password || 'password123';
    const defaultRiderAvail = role === 'delivery_staff' ? (riderAvailability || 'available') : null;

    const insertSql = `
      INSERT INTO users (id, name, phone, email, address, role, branch_id, status, password_hash, rider_availability, rider_total_deliveries, rider_active_order_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        role = EXCLUDED.role,
        branch_id = EXCLUDED.branch_id,
        status = EXCLUDED.status,
        password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
        rider_availability = COALESCE(EXCLUDED.rider_availability, users.rider_availability),
        rider_total_deliveries = COALESCE(EXCLUDED.rider_total_deliveries, users.rider_total_deliveries),
        rider_active_order_id = EXCLUDED.rider_active_order_id,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, name, phone, email, address, role, branch_id as "branchId", status, password_hash as "password",
                rider_availability as "riderAvailability", rider_total_deliveries as "riderTotalDeliveries", rider_active_order_id as "riderActiveOrderId"
    `;

    const res = await query(insertSql, [
      userId,
      name,
      phone,
      email || null,
      address || null,
      role,
      branchId || null,
      userStatus,
      userPassword,
      defaultRiderAvail,
      riderTotalDeliveries || 0,
      riderActiveOrderId || null,
    ]);

    return NextResponse.json({ success: true, user: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create user in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status, name, phone, email, role, branchId, address, password, riderAvailability, riderTotalDeliveries, riderActiveOrderId } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
    }
    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(name);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      values.push(phone);
    }
    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      values.push(email);
    }
    if (role !== undefined) {
      updates.push(`role = $${idx++}`);
      values.push(role);
    }
    if (branchId !== undefined) {
      updates.push(`branch_id = $${idx++}`);
      values.push(branchId);
    }
    if (address !== undefined) {
      updates.push(`address = $${idx++}`);
      values.push(address);
    }
    if (password !== undefined) {
      updates.push(`password_hash = $${idx++}`);
      values.push(password);
    }
    if (riderAvailability !== undefined) {
      updates.push(`rider_availability = $${idx++}`);
      values.push(riderAvailability);
    }
    if (riderTotalDeliveries !== undefined) {
      updates.push(`rider_total_deliveries = $${idx++}`);
      values.push(riderTotalDeliveries);
    }
    if (riderActiveOrderId !== undefined) {
      updates.push(`rider_active_order_id = $${idx++}`);
      values.push(riderActiveOrderId || null);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateSql = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING id, name, phone, email, address, role, branch_id as "branchId", status, password_hash as "password",
                rider_availability as "riderAvailability", rider_total_deliveries as "riderTotalDeliveries", rider_active_order_id as "riderActiveOrderId"
    `;

    const res = await query(updateSql, values);
    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'User not found in PostgreSQL' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update user in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await query('DELETE FROM users WHERE id = $1', [id]);
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete user from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
