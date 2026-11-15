import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';
import { cacheGet, cacheSet, cacheInvalidatePrefix } from '@/lib/redis';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    let payload = await cacheGet<any>('marketing:all');

    if (!payload) {
      const [bannersRes, dealsRes, footerRes, catsRes] = await Promise.all([
        query(
          `SELECT id, title, subtitle, badge, image_url as "imageUrl",
                  category_link as "categoryLink", active, display_order as "displayOrder"
           FROM hero_banners
           ORDER BY display_order ASC`
        ),
        query(
          `SELECT id, title, subtitle, price, tag, image_url as "imageUrl",
                  category_link as "categoryLink"
           FROM deal_cards
           LIMIT 1`
        ),
        query(
          `SELECT helpline, email, hours,
                  address_lahore as "addressLahore",
                  address_islamabad as "addressIslamabad",
                  address_karachi as "addressKarachi",
                  tagline, copyright_text as "copyrightText",
                  order_routing_support_first as "orderRoutingSupportFirst",
                  auto_forward_kitchen_min as "autoForwardKitchenMin",
                  auto_forward_mode as "autoForwardMode",
                  home_notification_enabled as "homeNotificationEnabled",
                  home_notification_badge as "homeNotificationBadge",
                  home_notification_title as "homeNotificationTitle",
                  home_notification_message as "homeNotificationMessage",
                  home_notification_type as "homeNotificationType",
                  home_notification_updated_by as "homeNotificationUpdatedBy",
                  home_notification_updated_at as "homeNotificationUpdatedAt"
           FROM footer_settings
           LIMIT 1`
        ).catch(() => ({ rows: [] })),
        query(`SELECT name FROM categories ORDER BY display_order ASC`),
      ]);

      const deal = dealsRes.rows[0]
        ? {
            ...dealsRes.rows[0],
            price:
              typeof dealsRes.rows[0].price === 'string' && !dealsRes.rows[0].price.startsWith('Rs.')
                ? `Rs. ${Number(dealsRes.rows[0].price).toLocaleString()}`
                : dealsRes.rows[0].price,
          }
        : null;

      const data = {
        heroBanners: bannersRes.rows,
        dealCard: deal,
        footerSettings: footerRes.rows[0] || null,
        categories: catsRes.rows.map((r: any) => r.name),
      };

      const etag = `"mkt-${crypto.createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 16)}"`;
      payload = { ...data, etag };
      await cacheSet('marketing:all', payload, 30);
    }

    if (request.headers.get('if-none-match') === payload.etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: payload.etag,
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
        },
      });
    }

    return NextResponse.json(
      {
        heroBanners: payload.heroBanners,
        dealCard: payload.dealCard,
        footerSettings: payload.footerSettings,
        categories: payload.categories,
      },
      {
        headers: {
          ETag: payload.etag,
          'Cache-Control': 'public, max-age=15, stale-while-revalidate=60',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch marketing and categories from PostgreSQL', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { auth, errorResponse } = requireAuth(request, ['platform_owner', 'branch_manager']);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { type } = body;

    const invalidateAll = async () => {
      await Promise.all([
        cacheInvalidatePrefix('marketing:'),
        cacheInvalidatePrefix('menu:'),
        cacheInvalidatePrefix('catalog:'),
        cacheInvalidatePrefix('sync:payload:'),
      ]);
      try {
        broadcastRealtimeEvent({ type: 'MENU_UPDATED' });
      } catch {}
    };

    // A. FOOTER SETTINGS UPDATE
    if (type === 'footer') {
      const { settings } = body;
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

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
      if (settings.homeNotificationEnabled !== undefined) {
        updates.push(`home_notification_enabled = $${idx++}`);
        values.push(Boolean(settings.homeNotificationEnabled));
      }
      if (settings.homeNotificationBadge !== undefined) {
        updates.push(`home_notification_badge = $${idx++}`);
        values.push(String(settings.homeNotificationBadge));
      }
      if (settings.homeNotificationTitle !== undefined) {
        updates.push(`home_notification_title = $${idx++}`);
        values.push(String(settings.homeNotificationTitle));
      }
      if (settings.homeNotificationMessage !== undefined) {
        updates.push(`home_notification_message = $${idx++}`);
        values.push(String(settings.homeNotificationMessage));
      }
      if (settings.homeNotificationType !== undefined) {
        updates.push(`home_notification_type = $${idx++}`);
        values.push(String(settings.homeNotificationType));
      }
      if (settings.homeNotificationUpdatedBy !== undefined) {
        updates.push(`home_notification_updated_by = $${idx++}`);
        values.push(String(settings.homeNotificationUpdatedBy));
      }
      if (settings.homeNotificationUpdatedAt !== undefined) {
        updates.push(`home_notification_updated_at = $${idx++}`);
        values.push(String(settings.homeNotificationUpdatedAt));
      }

      if (updates.length > 0) {
        const sql = `UPDATE footer_settings SET ${updates.join(', ')} WHERE id = 'default' RETURNING *`;
        await query(sql, values);
      }

      await invalidateAll();
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
      await invalidateAll();
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
      await invalidateAll();
      return NextResponse.json({ success: true, banner: res.rows[0] });
    }

    // D. HERO BANNER DELETE
    if (type === 'delete_banner') {
      const { id } = body;
      await query(`DELETE FROM hero_banners WHERE id = $1`, [id]);
      await invalidateAll();
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
        await invalidateAll();
        return NextResponse.json({ success: true, message: `Category ${name} created in PostgreSQL` });
      }

      if (action === 'rename' && oldName && newName) {
        await query(`UPDATE categories SET name = $1 WHERE name = $2`, [newName, oldName]);
        await query(`UPDATE menu_items SET category = $1 WHERE category = $2`, [newName, oldName]);
        await invalidateAll();
        return NextResponse.json({ success: true, message: `Category renamed from ${oldName} to ${newName}` });
      }

      if (action === 'delete' && name) {
        await query(`DELETE FROM categories WHERE name = $1`, [name]);
        await invalidateAll();
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
