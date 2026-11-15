import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';
import { newDb, DataType } from 'pg-mem';
import { FALLBACK_SCHEMA_SQL, FALLBACK_SEED_SQL } from '@/database/embeddedSeed';

/**
 * Production-grade PostgreSQL Client for FoodiesCafe
 * - Production: Requires DATABASE_URL and uses real PostgreSQL only (fails loudly if missing).
 * - Local Dev/Test: Uses real PostgreSQL by default; only enables pg-mem when USE_PG_MEM=true is explicitly set.
 * - PgBouncer / Managed Pooler compatible (statement_timeout, idleTimeoutMillis, max connections configurable via env).
 */

declare global {
  // eslint-disable-next-line no-var
  var __foodiesPgClient: {
    pool: Pool;
    isMemory: boolean;
    initialized: boolean;
    txChain?: Promise<any>;
    restorePromise?: Promise<void>;
  } | undefined;
  // eslint-disable-next-line no-var
  var __foodiesLocalPurged: boolean | undefined;
}

function createMemoryPgPool(): { pool: Pool; restorePromise: Promise<void> } {
  const memDb = newDb();

  memDb.registerExtension('uuid-ossp', (schema) => {
    schema.registerFunction({
      name: 'uuid_generate_v4',
      returns: DataType.text,
      implementation: () => {
        try {
          return require('crypto').randomUUID();
        } catch {
          return Math.random().toString(36).substring(2, 15);
        }
      },
    });
  });

  memDb.public.registerFunction({
    name: 'version',
    implementation: () => 'PostgreSQL 16.4 (FoodiesCafe Dev pg-mem)',
  });

  try {
    const schemaPaths = [
      path.resolve(process.cwd(), '../database/schema.sql'),
      path.resolve(process.cwd(), 'database/schema.sql'),
    ];
    const seedPaths = [
      path.resolve(process.cwd(), '../database/seed.sql'),
      path.resolve(process.cwd(), 'database/seed.sql'),
    ];

    const schemaPath = schemaPaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
    const seedPath = seedPaths.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

    const schemaSql = schemaPath ? fs.readFileSync(schemaPath, 'utf8') : FALLBACK_SCHEMA_SQL;
    memDb.public.none(schemaSql);

    if (process.env.SEED_PG_MEM !== 'false') {
      const seedSql = seedPath ? fs.readFileSync(seedPath, 'utf8') : FALLBACK_SEED_SQL;
      memDb.public.none(seedSql);
    }
  } catch (err) {
    console.error('[db] Error initializing pg-mem dev database:', err);
    memDb.public.none(FALLBACK_SCHEMA_SQL);
  }

  const pgAdapter = memDb.adapters.createPg();
  const pool = new pgAdapter.Pool() as unknown as Pool;
  const restorePromise = restorePersistedDatabaseState(pool);
  return { pool, restorePromise };
}

function getPersistentStateFilePath(): string {
  const candidates = [
    path.resolve(process.cwd(), '../database/persisted_db_state.json'),
    path.resolve(process.cwd(), 'database/persisted_db_state.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.dirname(c))) return c;
  }
  return candidates[0];
}

const PERSISTED_TABLES = [
  'branches',
  'categories',
  'menu_items',
  'tables',
  'table_sessions',
  'cash_shifts',
  'orders',
  'order_history',
  'refund_requests',
  'notifications',
  'notification_settings',
  'receiver_notification_settings',
  'audit_logs',
  'users',
  'hero_banners',
  'deal_cards',
  'banner_deal_approval_requests',
  'footer_settings',
  'announcements',
];

const CLEARABLE_EMPTY_TABLES = new Set([
  'notifications',
  'announcements',
  'refund_requests',
  'table_sessions',
  'banner_deal_approval_requests',
  'hero_banners',
  'categories',
  'menu_items',
]);

const SYNC_DELETIONS_TABLES = new Set([
  'menu_items',
  'categories',
  'hero_banners',
  'announcements',
  'notifications',
  'tables',
  'users',
]);

async function ensureExtraSchemaColumns(pool: Pool): Promise<void> {
  const statements = [
    `ALTER TABLE branches ADD COLUMN IF NOT EXISTS min_delivery_amount INT NOT NULL DEFAULT 500`,
    `ALTER TABLE tables ADD COLUMN IF NOT EXISTS assigned_waiter_id VARCHAR(64)`,
    `ALTER TABLE tables ADD COLUMN IF NOT EXISTS assigned_waiter_name VARCHAR(255)`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50)`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS instagram VARCHAR(100)`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS facebook VARCHAR(100)`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS tiktok VARCHAR(100)`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS order_routing_support_first BOOLEAN DEFAULT true`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS auto_forward_kitchen_min INT DEFAULT 3`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS auto_forward_mode VARCHAR(30) DEFAULT 'timed'`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_enabled BOOLEAN DEFAULT true`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_badge VARCHAR(64)`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_title TEXT`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_message TEXT`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_type VARCHAR(30) DEFAULT 'promo'`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_updated_by VARCHAR(150)`,
    `ALTER TABLE footer_settings ADD COLUMN IF NOT EXISTS home_notification_updated_at VARCHAR(100)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_platform VARCHAR(20) DEFAULT 'all'`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_waiter_id VARCHAR(100)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_waiter_name VARCHAR(150)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_rider_id VARCHAR(100)`,
    `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_rider_name VARCHAR(150)`,
    `ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS recipient_rules JSONB`,
    `CREATE TABLE IF NOT EXISTS notification_settings (
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
    )`,
    `CREATE TABLE IF NOT EXISTS receiver_notification_settings (
      receiver_key VARCHAR(150) PRIMARY KEY,
      settings JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const sql of statements) {
    await pool.query(sql).catch(() => {});
  }
}

async function restorePersistedDatabaseState(pool: Pool): Promise<void> {
  try {
    await ensureExtraSchemaColumns(pool);
    const filePath = getPersistentStateFilePath();
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content || !content.trim()) return;
    const state = JSON.parse(content);
    if (!state || typeof state !== 'object') return;

    for (const table of PERSISTED_TABLES) {
      if (!(table in state) || !Array.isArray(state[table])) continue;
      const rows = state[table];

      if (rows.length === 0) {
        if (CLEARABLE_EMPTY_TABLES.has(table)) {
          await pool.query(`DELETE FROM "${table}"`).catch(() => {});
        }
        continue;
      }

      if (SYNC_DELETIONS_TABLES.has(table)) {
        const keepIds = rows.map((r: any) => r?.id).filter(Boolean);
        if (keepIds.length > 0) {
          if (table === 'categories') {
            await pool.query(`DELETE FROM "categories"`).catch(() => {});
          } else {
            const placeholders = keepIds.map((_: any, i: number) => `$${i + 1}`).join(', ');
            await pool.query(`DELETE FROM "${table}" WHERE id NOT IN (${placeholders})`, keepIds).catch(() => {});
          }
        }
      }

      for (const row of rows) {
        try {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;
          const cols = keys.map((k) => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const vals = keys.map((k) => {
            const val = row[k];
            if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
              return JSON.stringify(val);
            }
            return val;
          });

          const nonIdKeys = keys.filter((k) => k !== 'id');
          const conflictClause = row.id && nonIdKeys.length > 0
            ? `ON CONFLICT (id) DO UPDATE SET ${nonIdKeys.map((k) => `"${k}" = EXCLUDED."${k}"`).join(', ')}`
            : `ON CONFLICT DO NOTHING`;

          const sql = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) ${conflictClause}`;
          await pool.query(sql, vals).catch(() => {});
        } catch {}
      }
    }
    console.log(`[db] Restored persistent database state from ${filePath}. (Orders: ${(state.orders || []).length})`);
  } catch (err: any) {
    console.warn('[db] Could not restore persistent database state:', err.message);
  }
}

let saveTimer: NodeJS.Timeout | null = null;
let isSaving = false;

export async function flushDatabaseStatePersistence(pool?: Pool) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const targetPool = pool || global.__foodiesPgClient?.pool;
  if (!targetPool) return;
  try {
    const filePath = getPersistentStateFilePath();
    const snapshot: Record<string, any[]> = {};
    for (const t of PERSISTED_TABLES) {
      try {
        const res = await targetPool.query(`SELECT * FROM "${t}"`);
        snapshot[t] = res.rows;
      } catch {}
    }
    // Compact JSON + atomic async write so the event loop is never blocked by disk I/O.
    const json = JSON.stringify(snapshot);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    await fs.promises.writeFile(tmpPath, json, 'utf8');
    await fs.promises.rename(tmpPath, filePath);
  } catch (err: any) {
    console.warn('[db] Failed to flush database state:', err.message);
  }
}

// Batch many writes into one background snapshot (debounced, with a max wait),
// instead of re-dumping every table 50ms after every single write.
const PERSIST_DEBOUNCE_MS = 1500;
const PERSIST_MAX_WAIT_MS = 5000;
let firstPendingAt = 0;
let pendingWhileSaving = false;

export function scheduleDatabaseStatePersistence(pool: Pool) {
  if (isSaving) {
    pendingWhileSaving = true;
    return;
  }
  const now = Date.now();
  if (!firstPendingAt) firstPendingAt = now;
  if (saveTimer) clearTimeout(saveTimer);
  const delay = Math.max(0, Math.min(PERSIST_DEBOUNCE_MS, firstPendingAt + PERSIST_MAX_WAIT_MS - now));
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    firstPendingAt = 0;
    isSaving = true;
    try {
      await flushDatabaseStatePersistence(pool);
    } finally {
      isSaving = false;
      if (pendingWhileSaving) {
        pendingWhileSaving = false;
        scheduleDatabaseStatePersistence(pool);
      }
    }
  }, delay);
}

function buildPoolConfig(): PoolConfig {
  const isProd = process.env.NODE_ENV === 'production';
  const connectionString = process.env.DATABASE_URL;

  if (isProd && !connectionString) {
    throw new Error(
      '[FATAL] DATABASE_URL environment variable is missing in production. Refusing to start without a real PostgreSQL connection.'
    );
  }

  const max = parseInt(process.env.DB_POOL_MAX || '25', 10);
  const min = parseInt(process.env.DB_POOL_MIN || '2', 10);
  const idleTimeoutMillis = parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10);
  const connectionTimeoutMillis = parseInt(process.env.DB_CONN_TIMEOUT_MS || '5000', 10);
  const statementTimeout = parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '10000', 10);
  const maxUses = parseInt(process.env.DB_POOL_MAX_USES || '7500', 10);

  // PgBouncer transaction-pooling compatibility: avoid session-level startup options when PGBOUNCER=true
  const isPgBouncer =
    process.env.PGBOUNCER === 'true' ||
    Boolean(connectionString && (connectionString.includes('pgbouncer=true') || connectionString.includes(':6432')));

  const sslConfig =
    process.env.PGSSL === 'true' ||
    (isProd && connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'))
      ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'true' }
      : false;

  const baseConfig: PoolConfig = {
    max,
    min,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    allowExitOnIdle: false,
    maxUses,
    ssl: sslConfig,
    ...(isPgBouncer ? {} : { statement_timeout: statementTimeout, query_timeout: statementTimeout }),
  };

  if (connectionString) {
    return {
      ...baseConfig,
      connectionString,
    };
  }

  return {
    ...baseConfig,
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'foodiescafe',
  };
}

export function getDatabaseClient() {
  if (global.__foodiesPgClient) {
    return global.__foodiesPgClient;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const useExplicitPgMem = !isProd && process.env.USE_PG_MEM === 'true';

  if (useExplicitPgMem) {
    console.warn('[db] USE_PG_MEM=true detected in non-production environment. Using in-memory pg-mem adapter.');
    const mem = createMemoryPgPool();
    global.__foodiesPgClient = {
      pool: mem.pool,
      isMemory: true,
      initialized: true,
      restorePromise: mem.restorePromise,
    };
    return global.__foodiesPgClient;
  }

  const realPool = new Pool(buildPoolConfig());

  realPool.on('error', (err) => {
    console.error('[db] Unexpected error on idle PostgreSQL client:', err.message);
  });

  global.__foodiesPgClient = {
    pool: realPool,
    isMemory: false,
    initialized: true,
  };

  return global.__foodiesPgClient;
}

function isConnError(err: any): boolean {
  const connectionErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'connection timeout', 'Connection terminated'];
  return (
    connectionErrors.some((code) => err?.message?.includes(code) || err?.code === code) ||
    (Array.isArray(err?.errors) && err.errors.some((subErr: any) => connectionErrors.some((c: any) => subErr?.code === c || subErr?.message?.includes(c)))) ||
    err?.name === 'AggregateError'
  );
}

function isWriteQuery(text: string): boolean {
  const trimmed = text.trim().toUpperCase();
  return (
    trimmed.startsWith('INSERT') ||
    trimmed.startsWith('UPDATE') ||
    trimmed.startsWith('DELETE') ||
    trimmed.startsWith('CREATE') ||
    trimmed.startsWith('ALTER') ||
    trimmed.startsWith('DROP') ||
    trimmed.startsWith('TRUNCATE')
  );
}

/**
 * Execute a parameterized SQL query on PostgreSQL.
 * Falls back seamlessly to pg-mem in dev when PostgreSQL is offline.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = getDatabaseClient();
  if (client.restorePromise) {
    await client.restorePromise;
  }
  try {
    const res = await client.pool.query<T>(text, params);
    if (client.isMemory && isWriteQuery(text)) {
      scheduleDatabaseStatePersistence(client.pool);
    }
    return res;
  } catch (err: any) {
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd && !client.isMemory && isConnError(err)) {
      console.warn('[db] PostgreSQL server not responding, falling back seamlessly to dev pg-mem adapter.');
      const mem = createMemoryPgPool();
      client.pool = mem.pool;
      client.isMemory = true;
      client.restorePromise = mem.restorePromise;
      if (client.restorePromise) {
        await client.restorePromise;
      }
      const res = await client.pool.query<T>(text, params);
      if (client.isMemory && isWriteQuery(text)) {
        scheduleDatabaseStatePersistence(client.pool);
      }
      return res;
    }
    throw err;
  }
}

/**
 * Execute a callback inside a single PostgreSQL client / transaction.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const dbClient = getDatabaseClient();
  if (dbClient.restorePromise) {
    await dbClient.restorePromise;
  }

  if (!dbClient.isMemory) {
    try {
      const client = await dbClient.pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        if (dbClient.isMemory) {
          scheduleDatabaseStatePersistence(dbClient.pool);
        }
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {}
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      const isProd = process.env.NODE_ENV === 'production';
      if (!isProd && !dbClient.isMemory && isConnError(err)) {
        console.warn('[db] PostgreSQL server not responding in transaction, switching to dev pg-mem adapter.');
        const mem = createMemoryPgPool();
        dbClient.pool = mem.pool;
        dbClient.isMemory = true;
        dbClient.restorePromise = mem.restorePromise;
        if (dbClient.restorePromise) {
          await dbClient.restorePromise;
        }
      } else {
        throw err;
      }
    }
  }

  // In-memory pg-mem shares a single virtual session across pool.connect(), so serialize BEGIN/COMMIT chains
  if (dbClient.isMemory) {
    const prev = dbClient.txChain || Promise.resolve();
    let releaseLock!: () => void;
    dbClient.txChain = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    await prev;
    const client = await dbClient.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      scheduleDatabaseStatePersistence(dbClient.pool);
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw err;
    } finally {
      client.release();
      releaseLock();
    }
  }

  throw new Error('[db] Failed to acquire client for transaction');
}

/**
 * Return live pool metrics for observability and /api/ready checks
 */
export function getPoolMetrics() {
  const client = getDatabaseClient();
  return {
    isMemory: client.isMemory,
    totalCount: client.pool.totalCount ?? 0,
    idleCount: client.pool.idleCount ?? 0,
    waitingCount: client.pool.waitingCount ?? 0,
  };
}

/**
 * Test connectivity and report database status
 */
export async function testConnection(): Promise<{
  connected: boolean;
  engine: string;
  isMemory: boolean;
  message: string;
  timestamp: string;
  pool: { totalCount: number; idleCount: number; waitingCount: number };
}> {
  try {
    const client = getDatabaseClient();
    const res = await client.pool.query('SELECT NOW() as now, version() as version');
    return {
      connected: true,
      engine: client.isMemory ? 'PostgreSQL (Dev pg-mem)' : 'PostgreSQL (Live Server)',
      isMemory: client.isMemory,
      message: `Active engine: ${res.rows[0]?.version || 'PostgreSQL'}`,
      timestamp: res.rows[0]?.now?.toISOString?.() || new Date().toISOString(),
      pool: getPoolMetrics(),
    };
  } catch (err: any) {
    return {
      connected: false,
      engine: 'Disconnected',
      isMemory: false,
      message: err?.message || 'Database connection error',
      timestamp: new Date().toISOString(),
      pool: { totalCount: 0, idleCount: 0, waitingCount: 0 },
    };
  }
}

/**
 * Type-safe query helper: returns strongly typed array of rows
 */
export async function safeQuery<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await query<T>(text, params);
  return (result?.rows || []) as T[];
}

export default { query, safeQuery, withTransaction, testConnection, getPoolMetrics, flushDatabaseStatePersistence, scheduleDatabaseStatePersistence };
