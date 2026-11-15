import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '@/lib/redis';
import { INITIAL_MENU, INITIAL_CATEGORIES } from '@/database/embeddedSeed';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { requireAuth, writeAuditLog } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    let payload = await cacheGet<{ menuItems: any[]; categories: string[]; etag: string }>('menu:all');

    if (!payload) {
      const [itemsRes, catsRes] = await Promise.all([
        query(
          `SELECT id, name, category, description,
                  base_price as "basePrice",
                  image,
                  is_available as "isAvailable",
                  branch_availability as "branchAvailability",
                  branch_price_overrides as "branchPriceOverrides",
                  sizes, extras
           FROM menu_items
           ORDER BY category ASC, name ASC`
        ),
        query(`SELECT name FROM categories ORDER BY display_order ASC`),
      ]);

      const menuItems = (itemsRes?.rows || []).map((row: any) => ({
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

      const categories =
        catsRes?.rows && catsRes.rows.length > 0
          ? catsRes.rows.map((r: any) => r.name)
          : INITIAL_CATEGORIES;

      const finalItems = menuItems.length > 0 ? menuItems : INITIAL_MENU;
      const etag = `"menu-${crypto
        .createHash('sha1')
        .update(JSON.stringify({ items: finalItems, categories }))
        .digest('hex')
        .slice(0, 16)}"`;

      payload = { menuItems: finalItems, categories, etag };
      await cacheSet('menu:all', payload, 60);
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
        menuItems: payload.menuItems,
        categories: payload.categories,
      },
      {
        headers: {
          ETag: payload.etag,
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=45',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({
      menuItems: INITIAL_MENU,
      categories: INITIAL_CATEGORIES,
      fallback: true,
      error: error?.message,
    });
  }
}

export async function PATCH(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager', 'cashier']);
    if (errorResponse) return errorResponse;

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

    await Promise.all([
      cacheInvalidatePrefix('menu:'),
      cacheInvalidatePrefix('catalog:'),
      cacheInvalidatePrefix('sync:payload:'),
    ]);

    try {
      broadcastRealtimeEvent({ type: 'MENU_UPDATED' });
    } catch {}

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
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager', 'cashier']);
    if (errorResponse) return errorResponse;

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
    await Promise.all([
      cacheInvalidatePrefix('menu:'),
      cacheInvalidatePrefix('catalog:'),
      cacheInvalidatePrefix('sync:payload:'),
    ]);

    try {
      broadcastRealtimeEvent({ type: 'MENU_UPDATED' });
    } catch {}
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
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager', 'cashier']);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('id') || searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json({ error: 'itemId or id is required' }, { status: 400 });
    }

    await query(`DELETE FROM menu_items WHERE id = $1`, [itemId]);
    await Promise.all([
      cacheInvalidatePrefix('menu:'),
      cacheInvalidatePrefix('catalog:'),
      cacheInvalidatePrefix('sync:payload:'),
    ]);

    try {
      broadcastRealtimeEvent({ type: 'MENU_UPDATED' });
    } catch {}
    return NextResponse.json({ success: true, deletedId: itemId });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete menu item from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export const PUT = PATCH;
