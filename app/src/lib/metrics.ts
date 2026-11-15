import { getPoolMetrics } from '@/lib/db';
import { getActiveSseConnections } from '@/lib/realtime';

interface RouteMetricBucket {
  count: number;
  errorCount: number;
  latenciesMs: number[];
}

declare global {
  // eslint-disable-next-line no-var
  var __foodiesMetricsStore:
    | {
        routes: Map<string, RouteMetricBucket>;
        orderToReadyDurationsSec: number[];
        totalRequests: number;
        totalErrors: number;
        startedAt: number;
      }
    | undefined;
}

function getStore() {
  if (!global.__foodiesMetricsStore) {
    global.__foodiesMetricsStore = {
      routes: new Map(),
      orderToReadyDurationsSec: [],
      totalRequests: 0,
      totalErrors: 0,
      startedAt: Date.now(),
    };
  }
  return global.__foodiesMetricsStore;
}

export function recordRequestMetric(route: string, durationMs: number, statusCode: number) {
  const store = getStore();
  store.totalRequests += 1;
  const isError = statusCode >= 500;
  if (isError) {
    store.totalErrors += 1;
  }

  let bucket = store.routes.get(route);
  if (!bucket) {
    bucket = { count: 0, errorCount: 0, latenciesMs: [] };
    store.routes.set(route, bucket);
  }
  bucket.count += 1;
  if (isError) bucket.errorCount += 1;
  bucket.latenciesMs.push(durationMs);
  if (bucket.latenciesMs.length > 500) {
    bucket.latenciesMs.shift();
  }
}

export function recordOrderToReadyDuration(durationSeconds: number) {
  if (durationSeconds <= 0 || isNaN(durationSeconds)) return;
  const store = getStore();
  store.orderToReadyDurationsSec.push(durationSeconds);
  if (store.orderToReadyDurationsSec.length > 200) {
    store.orderToReadyDurationsSec.shift();
  }
}

function computePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx] * 100) / 100;
}

export function getSystemMetricsSnapshot() {
  const store = getStore();
  const routeStats: Record<
    string,
    {
      requests: number;
      errors: number;
      errorRatePercent: number;
      p50Ms: number;
      p95Ms: number;
      p99Ms: number;
    }
  > = {};

  for (const [route, bucket] of store.routes.entries()) {
    routeStats[route] = {
      requests: bucket.count,
      errors: bucket.errorCount,
      errorRatePercent:
        bucket.count > 0 ? Math.round((bucket.errorCount / bucket.count) * 10000) / 100 : 0,
      p50Ms: computePercentile(bucket.latenciesMs, 50),
      p95Ms: computePercentile(bucket.latenciesMs, 95),
      p99Ms: computePercentile(bucket.latenciesMs, 99),
    };
  }

  const readySamples = store.orderToReadyDurationsSec;
  const avgOrderToReadySec =
    readySamples.length > 0
      ? Math.round(readySamples.reduce((a, b) => a + b, 0) / readySamples.length)
      : 0;

  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - store.startedAt) / 1000),
    totals: {
      requests: store.totalRequests,
      errors: store.totalErrors,
      errorRatePercent:
        store.totalRequests > 0
          ? Math.round((store.totalErrors / store.totalRequests) * 10000) / 100
          : 0,
    },
    activeSseConnections: getActiveSseConnections(),
    dbPool: getPoolMetrics(),
    orderFulfillment: {
      samples: readySamples.length,
      avgOrderToReadySeconds: avgOrderToReadySec,
      p95OrderToReadySeconds: computePercentile(readySamples, 95),
    },
    routes: routeStats,
  };
}

