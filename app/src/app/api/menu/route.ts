import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const itemsRes = await query(
      `SELECT id, name, category, description,
              base_price as "basePrice",
              image,
              is_available as "isAvailable",
              branch_availability as "branchAvailability",
              branch_price_overrides as "branchPriceOverrides",
              sizes, extras
       FROM menu_items
       ORDER BY category ASC, name ASC`
    );

    const catsRes = await query(
      `SELECT name FROM categories ORDER BY display_order ASC`
    );

    const menuItems = itemsRes.rows.map((row: any) => ({
      ...row,
      basePrice: Number(row.basePrice) || 0,
      branchAvailability:
        typeof row.branchAvailability === 'string'
          ? JSON.parse(row.branchAvailability)
          : row.branchAvailability || {},
      branchPriceOverrides:
        typeof row.branchPriceOverrides === 'string'
          ? JSON.parse(row.branchPriceOverrides)
          : row.branchPriceOverrides || {},
      sizes:
        typeof row.sizes === 'string'
          ? JSON.parse(row.sizes)
          : row.sizes || [],
      extras:
        typeof row.extras === 'string'
          ? JSON.parse(row.extras)
          : row.extras || [],
    }));

    return NextResponse.json({
      menuItems,
      categories: catsRes.rows.map((r: any) => r.name),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch menu from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const itemId = body.itemId || body.id;

    if (!itemId) {
      return NextResponse.json({ error: 'itemId or id is required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (body.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(body.name);
    }
    if (body.category !== undefined) {
      updates.push(`category = $${idx++}`);
      values.push(body.category);
    }
    if (body.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(body.description);
    }
    if (body.basePrice !== undefined || body.base_price !== undefined) {
      updates.push(`base_price = $${idx++}`);
      values.push(Number(body.basePrice ?? body.base_price));
    }
    if (body.image !== undefined) {
      updates.push(`image = $${idx++}`);
      values.push(body.image);
    }
    if (body.isAvailable !== undefined || body.is_available !== undefined) {
      updates.push(`is_available = $${idx++}`);
      values.push(Boolean(body.isAvailable ?? body.is_available));
    }
    if (body.branchAvailability !== undefined || body.branch_availability !== undefined) {
      updates.push(`branch_availability = $${idx++}::jsonb`);
      values.push(JSON.stringify(body.branchAvailability ?? body.branch_availability));
    }
    if (body.branchPriceOverrides !== undefined || body.branch_price_overrides !== undefined) {
      updates.push(`branch_price_overrides = $${idx++}::jsonb`);
      values.push(JSON.stringify(body.branchPriceOverrides ?? body.branch_price_overrides));
    }
    if (body.sizes !== undefined) {
      updates.push(`sizes = $${idx++}::jsonb`);
      values.push(JSON.stringify(body.sizes));
    }
    if (body.extras !== undefined) {
      updates.push(`extras = $${idx++}::jsonb`);
      values.push(JSON.stringify(body.extras));
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: 'No updates provided' });
    }

    values.push(itemId);
    const sql = `UPDATE menu_items SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`;
    const res = await query(sql, values);

    return NextResponse.json({ success: true, item: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update menu item in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      id = `m-${Date.now()}`,
      name,
      category,
      description = '',
      basePrice = 0,
      image = '/food-biryani.jpg',
      isAvailable = true,
      branchAvailability = {},
      branchPriceOverrides = {},
      sizes = [],
      extras = [],
    } = body;

    if (!name || !category) {
      return NextResponse.json({ error: 'name and category are required' }, { status: 400 });
    }

    const sql = `
      INSERT INTO menu_items (
        id, name, category, description, base_price, image,
        is_available, branch_availability, branch_price_overrides,
        sizes, extras
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8::jsonb, $9::jsonb,
        $10::jsonb, $11::jsonb
      ) ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        base_price = EXCLUDED.base_price,
        image = EXCLUDED.image,
        is_available = EXCLUDED.is_available,
        branch_availability = EXCLUDED.branch_availability,
        branch_price_overrides = EXCLUDED.branch_price_overrides,
        sizes = EXCLUDED.sizes,
        extras = EXCLUDED.extras,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      id,
      name,
      category,
      description,
      Number(basePrice),
      image,
      Boolean(isAvailable),
      JSON.stringify(branchAvailability),
      JSON.stringify(branchPriceOverrides),
      JSON.stringify(sizes),
      JSON.stringify(extras),
    ];

    const res = await query(sql, values);
    return NextResponse.json({ success: true, item: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create menu item in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id') || searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json({ error: 'itemId or id is required' }, { status: 400 });
    }

    await query(`DELETE FROM menu_items WHERE id = $1`, [itemId]);
    return NextResponse.json({ success: true, deletedId: itemId });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete menu item from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
