import { Pool, PoolClient, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { newDb, DataType } from 'pg-mem';
import { FALLBACK_SCHEMA_SQL, FALLBACK_SEED_SQL } from '@/database/embeddedSeed';

/**
 * Production-grade PostgreSQL Client for FoodiesCafe
 * - Uses DATABASE_URL when configured and reachable; otherwise falls back seamlessly to embedded pg-mem
 *   so serverless/preview deployments (Vercel) and local dev never fail loudly on missing/offline PG.
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

function getPersistentStateFilePath(forWrite: boolean = false): string {
  const tmpStatePath = path.join(process.env.VERCEL ? '/tmp' : os.tmpdir(), 'foodies_persisted_db_state.json');
  const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const candidates = [
    path.resolve(process.cwd(), '../database/persisted_db_state.json'),
    path.resolve(process.cwd(), 'database/persisted_db_state.json'),
  ];

  if (forWrite) {
    if (isServerless) {
      return tmpStatePath;
    }
    for (const c of candidates) {
      try {
        if (fs.existsSync(path.dirname(c))) {
          fs.accessSync(path.dirname(c), fs.constants.W_OK);
          return c;
        }
      } catch {}
    }
    return tmpStatePath;
  }

  try {
    if (fs.existsSync(tmpStatePath)) return tmpStatePath;
  } catch {}
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
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

/**
 * Splits a CREATE TABLE body on top-level commas, ignoring commas inside parentheses
 * (NUMERIC(10, 2)) and inside quoted literals (JSON defaults like '{"a":true,"b":true}').
 */
function splitTopLevelCommas(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inQuote = false;
  let current = '';
  for (const ch of body) {
    if (ch === "'") inQuote = !inQuote;
    if (!inQuote && ch === '(') depth++;
    if (!inQuote && ch === ')') depth--;
    if (ch === ',' && depth === 0 && !inQuote) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/**
 * Builds a safe "ADD COLUMN IF NOT EXISTS" definition from a CREATE TABLE column definition.
 * Drops PRIMARY KEY / UNIQUE / REFERENCES, and NOT NULL when there is no DEFAULT (existing rows would violate it).
 */
function toAddColumnDefinition(columnDef: string): string {
  let def = columnDef.replace(/\s+/g, ' ').trim();
  def = def.replace(/\s+REFERENCES\s+.*$/i, '');
  def = def.replace(/\s+PRIMARY KEY/i, '').replace(/\s+UNIQUE/i, '');
  if (!/\sDEFAULT\s/i.test(def)) def = def.replace(/\s+NOT NULL/i, '');
  return def;
}

/**
 * Brings a real PostgreSQL database up to the schema bundled with this build.
 * Databases created from an older schema were missing columns (e.g. orders.idempotency_key),
 * which made every customer order INSERT fail with "current transaction is aborted".
 * Runs once per server instance: one information_schema query, then only the missing DDL.
 */
async function ensureLiveSchemaUpToDate(pool: Pool): Promise<void> {
  try {
    const existing = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
    );
    const columnsByTable = new Map<string, Set<string>>();
    for (const row of existing.rows) {
      if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, new Set());
      columnsByTable.get(row.table_name)!.add(row.column_name);
    }

    const sql = FALLBACK_SCHEMA_SQL.replace(/--.*$/gm, '');
    const tableRe = /CREATE TABLE IF NOT EXISTS\s+"?(\w+)"?\s*\(([\s\S]*?)\)\s*;/gi;
    const applied: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = tableRe.exec(sql))) {
      const [fullStatement, table, body] = match;
      const existingCols = columnsByTable.get(table);

      if (!existingCols) {
        try {
          await pool.query(fullStatement);
          applied.push(`CREATE TABLE ${table}`);
        } catch (err: any) {
          console.error(`[db] Schema repair: could not create table ${table}:`, err.message);
        }
        continue;
      }

      for (const part of splitTopLevelCommas(body)) {
        const def = part.trim();
        if (!def || /^(PRIMARY KEY|UNIQUE|CONSTRAINT|FOREIGN KEY|CHECK)\b/i.test(def)) continue;
        const colName = def.split(/\s+/)[0].replace(/"/g, '');
        if (existingCols.has(colName)) continue;
        try {
          await pool.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS ${toAddColumnDefinition(def)}`);
          applied.push(`${table}.${colName}`);
        } catch (err: any) {
          console.error(`[db] Schema repair: could not add column ${table}.${colName}:`, err.message);
        }
      }
    }

    await pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key_unique ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL`
    ).catch(() => {});
    await ensureExtraSchemaColumns(pool);

    // Bootstrap initial cafe master data if branches are empty
    const branchCountRes = await pool
      .query(`SELECT COUNT(*) as count FROM branches`)
      .catch(() => ({ rows: [] }));
    if (Number(branchCountRes.rows[0]?.count || 0) === 0) {
      console.log('[db] Zero branches found in PostgreSQL. Seeding initial cafe master data...');
      await pool.query(FALLBACK_SEED_SQL).catch((err) => {
        console.warn('[db] Auto-seed warning:', err.message);
      });
    }

    if (applied.length > 0) {
      console.warn(`[db] Schema repair applied ${applied.length} change(s): ${applied.join(', ')}`);
    }
  } catch (err: any) {
    console.error('[db] Schema repair skipped:', err.message);
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
    const filePath = getPersistentStateFilePath(true);
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

function getPostgresConnectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL
  );
}

function buildPoolConfig(): PoolConfig {
  const isProd = process.env.NODE_ENV === 'production';
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const connectionString = getPostgresConnectionString();

  const max = parseInt(process.env.DB_POOL_MAX || (isVercel ? '5' : '20'), 10);
  const min = parseInt(process.env.DB_POOL_MIN || (isVercel ? '0' : '2'), 10);
  const idleTimeoutMillis = parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10);
  const connectionTimeoutMillis = parseInt(process.env.DB_CONN_TIMEOUT_MS || '10000', 10);
  const statementTimeout = parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '15000', 10);
  const maxUses = parseInt(process.env.DB_POOL_MAX_USES || '7500', 10);

  // PgBouncer / Supabase transaction pooler (port 6543 / 6432) compatibility
  const isPgBouncer =
    process.env.PGBOUNCER === 'true' ||
    Boolean(
      connectionString &&
        (connectionString.includes('pgbouncer=true') ||
         connectionString.includes(':6432') ||
         connectionString.includes(':6543') ||
         connectionString.includes('pooler.supabase.com'))
    );

  const isRemoteHost = Boolean(
    connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')
  );

  const sslConfig =
    process.env.PGSSL === 'true' || isRemoteHost
      ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED === 'true' }
      : false;

  const baseConfig: PoolConfig = {
    max,
    min,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    allowExitOnIdle: isVercel,
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
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const connectionString = getPostgresConnectionString();
  const isLocalhostConn = Boolean(
    connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'))
  );
  const hasValidRemoteUrl = Boolean(connectionString && !isLocalhostConn);
  const useMemoryFallback =
    !hasValidRemoteUrl &&
    (process.env.USE_PG_MEM === 'true' || isProd || isVercel);

  if (useMemoryFallback) {
    if (isVercel) {
      // Each serverless instance gets its own private in-memory DB, so orders placed on one
      // device are NOT visible to staff served by another instance. Set DATABASE_URL to a
      // hosted PostgreSQL (Neon / Supabase) in Vercel → Settings → Environment Variables.
      console.error(
        '[db] CRITICAL: DATABASE_URL is missing or points to localhost on Vercel. Falling back to a per-instance ' +
          'in-memory database — data will NOT be shared between devices. Configure a hosted PostgreSQL DATABASE_URL.'
      );
    } else {
      console.warn('[db] Using resilient embedded pg-mem PostgreSQL adapter.');
    }
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
    // query() and withTransaction() await this before running, so the schema is repaired first.
    restorePromise: ensureLiveSchemaUpToDate(realPool),
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
    if (!client.isMemory && isConnError(err)) {
      console.warn('[db] PostgreSQL server not responding, falling back seamlessly to embedded pg-mem adapter.');
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
      if (!dbClient.isMemory && isConnError(err)) {
        console.warn('[db] PostgreSQL server not responding in transaction, switching to embedded pg-mem adapter.');
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

/**
 * Run a statement inside a transaction that is ALLOWED to fail, without poisoning the transaction.
 *
 * PostgreSQL aborts the whole transaction on any error; if the error is swallowed (`.catch(() => {})`)
 * the final COMMIT silently becomes a ROLLBACK while the caller still returns the "updated" row.
 * That is how rider "delivered" and cashier "paid" updates were reported as saved but never persisted
 * (a side-step `UPDATE cash_shifts ... updated_at` failed on a missing column). A SAVEPOINT isolates
 * the optional statement: on failure only it is rolled back, the error is logged, and the order commits.
 */
export async function optionalQuery<T extends QueryResultRow = any>(
  client: PoolClient,
  text: string,
  params?: any[]
): Promise<{ rows: T[]; rowCount?: number | null }> {
  const sp = `sp_opt_${Math.random().toString(36).slice(2, 10)}`;
  let savepoint = true;
  try {
    await client.query(`SAVEPOINT ${sp}`);
  } catch {
    savepoint = false; // e.g. in-memory dev adapter without savepoint support
  }
  try {
    const res = await client.query<T>(text, params);
    if (savepoint) await client.query(`RELEASE SAVEPOINT ${sp}`).catch(() => {});
    return res;
  } catch (err: any) {
    console.error('[db] optional statement failed (isolated, transaction kept):', err?.message, '|', text.replace(/\s+/g, ' ').slice(0, 120));
    if (savepoint) await client.query(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => {});
    return { rows: [] };
  }
}
