import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { Order, OrderStatus, OrderItem } from '@/types/cafe';

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
  } catch (e) {}
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
    localStorage.setItem('foodies_orders_live', JSON.stringify(orders));
  } catch (e) {}
};

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

      // Create lookup map of incoming orders by id and orderNumber
      const incomingMap = new Map<string, Order>();
      incoming.forEach((o) => {
        if (o.id) incomingMap.set(o.id, o);
        if (o.orderNumber) incomingMap.set(o.orderNumber, o);
      });

      // Preserve existing orders that aren't in the incoming payload (e.g. from other branches or locally active)
      const merged: Order[] = [...incoming];

      for (const existing of state.orders) {
        if (!incomingMap.has(existing.id) && !incomingMap.has(existing.orderNumber)) {
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
      const ord = action.payload;
      const idx = state.orders.findIndex((o) => o.id === ord.id);
      if (idx >= 0) {
        state.orders[idx] = { ...state.orders[idx], ...ord };
      } else {
        state.orders.unshift(ord);
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
        riderStatus?: 'assigned' | 'picked_up' | 'en_route' | 'delivered';
        assignedWaiterId?: string;
        assignedWaiterName?: string;
      }>
    ) => {
      const { orderId, newStatus, ...extras } = action.payload;
      const idx = state.orders.findIndex((o) => o.id === orderId);
      if (idx >= 0) {
        const current = state.orders[idx];
        state.orders[idx] = {
          ...current,
          status: newStatus,
          ...extras,
          completedAt: newStatus === 'completed' ? new Date().toISOString() : current.completedAt,
        };
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
