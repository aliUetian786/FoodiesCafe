import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || '';

declare global {
  // eslint-disable-next-line no-var
  var __foodiesRedisPub: Redis | null | undefined;
  // eslint-disable-next-line no-var
  var __foodiesRedisSub: Redis | null | undefined;
  // eslint-disable-next-line no-var
  var __foodiesMemCache: Map<string, { value: string; expiresAt: number }> | undefined;
  // eslint-disable-next-line no-var
  var __foodiesRateLimits: Map<string, { count: number; expiresAt: number }> | undefined;
}

function getMemCache() {
  if (!global.__foodiesMemCache) {
    global.__foodiesMemCache = new Map();
  }
  return global.__foodiesMemCache;
}

function getMemRateLimits() {
  if (!global.__foodiesRateLimits) {
    global.__foodiesRateLimits = new Map();
  }
  return global.__foodiesRateLimits;
}

export function getRedisClient(): Redis | null {
  if (!REDIS_URL) return null;
  if (global.__foodiesRedisPub === undefined) {
    try {
      const client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy(times) {
          if (times > 5) return null;
          return Math.min(times * 200, 2000);
        },
      });
      client.on('error', () => {
        // Handled gracefully with fallback
      });
      global.__foodiesRedisPub = client;
    } catch {
      global.__foodiesRedisPub = null;
    }
  }
  return global.__foodiesRedisPub || null;
}

export function getRedisSubscriber(): Redis | null {
  if (!REDIS_URL) return null;
  if (global.__foodiesRedisSub === undefined) {
    try {
      const sub = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: false,
        retryStrategy(times) {
          if (times > 5) return null;
          return Math.min(times * 200, 2000);
        },
      });
      sub.on('error', () => {
        // Handled gracefully
      });
      global.__foodiesRedisSub = sub;
    } catch {
      global.__foodiesRedisSub = null;
    }
  }
  return global.__foodiesRedisSub || null;
}

export async function checkRedisReady(): Promise<{ configured: boolean; connected: boolean; latencyMs?: number }> {
  if (!REDIS_URL) {
    return { configured: false, connected: false };
  }
  const client = getRedisClient();
  if (!client) {
    return { configured: true, connected: false };
  }
  try {
    const start = Date.now();
    const pong = await client.ping();
    return {
      configured: true,
      connected: pong === 'PONG',
      latencyMs: Date.now() - start,
    };
  } catch {
    return { configured: true, connected: false };
  }
}

export async function cacheGet<T = any>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (client && client.status === 'ready') {
    try {
      const raw = await client.get(`fc:cache:${key}`);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // Fallback to memory cache
    }
  }
  const mem = getMemCache();
  const entry = mem.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    mem.delete(key);
    return null;
  }
  try {
    return JSON.parse(entry.value) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds = 30): Promise<void> {
  const serialized = JSON.stringify(value);
  const mem = getMemCache();
  mem.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });

  const client = getRedisClient();
  if (client && client.status === 'ready') {
    try {
      await client.set(`fc:cache:${key}`, serialized, 'EX', ttlSeconds);
    } catch {
      // Memory cache still updated
    }
  }
}

export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  const mem = getMemCache();
  for (const k of mem.keys()) {
    if (k.startsWith(prefix)) {
      mem.delete(k);
    }
  }

  const client = getRedisClient();
  if (client && client.status === 'ready') {
    try {
      const keys = await client.keys(`fc:cache:${prefix}*`);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch {
      // Ignore Redis error
    }
  }
}

export async function incrementRateLimit(
  key: string,
  windowSeconds: number
): Promise<{ count: number; ttlRemainingSec: number }> {
  const client = getRedisClient();
  if (client && client.status === 'ready') {
    try {
      const redisKey = `fc:rl:${key}`;
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.expire(redisKey, windowSeconds);
      }
      const ttl = await client.ttl(redisKey);
      return { count, ttlRemainingSec: ttl > 0 ? ttl : windowSeconds };
    } catch {
      // Fall through to in-memory
    }
  }

  const mem = getMemRateLimits();
  const now = Date.now();
  const existing = mem.get(key);
  if (!existing || now > existing.expiresAt) {
    const expiresAt = now + windowSeconds * 1000;
    mem.set(key, { count: 1, expiresAt });
    return { count: 1, ttlRemainingSec: windowSeconds };
  }
  existing.count += 1;
  return {
    count: existing.count,
    ttlRemainingSec: Math.max(1, Math.ceil((existing.expiresAt - now) / 1000)),
  };
}

