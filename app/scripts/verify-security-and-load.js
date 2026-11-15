const http = require('http');

const agent = new http.Agent({ keepAlive: true, maxSockets: 100 });

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        agent,
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, data, json });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING SECURITY, AUTHORIZATION & LOAD VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
    }
  }

  // 1. Unauthenticated administrative calls blocked
  const resUsersAnon = await request(
    { method: 'POST', path: '/api/users' },
    { name: 'Hacker', email: 'h@h.com', role: 'platform_owner' }
  );
  assert(resUsersAnon.status === 401, `Unauthenticated POST /api/users returns 401 (got ${resUsersAnon.status})`);

  const resRefundsAnon = await request(
    { method: 'PATCH', path: '/api/refunds' },
    { refundId: 'ref-1', status: 'approved' }
  );
  assert(resRefundsAnon.status === 401, `Unauthenticated PATCH /api/refunds returns 401 (got ${resRefundsAnon.status})`);

  const resOrderDelete = await request({ method: 'DELETE', path: '/api/orders?id=ord-1' });
  assert(resOrderDelete.status === 405, `DELETE /api/orders returns 405 Method Not Allowed (got ${resOrderDelete.status})`);

  // 2. Staff Authentication
  const loginRes = await request(
    { method: 'POST', path: '/api/auth/staff' },
    { identifier: 'manager.gulberg@foodiescafe.pk', password: 'password123' }
  );
  assert(
    loginRes.status === 200 && loginRes.json?.sessionToken,
    `Staff Login succeeds and returns sessionToken (got ${loginRes.status})`
  );
  const managerToken = loginRes.json?.sessionToken;

  const badLogin = await request(
    { method: 'POST', path: '/api/auth/staff' },
    { identifier: 'manager.gulberg@foodiescafe.pk', password: 'wrongpassword' }
  );
  assert(badLogin.status === 401, `Invalid password returns 401 (got ${badLogin.status})`);

  // 3. Owner Authentication
  const ownerLogin = await request(
    { method: 'POST', path: '/api/auth/staff' },
    { identifier: 'owner@foodiescafe.pk', password: 'password123' }
  );
  assert(ownerLogin.status === 200 && ownerLogin.json?.sessionToken, `Owner Login succeeds (got ${ownerLogin.status})`);
  const ownerToken = ownerLogin.json?.sessionToken;

  // 4. Cashier Authentication
  const cashierLogin = await request(
    { method: 'POST', path: '/api/auth/staff' },
    { identifier: 'cashier.gulberg@foodiescafe.pk', password: 'password123' }
  );
  assert(
    cashierLogin.status === 200 && cashierLogin.json?.sessionToken,
    `Cashier Login succeeds (got ${cashierLogin.status})`
  );
  const cashierToken = cashierLogin.json?.sessionToken;

  // 5. Manager privilege escalation prevention
  const elevateRes = await request(
    {
      method: 'POST',
      path: '/api/users',
      headers: { Authorization: `Bearer ${managerToken}` },
    },
    { name: 'Fake Owner', email: 'fake@owner.com', role: 'platform_owner' }
  );
  assert(elevateRes.status === 403, `Branch Manager cannot create platform_owner account (got ${elevateRes.status})`);

  // 6. Cross-customer data isolation on GET /api/orders
  const ordersAnon = await request({ method: 'GET', path: '/api/orders' });
  assert(
    ordersAnon.status === 200 && Array.isArray(ordersAnon.json?.orders) && ordersAnon.json.orders.length === 0,
    `Anonymous query on /api/orders without customer filter returns empty array (zero data leak)`
  );

  // 7. Pricing tampering prevention (Walk-in custom price by customer rejected)
  const tamperOrderRes = await request(
    { method: 'POST', path: '/api/orders' },
    {
      id: `ord-tamper-${Date.now()}`,
      orderNumber: `FC-TAMPER-${Date.now()}`,
      branchId: 'gulberg-lahore',
      customerName: 'Tamperer',
      customerPhone: '03009999999',
      type: 'takeaway',
      items: [{ id: 'fake-item', menuItemId: 'fake-item', name: 'Luxury Caviar Feast', unitPrice: 1, quantity: 10 }],
    }
  );
  assert(
    tamperOrderRes.status === 400,
    `Uncataloged item with arbitrary Rs. 1 custom price submitted by customer is rejected (got ${tamperOrderRes.status})`
  );

  // 8. Legitimate Order Placement with server-side price recalculation & Idempotency
  const testIdemKey = `idem-${Date.now()}`;
  const validOrderPayload = {
    id: `ord-test-${Date.now()}`,
    orderNumber: `FC-${Math.floor(1000 + Math.random() * 9000)}`,
    branchId: 'gulberg-lahore',
    customerId: 'cust-test-1',
    customerName: 'Test Customer',
    customerPhone: '03001234567',
    type: 'takeaway',
    paymentStatus: 'paid', // Customer attempts to self-mark paid
    items: [{ id: 'm1', menuItemId: 'm1', name: 'Royal Chicken Dum Biryani', quantity: 2, unitPrice: 10 }], // Manipulated price of Rs. 10
  };

  const orderRes1 = await request(
    {
      method: 'POST',
      path: '/api/orders',
      headers: { 'Idempotency-Key': testIdemKey },
    },
    validOrderPayload
  );
  assert(orderRes1.status === 200, `Legitimate order placed successfully (got ${orderRes1.status})`);
  assert(
    orderRes1.json?.order?.total >= 1000,
    `Server correctly recalculated prices from catalog: Total Rs. ${orderRes1.json?.order?.total} (overrode client's Rs. 20)`
  );
  assert(
    orderRes1.json?.order?.paymentStatus === 'unpaid',
    `Customer self-marking paid was safely coerced to 'unpaid'`
  );

  // Replay idempotency test
  const orderRes2 = await request(
    {
      method: 'POST',
      path: '/api/orders',
      headers: { 'Idempotency-Key': testIdemKey },
    },
    validOrderPayload
  );
  assert(
    orderRes2.status === 200 && orderRes2.json?.idempotentReplay === true,
    `Idempotent retry successfully detected without creating duplicate order`
  );

  // 9. Sync ETag 304 test
  const sync1 = await request(
    { method: 'GET', path: '/api/sync?scope=live&branchId=gulberg-lahore' },
    null
  );
  const etag = sync1.headers.etag;
  if (etag) {
    const sync2 = await request(
      {
        method: 'GET',
        path: '/api/sync?scope=live&branchId=gulberg-lahore',
        headers: { 'If-None-Match': etag },
      },
      null
    );
    assert(sync2.status === 304, `Sync returns 304 Not Modified when ETag matches`);
  }

  // 10. High-load simulation: 500 requests across 25 concurrent connections
  console.log('\n--- Commencing 500-VU Concurrency Rush Simulation (25 Workers) ---');
  const vuCount = 500;
  const concurrency = 25;
  const startTime = Date.now();
  const latencies = [];
  const statuses = [];
  let reqIndex = 0;

  async function worker() {
    while (reqIndex < vuCount) {
      const idx = reqIndex++;
      const branch = idx % 2 === 0 ? 'gulberg-lahore' : 'f7-islamabad';
      const t0 = Date.now();
      const res = await request({
        method: 'GET',
        path: `/api/sync?scope=live&branchId=${branch}`,
        headers: idx > 25 && etag ? { 'If-None-Match': etag } : {},
      });
      latencies.push(Date.now() - t0);
      statuses.push(res.status);
    }
  }

  await Promise.all(Array.from({ length: concurrency }).map(worker));

  const totalDuration = Date.now() - startTime;
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const successCount = statuses.filter((s) => s === 200 || s === 304).length;
  const errorRate = ((vuCount - successCount) / vuCount) * 100;

  console.log(`Finished 500 requests in ${totalDuration}ms`);
  console.log(`Latency: p50 = ${p50}ms, p95 = ${p95}ms, p99 = ${p99}ms`);
  console.log(`Error Rate = ${errorRate.toFixed(2)}% (${successCount}/${vuCount} successful)`);

  assert(p95 < 500, `p95 read latency < 500ms (achieved ${p95}ms)`);
  assert(errorRate < 1.0, `Error rate < 1% (achieved ${errorRate.toFixed(2)}%)`);

  console.log(`\n====================================================`);
  console.log(`VERIFICATION SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log(`====================================================\n`);
}

runTests().catch(console.error);
