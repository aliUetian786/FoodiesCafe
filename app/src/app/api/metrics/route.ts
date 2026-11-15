import { NextResponse } from 'next/server';
import { getSystemMetricsSnapshot } from '@/lib/metrics';
import { getJobQueueStats } from '@/lib/jobs';

export async function GET() {
  const snapshot = getSystemMetricsSnapshot();
  const jobQueue = getJobQueueStats();

  return NextResponse.json({
    ...snapshot,
    jobQueue,
  });
}

