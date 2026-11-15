/* eslint-disable */
/**
 * Migration 0002: Order Integrity, Concurrency, Idempotency, Table Session Uniqueness & Order History
 */

exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Idempotency key on orders for retry-safe order placement
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique
      ON orders(idempotency_key)
      WHERE idempotency_key IS NOT NULL;

    -- 2. Partial unique index on table_sessions to guarantee at most one active ('occupied') dining session per table
    -- First close any duplicate occupied sessions that might exist from older data
    WITH ranked_sessions AS (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY branch_id, table_number ORDER BY started_at DESC) as rn
      FROM table_sessions
      WHERE status = 'occupied'
    )
    UPDATE table_sessions
    SET status = 'completed', ended_at = CURRENT_TIMESTAMP
    WHERE id IN (SELECT id FROM ranked_sessions WHERE rn > 1);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_one_active_per_table
      ON table_sessions(branch_id, table_number)
      WHERE status = 'occupied';

    -- 3. Order Status & Edit History Table (tracks who, what, when, old/new status & totals)
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

    CREATE INDEX IF NOT EXISTS idx_order_history_order_id_created_at
      ON order_history(order_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_order_history_branch_created_at
      ON order_history(branch_id, created_at DESC);
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS order_history CASCADE;
    DROP INDEX IF EXISTS idx_table_sessions_one_active_per_table;
    DROP INDEX IF EXISTS idx_orders_idempotency_key_unique;
    ALTER TABLE orders DROP COLUMN IF EXISTS idempotency_key;
  `);
};

