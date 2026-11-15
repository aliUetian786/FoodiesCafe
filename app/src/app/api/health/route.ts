import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Fast, stateless process liveness probe (< 5ms).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'foodiescafe-api',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

