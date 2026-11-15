import { NextResponse } from 'next/server';
import { testConnection, getPoolMetrics } from '@/lib/db';
import { checkRedisReady } from '@/lib/redis';

/**
 * GET /api/ready
 * Readiness probe checking PostgreSQL connectivity, pool capacity, and Redis (if configured).
 */
export async function GET() {
  const [dbStatus, redisStatus] = await Promise.all([
    testConnection(),
    checkRedisReady(),
  ]);

  const isProd = process.env.NODE_ENV === 'production';
  const dbReady = dbStatus.connected && (!isProd || !dbStatus.isMemory);
  const redisReady = !redisStatus.configured || redisStatus.connected;
  const overallReady = dbReady && redisReady;

  return NextResponse.json(
    {
      ready: overallReady,
      timestamp: new Date().toISOString(),
      database: {
        ready: dbReady,
        engine: dbStatus.engine,
        isMemory: dbStatus.isMemory,
        message: dbStatus.message,
        pool: getPoolMetrics(),
      },
      redis: {
        configured: redisStatus.configured,
        ready: redisReady,
        connected: redisStatus.connected,
        latencyMs: redisStatus.latencyMs,
      },
    },
    { status: overallReady ? 200 : 503 }
  );
}
