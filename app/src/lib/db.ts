import { Pool, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';
import { newDb, DataType } from 'pg-mem';
import { FALLBACK_SCHEMA_SQL, FALLBACK_SEED_SQL } from '@/database/embeddedSeed';

// Dual-engine PostgreSQL Client
// Primary: Real PostgreSQL (via DATABASE_URL or local PostgreSQL server)
// Fallback: Full In-Memory PostgreSQL engine (pg-mem) initialized with schema.sql & seed.sql

declare global {
  // eslint-disable-next-line no-var
  var __foodiesPgClient: {
    pool: any;
    isMemory: boolean;
    initialized: boolean;
  } | undefined;
}

function createMemoryPgPool() {
  const memDb = newDb();

  // Register required postgres extensions & functions
  memDb.registerExtension('uuid-ossp', (schema) => {
    schema.registerFunction({
      name: 'uuid_generate_v4',
      returns: DataType.text,
      implementation: () => {
        try {
          return require('crypto').randomUUID();
        } catch (e) {
          return Math.random().toString(36).substring(2, 15);
        }
      },
    });
  });

  memDb.public.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 16.4 (FoodiesCafe Embedded Engine)',
  });

  // Load schema and seed data
  try {
    const schemaPaths = [
      path.resolve(process.cwd(), 'src/database/schema.sql'),
      path.resolve(process.cwd(), 'database/schema.sql'),
      path.resolve(process.cwd(), '../database/schema.sql'),
      path.resolve(__dirname, '../../../database/schema.sql'),
      path.resolve(__dirname, '../../../../database/schema.sql'),
    ];
    const seedPaths = [
      path.resolve(process.cwd(), 'src/database/seed.sql'),
      path.resolve(process.cwd(), 'database/seed.sql'),
      path.resolve(process.cwd(), '../database/seed.sql'),
      path.resolve(__dirname, '../../../database/seed.sql'),
      path.resolve(__dirname, '../../../../database/seed.sql'),
    ];

    const schemaPath = schemaPaths.find((p) => {
      try { return fs.existsSync(p); } catch { return false; }
    });
    const seedPath = seedPaths.find((p) => {
      try { return fs.existsSync(p); } catch { return false; }
    });

    let schemaSql = FALLBACK_SCHEMA_SQL;
    if (schemaPath) {
      try {
        schemaSql = fs.readFileSync(schemaPath, 'utf8');
      } catch {
        schemaSql = FALLBACK_SCHEMA_SQL;
      }
    }
    memDb.public.none(schemaSql);

    let seedSql = FALLBACK_SEED_SQL;
    if (seedPath) {
      try {
        seedSql = fs.readFileSync(seedPath, 'utf8');
      } catch {
        seedSql = FALLBACK_SEED_SQL;
      }
    }
    memDb.public.none(seedSql);
  } catch (err) {
    console.error('Error seeding pg-mem in-memory postgres:', err);
    try {
      memDb.public.none(FALLBACK_SCHEMA_SQL);
      memDb.public.none(FALLBACK_SEED_SQL);
    } catch (fallbackErr) {
      console.error('Embedded schema fallback failed:', fallbackErr);
    }
  }

  const pgAdapter = memDb.adapters.createPg();
  return new pgAdapter.Pool();
}

function getDatabaseClient() {
  if (global.__foodiesPgClient) {
    return global.__foodiesPgClient;
  }

  const connectionString = process.env.DATABASE_URL;
  const isPostgresExplicit = !!connectionString || process.env.USE_POSTGRES === 'true';

  const realPoolConfig = connectionString
    ? {
        connectionString,
        ssl: process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')
          ? { rejectUnauthorized: false }
          : false,
        connectionTimeoutMillis: 2000,
      }
    : {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'foodiescafe',
        ssl: false,
        connectionTimeoutMillis: 2000,
      };

  const realPool = new Pool(realPoolConfig);

  global.__foodiesPgClient = {
    pool: realPool,
    isMemory: false,
    initialized: false,
  };

  return global.__foodiesPgClient;
}

/**
 * Execute a SQL query on PostgreSQL (with automatic seamless fallback)
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = getDatabaseClient();

  if (!client.isMemory) {
    try {
      if (!client.initialized) {
        client.initialized = true;
        try {
          await client.pool.query(`
            DELETE FROM refund_requests WHERE id LIKE 'ref-%' OR id LIKE 'ref-pending-%' OR id LIKE 'ref-approved-%';
            DELETE FROM orders WHERE id LIKE 'ord-seed-%' OR order_number IN ('FC-6744', 'FC-7819', 'FC-8812', 'FC-9021');
            DELETE FROM table_sessions WHERE id LIKE 'sess-%';
            DELETE FROM cash_shifts WHERE id IN ('sh-yesterday-1', 'sh-yesterday-2');
            UPDATE cash_shifts SET opening_float = 0, cash_collected = 0, expected_cash = 0 WHERE id = 'sh-today-1';
          `);
        } catch (initErr) {
          // Ignore if tables don't exist yet
        }
      }
      return await client.pool.query(text, params);
    } catch (err: any) {
      const connectionErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'connection timeout'];
      const isConnError =
        connectionErrors.some((code) => err?.message?.includes(code) || err?.code === code) ||
        (Array.isArray(err?.errors) && err.errors.some((subErr: any) => connectionErrors.some((c) => subErr?.code === c || subErr?.message?.includes(c)))) ||
        err?.name === 'AggregateError';

      if (isConnError) {
        console.warn('PostgreSQL server not currently responding, switching seamlessly to embedded engine.');
        client.pool = createMemoryPgPool();
        client.isMemory = true;
        return await client.pool.query(text, params);
      }
      throw err;
    }
  }

  return await client.pool.query(text, params);
}

/**
 * Test connectivity and report database status
 */
export async function testConnection(): Promise<{
  connected: boolean;
  engine: string;
  message: string;
  timestamp: string;
}> {
  try {
    const res = await query('SELECT NOW() as now, version() as version');
    const client = getDatabaseClient();
    return {
      connected: true,
      engine: client.isMemory ? 'PostgreSQL (Embedded In-Memory Engine)' : 'PostgreSQL (Live Server / Container)',
      message: `Active engine: ${res.rows[0]?.version || 'PostgreSQL'}`,
      timestamp: res.rows[0]?.now?.toISOString?.() || new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      connected: false,
      engine: 'Disconnected',
      message: err?.message || 'Database connection error',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Initialize database schema and master seed
 */
export async function initDatabase(): Promise<{ success: boolean; message: string }> {
  try {
    const schemaPaths = [
      path.resolve(process.cwd(), 'src/database/schema.sql'),
      path.resolve(process.cwd(), 'database/schema.sql'),
      path.resolve(process.cwd(), '../database/schema.sql'),
      path.resolve(__dirname, '../../../database/schema.sql'),
      path.resolve(__dirname, '../../../../database/schema.sql'),
    ];
    const seedPaths = [
      path.resolve(process.cwd(), 'src/database/seed.sql'),
      path.resolve(process.cwd(), 'database/seed.sql'),
      path.resolve(process.cwd(), '../database/seed.sql'),
      path.resolve(__dirname, '../../../database/seed.sql'),
      path.resolve(__dirname, '../../../../database/seed.sql'),
    ];

    const schemaPath = schemaPaths.find((p) => {
      try { return fs.existsSync(p); } catch { return false; }
    });
    const seedPath = seedPaths.find((p) => {
      try { return fs.existsSync(p); } catch { return false; }
    });

    let schemaSql = FALLBACK_SCHEMA_SQL;
    if (schemaPath) {
      try {
        schemaSql = fs.readFileSync(schemaPath, 'utf8');
      } catch {
        schemaSql = FALLBACK_SCHEMA_SQL;
      }
    }
    await query(schemaSql);

    let seedSql = FALLBACK_SEED_SQL;
    if (seedPath) {
      try {
        seedSql = fs.readFileSync(seedPath, 'utf8');
      } catch {
        seedSql = FALLBACK_SEED_SQL;
      }
    }
    await query(seedSql);

    return { success: true, message: 'Database schema and seed data successfully initialized.' };
  } catch (err: any) {
    console.error('Failed to initialize database:', err);
    return { success: false, message: err?.message || 'Database initialization error' };
  }
}

export default { query, testConnection, initDatabase };
