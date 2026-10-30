import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const branchId = searchParams.get('branchId');
    const actorRole = searchParams.get('actorRole');
    const dateScope = searchParams.get('dateScope');

    // Auto-create table if missing
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actor_id VARCHAR(64) NOT NULL,
          actor_name VARCHAR(255) NOT NULL,
          actor_role VARCHAR(50) NOT NULL,
          branch_id VARCHAR(64),
          action VARCHAR(50) NOT NULL,
          details TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
      `);
    } catch (e) {}

    // Check count and seed initial manager activity actions if table is empty
    try {
      const countRes = await query('SELECT count(*) FROM audit_logs');
      if (Number(countRes.rows[0]?.count || 0) === 0) {
        await query(`
          INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, branch_id, action, details)
          VALUES
          (
            'aud-init-2',
            CURRENT_TIMESTAMP - INTERVAL '1 hour 15 minutes',
            'user-bm',
            'Rashid Mehmood',
            'branch_manager',
            'gulberg-lahore',
            'account_created',
            'Branch Manager provisioned new Cashier login account for Bilal Farooq (stf-4921) with 4-digit PIN.'
          ),
          (
            'aud-init-3',
            CURRENT_TIMESTAMP - INTERVAL '2 hours 40 minutes',
            'user-bm',
            'Rashid Mehmood',
            'branch_manager',
            'gulberg-lahore',
            'price_change',
            'Branch Manager adjusted branch price override on Royal Chicken Dum Biryani to Rs. 650.'
          ),
          (
            'aud-init-4',
            CURRENT_TIMESTAMP - INTERVAL '4 hours 10 minutes',
            'user-bm-2',
            'Asif Kamal',
            'branch_manager',
            'f7-islamabad',
            'busy_mode_toggled',
            'Branch Manager enabled Busy Mode for F-7 Markaz Branch due to peak evening dining hall rush.'
          ),
          (
            'aud-init-5',
            CURRENT_TIMESTAMP - INTERVAL '5 hours 20 minutes',
            'user-bm',
            'Rashid Mehmood',
            'branch_manager',
            'gulberg-lahore',
            'timing_settings',
            'Branch Manager updated preparation time estimate from 20 mins to 25 mins for weekend rush.'
          ),
          (
            'aud-init-6',
            CURRENT_TIMESTAMP - INTERVAL '18 hours',
            'user-bm-3',
            'Kamran Ali',
            'branch_manager',
            'clifton-karachi',
            'shift_verified',
            'Branch Manager verified end-of-shift till cash count (Rs. 28,900 counted vs Rs. 28,900 expected, Rs. 0 variance).'
          ),
          (
            'aud-init-7',
            CURRENT_TIMESTAMP - INTERVAL '22 hours',
            'user-bm',
            'Rashid Mehmood',
            'branch_manager',
            'gulberg-lahore',
            'account_suspended',
            'Branch Manager suspended Delivery Rider account (stf-8812) due to repeated customer late arrival notices.'
          )
          ON CONFLICT (id) DO NOTHING;
        `);
      }
    } catch (e) {}

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

    if (branchId && branchId !== 'all') {
      params.push(branchId);
      whereClauses.push(`branch_id = $${params.length}`);
    }

    if (actorRole && actorRole !== 'all') {
      params.push(actorRole);
      whereClauses.push(`actor_role = $${params.length}`);
    }

    if (dateScope === 'today') {
      whereClauses.push(`timestamp >= (NOW() - INTERVAL '24 hours')`);
    } else if (dateScope === 'yesterday') {
      whereClauses.push(`(timestamp >= (CURRENT_DATE - INTERVAL '1 day') AND timestamp < CURRENT_DATE)`);
    } else if (dateScope === 'week') {
      whereClauses.push(`timestamp >= (NOW() - INTERVAL '7 days')`);
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ` + whereClauses.join(' AND ');
    }

    sql += ` ORDER BY timestamp DESC LIMIT 200`;

    const res = await query(sql, params);
    return NextResponse.json({ logs: res.rows });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch audit logs from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, actorId, actorName, actorRole, branchId, action, details, oldValue, newValue } = body;

    if (!actorName || !action || !details) {
      return NextResponse.json(
        { error: 'actorName, action, and details are required' },
        { status: 400 }
      );
    }

    const logId = id || `aud-${Date.now()}`;

    const insertSql = `
      INSERT INTO audit_logs (id, timestamp, actor_id, actor_name, actor_role, branch_id, action, details, old_value, new_value)
      VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, timestamp, actor_id as "actorId", actor_name as "actorName",
                actor_role as "actorRole", branch_id as "branchId", action,
                details, old_value as "oldValue", new_value as "newValue"
    `;

    const res = await query(insertSql, [
      logId,
      actorId || 'system',
      actorName,
      actorRole || 'system',
      branchId || null,
      action,
      details,
      oldValue || null,
      newValue || null,
    ]);

    return NextResponse.json({ success: true, log: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to record audit log', details: error.message },
      { status: 500 }
    );
  }
}
