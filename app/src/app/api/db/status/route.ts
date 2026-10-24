import { NextResponse } from 'next/server';
import { testConnection, initDatabase } from '@/lib/db';

export async function GET() {
  const status = await testConnection();
  return NextResponse.json({
    database: 'PostgreSQL',
    connected: status.connected,
    message: status.message,
    timestamp: status.timestamp || new Date().toISOString(),
  });
}

export async function POST() {
  const initResult = await initDatabase();
  return NextResponse.json(initResult, { status: initResult.success ? 200 : 500 });
}
