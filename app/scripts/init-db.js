#!/usr/bin/env node

/**
 * FoodiesCafe Database Migration Runner (powered by node-pg-migrate)
 * Replaces legacy init-db.js. Runs SQL migrations in app/migrations/*.js.
 */

const { runner } = require('node-pg-migrate');
const fs = require('fs');
const path = require('path');

// Load .env if present in app directory
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const direction = process.argv[2] === 'down' ? 'down' : 'up';
const databaseUrl =
  process.env.DATABASE_URL ||
  `postgres://${encodeURIComponent(process.env.PGUSER || 'postgres')}:${encodeURIComponent(
    process.env.PGPASSWORD || 'postgres'
  )}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || '5432'}/${
    process.env.PGDATABASE || 'foodiescafe'
  }`;

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL environment variable is required in production.');
    process.exit(1);
  }

  console.log(`--- Running FoodiesCafe Database Migrations (${direction}) ---`);
  try {
    await runner({
      databaseUrl,
      dir: path.resolve(__dirname, '../migrations'),
      direction,
      migrationsTable: 'pgmigrations',
      log: (msg) => console.log(msg),
    });
    console.log('✓ Migrations completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('✗ Migration failed:', err.message || err);
    process.exit(1);
  }
}

main();
