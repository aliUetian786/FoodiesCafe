import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '@/lib/redis';
import { requireAuth, normalizeBranchId, writeAuditLog } from '@/lib/auth';
import { broadcastRealtimeEvent } from '@/lib/realtime';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId') || 'all';
    const cacheKey = `announcements:${branchId}`;

    let payload = await cacheGet<{ announcements: any[]; etag: string }>(cacheKey);

    if (!payload) {
      let sql = `
        SELECT id, title, tag, description,
               valid_until as "validUntil",
               branch_id as "branchId",
               branch_name as "branchName",
               discount_percent as "discountPercent",
               badge_color as "badgeColor",
               created_at as "createdAt"
        FROM announcements
      `;
      const params: any[] = [];

      if (branchId && branchId !== 'all') {
        sql += ` WHERE branch_id IS NULL OR branch_id = $1`;
        params.push(branchId);
      }

      sql += ` ORDER BY created_at DESC`;

      const res = await query(sql, params);
      const announcements = res.rows || [];
      const etag = `"ann-${crypto.createHash('sha1').update(JSON.stringify(announcements)).digest('hex').slice(0, 16)}"`;
      payload = { announcements, etag };
      await cacheSet(cacheKey, payload, 30);
    }

    if (request.headers.get('if-none-match') === payload.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: payload.etag,
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=45',
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        announcements: payload.announcements,
      },
      {
        headers: {
          ETag: payload.etag,
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=45',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch announcements from PostgreSQL', details: error.message },
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
      id,
      title,
      tag = 'ANNOUNCEMENT',
      description,
      validUntil = 'Valid this week',
      branchId = null,
      branchName = null,
      discountPercent = null,
      badgeColor = '#EF4444',
    } = body;

    const targetBranch =
      auth.role === 'branch_manager'
        ? (auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore')
        : branchId;

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const annId = id || `ann-${Date.now()}`;

    // A manager may only create/edit announcements for their own branch.
    if (auth.role === 'branch_manager' && id) {
      const existing = await query(`SELECT branch_id FROM announcements WHERE id = $1`, [id]);
      const existingBranch = existing.rows[0]?.branch_id ?? undefined;
      if (existing.rows.length > 0 && normalizeBranchId(existingBranch || '') !== targetBranch) {
        return NextResponse.json({ error: 'You can only edit announcements for your own branch' }, { status: 403 });
      }
    }

    const sql = `
      INSERT INTO announcements (id, title, tag, description, valid_until, branch_id, branch_name, discount_percent, badge_color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        tag = EXCLUDED.tag,
        description = EXCLUDED.description,
        valid_until = EXCLUDED.valid_until,
        branch_id = EXCLUDED.branch_id,
        branch_name = EXCLUDED.branch_name,
        discount_percent = EXCLUDED.discount_percent,
        badge_color = EXCLUDED.badge_color
      RETURNING id, title, tag, description,
                valid_until as "validUntil",
                branch_id as "branchId",
                branch_name as "branchName",
                discount_percent as "discountPercent",
                badge_color as "badgeColor",
                created_at as "createdAt"
    `;

    const res = await query(sql, [
      annId,
      title,
      tag.toUpperCase(),
      description,
      validUntil,
      targetBranch,
      branchName,
      discountPercent,
      badgeColor,
    ]);

    await Promise.all([
      cacheInvalidatePrefix('announcements:'),
      cacheInvalidatePrefix('catalog:'),
    ]);

    await writeAuditLog({
      actorId: auth.userId,
      actorName: auth.userName || auth.role,
      actorRole: auth.role,
      branchId: targetBranch,
      action: 'announcement_posted',
      details: `Announcement "${String(title).slice(0, 80)}" posted${targetBranch ? ` for ${targetBranch}` : ' for all branches'}`,
      newValue: String(description).slice(0, 500),
    });
    broadcastRealtimeEvent({ type: 'SYNC_TRIGGER', branchId: targetBranch || undefined, data: { scope: 'announcements' } });

    return NextResponse.json({
      success: true,
      announcement: res.rows[0],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to save announcement to PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {}
    }

    if (!id) {
      return NextResponse.json({ error: 'Announcement ID is required' }, { status: 400 });
    }

    const existing = await query(`SELECT title, branch_id FROM announcements WHERE id = $1`, [id]);
    const row = existing.rows[0];
    if (auth.role === 'branch_manager' && row) {
      const managerBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      if (!row.branch_id || normalizeBranchId(row.branch_id) !== managerBranch) {
        return NextResponse.json(
          { error: 'Only the owner can remove all-branch or other-branch announcements' },
          { status: 403 }
        );
      }
    }

    await query(`DELETE FROM announcements WHERE id = $1`, [id]);
    await Promise.all([
      cacheInvalidatePrefix('announcements:'),
      cacheInvalidatePrefix('catalog:'),
    ]);

    if (row) {
      await writeAuditLog({
        actorId: auth.userId,
        actorName: auth.userName || auth.role,
        actorRole: auth.role,
        branchId: row.branch_id || null,
        action: 'announcement_deleted',
        details: `Announcement "${String(row.title || id).slice(0, 80)}" removed`,
        oldValue: String(row.title || ''),
      });
    }
    broadcastRealtimeEvent({ type: 'SYNC_TRIGGER', branchId: row?.branch_id || undefined, data: { scope: 'announcements' } });

    return NextResponse.json({
      success: true,
      message: `Announcement ${id} deleted`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete announcement from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
