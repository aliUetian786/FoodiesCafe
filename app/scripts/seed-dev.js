#!/usr/bin/env node

/**
 * Development-Only Database Seed Script for FoodiesCafe
 * Usage (local dev only):
 *   npm run db:seed
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
  console.error('✗ Refusing to run dev seed script in production environment.');
  process.exit(1);
}

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

const connectionString = process.env.DATABASE_URL;
const poolConfig = connectionString
  ? {
      connectionString,
      ssl:
        process.env.PGSSL === 'true' ||
        (process.env.NODE_ENV === 'production' && !connectionString.includes('localhost'))
          ? { rejectUnauthorized: false }
          : false,
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'foodiescafe',
    };

const pool = new Pool(poolConfig);

async function main() {
  console.log('--- FoodiesCafe Development Database Seeder ---');
  try {
    const client = await pool.connect();
    try {
      const seedPaths = [
        path.resolve(__dirname, '../../database/seed.sql'),
        path.resolve(__dirname, '../database/seed.sql'),
      ];
      const seedPath = seedPaths.find((p) => fs.existsSync(p));
      if (!seedPath) {
        throw new Error('database/seed.sql file not found.');
      }

      console.log(`Applying dev seed data from: ${seedPath}`);
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await client.query(seedSql);
      console.log('✓ Development seed data applied successfully.');
    } finally {
      client.release();
    }
    process.exit(0);
  } catch (err) {
    console.error('✗ Seeding failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

