import { store } from '../store';
import { setOrders, upsertOrder, mergeSingleOrderMonotonically } from '../slices/ordersSlice';
import {
  setTables,
  setShifts,
  setRefundRequests,
  setTableSessions,
  setBranches,
  setMenuItems,
  setCategories,
  setFooterSettings,
  setUsers,
  setSyncTimestamps,
  setAnnouncements,
  setNotifications,
  setNotificationSettings,
  addNotificationInStore,
} from '../slices/cafeSlice';
import { setCurrentRole, setCurrentUser, addToast } from '../slices/uiSlice';
import { normalizeBranchId, STATUS_RANK, OrderStatus, Order } from '@/types/cafe';

const selfHealCooldown = new Map<string, number>();

function buildSyncHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  if (typeof window === 'undefined') return headers;
  try {
    const state = store.getState();
    const role = state.ui.currentRole || 'customer';
    const user = state.ui.currentUser;
    const branchId = state.cafe.currentBranchId;
    const sessionToken =
      localStorage.getItem('foodies_staff_session') ||
      localStorage.getItem('foodies_customer_session');
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    if (role && role !== 'customer') {
      headers['x-foodies-staff-role'] = role;
      if (user?.id) headers['x-foodies-user-id'] = user.id;
      if (branchId) headers['x-foodies-branch-id'] = branchId;
    }
  } catch { }
  return headers;
}

let isSyncing = false;
let syncTimer: any = null;
let broadcastChannel: BroadcastChannel | null = null;
let lastFullSyncTime = 0;
let lastSyncCursor = '';
let lastEtag = '';
let consecutivePollErrors = 0;
let lastReceivedEventId = '';

const BASE_POLL_INTERVAL_MS = 2500; // 2.5s fast polling for zero-delay manager/owner updates
const MAX_POLL_BACKOFF_MS = 120000;

// ---- Performance: coalesce sync bursts and skip no-op dispatches ----
// One order change fans out into several SSE events (ORDER_UPDATED, NOTIFICATION_CREATED,
// TABLE_UPDATED, ...) plus a cross-tab broadcast from every open tab. Each used to start its
// own *forced, overlapping, full* sync, and every sync re-dispatched ~13 slices with fresh
// arrays, so the whole staff UI re-rendered many times per event and stopped responding to
// clicks until a refresh. Now bursts collapse into one sync (never concurrent), and a slice
// is only dispatched when its data actually changed.
let pendingSyncOptions: { full: boolean; force: boolean } | null = null;
let syncFlushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushRequestedSync(): Promise<void> {
  syncFlushTimer = null;
  if (isSyncing) {
    // Never run two syncs at once; try again right after the current one.
    syncFlushTimer = setTimeout(flushRequestedSync, 150);
    return;
  }
  const opts = pendingSyncOptions;
  pendingSyncOptions = null;
  if (!opts) return;
  await runSync(opts);
}

export function requestSync(options?: { full?: boolean; force?: boolean }, delayMs = 200): void {
  if (typeof window === 'undefined') return;
  pendingSyncOptions = {
    full: Boolean(pendingSyncOptions?.full || options?.full),
    force: Boolean(pendingSyncOptions?.force || options?.force),
  };
  if (syncFlushTimer) return; // already scheduled; options merged above
  syncFlushTimer = setTimeout(flushRequestedSync, delayMs);
}

// key -> JSON last dispatched + the store slice reference right after that dispatch.
const lastDispatched = new Map<string, { json: string; ref: unknown }>();
const SLICE_SELECTORS: Record<string, (st: ReturnType<typeof store.getState>) => unknown> = {
  tables: (st) => st.cafe.tables,
  shifts: (st) => st.cafe.shifts,
  refunds: (st) => st.cafe.refundRequests,
  sessions: (st) => st.cafe.tableSessions,
  branches: (st) => st.cafe.branches,
  menuItems: (st) => st.cafe.menuItems,
  categories: (st) => st.cafe.categories,
  footerSettings: (st) => st.cafe.footerSettings,
  announcements: (st) => st.cafe.announcements,
  notifications: (st) => st.cafe.notifications,
  notificationSettings: (st) => st.cafe.notificationSettings,
  users: (st) => st.cafe.users,
};
/**
 * True when `value` must be dispatched: it differs from the last payload for `key`, or the
 * slice was changed locally since (optimistic update), so the server copy must win again.
 */
function hasChanged(key: string, value: unknown): boolean {
  let json = '';
  try {
    json = JSON.stringify(value);
  } catch {
    return true;
  }
  const prev = lastDispatched.get(key);
  const select = SLICE_SELECTORS[key];
  const currentRef = select ? select(store.getState()) : undefined;
  if (prev && prev.json === json && prev.ref === currentRef) return false;
  // Record the post-dispatch reference lazily (the dispatch happens right after this returns).
  queueMicrotask(() => {
    lastDispatched.set(key, { json, ref: select ? select(store.getState()) : undefined });
  });
  return true;
}

/**
 * Perform a single, fast, non-blocking sync with PostgreSQL using ETag + since cursor
 */
export async function runSync(options?: { full?: boolean; force?: boolean }): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isSyncing && !options?.force) return;

  const now = Date.now();
  const shouldFullSync = options?.full || now - lastFullSyncTime > 120000;
  const state = store.getState();
  const currentRole = state.ui.currentRole || 'customer';
  // Remove branchId='all' for customers and branch staff; only platform_owner uses 'all'
  const branchId =
    currentRole === 'platform_owner'
      ? 'all'
      : state.cafe.currentBranchId || 'gulberg-lahore';
  const hasLoadedOlder = state.orders.hasLoadedOlderOrders;
  const currentUser = state.ui.currentUser;

  // Filter customer orders by authenticated user ID, phone, or placed device order IDs
  let custIdParam = '';
  let custPhoneParam = '';
  let orderIdsParam = '';
  if (currentRole === 'customer') {
    if (currentUser && currentUser.id && currentUser.id !== 'user-guest') {
      custIdParam = `&customerId=${encodeURIComponent(currentUser.id)}`;
    } else if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_customer_user');
        if (saved) {
          const u = JSON.parse(saved);
          if (u.id && u.id !== 'user-guest') {
            custIdParam = `&customerId=${encodeURIComponent(u.id)}`;
          }
          if (u.phone) {
            custPhoneParam = `&customerPhone=${encodeURIComponent(u.phone)}`;
          }
        }
      } catch { }
    }
    if (currentUser?.phone && !custPhoneParam) {
      custPhoneParam = `&customerPhone=${encodeURIComponent(currentUser.phone)}`;
    }
    if (typeof window !== 'undefined') {
      try {
        const myIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
        if (Array.isArray(myIds) && myIds.length > 0) {
          orderIdsParam = `&orderIds=${encodeURIComponent(myIds.slice(0, 30).join(','))}`;
        }
      } catch { }
    }
  }

  isSyncing = true;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const scopeParam = shouldFullSync ? 'full' : 'live';
    const olderParam = hasLoadedOlder ? 'true' : 'false';
    const sinceParam = !options?.force && lastSyncCursor ? `&since=${encodeURIComponent(lastSyncCursor)}` : '';
    const url = `/api/sync?scope=${scopeParam}&role=${encodeURIComponent(currentRole)}&branchId=${encodeURIComponent(branchId)}&older=${olderParam}${custIdParam}${custPhoneParam}${orderIdsParam}${sinceParam}`;

    const headers = buildSyncHeaders({ 'Cache-Control': 'no-cache' });
    if (!options?.force && !shouldFullSync && lastEtag) {
      headers['If-None-Match'] = lastEtag;
    }

    const res = await fetch(url, {
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    if (res.status === 304) {
      consecutivePollErrors = 0;
      store.dispatch(setSyncTimestamps({ fast: true }));
      return;
    }

    if (res.ok) {
      consecutivePollErrors = 0;
      const etagHeader = res.headers.get('ETag');
      const data = await res.json();

      if (etagHeader || data.etag) {
        lastEtag = etagHeader || data.etag;
      }
      if (data.timestamp) {
        lastSyncCursor = data.timestamp;
      }

      if (Array.isArray(data.orders)) {
        const existingOrders = store.getState().orders.orders;
        const byId = new Map<string, Order>();
        const uniqueLocal = new Map<string, Order>();

        const registerLocalOrder = (ord: Order) => {
          if (!ord || !ord.id) return;
          if (
            String(ord.id).startsWith('ord-seed-') ||
            ['FC-6744', 'FC-7819', 'FC-8812', 'FC-9021'].includes(ord.orderNumber)
          ) {
            return;
          }
          const prev = byId.get(ord.id) || (ord.orderNumber ? byId.get(ord.orderNumber) : undefined);
          const merged = mergeSingleOrderMonotonically(prev, ord);
          byId.set(merged.id, merged);
          if (merged.orderNumber) byId.set(merged.orderNumber, merged);
          uniqueLocal.set(merged.id, merged);
        };

        existingOrders.forEach(registerLocalOrder);
        if (typeof window !== 'undefined') {
          try {
            const savedLive = localStorage.getItem('foodies_orders_live');
            if (savedLive) {
              const parsedLive = JSON.parse(savedLive);
              if (Array.isArray(parsedLive)) parsedLive.forEach(registerLocalOrder);
            }
          } catch { }
        }

        const serverByKey = new Map<string, Order>();
        data.orders.forEach((o: Order) => {
          if (o?.id) serverByKey.set(o.id, o);
          if (o?.orderNumber) serverByKey.set(o.orderNumber, o);
        });

        const sanitizedPayload: Order[] = data.orders.map((o: Order) => {
          const existing = byId.get(o.id) || (o.orderNumber ? byId.get(o.orderNumber) : undefined);
          return mergeSingleOrderMonotonically(existing, o);
        });

        // Reconcile any local orders missing from server response (e.g. cold Vercel instance or offline placement)
        const coveredKeys = new Set<string>();
        sanitizedPayload.forEach((o) => {
          if (o.id) coveredKeys.add(o.id);
          if (o.orderNumber) coveredKeys.add(o.orderNumber);
        });
        const finalOrders: Order[] = [...sanitizedPayload];
        uniqueLocal.forEach((localOrd) => {
          if (
            !coveredKeys.has(localOrd.id) &&
            (!localOrd.orderNumber || !coveredKeys.has(localOrd.orderNumber))
          ) {
            coveredKeys.add(localOrd.id);
            if (localOrd.orderNumber) coveredKeys.add(localOrd.orderNumber);
            finalOrders.push(localOrd);
          }
        });
        finalOrders.sort(
          (a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0)
        );
        let ordersChanged = true;
        try {
          ordersChanged = JSON.stringify(finalOrders) !== JSON.stringify(store.getState().orders.orders);
        } catch { }
        if (ordersChanged) store.dispatch(setOrders(finalOrders));

        // Background self-healing: push missing or out-of-date local order state to server instances
        const nowTs = Date.now();
        for (const [k, ts] of selfHealCooldown.entries()) {
          if (nowTs - ts > 60000) selfHealCooldown.delete(k);
        }
        let myOrderIdsSet = new Set<string>();
        if (currentRole === 'customer' && typeof window !== 'undefined') {
          try {
            const rawIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
            if (Array.isArray(rawIds)) myOrderIdsSet = new Set(rawIds.map(String));
          } catch { }
        }

        const normSyncBranch = normalizeBranchId(branchId);
        uniqueLocal.forEach((localOrd) => {
          const createdMs = new Date(localOrd.createdAt).getTime();
          if (isNaN(createdMs) || nowTs - createdMs > 12 * 60 * 60 * 1000 || nowTs - createdMs < 3500) {
            return;
          }
          const lastHeal = selfHealCooldown.get(localOrd.id) || 0;
          if (nowTs - lastHeal < 10000) return;

          if (currentRole !== 'customer') {
            if (branchId !== 'all' && normalizeBranchId(localOrd.branchId) !== normSyncBranch) {
              return;
            }
          } else {
            const isMine =
              (currentUser?.id && currentUser.id !== 'user-guest' && localOrd.customerId === currentUser.id) ||
              myOrderIdsSet.has(localOrd.id) ||
              (localOrd.orderNumber && myOrderIdsSet.has(localOrd.orderNumber));
            if (!isMine) return;
          }

          const serverOrd =
            serverByKey.get(localOrd.id) ||
            (localOrd.orderNumber ? serverByKey.get(localOrd.orderNumber) : undefined);

          if (!serverOrd) {
            if (data.orders.length < 200 || nowTs - createdMs < 30 * 60 * 1000) {
              selfHealCooldown.set(localOrd.id, nowTs);
              const idemKey = `idem-${localOrd.id}-${localOrd.orderNumber}`;
              fetch('/api/orders', {
                method: 'POST',
                headers: buildSyncHeaders({
                  'Content-Type': 'application/json',
                  'Idempotency-Key': idemKey,
                }),
                body: JSON.stringify({ ...localOrd, idempotencyKey: idemKey }),
              }).catch(() => { });
            }
            return;
          }

          if (currentRole !== 'customer') {
            const localRank = STATUS_RANK[localOrd.status as OrderStatus] || 0;
            const serverRank = STATUS_RANK[serverOrd.status as OrderStatus] || 0;
            const localPaid = localOrd.paymentStatus === 'paid' || Boolean(localOrd.paymentCollected);
            const serverPaid = serverOrd.paymentStatus === 'paid' || Boolean(serverOrd.paymentCollected);

            const needsStatusSync =
              localOrd.status === 'cancelled'
                ? serverOrd.status !== 'cancelled'
                : serverOrd.status !== 'cancelled' && localRank > serverRank;
            const needsPaymentSync = localPaid && !serverPaid && serverOrd.paymentStatus !== 'refunded';
            const needsKitchenSync = Boolean(localOrd.sentToKitchen) && !serverOrd.sentToKitchen;

            if (needsStatusSync || needsPaymentSync || needsKitchenSync) {
              selfHealCooldown.set(localOrd.id, nowTs);
              fetch('/api/orders', {
                method: 'PATCH',
                headers: buildSyncHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                  orderId: localOrd.id,
                  type: localOrd.type,
                  status: localOrd.status,
                  paymentStatus: localOrd.paymentStatus,
                  paymentCollected: localOrd.paymentCollected,
                  assignedWaiterId: localOrd.assignedWaiterId,
                  assignedWaiterName: localOrd.assignedWaiterName,
                  assignedRiderId: localOrd.assignedRiderId,
                  assignedRiderName: localOrd.assignedRiderName,
                  riderStatus: localOrd.riderStatus,
                  sentToKitchen: localOrd.sentToKitchen,
                  actorId: currentUser?.id,
                  actorName: currentUser?.name,
                  actorRole: currentRole,
                  orderSnapshot: localOrd,
                }),
              }).catch(() => { });
            }
          }
        });
      }
      if (Array.isArray(data.tables) && hasChanged('tables', data.tables)) {
        store.dispatch(setTables(data.tables));
      }
      if (Array.isArray(data.shifts) && currentRole !== 'customer' && hasChanged('shifts', data.shifts)) {
        store.dispatch(setShifts(data.shifts));
      }
      if (Array.isArray(data.refunds) && currentRole !== 'customer' && hasChanged('refunds', data.refunds)) {
        store.dispatch(setRefundRequests(data.refunds));
      }
      if (Array.isArray(data.sessions) && currentRole !== 'customer' && hasChanged('sessions', data.sessions)) {
        store.dispatch(setTableSessions(data.sessions));
      }
      if (Array.isArray(data.branches) && data.branches.length > 0 && hasChanged('branches', data.branches)) {
        store.dispatch(setBranches(data.branches));
      }
      if (Array.isArray(data.menuItems) && data.menuItems.length > 0 && hasChanged('menuItems', data.menuItems)) {
        store.dispatch(setMenuItems(data.menuItems));
      }
      if (Array.isArray(data.categories) && data.categories.length > 0 && hasChanged('categories', data.categories)) {
        store.dispatch(setCategories(data.categories));
      }
      if (data.footerSettings && hasChanged('footerSettings', data.footerSettings)) {
        store.dispatch(setFooterSettings(data.footerSettings));
      }
      if (Array.isArray(data.announcements) && hasChanged('announcements', data.announcements)) {
        store.dispatch(setAnnouncements(data.announcements));
      }
      if (Array.isArray(data.notifications) && hasChanged('notifications', data.notifications)) {
        store.dispatch(setNotifications(data.notifications));
      }
      if (data.notificationSettings && data.notificationSettings.events && hasChanged('notificationSettings', data.notificationSettings)) {
        store.dispatch(setNotificationSettings(data.notificationSettings));
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        if (hasChanged('users', data.users)) store.dispatch(setUsers(data.users));

        // Active Staff Session Revocation: Instant logout if suspended or deactivated
        const uiState = store.getState().ui;
        const currentStaffUser = uiState.currentUser;
        if (currentStaffUser && currentStaffUser.role !== 'customer') {
          const freshUser = data.users.find(
            (u: any) =>
              u.id === currentStaffUser.id ||
              (u.email && u.email.toLowerCase() === currentStaffUser.email?.toLowerCase())
          );
          if (freshUser && freshUser.status !== 'active' && currentStaffUser.role !== 'platform_owner') {
            const statusWord = freshUser.status.toUpperCase();
            store.dispatch(setCurrentRole('customer'));
            store.dispatch(
              setCurrentUser({
                id: 'user-guest',
                name: 'Guest Customer',
                phone: '',
                email: '',
                role: 'customer',
                status: 'active',
              })
            );
            if (typeof window !== 'undefined') {
              localStorage.removeItem('foodies_staff_user');
              localStorage.removeItem('foodies_staff_session');
              localStorage.setItem('foodies_staff_role', 'customer');
            }
            store.dispatch(
              addToast({
                type: 'error',
                title: `Account Access Revoked (${statusWord})`,
                message: `Your staff account has been ${statusWord} by management. Access has been immediately terminated.`,
              })
            );
          } else if (freshUser && freshUser.status === 'active' && currentStaffUser.role !== 'platform_owner') {
            if (
              freshUser.name !== currentStaffUser.name ||
              freshUser.role !== currentStaffUser.role ||
              freshUser.branchId !== currentStaffUser.branchId
            ) {
              store.dispatch(setCurrentUser({ ...currentStaffUser, ...freshUser }));
              if (freshUser.role !== currentStaffUser.role) {
                store.dispatch(setCurrentRole(freshUser.role));
              }
              if (typeof window !== 'undefined') {
                localStorage.setItem('foodies_staff_user', JSON.stringify({ ...currentStaffUser, ...freshUser }));
                localStorage.setItem('foodies_staff_role', freshUser.role);
              }
            }
          }
        }
      }

      if (shouldFullSync) {
        lastFullSyncTime = now;
        store.dispatch(setSyncTimestamps({ fast: true, full: true }));
      } else {
        store.dispatch(setSyncTimestamps({ fast: true }));
      }
    } else {
      consecutivePollErrors = Math.min(consecutivePollErrors + 1, 5);
    }
  } catch {
    consecutivePollErrors = Math.min(consecutivePollErrors + 1, 5);
  } finally {
    clearTimeout(timeoutId);
    isSyncing = false;
  }
}

/**
 * Initialize background synchronization engine (SSE primary + 25s exponential backoff polling fallback)
 */
export function initSyncEngine(): () => void {
  if (typeof window === 'undefined') return () => { };

  // 1. Initial immediate full sync
  runSync({ full: true });

  // 2. Setup BroadcastChannel for zero-latency multi-tab updates
  try {
    let remoteSyncDebounceTimer: any = null;
    broadcastChannel = new BroadcastChannel('foodies_realtime_bus');
    broadcastChannel.onmessage = (event) => {
      if (event?.data?.type === 'SYNC_BRANCHES' && Array.isArray(event.data.payload)) {
        store.dispatch(setBranches(event.data.payload));
      }
      if (event?.data?.type === 'STATE_MUTATION') {
        clearTimeout(remoteSyncDebounceTimer);
        remoteSyncDebounceTimer = setTimeout(() => {
          requestSync({ force: true });
        }, 250);
      }
    };
  } catch { }

  // 3. Setup Server-Sent Events (SSE) with Last-Event-ID replay & jittered exponential reconnect backoff
  let eventSource: EventSource | null = null;
  let sseReconnectTimer: any = null;
  let sseReconnectAttempt = 0;
  let isDisposed = false;
  let isSseConnected = false;

  const connectSse = () => {
    if (isDisposed || typeof EventSource === 'undefined') return;
    try {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      const state = store.getState();
      const role = state.ui.currentRole || 'customer';
      const branchId =
        role === 'platform_owner' ? 'all' : state.cafe.currentBranchId || 'gulberg-lahore';
      const customerId = state.ui.currentUser?.id || '';

      let sseUrl = `/api/realtime?role=${encodeURIComponent(role)}&branchId=${encodeURIComponent(branchId)}`;
      const sseToken =
        localStorage.getItem('foodies_staff_session') ||
        localStorage.getItem('foodies_customer_session');
      if (sseToken) {
        sseUrl += `&token=${encodeURIComponent(sseToken)}`;
      }
      if (customerId && customerId !== 'user-guest') {
        sseUrl += `&customerId=${encodeURIComponent(customerId)}`;
      }
      if (lastReceivedEventId) {
        sseUrl += `&lastEventId=${encodeURIComponent(lastReceivedEventId)}`;
      }

      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('connected', () => {
        sseReconnectAttempt = 0;
        isSseConnected = true;
      });

      const handleOrderEvent = (e: MessageEvent) => {
        if (e.lastEventId) lastReceivedEventId = e.lastEventId;
        try {
          const parsed = JSON.parse(e.data);
          if (parsed?.id) lastReceivedEventId = parsed.id;
          if (parsed?.data && parsed.data.id && parsed.data.orderNumber) {
            store.dispatch(upsertOrder(parsed.data));
          }
        } catch { }
        requestSync({ force: true });
      };

      const handleGenericEvent = (fullSync: boolean) => (e: MessageEvent) => {
        if (e.lastEventId) lastReceivedEventId = e.lastEventId;
        try {
          const parsed = JSON.parse(e.data);
          if (parsed?.id) lastReceivedEventId = parsed.id;
        } catch { }
        requestSync({ force: true, full: fullSync });
      };

      const handleBranchEvent = (e: MessageEvent) => {
        if (e.lastEventId) lastReceivedEventId = e.lastEventId;
        try {
          const parsed = JSON.parse(e.data);
          if (parsed?.id) lastReceivedEventId = parsed.id;
          const branchData = parsed?.data?.branch || (parsed?.data?.branchId ? parsed.data : null);
          if (branchData) {
            const currentBranches = store.getState().cafe.branches;
            const targetNorm = normalizeBranchId(branchData.branchId || branchData.id);
            const updated = currentBranches.map((b: any) =>
              b.id === branchData.id || b.id === branchData.branchId || normalizeBranchId(b.id) === targetNorm
                ? {
                  ...b,
                  ...branchData,
                  paymentSettings: branchData.paymentSettings || branchData.payment_settings || b.paymentSettings,
                  isOpen: branchData.isOpen ?? branchData.is_open ?? b.isOpen,
                  isBusy: branchData.isBusy ?? branchData.is_busy ?? b.isBusy,
                  deliveryEnabled: branchData.deliveryEnabled ?? branchData.delivery_enabled ?? b.deliveryEnabled,
                }
                : b
            );
            store.dispatch(setBranches(updated));
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('foodies_branches_live', JSON.stringify(updated));
              } catch { }
            }
          }
        } catch { }
        requestSync({ force: true, full: true });
      };

      const handleNotificationEvent = (e: MessageEvent) => {
        if (e.lastEventId) lastReceivedEventId = e.lastEventId;
        try {
          const parsed = JSON.parse(e.data);
          if (parsed?.id) lastReceivedEventId = parsed.id;
          if (parsed?.data && parsed.data.id && parsed.data.title) {
            store.dispatch(addNotificationInStore(parsed.data));
          }
        } catch { }
        requestSync({ force: true });
      };

      eventSource.addEventListener('ORDER_CREATED', handleOrderEvent as EventListener);
      eventSource.addEventListener('ORDER_UPDATED', handleOrderEvent as EventListener);
      eventSource.addEventListener('TABLE_UPDATED', handleGenericEvent(false) as EventListener);
      eventSource.addEventListener('SHIFT_UPDATED', handleGenericEvent(false) as EventListener);
      eventSource.addEventListener('MENU_UPDATED', handleGenericEvent(true) as EventListener);
      eventSource.addEventListener('USER_UPDATED', handleGenericEvent(true) as EventListener);
      eventSource.addEventListener('BRANCH_UPDATED', handleBranchEvent as EventListener);
      eventSource.addEventListener('NOTIFICATION_CREATED', handleNotificationEvent as EventListener);
      eventSource.addEventListener('NOTIFICATION_UPDATED', handleGenericEvent(false) as EventListener);
      eventSource.addEventListener('SYNC_TRIGGER', handleGenericEvent(true) as EventListener);

      eventSource.onerror = () => {
        isSseConnected = false;
        if (eventSource) {
          try {
            eventSource.close();
          } catch { }
          eventSource = null;
        }
        if (isDisposed) return;
        sseReconnectAttempt = Math.min(sseReconnectAttempt + 1, 6);
        const baseDelay = Math.min(1000 * Math.pow(2, sseReconnectAttempt), 30000);
        const jitter = Math.floor(Math.random() * 1500);
        if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
        sseReconnectTimer = setTimeout(connectSse, baseDelay + jitter);
      };
    } catch { }
  };

  connectSse();

  // 4. Fallback poll timer (15s when SSE connected; 3.5s with backoff if disconnected)
  const scheduleNextSync = () => {
    if (syncTimer) clearTimeout(syncTimer);
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    const effectiveBase = isSseConnected ? 15000 : 3500;
    const backoffFactor = Math.pow(2, consecutivePollErrors);
    const jitter = Math.floor(Math.random() * 1500);
    const nextDelay = Math.min(effectiveBase * backoffFactor + jitter, MAX_POLL_BACKOFF_MS);

    syncTimer = setTimeout(async () => {
      await runSync();
      scheduleNextSync();
    }, nextDelay);
  };

  scheduleNextSync();

  // 5. Handle visibility change (immediate sync on tab focus)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      requestSync({ force: true }, 50);
      scheduleNextSync();
    } else {
      if (syncTimer) clearTimeout(syncTimer);
    }
  };

  const handleFocus = () => {
    requestSync({ force: true }, 50);
  };

  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleFocus);

  return () => {
    isDisposed = true;
    if (syncTimer) clearTimeout(syncTimer);
    if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
    if (eventSource) {
      try {
        eventSource.close();
      } catch { }
    }
    if (broadcastChannel) {
      try {
        broadcastChannel.close();
      } catch { }
    }
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
  };
}

/**
 * Broadcast an event to all tabs so other instances update instantaneously
 */
export function broadcastStateMutation(action: string, payload?: any) {
  try {
    if (typeof window !== 'undefined') {
      const bc = new BroadcastChannel('foodies_realtime_bus');
      bc.postMessage({ type: 'STATE_MUTATION', action, payload, timestamp: Date.now() });
      bc.close();
    }
  } catch { }
}
