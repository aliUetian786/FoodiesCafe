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
    payment_settings JSONB NOT NULL DEFAULT '{"dine_in":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"takeaway":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false},"delivery":{"COD":true,"Wallet":true,"Card":true,"Bank":true,"Installment":false}}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 7. Complaints & Support Tickets Table
CREATE TABLE IF NOT EXISTS complaints (
    id VARCHAR(64) PRIMARY KEY,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    customer_email VARCHAR(255),
    branch_id VARCHAR(64) NOT NULL REFERENCES branches(id),
    order_id VARCHAR(64),
    order_number VARCHAR(50),
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    assigned_to VARCHAR(255),
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_complaints_branch_id ON complaints(branch_id);
CREATE INDEX IF NOT EXISTS idx_complaints_customer_id ON complaints(customer_id);

-- 8. Cash Register Shifts Table
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
    status VARCHAR(20) NOT NULL DEFAULT 'open'
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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

