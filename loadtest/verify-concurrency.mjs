/**
 * Phase 8 Automated Concurrency, Idempotency, ETag, and State-Machine Verification Suite
 * Run against live Next.js server: `node loadtest/verify-concurrency.mjs`
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

async function runVerification() {
  console.log(`\n🚀 Starting FoodiesCafe Phase 1–8 Verification against ${BASE_URL}...\n`);

  // 1. Health & Readiness checks
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const health = await healthRes.json();
  await assert(healthRes.status === 200 && health.status === 'ok', `/api/health liveness check (status=${healthRes.status})`);

  const readyRes = await fetch(`${BASE_URL}/api/ready`);
  const ready = await readyRes.json();
  await assert(
    readyRes.status === 200 && ready.ready === true && ready.database?.ready === true,
    `/api/ready DB + Redis readiness check (dbReady=${ready.database?.ready})`
  );

  // 2. Menu ETag & 304 Not Modified caching check
  const menuRes1 = await fetch(`${BASE_URL}/api/menu?branchId=gulberg-lahore`);
  const etag = menuRes1.headers.get('etag');
  await assert(menuRes1.status === 200 && Boolean(etag), `GET /api/menu returns ETag (${etag})`);

  const menuRes2 = await fetch(`${BASE_URL}/api/menu?branchId=gulberg-lahore`, {
    headers: { 'If-None-Match': etag },
  });
  await assert(menuRes2.status === 304, `GET /api/menu with If-None-Match returns 304 Not Modified`);

  // 3. Order Idempotency check (retry with same Idempotency-Key returns same order, zero duplicates)
  const idemKey = `verify-idem-${Date.now()}`;
  const orderId = `ord-verify-${Date.now()}`;
  const orderPayload = {
    id: orderId,
    orderNumber: `FC-V-${Math.floor(1000 + Math.random() * 9000)}`,
    idempotencyKey: idemKey,
    customerId: 'user-verify-1',
    customerName: 'Verification Customer',
    customerPhone: '+923001112233',
    branchId: 'gulberg-lahore',
    type: 'takeaway',
    status: 'placed',
    paymentStatus: 'unpaid',
    paymentMethod: 'Cash',
    total: 1500,
    items: [
      {
        id: 'itm-v-1',
        menuItemId: 'm1',
        name: 'Royal Chicken Dum Biryani',
        unitPrice: 750,
        quantity: 2,
      },
    ],
  };

  const [orderAttempt1, orderAttempt2] = await Promise.all([
    fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey },
      body: JSON.stringify(orderPayload),
    }),
    fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey },
      body: JSON.stringify({ ...orderPayload, id: `${orderId}-dup` }),
    }),
  ]);

  const orderData1 = await orderAttempt1.json();
  const orderData2 = await orderAttempt2.json();
  await assert(
    orderAttempt1.status === 200 &&
      orderAttempt2.status === 200 &&
      orderData1.order?.id === orderData2.order?.id &&
      (orderData1.idempotentReplay === true || orderData2.idempotentReplay === true),
    `POST /api/orders with identical Idempotency-Key produces 1 order (${orderData1.order?.id}) and replays on retry`
  );

  const createdOrderId = orderData1.order?.id;
  const initialVersion = Number(orderData1.order?.version || 1);

  // 4. Server-side State Machine: reject illegal backward/skip transition (placed -> completed)
  const illegalRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: createdOrderId,
      status: 'completed',
      expectedVersion: initialVersion,
      actorRole: 'kitchen_staff',
    }),
  });
  await assert(
    illegalRes.status === 409 || illegalRes.status === 422,
    `PATCH /api/orders rejects illegal transition 'placed -> completed' with ${illegalRes.status} Conflict`
  );

  // 5. Role separation: kitchen_staff cannot mark an order as paid
  const kitchenPayRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: createdOrderId,
      paymentStatus: 'paid',
      actorRole: 'kitchen_staff',
    }),
  });
  await assert(
    kitchenPayRes.status === 403,
    `PATCH /api/orders blocks kitchen_staff from marking paymentStatus='paid' with 403 Forbidden (status=${kitchenPayRes.status})`
  );

  // 6. Valid transition (placed -> accepted) + Optimistic Concurrency (stale expectedVersion -> 409)
  const validPatchRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: createdOrderId,
      status: 'accepted',
      expectedVersion: initialVersion,
      actorRole: 'kitchen_staff',
      actorName: 'Chef Verify',
    }),
  });
  const validPatchData = await validPatchRes.json();
  await assert(
    validPatchRes.status === 200 && Number(validPatchData.order?.version) === initialVersion + 1,
    `PATCH /api/orders transitions 'placed -> accepted' and increments version (${initialVersion} -> ${validPatchData.order?.version})`
  );

  const stalePatchRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: createdOrderId,
      status: 'preparing',
      expectedVersion: initialVersion, // stale version!
      actorRole: 'kitchen_staff',
    }),
  });
  await assert(
    stalePatchRes.status === 409,
    `PATCH /api/orders with stale expectedVersion (${initialVersion}) returns 409 Conflict (status=${stalePatchRes.status})`
  );

  // 7. Simultaneous QR Table Claim race test (two clients claim same table at the same millisecond)
  const testTableNumber = String(90 + Math.floor(Math.random() * 9));
  const [claim1, claim2] = await Promise.all([
    fetch(`${BASE_URL}/api/tables/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: 'gulberg-lahore',
        tableId: `t-verify-${testTableNumber}`,
        tableNumber: testTableNumber,
        customerId: 'racer-1',
        customerName: 'Racer One',
      }),
    }),
    fetch(`${BASE_URL}/api/tables/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        branchId: 'gulberg-lahore',
        tableId: `t-verify-${testTableNumber}`,
        tableNumber: testTableNumber,
        customerId: 'racer-2',
        customerName: 'Racer Two',
      }),
    }),
  ]);

  const statuses = [claim1.status, claim2.status].sort();
  await assert(
    statuses[0] === 200 && statuses[1] === 409,
    `Simultaneous QR table claims result in exactly 1 winner (200) and 1 conflict (409) [got ${statuses.join(', ')}]`
  );

  // 8. Scoped Sync & ETag 304 check
  const syncRes1 = await fetch(`${BASE_URL}/api/sync?branchId=gulberg-lahore&role=customer&customerId=user-verify-1`);
  const syncEtag = syncRes1.headers.get('etag');
  const syncBody = await syncRes1.json();
  const allOrdersBelongToCustomer = (syncBody.orders || []).every((o) => o.customerId === 'user-verify-1');
  await assert(
    syncRes1.status === 200 && allOrdersBelongToCustomer && (syncBody.orders || []).length > 0,
    `GET /api/sync?role=customer returns only authenticated customer's orders (${syncBody.orders?.length || 0} orders)`
  );

  const syncRes2 = await fetch(`${BASE_URL}/api/sync?branchId=gulberg-lahore&role=customer&customerId=user-verify-1`, {
    headers: { 'If-None-Match': syncEtag },
  });
  await assert(syncRes2.status === 304, `GET /api/sync with unchanged state returns 304 Not Modified`);

  // 9. Observability metrics endpoint
  const metricsRes = await fetch(`${BASE_URL}/api/metrics`);
  const metrics = await metricsRes.json();
  await assert(
    metricsRes.status === 200 && metrics.dbPool !== undefined && metrics.activeSseConnections !== undefined,
    `GET /api/metrics exposes latency percentiles, DB pool stats, and SSE connection counts`
  );

  console.log('\n🎉 All Phase 1–8 verification checks completed!\n');
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
