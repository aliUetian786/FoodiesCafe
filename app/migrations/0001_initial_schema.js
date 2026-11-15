/* eslint-disable */
/**
 * Migration 0001: Initial FoodiesCafe PostgreSQL Schema & Required Indexes
 */

exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
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
      assigned_floor VARCHAR(100),
      assigned_table_numbers JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_floor VARCHAR(100);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_table_numbers JSONB DEFAULT '[]'::jsonb;

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

    ALTER TABLE tables ADD COLUMN IF NOT EXISTS qr_code TEXT;
    ALTER TABLE tables ADD COLUMN IF NOT EXISTS qr_expires_at TIMESTAMPTZ;
    ALTER TABLE tables ADD COLUMN IF NOT EXISTS allow_qr_reserved BOOLEAN DEFAULT false;
    ALTER TABLE tables ADD COLUMN IF NOT EXISTS assigned_waiter_id VARCHAR(64);
    ALTER TABLE tables ADD COLUMN IF NOT EXISTS assigned_waiter_name VARCHAR(255);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tables_branch_number_unique ON tables(branch_id, number);
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_waiter_id VARCHAR(64);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_waiter_name VARCHAR(255);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_table_qr BOOLEAN DEFAULT false;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_notified BOOLEAN DEFAULT false;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS sent_to_kitchen BOOLEAN DEFAULT false;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS sent_to_kitchen_at TIMESTAMPTZ;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS forward_to_kitchen_at TIMESTAMPTZ;

    -- Required composite and unique indexes on orders
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_unique ON orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_orders_branch_status_created_at ON orders(branch_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at ON orders(customer_id, created_at DESC);
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
    CREATE INDEX IF NOT EXISTS idx_complaints_branch_status ON complaints(branch_id, status);
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
    ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
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

    -- 13. Banner & Deal Approval Requests
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

    -- 15. Table Occupancy Sessions
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

    -- 17. Email OTPs Table
    CREATE TABLE IF NOT EXISTS email_otps (
      email VARCHAR(255) PRIMARY KEY,
      code VARCHAR(10) NOT NULL,
      expires_at BIGINT NOT NULL
    );
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS email_otps CASCADE;
    DROP TABLE IF EXISTS announcements CASCADE;
    DROP TABLE IF EXISTS table_sessions CASCADE;
    DROP TABLE IF EXISTS footer_settings CASCADE;
    DROP TABLE IF EXISTS banner_deal_approval_requests CASCADE;
    DROP TABLE IF EXISTS deal_cards CASCADE;
    DROP TABLE IF EXISTS hero_banners CASCADE;
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS refund_requests CASCADE;
    DROP TABLE IF EXISTS cash_shifts CASCADE;
    DROP TABLE IF EXISTS complaints CASCADE;
    DROP TABLE IF EXISTS orders CASCADE;
    DROP TABLE IF EXISTS tables CASCADE;
    DROP TABLE IF EXISTS menu_items CASCADE;
    DROP TABLE IF EXISTS categories CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS branches CASCADE;
  `);
};

