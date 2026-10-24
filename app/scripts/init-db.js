#!/usr/bin/env node

/**
 * Standalone FoodiesCafe PostgreSQL Database Initialization Script
 * Usage:
 *   node scripts/init-db.js
 * Or with custom connection string:
 *   DATABASE_URL="postgres://user:pass@localhost:5432/foodiescafe" node scripts/init-db.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
const poolConfig = connectionString
  ? { connectionString, ssl: process.env.NODE_ENV === 'production' && !connectionString.includes('localhost') ? { rejectUnauthorized: false } : false }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'foodiescafe',
    };

const pool = new Pool(poolConfig);

async function main() {
  console.log('--- FoodiesCafe PostgreSQL Database Initializer ---');
  console.log('Connecting to PostgreSQL with config:', {
    host: poolConfig.host || 'via DATABASE_URL',
    port: poolConfig.port || 5432,
    database: poolConfig.database || 'from url',
    user: poolConfig.user || 'from url',
  });

  try {
    const client = await pool.connect();
    console.log('✓ Successfully connected to PostgreSQL server.');

    const schemaPaths = [
      path.resolve(__dirname, '../../database/schema.sql'),
      path.resolve(__dirname, '../database/schema.sql'),
    ];
    const schemaPath = schemaPaths.find((p) => fs.existsSync(p));

    if (!schemaPath) {
      throw new Error('schema.sql file not found in database/ directory!');
    }

    console.log(`Reading schema from: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Applying database schema (tables, indices, foreign keys)...');
    await client.query(schemaSql);
    console.log('✓ Schema applied successfully.');

    const seedPaths = [
      path.resolve(__dirname, '../../database/seed.sql'),
      path.resolve(__dirname, '../database/seed.sql'),
    ];
    const seedPath = seedPaths.find((p) => fs.existsSync(p));

    if (seedPath) {
      console.log(`Reading seed data from: ${seedPath}`);
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      console.log('Applying seed data (branches, users, categories, dishes, tables)...');
      await client.query(seedSql);
      console.log('✓ Master seed data inserted successfully.');
    }

    client.release();
    console.log('----------------------------------------------------');
    console.log('✓ PostgreSQL database initialization finished 100% successfully!');
    process.exit(0);
  } catch (err) {
    console.error('✗ Database initialization failed:', err.message);
    console.log('\nTIP: Make sure your PostgreSQL server is running and accessible.');
    console.log('You can specify DATABASE_URL in .env or run with:');
    console.log('  DATABASE_URL="postgres://username:password@localhost:5432/foodiescafe" node scripts/init-db.js\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
