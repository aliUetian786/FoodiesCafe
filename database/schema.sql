-- ============================================================================
-- FoodiesCafe PostgreSQL Database Schema (schema.sql)
-- Multi-Branch Real-Time Cafe Management System
-- Compatible with PostgreSQL 13+ (including AWS RDS, Supabase, Neon, Local PG)
-- ============================================================================

-- Extensions (UUID generation)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Branches Table
CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    opening_hours VARCHAR(100) NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT true,
    is_busy BOOLEAN NOT NULL DEFAULT false,
    prep_time_estimate_min INT NOT NULL DEFAULT 25,
    full_edit_window_min INT NOT NULL DEFAULT 10,
    stop_add_ons_min_before_ready INT NOT NULL DEFAULT 5,
    delivery_enabled BOOLEAN NOT NULL DEFAULT true,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    max_order_distance_km DOUBLE PRECISION NOT NULL DEFAULT 50,
    table_qr_max_distance_meters INT NOT NULL DEFAULT 300,
    min_delivery_amount INT NOT NULL DEFAULT 500,
    auto_schedule_enabled BOOLEAN NOT NULL DEFAULT false,
    schedule_last_applied VARCHAR(64),
    payment_settings JSONB NOT NULL DEFAULT '{"dine_in":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"takeaway":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"delivery":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false}}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS min_delivery_amount INT NOT NULL DEFAULT 500;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS auto_schedule_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS schedule_last_applied VARCHAR(64);

-- 2. Users Table (Staff & Customers)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    role VARCHAR(50) NOT NULL,
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    no_show_count INT NOT NULL DEFAULT 0,
    password_hash VARCHAR(255),
    rider_availability VARCHAR(30) DEFAULT 'available',
    rider_total_deliveries INT DEFAULT 0,
    rider_active_order_id VARCHAR(64),
    assigned_floor VARCHAR(100),
    assigned_table_numbers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 3. Menu Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0
);

-- 4. Menu Items Table
CREATE TABLE IF NOT EXISTS menu_items (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL,
    image TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT true,
    branch_availability JSONB NOT NULL DEFAULT '{}'::jsonb,
    branch_price_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
    sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
    extras JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);

-- 5. Restaurant Tables Table
CREATE TABLE IF NOT EXISTS tables (
    id VARCHAR(64) PRIMARY KEY,
    number VARCHAR(20) NOT NULL,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    capacity INT NOT NULL DEFAULT 4,
    chairs INT NOT NULL DEFAULT 4,
    floor VARCHAR(100) NOT NULL DEFAULT 'Ground Floor',
    status VARCHAR(30) NOT NULL DEFAULT 'available',
    current_order_id VARCHAR(64),
    seated_at TIMESTAMPTZ,
    reserved_for VARCHAR(255),
    pin VARCHAR(10),
    qr_code TEXT,
    qr_expires_at TIMESTAMPTZ,
    allow_qr_reserved BOOLEAN DEFAULT false,
    assigned_waiter_id VARCHAR(64),
    assigned_waiter_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, number)
);
CREATE INDEX IF NOT EXISTS idx_tables_branch_status ON tables(branch_id, status);

-- 6. Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
    customer_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    type VARCHAR(30) NOT NULL,
    table_number VARCHAR(20),
    table_pin VARCHAR(10),
    pickup_time VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'placed',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    original_subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    add_on_subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0,
    tax NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0,
    preparation_started_at TIMESTAMPTZ,
    ready_time_estimated TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    delivery_address TEXT,
    version INT NOT NULL DEFAULT 1,
    cashier_id VARCHAR(64),
    cashier_name VARCHAR(255),
    is_walk_in BOOLEAN DEFAULT false,
    assigned_rider_id VARCHAR(64),
    assigned_rider_name VARCHAR(255),
    rider_status VARCHAR(30),
    delivered_at TIMESTAMPTZ,
    payment_collected BOOLEAN DEFAULT false,
    customer_coordinates JSONB,
    assigned_waiter_id VARCHAR(64),
    assigned_waiter_name VARCHAR(255),
    is_table_qr BOOLEAN DEFAULT false,
    waiter_notified BOOLEAN DEFAULT false,
    sent_to_kitchen BOOLEAN DEFAULT false,
    sent_to_kitchen_at TIMESTAMPTZ,
    forward_to_kitchen_at TIMESTAMPTZ,
    auto_forward_custom_min INT,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_unique ON orders(order_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_branch_status_created_at ON orders(branch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 7. Cash Register Shifts Table
CREATE TABLE IF NOT EXISTS cash_shifts (
    id VARCHAR(64) PRIMARY KEY,
    cashier_id VARCHAR(64) NOT NULL,
    cashier_name VARCHAR(255) NOT NULL,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,
    opening_float NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cash_collected NUMERIC(10, 2) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(10, 2) NOT NULL DEFAULT 0,
    counted_cash NUMERIC(10, 2),
    difference NUMERIC(10, 2),
    difference_reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cash_shifts_branch_status ON cash_shifts(branch_id, status);

-- 9. Refund Requests Table
CREATE TABLE IF NOT EXISTS refund_requests (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
    amount NUMERIC(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    requested_by VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'requested',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_refund_requests_branch ON refund_requests(branch_id);

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    branch_id VARCHAR(64),
    action VARCHAR(50) NOT NULL,
    details TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch_created_at ON audit_logs(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- 11. Marketing Hero Banners
CREATE TABLE IF NOT EXISTS hero_banners (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle TEXT NOT NULL,
    badge VARCHAR(100),
    image_url TEXT NOT NULL,
    category_link VARCHAR(100),
    active BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0
);

-- 12. Deals Table
CREATE TABLE IF NOT EXISTS deal_cards (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'primary-deal',
    title VARCHAR(255) NOT NULL,
    subtitle TEXT NOT NULL,
    price VARCHAR(50) NOT NULL,
    tag VARCHAR(50) NOT NULL,
    image_url TEXT NOT NULL,
    category_link VARCHAR(100)
);

-- 13. Banner & Deal Approval Requests (Representative Workflow)
CREATE TABLE IF NOT EXISTS banner_deal_approval_requests (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(20) NOT NULL,
    action VARCHAR(20) NOT NULL,
    target_id VARCHAR(64),
    submitted_by VARCHAR(255) NOT NULL,
    submitted_by_role VARCHAR(50) NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    banner_data JSONB,
    deal_data JSONB,
    decision_by VARCHAR(255),
    decision_at TIMESTAMPTZ,
    notes TEXT
);

-- 14. Global Footer Settings Table
CREATE TABLE IF NOT EXISTS footer_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'default',
    helpline VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    hours VARCHAR(100) NOT NULL,
    address_lahore TEXT NOT NULL,
    address_islamabad TEXT NOT NULL,
    address_karachi TEXT NOT NULL,
    tagline TEXT NOT NULL,
    copyright_text TEXT NOT NULL,
    whatsapp VARCHAR(50),
    instagram VARCHAR(100),
    facebook VARCHAR(100),
    tiktok VARCHAR(100),
    order_routing_support_first BOOLEAN NOT NULL DEFAULT true,
    auto_forward_kitchen_min INT NOT NULL DEFAULT 3,
    auto_forward_mode VARCHAR(30) NOT NULL DEFAULT 'timed',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
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


-- 15. Table Occupancy Sessions (Manager & Floor Tracking)
CREATE TABLE IF NOT EXISTS table_sessions (
    id VARCHAR(64) PRIMARY KEY,
    table_id VARCHAR(64) NOT NULL,
    table_number VARCHAR(20) NOT NULL,
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    floor VARCHAR(100) NOT NULL DEFAULT 'Ground Floor',
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ,
    duration_min INT,
    customer_name VARCHAR(255),
    order_id VARCHAR(64),
    order_number VARCHAR(50),
    waiter_name VARCHAR(255) DEFAULT 'Kashif Ali (Floor Staff)',
    total_amount NUMERIC(10, 2) DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'occupied',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_table_sessions_branch ON table_sessions(branch_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_started ON table_sessions(started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_one_active_per_table ON table_sessions(branch_id, table_number) WHERE status = 'occupied';

-- 15b. Order Status & Edit History Table
CREATE TABLE IF NOT EXISTS order_history (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_number VARCHAR(50) NOT NULL,
    branch_id VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL DEFAULT 'system',
    actor_name VARCHAR(255) NOT NULL DEFAULT 'System',
    actor_role VARCHAR(50) NOT NULL DEFAULT 'system',
    change_type VARCHAR(50) NOT NULL,
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    old_payment_status VARCHAR(30),
    new_payment_status VARCHAR(30),
    old_total NUMERIC(10, 2),
    new_total NUMERIC(10, 2),
    version INT NOT NULL DEFAULT 1,
    details TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_history_order_id_created_at ON order_history(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_history_branch_created_at ON order_history(branch_id, created_at DESC);

-- 16. Announcements & Info Table
CREATE TABLE IF NOT EXISTS announcements (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    tag VARCHAR(64) NOT NULL DEFAULT 'ANNOUNCEMENT',
    description TEXT NOT NULL,
    valid_until VARCHAR(100),
    branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
    branch_name VARCHAR(100),
    discount_percent INT,
    badge_color VARCHAR(50) DEFAULT '#EF4444',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_announcements_branch ON announcements(branch_id);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);

-- 17. Email OTP Verifications Table
CREATE TABLE IF NOT EXISTS email_otps (
    email VARCHAR(255) PRIMARY KEY,
    code VARCHAR(10) NOT NULL,
    expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);

-- 18. Real-Time Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(100) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'info',
    category VARCHAR(50) NOT NULL DEFAULT 'system',
    branch_id VARCHAR(100) DEFAULT 'all',
    order_id VARCHAR(100),
    order_number VARCHAR(64),
    order_type VARCHAR(30),
    sender_id VARCHAR(100),
    sender_name VARCHAR(150),
    sender_role VARCHAR(50),
    target_roles JSONB NOT NULL DEFAULT '["all"]'::jsonb,
    target_platform VARCHAR(20) NOT NULL DEFAULT 'all',
    target_user_id VARCHAR(100),
    target_customer_phone VARCHAR(50),
    target_customer_name VARCHAR(150),
    target_waiter_id VARCHAR(100),
    target_waiter_name VARCHAR(150),
    target_rider_id VARCHAR(100),
    target_rider_name VARCHAR(150),
    read_by JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_platform VARCHAR(20) DEFAULT 'all';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_waiter_id VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_waiter_name VARCHAR(150);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_rider_id VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_rider_name VARCHAR(150);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_branch_id ON notifications(branch_id);

-- 19. Automated Notification Settings Table (Persistent Across Restarts)
CREATE TABLE IF NOT EXISTS notification_settings (
    id VARCHAR(64) PRIMARY KEY DEFAULT 'global',
    default_platform VARCHAR(20) NOT NULL DEFAULT 'all',
    notify_customer BOOLEAN NOT NULL DEFAULT true,
    notify_concerned_rider BOOLEAN NOT NULL DEFAULT true,
    notify_concerned_waiter BOOLEAN NOT NULL DEFAULT true,
    notify_kitchen BOOLEAN NOT NULL DEFAULT true,
    notify_cashier_and_manager BOOLEAN NOT NULL DEFAULT true,
    events JSONB NOT NULL DEFAULT '{"orderPlaced":true,"sentToKitchen":true,"cooking":true,"orderReady":true,"outForDelivery":true,"orderServed":true,"orderCompleted":true,"orderCancelled":true,"waiterAssigned":true,"riderAssigned":true,"paymentReceived":true}'::jsonb,
    recipient_rules JSONB NOT NULL DEFAULT '{"customer":{"orderPlaced":true,"cooking":true,"orderReady":true,"outForDelivery":true,"orderCompleted":true,"orderCancelled":true},"rider":{"orderAssigned":true,"orderReady":true,"orderCancelled":true},"waiter":{"orderAssigned":true,"orderReady":true,"orderCancelled":true},"kitchen":{"newOrderPlaced":true,"orderCancelled":true},"cashierAndManager":{"orderPlaced":true,"orderCancelled":true,"paymentReceived":true}}'::jsonb,
    updated_by VARCHAR(150),
    updated_by_role VARCHAR(50),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS recipient_rules JSONB;
INSERT INTO notification_settings (id, default_platform, notify_customer, notify_concerned_rider, notify_concerned_waiter, notify_kitchen, notify_cashier_and_manager)
VALUES ('global', 'all', true, true, true, true, true)
ON CONFLICT (id) DO NOTHING;

-- 20. Custom Receiver Notification Settings Table
CREATE TABLE IF NOT EXISTS receiver_notification_settings (
    receiver_key VARCHAR(150) PRIMARY KEY,
    settings JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);




