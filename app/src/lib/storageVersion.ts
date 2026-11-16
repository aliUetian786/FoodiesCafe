/**
 * Drops browser-cached SERVER DATA once per deploy, before the Redux store / AppContext read it.
 *
 * Browsers keep localStorage per address, and the app trusted ~20 cached data keys with no version
 * check. So the stable production URL (used for weeks) kept rendering menus/branches/orders saved by
 * older builds, while a brand-new per-deployment URL started clean and "worked". Logins, cart, chosen
 * branch, saved addresses and the customer's own order ids are intentionally kept.
 *
 * Import this module FIRST (it runs on import) — see redux/store.ts and context/AppContext.tsx.
 */
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
const VERSION_KEY = 'foodies_build_id';

const CACHED_SERVER_DATA_KEYS = [
  'foodies_orders_live',
  'foodies_users_live',
  'foodies_menu_items',
  'foodies_categories',
  'foodies_branches_live',
  'foodies_tables_live',
  'foodies_table_sessions_live',
  'foodies_shifts_live',
  'foodies_refunds_live',
  'foodies_hero_banners',
  'foodies_footer_settings',
  'foodies_deal_card',
  'foodies_local_deal_photos',
  'foodies_local_deal_card_image',
  'foodies_announcement_photos',
  'foodies_web_home_notification',
  'foodies_notification_settings',
  'foodies_receiver_notif_settings_map',
  'foodies_customer_history_cache',
];

function purgeStaleCachesOnNewBuild() {
  if (typeof window === 'undefined') return;
  try {
    if (BUILD_ID === 'dev') return; // local development keeps its data
    if (localStorage.getItem(VERSION_KEY) === BUILD_ID) return;
    for (const key of CACHED_SERVER_DATA_KEYS) localStorage.removeItem(key);
    localStorage.setItem(VERSION_KEY, BUILD_ID);
  } catch {
    // storage blocked (private mode) — nothing cached to purge
  }
}

purgeStaleCachesOnNewBuild();

export const CURRENT_BUILD_ID = BUILD_ID;
