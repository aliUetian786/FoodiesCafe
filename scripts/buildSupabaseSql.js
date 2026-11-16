const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, '../database/schema.sql');
const seedPath = path.resolve(__dirname, '../database/seed.sql');
const outputPath = path.resolve(__dirname, '../database/supabase_setup.sql');

const schema = fs.readFileSync(schemaPath, 'utf8');
const seed = fs.readFileSync(seedPath, 'utf8');

const extraSchema = `
-- ============================================================================
-- Extra Columns and Auxiliary Tables Migration (Idempotent)
-- ============================================================================
ALTER TABLE branches ADD COLUMN IF NOT EXISTS min_delivery_amount INT NOT NULL DEFAULT 500;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS assigned_waiter_id VARCHAR(64);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS assigned_waiter_name VARCHAR(255);
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50);
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS instagram VARCHAR(100);
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS facebook VARCHAR(100);
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS tiktok VARCHAR(100);
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS order_routing_support_first BOOLEAN DEFAULT true;
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS auto_forward_kitchen_min INT DEFAULT 3;
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS auto_forward_mode VARCHAR(30) DEFAULT 'timed';
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_enabled BOOLEAN DEFAULT true;
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_badge VARCHAR(64);
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_title TEXT;
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_message TEXT;
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_type VARCHAR(30) DEFAULT 'promo';
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_updated_by VARCHAR(150);
ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_updated_at VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_platform VARCHAR(20) DEFAULT 'all';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_waiter_id VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_waiter_name VARCHAR(150);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_rider_id VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_rider_name VARCHAR(150);
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS recipient_rules JSONB;

CREATE TABLE IF NOT EXISTS receiver_notification_settings (
    receiver_key VARCHAR(150) PRIMARY KEY,
    settings JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

const rlsAndGrants = `
-- ============================================================================
-- Supabase Permissions & Row-Level Security
-- Disables RLS so server queries with postgres/service role execute smoothly
-- ============================================================================
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE refund_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE hero_banners DISABLE ROW LEVEL SECURITY;
ALTER TABLE deal_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE banner_deal_approval_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE footer_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_otps DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE receiver_notification_settings DISABLE ROW LEVEL SECURITY;

-- Grant full table & sequence permissions to standard Supabase roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

SELECT 'FoodiesCafe database initialized successfully for Supabase!' AS status;
`;

const combined = [
  '-- ============================================================================',
  '-- FoodiesCafe Complete All-In-One Database Setup for Supabase',
  '-- Instructions: Open Supabase Dashboard -> SQL Editor -> New Query',
  '-- Paste this entire file and click "Run" (Ctrl+Enter / Cmd+Enter)',
  '-- ============================================================================',
  '',
  schema,
  extraSchema,
  seed,
  rlsAndGrants
].join('\n\n');

fs.writeFileSync(outputPath, combined, 'utf8');
console.log('Successfully generated database/supabase_setup.sql (' + combined.length + ' bytes)');
