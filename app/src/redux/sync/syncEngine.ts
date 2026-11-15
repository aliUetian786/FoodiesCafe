import { store } from '../store';
import { setOrders, upsertOrder } from '../slices/ordersSlice';
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
import { normalizeBranchId, STATUS_RANK, OrderStatus } from '@/types/cafe';

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

    const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
    const sessionToken =
      localStorage.getItem('foodies_staff_session') ||
      localStorage.getItem('foodies_customer_session');
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
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
        const byId = new Map<string, any>();
        existingOrders.forEach((o: any) => {
          if (o.id) byId.set(o.id, o);
          if (o.orderNumber) byId.set(o.orderNumber, o);
        });

        const sanitizeOrder = (o: any) => {
          const existing = byId.get(o.id) || (o.orderNumber ? byId.get(o.orderNumber) : undefined);
          const isLocallyPaid = existing ? (existing.paymentStatus === 'paid' || existing.paymentCollected === true) : Boolean(o.paymentStatus === 'paid' || o.paymentCollected === true);
          const isPaid = isLocallyPaid || o.paymentStatus === 'paid' || Boolean(o.paymentCollected);
          const existingStatus = existing?.status as string | undefined;
          const oStatus = o.status as string;

          const isDeliveryFinished =
            (o.type === 'delivery' || existing?.type === 'delivery') &&
            isPaid &&
            (oStatus === 'delivered' || oStatus === 'completed' || existingStatus === 'completed' || o.riderStatus === 'delivered' || existing?.riderStatus === 'delivered');

          const isDineInFinished =
            (o.type === 'dine_in' || existing?.type === 'dine_in') &&
            isPaid &&
            (oStatus === 'served' || oStatus === 'completed' || existingStatus === 'served' || existingStatus === 'completed');

          const isTakeawayFinished =
            (o.type === 'takeaway' || existing?.type === 'takeaway') &&
            isPaid &&
            (oStatus === 'taken' || oStatus === 'completed' || existingStatus === 'taken' || existingStatus === 'completed');

          const isOrderFinished =
            oStatus === 'completed' ||
            existingStatus === 'completed' ||
            isDeliveryFinished ||
            isDineInFinished ||
            isTakeawayFinished;

          if (!existing) {
            return isOrderFinished
              ? {
                ...o,
                status: 'completed',
                riderStatus: o.type === 'delivery' ? 'delivered' : o.riderStatus,
                paymentStatus: 'paid',
                paymentCollected: true,
                completedAt: o.completedAt || new Date().toISOString(),
                deliveredAt: o.deliveredAt || new Date().toISOString(),
              }
              : o;
          }

          const existingRank = existing ? (STATUS_RANK[existing.status as OrderStatus] || 0) : 0;
          const incomingRank = STATUS_RANK[o.status as OrderStatus] || 0;
          const preserveStatus =
            existing &&
            existing.status !== 'cancelled' &&
            o.status !== 'cancelled' &&
            existingRank > incomingRank;
          const resolvedStatus = isOrderFinished ? 'completed' : preserveStatus ? existing.status : o.status;
          const resolvedSentToKitchen = existing ? (existing.sentToKitchen || o.sentToKitchen) : o.sentToKitchen;

          return {
            ...o,
            status: resolvedStatus,
            sentToKitchen: resolvedSentToKitchen,
            sentToKitchenAt: o.sentToKitchenAt || existing.sentToKitchenAt,
            preparationStartedAt: o.preparationStartedAt || existing.preparationStartedAt,
            riderStatus: isOrderFinished && o.type === 'delivery' ? 'delivered' : (o.riderStatus || existing.riderStatus),
            paymentStatus: (isOrderFinished || isLocallyPaid) && o.paymentStatus !== 'refunded' ? 'paid' : o.paymentStatus,
            paymentCollected: isOrderFinished || isLocallyPaid || o.paymentCollected || o.paymentStatus === 'paid',
            completedAt: isOrderFinished ? (o.completedAt || existing.completedAt || new Date().toISOString()) : (o.completedAt || existing.completedAt),
            deliveredAt: isOrderFinished ? (o.deliveredAt || existing.deliveredAt || new Date().toISOString()) : (o.deliveredAt || existing.deliveredAt),
            cashierId: existing.cashierId || o.cashierId,
            cashierName: existing.cashierName || o.cashierName,
            shiftId: existing.shiftId || o.shiftId,
            assignedWaiterId: existing.assignedWaiterId || o.assignedWaiterId,
            assignedWaiterName: existing.assignedWaiterName || o.assignedWaiterName,
          };
        };

        const sanitizedPayload = data.orders.map(sanitizeOrder);

        // For customers, merge with any locally placed guest orders stored in localStorage
        if (currentRole === 'customer' && typeof window !== 'undefined') {
          try {
            const customerMap = new Map<string, any>();
            existingOrders.forEach((o: any) => customerMap.set(o.id, o));
            sanitizedPayload.forEach((o: any) => {
              const existing = customerMap.get(o.id);
              if (existing) {
                const existingRank = STATUS_RANK[existing.status as OrderStatus] || 0;
                const incomingRank = STATUS_RANK[o.status as OrderStatus] || 0;
                const preserveLocal =
                  existing.status !== 'cancelled' &&
                  o.status !== 'cancelled' &&
                  existingRank > incomingRank;
                customerMap.set(o.id, {
                  ...o,
                  status: preserveLocal ? existing.status : o.status,
                  sentToKitchen: existing.sentToKitchen || o.sentToKitchen,
                  sentToKitchenAt: o.sentToKitchenAt || existing.sentToKitchenAt,
                  preparationStartedAt: o.preparationStartedAt || existing.preparationStartedAt,
                  completedAt: o.completedAt || existing.completedAt,
                });
              } else {
                customerMap.set(o.id, o);
              }
            });
            store.dispatch(
              setOrders(
                Array.from(customerMap.values()).sort(
                  (a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0)
                )
              )
            );
          } catch {
            store.dispatch(setOrders(sanitizedPayload));
          }
        } else {
          store.dispatch(setOrders(sanitizedPayload));
        }
      }
      if (Array.isArray(data.tables)) {
        store.dispatch(setTables(data.tables));
      }
      if (Array.isArray(data.shifts) && currentRole !== 'customer') {
        store.dispatch(setShifts(data.shifts));
      }
      if (Array.isArray(data.refunds) && currentRole !== 'customer') {
        store.dispatch(setRefundRequests(data.refunds));
      }
      if (Array.isArray(data.sessions) && currentRole !== 'customer') {
        store.dispatch(setTableSessions(data.sessions));
      }
      if (Array.isArray(data.branches) && data.branches.length > 0) {
        store.dispatch(setBranches(data.branches));
      }
      if (Array.isArray(data.menuItems) && data.menuItems.length > 0) {
        store.dispatch(setMenuItems(data.menuItems));
      }
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        store.dispatch(setCategories(data.categories));
      }
      if (data.footerSettings) {
        store.dispatch(setFooterSettings(data.footerSettings));
      }
      if (Array.isArray(data.announcements)) {
        store.dispatch(setAnnouncements(data.announcements));
      }
      if (Array.isArray(data.notifications)) {
        store.dispatch(setNotifications(data.notifications));
      }
      if (data.notificationSettings && data.notificationSettings.events) {
        store.dispatch(setNotificationSettings(data.notificationSettings));
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        store.dispatch(setUsers(data.users));

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
          runSync({ force: true });
        }, 400);
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
        runSync({ force: true });
      };

      const handleGenericEvent = (fullSync: boolean) => (e: MessageEvent) => {
        if (e.lastEventId) lastReceivedEventId = e.lastEventId;
        try {
          const parsed = JSON.parse(e.data);
          if (parsed?.id) lastReceivedEventId = parsed.id;
        } catch { }
        runSync({ force: true, full: fullSync });
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
        runSync({ force: true, full: true });
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
        runSync({ force: true });
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
      runSync({ force: true });
      scheduleNextSync();
    } else {
      if (syncTimer) clearTimeout(syncTimer);
    }
  };

  const handleFocus = () => {
    runSync({ force: true });
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
