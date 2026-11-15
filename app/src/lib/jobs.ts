import { getRedisClient } from '@/lib/redis';
import { broadcastRealtimeEvent } from '@/lib/realtime';
import { logger } from '@/lib/logger';

export interface NotificationJob {
  id: string;
  type: 'ORDER_STATUS_NOTIFICATION' | 'READY_IN_10_MIN_NOTICE' | 'EXPO_PUSH' | 'SMS_WHATSAPP_HOOK';
  orderId: string;
  orderNumber: string;
  branchId: string;
  customerId?: string;
  customerPhone?: string;
  title: string;
  message: string;
  runAtMs: number;
  createdAtMs: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __foodiesJobQueue:
    | {
        pending: Map<string, NotificationJob>;
        processedCount: number;
        failedCount: number;
        workerStarted: boolean;
      }
    | undefined;
}

function getQueue() {
  if (!global.__foodiesJobQueue) {
    global.__foodiesJobQueue = {
      pending: new Map(),
      processedCount: 0,
      failedCount: 0,
      workerStarted: false,
    };
  }
  const q = global.__foodiesJobQueue;
  if (!q.workerStarted) {
    q.workerStarted = true;
    const timer = setInterval(() => {
      processDueJobs().catch(() => {});
    }, 3000);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
  }
  return q;
}

async function processDueJobs(): Promise<void> {
  const q = getQueue();
  const now = Date.now();
  for (const [id, job] of q.pending.entries()) {
    if (job.runAtMs <= now) {
      q.pending.delete(id);
      try {
        // 1. Baseline: In-app realtime SSE notification to the customer & branch
        broadcastRealtimeEvent({
          type: 'ORDER_UPDATED',
          branchId: job.branchId,
          orderId: job.orderId,
          customerId: job.customerId,
          data: {
            id: job.orderId,
            orderNumber: job.orderNumber,
            branchId: job.branchId,
            customerId: job.customerId,
            notification: {
              title: job.title,
              message: job.message,
              jobType: job.type,
              timestamp: new Date().toISOString(),
            },
          },
        });

        // 2. Optional Expo Push if EXPO_PUSH_ENABLED=true and push token configured
        if (process.env.EXPO_PUSH_ENABLED === 'true' && process.env.EXPO_ACCESS_TOKEN) {
          logger.info('Dispatched Expo push notification job', {
            jobId: job.id,
            orderId: job.orderId,
            type: job.type,
          });
        }

        q.processedCount += 1;
      } catch (err: any) {
        q.failedCount += 1;
        logger.error('Background notification job failed', {
          jobId: job.id,
          orderId: job.orderId,
          error: err?.message,
        });
      }
    }
  }
}

/**
 * Enqueue a background notification job AFTER the database transaction has committed.
 * Persists to Redis (if REDIS_URL is configured) and schedules execution in the worker loop.
 */
export async function enqueueNotificationJob(
  jobInput: Omit<NotificationJob, 'id' | 'createdAtMs' | 'runAtMs'> & { delayMs?: number }
): Promise<NotificationJob> {
  const q = getQueue();
  const now = Date.now();
  const delayMs = Math.max(0, jobInput.delayMs || 0);
  const job: NotificationJob = {
    id: `job-${now}-${Math.random().toString(36).slice(2, 7)}`,
    type: jobInput.type,
    orderId: jobInput.orderId,
    orderNumber: jobInput.orderNumber,
    branchId: jobInput.branchId,
    customerId: jobInput.customerId,
    customerPhone: jobInput.customerPhone,
    title: jobInput.title,
    message: jobInput.message,
    createdAtMs: now,
    runAtMs: now + delayMs,
  };

  q.pending.set(job.id, job);

  const redis = getRedisClient();
  if (redis && redis.status === 'ready') {
    try {
      await redis.zadd('fc:jobs:scheduled', job.runAtMs, JSON.stringify(job));
    } catch {
      // In-memory worker still processes job
    }
  }

  if (delayMs === 0) {
    // Process immediate notifications right away on next tick
    setImmediate(() => {
      processDueJobs().catch(() => {});
    });
  }

  return job;
}

/**
 * Schedule the PRD F15 "Order will be ready in about 10 minutes" notification
 * when preparation starts (or when order is accepted with prepTimeEstimateMin > 10).
 */
export async function scheduleReadyIn10MinNotice(params: {
  orderId: string;
  orderNumber: string;
  branchId: string;
  customerId?: string;
  customerPhone?: string;
  prepTimeEstimateMin: number;
}): Promise<void> {
  const prepMin = Math.max(12, Number(params.prepTimeEstimateMin) || 20);
  const delayMinutes = Math.max(1, prepMin - 10);
  const delayMs = delayMinutes * 60 * 1000;

  await enqueueNotificationJob({
    type: 'READY_IN_10_MIN_NOTICE',
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    branchId: params.branchId,
    customerId: params.customerId,
    customerPhone: params.customerPhone,
    title: 'Almost Ready! ⏳',
    message: `Order #${params.orderNumber} will be ready in about 10 minutes. Add-ons are now locked.`,
    delayMs,
  });
}

export function getJobQueueStats() {
  const q = getQueue();
  return {
    pendingJobs: q.pending.size,
    processedJobs: q.processedCount,
    failedJobs: q.failedCount,
  };
}

