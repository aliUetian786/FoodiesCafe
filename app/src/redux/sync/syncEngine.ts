import { store } from '../store';
import { setOrders } from '../slices/ordersSlice';
import {
  setTables,
  setShifts,
  setRefundRequests,
  setComplaints,
  setTableSessions,
  setBranches,
  setMenuItems,
  setCategories,
  setFooterSettings,
  setUsers,
  setSyncTimestamps,
} from '../slices/cafeSlice';

let isSyncing = false;
let syncTimer: any = null;
let broadcastChannel: BroadcastChannel | null = null;
let lastFullSyncTime = 0;

/**
 * Perform a single, fast, non-blocking sync with PostgreSQL
 */
export async function runSync(options?: { full?: boolean; force?: boolean }): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isSyncing && !options?.force) return;

  const now = Date.now();
  const shouldFullSync = options?.full || (now - lastFullSyncTime > 60000); // full sync every 60s
  const state = store.getState();
  const branchId = state.cafe.currentBranchId;
  const hasLoadedOlder = state.orders.hasLoadedOlderOrders;
  const currentUser = state.ui.currentUser;

  // Retrieve customer identifiers so all orders across branches stay synced to customer account
  let phoneParam = '';
  let custIdParam = '';
  let emailParam = '';
  if (currentUser) {
    if (currentUser.phone) phoneParam = `&customerPhone=${encodeURIComponent(currentUser.phone)}`;
    if (currentUser.id && currentUser.id !== 'user-guest') custIdParam = `&customerId=${encodeURIComponent(currentUser.id)}`;
    if (currentUser.email) emailParam = `&customerEmail=${encodeURIComponent(currentUser.email)}`;
  } else if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('foodies_customer_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u.phone) phoneParam = `&customerPhone=${encodeURIComponent(u.phone)}`;
        if (u.id && u.id !== 'user-guest') custIdParam = `&customerId=${encodeURIComponent(u.id)}`;
        if (u.email) emailParam = `&customerEmail=${encodeURIComponent(u.email)}`;
      }
    } catch (e) {}
  }

  isSyncing = true;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const scopeParam = shouldFullSync ? 'full' : 'live';
    const olderParam = hasLoadedOlder ? 'true' : 'false';
    const url = `/api/sync?scope=${scopeParam}&branchId=${encodeURIComponent(branchId)}&older=${olderParam}${phoneParam}${custIdParam}${emailParam}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();

      // Dispatch dynamic updates
      if (Array.isArray(data.orders)) {
        store.dispatch(setOrders(data.orders));
      }
      if (Array.isArray(data.tables)) {
        store.dispatch(setTables(data.tables));
      }
      if (Array.isArray(data.shifts)) {
        store.dispatch(setShifts(data.shifts));
      }
      if (Array.isArray(data.refunds)) {
        store.dispatch(setRefundRequests(data.refunds));
      }
      if (Array.isArray(data.complaints)) {
        store.dispatch(setComplaints(data.complaints));
      }
      if (Array.isArray(data.sessions)) {
        store.dispatch(setTableSessions(data.sessions));
      }
      if (Array.isArray(data.branches) && data.branches.length > 0) {
        store.dispatch(setBranches(data.branches));
      }

      // Dispatch static updates if full sync
      if (shouldFullSync) {
        lastFullSyncTime = now;
        if (Array.isArray(data.menuItems) && data.menuItems.length > 0) {
          store.dispatch(setMenuItems(data.menuItems));
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          store.dispatch(setCategories(data.categories));
        }
        if (data.footerSettings) {
          store.dispatch(setFooterSettings(data.footerSettings));
        }
        if (Array.isArray(data.users) && data.users.length > 0) {
          store.dispatch(setUsers(data.users));
        }
        store.dispatch(setSyncTimestamps({ fast: true, full: true }));
      } else {
        store.dispatch(setSyncTimestamps({ fast: true }));
      }
    }
  } catch (err: any) {
    // Graceful swallow of aborted/network errors
  } finally {
    clearTimeout(timeoutId);
    isSyncing = false;
  }
}

/**
 * Initialize background synchronization engine
 */
export function initSyncEngine(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Initial immediate full sync
  runSync({ full: true });

  // 2. Setup BroadcastChannel for zero-latency multi-tab updates
  try {
    broadcastChannel = new BroadcastChannel('foodies_realtime_bus');
    broadcastChannel.onmessage = (event) => {
      if (event?.data?.type === 'STATE_MUTATION') {
        // Run quick light sync immediately on remote mutation
        runSync({ force: true });
      }
    };
  } catch (e) {}

  // 3. Setup recurring poll timer (3.5s for fast live data, never overlapping)
  const scheduleNextSync = () => {
    if (syncTimer) clearTimeout(syncTimer);

    // Pause syncing when document is hidden to conserve resources and avoid traffic congestion
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    syncTimer = setTimeout(async () => {
      await runSync();
      scheduleNextSync();
    }, 3500);
  };

  scheduleNextSync();

  // 4. Handle visibility change (immediate sync on tab focus)
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
    if (syncTimer) clearTimeout(syncTimer);
    if (broadcastChannel) {
      try {
        broadcastChannel.close();
      } catch (e) {}
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
  } catch (e) {}
}

