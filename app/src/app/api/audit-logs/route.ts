import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth, normalizeBranchId } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const branchId = searchParams.get('branchId');
    const actorRole = searchParams.get('actorRole');
    const dateScope = searchParams.get('dateScope');

    let sql = `
      SELECT id, timestamp, actor_id as "actorId", actor_name as "actorName",
             actor_role as "actorRole", branch_id as "branchId", action,
             details, old_value as "oldValue", new_value as "newValue"
      FROM audit_logs
    `;
    const params: any[] = [];
    const whereClauses: string[] = [];

    if (action && action !== 'all') {
      params.push(action);
      whereClauses.push(`action = $${params.length}`);
    }

    if (auth.role === 'branch_manager') {
      const assignedBranch = auth.branchId ? normalizeBranchId(auth.branchId) : 'gulberg-lahore';
      params.push(assignedBranch);
      whereClauses.push(`branch_id = $${params.length}`);
    } else if (branchId && branchId !== 'all') {
      params.push(normalizeBranchId(branchId));
      whereClauses.push(`branch_id = $${params.length}`);
    }

    if (actorRole && actorRole !== 'all') {
      params.push(actorRole);
      whereClauses.push(`actor_role = $${params.length}`);
    }

    const cursor = searchParams.get('cursor');
    const rawLimit = parseInt(searchParams.get('limit') || '100', 10);
    const pageLimit = Math.min(Math.max(1, isNaN(rawLimit) ? 100 : rawLimit), 200);

    if (dateScope === 'today') {
      whereClauses.push(`timestamp >= (NOW() - INTERVAL '24 hours')`);
    } else if (dateScope === 'yesterday') {
      whereClauses.push(`(timestamp >= (CURRENT_DATE - INTERVAL '1 day') AND timestamp < CURRENT_DATE)`);
    } else if (dateScope === 'week') {
      whereClauses.push(`timestamp >= (NOW() - INTERVAL '7 days')`);
    }

    if (cursor) {
      params.push(cursor);
      whereClauses.push(`timestamp < $${params.length}`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY timestamp DESC LIMIT ${pageLimit + 1}`;

    const res = await query(sql, params);
    const hasMore = res.rows.length > pageLimit;
    const logs = hasMore ? res.rows.slice(0, pageLimit) : res.rows;
    const nextCursor = hasMore && logs.length > 0 ? logs[logs.length - 1]?.timestamp || null : null;
    return NextResponse.json({ logs, nextCursor, hasMore });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch audit logs from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Public insertion into audit_logs is disabled for security and tamper-evidence. Audit logs are written strictly server-side.',
    },
    { status: 405 }
  );
}
