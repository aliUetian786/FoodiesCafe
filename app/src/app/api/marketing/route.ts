import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // 1. Fetch hero banners
    const bannersRes = await query(
      `SELECT id, title, subtitle, badge, image_url as "imageUrl",
              category_link as "categoryLink", active, display_order as "displayOrder"
       FROM hero_banners
       ORDER BY display_order ASC`
    );

    // 2. Fetch deal card
    const dealsRes = await query(
      `SELECT id, title, subtitle, price, tag, image_url as "imageUrl",
              category_link as "categoryLink"
       FROM deal_cards
       LIMIT 1`
    );

    // 3. Fetch footer settings
    let footerData = null;
    try {
      const footerRes = await query(
        `SELECT helpline, email, hours,
                address_lahore as "addressLahore",
                address_islamabad as "addressIslamabad",
                address_karachi as "addressKarachi",
                tagline, copyright_text as "copyrightText",
                order_routing_support_first as "orderRoutingSupportFirst",
                auto_forward_kitchen_min as "autoForwardKitchenMin",
                auto_forward_mode as "autoForwardMode"
         FROM footer_settings
         LIMIT 1`
      );
      footerData = footerRes.rows[0] || null;
    } catch (e) {
      // Fallback query if columns not present yet in table
      const fallbackRes = await query(
        `SELECT helpline, email, hours,
                address_lahore as "addressLahore",
                address_islamabad as "addressIslamabad",
                address_karachi as "addressKarachi",
                tagline, copyright_text as "copyrightText"
         FROM footer_settings
         LIMIT 1`
      ).catch(() => ({ rows: [] }));
      footerData = fallbackRes.rows[0] || null;
    }

    // 4. Fetch categories
    const catsRes = await query(
      `SELECT name FROM categories ORDER BY display_order ASC`
    );

    const deal = dealsRes.rows[0]
      ? {
          ...dealsRes.rows[0],
          price: typeof dealsRes.rows[0].price === 'string' && !dealsRes.rows[0].price.startsWith('Rs.')
            ? `Rs. ${Number(dealsRes.rows[0].price).toLocaleString()}`
            : dealsRes.rows[0].price,
        }
      : null;

    return NextResponse.json({
      heroBanners: bannersRes.rows,
      dealCard: deal,
      footerSettings: footerData,
      categories: catsRes.rows.map((r: any) => r.name),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch marketing and categories from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { type } = body;

    // A. FOOTER SETTINGS UPDATE
    if (type === 'footer') {
      const { settings } = body;
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      // Auto-migrate schema columns if missing
      try {
        await query(`ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS order_routing_support_first BOOLEAN DEFAULT true`);
        await query(`ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS auto_forward_kitchen_min INT DEFAULT 3`);
        await query(`ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS auto_forward_mode VARCHAR(20) DEFAULT 'timed'`);
      } catch (err) {}

      if (settings.helpline !== undefined) {
        updates.push(`helpline = $${idx++}`);
        values.push(settings.helpline);
      }
      if (settings.email !== undefined) {
        updates.push(`email = $${idx++}`);
        values.push(settings.email);
      }
      if (settings.hours !== undefined) {
        updates.push(`hours = $${idx++}`);
        values.push(settings.hours);
      }
      if (settings.addressLahore !== undefined) {
        updates.push(`address_lahore = $${idx++}`);
        values.push(settings.addressLahore);
      }
      if (settings.addressIslamabad !== undefined) {
        updates.push(`address_islamabad = $${idx++}`);
        values.push(settings.addressIslamabad);
      }
      if (settings.addressKarachi !== undefined) {
        updates.push(`address_karachi = $${idx++}`);
        values.push(settings.addressKarachi);
      }
      if (settings.tagline !== undefined) {
        updates.push(`tagline = $${idx++}`);
        values.push(settings.tagline);
      }
      if (settings.copyrightText !== undefined) {
        updates.push(`copyright_text = $${idx++}`);
        values.push(settings.copyrightText);
      }
      if (settings.orderRoutingSupportFirst !== undefined) {
        updates.push(`order_routing_support_first = $${idx++}`);
        values.push(settings.orderRoutingSupportFirst);
      }
      if (settings.autoForwardKitchenMin !== undefined) {
        updates.push(`auto_forward_kitchen_min = $${idx++}`);
        values.push(settings.autoForwardKitchenMin);
      }
      if (settings.autoForwardMode !== undefined) {
        updates.push(`auto_forward_mode = $${idx++}`);
        values.push(settings.autoForwardMode);
      }

      if (updates.length > 0) {
        const sql = `UPDATE footer_settings SET ${updates.join(', ')} WHERE id = 'default' RETURNING *`;
        await query(sql, values);
      }

      return NextResponse.json({ success: true, message: 'Footer updated in PostgreSQL' });
    }

    // B. DEAL CARD UPDATE
    if (type === 'deal') {
      const { deal } = body;
      const cleanPrice = String(deal.price).replace(/[^0-9.]/g, '') || '650';

      const sql = `
        INSERT INTO deal_cards (id, title, subtitle, price, tag, image_url, category_link)
        VALUES ('primary-deal', $1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          subtitle = EXCLUDED.subtitle,
          price = EXCLUDED.price,
          tag = EXCLUDED.tag,
          image_url = EXCLUDED.image_url,
          category_link = EXCLUDED.category_link
        RETURNING *
      `;
      const res = await query(sql, [
        deal.title,
        deal.subtitle,
        cleanPrice,
        deal.tag,
        deal.imageUrl,
        deal.categoryLink || 'Biryani & Rice',
      ]);
      return NextResponse.json({ success: true, deal: res.rows[0] });
    }

    // C. HERO BANNER UPDATE / INSERT
    if (type === 'banner') {
      const { banner } = body;
      const sql = `
        INSERT INTO hero_banners (id, title, subtitle, badge, image_url, category_link, active, display_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 1))
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          subtitle = EXCLUDED.subtitle,
          badge = EXCLUDED.badge,
          image_url = EXCLUDED.image_url,
          category_link = EXCLUDED.category_link,
          active = EXCLUDED.active
        RETURNING *
      `;
      const res = await query(sql, [
        banner.id,
        banner.title,
        banner.subtitle,
        banner.badge,
        banner.imageUrl,
        banner.categoryLink || 'Biryani & Rice',
        banner.active !== undefined ? banner.active : true,
        banner.displayOrder || null,
      ]);
      return NextResponse.json({ success: true, banner: res.rows[0] });
    }

    // D. HERO BANNER DELETE
    if (type === 'delete_banner') {
      const { id } = body;
      await query(`DELETE FROM hero_banners WHERE id = $1`, [id]);
      return NextResponse.json({ success: true, message: `Banner ${id} deleted` });
    }

    // E. CATEGORY MANAGEMENT
    if (type === 'category') {
      const { action, name, oldName, newName } = body;

      if (action === 'add' && name) {
        const catId = `cat-${Date.now()}`;
        const maxOrder = await query(`SELECT COALESCE(MAX(display_order), 0) + 1 as "nextOrder" FROM categories`);
        const nextOrder = maxOrder.rows[0]?.nextOrder || 1;
        await query(
          `INSERT INTO categories (id, name, display_order) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`,
          [catId, name, nextOrder]
        );
        return NextResponse.json({ success: true, message: `Category ${name} created in PostgreSQL` });
      }

      if (action === 'rename' && oldName && newName) {
        await query(`UPDATE categories SET name = $1 WHERE name = $2`, [newName, oldName]);
        await query(`UPDATE menu_items SET category = $1 WHERE category = $2`, [newName, oldName]);
        return NextResponse.json({ success: true, message: `Category renamed from ${oldName} to ${newName}` });
      }

      if (action === 'delete' && name) {
        await query(`DELETE FROM categories WHERE name = $1`, [name]);
        return NextResponse.json({ success: true, message: `Category ${name} deleted from PostgreSQL` });
      }
    }

    return NextResponse.json({ error: 'Invalid marketing update type' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update marketing in PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}
