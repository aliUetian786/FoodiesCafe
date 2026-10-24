import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    const customerPhone = searchParams.get('customerPhone');
    const customerId = searchParams.get('customerId');

    let sql = `
      SELECT id, ticket_number as "ticketNumber", customer_id as "customerId",
             customer_name as "customerName", customer_phone as "customerPhone",
             branch_id as "branchId", order_id as "orderId", order_number as "orderNumber",
             subject, status, assigned_to as "assignedTo", messages,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM complaints
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (branchId) {
      params.push(branchId);
      conditions.push(`branch_id = $${params.length}`);
    }
    if (customerPhone) {
      params.push(customerPhone);
      conditions.push(`customer_phone = $${params.length}`);
    }
    if (customerId) {
      params.push(customerId);
      conditions.push(`customer_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += ` ORDER BY updated_at DESC, created_at DESC LIMIT 100`;

    const res = await query(sql, params);
    const complaints = res.rows.map((row: any) => ({
      ...row,
      messages: Array.isArray(row.messages)
        ? row.messages
        : typeof row.messages === 'string'
        ? JSON.parse(row.messages || '[]')
        : [],
    }));

    return NextResponse.json({ complaints });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch complaints from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id = `cmp-${Date.now()}`,
      ticketNumber = `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId = 'user-guest',
      customerName = 'Guest Customer',
      customerPhone = '+923000000000',
      branchId = 'gulberg-lahore',
      orderId = null,
      orderNumber = null,
      subject = 'General Support Inquiry',
      status = 'new',
      assignedTo = 'Branch Support Desk',
      messages = [],
    } = body;

    const messagesJson = JSON.stringify(messages);

    const insertSql = `
      INSERT INTO complaints (
        id, ticket_number, customer_id, customer_name, customer_phone,
        branch_id, order_id, order_number, subject, status, assigned_to,
        messages, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        subject = EXCLUDED.subject,
        status = EXCLUDED.status,
        assigned_to = EXCLUDED.assigned_to,
        messages = EXCLUDED.messages,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, ticket_number as "ticketNumber", status
    `;

    const res = await query(insertSql, [
      id,
      ticketNumber,
      customerId,
      customerName,
      customerPhone,
      branchId,
      orderId,
      orderNumber,
      subject,
      status,
      assignedTo,
      messagesJson,
    ]);

    return NextResponse.json({ success: true, complaint: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to save complaint to PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, complaintId, status, assignedTo, message, messages } = body;
    const targetId = id || complaintId;

    if (!targetId) {
      return NextResponse.json({ error: 'Complaint ID is required' }, { status: 400 });
    }

    // If whole messages array provided, update directly
    if (messages && Array.isArray(messages)) {
      const sql = `
        UPDATE complaints
        SET messages = $1::jsonb,
            status = COALESCE($2, status),
            assigned_to = COALESCE($3, assigned_to),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, ticket_number as "ticketNumber", status, messages
      `;
      const res = await query(sql, [JSON.stringify(messages), status || null, assignedTo || null, targetId]);
      return NextResponse.json({ success: true, complaint: res.rows[0] });
    }

    // If single new message provided, append to existing messages
    if (message) {
      const getSql = `SELECT messages FROM complaints WHERE id = $1`;
      const existing = await query(getSql, [targetId]);
      let currentMessages: any[] = [];
      if (existing.rows.length > 0) {
        currentMessages = Array.isArray(existing.rows[0].messages)
          ? existing.rows[0].messages
          : JSON.parse(existing.rows[0].messages || '[]');
      }
      currentMessages.push(message);

      const updateSql = `
        UPDATE complaints
        SET messages = $1::jsonb,
            status = COALESCE($2, status),
            assigned_to = COALESCE($3, assigned_to),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id, ticket_number as "ticketNumber", status, messages
      `;
      const res = await query(updateSql, [JSON.stringify(currentMessages), status || null, assignedTo || null, targetId]);
      return NextResponse.json({ success: true, complaint: res.rows[0] });
    }

    // Just status / assignedTo update
    const updateSql = `
      UPDATE complaints
      SET status = COALESCE($1, status),
          assigned_to = COALESCE($2, assigned_to),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, ticket_number as "ticketNumber", status
    `;
    const res = await query(updateSql, [status || null, assignedTo || null, targetId]);
    return NextResponse.json({ success: true, complaint: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update complaint in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
