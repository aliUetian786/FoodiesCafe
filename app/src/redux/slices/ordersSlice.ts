import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Order, OrderStatus, OrderItem, PaymentStatus, STATUS_RANK } from '@/types/cafe';

export interface OrdersState {
  orders: Order[];
  hasLoadedOlderOrders: boolean;
  isFetchingOlderOrders: boolean;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  lastSynced: string | null;
}

const getInitialOrders = (): Order[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('foodies_orders_live');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (o: any) =>
            !String(o.id).startsWith('ord-seed-') &&
            !['FC-6744', 'FC-7819', 'FC-8812', 'FC-9021'].includes(o.orderNumber)
        );
      }
    }
  } catch (e) { }
  return [];
};

const initialState: OrdersState = {
  orders: getInitialOrders(),
  hasLoadedOlderOrders: false,
  isFetchingOlderOrders: false,
  status: 'idle',
  lastSynced: null,
};

const persistOrders = (orders: Order[]) => {
  if (typeof window === 'undefined') return;
  try {
    const nextJson = JSON.stringify(orders);
    if (localStorage.getItem('foodies_orders_live') !== nextJson) {
      localStorage.setItem('foodies_orders_live', nextJson);
    }
  } catch (e) { }
};

export function mergeSingleOrderMonotonically(existing: Order | undefined, inc: Order): Order {
  const isLocallyPaid = existing
    ? existing.paymentStatus === 'paid' || existing.paymentCollected === true
    : false;
  const isPaid = isLocallyPaid || inc.paymentStatus === 'paid' || Boolean(inc.paymentCollected);
  const incStatus = inc.status as string;
  const existingStatus = existing?.status as string | undefined;
  const orderType = inc.type || existing?.type;
  // Rider status only moves forward for the SAME rider (a stale poll must not turn
  // 'accepted' back into 'assigned'). A different rider id means a real reassignment.
  const RIDER_STATUS_RANK: Record<string, number> = {
    assigned: 1, accepted: 2, picked_up: 3, en_route: 3, on_trip: 3, delivered: 4,
  };
  const sameRider =
    Boolean(existing?.assignedRiderId) &&
    (!inc.assignedRiderId || inc.assignedRiderId === existing?.assignedRiderId);
  const keepExistingRiderStatus =
    sameRider &&
    (RIDER_STATUS_RANK[String(existing?.riderStatus || '')] || 0) >
      (RIDER_STATUS_RANK[String(inc.riderStatus || '')] || 0);
  const resolvedRiderStatus = (
    keepExistingRiderStatus ? existing?.riderStatus : inc.riderStatus || existing?.riderStatus
  ) as Order['riderStatus'];

  const isAnyCancelled = existingStatus === 'cancelled' || incStatus === 'cancelled';

  const isDeliveryFinished =
    orderType === 'delivery' &&
    isPaid &&
    (incStatus === 'delivered' ||
      incStatus === 'completed' ||
      existingStatus === 'delivered' ||
      existingStatus === 'completed' ||
      resolvedRiderStatus === 'delivered');

  const isDineInFinished =
    orderType === 'dine_in' &&
    isPaid &&
    (incStatus === 'served' ||
      incStatus === 'completed' ||
      existingStatus === 'served' ||
      existingStatus === 'completed');

  const isTakeawayFinished =
    orderType === 'takeaway' &&
    isPaid &&
    (incStatus === 'taken' ||
      incStatus === 'completed' ||
      existingStatus === 'taken' ||
      existingStatus === 'completed');

  const isOrderFinished =
    !isAnyCancelled &&
    (incStatus === 'completed' ||
      existingStatus === 'completed' ||
      isDeliveryFinished ||
      isDineInFinished ||
      isTakeawayFinished);

  if (!existing) {
    if (!isOrderFinished) return inc;
    return {
      ...inc,
      status: 'completed',
      riderStatus: orderType === 'delivery' ? 'delivered' : inc.riderStatus,
      paymentStatus: inc.paymentStatus === 'refunded' ? 'refunded' : 'paid',
      paymentCollected: true,
      completedAt: inc.completedAt || new Date().toISOString(),
      deliveredAt: inc.deliveredAt || new Date().toISOString(),
    };
  }

  const existingRank = STATUS_RANK[existing.status] || 0;
  const incomingRank = STATUS_RANK[inc.status] || 0;
  const preserveLocalStatus =
    existing.status !== 'cancelled' &&
    inc.status !== 'cancelled' &&
    existingRank > incomingRank;

  const resolvedStatus = isAnyCancelled
    ? 'cancelled'
    : isOrderFinished
      ? 'completed'
      : preserveLocalStatus
        ? existing.status
        : inc.status;

  const resolvedPaymentStatus: PaymentStatus =
    (isOrderFinished || isLocallyPaid) && inc.paymentStatus !== 'refunded'
      ? 'paid'
      : inc.paymentStatus || existing.paymentStatus;

  const resolvedPaymentCollected = Boolean(
    isOrderFinished || isLocallyPaid || existing.paymentCollected || inc.paymentCollected
  );

  const resolvedSentToKitchen = Boolean(existing.sentToKitchen || inc.sentToKitchen);

  return {
    ...existing,
    ...inc,
    items: Array.isArray(inc.items) && inc.items.length > 0 ? inc.items : existing.items,
    tableNumber: inc.tableNumber || existing.tableNumber,
    tablePin: inc.tablePin || existing.tablePin,
    customerCoordinates: inc.customerCoordinates || existing.customerCoordinates,
    notes: inc.notes ?? existing.notes,
    status: resolvedStatus,
    paymentStatus: resolvedPaymentStatus,
    paymentCollected: resolvedPaymentCollected,
    cashierId: inc.cashierId || existing.cashierId,
    cashierName: inc.cashierName || existing.cashierName,
    shiftId: inc.shiftId || existing.shiftId,
    assignedWaiterId: inc.assignedWaiterId || existing.assignedWaiterId,
    assignedWaiterName: inc.assignedWaiterName || existing.assignedWaiterName,
    sentToKitchen: resolvedSentToKitchen,
    sentToKitchenAt: inc.sentToKitchenAt || existing.sentToKitchenAt,
    forwardToKitchenAt: resolvedSentToKitchen ? undefined : (inc.forwardToKitchenAt || existing.forwardToKitchenAt),
    preparationStartedAt: inc.preparationStartedAt || existing.preparationStartedAt,
    completedAt: isOrderFinished
      ? inc.completedAt || existing.completedAt || new Date().toISOString()
      : inc.completedAt || existing.completedAt,
    deliveredAt: isOrderFinished
      ? inc.deliveredAt || existing.deliveredAt || new Date().toISOString()
      : inc.deliveredAt || existing.deliveredAt,
    assignedRiderId: inc.assignedRiderId || existing.assignedRiderId,
    assignedRiderName: inc.assignedRiderName || existing.assignedRiderName,
    riderStatus: isOrderFinished && orderType === 'delivery' ? 'delivered' : resolvedRiderStatus,
  } as Order;
}

export const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrders: (state, action: PayloadAction<Order[]>) => {
      const incoming = action.payload.filter(
        (o) =>
          !String(o.id).startsWith('ord-seed-') &&
          !['FC-6744', 'FC-7819', 'FC-8812', 'FC-9021'].includes(o.orderNumber)
      );

      // Create lookup map of existing orders by id and orderNumber
      const existingMap = new Map<string, Order>();
      for (const ord of state.orders) {
        if (ord.id) existingMap.set(ord.id, ord);
        if (ord.orderNumber) existingMap.set(ord.orderNumber, ord);
      }

      // Also check localStorage so recent updates from other tabs are never lost on poll
      if (typeof window !== 'undefined') {
        try {
          const saved = localStorage.getItem('foodies_orders_live');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              for (const ord of parsed) {
                if (!ord || !ord.id) continue;
                const prev = existingMap.get(ord.id) || (ord.orderNumber ? existingMap.get(ord.orderNumber) : undefined);
                const merged = mergeSingleOrderMonotonically(prev, ord);
                existingMap.set(merged.id, merged);
                if (merged.orderNumber) existingMap.set(merged.orderNumber, merged);
              }
            }
          }
        } catch { }
      }

      // Merge incoming orders monotonically without allowing status or payment downgrades
      const handledKeys = new Set<string>();
      const mergedIncoming = incoming.map((inc) => {
        const existing = existingMap.get(inc.id) || (inc.orderNumber ? existingMap.get(inc.orderNumber) : undefined);
        const result = mergeSingleOrderMonotonically(existing, inc);
        if (result.id) handledKeys.add(result.id);
        if (result.orderNumber) handledKeys.add(result.orderNumber);
        if (existing?.id) handledKeys.add(existing.id);
        if (existing?.orderNumber) handledKeys.add(existing.orderNumber);
        return result;
      });

      const merged: Order[] = [...mergedIncoming];

      // Preserve existing orders that aren't in the incoming payload (e.g. from other branches or locally active)
      for (const existing of state.orders) {
        if (!handledKeys.has(existing.id) && (!existing.orderNumber || !handledKeys.has(existing.orderNumber))) {
          handledKeys.add(existing.id);
          if (existing.orderNumber) handledKeys.add(existing.orderNumber);
          merged.push(existing);
        }
      }

      // Keep orders sorted newest first
      merged.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });

      state.orders = merged;
      state.lastSynced = new Date().toISOString();
      persistOrders(merged);
    },
    upsertOrder: (state, action: PayloadAction<Order>) => {
      const incomingOrd = action.payload;
      const idx = state.orders.findIndex(
        (o) => o.id === incomingOrd.id || (incomingOrd.orderNumber && o.orderNumber === incomingOrd.orderNumber)
      );
      if (idx >= 0) {
        state.orders[idx] = mergeSingleOrderMonotonically(state.orders[idx], incomingOrd);
      } else {
        state.orders.unshift(mergeSingleOrderMonotonically(undefined, incomingOrd));
      }
      persistOrders(state.orders);
    },
    updateOrderStatusInStore: (
      state,
      action: PayloadAction<{
        orderId: string;
        newStatus: OrderStatus;
        reason?: string;
        sentToKitchen?: boolean;
        deliveredAt?: string;
        paymentCollected?: boolean;
        assignedRiderId?: string;
        assignedRiderName?: string;
        riderStatus?: 'assigned' | 'accepted' | 'picked_up' | 'en_route' | 'delivered';
        assignedWaiterId?: string;
        assignedWaiterName?: string;
      }>
    ) => {
      const { orderId, newStatus, ...extras } = action.payload;
      const idx = state.orders.findIndex((o) => o.id === orderId || o.orderNumber === orderId);
      if (idx >= 0) {
        const current = state.orders[idx];
        state.orders[idx] = mergeSingleOrderMonotonically(current, {
          ...current,
          ...extras,
          status: newStatus,
          completedAt: newStatus === 'completed' ? new Date().toISOString() : current.completedAt,
        });
        persistOrders(state.orders);
      }
    },
    editOrderItemsInStore: (
      state,
      action: PayloadAction<{
        orderId: string;
        items: OrderItem[];
        isStage1?: boolean;
        subtotal?: number;
        total?: number;
      }>
    ) => {
      const { orderId, items, isStage1, subtotal, total } = action.payload;
      const idx = state.orders.findIndex((o) => o.id === orderId);
      if (idx >= 0) {
        const current = state.orders[idx];
        const newTotal = total ?? items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (i.quantity || 1), 0);
        state.orders[idx] = {
          ...current,
          items,
          originalSubtotal: isStage1 ? (subtotal ?? newTotal) : current.originalSubtotal,
          total: newTotal,
          version: (current.version || 1) + 1,
        };
        persistOrders(state.orders);
      }
    },
    setHasLoadedOlderOrders: (state, action: PayloadAction<boolean>) => {
      state.hasLoadedOlderOrders = action.payload;
    },
    setIsFetchingOlderOrders: (state, action: PayloadAction<boolean>) => {
      state.isFetchingOlderOrders = action.payload;
    },
    filterOrdersToToday: (state) => {
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      state.orders = state.orders.filter((o) => {
        const createdMs = new Date(o.createdAt).getTime();
        return (
          createdMs >= oneDayAgo ||
          ['placed', 'accepted', 'preparing', 'ready', 'served', 'out_for_delivery'].includes(o.status)
        );
      });
      state.hasLoadedOlderOrders = false;
      persistOrders(state.orders);
    },
  },
});

export const {
  setOrders,
  upsertOrder,
  updateOrderStatusInStore,
  editOrderItemsInStore,
  setHasLoadedOlderOrders,
  setIsFetchingOlderOrders,
  filterOrdersToToday,
} = ordersSlice.actions;

// Selectors
export const selectAllOrders = (state: { orders: OrdersState }) => state.orders.orders;
export const selectHasLoadedOlderOrders = (state: { orders: OrdersState }) => state.orders.hasLoadedOlderOrders;
export const selectIsFetchingOlderOrders = (state: { orders: OrdersState }) => state.orders.isFetchingOlderOrders;

export const selectActiveOrders = createSelector([selectAllOrders], (orders) =>
  orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
);

export const selectTodayOrders = createSelector([selectAllOrders], (orders) => {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return orders.filter((o) => {
    const createdMs = new Date(o.createdAt).getTime();
    return (
      createdMs >= oneDayAgo ||
      ['placed', 'accepted', 'preparing', 'ready', 'served', 'out_for_delivery'].includes(o.status)
    );
  });
});

export const selectOrdersByBranch = (branchId: string) =>
  createSelector([selectAllOrders], (orders) =>
    branchId === 'all' ? orders : orders.filter((o) => o.branchId === branchId)
  );

export const selectOrderById = (orderId: string) =>
  createSelector([selectAllOrders], (orders) => orders.find((o) => o.id === orderId));

export default ordersSlice.reducer;
