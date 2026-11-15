/* eslint-disable */
/**
 * Migration 0003: Audit Log Immutability & Financial Non-Repudiation
 * Prevents UPDATE and DELETE operations on audit_logs table via PostgreSQL rules.
 */

exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- Prevent UPDATE on audit_logs
    CREATE OR REPLACE RULE no_update_audit_logs AS
      ON UPDATE TO audit_logs DO INSTEAD NOTHING;

    -- Prevent DELETE on audit_logs
    CREATE OR REPLACE RULE no_delete_audit_logs AS
      ON DELETE TO audit_logs DO INSTEAD NOTHING;
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.sql(`
    DROP RULE IF EXISTS no_update_audit_logs ON audit_logs;
    DROP RULE IF EXISTS no_delete_audit_logs ON audit_logs;
  `);
};

