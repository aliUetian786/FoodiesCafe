import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { hashPassword, writeAuditLog, requireAuth, normalizeBranchId } from '@/lib/auth';
import { cacheInvalidatePrefix } from '@/lib/redis';

export async function GET(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager', 'cashier']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const roleFilter = searchParams.get('role');
    const cursor = searchParams.get('cursor');
    const rawLimit = parseInt(searchParams.get('limit') || '150', 10);
    const pageLimit = Math.min(Math.max(1, isNaN(rawLimit) ? 150 : rawLimit), 250);

    let sql = `
      SELECT id, name, phone, email, address, role, branch_id as "branchId", status,
             no_show_count as "noShowCount",
             rider_availability as "riderAvailability",
             rider_total_deliveries as "riderTotalDeliveries",
             rider_active_order_id as "riderActiveOrderId",
             assigned_floor as "assignedFloor",
             assigned_table_numbers as "assignedTableNumbers",
             created_at as "createdAt"
      FROM users
    `;
    const params: any[] = [];
    const where: string[] = [];

    // Branch manager & cashier can only see staff assigned to their own branch
    if (auth.role === 'branch_manager' || auth.role === 'cashier') {
      const assignedBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      params.push(assignedBranch);
      where.push(`branch_id = $${params.length}`);
    } else if (branchId && branchId !== 'all') {
      params.push(normalizeBranchId(branchId));
      where.push(`branch_id = $${params.length}`);
    }
    if (roleFilter && roleFilter !== 'all') {
      params.push(roleFilter);
      where.push(`role = $${params.length}`);
    }
    if (cursor) {
      params.push(cursor);
      where.push(`id > $${params.length}`);
    }

    if (where.length > 0) {
      sql += ` WHERE ` + where.join(' AND ');
    }

    sql += ` ORDER BY id ASC LIMIT ${pageLimit + 1}`;

    const res = await query(sql, params);
    const hasMore = res.rows.length > pageLimit;
    const slicedRows = hasMore ? res.rows.slice(0, pageLimit) : res.rows;
    const users = slicedRows.map((u: any) => ({
      ...u,
      assignedTableNumbers:
        typeof u.assignedTableNumbers === 'string'
          ? JSON.parse(u.assignedTableNumbers)
          : u.assignedTableNumbers || [],
    }));
    const nextCursor = hasMore && users.length > 0 ? users[users.length - 1]?.id || null : null;

    return NextResponse.json({ users, nextCursor, hasMore });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch users from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager']);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const {
      id = `usr-${Date.now()}`,
      name,
      phone,
      email,
      address = '',
      role = 'customer',
      branchId,
      status = 'active',
      password = '123',
    } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    if (auth.role === 'branch_manager') {
      if (role === 'platform_owner' || role === 'branch_manager') {
        return NextResponse.json(
          { error: 'Branch managers are not authorized to create owner or manager roles.' },
          { status: 403 }
        );
      }
    }

    const validBranches = ['gulberg-lahore', 'f7-islamabad', 'clifton-karachi'];
    const cleanBranchId =
      auth.role === 'branch_manager'
        ? (auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore')
        : branchId && validBranches.includes(branchId)
        ? branchId
        : null;
    const passwordHash = hashPassword(String(password));

    const sql = `
      INSERT INTO users (
        id, name, phone, email, address, role, branch_id, status, password_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        address = EXCLUDED.address,
        role = EXCLUDED.role,
        branch_id = EXCLUDED.branch_id,
        status = EXCLUDED.status,
        password_hash = EXCLUDED.password_hash
      RETURNING id, name, phone, email, address, role, branch_id as "branchId", status,
                rider_availability as "riderAvailability",
                rider_total_deliveries as "riderTotalDeliveries",
                rider_active_order_id as "riderActiveOrderId"
    `;

    const res = await query(sql, [
      id,
      name,
      phone,
      email,
      address,
      role,
      cleanBranchId,
      status,
      passwordHash,
    ]);

    if (role !== 'customer') {
      await writeAuditLog({
        actorId: auth.userId,
        actorName: auth.userName || auth.role,
        actorRole: auth.role,
        branchId: cleanBranchId,
        action: 'staff_created',
        details: `Created staff account for ${name} (${email}) with role ${role}.`,
        newValue: role,
      });
    }

    try {
      await cacheInvalidatePrefix('sync:payload');
      broadcastRealtimeEvent({ type: 'USER_UPDATED', branchId: cleanBranchId || undefined, data: res.rows[0] });
    } catch {}

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
    const { auth, errorResponse } = requireAuth(request, [
      'platform_owner',
      'branch_manager',
      'delivery_staff',
      'customer',
    ]);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const {
      id,
      userId,
      name,
      phone,
      email,
      address,
      role,
      branchId,
      status,
      password,
      riderAvailability,
      riderTotalDeliveries,
      riderActiveOrderId,
      assignedFloor,
      assignedTableNumbers,
    } = body;

    const targetId = id || userId;
    if (!targetId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (targetId === 'user-owner' && status && status !== 'active') {
      return NextResponse.json({ error: 'Platform Owner cannot be suspended or deactivated' }, { status: 403 });
    }

    // Role and branch check for branch manager and delivery staff
    const existingRes = await query('SELECT id, role, branch_id FROM users WHERE id = $1', [targetId]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const targetUser = existingRes.rows[0];

    // Rider permission check: delivery_staff can only update their own record and delivery-related availability/profile
    if (auth.role === 'delivery_staff') {
      if (targetId !== auth.userId && targetId !== 'user-rider-1' && !targetId.includes('rider')) {
        return NextResponse.json({ error: 'Riders can only update their own duty availability and profile' }, { status: 403 });
      }
      if (role !== undefined || status !== undefined || branchId !== undefined) {
        return NextResponse.json({ error: 'Riders cannot modify account role, status, or branch assignment' }, { status: 403 });
      }
    }

    // Customer permission check: customers can only update their own profile fields (name, phone, email, address)
    if (auth.role === 'customer') {
      if (targetId !== auth.userId && targetId !== 'user-cust' && !targetId.startsWith('cust-') && !targetId.startsWith('user-')) {
        return NextResponse.json({ error: 'Customers can only update their own profile' }, { status: 403 });
      }
      if (role !== undefined || status !== undefined || branchId !== undefined) {
        return NextResponse.json({ error: 'Customers cannot modify account role, status, or branch assignment' }, { status: 403 });
      }
    }

    if (auth.role === 'branch_manager') {
      const assignedBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      if (normalizeBranchId(targetUser.branch_id) !== assignedBranch) {
        return NextResponse.json(
          { error: 'Branch managers can only manage staff belonging to their assigned branch.' },
          { status: 403 }
        );
      }
      if (targetUser.role === 'platform_owner' || targetUser.role === 'branch_manager') {
        return NextResponse.json(
          { error: 'Branch managers cannot modify owner or manager accounts.' },
          { status: 403 }
        );
      }
      if (role === 'platform_owner' || role === 'branch_manager') {
        return NextResponse.json(
          { error: 'Branch managers cannot elevate roles to owner or manager.' },
          { status: 403 }
        );
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

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
    if (address !== undefined) {
      updates.push(`address = $${idx++}`);
      values.push(address);
    }
    const validBranches = ['gulberg-lahore', 'f7-islamabad', 'clifton-karachi'];

    if (role !== undefined) {
      updates.push(`role = $${idx++}`);
      values.push(role);
    }
    if (branchId !== undefined) {
      const cleanBranchId = branchId && validBranches.includes(branchId) ? branchId : null;
      updates.push(`branch_id = $${idx++}`);
      values.push(cleanBranchId);
    }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
    }
    if (password !== undefined) {
      updates.push(`password_hash = $${idx++}`);
      values.push(hashPassword(String(password)));
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
    if (assignedFloor !== undefined) {
      updates.push(`assigned_floor = $${idx++}`);
      values.push(assignedFloor);
    }
    if (assignedTableNumbers !== undefined) {
      updates.push(`assigned_table_numbers = $${idx++}`);
      values.push(Array.isArray(assignedTableNumbers) ? JSON.stringify(assignedTableNumbers) : assignedTableNumbers);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields provided to update' }, { status: 400 });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(targetId);

    const updateSql = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING id, name, phone, email, address, role, branch_id as "branchId", status,
                rider_availability as "riderAvailability",
                rider_total_deliveries as "riderTotalDeliveries",
                rider_active_order_id as "riderActiveOrderId",
                assigned_floor as "assignedFloor",
                assigned_table_numbers as "assignedTableNumbers"
    `;

    const res = await query(updateSql, values);
    if (res.rowCount === 0) {
      const cleanBranchId = branchId && validBranches.includes(branchId) ? branchId : null;
      const insertSql = `
        INSERT INTO users (
          id, name, phone, email, address, role, branch_id, status, password_hash, assigned_floor, assigned_table_numbers
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, users.name),
          phone = COALESCE(EXCLUDED.phone, users.phone),
          email = COALESCE(EXCLUDED.email, users.email),
          role = COALESCE(EXCLUDED.role, users.role),
          branch_id = COALESCE(EXCLUDED.branch_id, users.branch_id),
          status = EXCLUDED.status,
          assigned_floor = COALESCE(EXCLUDED.assigned_floor, users.assigned_floor),
          assigned_table_numbers = COALESCE(EXCLUDED.assigned_table_numbers, users.assigned_table_numbers),
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, phone, email, address, role, branch_id as "branchId", status,
                  rider_availability as "riderAvailability",
                  rider_total_deliveries as "riderTotalDeliveries",
                  rider_active_order_id as "riderActiveOrderId",
                  assigned_floor as "assignedFloor",
                  assigned_table_numbers as "assignedTableNumbers"
      `;
      const insRes = await query(insertSql, [
        targetId,
        name || 'Staff Member',
        phone || '',
        email || `${targetId}@foodiescafe.pk`,
        address || '',
        role || 'floor_staff',
        cleanBranchId,
        status || 'active',
        hashPassword(String(password || '123')),
        assignedFloor || null,
        assignedTableNumbers ? JSON.stringify(assignedTableNumbers) : null,
      ]);
      const userObj = insRes.rows[0];
      if (userObj && typeof userObj.assignedTableNumbers === 'string') {
        try { userObj.assignedTableNumbers = JSON.parse(userObj.assignedTableNumbers); } catch {}
      }
      try {
        await cacheInvalidatePrefix('sync:payload');
        broadcastRealtimeEvent({ type: 'USER_UPDATED', branchId: userObj?.branchId, data: userObj });
      } catch {}
      return NextResponse.json({ success: true, user: userObj });
    }

    const updatedUser = res.rows[0];
    if (updatedUser && typeof updatedUser.assignedTableNumbers === 'string') {
      try { updatedUser.assignedTableNumbers = JSON.parse(updatedUser.assignedTableNumbers); } catch {}
    }

    if (role !== undefined || status !== undefined) {
      await writeAuditLog({
        actorId: auth.userId,
        actorName: auth.userName || auth.role,
        actorRole: auth.role,
        branchId: updatedUser?.branchId || branchId || null,
        action: role !== undefined ? 'role_change' : 'staff_status_change',
        details: `Updated user ${updatedUser?.name || targetId}: role=${updatedUser?.role}, status=${updatedUser?.status}`,
        newValue: JSON.stringify({ role: updatedUser?.role, status: updatedUser?.status }),
      });
    }

    try {
      await cacheInvalidatePrefix('sync:payload');
      broadcastRealtimeEvent({ type: 'USER_UPDATED', branchId: updatedUser?.branchId, data: updatedUser });
    } catch {}
    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update user in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (id === 'user-owner') {
      return NextResponse.json({ error: 'Cannot delete primary platform owner account' }, { status: 403 });
    }

    const existingRes = await query('SELECT id, role, branch_id FROM users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const targetUser = existingRes.rows[0];

    if (auth.role === 'branch_manager') {
      const assignedBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      if (normalizeBranchId(targetUser.branch_id) !== assignedBranch) {
        return NextResponse.json(
          { error: 'Branch managers can only delete staff in their assigned branch.' },
          { status: 403 }
        );
      }
      if (targetUser.role === 'platform_owner' || targetUser.role === 'branch_manager') {
        return NextResponse.json(
          { error: 'Branch managers cannot delete owner or manager accounts.' },
          { status: 403 }
        );
      }
    }

    await query('DELETE FROM users WHERE id = $1', [id]);
    await writeAuditLog({
      actorId: auth.userId,
      actorName: auth.userName || auth.role,
      actorRole: auth.role,
      branchId: targetUser.branch_id,
      action: 'staff_deleted',
      details: `Deleted user account ${id} (${targetUser.role}).`,
    });

    try {
      await cacheInvalidatePrefix('sync:payload');
      broadcastRealtimeEvent({ type: 'USER_UPDATED', data: { id, deleted: true } });
    } catch {}
    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete user from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export const PUT = PATCH;
