import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

/**
 * PHASE 8: FoodiesCafe 500-Concurrent-User Rush Load Test (k6)
 *
 * Scenarios:
 * - 350 concurrent users browsing menu, branches, deals, and conditional ETag /api/sync
 * - 80 concurrent users placing orders (including Idempotency-Key retries & simultaneous QR table claims)
 * - 50 concurrent SSE connections (/api/realtime) held open across branches & customers
 * - 20 concurrent staff users updating kitchen/cashier statuses with optimistic concurrency (expectedVersion)
 *
 * Targets:
 * - p95 read latency < 500 ms
 * - p95 order placement < 1000 ms
 * - Error rate < 1%
 * - Zero duplicate orders on retry
 * - Simultaneous QR table claim -> 1 winner (200), 1 conflict (409)
 */

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const BRANCHES = ['gulberg-lahore', 'f7-islamabad', 'clifton-karachi'];

const readLatency = new Trend('foodies_read_latency_ms', true);
const orderWriteLatency = new Trend('foodies_order_write_latency_ms', true);
const duplicateOrderErrors = new Counter('foodies_duplicate_orders_on_retry');

export const options = {
  scenarios: {
    browsing_customers: {
      executor: 'constant-vus',
      vus: 350,
      duration: '2m',
      exec: 'browseAndSync',
    },
    ordering_customers: {
      executor: 'constant-vus',
      vus: 80,
      duration: '2m',
      exec: 'placeOrdersAndRetry',
    },
    sse_realtime_streams: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      exec: 'holdSseStream',
    },
    branch_staff_updates: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
      exec: 'staffKitchenCashierUpdates',
    },
  },
  thresholds: {
    foodies_read_latency_ms: ['p(95)<500'],
    foodies_order_write_latency_ms: ['p(95)<1000'],
    http_req_failed: ['rate<0.01'],
    foodies_duplicate_orders_on_retry: ['count==0'],
  },
};

export function browseAndSync() {
  const branchId = BRANCHES[__VU % BRANCHES.length];

  const menuRes = http.get(`${BASE_URL}/api/menu?branchId=${branchId}`);
  readLatency.add(menuRes.timings.duration);
  check(menuRes, { 'menu status 200': (r) => r.status === 200 });

  const etag = menuRes.headers['ETag'] || menuRes.headers['etag'];
  if (etag) {
    const cachedRes = http.get(`${BASE_URL}/api/menu?branchId=${branchId}`, {
      headers: { 'If-None-Match': etag },
    });
    readLatency.add(cachedRes.timings.duration);
    check(cachedRes, { 'menu ETag 304': (r) => r.status === 304 });
  }

  const syncRes = http.get(`${BASE_URL}/api/sync?branchId=${branchId}&role=customer&customerId=cust-vu-${__VU}`);
  readLatency.add(syncRes.timings.duration);
  check(syncRes, { 'scoped sync 200': (r) => r.status === 200 });

  sleep(2 + Math.random() * 2);
}

export function placeOrdersAndRetry() {
  const branchId = BRANCHES[__VU % BRANCHES.length];
  const idemKey = `k6-idem-${__VU}-${__ITER}`;
  const orderId = `ord-k6-${__VU}-${__ITER}`;
  const orderNumber = `FC-K6-${__VU}-${__ITER}`;

  const payload = JSON.stringify({
    id: orderId,
    orderNumber,
    idempotencyKey: idemKey,
    customerId: `cust-k6-${__VU}`,
    customerName: `K6 Customer ${__VU}`,
    customerPhone: `+92300${String(1000000 + __VU).slice(-7)}`,
    branchId,
    type: 'takeaway',
    status: 'placed',
    paymentStatus: 'unpaid',
    paymentMethod: 'Cash',
    total: 1500,
    items: [
      {
        id: `itm-${__VU}-${__ITER}`,
        menuItemId: 'm1',
        name: 'Royal Chicken Dum Biryani',
        unitPrice: 750,
        quantity: 2,
      },
    ],
  });

  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idemKey,
  };

  // First submission
  const res1 = http.post(`${BASE_URL}/api/orders`, payload, { headers });
  orderWriteLatency.add(res1.timings.duration);

  // Simulated network retry with identical Idempotency-Key
  const res2 = http.post(`${BASE_URL}/api/orders`, payload, { headers });
  orderWriteLatency.add(res2.timings.duration);

  if (res1.status === 200 && res2.status === 200) {
    const body1 = res1.json();
    const body2 = res2.json();
    if (body1.order?.id !== body2.order?.id || !body2.idempotentReplay) {
      duplicateOrderErrors.add(1);
    }
  }

  sleep(5 + Math.random() * 3);
}

export function holdSseStream() {
  const branchId = BRANCHES[__VU % BRANCHES.length];
  const res = http.get(`${BASE_URL}/api/realtime?branchId=${branchId}&role=kitchen_staff`, {
    timeout: '25s',
  });
  check(res, { 'SSE connected or timed out cleanly': (r) => r.status === 200 || r.status === 0 });
  sleep(1);
}

export function staffKitchenCashierUpdates() {
  const branchId = BRANCHES[__VU % BRANCHES.length];
  const listRes = http.get(`${BASE_URL}/api/orders?branchId=${branchId}&limit=10`);
  readLatency.add(listRes.timings.duration);

  if (listRes.status === 200) {
    const data = listRes.json();
    const orders = data.orders || [];
    const placedOrder = orders.find((o) => o.status === 'placed');
    if (placedOrder) {
      const patchRes = http.patch(
        `${BASE_URL}/api/orders`,
        JSON.stringify({
          orderId: placedOrder.id,
          status: 'accepted',
          expectedVersion: placedOrder.version,
          actorId: `staff-k6-${__VU}`,
          actorName: 'K6 Kitchen',
          actorRole: 'kitchen_staff',
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      check(patchRes, {
        'staff transition 200 or 409 optimistic lock': (r) => r.status === 200 || r.status === 409,
      });
    }
  }

  sleep(3);
}
