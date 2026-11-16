'use client';

// Must stay the first import: purges stale cached data before anything reads localStorage.
import '@/lib/storageVersion';
import { orderNotificationId } from '@/lib/notificationIds';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  Role,
  User,
  Branch,
  MenuItem,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Table,
  TableStatus,
  CashShift,
  RefundRequest,
  TableSession,
  AuditLog,
  FooterSettings,
  HeroBanner,
  DealCard,
  BannerDealApprovalRequest,
  BranchPaymentSettings,
  PaymentMode,
  OrderTypePaymentSettings,
  ManagerAccessRequest,
  Announcement,
  AppNotification,
  NotificationCategory,
  NotificationTargetPlatform,
  NotificationEventKey,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  RecipientNotificationRules,
  DEFAULT_RECIPIENT_NOTIFICATION_RULES,
  ReceiverNotificationPreferences,
  DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES,
  OrderType,
  normalizeBranchId,
  STATUS_RANK,
} from '@/types/cafe';

import { store } from '@/redux/store';
import {
  setOrders as setReduxOrders,
  upsertOrder as upsertReduxOrder,
  updateOrderStatusInStore as updateReduxOrderStatus,
  filterOrdersToToday as filterReduxOrdersToToday,
  mergeSingleOrderMonotonically,
} from '@/redux/slices/ordersSlice';
import {
  setCart as setReduxCart,
  addToCart as addReduxCart,
  updateCartItemQty as updateReduxCartQty,
  removeFromCart as removeReduxCart,
  clearCart as clearReduxCart,
} from '@/redux/slices/cartSlice';
import {
  setBranches as setReduxBranches,
  setCurrentBranchId as setReduxBranchId,
  setMenuItems as setReduxMenuItems,
  setCategories as setReduxCategories,
  setTables as setReduxTables,
  setShifts as setReduxShifts,
  setRefundRequests as setReduxRefundRequests,
  setTableSessions as setReduxTableSessions,
  setUsers as setReduxUsers,
  setHeroBanners as setReduxHeroBanners,
  setDealCard as setReduxDealCard,
  setFooterSettings as setReduxFooterSettings,
  updateTableStatusInStore as updateReduxTableStatus,
  setAnnouncements as setReduxAnnouncements,
  addAnnouncementInStore as addReduxAnnouncement,
  deleteAnnouncementFromStore as deleteReduxAnnouncement,
  setNotifications as setReduxNotifications,
  addNotificationInStore as addReduxNotification,
  markNotificationReadInStore as markReduxNotificationRead,
  clearNotificationsInStore as clearReduxNotifications,
  setNotificationSettings as setReduxNotificationSettings,
} from '@/redux/slices/cafeSlice';
import {
  setCurrentRole as setReduxRole,
  setCurrentUser as setReduxUser,
  addToast as addReduxToast,
  removeToast as removeReduxToast,
  setMenuSearchQuery as setReduxSearchQuery,
} from '@/redux/slices/uiSlice';
import { runSync, broadcastStateMutation } from '@/redux/sync/syncEngine';
import { INITIAL_MENU, INITIAL_CATEGORIES } from '@/database/embeddedSeed';
import {
  reverseGeocodeOpenStreetMap,
  calculateHaversineKm,
} from '@/utils/openStreetMap';

/**
 * Calculates the lowest/minimum price available for an item across basePrice and all branch overrides
 */
export function getItemMinPrice(item: MenuItem): number {
  const prices: number[] = [];
  const base = Number(item.basePrice);
  if (!isNaN(base) && base > 0) {
    prices.push(base);
  }
  if (item.branchPriceOverrides && typeof item.branchPriceOverrides === 'object') {
    Object.values(item.branchPriceOverrides).forEach((p) => {
      const num = Number(p);
      if (!isNaN(num) && num > 0) {
        prices.push(num);
      }
    });
  }
  return prices.length > 0 ? Math.min(...prices) : (Number(item.basePrice) || 0);
}

/**
 * Calculates the effective price for an item:
 * - If a branch is selected: returns that branch's override or basePrice
 * - If no branch is selected: returns the minimum price among all branches
 */
export function getItemEffectivePrice(item: MenuItem, branchId?: string | null): number {
  if (branchId && item.branchPriceOverrides && typeof item.branchPriceOverrides === 'object') {
    const override = item.branchPriceOverrides[branchId];
    if (override !== undefined && override !== null && !isNaN(Number(override)) && Number(override) > 0) {
      return Number(override);
    }
  }
  return Number(item.basePrice) || 0;
}

export function isOrderDayEnded(createdAtStr?: string): boolean {
  if (!createdAtStr) return false;
  const d = new Date(createdAtStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  const isPastDay =
    d.getFullYear() < now.getFullYear() ||
    (d.getFullYear() === now.getFullYear() && d.getMonth() < now.getMonth()) ||
    (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() < now.getDate());
  const isOlder24h = now.getTime() - d.getTime() > 24 * 60 * 60 * 1000;
  return isPastDay || isOlder24h;
}

type InFlightOrderEntry = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentCollected?: boolean;
  sentToKitchen?: boolean;
  assignedRiderId?: string;
  assignedRiderName?: string;
  riderStatus?: 'assigned' | 'accepted' | 'picked_up' | 'en_route' | 'delivered';
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  timestamp: number;
};

function mergeOrderListsMonotonically(
  prev: Order[],
  incoming: Order[],
  inFlightMap?: Map<string, InFlightOrderEntry>,
  preserveMissingFromPrev: boolean = true
): Order[] {
  const now = Date.now();
  const prevByKey = new Map<string, Order>();
  prev.forEach((o) => {
    if (o.id) prevByKey.set(o.id, o);
    if (o.orderNumber) prevByKey.set(o.orderNumber, o);
  });

  const applyInFlightOverlay = (
    base: Order | undefined,
    fallback: Order | undefined,
    keyId: string,
    keyNum?: string
  ): Order | undefined => {
    const seed = base || fallback;
    if (!inFlightMap || !seed) return base;
    const inFlight = inFlightMap.get(keyId) || (keyNum ? inFlightMap.get(keyNum) : undefined);
    if (!inFlight || now - inFlight.timestamp >= 20000) return base;
    const inFlightPatch: Order = {
      ...seed,
      ...(inFlight.status ? { status: inFlight.status } : {}),
      ...(inFlight.paymentStatus ? { paymentStatus: inFlight.paymentStatus } : {}),
      ...(inFlight.paymentCollected !== undefined ? { paymentCollected: inFlight.paymentCollected } : {}),
      ...(inFlight.sentToKitchen !== undefined ? { sentToKitchen: inFlight.sentToKitchen } : {}),
      ...(inFlight.assignedRiderId !== undefined ? { assignedRiderId: inFlight.assignedRiderId } : {}),
      ...(inFlight.assignedRiderName !== undefined ? { assignedRiderName: inFlight.assignedRiderName } : {}),
      ...(inFlight.riderStatus !== undefined ? { riderStatus: inFlight.riderStatus } : {}),
      ...(inFlight.assignedWaiterId !== undefined ? { assignedWaiterId: inFlight.assignedWaiterId } : {}),
      ...(inFlight.assignedWaiterName !== undefined ? { assignedWaiterName: inFlight.assignedWaiterName } : {}),
    };
    return mergeSingleOrderMonotonically(base, inFlightPatch);
  };

  const resultMap = new Map<string, Order>();

  if (preserveMissingFromPrev) {
    prev.forEach((p) => {
      if (!p || !p.id) return;
      if (
        String(p.id).startsWith('ord-seed-') ||
        ['FC-6744', 'FC-7819', 'FC-8812', 'FC-9021'].includes(p.orderNumber)
      ) {
        return;
      }
      const protectedPrev = applyInFlightOverlay(p, undefined, p.id, p.orderNumber) || p;
      resultMap.set(protectedPrev.id, protectedPrev);
    });
  }

  incoming.forEach((inc) => {
    if (!inc || !inc.id) return;
    if (
      String(inc.id).startsWith('ord-seed-') ||
      ['FC-6744', 'FC-7819', 'FC-8812', 'FC-9021'].includes(inc.orderNumber)
    ) {
      return;
    }
    const existingRaw = prevByKey.get(inc.id) || (inc.orderNumber ? prevByKey.get(inc.orderNumber) : undefined);
    const protectedExisting = applyInFlightOverlay(existingRaw, inc, inc.id, inc.orderNumber);
    const merged = mergeSingleOrderMonotonically(protectedExisting, inc);

    if (existingRaw && existingRaw.id !== merged.id) {
      resultMap.delete(existingRaw.id);
    }
    resultMap.set(merged.id, merged);
  });

  return Array.from(resultMap.values()).sort(
    (a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0)
  );
}

function areOrderListsEquivalent(a: Order[], b: Order[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (
      x.id !== y.id ||
      x.status !== y.status ||
      x.paymentStatus !== y.paymentStatus ||
      Boolean(x.paymentCollected) !== Boolean(y.paymentCollected) ||
      Boolean(x.sentToKitchen) !== Boolean(y.sentToKitchen) ||
      (x.forwardToKitchenAt || '') !== (y.forwardToKitchenAt || '') ||
      Number(x.total || 0) !== Number(y.total || 0) ||
      (x.version || 1) !== (y.version || 1) ||
      (x.assignedRiderId || '') !== (y.assignedRiderId || '') ||
      (x.riderStatus || '') !== (y.riderStatus || '') ||
      (x.assignedWaiterId || '') !== (y.assignedWaiterId || '') ||
      (x.cashierId || '') !== (y.cashierId || '') ||
      (x.tableNumber || '') !== (y.tableNumber || '') ||
      (x.notes || '') !== (y.notes || '') ||
      (x.items !== y.items && JSON.stringify(x.items) !== JSON.stringify(y.items))
    ) {
      return false;
    }
  }
  return true;
}

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

export interface SavedDeliveryAddress {
  id: string;
  label: 'Home' | 'Work' | 'Other';
  address: string;
  city: string;
  coordinates: { lat: number; lng: number };
  isDefault?: boolean;
}

interface AppContextType {
  theme: 'light';
  toggleTheme: () => void;
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  currentBranchId: string;
  setCurrentBranchId: (id: string, isExplicitSelection?: boolean) => void;
  repriceCartForBranch: (branchId: string) => void;
  hasSelectedBranch: boolean;
  setHasSelectedBranch: (selected: boolean) => void;
  currentBranch: Branch;
  branches: Branch[];
  menuItems: MenuItem[];
  orders: Order[];
  tables: Table[];
  tableSessions: TableSession[];
  shifts: CashShift[];
  refundRequests: RefundRequest[];
  auditLogs: AuditLog[];
  cart: OrderItem[];
  menuSearchQuery: string;
  setMenuSearchQuery: (query: string) => void;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Order Type & Confirmation
  orderType: 'dine_in' | 'takeaway' | 'delivery' | null;
  setOrderType: (type: 'dine_in' | 'takeaway' | 'delivery' | null) => void;
  hasConfirmedOrderType: boolean;
  setHasConfirmedOrderType: (confirmed: boolean) => void;

  // Branch Item Unavailable Alert Modal
  branchUnavailableModal: { visible: boolean; branchName: string; itemNames: string[] } | null;
  setBranchUnavailableModal: (modal: { visible: boolean; branchName: string; itemNames: string[] } | null) => void;
  closeBranchUnavailableModal: () => void;

  // Cart Actions
  addToCart: (item: OrderItem) => void;
  updateCartItemQty: (itemId: string, delta: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;

  // Order Actions
  placeOrder: (
    type: 'dine_in' | 'takeaway' | 'delivery',
    tableNumber?: string,
    tablePin?: string,
    pickupTime?: string,
    deliveryAddress?: string,
    paymentMethod?: string,
    customItems?: OrderItem[],
    options?: {
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      cashierId?: string;
      cashierName?: string;
      isWalkIn?: boolean;
      isTableQr?: boolean;
      notes?: string;
      customerCoordinates?: { lat: number; lng: number };
      paymentStatus?: 'paid' | 'unpaid';
      paymentCollected?: boolean;
      assignedWaiterId?: string;
      assignedWaiterName?: string;
    }
  ) => Order;
  updateOrderStatus: (
    orderId: string,
    newStatus: OrderStatus,
    reason?: string,
    customNotification?: { title: string; message: string; type?: 'info' | 'success' | 'warning' }
  ) => void;
  sendOrderToKitchen: (orderId: string, silent?: boolean) => void;
  setOrderKitchenForwardTime: (orderId: string, customMinutes: number) => void;
  setAllOrdersKitchenForwardTime: (customMinutes: number) => void;
  recordCashPayment: (orderId: string, amountReceived: number, silent?: boolean) => { change: number; success: boolean };
  updateOrderPayment: (orderId: string, paymentStatus: PaymentStatus) => void;
  editOrderStage1: (orderId: string, updatedItems: OrderItem[]) => void;
  addAddOnsToOrderStage2: (orderId: string, addOnItems: OrderItem[]) => void;
  cancelOrder: (orderId: string, reason: string) => void;

  // Delivery & Rider Actions
  assignRiderToOrder: (orderId: string, riderId: string, silent?: boolean) => void;
  unassignRiderFromOrder: (orderId: string) => void;
  acceptRiderOrder: (orderId: string) => void;
  finishRiderDelivery: (orderId: string, paymentCollected?: boolean) => void;
  updateRiderAvailability: (riderId: string, status: 'available' | 'busy' | 'offline') => void;
  departRider: (riderId: string) => void;
  customerCoordinates: { lat: number; lng: number } | null;
  setCustomerCoordinates: (coords: { lat: number; lng: number } | null) => void;
  selectedDeliveryAddress: string;
  setSelectedDeliveryAddress: (addr: string) => void;
  savedAddresses: SavedDeliveryAddress[];
  addSavedAddress: (addr: Omit<SavedDeliveryAddress, 'id'>) => SavedDeliveryAddress;
  deleteSavedAddress: (id: string) => void;
  detectAndStoreCurrentLocation: () => Promise<{
    coords: { lat: number; lng: number };
    address: string;
    city: string;
  } | null>;
  calculateDistanceKm: (lat1: number, lng1: number, lat2: number, lng2: number) => number;

  // Table & Floor Actions
  floors: string[];
  addFloor: (floorName: string) => void;
  removeFloor: (floorName: string) => void;
  addTable: (tableData: Omit<Table, 'id'>) => void;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  deleteTable: (tableId: string) => void;
  updateTableStatus: (tableId: string, status: TableStatus, reservationName?: string, customMessage?: string, silent?: boolean) => void;
  markTableFree: (tableIdOrNumber: string) => void;
  addTableSession: (session: Omit<TableSession, 'id'>) => void;
  completeTableSession: (tableId: string) => void;
  generateTableQr: (tableId: string, validMinutes: number, allowOnReserved?: boolean) => Promise<Table | null>;
  toggleTableQrAllowReserved: (tableId: string, allow: boolean) => Promise<void>;
  activeTableSession: { tableId: string; tableNumber: string; branchId: string; seatedAt: string; orderId?: string } | null;
  setActiveTableSession: (session: { tableId: string; tableNumber: string; branchId: string; seatedAt: string; orderId?: string } | null) => void;
  assignWaiterToOrder: (orderId: string, waiterId: string, waiterName: string) => Promise<void>;
  markOrderDeliveredToTable: (orderId: string) => void;
  markOrderDoneAndCollected: (orderId: string, cashCollected?: boolean) => void;
  cancelDineInOrder: (orderId: string, reason?: string) => Promise<void>;
  addItemsToExistingOrder: (orderId: string, newItems: OrderItem[]) => Promise<void>;

  // Menu & Categories Actions
  categories: string[];
  addCategory: (category: string) => void;
  renameCategory: (oldCat: string, newCat: string) => void;
  deleteCategory: (category: string) => void;
  updateMenuItem: (item: MenuItem) => void;
  addMenuItem: (item: MenuItem) => void;
  deleteMenuItem: (itemId: string) => void;
  allowRepresentativeMenuEdit: boolean;
  setAllowRepresentativeMenuEdit: (allowed: boolean) => void;
  toggleMenuItemBranchAvailability: (itemId: string, branchId: string) => void;
  updateMenuItemPrice: (itemId: string, newBasePrice: number, branchOverride?: { branchId: string; price: number }) => void;
  updateMenuItemBranchPrice: (itemId: string, branchId: string, overridePrice: number) => void;

  // Footer Settings
  footerSettings: FooterSettings;
  updateFooterSettings: (settings: Partial<FooterSettings>) => void;

  // Hero Banners & Deal Management (with Representative approval workflow)
  heroBanners: HeroBanner[];
  dealCard: DealCard;
  allowRepresentativeDirectPublish: boolean;
  setAllowRepresentativeDirectPublish: (allowed: boolean) => void;
  pendingApprovalRequests: BannerDealApprovalRequest[];
  updateHeroBanner: (banner: HeroBanner) => void;
  addHeroBanner: (banner: Omit<HeroBanner, 'id'>) => void;
  deleteHeroBanner: (id: string) => void;
  updateDealCard: (deal: DealCard) => void;
  approveRequest: (requestId: string) => void;
  rejectRequest: (requestId: string) => void;

  // Announcements & Real Info
  announcements: Announcement[];
  addAnnouncement: (a: Omit<Announcement, 'id'>) => Promise<void>;
  deleteAnnouncement: (id: string) => Promise<void>;

  // Live Notifications (Web + Mobile)
  notifications: AppNotification[];
  allNotifications: AppNotification[];
  unreadNotificationsCount: number;
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (updates: Partial<NotificationSettings>) => Promise<boolean>;
  activeReceiverKey: string;
  myNotificationSettings: ReceiverNotificationPreferences;
  receiverNotificationSettingsMap: Record<string, ReceiverNotificationPreferences>;
  updateMyNotificationSettings: (
    updates: Partial<ReceiverNotificationPreferences>,
    targetReceiverKey?: string
  ) => Promise<boolean>;
  isNotificationModalOpen: boolean;
  setIsNotificationModalOpen: (open: boolean) => void;
  notificationModalDefaultTab: 'inbox' | 'send' | 'settings';
  prefillNotificationOrder: Order | null;
  openNotificationModal: (tab?: 'inbox' | 'send' | 'settings', prefillOrder?: Order) => void;
  sendNotification: (payload: {
    id?: string;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    category?: NotificationCategory;
    branchId?: string;
    orderId?: string;
    orderNumber?: string;
    orderType?: OrderType;
    targetRoles: Array<Role | 'all'>;
    targetPlatform?: NotificationTargetPlatform;
    targetUserId?: string;
    targetCustomerPhone?: string;
    targetCustomerName?: string;
    targetWaiterId?: string;
    targetWaiterName?: string;
    targetRiderId?: string;
    targetRiderName?: string;
    silentToast?: boolean;
  }) => Promise<AppNotification | null>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;

  // Branch & Settings Actions
  updateBranchSettings: (branchId: string, settings: Partial<Branch>) => void;
  updateBranchPaymentSettings: (branchId: string, settings: BranchPaymentSettings) => void;
  createBranch: (branchData: Partial<Branch>) => Promise<boolean>;
  toggleBranchStatus: (branchId: string) => void;
  shutdownModalState: {
    isOpen: boolean;
    branch: Branch | null;
    pendingOrders: Order[];
  };
  closeShutdownModal: () => void;
  confirmShutdownKeepProcessing: () => void;
  confirmShutdownCancelOrders: () => void;

  // Cashier Shifts
  openShift: (openingFloat: number) => void;
  closeShift: (countedCash: number, differenceReason: string) => void;
  updateShiftOpeningBalance: (shiftId: string, newOpeningFloat: number) => void;
  currentShift: CashShift | null;

  // Refunds
  requestRefund: (orderId: string, amount: number, reason: string) => void;
  decideRefund: (refundId: string, approved: boolean) => void;

  // Staff & Customer Management
  users: User[];
  updateUserStatus: (userId: string, status: 'active' | 'suspended' | 'deactivated') => void;
  createUser: (userData: Omit<User, 'id'> & { id?: string }) => void;
  deleteUser: (userId: string) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;

  // On-demand Older Data / History Fetching
  hasLoadedOlderOrders: boolean;
  isFetchingOlderOrders: boolean;
  fetchOlderOrders: (branchId?: string, dateScope?: string, startDate?: string, endDate?: string) => Promise<void>;
  filterOrdersToToday: () => void;

  // Platform Owner & Manager Access Delegation
  managerAccessRequests: Record<string, ManagerAccessRequest>;
  requestManagerAccess: (branchId: string) => void;
  respondManagerAccess: (branchId: string, accept: boolean) => void;
  revokeManagerAccess: (branchId: string) => void;

  // Audit Log Refresh
  refreshAuditLogs: () => Promise<void>;
}

export const DEFAULT_PAYMENT_SETTINGS: BranchPaymentSettings = {
  dine_in: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
  takeaway: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
  delivery: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
};

const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'gulberg-lahore',
    name: 'Gulberg Branch (Flagship)',
    city: 'Lahore',
    address: '92-B2, Mian Mehmood Ali Kasoori Rd, Gulberg III, Lahore',
    phone: '+92 42 3578 9101',
    openingHours: '11:00 AM - 1:00 AM',
    isOpen: true,
    isBusy: false,
    prepTimeEstimateMin: 20,
    fullEditWindowMin: 15,
    stopAddOnsMinBeforeReady: 10,
    deliveryEnabled: true,
    latitude: 31.5126,
    longitude: 74.3436,
    maxOrderDistanceKm: 50,
    tableQrMaxDistanceMeters: 300,
    minDeliveryAmount: 500,
    paymentSettings: {
      dine_in: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
      takeaway: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
      delivery: { COD: true, Wallet: true, Card: true, Bank: true, Installment: true },
    },
  },
  {
    id: 'f7-islamabad',
    name: 'F-7 Markaz Branch',
    city: 'Islamabad',
    address: 'Shop 4-B, College Road, F-7 Markaz, Islamabad',
    phone: '+92 51 2654 321',
    openingHours: '12:00 PM - 12:00 AM',
    isOpen: true,
    isBusy: true,
    prepTimeEstimateMin: 30,
    fullEditWindowMin: 15,
    stopAddOnsMinBeforeReady: 10,
    deliveryEnabled: true,
    latitude: 33.7215,
    longitude: 73.0552,
    maxOrderDistanceKm: 50,
    tableQrMaxDistanceMeters: 300,
    minDeliveryAmount: 500,
    paymentSettings: {
      dine_in: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
      takeaway: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
      delivery: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
    },
  },
  {
    id: 'clifton-karachi',
    name: 'Clifton Block 4 Branch',
    city: 'Karachi',
    address: 'Plot 12-C, 26th Street, Block 4, Clifton, Karachi',
    phone: '+92 21 3587 6543',
    openingHours: '1:00 PM - 2:00 AM',
    isOpen: true,
    isBusy: false,
    prepTimeEstimateMin: 25,
    fullEditWindowMin: 15,
    stopAddOnsMinBeforeReady: 10,
    deliveryEnabled: true,
    latitude: 24.8252,
    longitude: 67.0305,
    maxOrderDistanceKm: 50,
    tableQrMaxDistanceMeters: 300,
    minDeliveryAmount: 500,
    paymentSettings: {
      dine_in: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
      takeaway: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
      delivery: { COD: true, Wallet: true, Card: true, Bank: true, Installment: true },
    },
  },
];

const INITIAL_FLOORS: string[] = [
  'Ground Floor (Main Dining)',
  '1st Floor (Family Hall)',
  'Rooftop Terrace (Open Air)',
];

const INITIAL_FOOTER_SETTINGS: FooterSettings = {
  helpline: '+92 42 111-FOODIES',
  email: 'feedback@foodiescafe.pk',
  hours: 'Daily 11:00 AM - 1:00 AM',
  addressLahore: '92-B2, Mian Mehmood Ali Kasoori Rd, Gulberg III, Lahore',
  addressIslamabad: 'Shop 4-B, College Road, F-7 Markaz, Islamabad',
  addressKarachi: 'Plot 12-C, 26th Street, Block 4, Clifton, Karachi',
  tagline: 'Quality multi-branch cafe experience in Pakistan. Authentic recipes, spotless kitchens, and friendly hospitality.',
  copyrightText: '© 2026 Foodies Cafe Pakistan.',
  orderRoutingSupportFirst: true,
  autoForwardKitchenMin: 3,
  autoForwardMode: 'timed',
  homeNotificationEnabled: true,
  homeNotificationBadge: 'LIVE ORDER NOTICE',
  homeNotificationTitle: 'Fresh Handi & Dum Biryani Batch Ready — Fast Dine-In, Takeaway & Delivery!',
  homeNotificationMessage: 'Select your order mode above to browse today’s live branch menu, local chef deals, and real-time order tracking.',
  homeNotificationType: 'promo',
};

const INITIAL_HERO_BANNERS: HeroBanner[] = [
  {
    id: 'b-1',
    title: 'Eat Fresh & Healthy, Cooked with Passion',
    subtitle: 'Authentic clay oven dum biryanis, organic desi ghee Shinwari karahi, and gourmet smash burgers across Lahore, Islamabad & Karachi.',
    badge: 'Multi-Branch Pakistani Fine Dining & Fast Casual',
    imageUrl: '/hero-bg.jpg',
    categoryLink: 'Biryani & Rice',
    active: true,
  },
  {
    id: 'b-2',
    title: 'Royal Handi & Desi Ghee Shinwari Karahi',
    subtitle: 'Tender mutton & chicken simmered in copper handis with freshly crushed peppercorns and pure organic butter.',
    badge: '🔥 Chef Handi Special',
    imageUrl: '/food-biryani.jpg',
    categoryLink: 'Shinwari & Karahi',
    active: true,
  },
  {
    id: 'b-3',
    title: 'Juicy Gourmet Smash Burgers & Loaded Fries',
    subtitle: 'Crispy seasoned fillets & smashed patties layered with molten cheddar, house pickles, and brioche buns.',
    badge: '🍔 Signature Fast-Casual Bites',
    imageUrl: '/hero-bg.jpg',
    categoryLink: 'Burgers & Fast Food',
    active: true,
  },
  {
    id: 'b-4',
    title: 'Traditional Tandoor Naans & Cold Refreshers',
    subtitle: 'Garlic butter naans, roghni naans, artisanal mint margaritas, and slow-brewed Karak Chai.',
    badge: '❄️ Drinks & Fresh Breads',
    imageUrl: '/food-biryani.jpg',
    categoryLink: 'Beverages & Desserts',
    active: true,
  },
];

const INITIAL_DEAL_CARD: DealCard = {
  title: 'Royal Chicken Dum Biryani',
  subtitle: '',
  price: 'Rs. 650',
  tag: '',
  imageUrl: '/food-biryani.jpg',
  categoryLink: 'Biryani & Rice',
};

const INITIAL_TABLES: Table[] = [
  { id: 't1', number: 'T-01', branchId: 'gulberg-lahore', floor: 'Ground Floor (Main Dining)', capacity: 2, chairs: 2, status: 'available', pin: '4921' },
  { id: 't2', number: 'T-02', branchId: 'gulberg-lahore', floor: 'Ground Floor (Main Dining)', capacity: 4, chairs: 4, status: 'available', pin: '7182' },
  { id: 't3', number: 'T-03', branchId: 'gulberg-lahore', floor: 'Ground Floor (Main Dining)', capacity: 4, chairs: 4, status: 'available', pin: '3941' },
  { id: 't4', number: 'T-04', branchId: 'gulberg-lahore', floor: 'Ground Floor (Main Dining)', capacity: 6, chairs: 6, status: 'available', pin: '8812' },
  { id: 't5', number: 'T-05', branchId: 'gulberg-lahore', floor: '1st Floor (Family Hall)', capacity: 4, chairs: 4, status: 'available', pin: '1092' },
  { id: 't6', number: 'T-06', branchId: 'gulberg-lahore', floor: '1st Floor (Family Hall)', capacity: 8, chairs: 8, status: 'available', pin: '6523' },
  { id: 't7', number: 'T-07', branchId: 'gulberg-lahore', floor: 'Rooftop Terrace (Open Air)', capacity: 4, chairs: 4, status: 'available', pin: '9901' },
  { id: 't8', number: 'T-08', branchId: 'gulberg-lahore', floor: 'Rooftop Terrace (Open Air)', capacity: 2, chairs: 2, status: 'available', pin: '2311' },
  // Islamabad
  { id: 't9', number: 'T-01', branchId: 'f7-islamabad', floor: 'Ground Floor (Main Dining)', capacity: 4, chairs: 4, status: 'available', pin: '3312' },
  { id: 't10', number: 'T-02', branchId: 'f7-islamabad', floor: 'Ground Floor (Main Dining)', capacity: 6, chairs: 6, status: 'available', pin: '4419' },
  { id: 't11', number: 'T-03', branchId: 'f7-islamabad', floor: '1st Floor (Family Hall)', capacity: 4, chairs: 4, status: 'available', pin: '5521' },
  // Karachi
  { id: 't12', number: 'T-01', branchId: 'clifton-karachi', floor: 'Ground Floor (Main Dining)', capacity: 4, chairs: 4, status: 'available', pin: '6618' },
  { id: 't13', number: 'T-02', branchId: 'clifton-karachi', floor: 'Rooftop Terrace (Open Air)', capacity: 6, chairs: 6, status: 'available', pin: '7729' },
];

const INITIAL_ORDERS: Order[] = [];

const INITIAL_USERS: User[] = [
  { id: 'user-cust', name: 'Zeeshan Ahmed', phone: '+92 301 5551234', email: 'zeeshan@example.com', address: 'House 14, Street 9, Model Town, Lahore', role: 'customer', status: 'active', noShowCount: 0, password: 'password123', pin: '1234' },
  { id: 'user-owner', name: 'Malik Jahangir', phone: '+92 300 0000001', email: 'owner@foodiescafe.pk', role: 'platform_owner', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-bm', name: 'Rashid Mehmood', phone: '+92 300 2223344', email: 'manager.gulberg@foodiescafe.pk', role: 'branch_manager', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-kitchen', name: 'Chef Ustaad Aslam', phone: '+92 300 6667788', email: 'kitchen.gulberg@foodiescafe.pk', role: 'kitchen_staff', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-cashier', name: 'Bilal Farooq', phone: '+92 300 8889900', email: 'cashier.gulberg@foodiescafe.pk', role: 'cashier', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-floor', name: 'Kashif Ali', phone: '+92 300 1112233', email: 'floor.gulberg@foodiescafe.pk', role: 'floor_staff', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-rider-1', name: 'Tariq Mehmood (Rider)', phone: '+92 301 9991122', email: 'rider1.gulberg@foodiescafe.pk', role: 'delivery_staff', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234', riderAvailability: 'available', riderTotalDeliveries: 0 },
  { id: 'user-rider-2', name: 'Usman Ghani (Rider)', phone: '+92 302 8882233', email: 'rider2.gulberg@foodiescafe.pk', role: 'delivery_staff', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234', riderAvailability: 'available', riderTotalDeliveries: 0 },
  // Islamabad Staff
  { id: 'user-bm-isb', name: 'Noman Bashir', phone: '+92 300 3334455', email: 'manager.islamabad@foodiescafe.pk', role: 'branch_manager', branchId: 'f7-islamabad', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-cashier-isb', name: 'Hamza Tariq', phone: '+92 300 3338899', email: 'cashier.islamabad@foodiescafe.pk', role: 'cashier', branchId: 'f7-islamabad', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-kitchen-isb', name: 'Chef Imran Khan', phone: '+92 300 3337766', email: 'kitchen.islamabad@foodiescafe.pk', role: 'kitchen_staff', branchId: 'f7-islamabad', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-floor-isb', name: 'Fahad Mustafa', phone: '+92 300 3336655', email: 'floor.islamabad@foodiescafe.pk', role: 'floor_staff', branchId: 'f7-islamabad', status: 'active', password: 'password123', pin: '1234' },
  // Karachi Staff
  { id: 'user-bm-khi', name: 'Kamran Siddiqui', phone: '+92 300 5556677', email: 'manager.karachi@foodiescafe.pk', role: 'branch_manager', branchId: 'clifton-karachi', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-cashier-khi', name: 'Saad Ali', phone: '+92 300 5558899', email: 'cashier.karachi@foodiescafe.pk', role: 'cashier', branchId: 'clifton-karachi', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-kitchen-khi', name: 'Chef Zakir Hussain', phone: '+92 300 5557766', email: 'kitchen.karachi@foodiescafe.pk', role: 'kitchen_staff', branchId: 'clifton-karachi', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-floor-khi', name: 'Rizwan Ahmed', phone: '+92 300 5556655', email: 'floor.karachi@foodiescafe.pk', role: 'floor_staff', branchId: 'clifton-karachi', status: 'active', password: 'password123', pin: '1234' },
];

const DEFAULT_OPEN_SHIFT: CashShift = {
  id: 'sh-today-1',
  cashierId: 'user-cashier',
  cashierName: 'Bilal Farooq',
  branchId: 'gulberg-lahore',
  openedAt: 'Today, 09:00 AM',
  openingFloat: 0,
  cashCollected: 0,
  expectedCash: 0,
  status: 'open',
};

const INITIAL_SHIFTS: CashShift[] = [
  DEFAULT_OPEN_SHIFT,
  {
    id: 'sh-today-isb',
    cashierId: 'user-cashier-isb',
    cashierName: 'Hamza Tariq',
    branchId: 'f7-islamabad',
    openedAt: 'Today, 09:00 AM',
    openingFloat: 0,
    cashCollected: 0,
    expectedCash: 0,
    status: 'open',
  },
  {
    id: 'sh-today-khi',
    cashierId: 'user-cashier-khi',
    cashierName: 'Adeel Murtaza',
    branchId: 'clifton-karachi',
    openedAt: 'Today, 09:00 AM',
    openingFloat: 0,
    cashCollected: 0,
    expectedCash: 0,
    status: 'open',
  },
];

const INITIAL_AUDIT_LOGS: AuditLog[] = [];

function mergeNotificationSettings(
  current: NotificationSettings,
  incoming?: Partial<NotificationSettings> | null
): NotificationSettings {
  if (!incoming) return current;
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...current,
    ...incoming,
    events: {
      ...DEFAULT_NOTIFICATION_SETTINGS.events,
      ...(current.events || {}),
      ...(incoming.events || {}),
    },
    recipientRules: {
      customer: {
        ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.customer,
        ...(current.recipientRules?.customer || {}),
        ...(incoming.recipientRules?.customer || {}),
      },
      rider: {
        ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.rider,
        ...(current.recipientRules?.rider || {}),
        ...(incoming.recipientRules?.rider || {}),
      },
      waiter: {
        ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.waiter,
        ...(current.recipientRules?.waiter || {}),
        ...(incoming.recipientRules?.waiter || {}),
      },
      kitchen: {
        ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.kitchen,
        ...(current.recipientRules?.kitchen || {}),
        ...(incoming.recipientRules?.kitchen || {}),
      },
      cashierAndManager: {
        ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.cashierAndManager,
        ...(current.recipientRules?.cashierAndManager || {}),
        ...(incoming.recipientRules?.cashierAndManager || {}),
      },
    },
    updatedBy: incoming.updatedBy || current.updatedBy,
    updatedByRole: incoming.updatedByRole || current.updatedByRole,
    updatedAt: incoming.updatedAt || current.updatedAt,
  };
}

function buildWebOrderNotificationRoles(
  orderType: OrderType | undefined,
  settings: NotificationSettings
): Array<Role | 'all'> {
  const roles: Array<Role | 'all'> = ['platform_owner'];
  if (settings.notifyCustomer) roles.push('customer');
  if (settings.notifyCashierAndManager) {
    roles.push('cashier', 'branch_manager');
  }
  if (settings.notifyKitchen) roles.push('kitchen_staff');
  if (orderType === 'dine_in' && settings.notifyConcernedWaiter) {
    roles.push('floor_staff');
  }
  if (orderType === 'delivery' && settings.notifyConcernedRider) {
    roles.push('delivery_staff');
  }
  return Array.from(new Set(roles));
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Pure light mode forced for all portals per user request
  const theme = 'light' as const;
  const toggleTheme = () => { };

  const GUEST_CUSTOMER: User = {
    id: 'user-guest',
    name: 'Guest Customer',
    phone: '',
    email: '',
    role: 'customer',
    status: 'active',
  };

  // Staff login session duration: valid for 4-8 hours (8-hour shift max: 8 * 60 * 60 * 1000 ms)
  const STAFF_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

  const [currentRole, setCurrentRole] = useState<Role>(() => {
    if (typeof window !== 'undefined') {
      const isStaffPath = window.location.pathname.startsWith('/staff');
      const savedStaffRole = localStorage.getItem('foodies_staff_role');
      const savedLoginTime = localStorage.getItem('foodies_staff_login_time');

      // Check if staff session has expired (> 8 hours)
      if (savedLoginTime && Date.now() - Number(savedLoginTime) > STAFF_SESSION_MAX_AGE_MS) {
        localStorage.removeItem('foodies_staff_user');
        localStorage.removeItem('foodies_staff_role');
        localStorage.removeItem('foodies_staff_view');
        localStorage.removeItem('foodies_staff_login_time');
        return 'customer';
      }

      if (savedStaffRole && savedStaffRole !== 'customer') {
        return savedStaffRole as Role;
      }
      if (isStaffPath) {
        const savedStaffUser = localStorage.getItem('foodies_staff_user');
        if (savedStaffUser) {
          try {
            const parsed = JSON.parse(savedStaffUser);
            if (parsed && parsed.role && parsed.role !== 'customer') {
              return parsed.role as Role;
            }
          } catch (e) { }
        }
      }
    }
    return 'customer';
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    if (typeof window !== 'undefined') {
      const isStaffPath = window.location.pathname.startsWith('/staff');
      if (isStaffPath) {
        const savedLoginTime = localStorage.getItem('foodies_staff_login_time');
        // Check if staff session has expired (> 8 hours)
        if (savedLoginTime && Date.now() - Number(savedLoginTime) > STAFF_SESSION_MAX_AGE_MS) {
          localStorage.removeItem('foodies_staff_user');
          localStorage.removeItem('foodies_staff_role');
          localStorage.removeItem('foodies_staff_view');
          localStorage.removeItem('foodies_staff_login_time');
          return GUEST_CUSTOMER;
        }

        try {
          const savedStaff = localStorage.getItem('foodies_staff_user');
          if (savedStaff) {
            const parsedStaff = JSON.parse(savedStaff);
            if (parsedStaff && parsedStaff.id && parsedStaff.role !== 'customer') {
              return parsedStaff;
            }
          }
        } catch (e) { }
      }

      // Check customer user if not on staff path (24-Hour Session Expiry Rule)
      try {
        const saved = localStorage.getItem('foodies_customer_user');
        const loginTimeStr = localStorage.getItem('foodies_customer_login_time');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.name && parsed.name !== 'Guest Customer' && parsed.role === 'customer') {
            const loginTime = loginTimeStr ? Number(loginTimeStr) : null;
            // 24 Hours in milliseconds = 86,400,000 ms. Expire strictly if loginTime exists AND exceeded 24h
            if (loginTime && !isNaN(loginTime) && Date.now() - loginTime > 24 * 60 * 60 * 1000) {
              localStorage.removeItem('foodies_customer_user');
              localStorage.removeItem('foodies_customer_session');
              localStorage.removeItem('foodies_customer_login_time');
              localStorage.removeItem('foodies_customer_order_ids');
              localStorage.removeItem('foodies_customer_history_cache');
              return GUEST_CUSTOMER;
            }
            // Seed login time if missing so customer gets their full 24h
            if (!loginTime || isNaN(loginTime)) {
              localStorage.setItem('foodies_customer_login_time', Date.now().toString());
            }
            return parsed;
          }
        }
      } catch (e) { }
    }
    return GUEST_CUSTOMER;
  });

  // Automatically keep storage synchronized with proper role isolation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (currentUser && currentUser.role && currentUser.role !== 'customer') {
        // Staff member: save strictly to staff session keys and ensure login time is set
        localStorage.setItem('foodies_staff_user', JSON.stringify(currentUser));
        localStorage.setItem('foodies_staff_role', currentUser.role);
        if (!localStorage.getItem('foodies_staff_login_time')) {
          localStorage.setItem('foodies_staff_login_time', Date.now().toString());
        }
        store.dispatch(setReduxUser(currentUser));
      } else if (currentUser && currentUser.name && currentUser.name !== 'Guest Customer') {
        // Customer: save strictly to customer key & ensure 24h login timestamp is recorded
        localStorage.setItem('foodies_customer_user', JSON.stringify(currentUser));
        if (!localStorage.getItem('foodies_customer_login_time')) {
          localStorage.setItem('foodies_customer_login_time', Date.now().toString());
        }
        store.dispatch(setReduxUser(currentUser));
      }
    } catch (e) { }
  }, [currentUser]);

  // Periodic 24-Hour Customer Session Auto-Expiry Check
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkCustomerSessionExpiry = () => {
      const isCust = currentUser && currentUser.role === 'customer' && currentUser.name && currentUser.name !== 'Guest Customer';
      if (!isCust) return;
      const loginTimeStr = localStorage.getItem('foodies_customer_login_time');
      const loginTime = loginTimeStr ? Number(loginTimeStr) : null;
      if (!loginTime || isNaN(loginTime)) {
        localStorage.setItem('foodies_customer_login_time', Date.now().toString());
        return;
      }
      if (Date.now() - loginTime > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('foodies_customer_user');
        localStorage.removeItem('foodies_customer_session');
        localStorage.removeItem('foodies_customer_login_time');
        localStorage.removeItem('foodies_customer_order_ids');
        localStorage.removeItem('foodies_customer_history_cache');
        setCurrentUser(GUEST_CUSTOMER);
        store.dispatch(setReduxUser(GUEST_CUSTOMER));
        addToast({
          type: 'info',
          title: 'Session Expired (24 Hours) ⏰',
          message: 'Your 24-hour customer session has expired. Please sign in again with your email to access your account.',
        });
      }
    };

    checkCustomerSessionExpiry();
    const interval = setInterval(checkCustomerSessionExpiry, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (currentRole && currentRole !== 'customer') {
        localStorage.setItem('foodies_staff_role', currentRole);
      }
    } catch (e) { }
  }, [currentRole]);
  const [currentBranchId, setCurrentBranchIdState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlBranch = urlParams.get('branch');
      if (urlBranch) return urlBranch;
      const manual = localStorage.getItem('foodies_customer_manual_branch');
      if (manual) return manual;
      const saved = localStorage.getItem('foodies_customer_branch');
      if (saved) return saved;
    }
    return 'gulberg-lahore';
  });

  const [hasSelectedBranch, setHasSelectedBranch] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return Boolean(localStorage.getItem('foodies_customer_selected_branch'));
    }
    return false;
  });

  const [branchUnavailableModal, setBranchUnavailableModal] = useState<{
    visible: boolean;
    branchName: string;
    itemNames: string[];
  } | null>(null);

  const closeBranchUnavailableModal = () => setBranchUnavailableModal(null);
  const [branches, setBranches] = useState<Branch[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_branches_live');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) { }
    }
    return INITIAL_BRANCHES;
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>(INITIAL_MENU);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [hasLoadedOlderOrders, setHasLoadedOlderOrders] = useState<boolean>(false);
  const [isFetchingOlderOrders, setIsFetchingOlderOrders] = useState<boolean>(false);
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [floors, setFloors] = useState<string[]>(INITIAL_FLOORS);
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [allowRepresentativeMenuEdit, setAllowRepresentativeMenuEdit] = useState<boolean>(true);
  const [footerSettings, setFooterSettings] = useState<FooterSettings>(INITIAL_FOOTER_SETTINGS);
  const [heroBanners, setHeroBanners] = useState<HeroBanner[]>(INITIAL_HERO_BANNERS);
  const [dealCard, setDealCard] = useState<DealCard>(INITIAL_DEAL_CARD);
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => store.getState().cafe.announcements || []);
  const [allNotifications, setAllNotifications] = useState<AppNotification[]>(() => store.getState().cafe.notifications || []);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    const storeSettings = store.getState().cafe.notificationSettings;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_notification_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          return mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, parsed);
        }
      } catch (e) { }
    }
    return storeSettings || DEFAULT_NOTIFICATION_SETTINGS;
  });
  const [receiverNotificationSettingsMap, setReceiverNotificationSettingsMap] = useState<
    Record<string, ReceiverNotificationPreferences>
  >(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_receiver_notif_settings_map');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch { }
    }
    return {};
  });
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [notificationModalDefaultTab, setNotificationModalDefaultTab] = useState<'inbox' | 'send' | 'settings'>('inbox');
  const [prefillNotificationOrder, setPrefillNotificationOrder] = useState<Order | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set((store.getState().cafe.notifications || []).map((n) => n.id)));
  const activeBrowserNotificationsRef = useRef<Map<string, Notification>>(new Map());
  const [allowRepresentativeDirectPublish, setAllowRepresentativeDirectPublish] = useState<boolean>(false);
  const [pendingApprovalRequests, setPendingApprovalRequests] = useState<BannerDealApprovalRequest[]>([]);
  const [shifts, setShifts] = useState<CashShift[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_shifts_live');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const clean = parsed
              .filter((s: CashShift) => s.id !== 'sh-yesterday-1' && s.id !== 'sh-yesterday-2')
              .map((s: CashShift) =>
                s.id === 'sh-today-1' && s.cashCollected === 34200
                  ? { ...s, openingFloat: 0, cashCollected: 0, expectedCash: 0 }
                  : s
              );
            if (clean.length > 0) return clean;
          }
        }
      } catch (e) { }
    }
    return INITIAL_SHIFTS;
  });
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [tableSessions, setTableSessions] = useState<TableSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [users, setUsers] = useState<User[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_users_live');
        if (saved) return JSON.parse(saved);
      } catch (e) { }
    }
    return INITIAL_USERS;
  });
  const [cart, setCart] = useState<OrderItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_cart');
        if (saved) return JSON.parse(saved);
      } catch (e) { }
    }
    return [];
  });

  // Automatically keep cart synchronized with localStorage and Redux store
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_cart', JSON.stringify(cart));
      store.dispatch(setReduxCart(cart));
    } catch (e) { }
  }, [cart]);

  const repriceCartForBranch = (branchId: string) => {
    setCart((prevCart) => {
      if (!prevCart || prevCart.length === 0) return prevCart;
      const updated = prevCart.map((ci) => {
        const dish = menuItems.find(
          (m) => m.id === ci.menuItemId || m.name.toLowerCase() === ci.name.toLowerCase()
        );
        if (!dish) return ci;
        let newUnitPrice = (dish.branchPriceOverrides && dish.branchPriceOverrides[branchId] !== undefined && !isNaN(Number(dish.branchPriceOverrides[branchId])))
          ? Number(dish.branchPriceOverrides[branchId])
          : Number(dish.basePrice) || 0;
        if (ci.size && dish.sizes) {
          const matchSize = dish.sizes.find((s) => s.name === ci.size);
          if (matchSize) newUnitPrice += Number(matchSize.priceDelta) || 0;
        }
        if (ci.extras && dish.extras) {
          ci.extras.forEach((ext) => {
            const matchExtra = dish.extras?.find((e) => e.name === ext);
            if (matchExtra) newUnitPrice += Number(matchExtra.price) || 0;
          });
        }
        return { ...ci, unitPrice: newUnitPrice };
      });
      store.dispatch(setReduxCart(updated));
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('foodies_cart', JSON.stringify(updated));
        } catch (e) { }
      }
      return updated;
    });
  };

  const setCurrentBranchId = (branchId: string, isExplicitSelection: boolean = true) => {
    if (branchId === currentBranchId && (isExplicitSelection ? hasSelectedBranch : true)) {
      return;
    }
    setCurrentBranchIdState(branchId);
    store.dispatch(setReduxBranchId(branchId));
    if (typeof window !== 'undefined') {
      localStorage.setItem('foodies_customer_branch', branchId);
      if (isExplicitSelection) {
        localStorage.setItem('foodies_customer_selected_branch', branchId);
      }
    }

    if (isExplicitSelection) {
      setHasSelectedBranch(true);
      repriceCartForBranch(branchId);
    }

    // Check if any items currently in cart are unavailable at this newly selected branch
    if (cart && cart.length > 0) {
      const targetBranch = branches.find((b) => b.id === branchId);
      const targetBranchName = targetBranch ? targetBranch.name : branchId;

      const unavail = cart.filter((cartItem) => {
        const dish = menuItems.find(
          (m) => m.id === cartItem.menuItemId || m.name.toLowerCase() === cartItem.name.toLowerCase()
        );
        if (!dish) return false;
        return dish.branchAvailability?.[branchId] === false || dish.isAvailable === false;
      });

      if (unavail.length > 0) {
        const names = Array.from(new Set(unavail.map((i) => i.name)));
        setBranchUnavailableModal({
          visible: true,
          branchName: targetBranchName,
          itemNames: names,
        });
      }
    }
  };
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery' | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('foodies_order_type') || localStorage.getItem('foodies_order_type');
        if (saved === 'dine_in' || saved === 'takeaway' || saved === 'delivery') return saved;
      } catch (e) { }
    }
    return null;
  });
  const [hasConfirmedOrderType, setHasConfirmedOrderType] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('foodies_order_type_confirmed');
        if (saved === 'true') return true;
      } catch (e) { }
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (orderType) {
        sessionStorage.setItem('foodies_order_type', orderType);
        localStorage.setItem('foodies_order_type', orderType);
      } else {
        sessionStorage.removeItem('foodies_order_type');
        localStorage.removeItem('foodies_order_type');
      }
    } catch (e) { }
  }, [orderType]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem('foodies_order_type_confirmed', hasConfirmedOrderType ? 'true' : 'false');
    } catch (e) { }
  }, [hasConfirmedOrderType]);
  const DEFAULT_WEB_SAVED_ADDRESSES: SavedDeliveryAddress[] = [
    {
      id: 'addr-default-1',
      label: 'Home',
      address: 'House #14, Street 5, Main Boulevard Gulberg III, Lahore',
      city: 'Lahore',
      coordinates: { lat: 31.5204, lng: 74.3587 },
      isDefault: true,
    },
  ];

  const [customerCoordinates, setCustomerCoordinatesState] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_customer_coordinates');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            return parsed;
          }
        }
      } catch (e) { }
    }
    return { lat: 31.5204, lng: 74.3587 };
  });

  const setCustomerCoordinates = useCallback((coords: { lat: number; lng: number } | null) => {
    setCustomerCoordinatesState(coords);
    if (typeof window !== 'undefined') {
      try {
        if (coords) {
          localStorage.setItem('foodies_customer_coordinates', JSON.stringify(coords));
        } else {
          localStorage.removeItem('foodies_customer_coordinates');
        }
      } catch (e) { }
    }
  }, []);

  const [selectedDeliveryAddress, setSelectedDeliveryAddressState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_selected_delivery_address');
        if (saved && saved.trim()) return saved;
      } catch (e) { }
    }
    return 'House #14, Street 5, Main Boulevard Gulberg III, Lahore';
  });

  const setSelectedDeliveryAddress = useCallback((addr: string) => {
    setSelectedDeliveryAddressState(addr);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('foodies_selected_delivery_address', addr);
      } catch (e) { }
    }
  }, []);

  const [savedAddresses, setSavedAddressesState] = useState<SavedDeliveryAddress[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_saved_addresses');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) { }
    }
    return DEFAULT_WEB_SAVED_ADDRESSES;
  });

  const addSavedAddress = useCallback((addr: Omit<SavedDeliveryAddress, 'id'>): SavedDeliveryAddress => {
    const newItem: SavedDeliveryAddress = {
      ...addr,
      id: `addr-${Date.now()}`,
    };
    setSavedAddressesState((prev) => {
      const next = [newItem, ...prev];
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('foodies_saved_addresses', JSON.stringify(next));
        } catch (e) { }
      }
      return next;
    });
    setSelectedDeliveryAddress(newItem.address);
    if (newItem.coordinates) {
      setCustomerCoordinates(newItem.coordinates);
    }
    return newItem;
  }, [setCustomerCoordinates, setSelectedDeliveryAddress]);

  const deleteSavedAddress = useCallback((id: string) => {
    setSavedAddressesState((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('foodies_saved_addresses', JSON.stringify(next));
        } catch (e) { }
      }
      return next;
    });
  }, []);

  const calculateDistanceKm = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    return calculateHaversineKm(lat1, lng1, lat2, lng2);
  }, []);

  const detectAndStoreCurrentLocation = useCallback(async () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      return null;
    }
    return new Promise<{ coords: { lat: number; lng: number }; address: string; city: string } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          };
          setCustomerCoordinates(coords);
          const geo = await reverseGeocodeOpenStreetMap(coords.lat, coords.lng);
          setSelectedDeliveryAddress(geo.address);
          resolve({ coords, address: geo.address, city: geo.city });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 7000 }
      );
    });
  }, [setCustomerCoordinates, setSelectedDeliveryAddress]);
  const tabIdRef = useRef<string>(typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 9) : 'tab');
  const liveBroadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastToastRef = useRef<{ title: string; message: string; timestamp: number } | null>(null);
  const inFlightStatusRef = useRef<Map<string, {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    paymentCollected?: boolean;
    sentToKitchen?: boolean;
    assignedRiderId?: string;
    assignedRiderName?: string;
    riderStatus?: 'assigned' | 'accepted' | 'picked_up' | 'en_route' | 'delivered';
    assignedWaiterId?: string;
    assignedWaiterName?: string;
    timestamp: number;
  }>>(new Map());

  const getClientAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (typeof window !== 'undefined') {
      const sessionToken =
        localStorage.getItem('foodies_staff_session') ||
        localStorage.getItem('foodies_customer_session');
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }
      if (currentRole && currentRole !== 'customer') {
        headers['x-foodies-staff-role'] = currentRole;
        if (currentUser?.id) headers['x-foodies-user-id'] = currentUser.id;
        if (currentBranchId) headers['x-foodies-branch-id'] = currentBranchId;
      }
    }
    return headers;
  };

  const appFetch = async (url: string, options: RequestInit = {}) => {
    const authHeaders = getClientAuthHeaders();
    const headers = {
      ...authHeaders,
      ...((options.headers as any) || {}),
    };
    return fetch(url, { ...options, headers });
  };

  const [managerAccessRequests, setManagerAccessRequests] = useState<Record<string, ManagerAccessRequest>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_manager_access_requests');
        if (saved) return JSON.parse(saved);
      } catch (e) { }
    }
    return {};
  });

  const broadcastManagerAccessRequests = (reqs: Record<string, ManagerAccessRequest>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_manager_access_requests', JSON.stringify(reqs));
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_MANAGER_ACCESS_REQUESTS',
          payload: reqs,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) { }
  };

  const broadcastBranches = (branchesList: Branch[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_branches_live', JSON.stringify(branchesList));
      store.dispatch(setReduxBranches(branchesList));
      broadcastStateMutation('SYNC_BRANCHES', branchesList);
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_BRANCHES',
          payload: branchesList,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) { }
  };

  const broadcastOrders = (ordersList: Order[]) => {
    if (typeof window === 'undefined') return;
    try {
      const nextJson = JSON.stringify(ordersList);
      if (localStorage.getItem('foodies_orders_live') !== nextJson) {
        localStorage.setItem('foodies_orders_live', nextJson);
      }
      queueMicrotask(() => store.dispatch(setReduxOrders(ordersList)));
      // NOTE: Do not broadcastStateMutation('SYNC_ORDERS') here.
      // Remote tabs already receive the live payload instantly via foodies_system_live_sync below.
      // Calling broadcastStateMutation triggers premature runSync on /api/sync before asynchronous PATCH commits.
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_ORDERS',
          payload: ordersList,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) { }
  };

  const broadcastTables = (tablesList: Table[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_tables_live', JSON.stringify(tablesList));
      store.dispatch(setReduxTables(tablesList));
      broadcastStateMutation('SYNC_TABLES', tablesList);
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_TABLES',
          payload: tablesList,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) { }
  };

  const broadcastMenu = (itemsList: MenuItem[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_menu_items', JSON.stringify(itemsList));
      store.dispatch(setReduxMenuItems(itemsList));
      broadcastStateMutation('SYNC_MENU', itemsList);
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_MENU',
          payload: itemsList,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) { }
  };

  const broadcastShifts = (shiftsList: CashShift[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_shifts_live', JSON.stringify(shiftsList));
      store.dispatch(setReduxShifts(shiftsList));
      broadcastStateMutation('SYNC_SHIFTS', shiftsList);
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_SHIFTS',
          payload: shiftsList,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) { }
  };

  const broadcastRefunds = (refundsList: RefundRequest[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_refunds_live', JSON.stringify(refundsList));
      store.dispatch(setReduxRefundRequests(refundsList));
      broadcastStateMutation('SYNC_REFUNDS', refundsList);
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_REFUNDS',
          payload: refundsList,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) { }
  };

  const broadcastTableSessions = (sessionsList: TableSession[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_table_sessions_live', JSON.stringify(sessionsList));
      store.dispatch(setReduxTableSessions(sessionsList));
      broadcastStateMutation('SYNC_TABLE_SESSIONS', sessionsList);
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_TABLE_SESSIONS',
          payload: sessionsList,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) { }
  };

  const broadcastUsers = (usersList: User[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_users_live', JSON.stringify(usersList));
      store.dispatch(setReduxUsers(usersList));
      broadcastStateMutation('SYNC_USERS', usersList);
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_USERS',
          payload: usersList,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) { }
  };

  const broadcastMarketing = (data: {
    heroBanners?: HeroBanner[];
    dealCard?: DealCard;
    footerSettings?: FooterSettings;
    categories?: string[];
  }) => {
    if (typeof window === 'undefined') return;
    try {
      if (data.heroBanners) localStorage.setItem('foodies_hero_banners', JSON.stringify(data.heroBanners));
      if (data.dealCard) localStorage.setItem('foodies_deal_card', JSON.stringify(data.dealCard));
      if (data.footerSettings) localStorage.setItem('foodies_footer_settings', JSON.stringify(data.footerSettings));
      if (data.categories) localStorage.setItem('foodies_categories', JSON.stringify(data.categories));

      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_MARKETING',
          payload: data,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) { }
  };

  useEffect(() => {
    // Ensure light theme is always enforced
    document.documentElement.setAttribute('data-theme', 'light');

    if (typeof window === 'undefined') return;

    // Load persisted marketing elements & notification rules on first mount
    try {
      const savedBanners = localStorage.getItem('foodies_hero_banners');
      if (savedBanners) {
        const p = JSON.parse(savedBanners);
        if (Array.isArray(p) && p.length > 0) setHeroBanners(p);
      }
      const savedDeal = localStorage.getItem('foodies_deal_card');
      if (savedDeal) {
        const p = JSON.parse(savedDeal);
        if (p && p.title) setDealCard(p);
      }
      const savedFooter = localStorage.getItem('foodies_footer_settings');
      const savedHomeNotif = localStorage.getItem('foodies_web_home_notification');
      if (savedFooter || savedHomeNotif) {
        const pFooter = savedFooter ? JSON.parse(savedFooter) : {};
        const pHomeNotif = savedHomeNotif ? JSON.parse(savedHomeNotif) : {};
        setFooterSettings((prev) => ({
          ...prev,
          ...(pFooter && typeof pFooter === 'object' ? pFooter : {}),
          ...(pHomeNotif && typeof pHomeNotif === 'object' ? pHomeNotif : {}),
        }));
      }
      const savedCats = localStorage.getItem('foodies_categories');
      if (savedCats) {
        const p = JSON.parse(savedCats);
        if (Array.isArray(p) && p.length > 0) setCategories(p);
      }
      const savedNotifSettings = localStorage.getItem('foodies_notification_settings');
      if (savedNotifSettings) {
        const p = JSON.parse(savedNotifSettings);
        if (p && typeof p === 'object') {
          const mergedNotifSettings = mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, p);
          setNotificationSettings(mergedNotifSettings);
          store.dispatch(setReduxNotificationSettings(mergedNotifSettings));
        }
      }
    } catch (e) { }

    // Always hydrate marketing banners, deals, footer routing settings, and categories from DB
    fetch('/api/marketing')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.heroBanners) && data.heroBanners.length > 0) {
          setHeroBanners(data.heroBanners);
          try {
            localStorage.setItem('foodies_hero_banners', JSON.stringify(data.heroBanners));
          } catch (e) { }
        }
        if (data.dealCard && data.dealCard.title) {
          setDealCard(data.dealCard);
          try {
            localStorage.setItem('foodies_deal_card', JSON.stringify(data.dealCard));
          } catch (e) { }
        }
        if (data.footerSettings) {
          setFooterSettings((prev) => {
            const cleaned: Record<string, any> = {};
            Object.entries(data.footerSettings).forEach(([k, v]) => {
              if (v !== null && v !== undefined) cleaned[k] = v;
            });
            let localHomeNotif: Record<string, any> = {};
            try {
              const rawHn = localStorage.getItem('foodies_web_home_notification');
              if (rawHn) localHomeNotif = JSON.parse(rawHn) || {};
            } catch { }
            const merged = { ...prev, ...cleaned };
            if (!cleaned.homeNotificationTitle && localHomeNotif.homeNotificationTitle) {
              Object.assign(merged, localHomeNotif);
            }
            try {
              localStorage.setItem('foodies_footer_settings', JSON.stringify(merged));
            } catch (e) { }
            return merged;
          });
        }
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
          try {
            localStorage.setItem('foodies_categories', JSON.stringify(data.categories));
          } catch (e) { }
        }
      })
      .catch(() => { });

    // Hydrate per-receiver independent notification settings from backend
    fetch('/api/notifications?limit=1')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.receiverSettingsMap && typeof data.receiverSettingsMap === 'object') {
          setReceiverNotificationSettingsMap((prev) => {
            const mergedMap = { ...prev, ...data.receiverSettingsMap };
            try {
              localStorage.setItem('foodies_receiver_notif_settings_map', JSON.stringify(mergedMap));
            } catch { }
            return mergedMap;
          });
        }
      })
      .catch(() => { });

    // Load persisted orders on first mount (filter out stale dummy/test orders if any)
    const savedOrders = localStorage.getItem('foodies_orders_live');

    if (savedOrders) {
      try {
        const parsed = JSON.parse(savedOrders);
        if (Array.isArray(parsed)) {
          const cleanOrders = parsed.filter(
            (o: Order) =>
              !o.id?.startsWith('ord-seed-') &&
              !o.id?.startsWith('ord-del-') &&
              !o.id?.startsWith('ord-dine-') &&
              !o.id?.startsWith('ord-take-') &&
              o.id !== 'ord-101' &&
              o.id !== 'ord-102' &&
              o.id !== 'ord-seed-1' &&
              o.id !== 'ord-seed-2' &&
              o.id !== 'ord-seed-3' &&
              o.id !== 'ord-seed-4' &&
              o.orderNumber !== 'FC-8821' &&
              o.orderNumber !== 'FC-8822' &&
              o.orderNumber !== 'FC-6202' &&
              o.orderNumber !== 'FC-6101' &&
              o.orderNumber !== 'FC-6102' &&
              o.orderNumber !== 'FC-6744' &&
              o.orderNumber !== 'FC-7819' &&
              o.orderNumber !== 'FC-8812' &&
              o.orderNumber !== 'FC-9021'
          );
          if (cleanOrders.length > 0) {
            setOrders(cleanOrders);
            localStorage.setItem('foodies_orders_live', JSON.stringify(cleanOrders));
          } else {
            localStorage.removeItem('foodies_orders_live');
            setOrders([]);
          }
        }
      } catch (e) { }
    }

    // Sanitize shifts, refunds, and table sessions from localStorage
    try {
      const savedRefunds = localStorage.getItem('foodies_refunds_live');
      if (savedRefunds) {
        const parsed = JSON.parse(savedRefunds);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(
            (r: RefundRequest) =>
              r.id !== 'ref-pending-1' &&
              r.id !== 'ref-approved-1' &&
              !r.id.startsWith('ref-pending') &&
              !r.id.startsWith('ref-approved') &&
              r.orderNumber !== 'FC-8812' &&
              r.orderNumber !== 'FC-9021' &&
              r.orderNumber !== 'FC-8492' &&
              r.orderNumber !== 'FC-6744' &&
              r.orderNumber !== 'FC-7819'
          );
          setRefundRequests(clean);
          if (clean.length > 0) {
            localStorage.setItem('foodies_refunds_live', JSON.stringify(clean));
          } else {
            localStorage.removeItem('foodies_refunds_live');
          }
        }
      }
      const savedSessions = localStorage.getItem('foodies_table_sessions_live');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((s: TableSession) => !s.id?.startsWith('sess-'));
          setTableSessions(clean);
          localStorage.setItem('foodies_table_sessions_live', JSON.stringify(clean));
        }
      }
      const savedShifts = localStorage.getItem('foodies_shifts_live');
      if (savedShifts) {
        const parsed = JSON.parse(savedShifts);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((s: CashShift) => s.id !== 'sh-yesterday-1' && s.id !== 'sh-yesterday-2');
          setShifts(clean.length > 0 ? clean : INITIAL_SHIFTS);
          localStorage.setItem('foodies_shifts_live', JSON.stringify(clean.length > 0 ? clean : INITIAL_SHIFTS));
        }
      }
    } catch (e) { }

    // Load persisted menu items without reverting staff edits or re-inserting deleted items
    const savedMenu = localStorage.getItem('foodies_menu_items');
    if (savedMenu) {
      try {
        const parsed = JSON.parse(savedMenu);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMenuItems(parsed);
        }
      } catch (e) { }
    } else {
      setMenuItems(INITIAL_MENU);
      localStorage.setItem('foodies_menu_items', JSON.stringify(INITIAL_MENU));
    }

    // Always fetch latest menu catalog from backend on mount to ensure 100% database parity
    fetch('/api/menu')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.menuItems) && data.menuItems.length > 0) {
          setMenuItems(data.menuItems);
          // Keep Redux in step: otherwise its demo INITIAL_MENU can be mirrored back into context later,
          // showing customers dishes/deals that do not exist in the database (orders then get rejected).
          store.dispatch(setReduxMenuItems(data.menuItems));
          try {
            localStorage.setItem('foodies_menu_items', JSON.stringify(data.menuItems));
          } catch (e) { }
        }
        if (data && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
          store.dispatch(setReduxCategories(data.categories));
          try {
            localStorage.setItem('foodies_categories', JSON.stringify(data.categories));
          } catch (e) { }
        }
      })
      .catch(() => { });

    const savedCats = localStorage.getItem('foodies_categories');
    if (savedCats) {
      try {
        const parsed = JSON.parse(savedCats);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategories(parsed);
          localStorage.setItem('foodies_categories', JSON.stringify(parsed));
        }
      } catch (e) { }
    } else {
      localStorage.setItem('foodies_categories', JSON.stringify(INITIAL_CATEGORIES));
    }

    // Clean up stale dummy table reservations from localStorage if any
    const savedTables = localStorage.getItem('foodies_tables_live');
    if (savedTables) {
      try {
        const parsed = JSON.parse(savedTables);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.map((t: Table) => ({
            ...t,
            status: t.currentOrderId === 'ord-101' ? 'available' : t.status,
            currentOrderId: t.currentOrderId === 'ord-101' ? undefined : t.currentOrderId,
          }));
          setTables(cleaned);
        }
      } catch (e) { }
    }

    // Load persisted user on first mount with strict staff vs customer isolation
    if (typeof window !== 'undefined') {
      const isStaffPath = window.location.pathname.startsWith('/staff');
      if (isStaffPath) {
        const savedStaff = localStorage.getItem('foodies_staff_user');
        const savedStaffRole = localStorage.getItem('foodies_staff_role');
        if (savedStaff) {
          try {
            const parsedStaff = JSON.parse(savedStaff);
            if (parsedStaff && parsedStaff.id && parsedStaff.role && parsedStaff.role !== 'customer') {
              setCurrentUser(parsedStaff);
              if (savedStaffRole) {
                setCurrentRole(savedStaffRole as Role);
              } else {
                setCurrentRole(parsedStaff.role);
              }
            }
          } catch (e) { }
        }
      } else {
        const savedUser = localStorage.getItem('foodies_customer_user');
        const loginTimeStr = localStorage.getItem('foodies_customer_login_time');
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            if (parsedUser && parsedUser.name && parsedUser.name !== 'Guest Customer' && parsedUser.role === 'customer') {
              const loginTime = loginTimeStr ? Number(loginTimeStr) : null;
              if (loginTime && !isNaN(loginTime) && Date.now() - loginTime > 24 * 60 * 60 * 1000) {
                localStorage.removeItem('foodies_customer_user');
                localStorage.removeItem('foodies_customer_session');
                localStorage.removeItem('foodies_customer_login_time');
                localStorage.removeItem('foodies_customer_order_ids');
                localStorage.removeItem('foodies_customer_history_cache');
                setCurrentUser(GUEST_CUSTOMER);
                store.dispatch(setReduxUser(GUEST_CUSTOMER));
              } else {
                if (!loginTime || isNaN(loginTime)) {
                  localStorage.setItem('foodies_customer_login_time', Date.now().toString());
                }
                setCurrentUser(parsedUser);
                store.dispatch(setReduxUser(parsedUser));
              }
            }
          } catch (e) { }
        }
      }
    }

    // Geolocation detection & nearest branch auto-lock
    const selectNearest = (userLat: number, userLng: number) => {
      let minDistance = Infinity;
      let nearestId = 'gulberg-lahore';

      INITIAL_BRANCHES.forEach((b) => {
        const bLat = b.latitude ?? (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126);
        const bLng = b.longitude ?? (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436);
        const R = 6371;
        const dLat = ((bLat - userLat) * Math.PI) / 180;
        const dLon = ((bLng - userLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((userLat * Math.PI) / 180) *
          Math.cos((bLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const dist = R * c;
        if (dist < minDistance) {
          minDistance = dist;
          nearestId = b.id;
        }
      });

      if (typeof window !== 'undefined' && !localStorage.getItem('foodies_customer_manual_branch')) {
        setCurrentBranchId(nearestId);
        localStorage.setItem('foodies_customer_branch', nearestId);
      }
    };

    const hasStoredCoords =
      typeof window !== 'undefined' && Boolean(localStorage.getItem('foodies_customer_coordinates'));

    if (hasStoredCoords) {
      try {
        const stored = JSON.parse(localStorage.getItem('foodies_customer_coordinates') || '');
        if (stored && typeof stored.lat === 'number' && typeof stored.lng === 'number') {
          setCustomerCoordinates(stored);
          selectNearest(stored.lat, stored.lng);
        }
      } catch (e) { }
    } else if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const detected = {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          };
          setCustomerCoordinates(detected);
          selectNearest(detected.lat, detected.lng);
        },
        () => {
          setCustomerCoordinates({ lat: 31.5204, lng: 74.3587 });
          selectNearest(31.5204, 74.3587);
        },
        { timeout: 5000 }
      );
    } else {
      setCustomerCoordinates({ lat: 31.5204, lng: 74.3587 });
      selectNearest(31.5204, 74.3587);
    }

    // Set up persistent BroadcastChannel for instant zero-refresh cross-tab communication
    let channel: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('foodies_system_live_sync');
      liveBroadcastChannelRef.current = channel;
      channel.onmessage = (event) => {
        if (!event.data || event.data.senderId === tabIdRef.current) return;
        if (event.data?.type === 'SYNC_BRANCHES' && Array.isArray(event.data.payload)) {
          setBranches(event.data.payload);
        }
        if (event.data?.type === 'SYNC_ORDERS' && Array.isArray(event.data.payload)) {
          setOrders((prev) => {
            const merged = mergeOrderListsMonotonically(prev, event.data.payload, inFlightStatusRef.current, true);
            if (areOrderListsEquivalent(prev, merged)) {
              return prev;
            }
            try {
              const nextJson = JSON.stringify(merged);
              if (localStorage.getItem('foodies_orders_live') !== nextJson) {
                localStorage.setItem('foodies_orders_live', nextJson);
              }
            } catch { }
            queueMicrotask(() => store.dispatch(setReduxOrders(merged)));
            return merged;
          });
        }
        if (event.data?.type === 'SYNC_BRANCHES' && Array.isArray(event.data.payload)) {
          setBranches(event.data.payload);
          store.dispatch(setReduxBranches(event.data.payload));
        }
        if (event.data?.type === 'BRANCH_UPDATED' && event.data.payload) {
          const b = event.data.payload;
          setBranches((prev) => {
            const next = prev.map((item) =>
              item.id === b.id || normalizeBranchId(item.id) === normalizeBranchId(b.id)
                ? { ...item, ...b }
                : item
            );
            store.dispatch(setReduxBranches(next));
            return next;
          });
        }
        if (event.data?.type === 'SYNC_TABLES' && Array.isArray(event.data.payload)) {
          setTables(event.data.payload);
        }
        if (event.data?.type === 'SYNC_MENU' && Array.isArray(event.data.payload)) {
          setMenuItems(event.data.payload);
        }
        if (event.data?.type === 'SYNC_SHIFTS' && Array.isArray(event.data.payload)) {
          setShifts(event.data.payload);
        }
        if (event.data?.type === 'SYNC_REFUNDS' && Array.isArray(event.data.payload)) {
          setRefundRequests(event.data.payload);
        }
        if (event.data?.type === 'SYNC_TABLE_SESSIONS' && Array.isArray(event.data.payload)) {
          setTableSessions(event.data.payload);
        }
        if (event.data?.type === 'SYNC_USERS' && Array.isArray(event.data.payload)) {
          setUsers(event.data.payload);
        }
        if (event.data?.type === 'SYNC_MANAGER_ACCESS_REQUESTS' && event.data.payload) {
          setManagerAccessRequests(event.data.payload);
        }
        if (event.data?.type === 'SYNC_AUDIT_LOGS' && Array.isArray(event.data.payload)) {
          setAuditLogs(event.data.payload);
        }
        if (event.data?.type === 'SYNC_MARKETING' && event.data.payload) {
          const p = event.data.payload;
          if (Array.isArray(p.heroBanners)) setHeroBanners(p.heroBanners);
          if (p.dealCard) setDealCard(p.dealCard);
          if (p.footerSettings) setFooterSettings(p.footerSettings);
          if (Array.isArray(p.categories)) setCategories(p.categories);
        }
        if (event.data?.type === 'SYNC_NOTIFICATION_SETTINGS' && event.data.payload) {
          const p = event.data.payload;
          const merged = mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, p);
          setNotificationSettings(merged);
          store.dispatch(setReduxNotificationSettings(merged));
        }
      };
    }

    // Storage event listener for cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'foodies_branches_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setBranches(parsed);
          }
        } catch (err) { }
      }
      if (e.key === 'foodies_orders_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setOrders((prev) => {
              const merged = mergeOrderListsMonotonically(prev, parsed, inFlightStatusRef.current, true);
              if (areOrderListsEquivalent(prev, merged)) {
                return prev;
              }
              queueMicrotask(() => store.dispatch(setReduxOrders(merged)));
              return merged;
            });
          }
        } catch (err) { }
      }
      if (e.key === 'foodies_manager_access_requests' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) setManagerAccessRequests(parsed);
        } catch (err) { }
      }
      if (e.key === 'foodies_tables_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setTables(parsed);
          }
        } catch (err) { }
      }
      if (e.key === 'foodies_menu_items' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setMenuItems(parsed);
          }
        } catch (err) { }
      }
      if (e.key === 'foodies_shifts_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setShifts(parsed);
        } catch (err) { }
      }
      if (e.key === 'foodies_refunds_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setRefundRequests(parsed);
        } catch (err) { }
      }
      if (e.key === 'foodies_table_sessions_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setTableSessions(parsed);
        } catch (err) { }
      }
      if (e.key === 'foodies_users_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setUsers(parsed);
        } catch (err) { }
      }
      if (e.key === 'foodies_hero_banners' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setHeroBanners(parsed);
        } catch (err) { }
      }
      if (e.key === 'foodies_deal_card' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) setDealCard(parsed);
        } catch (err) { }
      }
      if (e.key === 'foodies_footer_settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) setFooterSettings(parsed);
        } catch (err) { }
      }
      if (e.key === 'foodies_categories' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setCategories(parsed);
        } catch (err) { }
      }
      if (e.key === 'foodies_notification_settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            const merged = mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, parsed);
            setNotificationSettings(merged);
            store.dispatch(setReduxNotificationSettings(merged));
          }
        } catch (err) { }
      }
      if (e.key === 'foodies_receiver_notif_settings_map' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            setReceiverNotificationSettingsMap(parsed);
          }
        } catch { }
      }
    };
    window.addEventListener('storage', handleStorage);

    // Fallback Backend Polling (2.5s fast interval + SSE for sub-second updates)
    let lastLocalEtag = '';
    const syncWithBackend = async () => {
      try {
        const bId = currentRole === 'platform_owner' ? 'all' : normalizeBranchId(currentBranchId);
        let custId = '';
        let custPhone = '';
        let orderIdsQuery = '';
        if (currentRole === 'customer') {
          if (currentUser?.id && currentUser.id !== 'user-guest') {
            custId = `&customerId=${encodeURIComponent(currentUser.id)}`;
          }
          if (currentUser?.phone) {
            custPhone = `&customerPhone=${encodeURIComponent(currentUser.phone)}`;
          }
          if (typeof window !== 'undefined') {
            try {
              const myIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
              if (Array.isArray(myIds) && myIds.length > 0) {
                orderIdsQuery = `&orderIds=${encodeURIComponent(myIds.slice(0, 30).join(','))}`;
              }
            } catch { }
          }
        }
        const headers: Record<string, string> = {
          ...getClientAuthHeaders(),
        };
        if (lastLocalEtag) {
          headers['If-None-Match'] = lastLocalEtag;
        }
        const res = await fetch(
          `/api/sync?scope=live&role=${encodeURIComponent(currentRole)}&branchId=${encodeURIComponent(bId)}${custId}${custPhone}${orderIdsQuery}&since=1`,
          { headers }
        );
        if (res.status === 304) return;
        if (res.ok) {
          const etag = res.headers.get('ETag');
          if (etag) lastLocalEtag = etag;
          const data = await res.json();
          if (Array.isArray(data.orders)) {
            // Clean up stale in-flight entries (> 20s)
            const now = Date.now();
            for (const [key, val] of inFlightStatusRef.current.entries()) {
              if (now - val.timestamp > 20000) {
                inFlightStatusRef.current.delete(key);
              }
            }

            // Only update orders when sync payload contains order records.
            // Never blank out active orders on empty poll response to prevent orders temporarily vanishing.
            if (data.orders.length > 0) {
              setOrders((prev) => {
                const merged = mergeOrderListsMonotonically(prev, data.orders, inFlightStatusRef.current, true);
                if (areOrderListsEquivalent(prev, merged)) {
                  return prev;
                }
                try {
                  const nextJson = JSON.stringify(merged);
                  if (localStorage.getItem('foodies_orders_live') !== nextJson) {
                    localStorage.setItem('foodies_orders_live', nextJson);
                  }
                } catch (e) { }
                queueMicrotask(() => store.dispatch(setReduxOrders(merged)));
                return merged;
              });
            }
          }
          if (Array.isArray(data.tables) && data.tables.length > 0) {
            setTables(data.tables);
          }
          if (Array.isArray(data.shifts) && data.shifts.length > 0) {
            setShifts(data.shifts);
          }
          if (Array.isArray(data.refunds)) {
            setRefundRequests(data.refunds);
          }
          if (Array.isArray(data.branches) && data.branches.length > 0) {
            setBranches((prev) => {
              const updated = prev.map((b) => {
                const match = data.branches.find((dbB: Branch) => dbB.id === b.id || normalizeBranchId(dbB.id) === normalizeBranchId(b.id));
                return match ? { ...b, ...match } : b;
              });
              try {
                localStorage.setItem('foodies_branches_live', JSON.stringify(updated));
              } catch (e) { }
              store.dispatch(setReduxBranches(updated));
              return updated;
            });
          }
          if (Array.isArray(data.menuItems) && data.menuItems.length > 0) {
            setMenuItems(data.menuItems);
            try {
              localStorage.setItem('foodies_menu_items', JSON.stringify(data.menuItems));
            } catch (e) { }
          }
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            setCategories(data.categories);
            try {
              localStorage.setItem('foodies_categories', JSON.stringify(data.categories));
            } catch (e) { }
          }
          if (Array.isArray(data.announcements)) {
            setAnnouncements(data.announcements);
            store.dispatch(setReduxAnnouncements(data.announcements));
          }
          if (data.notificationSettings && typeof data.notificationSettings === 'object') {
            const merged = mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, data.notificationSettings);
            setNotificationSettings(merged);
            store.dispatch(setReduxNotificationSettings(merged));
            try {
              localStorage.setItem('foodies_notification_settings', JSON.stringify(merged));
            } catch (e) { }
          }
          if (data.receiverNotificationSettingsMap && typeof data.receiverNotificationSettingsMap === 'object') {
            setReceiverNotificationSettingsMap((prev) => {
              const mergedMap = { ...prev, ...data.receiverNotificationSettingsMap };
              try {
                localStorage.setItem('foodies_receiver_notif_settings_map', JSON.stringify(mergedMap));
              } catch { }
              return mergedMap;
            });
          }
        }
      } catch (err) { }
    };

    // Unified real-time updates are pushed via Redux RTK syncEngine (SSE + BroadcastChannel)
    syncWithBackend();

    return () => {
      if (channel) {
        channel.close();
        liveBroadcastChannelRef.current = null;
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, [currentRole, currentBranchId]);

  // High-performance Redux Toolkit store synchronization & background fast sync
  useEffect(() => {
    // 1. Initial push of context state to Redux store
    if (orders.length > 0) store.dispatch(setReduxOrders(orders));
    if (cart.length > 0) store.dispatch(setReduxCart(cart));
    if (branches.length > 0) store.dispatch(setReduxBranches(branches));
    if (tables.length > 0) store.dispatch(setReduxTables(tables));

    // 2. Subscribe to Redux Store changes (dispatched by RTK syncEngine or components)
    let prevReduxState = store.getState();
    const unsubscribe = store.subscribe(() => {
      const state = store.getState();

      if (state.orders.orders !== prevReduxState.orders.orders) {
        const nextReduxOrders = state.orders.orders;
        setOrders((prev) => {
          const merged = mergeOrderListsMonotonically(prev, nextReduxOrders, inFlightStatusRef.current, true);
          if (areOrderListsEquivalent(prev, merged)) {
            return prev;
          }
          if (!areOrderListsEquivalent(merged, nextReduxOrders)) {
            queueMicrotask(() => store.dispatch(setReduxOrders(merged)));
          }
          return merged;
        });
      }
      if (state.cart.items !== prevReduxState.cart.items) {
        setCart((current) => {
          if (current === state.cart.items || JSON.stringify(current) === JSON.stringify(state.cart.items)) {
            return current;
          }
          return state.cart.items;
        });
      }
      if (state.cafe.branches !== prevReduxState.cafe.branches) {
        setBranches(state.cafe.branches);
      }
      if (state.cafe.menuItems !== prevReduxState.cafe.menuItems) {
        setMenuItems(state.cafe.menuItems);
      }
      if (state.cafe.categories !== prevReduxState.cafe.categories) {
        setCategories(state.cafe.categories);
      }
      if (state.cafe.tables !== prevReduxState.cafe.tables) {
        setTables(state.cafe.tables);
      }
      if (state.cafe.shifts !== prevReduxState.cafe.shifts) {
        setShifts(state.cafe.shifts);
      }
      if (state.cafe.refundRequests !== prevReduxState.cafe.refundRequests) {
        setRefundRequests(state.cafe.refundRequests);
      }
      if (state.cafe.tableSessions !== prevReduxState.cafe.tableSessions) {
        setTableSessions(state.cafe.tableSessions);
      }
      if (state.cafe.users !== prevReduxState.cafe.users) {
        setUsers(state.cafe.users);
      }
      if (state.cafe.heroBanners !== prevReduxState.cafe.heroBanners) {
        setHeroBanners(state.cafe.heroBanners);
      }
      if (state.cafe.dealCard !== prevReduxState.cafe.dealCard) {
        setDealCard(state.cafe.dealCard);
      }
      if (state.cafe.announcements !== prevReduxState.cafe.announcements) {
        setAnnouncements(state.cafe.announcements);
      }
      if (state.cafe.notifications !== prevReduxState.cafe.notifications) {
        setAllNotifications(state.cafe.notifications);
      }
      if (state.cafe.notificationSettings !== prevReduxState.cafe.notificationSettings) {
        setNotificationSettings(state.cafe.notificationSettings);
        try {
          localStorage.setItem('foodies_notification_settings', JSON.stringify(state.cafe.notificationSettings));
        } catch (e) { }
      }
      if (state.cafe.footerSettings !== prevReduxState.cafe.footerSettings) {
        setFooterSettings(state.cafe.footerSettings);
      }
      if (state.cafe.currentBranchId !== prevReduxState.cafe.currentBranchId) {
        setCurrentBranchIdState(state.cafe.currentBranchId);
      }
      if (state.ui.currentRole !== prevReduxState.ui.currentRole) {
        setCurrentRole(state.ui.currentRole);
      }
      if (state.ui.currentUser !== prevReduxState.ui.currentUser) {
        if (state.ui.currentUser?.name !== 'Guest Customer' || prevReduxState.ui.currentUser?.name === 'Guest Customer') {
          setCurrentUser(state.ui.currentUser);
        }
      }

      prevReduxState = state;
    });

    // 3. Trigger initial fast sync
    runSync({ full: true });

    return () => {
      unsubscribe();
    };
  }, []);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_cart', JSON.stringify(cart));
    } catch (e) { }
  }, [cart]);

  // Auto-forward timer effect for orders directed to Customer Services
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setOrders((prev) => {
        let hasChanges = false;
        const autoForwarded: string[] = [];
        const updated = prev.map((ord) => {
          if (
            ord.status === 'placed' &&
            !ord.sentToKitchen &&
            ord.forwardToKitchenAt &&
            new Date(ord.forwardToKitchenAt).getTime() <= now
          ) {
            hasChanges = true;
            autoForwarded.push(ord.orderNumber);
            return {
              ...ord,
              status: 'accepted' as OrderStatus,
              sentToKitchen: true,
              sentToKitchenAt: new Date().toISOString(),
              forwardToKitchenAt: undefined,
            };
          }
          return ord;
        });

        if (hasChanges) {
          broadcastOrders(updated);
          autoForwarded.forEach((num) => {
            const matched = updated.find((o) => o.orderNumber === num);
            if (matched) {
              try {
                fetch('/api/orders', {
                  method: 'PATCH',
                  headers: getClientAuthHeaders(),
                  body: JSON.stringify({ id: matched.id, status: 'accepted', sentToKitchen: true }),
                }).catch(() => { });
              } catch (e) { }
            }
          });
          addToast({
            type: 'info',
            title: 'Auto-Forwarded to Kitchen 👨‍🍳',
            message: `Time elapsed. Order(s) #${autoForwarded.join(', #')} forwarded to kitchen queue.`,
          });
          return updated;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // End-of-day cancelled orders auto-purge effect (deletes cancelled orders whose day has ended)
  useEffect(() => {
    const purgePastCancelled = async () => {
      try {
        fetch('/api/orders?purge=end_of_day', {
          method: 'DELETE',
          headers: getClientAuthHeaders(),
        }).catch(() => { });
      } catch (e) { }

      setOrders((prev) => {
        const remaining = prev.filter(
          (o) => !((o.status === 'cancelled' || (o.status as string) === 'canceled') && isOrderDayEnded(o.createdAt))
        );
        if (remaining.length !== prev.length) {
          try {
            localStorage.setItem('foodies_orders_live', JSON.stringify(remaining));
          } catch (e) { }
        }
        return remaining;
      });
    };

    purgePastCancelled();
    const timer = setInterval(purgePastCancelled, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const now = Date.now();
    const id = Math.random().toString(36).substring(2, 9);

    setToasts((prev) => {
      const last = lastToastRef.current;
      const isRecent = last && now - last.timestamp < 1600;

      // 1. Exact duplicate check: suppress identical notifications
      if (isRecent && last.title === toast.title && last.message === toast.message) {
        return prev;
      }

      // 2. Chained action consolidation: If another toast arrives within 1600ms,
      // combine ALL information into this single notification!
      if (prev.length > 0 && isRecent) {
        const currentActive = prev[0];

        // Combine messages cleanly if not already contained
        let combinedMessage = currentActive.message.trim();
        const nextMsg = toast.message.trim();

        if (nextMsg && !combinedMessage.includes(nextMsg) && !nextMsg.includes(combinedMessage)) {
          combinedMessage = `${combinedMessage} · ${nextMsg}`;
        } else if (nextMsg.length > combinedMessage.length) {
          combinedMessage = nextMsg;
        }

        // Choose the most informative title
        const preferredTitle =
          toast.title.length >= currentActive.title.length ? toast.title : currentActive.title;
        const preferredType =
          toast.type === 'error' || currentActive.type === 'error'
            ? 'error'
            : toast.type === 'warning' || currentActive.type === 'warning'
              ? 'warning'
              : toast.type === 'success' || currentActive.type === 'success'
                ? 'success'
                : toast.type;

        lastToastRef.current = { title: preferredTitle, message: combinedMessage, timestamp: now };

        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
          setToasts([]);
        }, 4500);

        return [{ id: currentActive.id, type: preferredType, title: preferredTitle, message: combinedMessage }];
      }

      // 3. New single notification: enforce strictly 1 toast on screen with all details
      lastToastRef.current = { title: toast.title, message: toast.message, timestamp: now };

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setToasts([]);
      }, 4500);

      return [{ ...toast, id }];
    });
  };

  const removeToast = (_id?: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToasts([]);
  };

  const currentBranch = branches.find((b) => b.id === currentBranchId) || branches[0];

  // Cart actions
  const addToCart = (item: OrderItem) => {
    // Check branch availability of this item
    const dish = menuItems.find(
      (m) => m.id === item.menuItemId || m.name.toLowerCase() === item.name.toLowerCase()
    );
    if (hasSelectedBranch) {
      const isAvailAtBranch = dish ? (dish.branchAvailability?.[currentBranchId] !== false && dish.isAvailable !== false) : true;
      if (!isAvailAtBranch) {
        setBranchUnavailableModal({
          visible: true,
          branchName: currentBranch?.name || 'this branch',
          itemNames: [item.name],
        });
        return;
      }
    }

    const itemQty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    let unitPrice = Number(item.unitPrice) || 0;
    if (dish) {
      const baseEffective = hasSelectedBranch
        ? ((dish.branchPriceOverrides && dish.branchPriceOverrides[currentBranchId] !== undefined)
          ? Number(dish.branchPriceOverrides[currentBranchId])
          : Number(dish.basePrice) || 0)
        : getItemMinPrice(dish);
      let calculatedUnitPrice = baseEffective;
      if (item.size && dish.sizes) {
        const matchSize = dish.sizes.find((s) => s.name === item.size);
        if (matchSize) calculatedUnitPrice += Number(matchSize.priceDelta) || 0;
      }
      if (item.extras && dish.extras) {
        item.extras.forEach((ext) => {
          const matchExtra = dish.extras?.find((e) => e.name === ext);
          if (matchExtra) calculatedUnitPrice += Number(matchExtra.price) || 0;
        });
      }
      unitPrice = calculatedUnitPrice;
    }

    const itemWithPrice: OrderItem = { ...item, unitPrice, quantity: itemQty };

    setCart((prev) => {
      const existing = prev.find(
        (i) => i.menuItemId === item.menuItemId && i.size === item.size && JSON.stringify(i.extras) === JSON.stringify(item.extras)
      );
      if (existing) {
        return prev.map((i) => (i === existing ? { ...i, unitPrice, quantity: i.quantity + itemQty } : i));
      }
      return [...prev, itemWithPrice];
    });
    addToast({
      type: 'success',
      title: 'Added to Cart',
      message: `${item.name} (x${itemQty}) added.`,
    });
  };

  const updateCartItemQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.id === itemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as OrderItem[];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setOrderType(null);
    setHasConfirmedOrderType(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('foodies_cart');
        sessionStorage.removeItem('foodies_order_type');
        sessionStorage.removeItem('foodies_order_type_confirmed');
      } catch (e) { }
    }
  };

  // Place Order
  const placeOrder = (
    type: 'dine_in' | 'takeaway' | 'delivery',
    tableNumber?: string,
    tablePin?: string,
    pickupTime?: string,
    deliveryAddress?: string,
    paymentMethod?: string,
    customItems?: OrderItem[],
    options?: {
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      cashierId?: string;
      cashierName?: string;
      isWalkIn?: boolean;
      isTableQr?: boolean;
      notes?: string;
      customerCoordinates?: { lat: number; lng: number };
      paymentStatus?: PaymentStatus;
      paymentCollected?: boolean;
      assignedWaiterId?: string;
      assignedWaiterName?: string;
    }
  ): Order => {
    const orderItems = customItems && customItems.length > 0 ? customItems : [...cart];
    const subtotal = orderItems.reduce((acc, item) => acc + Number(item.unitPrice) * Number(item.quantity), 0);
    const method = paymentMethod || 'COD';
    const isDigitalPrepaid =
      method !== 'COD' &&
      method !== 'Cash on Delivery (COD)' &&
      !method.toLowerCase().includes('cash') &&
      !method.toLowerCase().includes('unpaid');
    const initialPaymentStatus: PaymentStatus =
      options?.paymentStatus || (isDigitalPrepaid ? 'paid' : 'unpaid');
    const isCollected = Boolean(options?.paymentCollected || initialPaymentStatus === 'paid');
    const routeToSupportFirst = footerSettings.orderRoutingSupportFirst ?? true;
    const autoMin = footerSettings.autoForwardKitchenMin ?? 3;
    const forwardTime = new Date(Date.now() + Math.max(1, autoMin) * 60 * 1000).toISOString();

    const isStaffOrCashier = currentRole === 'cashier' || currentRole === 'branch_manager' || currentRole === 'floor_staff' || Boolean(options?.cashierId) || Boolean(options?.isWalkIn);
    const cashierId = options?.cashierId || (currentRole === 'cashier' ? (currentUser.id || 'user-cashier') : undefined);
    const cashierName = options?.cashierName || (currentRole === 'cashier' ? (currentUser.name || 'Bilal Farooq') : undefined);
    const isWalkIn = options?.isWalkIn ?? (currentRole === 'cashier' || currentRole === 'floor_staff' || Boolean(cashierId));
    const isTableQr = options?.isTableQr ?? (type === 'dine_in' && Boolean(tableNumber) && !isWalkIn);
    const targetCustomerId = options?.customerId || (isStaffOrCashier ? 'cust-walkin' : (currentUser.id || 'user-guest'));
    const targetCustomerPhone = options?.customerPhone || (isStaffOrCashier ? '+92 300 0000000' : (currentUser.phone || '+92 300 0000000'));
    const targetCustomerEmail = options?.customerEmail || (!isStaffOrCashier ? currentUser.email : undefined);

    const matchingTable = type === 'dine_in' && tableNumber
      ? tables.find(
          (t) =>
            (!t.branchId || normalizeBranchId(t.branchId) === normalizeBranchId(currentBranchId)) &&
            (t.number.toLowerCase() === String(tableNumber).toLowerCase() ||
             t.id === tableNumber ||
             t.number.replace(/\D/g, '') === String(tableNumber).replace(/\D/g, '') ||
             `t-${t.number.replace(/\D/g, '')}` === String(tableNumber).toLowerCase().replace(/\s/g, ''))
        )
      : undefined;
    const assignedWaiterId =
      options?.assignedWaiterId ||
      matchingTable?.assignedWaiterId ||
      (currentRole === 'floor_staff' ? currentUser.id : undefined);
    const assignedWaiterName =
      options?.assignedWaiterName ||
      matchingTable?.assignedWaiterName ||
      (currentRole === 'floor_staff' ? currentUser.name : undefined);

    const sanitizedItems = orderItems.map((it, idx) => ({
      ...it,
      id: it.id || `item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: it.menuItemId || (it as any).id || `m-${idx}`,
      unitPrice: Number(it.unitPrice) || 0,
      quantity: Number(it.quantity) || 1,
    }));

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `FC-${Math.floor(1000 + Math.random() * 9000)}`,
      branchId: normalizeBranchId(currentBranchId),
      customerId: targetCustomerId,
      customerName: options?.customerName || (isStaffOrCashier ? 'Walk-in Guest' : (currentUser.name || 'Guest Customer')),
      customerPhone: targetCustomerPhone,
      customerEmail: targetCustomerEmail,
      type,
      tableNumber,
      tablePin,
      pickupTime: type === 'takeaway' ? (pickupTime || 'Immediate walk-in counter collection') : undefined,
      deliveryAddress: type === 'delivery' ? (deliveryAddress || currentUser.address) : undefined,
      status: 'placed',
      paymentStatus: initialPaymentStatus,
      paymentCollected: isCollected,
      items: sanitizedItems,
      originalSubtotal: subtotal,
      addOnSubtotal: 0,
      tax: 0,
      total: subtotal,
      notes: options?.notes,
      createdAt: new Date().toISOString(),
      readyTimeEstimated: `in ${currentBranch.prepTimeEstimateMin} mins`,
      version: 1,
      paymentMethod: method,
      sentToKitchen: false,
      sentToKitchenAt: undefined,
      forwardToKitchenAt: forwardTime,
      cashierId,
      cashierName,
      isWalkIn,
      isTableQr,
      customerCoordinates: options?.customerCoordinates || customerCoordinates || undefined,
      assignedWaiterId,
      assignedWaiterName,
    };

    // Guarantee that this customer's order is immediately remembered on this device/account
    if (typeof window !== 'undefined') {
      try {
        const myIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
        if (!myIds.includes(newOrder.id)) {
          myIds.unshift(newOrder.id);
        }
        if (newOrder.orderNumber && !myIds.includes(newOrder.orderNumber)) {
          myIds.unshift(newOrder.orderNumber);
        }
        localStorage.setItem('foodies_customer_order_ids', JSON.stringify(myIds));
        const cache = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
        const updatedCache = [newOrder, ...cache.filter((o: any) => o.id !== newOrder.id && o.orderNumber !== newOrder.orderNumber)];
        localStorage.setItem('foodies_customer_history_cache', JSON.stringify(updatedCache));
        setMyPlacedOrderIds((prev) => {
          const next = new Set(prev);
          if (newOrder.id) next.add(newOrder.id);
          if (newOrder.orderNumber) next.add(String(newOrder.orderNumber));
          try {
            localStorage.setItem('foodies_my_placed_order_ids', JSON.stringify(Array.from(next)));
          } catch { }
          return next;
        });
      } catch (e) { }
    }

    // Register order in in-flight protection map immediately
    inFlightStatusRef.current.set(newOrder.id, {
      status: newOrder.status,
      sentToKitchen: newOrder.sentToKitchen,
      paymentStatus: newOrder.paymentStatus,
      paymentCollected: newOrder.paymentCollected,
      timestamp: Date.now(),
    });
    if (newOrder.orderNumber) {
      inFlightStatusRef.current.set(newOrder.orderNumber, {
        status: newOrder.status,
        sentToKitchen: newOrder.sentToKitchen,
        paymentStatus: newOrder.paymentStatus,
        paymentCollected: newOrder.paymentCollected,
        timestamp: Date.now(),
      });
    }

    try {
      store.dispatch(upsertReduxOrder(newOrder));
    } catch (e) { }

    setOrders((prev) => {
      const updated = [newOrder, ...prev.filter((o) => o.id !== newOrder.id && o.orderNumber !== newOrder.orderNumber)];
      try {
        localStorage.setItem('foodies_orders_live', JSON.stringify(updated));
      } catch (e) { }
      broadcastOrders(updated);
      return updated;
    });
    clearCart();
    setHasSelectedBranch(false);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('foodies_customer_selected_branch');
      } catch (e) { }
    }

    if (type === 'dine_in' && tableNumber) {
      setTables((prev) => {
        const updated = prev.map((t) =>
          t.number === tableNumber && (!t.branchId || normalizeBranchId(t.branchId) === normalizeBranchId(currentBranchId))
            ? { ...t, status: 'occupied' as const, currentOrderId: newOrder.id, seatedAt: 'Just now' }
            : t
        );
        broadcastTables(updated);
        return updated;
      });

      // Synchronize table occupancy to PostgreSQL immediately
      try {
        fetch('/api/tables', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({
            tableNumber,
            branchId: normalizeBranchId(currentBranchId),
            status: 'occupied',
            currentOrderId: newOrder.id,
          }),
        }).catch(() => { });
      } catch (e) { }
    }

    // Optimistic instant Order Placed notification (deduplicated with server by deterministic id)
    if (notificationSettings.events.orderPlaced !== false) {
      const orderTypeLabel = type === 'takeaway' ? 'Takeaway' : type === 'delivery' ? 'Delivery' : 'Dine-In';
      const localPlacedNotif: AppNotification = {
        id: `notif-placed-${newOrder.id}`,
        title: `Order Confirmed • ${orderTypeLabel} #${newOrder.orderNumber}`,
        message: `Your ${orderTypeLabel} order #${newOrder.orderNumber} is confirmed (${sanitizedItems.length} items • Rs. ${subtotal}). Sent to kitchen!`,
        type: 'success',
        category: type === 'takeaway' ? 'takeaway' : type === 'delivery' ? 'delivery' : 'dine_in',
        branchId: newOrder.branchId,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        orderType: type,
        senderId: newOrder.cashierId || newOrder.customerId,
        senderName: newOrder.cashierName || newOrder.customerName,
        senderRole: isWalkIn ? 'cashier' : 'customer',
        targetRoles: buildWebOrderNotificationRoles(type, notificationSettings),
        targetPlatform: notificationSettings.defaultPlatform || 'all',
        targetUserId: newOrder.customerId,
        targetCustomerPhone: newOrder.customerPhone,
        targetCustomerName: newOrder.customerName,
        targetWaiterId: newOrder.assignedWaiterId,
        targetWaiterName: newOrder.assignedWaiterName,
        targetRiderId: newOrder.assignedRiderId,
        targetRiderName: newOrder.assignedRiderName,
        eventKey: 'orderPlaced',
        readBy: [],
        createdAt: new Date().toISOString(),
      };
      seenNotifIdsRef.current.add(localPlacedNotif.id);
      setAllNotifications((prev) => [localPlacedNotif, ...prev.filter((n) => n.id !== localPlacedNotif.id)]);
      store.dispatch(addReduxNotification(localPlacedNotif));
    }

    if (routeToSupportFirst) {
      addToast({
        type: 'success',
        title: 'Order Directed to Customer Services!',
        message: `Order #${newOrder.orderNumber} received. Customer Services will review before kitchen dispatch.`,
      });
    } else {
      addToast({
        type: 'success',
        title: 'Order Placed Successfully!',
        message: `Order #${newOrder.orderNumber} sent directly to kitchen. Pay cash at the cafe.`,
      });
    }

    // Persist order to PostgreSQL database with Idempotency-Key and safely broadcast once confirmed in DB
    const idempotencyKey = `idem-${newOrder.id}-${newOrder.orderNumber}`;
    try {
      fetch('/api/orders', {
        method: 'POST',
        headers: {
          ...getClientAuthHeaders(),
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ ...newOrder, idempotencyKey }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.order) {
            // The order only exists on this device — staff will NOT see it. Tell the customer instead of failing silently.
            console.error('[orders] Server rejected order', newOrder.orderNumber, res.status, data);
            addToast({
              type: 'error',
              title: 'Order NOT sent to the cafe',
              message: `Order #${newOrder.orderNumber} could not be saved${data?.error ? `: ${data.error}` : ` (HTTP ${res.status})`}. Please try again or contact the branch.`,
            });
            return;
          }
          store.dispatch(upsertReduxOrder(data.order));
          broadcastStateMutation('SYNC_ORDERS', [data.order]);
        })
        .catch((err) => {
          console.error('[orders] Network error while sending order', newOrder.orderNumber, err);
          addToast({
            type: 'error',
            title: 'Order NOT sent to the cafe',
            message: `Order #${newOrder.orderNumber} could not reach the server. Check your internet connection and try again.`,
          });
        });
    } catch (e) { }

    return newOrder;
  };

  const sendOrderToKitchen = (orderId: string) => {
    let orderNum = '';
    let targetBranchId = currentBranchId;
    inFlightStatusRef.current.set(orderId, {
      status: 'accepted',
      sentToKitchen: true,
      timestamp: Date.now(),
    });

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          orderNum = ord.orderNumber;
          if (ord.branchId) targetBranchId = ord.branchId;
          inFlightStatusRef.current.set(ord.id, {
            status: 'accepted',
            sentToKitchen: true,
            timestamp: Date.now(),
          });
          if (ord.orderNumber) {
            inFlightStatusRef.current.set(ord.orderNumber, {
              status: 'accepted',
              sentToKitchen: true,
              timestamp: Date.now(),
            });
          }
          return {
            ...ord,
            status: 'accepted' as OrderStatus,
            sentToKitchen: true,
            sentToKitchenAt: new Date().toISOString(),
            forwardToKitchenAt: undefined,
          };
        }
        return ord;
      });
      broadcastOrders(updated);
      return updated;
    });

    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          status: 'accepted',
          sentToKitchen: true,
          sentToKitchenAt: new Date().toISOString(),
          forwardToKitchenAt: null,
          branchId: targetBranchId,
          actorId: currentUser?.id || 'cashier',
          actorName: currentUser?.name || 'Cashier',
          actorRole: currentRole || 'cashier',
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            console.error('[sendOrderToKitchen] Server PATCH error:', res.status);
          } else {
            const data = await res.json().catch(() => ({}));
            if (data?.order) {
              store.dispatch(upsertReduxOrder(data.order));
              broadcastStateMutation('SYNC_ORDERS', [data.order]);
            }
          }
        })
        .catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Dispatched to Kitchen 👨‍🍳',
      message: `Order #${orderNum || orderId} is verified and sent to the kitchen queue!`,
    });
  };

  const setOrderKitchenForwardTime = (orderId: string, customMinutes: number) => {
    let orderNum = '';
    const targetIso = new Date(Date.now() + customMinutes * 60 * 1000).toISOString();
    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          orderNum = ord.orderNumber;
          return {
            ...ord,
            autoForwardCustomMin: customMinutes,
            forwardToKitchenAt: targetIso,
          };
        }
        return ord;
      });
      broadcastOrders(updated);
      return updated;
    });

    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ orderId, autoForwardCustomMin: customMinutes, forwardToKitchenAt: targetIso }),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'info',
      title: 'Auto-Forward Time Set ⏱️',
      message: `Order #${orderNum || orderId} will automatically advance to kitchen in ${customMinutes} min${customMinutes > 1 ? 's' : ''}.`,
    });
  };

  const setAllOrdersKitchenForwardTime = (customMinutes: number) => {
    const targetIso = new Date(Date.now() + customMinutes * 60 * 1000).toISOString();
    let count = 0;
    const orderIdsToPatch: string[] = [];

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        // Apply strictly to active orders that have not yet been sent to kitchen
        if (
          !ord.sentToKitchen &&
          ord.status !== 'ready' &&
          ord.status !== 'completed' &&
          ord.status !== 'cancelled' &&
          ord.status !== 'delivered' &&
          ord.status !== 'served' &&
          ord.status !== 'out_for_delivery'
        ) {
          count++;
          orderIdsToPatch.push(ord.id);
          return {
            ...ord,
            autoForwardCustomMin: customMinutes,
            forwardToKitchenAt: targetIso,
          };
        }
        return ord;
      });
      broadcastOrders(updated);
      return updated;
    });

    orderIdsToPatch.forEach((id) => {
      try {
        fetch('/api/orders', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({ orderId: id, autoForwardCustomMin: customMinutes, forwardToKitchenAt: targetIso }),
        }).catch(() => { });
      } catch (e) { }
    });

    updateFooterSettings({
      autoForwardMode: 'timed',
      autoForwardKitchenMin: customMinutes,
    });

    addToast({
      type: 'success',
      title: 'Forwarding Timer Set for All Orders ⏱️',
      message: `Set to ${customMinutes} min${customMinutes > 1 ? 's' : ''} for active orders and all upcoming orders.`,
    });
  };

  const updateOrderStatus = (
    orderId: string,
    newStatus: OrderStatus,
    reason?: string,
    customNotification?: { title: string; message: string; type?: 'info' | 'success' | 'warning' }
  ) => {
    let orderNum = '';
    const inKitchen = newStatus === 'accepted' || newStatus === 'preparing' || newStatus === 'ready' || newStatus === 'served';

    // Optimistically record in-flight status so stale backend sync polls don't downgrade it
    inFlightStatusRef.current.set(orderId, {
      status: newStatus,
      sentToKitchen: inKitchen ? true : undefined,
      timestamp: Date.now(),
    });

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          orderNum = ord.orderNumber;
          inFlightStatusRef.current.set(ord.id, {
            status: newStatus,
            sentToKitchen: inKitchen ? true : ord.sentToKitchen,
            timestamp: Date.now(),
          });
          if (ord.orderNumber) {
            inFlightStatusRef.current.set(ord.orderNumber, {
              status: newStatus,
              sentToKitchen: inKitchen ? true : ord.sentToKitchen,
              timestamp: Date.now(),
            });
          }
          return {
            ...ord,
            status: newStatus,
            sentToKitchen: inKitchen ? true : ord.sentToKitchen,
            sentToKitchenAt: inKitchen && !ord.sentToKitchenAt ? new Date().toISOString() : ord.sentToKitchenAt,
            forwardToKitchenAt: inKitchen ? undefined : ord.forwardToKitchenAt,
            preparationStartedAt: newStatus === 'preparing' ? 'Just now' : ord.preparationStartedAt,
            completedAt: newStatus === 'completed' ? 'Just now' : ord.completedAt,
          };
        }
        return ord;
      });
      broadcastOrders(updated);
      if (typeof window !== 'undefined') {
        try {
          const cacheStr = localStorage.getItem('foodies_customer_history_cache');
          if (cacheStr) {
            const cache = JSON.parse(cacheStr);
            if (Array.isArray(cache)) {
              const updatedCache = cache.map((co: Order) => {
                if (co.id === orderId || co.orderNumber === orderId) {
                  return {
                    ...co,
                    status: newStatus,
                    sentToKitchen: inKitchen ? true : co.sentToKitchen,
                    preparationStartedAt: newStatus === 'preparing' ? 'Just now' : co.preparationStartedAt,
                    completedAt: newStatus === 'completed' ? 'Just now' : co.completedAt,
                  };
                }
                return co;
              });
              localStorage.setItem('foodies_customer_history_cache', JSON.stringify(updatedCache));
            }
          }
        } catch (e) { }
      }
      return updated;
    });

    // Asynchronously sync status update to PostgreSQL database
    const existingOrdForStatus = orders.find((o) => o.id === orderId || o.orderNumber === orderId);

    if (existingOrdForStatus && existingOrdForStatus.status !== newStatus) {
      const eventKey: NotificationEventKey =
        newStatus === 'preparing'
          ? 'cooking'
          : newStatus === 'ready'
            ? 'orderReady'
            : newStatus === 'out_for_delivery'
              ? 'outForDelivery'
              : newStatus === 'served'
                ? 'orderServed'
                : newStatus === 'completed' || newStatus === 'delivered' || newStatus === 'taken'
                  ? 'orderCompleted'
                  : newStatus === 'cancelled'
                    ? 'orderCancelled'
                    : 'sentToKitchen';

      if (notificationSettings.events[eventKey] !== false) {
        const oType = existingOrdForStatus.type || 'takeaway';
        const oNum = existingOrdForStatus.orderNumber || orderId;
        let sTitle = `Order #${oNum} • ${newStatus.toUpperCase()}`;
        let sMsg = `Order #${oNum} status updated to ${newStatus}.`;
        let sType: AppNotification['type'] = 'info';
        let sCat: NotificationCategory = oType === 'takeaway' ? 'takeaway' : oType === 'delivery' ? 'delivery' : 'dine_in';

        if (newStatus === 'preparing') {
          sTitle = `Order #${oNum} • Cooking in Kitchen 👨‍🍳`;
          sMsg = `Our chefs are actively preparing your fresh order #${oNum}.`;
          sCat = 'kitchen';
        } else if (newStatus === 'ready') {
          sType = 'success';
          if (oType === 'takeaway') {
            sTitle = `Order #${oNum} • Ready for Pickup! 🛍️`;
            sMsg = `Your Takeaway order #${oNum} is hot, packed, and ready at the counter!`;
          } else if (oType === 'dine_in') {
            sTitle = `Order #${oNum} • Ready to Serve 🍽️`;
            sMsg = `Your Dine-In order #${oNum}${existingOrdForStatus.tableNumber ? ` (Table ${existingOrdForStatus.tableNumber})` : ''} is ready and being served to your table!`;
          } else {
            sTitle = `Order #${oNum} • Packed & Ready 🛵`;
            sMsg = `Your Delivery order #${oNum} is packed and ready for rider dispatch.`;
          }
        } else if (newStatus === 'out_for_delivery') {
          sTitle = `Order #${oNum} • Out for Delivery 🛵`;
          sMsg = `Your rider is on the way with your order #${oNum}!`;
        } else if (newStatus === 'served') {
          sType = 'success';
          sTitle = `Order #${oNum} • Served 🍽️`;
          sMsg = `Your order #${oNum} has been served at Table ${existingOrdForStatus.tableNumber || '-'}. Enjoy your meal!`;
        } else if (newStatus === 'completed' || newStatus === 'delivered' || newStatus === 'taken') {
          sType = 'success';
          sTitle = `Order #${oNum} • Delivered & Completed ✓`;
          sMsg = `Your order #${oNum} has been completed. Thank you for dining with Foodies Cafe!`;
        } else if (newStatus === 'cancelled') {
          sType = 'error';
          sTitle = `Order #${oNum} • Cancelled`;
          sMsg = `Order #${oNum} was cancelled.`;
        }

        const optimisticStatusNotif: AppNotification = {
          // Same id the server uses for this event, so the optimistic copy and the server copy are one notification.
          id: orderNotificationId(existingOrdForStatus.id, { kind: 'status', status: newStatus }),
          title: sTitle,
          message: sMsg,
          type: sType,
          category: sCat,
          branchId: existingOrdForStatus.branchId || currentBranchId,
          orderId: existingOrdForStatus.id,
          orderNumber: oNum,
          orderType: oType,
          senderId: currentUser?.id || 'system',
          senderName: currentUser?.name || 'Staff',
          senderRole: currentRole || 'cashier',
          targetRoles: buildWebOrderNotificationRoles(oType, notificationSettings),
          targetPlatform: notificationSettings.defaultPlatform || 'all',
          targetUserId: existingOrdForStatus.customerId,
          targetCustomerPhone: existingOrdForStatus.customerPhone,
          targetCustomerName: existingOrdForStatus.customerName,
          targetWaiterId: existingOrdForStatus.assignedWaiterId,
          targetWaiterName: existingOrdForStatus.assignedWaiterName,
          targetRiderId: existingOrdForStatus.assignedRiderId,
          targetRiderName: existingOrdForStatus.assignedRiderName,
          eventKey,
          readBy: currentUser?.id ? [currentUser.id] : [],
          createdAt: new Date().toISOString(),
        };
        seenNotifIdsRef.current.add(optimisticStatusNotif.id);
        setAllNotifications((prev) => [optimisticStatusNotif, ...prev.filter((n) => n.id !== optimisticStatusNotif.id)]);
        store.dispatch(addReduxNotification(optimisticStatusNotif));
      }
    }
    try {
      const updatedSnapshot: Order | undefined = existingOrdForStatus
        ? {
            ...existingOrdForStatus,
            status: newStatus,
            sentToKitchen: inKitchen ? true : existingOrdForStatus.sentToKitchen,
            sentToKitchenAt: inKitchen && !existingOrdForStatus.sentToKitchenAt ? new Date().toISOString() : existingOrdForStatus.sentToKitchenAt,
            forwardToKitchenAt: inKitchen ? undefined : existingOrdForStatus.forwardToKitchenAt,
            completedAt: newStatus === 'completed' ? new Date().toISOString() : existingOrdForStatus.completedAt,
          }
        : undefined;
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          type: existingOrdForStatus?.type,
          status: newStatus,
          expectedVersion: existingOrdForStatus?.version,
          actorId: currentUser?.id,
          actorName: currentUser?.name,
          actorRole: currentRole,
          branchId: existingOrdForStatus?.branchId || currentBranchId,
          sentToKitchen: inKitchen ? true : undefined,
          sentToKitchenAt: inKitchen ? new Date().toISOString() : undefined,
          forwardToKitchenAt: inKitchen ? null : undefined,
          preparationStartedAt: newStatus === 'preparing' ? new Date().toISOString() : undefined,
          completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined,
          orderSnapshot: updatedSnapshot,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            console.error('[updateOrderStatus] Server PATCH error:', res.status);
          } else {
            const data = await res.json().catch(() => ({}));
            if (data?.order) {
              store.dispatch(upsertReduxOrder(data.order));
              broadcastStateMutation('SYNC_ORDERS', [data.order]);
            }
          }
        })
        .catch(() => { });
    } catch (e) { }

    if (newStatus === 'completed' || newStatus === 'cancelled' || newStatus === 'delivered' || newStatus === 'taken') {
      const targetOrd = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
      if (targetOrd?.tableNumber) {
        setTables((prev) => {
          const updated = prev.map((t) =>
            String(t.number) === String(targetOrd.tableNumber) || String(t.id) === String(targetOrd.tableNumber)
              ? { ...t, status: 'available' as const, currentOrderId: undefined, seatedAt: undefined }
              : t
          );
          broadcastTables(updated);
          return updated;
        });

        try {
          fetch('/api/tables', {
            method: 'PATCH',
            headers: getClientAuthHeaders(),
            body: JSON.stringify({
              tableNumber: targetOrd.tableNumber,
              branchId: targetOrd.branchId || currentBranchId,
              status: 'available',
            }),
          }).catch(() => { });
        } catch (e) { }
      }
    }

    if (customNotification) {
      addToast({
        type: customNotification.type || 'info',
        title: customNotification.title,
        message: customNotification.message,
      });
    } else {
      const statusTitle =
        newStatus === 'completed'
          ? 'Order Completed ✓'
          : newStatus === 'ready'
            ? 'Order Kitchen Ready 🍽️'
            : newStatus === 'served'
              ? 'Order Sent to Waiter 🍽️'
              : newStatus === 'out_for_delivery'
                ? 'Order Out for Delivery 🛵'
                : newStatus === 'preparing'
                  ? 'Cooking in Kitchen 👨‍🍳'
                  : 'Order Status Updated';

      addToast({
        type: newStatus === 'completed' ? 'success' : 'info',
        title: statusTitle,
        message: `Order #${orderNum || orderId} status changed to ${newStatus.toUpperCase()}${reason ? ` (${reason})` : ''}.`,
      });
    }
  };

  // Delivery Rider Actions
  // Server rejected a rider change (409): drop the optimistic overlay and show the server's rider.
  const revertRiderAssignmentToServer = (orderId: string, serverOrder?: Partial<Order> | null) => {
    if (!serverOrder) return;
    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id !== orderId && ord.orderNumber !== orderId && ord.id !== serverOrder.id) return ord;
        inFlightStatusRef.current.delete(ord.id);
        if (ord.orderNumber) inFlightStatusRef.current.delete(ord.orderNumber);
        return {
          ...ord,
          assignedRiderId: serverOrder.assignedRiderId || undefined,
          assignedRiderName: serverOrder.assignedRiderName || undefined,
          riderStatus: serverOrder.riderStatus || undefined,
        };
      });
      try {
        localStorage.setItem('foodies_orders_live', JSON.stringify(updated));
      } catch (e) { }
      broadcastOrders(updated);
      return updated;
    });
  };

  const assignRiderToOrder = (orderId: string, riderId: string, silent = false) => {
    const rider = users.find((u) => u.id === riderId);
    const riderName = rider?.name || 'Assigned Rider';
    let orderNum = '';

    const prevInFlight = inFlightStatusRef.current.get(orderId);
    inFlightStatusRef.current.set(orderId, {
      status: prevInFlight?.status || 'placed',
      sentToKitchen: prevInFlight?.sentToKitchen,
      assignedRiderId: riderId,
      assignedRiderName: riderName,
      riderStatus: 'assigned',
      timestamp: Date.now(),
    });

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          orderNum = ord.orderNumber;
          inFlightStatusRef.current.set(ord.id, {
            status: ord.status,
            sentToKitchen: ord.sentToKitchen,
            assignedRiderId: riderId,
            assignedRiderName: riderName,
            riderStatus: 'assigned',
            timestamp: Date.now(),
          });
          if (ord.orderNumber) {
            inFlightStatusRef.current.set(ord.orderNumber, {
              status: ord.status,
              sentToKitchen: ord.sentToKitchen,
              assignedRiderId: riderId,
              assignedRiderName: riderName,
              riderStatus: 'assigned',
              timestamp: Date.now(),
            });
          }
          return {
            ...ord,
            assignedRiderId: riderId,
            assignedRiderName: riderName,
            riderStatus: 'assigned' as const,
          };
        }
        return ord;
      });
      try {
        localStorage.setItem('foodies_orders_live', JSON.stringify(updated));
      } catch (e) { }
      broadcastOrders(updated);
      return updated;
    });

    // NOTE: Rider is NOT marked busy upon initial assignment!
    // Rider remains available at cafe/branch until he explicitly clicks "Depart for Delivery".
    // This allows Customer Support to assign 1, 2, or more orders and freely reassign/change before departure.
    setUsers((prev) => {
      const updated = prev.map((u) =>
        u.id === riderId ? { ...u, riderActiveOrderId: u.riderActiveOrderId || orderId } : u
      );
      try {
        localStorage.setItem('foodies_users_live', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    setCurrentUser((prev) => {
      if (prev && prev.id === riderId) {
        const updated = { ...prev, riderActiveOrderId: prev.riderActiveOrderId || orderId };
        try {
          localStorage.setItem('foodies_current_user', JSON.stringify(updated));
        } catch (e) { }
        return updated;
      }
      return prev;
    });

    // Asynchronously sync order update to PostgreSQL.
    // `silent` is the auto-assign path: it must never replace a rider another terminal already set.
    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          assignedRiderId: riderId,
          assignedRiderName: riderName,
          riderStatus: 'assigned',
          ...(silent ? { onlyIfUnassigned: true } : {}),
        }),
      })
        .then(async (res) => {
          if (res.ok || res.status !== 409) return;
          const data = await res.json().catch(() => null);
          revertRiderAssignmentToServer(orderId, data?.order);
          if (!silent) {
            addToast({
              type: 'error',
              title: 'Rider Not Changed',
              message: data?.error || 'This order already has a rider.',
            });
          }
        })
        .catch(() => { });
    } catch (e) { }

    if (!silent) {
      addToast({
        type: 'success',
        title: 'Rider Assigned! 🛵',
        message: `Order #${orderNum || orderId} assigned to ${riderName}. You can assign more orders or change before departure.`,
      });
    }
  };

  const acceptRiderOrder = (orderId: string) => {
    let orderNum = '';
    const prevInFlight = inFlightStatusRef.current.get(orderId);
    inFlightStatusRef.current.set(orderId, {
      status: prevInFlight?.status || 'placed',
      sentToKitchen: prevInFlight?.sentToKitchen,
      assignedRiderId: prevInFlight?.assignedRiderId,
      assignedRiderName: prevInFlight?.assignedRiderName,
      riderStatus: 'accepted',
      timestamp: Date.now(),
    });

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          orderNum = ord.orderNumber;
          inFlightStatusRef.current.set(ord.id, {
            status: ord.status,
            sentToKitchen: ord.sentToKitchen,
            assignedRiderId: ord.assignedRiderId,
            assignedRiderName: ord.assignedRiderName,
            riderStatus: 'accepted',
            timestamp: Date.now(),
          });
          if (ord.orderNumber) {
            inFlightStatusRef.current.set(ord.orderNumber, {
              status: ord.status,
              sentToKitchen: ord.sentToKitchen,
              assignedRiderId: ord.assignedRiderId,
              assignedRiderName: ord.assignedRiderName,
              riderStatus: 'accepted',
              timestamp: Date.now(),
            });
          }
          return {
            ...ord,
            riderStatus: 'accepted' as const,
          };
        }
        return ord;
      });
      try {
        localStorage.setItem('foodies_orders_live', JSON.stringify(updated));
      } catch (e) { }
      broadcastOrders(updated);
      return updated;
    });

    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          riderStatus: 'accepted',
          // Claim the order for this rider; the server rejects it if another rider has it.
          ...(currentUser?.role === 'delivery_staff'
            ? { assignedRiderId: currentUser.id, assignedRiderName: currentUser.name, actorRole: 'delivery_staff', actorId: currentUser.id, actorName: currentUser.name }
            : {}),
        }),
      })
        .then(async (res) => {
          if (res.ok || res.status !== 409) return;
          const data = await res.json().catch(() => null);
          revertRiderAssignmentToServer(orderId, data?.order);
          addToast({
            type: 'error',
            title: 'Order Taken',
            message: data?.error || 'Another rider already has this order.',
          });
        })
        .catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Order Accepted! 🛵',
      message: `You have accepted delivery for Order #${orderNum || orderId}. Cashier cannot reassign this order.`,
    });
  };

  const departRider = (riderId: string) => {
    const rider = users.find((u) => u.id === riderId);
    const riderName = rider?.name || 'Rider';
    const activeAssigned = orders.filter(
      (o) => o.assignedRiderId === riderId && o.type === 'delivery' && o.status !== 'completed' && o.status !== 'cancelled'
    );

    if (activeAssigned.length === 0) {
      addToast({
        type: 'warning',
        title: 'No Orders Assigned',
        message: 'You do not have any active assigned orders to depart with.',
      });
      return;
    }

    const orderIds = activeAssigned.map((o) => o.id);

    // 1. Mark orders as out_for_delivery
    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (orderIds.includes(ord.id) || (ord.assignedRiderId === riderId && ord.type === 'delivery' && ord.status !== 'completed' && ord.status !== 'cancelled')) {
          return {
            ...ord,
            status: 'out_for_delivery' as OrderStatus,
            riderStatus: 'en_route' as const,
            dispatchedAt: new Date().toISOString(),
          };
        }
        return ord;
      });
      try {
        localStorage.setItem('foodies_orders_live', JSON.stringify(updated));
      } catch (e) { }
      broadcastOrders(updated);
      return updated;
    });

    // 2. Mark rider status as busy
    setUsers((prev) => {
      const updated = prev.map((u) =>
        u.id === riderId ? { ...u, riderAvailability: 'busy' as const, riderActiveOrderId: orderIds[0] } : u
      );
      try {
        localStorage.setItem('foodies_users_live', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    setCurrentUser((prev) => {
      if (prev && prev.id === riderId) {
        const updated = { ...prev, riderAvailability: 'busy' as const, riderActiveOrderId: orderIds[0] };
        try {
          localStorage.setItem('foodies_current_user', JSON.stringify(updated));
        } catch (e) { }
        return updated;
      }
      return prev;
    });

    // 3. Persist rider busy availability to PostgreSQL
    try {
      fetch('/api/users', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          id: riderId,
          riderAvailability: 'busy',
          riderActiveOrderId: orderIds[0],
        }),
      }).catch(() => { });
    } catch (e) { }

    // 4. Persist orders status update to PostgreSQL
    orderIds.forEach((oId) => {
      try {
        fetch('/api/orders', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({
            orderId: oId,
            status: 'out_for_delivery',
            riderStatus: 'en_route',
          }),
        }).catch(() => { });
      } catch (e) { }
    });

    addToast({
      type: 'info',
      title: '🚀 Departure Confirmed!',
      message: `${riderName} is now Busy. ${activeAssigned.length} ${activeAssigned.length === 1 ? 'order' : 'orders'} out for delivery. Customer Support cannot assign further orders until return.`,
    });
  };

  const unassignRiderFromOrder = (orderId: string) => {
    let prevRiderId: string | undefined;
    let orderNum = '';

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          prevRiderId = ord.assignedRiderId;
          orderNum = ord.orderNumber;
          return {
            ...ord,
            assignedRiderId: undefined,
            assignedRiderName: undefined,
            riderStatus: undefined,
          };
        }
        return ord;
      });
      try {
        localStorage.setItem('foodies_orders_live', JSON.stringify(updated));
      } catch (e) { }
      broadcastOrders(updated);
      return updated;
    });

    if (prevRiderId) {
      // Check if rider has any other active delivery orders remaining
      const remainingOrders = orders.filter(
        (o) => o.assignedRiderId === prevRiderId && o.id !== orderId && o.orderNumber !== orderId && o.status !== 'completed' && o.status !== 'cancelled'
      );
      if (remainingOrders.length === 0) {
        setUsers((prev) => {
          const updated = prev.map((u) =>
            u.id === prevRiderId ? { ...u, riderAvailability: 'available' as const, riderActiveOrderId: undefined } : u
          );
          try {
            localStorage.setItem('foodies_users_live', JSON.stringify(updated));
          } catch (e) { }
          return updated;
        });

        setCurrentUser((prev) => {
          if (prev && prev.id === prevRiderId) {
            const updated = { ...prev, riderAvailability: 'available' as const, riderActiveOrderId: undefined };
            try {
              localStorage.setItem('foodies_current_user', JSON.stringify(updated));
            } catch (e) { }
            return updated;
          }
          return prev;
        });

        try {
          fetch('/api/users', {
            method: 'PATCH',
            headers: getClientAuthHeaders(),
            body: JSON.stringify({
              id: prevRiderId,
              riderAvailability: 'available',
              riderActiveOrderId: null,
            }),
          }).catch(() => { });
        } catch (e) { }
      }
    }

    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          assignedRiderId: null,
          assignedRiderName: null,
          riderStatus: null,
        }),
      })
        .then(async (res) => {
          if (res.ok || res.status !== 409) return;
          const data = await res.json().catch(() => null);
          revertRiderAssignmentToServer(orderId, data?.order);
          addToast({
            type: 'error',
            title: 'Rider Not Changed',
            message: data?.error || 'The rider has already accepted this order.',
          });
        })
        .catch(() => { });
    } catch (e) { }

    addToast({
      type: 'info',
      title: 'Rider Unassigned',
      message: `Order #${orderNum || orderId} is now unassigned.`,
    });
  };

  const finishRiderDelivery = (orderId: string, paymentCollected?: boolean) => {
    let completedOrderNumber = '';
    let riderIdToFree: string | undefined = undefined;
    let newDeliveries = 0;
    let remainingForRider = 0;

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          completedOrderNumber = ord.orderNumber;
          riderIdToFree = ord.assignedRiderId;
          return {
            ...ord,
            status: 'completed' as OrderStatus,
            paymentStatus: (paymentCollected || ord.paymentMethod !== 'COD') ? ('paid' as PaymentStatus) : ord.paymentStatus,
            riderStatus: 'delivered' as const,
            completedAt: new Date().toISOString(),
            deliveredAt: new Date().toISOString(),
            paymentCollected: paymentCollected ?? true,
          };
        }
        return ord;
      });

      if (riderIdToFree) {
        remainingForRider = updated.filter(
          (o) => o.assignedRiderId === riderIdToFree && o.status !== 'completed' && o.status !== 'cancelled'
        ).length;
      }

      try {
        localStorage.setItem('foodies_orders_live', JSON.stringify(updated));
      } catch (e) { }
      broadcastOrders(updated);
      return updated;
    });

    if (riderIdToFree) {
      const shouldBeAvailable = remainingForRider === 0;
      const nextAvailability = shouldBeAvailable ? ('available' as const) : ('busy' as const);

      setUsers((prev) => {
        const updated = prev.map((u) => {
          if (u.id === riderIdToFree) {
            newDeliveries = (u.riderTotalDeliveries || 0) + 1;
            return {
              ...u,
              riderAvailability: nextAvailability,
              riderActiveOrderId: shouldBeAvailable ? undefined : u.riderActiveOrderId,
              riderTotalDeliveries: newDeliveries,
            };
          }
          return u;
        });
        try {
          localStorage.setItem('foodies_users_live', JSON.stringify(updated));
        } catch (e) { }
        return updated;
      });

      setCurrentUser((prev) => {
        if (prev && prev.id === riderIdToFree) {
          const updated = {
            ...prev,
            riderAvailability: nextAvailability,
            riderActiveOrderId: shouldBeAvailable ? undefined : prev.riderActiveOrderId,
            riderTotalDeliveries: newDeliveries,
          };
          try {
            localStorage.setItem('foodies_current_user', JSON.stringify(updated));
          } catch (e) { }
          return updated;
        }
        return prev;
      });

      try {
        fetch('/api/users', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({
            id: riderIdToFree,
            riderAvailability: nextAvailability,
            riderActiveOrderId: shouldBeAvailable ? null : undefined,
            riderTotalDeliveries: newDeliveries,
          }),
        }).catch(() => { });
      } catch (e) { }
    }

    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          status: 'completed',
          paymentStatus: paymentCollected ? 'paid' : 'paid',
          riderStatus: 'delivered',
          deliveredAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          paymentCollected: paymentCollected ?? true,
        }),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Delivery Finished! ✅',
      message: `Order #${completedOrderNumber} marked as delivered successfully.`,
    });
  };

  const updateRiderAvailability = (riderId: string, status: 'available' | 'busy' | 'offline') => {
    setUsers((prev) => {
      const updated = prev.map((u) => (u.id === riderId ? { ...u, riderAvailability: status } : u));
      try {
        localStorage.setItem('foodies_users_live', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    setCurrentUser((prev) => {
      if (prev && prev.id === riderId) {
        const updated = { ...prev, riderAvailability: status };
        try {
          localStorage.setItem('foodies_current_user', JSON.stringify(updated));
        } catch (e) { }
        return updated;
      }
      return prev;
    });

    try {
      fetch('/api/users', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          id: riderId,
          riderAvailability: status,
        }),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'info',
      title: 'Rider Status Updated',
      message: `Status is now ${status === 'available' ? 'Online / Ready' : status === 'offline' ? 'Offline' : 'Busy'}.`,
    });
  };

  const recordCashPayment = (orderId: string, amountReceived: number) => {
    let change = 0;
    const ord = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    const addedAmount = ord ? Number(ord.total) : amountReceived;

    const targetBranch = normalizeBranchId(ord?.branchId || currentBranchId);
    const targetShift =
      (currentShift && currentShift.status === 'open' ? currentShift : null) ||
      shifts.find(
        (sh) =>
          sh.cashierId === currentUser.id &&
          sh.status === 'open' &&
          (normalizeBranchId(sh.branchId) === targetBranch || sh.branchId === targetBranch)
      ) ||
      shifts.find(
        (sh) =>
          sh.status === 'open' &&
          (normalizeBranchId(sh.branchId) === targetBranch || sh.branchId === targetBranch)
      ) ||
      shifts[0] ||
      DEFAULT_OPEN_SHIFT;

    const targetShiftId = targetShift.id || 'sh-today-1';

    // Only promote to completed if already served, taken, or delivered; if still in kitchen preparation, keep active cooking status
    const shouldCompleteOrder =
      ord?.status === 'served' ||
      ord?.status === 'taken' ||
      ord?.status === 'delivered' ||
      ord?.status === 'completed';
    const targetStatus = shouldCompleteOrder ? 'completed' : (ord?.status || 'accepted');

    // 1. Immediately record in-flight payment lock to prevent race conditions from background polling
    inFlightStatusRef.current.set(orderId, {
      status: targetStatus,
      paymentStatus: 'paid',
      paymentCollected: true,
      timestamp: Date.now(),
    });
    if (ord?.orderNumber) {
      inFlightStatusRef.current.set(ord.orderNumber, {
        status: targetStatus,
        paymentStatus: 'paid',
        paymentCollected: true,
        timestamp: Date.now(),
      });
    }

    setOrders((prev) => {
      const updated = prev.map((item) => {
        if (item.id === orderId || item.orderNumber === orderId) {
          change = Math.max(0, amountReceived - Number(item.total));
          return {
            ...item,
            paymentStatus: 'paid' as const,
            paymentCollected: true,
            status: targetStatus as OrderStatus,
            cashierId: currentUser.id,
            cashierName: currentUser.name,
            shiftId: targetShiftId,
          };
        }
        return item;
      });
      broadcastOrders(updated);
      return updated;
    });

    // Asynchronously sync payment status, cashier attribution, and completion to PostgreSQL database
    try {
      const cashSnapshot: Order | undefined = ord
        ? {
            ...ord,
            paymentStatus: 'paid',
            paymentCollected: true,
            status: targetStatus as OrderStatus,
            cashierId: currentUser.id,
            cashierName: currentUser.name,
            shiftId: targetShiftId,
          }
        : undefined;
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          type: ord?.type,
          paymentStatus: 'paid',
          paymentCollected: true,
          status: targetStatus,
          cashierId: currentUser.id,
          cashierName: currentUser.name,
          actorId: currentUser.id,
          actorName: currentUser.name,
          actorRole: currentRole || 'cashier',
          shiftId: targetShiftId,
          orderSnapshot: cashSnapshot,
        }),
      }).catch(() => { });
    } catch (e) { }

    // When cashier/customer proceeds order of cash after eating/leaving, automatically mark table free!
    if (ord?.tableNumber) {
      setTables((prev) => {
        const next = prev.map((t) =>
          t.number === ord.tableNumber || t.id === ord.tableNumber
            ? { ...t, status: 'available' as const, reservedFor: undefined, currentOrderId: undefined }
            : t
        );
        broadcastTables(next);
        return next;
      });

      setActiveTableSessionState((prev) => {
        if (prev && (prev.tableNumber === ord.tableNumber || prev.tableId === ord.tableNumber || prev.orderId === ord.id)) {
          if (typeof window !== 'undefined') localStorage.removeItem('foodies_active_table_session');
          return null;
        }
        return prev;
      });

      try {
        fetch('/api/tables', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({
            tableNumber: ord.tableNumber,
            status: 'available',
          }),
        }).catch(() => { });
      } catch (e) { }
    }

    const currentCollected = Number(targetShift.cashCollected || 0);
    const currentExpected = Number(targetShift.expectedCash || (targetShift.openingFloat || 0));
    const nextCashCollected = currentCollected + addedAmount;
    const nextExpectedCash = currentExpected + addedAmount;

    setShifts((prev) => {
      let found = false;
      const updated = prev.map((sh) => {
        if (sh.id === targetShiftId) {
          found = true;
          return {
            ...sh,
            cashCollected: Number(sh.cashCollected || 0) + addedAmount,
            expectedCash: Number(sh.expectedCash || (sh.openingFloat || 0)) + addedAmount,
          };
        }
        return sh;
      });

      const finalShifts = found
        ? updated
        : [
          ...prev,
          {
            id: targetShiftId,
            cashierId: currentUser.id || 'user-cashier',
            cashierName: currentUser.name || 'Bilal Farooq',
            branchId: currentBranchId,
            openingFloat: 0,
            cashCollected: nextCashCollected,
            expectedCash: nextExpectedCash,
            status: 'open' as const,
            openedAt: new Date().toISOString(),
          },
        ];

      broadcastShifts(finalShifts);
      try {
        localStorage.setItem('foodies_shifts_live', JSON.stringify(finalShifts));
      } catch (e) { }
      return finalShifts;
    });

    // Asynchronously persist shift totals to PostgreSQL
    try {
      fetch('/api/shifts', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          shiftId: targetShiftId,
          cashCollected: nextCashCollected,
          expectedCash: nextExpectedCash,
        }),
      }).catch((err) => console.error('Failed to sync shift to DB:', err));
    } catch (e) { }

    const tableInfo = ord?.tableNumber ? ` · Table #${ord.tableNumber} is now free` : '';
    addToast({
      type: 'success',
      title: 'Payment Settled & Bill Closed ✓',
      message: `Order #${ord?.orderNumber || orderId} settled (Rs. ${Number(ord?.total || amountReceived).toLocaleString()}). Change due: Rs. ${change.toLocaleString()}${tableInfo}.`,
    });

    return { change, success: true };
  };

  const updateOrderPayment = (orderId: string, paymentStatus: PaymentStatus) => {
    const targetOrder = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    const isDeliveryFinished =
      targetOrder?.type === 'delivery' &&
      (targetOrder?.status === 'delivered' ||
        targetOrder?.status === 'out_for_delivery' ||
        targetOrder?.riderStatus === 'delivered');
    const isFulfilledAndCompleted =
      paymentStatus === 'paid' &&
      (targetOrder?.status === 'served' ||
        targetOrder?.status === 'taken' ||
        targetOrder?.status === 'delivered' ||
        targetOrder?.status === 'completed' ||
        targetOrder?.riderStatus === 'delivered' ||
        isDeliveryFinished);

    const targetStatus: OrderStatus | undefined = isFulfilledAndCompleted
      ? 'completed'
      : paymentStatus === 'paid' && targetOrder?.status === 'placed'
        ? 'accepted'
        : undefined;
    const targetRiderStatus =
      isFulfilledAndCompleted && targetOrder?.type === 'delivery' ? ('delivered' as const) : undefined;
    const nowIso = new Date().toISOString();

    inFlightStatusRef.current.set(orderId, {
      paymentStatus,
      paymentCollected: paymentStatus === 'paid',
      status: targetStatus,
      riderStatus: targetRiderStatus,
      timestamp: Date.now(),
    });
    if (targetOrder?.orderNumber) {
      inFlightStatusRef.current.set(targetOrder.orderNumber, {
        paymentStatus,
        paymentCollected: paymentStatus === 'paid',
        status: targetStatus,
        riderStatus: targetRiderStatus,
        timestamp: Date.now(),
      });
    }

    setOrders((prev) => {
      const updated = prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        const itemFulfilled =
          paymentStatus === 'paid' &&
          (o.status === 'served' ||
            o.status === 'taken' ||
            o.status === 'delivered' ||
            o.status === 'completed' ||
            o.riderStatus === 'delivered' ||
            (o.type === 'delivery' && o.status === 'out_for_delivery'));
        return {
          ...o,
          paymentStatus,
          paymentCollected: paymentStatus === 'paid',
          status: itemFulfilled
            ? ('completed' as OrderStatus)
            : paymentStatus === 'paid' && o.status === 'placed'
              ? ('accepted' as OrderStatus)
              : o.status,
          riderStatus:
            itemFulfilled && o.type === 'delivery' ? ('delivered' as const) : o.riderStatus,
          completedAt: itemFulfilled ? o.completedAt || nowIso : o.completedAt,
          deliveredAt: itemFulfilled ? o.deliveredAt || nowIso : o.deliveredAt,
        };
      });
      broadcastOrders(updated);
      return updated;
    });

    try {
      const paymentSnapshot: Order | undefined = targetOrder
        ? {
            ...targetOrder,
            paymentStatus,
            paymentCollected: paymentStatus === 'paid',
            status: targetStatus || targetOrder.status,
            riderStatus: targetRiderStatus || targetOrder.riderStatus,
            completedAt: isFulfilledAndCompleted ? targetOrder.completedAt || nowIso : targetOrder.completedAt,
            deliveredAt: isFulfilledAndCompleted ? targetOrder.deliveredAt || nowIso : targetOrder.deliveredAt,
          }
        : undefined;
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          type: targetOrder?.type,
          paymentStatus,
          paymentCollected: paymentStatus === 'paid',
          status: targetStatus,
          riderStatus: targetRiderStatus,
          completedAt: isFulfilledAndCompleted ? nowIso : undefined,
          deliveredAt: isFulfilledAndCompleted ? nowIso : undefined,
          actorId: currentUser?.id,
          actorName: currentUser?.name,
          actorRole: currentRole || 'floor_staff',
          orderSnapshot: paymentSnapshot,
        }),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Payment Status Updated',
      message: `Order #${orderId} payment marked as ${paymentStatus.toUpperCase()}.`,
    });
  };

  const editOrderStage1 = (orderId: string, updatedItems: OrderItem[]) => {
    const newSubtotal = updatedItems.reduce((acc, i) => acc + Number(i.unitPrice) * Number(i.quantity), 0);
    let updatedTotal = newSubtotal;
    let prevVersion = 1;
    let nextVersion = 2;

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          updatedTotal = newSubtotal + Number(ord.addOnSubtotal || 0);
          prevVersion = Number(ord.version) || 1;
          nextVersion = prevVersion + 1;
          return {
            ...ord,
            items: updatedItems,
            originalSubtotal: newSubtotal,
            total: updatedTotal,
            version: nextVersion,
          };
        }
        return ord;
      });
      broadcastOrders(updated);
      return updated;
    });

    // Asynchronously sync edit to PostgreSQL database
    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          items: updatedItems,
          originalSubtotal: newSubtotal,
          total: updatedTotal,
          expectedVersion: prevVersion,
          version: nextVersion,
          actorId: currentUser?.id,
          actorName: currentUser?.name,
          actorRole: currentRole || 'floor_staff',
        }),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Order Updated',
      message: 'Items and quantities updated successfully.',
    });
  };

  const addAddOnsToOrderStage2 = (orderId: string, addOnItems: OrderItem[]) => {
    const addOnTotal = addOnItems.reduce((acc, i) => acc + Number(i.unitPrice) * Number(i.quantity), 0);
    let combinedItems: OrderItem[] = [];
    let newAddOnSubtotal = 0;
    let updatedTotal = 0;
    let prevVersion = 1;
    let nextVersion = 2;

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          const markedAddOns = addOnItems.map((item) => ({
            ...item,
            isAddOn: true,
            addedAtStage: 'stage2' as const,
          }));
          combinedItems = [...ord.items, ...markedAddOns];
          newAddOnSubtotal = Number(ord.addOnSubtotal || 0) + addOnTotal;
          updatedTotal = Number(ord.originalSubtotal || 0) + newAddOnSubtotal;
          prevVersion = Number(ord.version) || 1;
          nextVersion = prevVersion + 1;
          return {
            ...ord,
            items: combinedItems,
            addOnSubtotal: newAddOnSubtotal,
            total: updatedTotal,
            version: nextVersion,
          };
        }
        return ord;
      });
      broadcastOrders(updated);
      return updated;
    });

    // Asynchronously sync add-ons to PostgreSQL database
    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          items: combinedItems,
          addOnSubtotal: newAddOnSubtotal,
          total: updatedTotal,
          expectedVersion: prevVersion,
          version: nextVersion,
          actorId: currentUser?.id,
          actorName: currentUser?.name,
          actorRole: currentRole || 'floor_staff',
        }),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Add-ons Added to Order',
      message: `Kitchen notified of NEW ADD-ON (+Rs. ${addOnTotal.toLocaleString()}).`,
    });
  };

  const cancelOrder = (orderId: string, reason: string) => {
    const targetOrd = orders.find((o) => o.id === orderId || o.orderNumber === orderId);

    // Rule: Customer cannot cancel once support accepts or kitchen starts
    if (currentRole === 'customer') {
      if (targetOrd && (targetOrd.status !== 'placed' || targetOrd.sentToKitchen)) {
        addToast({
          type: 'error',
          title: 'Order Cannot Be Cancelled',
          message: 'This order has already been accepted by customer support / kitchen and cannot be cancelled.',
        });
        return;
      }
    }

    // 1. Immediately record in-flight cancellation lock
    inFlightStatusRef.current.set(orderId, { status: 'cancelled', timestamp: Date.now() });

    if (targetOrd?.orderNumber) {
      inFlightStatusRef.current.set(targetOrd.orderNumber, { status: 'cancelled', timestamp: Date.now() });
    }

    // 2. If delivery rider was assigned, free the rider back to available status
    if (targetOrd?.assignedRiderId) {
      const riderId = targetOrd.assignedRiderId;
      setUsers((prev) => {
        const remainingForRider = orders.filter(
          (o) =>
            o.assignedRiderId === riderId &&
            o.id !== targetOrd.id &&
            o.orderNumber !== targetOrd.orderNumber &&
            o.status !== 'completed' &&
            o.status !== 'cancelled'
        ).length;
        const shouldBeAvailable = remainingForRider === 0;
        const updated = prev.map((u) => {
          if (u.id === riderId) {
            return {
              ...u,
              riderAvailability: shouldBeAvailable ? ('available' as const) : u.riderAvailability,
              riderActiveOrderId: shouldBeAvailable ? undefined : u.riderActiveOrderId,
            };
          }
          return u;
        });
        try {
          localStorage.setItem('foodies_users_live', JSON.stringify(updated));
        } catch (e) { }
        return updated;
      });

      setCurrentUser((prev) => {
        if (prev && prev.id === riderId) {
          const updated = {
            ...prev,
            riderAvailability: 'available' as const,
            riderActiveOrderId: undefined,
          };
          try {
            localStorage.setItem('foodies_current_user', JSON.stringify(updated));
          } catch (e) { }
          return updated;
        }
        return prev;
      });

      try {
        fetch('/api/users', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({
            id: riderId,
            riderAvailability: 'available',
            riderActiveOrderId: null,
          }),
        }).catch(() => { });
      } catch (e) { }
    }

    // 3. Release table if dine-in
    if (targetOrd?.tableNumber) {
      setTables((prev) => {
        const updated = prev.map((t) =>
          t.number === targetOrd.tableNumber && t.branchId === (targetOrd.branchId || currentBranchId)
            ? { ...t, status: 'available' as const, currentOrderId: undefined, seatedAt: undefined }
            : t
        );
        broadcastTables(updated);
        return updated;
      });

      try {
        fetch('/api/tables', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({
            tableNumber: targetOrd.tableNumber,
            branchId: targetOrd.branchId || currentBranchId,
            status: 'available',
          }),
        }).catch(() => { });
      } catch (e) { }
    }

    // 3.5 Determine cancellation actor and explicit attribution
    const cancelActor: 'customer' | 'staff' | 'branch_offline' =
      (reason && (reason.toLowerCase().includes('branch closed') || reason.toLowerCase().includes('shutdown') || reason.toLowerCase().includes('offline')))
        ? 'branch_offline'
        : (reason && (reason.toLowerCase().includes('customer') || reason.toLowerCase().includes('deselected') || reason.toLowerCase().includes('user')))
          ? 'customer'
          : (currentRole === 'customer')
            ? 'customer'
            : 'staff';
    const defaultReason = cancelActor === 'customer'
      ? 'Cancelled by customer'
      : (cancelActor === 'branch_offline' ? 'Branch Closed Offline by Manager / Owner' : 'Cancelled by Cashier');
    const cancelNotes = reason || defaultReason;

    // 4. Immediately update localStorage customer history cache
    if (typeof window !== 'undefined') {
      try {
        const rawCache = localStorage.getItem('foodies_customer_history_cache');
        if (rawCache) {
          const cacheList: Order[] = JSON.parse(rawCache);
          const updatedCache = cacheList.map((ord) =>
            ord.id === orderId || ord.orderNumber === orderId
              ? {
                ...ord,
                status: 'cancelled' as const,
                notes: cancelNotes,
                cancellationReason: cancelNotes,
                cancelledBy: cancelActor,
                assignedRiderId: undefined,
                assignedRiderName: undefined,
                riderStatus: undefined,
              }
              : ord
          );
          localStorage.setItem('foodies_customer_history_cache', JSON.stringify(updatedCache));
        }
      } catch (e) { }
    }

    // 5. Update local React state with fallback to cache if not yet in state
    setOrders((prev) => {
      const exists = prev.some((ord) => ord.id === orderId || ord.orderNumber === orderId);
      let updated: Order[];
      if (exists) {
        updated = prev.map((ord) =>
          ord.id === orderId || ord.orderNumber === orderId
            ? {
              ...ord,
              status: 'cancelled' as const,
              notes: cancelNotes,
              cancellationReason: cancelNotes,
              cancelledBy: cancelActor,
              forwardToKitchenAt: undefined,
              assignedRiderId: undefined,
              assignedRiderName: undefined,
              riderStatus: undefined,
            }
            : ord
        );
      } else if (targetOrd) {
        updated = [
          {
            ...targetOrd,
            status: 'cancelled' as const,
            notes: cancelNotes,
            cancellationReason: cancelNotes,
            cancelledBy: cancelActor,
            forwardToKitchenAt: undefined,
            assignedRiderId: undefined,
            assignedRiderName: undefined,
            riderStatus: undefined,
          },
          ...prev,
        ];
      } else {
        let fromCache: Order | undefined;
        if (typeof window !== 'undefined') {
          try {
            const raw = localStorage.getItem('foodies_customer_history_cache');
            if (raw) {
              const list: Order[] = JSON.parse(raw);
              fromCache = list.find((o) => o.id === orderId || o.orderNumber === orderId);
            }
          } catch { }
        }
        if (fromCache) {
          updated = [
            {
              ...fromCache,
              status: 'cancelled' as const,
              notes: cancelNotes,
              cancellationReason: cancelNotes,
              cancelledBy: cancelActor,
              forwardToKitchenAt: undefined,
              assignedRiderId: undefined,
              assignedRiderName: undefined,
              riderStatus: undefined,
            },
            ...prev,
          ];
        } else {
          updated = prev;
        }
      }
      broadcastOrders(updated);
      return updated;
    });

    // 6. Asynchronously sync cancellation to PostgreSQL database with fallback
    try {
      const sendCancellation = (useVersion: boolean) => {
        return fetch('/api/orders', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({
            orderId: targetOrd?.id || orderId,
            status: 'cancelled',
            notes: cancelNotes,
            cancellationReason: cancelNotes,
            cancelledBy: cancelActor,
            reason: cancelNotes,
            assignedRiderId: null,
            assignedRiderName: null,
            riderStatus: null,
            actorId: currentUser?.id || (cancelActor === 'customer' ? 'customer' : 'cashier'),
            actorName: currentUser?.name || (cancelActor === 'customer' ? 'Customer' : 'Cashier'),
            actorRole: currentRole || (cancelActor === 'customer' ? 'customer' : 'cashier'),
          }),
        });
      };

      sendCancellation(true)
        .then((res) => {
          if (!res.ok && res.status === 409) {
            sendCancellation(false).catch(() => { });
          }
        })
        .catch(() => {
          sendCancellation(false).catch(() => { });
        });
    } catch (e) { }

    addToast({
      type: 'warning',
      title: 'Order Cancelled',
      message: `Reason: ${reason}`,
    });
  };

  const [activeTableSession, setActiveTableSessionState] = useState<{
    tableId: string;
    tableNumber: string;
    branchId: string;
    seatedAt: string;
    orderId?: string;
  } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('foodies_active_table_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const setActiveTableSession = (session: { tableId: string; tableNumber: string; branchId: string; seatedAt: string; orderId?: string } | null) => {
    setActiveTableSessionState(session);
    if (typeof window !== 'undefined') {
      if (session) {
        localStorage.setItem('foodies_active_table_session', JSON.stringify(session));
      } else {
        localStorage.removeItem('foodies_active_table_session');
      }
    }
  };

  const generateTableQr = async (tableId: string, validMinutes: number, allowOnReserved: boolean = false): Promise<Table | null> => {
    const targetTable = tables.find((t) => t.id === tableId);
    if (!targetTable) return null;

    const qrToken = `QR-${(targetTable.branchId || 'gulberg').slice(0, 3).toUpperCase()}-${targetTable.number.replace(/\D/g, '') || targetTable.id}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validMinutes * 60000).toISOString();

    const updatedTable: Table = {
      ...targetTable,
      qrCode: qrToken,
      qrGeneratedAt: now.toISOString(),
      qrExpiresAt: expiresAt,
      qrValidMinutes: validMinutes,
      allowQrOrderOnReserved: allowOnReserved,
    };

    setTables((prev) => {
      const next = prev.map((t) => (t.id === tableId ? updatedTable : t));
      broadcastTables(next);
      return next;
    });

    try {
      await fetch('/api/tables', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          tableId,
          qrCode: qrToken,
          qrExpiresAt: expiresAt,
          allowQrOrderOnReserved: allowOnReserved,
        }),
      });
    } catch (e) { }

    addToast({
      type: 'success',
      title: `QR Code Generated: Table ${targetTable.number}`,
      message: `Valid for ${validMinutes >= 60 ? `${validMinutes / 60} hour(s)` : `${validMinutes} mins`}. Ordering on reserved: ${allowOnReserved ? 'ALLOWED' : 'LOCKED'}.`,
    });

    return updatedTable;
  };

  const toggleTableQrAllowReserved = async (tableId: string, allow: boolean) => {
    const targetTable = tables.find((t) => t.id === tableId);
    if (!targetTable) return;

    setTables((prev) => {
      const next = prev.map((t) => (t.id === tableId ? { ...t, allowQrOrderOnReserved: allow } : t));
      broadcastTables(next);
      return next;
    });

    try {
      await fetch('/api/tables', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          tableId,
          allowQrOrderOnReserved: allow,
        }),
      });
    } catch (e) { }

    addToast({
      type: 'info',
      title: `Table ${targetTable.number} Setting Updated`,
      message: allow
        ? 'In-store QR scan allowed even if table is reserved online.'
        : 'In-store QR scan will show reserved notice and require picking another table.',
    });
  };

  const assignWaiterToOrder = async (orderId: string, waiterId: string, waiterName: string) => {
    const target = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    const targetOrderId = target?.id || orderId;

    inFlightStatusRef.current.set(targetOrderId, {
      ...inFlightStatusRef.current.get(targetOrderId),
      timestamp: Date.now(),
      assignedWaiterId: waiterId,
      assignedWaiterName: waiterName,
    });
    if (target?.orderNumber) {
      inFlightStatusRef.current.set(target.orderNumber, {
        ...inFlightStatusRef.current.get(target.orderNumber),
        timestamp: Date.now(),
        assignedWaiterId: waiterId,
        assignedWaiterName: waiterName,
      });
    }

    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === targetOrderId || o.orderNumber === targetOrderId || o.id === orderId || o.orderNumber === orderId
          ? { ...o, assignedWaiterId: waiterId, assignedWaiterName: waiterName }
          : o
      );
      broadcastOrders(next);
      try {
        localStorage.setItem('foodies_orders_live', JSON.stringify(next));
      } catch (e) { }
      store.dispatch(setReduxOrders(next));
      return next;
    });

    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId: targetOrderId,
          assignedWaiterId: waiterId,
          assignedWaiterName: waiterName,
        }),
      });
    } catch (e) { }
  };

  const markOrderDeliveredToTable = (orderId: string) => {
    const target = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    const targetOrderId = target?.id || orderId;
    const nowIso = new Date().toISOString();

    const matchingTable = target?.tableNumber
      ? tables.find(
          (t) =>
            (!t.branchId || normalizeBranchId(t.branchId) === normalizeBranchId(currentBranchId)) &&
            (t.number.toLowerCase() === String(target.tableNumber).toLowerCase() ||
             t.id === target.tableNumber ||
             t.number.replace(/\D/g, '') === String(target.tableNumber).replace(/\D/g, ''))
        )
      : undefined;

    const resolvedWaiterId =
      target?.assignedWaiterId ||
      matchingTable?.assignedWaiterId ||
      (currentUser?.role === 'floor_staff' ? currentUser.id : undefined);
    const resolvedWaiterName =
      target?.assignedWaiterName ||
      matchingTable?.assignedWaiterName ||
      (currentUser?.role === 'floor_staff' ? currentUser.name : undefined);

    inFlightStatusRef.current.set(targetOrderId, {
      status: 'served',
      sentToKitchen: true,
      timestamp: Date.now(),
      assignedWaiterId: resolvedWaiterId,
      assignedWaiterName: resolvedWaiterName,
    });
    if (target?.orderNumber) {
      inFlightStatusRef.current.set(target.orderNumber, {
        status: 'served',
        sentToKitchen: true,
        timestamp: Date.now(),
        assignedWaiterId: resolvedWaiterId,
        assignedWaiterName: resolvedWaiterName,
      });
    }

    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === targetOrderId || o.orderNumber === targetOrderId || o.id === orderId || o.orderNumber === orderId
          ? {
            ...o,
            status: 'served' as OrderStatus,
            deliveredAt: nowIso,
            sentToKitchen: true,
            assignedWaiterId: resolvedWaiterId || o.assignedWaiterId,
            assignedWaiterName: resolvedWaiterName || o.assignedWaiterName,
          }
          : o
      );
      broadcastOrders(next);
      return next;
    });

    addToast({
      type: 'success',
      title: 'Order Delivered to Table 🍽️',
      message: `Order #${target?.orderNumber || orderId} served at Table ${target?.tableNumber || ''}. Guests are dining.`,
    });

    try {
      const servedSnapshot: Order | undefined = target
        ? {
            ...target,
            status: 'served',
            deliveredAt: nowIso,
            sentToKitchen: true,
            assignedWaiterId: resolvedWaiterId || target.assignedWaiterId,
            assignedWaiterName: resolvedWaiterName || target.assignedWaiterName,
          }
        : undefined;
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId: targetOrderId,
          type: target?.type || 'dine_in',
          status: 'served',
          deliveredAt: nowIso,
          assignedWaiterId: resolvedWaiterId,
          assignedWaiterName: resolvedWaiterName,
          actorId: currentUser?.id,
          actorName: currentUser?.name,
          actorRole: currentRole || 'floor_staff',
          orderSnapshot: servedSnapshot,
        }),
      }).catch(() => { });
    } catch (e) { }
  };

  const markOrderDoneAndCollected = (orderId: string, cashCollected = true) => {
    const target = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    const targetOrderId = target?.id || orderId;
    const nowIso = new Date().toISOString();

    inFlightStatusRef.current.set(targetOrderId, {
      status: 'completed',
      paymentStatus: 'paid',
      paymentCollected: true,
      sentToKitchen: true,
      timestamp: Date.now(),
    });
    if (target?.orderNumber) {
      inFlightStatusRef.current.set(target.orderNumber, {
        status: 'completed',
        paymentStatus: 'paid',
        paymentCollected: true,
        sentToKitchen: true,
        timestamp: Date.now(),
      });
    }

    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === targetOrderId || o.orderNumber === targetOrderId || o.id === orderId || o.orderNumber === orderId
          ? {
            ...o,
            status: 'completed' as OrderStatus,
            completedAt: nowIso,
            deliveredAt: o.deliveredAt || nowIso,
            paymentStatus: (cashCollected || o.paymentStatus === 'paid' ? 'paid' : o.paymentStatus) as PaymentStatus,
            paymentCollected: Boolean(cashCollected || o.paymentCollected),
            assignedWaiterId: o.assignedWaiterId || (currentUser?.role === 'floor_staff' ? currentUser.id : undefined),
            assignedWaiterName: o.assignedWaiterName || (currentUser?.role === 'floor_staff' ? currentUser.name : undefined),
          }
          : o
      );
      broadcastOrders(next);
      return next;
    });

    if (target?.tableNumber) {
      setTables((prev) => {
        const next = prev.map((t) =>
          String(t.number) === String(target.tableNumber) || String(t.id) === String(target.tableNumber)
            ? { ...t, status: 'available' as const, reservedFor: undefined, currentOrderId: undefined, seatedAt: undefined }
            : t
        );
        broadcastTables(next);
        return next;
      });

      setActiveTableSessionState((prev) => {
        if (prev && (prev.tableNumber === target.tableNumber || prev.tableId === target.tableNumber || prev.orderId === target.id)) {
          if (typeof window !== 'undefined') localStorage.removeItem('foodies_active_table_session');
          return null;
        }
        return prev;
      });

      try {
        fetch('/api/tables', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({
            tableNumber: target.tableNumber,
            branchId: target.branchId || currentBranchId,
            status: 'available',
          }),
        }).catch(() => { });
      } catch (e) { }
    }

    addToast({
      type: 'success',
      title: 'Order Done & Collected ✓',
      message: `Order #${target?.orderNumber || orderId} settled${target?.tableNumber ? ` & Table #${target.tableNumber} marked free` : ''}.`,
    });

    try {
      const doneSnapshot: Order | undefined = target
        ? {
            ...target,
            status: 'completed',
            paymentStatus: (cashCollected || target.paymentStatus === 'paid' ? 'paid' : target.paymentStatus) as PaymentStatus,
            paymentCollected: Boolean(cashCollected || target.paymentCollected),
            completedAt: nowIso,
            deliveredAt: target.deliveredAt || nowIso,
            sentToKitchen: true,
          }
        : undefined;
      fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId: targetOrderId,
          type: target?.type,
          status: 'completed',
          paymentStatus: cashCollected || target?.paymentStatus === 'paid' ? 'paid' : target?.paymentStatus,
          paymentCollected: Boolean(cashCollected || target?.paymentCollected),
          completedAt: nowIso,
          deliveredAt: target?.deliveredAt || nowIso,
          actorId: currentUser?.id,
          actorName: currentUser?.name,
          actorRole: currentRole || 'floor_staff',
          orderSnapshot: doneSnapshot,
        }),
      }).catch(() => { });
    } catch (e) { }
  };

  const cancelDineInOrder = async (orderId: string, reason: string = 'Customer cancelled at table') => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            status: 'cancelled' as OrderStatus,
            notes: `${o.notes ? `${o.notes} · ` : ''}Cancelled: ${reason}`,
          }
          : o
      );
      broadcastOrders(next);
      try {
        localStorage.setItem('foodies_orders_live', JSON.stringify(next));
      } catch (e) { }
      store.dispatch(setReduxOrders(next));
      return next;
    });

    if (targetOrder.tableNumber) {
      const matchingTable = tables.find(
        (t) => t.number === targetOrder.tableNumber && (!t.branchId || t.branchId === targetOrder.branchId)
      );
      if (matchingTable) {
        updateTableStatus(matchingTable.id, 'available');
      }
    }

    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          status: 'cancelled',
          notes: `${targetOrder.notes ? `${targetOrder.notes} · ` : ''}Cancelled: ${reason}`,
        }),
      });
    } catch (e) { }

    addToast({
      type: 'warning',
      title: 'Dine-In Order Cancelled',
      message: `Order #${targetOrder.orderNumber} for Table ${targetOrder.tableNumber || ''} has been cancelled.`,
    });
  };

  const addItemsToExistingOrder = async (orderId: string, newItems: OrderItem[]) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    const extraTotal = newItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const updatedItems = [
      ...targetOrder.items,
      ...newItems.map((item) => ({ ...item, isAddOn: true, addedAtStage: 'stage2' as const })),
    ];
    const newAddOnSubtotal = (targetOrder.addOnSubtotal || 0) + extraTotal;
    const newTotal = targetOrder.total + extraTotal;
    const newVersion = (targetOrder.version || 1) + 1;

    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === orderId
          ? {
            ...o,
            items: updatedItems,
            addOnSubtotal: newAddOnSubtotal,
            total: newTotal,
            version: newVersion,
            sentToKitchen: true,
          }
          : o
      );
      broadcastOrders(next);
      try {
        localStorage.setItem('foodies_orders_live', JSON.stringify(next));
      } catch (e) { }
      store.dispatch(setReduxOrders(next));
      return next;
    });

    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          orderId,
          items: updatedItems,
          addOnSubtotal: newAddOnSubtotal,
          total: newTotal,
          version: newVersion,
          sentToKitchen: true,
        }),
      });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Extra Items Added to Table Bill',
      message: `${newItems.length} new item(s) forwarded to the kitchen!`,
    });
  };

  const updateTableStatus = (tableId: string, status: TableStatus, reservationName?: string, customMessage?: string) => {
    let tableNum = '';
    setTables((prev) => {
      const next = prev.map((t) => {
        if (t.id === tableId || t.number === tableId) {
          tableNum = t.number;
          return {
            ...t,
            status,
            reservedFor: status === 'reserved' ? reservationName || 'Reserved Guest' : undefined,
            currentOrderId: status === 'available' ? undefined : t.currentOrderId,
          };
        }
        return t;
      });
      broadcastTables(next);
      return next;
    });

    const statusTitle =
      status === 'available'
        ? 'Table Free ✓'
        : status === 'occupied'
          ? 'Table Seated 🍽️'
          : status === 'cleaning'
            ? 'Table Cleaning 🧹'
            : 'Table Reserved 📅';

    const statusMsg =
      customMessage || `Table ${tableNum || tableId} is now ${status === 'available' ? 'free and available' : status}.`;

    addToast({
      type: status === 'available' ? 'success' : 'info',
      title: statusTitle,
      message: statusMsg,
    });

    // Asynchronously sync table status to PostgreSQL database
    try {
      fetch('/api/tables', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          tableId,
          status,
          reservedFor: status === 'reserved' ? reservationName || 'Reserved Guest' : undefined,
        }),
      }).catch(() => { });
    } catch (e) { }
  };

  const markTableFree = (tableIdOrNumber: string) => {
    setTables((prev) => {
      const next = prev.map((t) =>
        t.id === tableIdOrNumber || t.number === tableIdOrNumber
          ? { ...t, status: 'available' as const, reservedFor: undefined, currentOrderId: undefined }
          : t
      );
      broadcastTables(next);
      return next;
    });

    setActiveTableSessionState((prev) => {
      if (prev && (prev.tableId === tableIdOrNumber || prev.tableNumber === tableIdOrNumber)) {
        if (typeof window !== 'undefined') localStorage.removeItem('foodies_active_table_session');
        return null;
      }
      return prev;
    });

    try {
      fetch('/api/tables', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          tableNumber: tableIdOrNumber,
          status: 'available',
        }),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Table Released & Marked Free 🪑',
      message: `Table #${tableIdOrNumber} is now free and ready for new guests.`,
    });
  };

  const toggleMenuItemBranchAvailability = (itemId: string, branchId: string) => {
    let updatedAvailability: Record<string, boolean> = {};
    setMenuItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === itemId) {
          const current = (item.branchAvailability && item.branchAvailability[branchId] !== undefined)
            ? Boolean(item.branchAvailability[branchId])
            : (item.isAvailable ?? true);
          updatedAvailability = { ...(item.branchAvailability || {}), [branchId]: !current };
          return {
            ...item,
            branchAvailability: updatedAvailability,
          };
        }
        return item;
      });
      broadcastMenu(updated);
      return updated;
    });

    // Asynchronously sync availability to PostgreSQL database
    try {
      fetch('/api/menu', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ itemId, branchAvailability: updatedAvailability }),
      }).catch(() => { });
    } catch (e) { }
  };

  const updateMenuItemBranchPrice = (itemId: string, branchId: string, overridePrice: number) => {
    const numPrice = Number(overridePrice) || 0;
    let updatedOverrides: Record<string, number> = {};
    setMenuItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === itemId) {
          updatedOverrides = { ...(item.branchPriceOverrides || {}), [branchId]: numPrice };
          return {
            ...item,
            branchPriceOverrides: updatedOverrides,
          };
        }
        return item;
      });
      broadcastMenu(updated);
      return updated;
    });

    // Recalculate any matching cart item
    setCart((prevCart) => {
      if (!prevCart || prevCart.length === 0) return prevCart;
      const targetDish = menuItems.find((m) => m.id === itemId);
      if (!targetDish) return prevCart;
      const updated = prevCart.map((ci) => {
        if (ci.menuItemId !== itemId) return ci;
        let newUnitPrice = hasSelectedBranch
          ? (currentBranchId === branchId ? numPrice : (targetDish.branchPriceOverrides?.[currentBranchId] ?? targetDish.basePrice))
          : getItemMinPrice(targetDish);
        if (ci.size && targetDish.sizes) {
          const matchSize = targetDish.sizes.find((s) => s.name === ci.size);
          if (matchSize) newUnitPrice += Number(matchSize.priceDelta) || 0;
        }
        if (ci.extras && targetDish.extras) {
          ci.extras.forEach((ext) => {
            const matchExtra = targetDish.extras?.find((e) => e.name === ext);
            if (matchExtra) newUnitPrice += Number(matchExtra.price) || 0;
          });
        }
        return { ...ci, unitPrice: newUnitPrice };
      });
      store.dispatch(setReduxCart(updated));
      return updated;
    });

    // Asynchronously sync price override change to PostgreSQL database
    try {
      fetch('/api/menu', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ itemId, branchPriceOverrides: updatedOverrides }),
      }).catch(() => { });
    } catch (e) { }
  };

  const updateMenuItemPrice = (itemId: string, newBasePrice: number, branchOverride?: { branchId: string; price: number }) => {
    if (branchOverride) {
      updateMenuItemBranchPrice(itemId, branchOverride.branchId, branchOverride.price);
      return;
    }
    const numPrice = Number(newBasePrice) || 0;
    setMenuItems((prev) => {
      const updated = prev.map((item) => (item.id === itemId ? { ...item, basePrice: numPrice } : item));
      broadcastMenu(updated);
      return updated;
    });

    // Recalculate any matching cart item
    setCart((prevCart) => {
      if (!prevCart || prevCart.length === 0) return prevCart;
      const targetDish = menuItems.find((m) => m.id === itemId);
      if (!targetDish) return prevCart;
      const dish = { ...targetDish, basePrice: numPrice };
      const updated = prevCart.map((ci) => {
        if (ci.menuItemId !== itemId) return ci;
        let newUnitPrice = hasSelectedBranch
          ? ((dish.branchPriceOverrides && dish.branchPriceOverrides[currentBranchId] !== undefined)
            ? Number(dish.branchPriceOverrides[currentBranchId])
            : numPrice)
          : getItemMinPrice(dish);
        if (ci.size && dish.sizes) {
          const matchSize = dish.sizes.find((s) => s.name === ci.size);
          if (matchSize) newUnitPrice += Number(matchSize.priceDelta) || 0;
        }
        if (ci.extras && dish.extras) {
          ci.extras.forEach((ext) => {
            const matchExtra = dish.extras?.find((e) => e.name === ext);
            if (matchExtra) newUnitPrice += Number(matchExtra.price) || 0;
          });
        }
        return { ...ci, unitPrice: newUnitPrice };
      });
      store.dispatch(setReduxCart(updated));
      return updated;
    });

    // Asynchronously sync price change to PostgreSQL database
    try {
      fetch('/api/menu', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ itemId, basePrice: numPrice }),
      }).catch(() => { });
    } catch (e) { }

    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'price_change',
        details: `Updated base price for item ID ${itemId} to Rs. ${numPrice}`,
      },
      ...prev,
    ]);
  };

  const updateBranchSettings = (branchId: string, settings: Partial<Branch>) => {
    setBranches((prev) => {
      const updated = prev.map((b) => (b.id === branchId || normalizeBranchId(b.id) === normalizeBranchId(branchId) ? { ...b, ...settings } : b));
      broadcastBranches(updated);
      return updated;
    });

    // Asynchronously sync branch settings to PostgreSQL database
    try {
      fetch('/api/branches', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ branchId, settings }),
      }).catch(() => { });
    } catch (e) { }
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        branchId,
        action: 'timing_settings',
        details: `Updated branch settings: ${JSON.stringify(settings)}`,
      },
      ...prev,
    ]);
    addToast({
      type: 'success',
      title: 'Branch Settings Updated',
      message: 'Operational parameters saved.',
    });
  };

  // Branch Shutdown Confirmation Modal State (When setting offline with pending orders)
  const [shutdownModalState, setShutdownModalState] = useState<{
    isOpen: boolean;
    branch: Branch | null;
    pendingOrders: Order[];
  }>({
    isOpen: false,
    branch: null,
    pendingOrders: [],
  });

  const toggleBranchStatus = (branchId: string) => {
    const target = branches.find(
      (b) => b.id === branchId || normalizeBranchId(b.id) === normalizeBranchId(branchId)
    );
    if (!target) return;

    // If currently OPEN and going to shut OFFLINE, check for pending in-progress orders
    if (target.isOpen) {
      const pending = orders.filter(
        (o) =>
          (o.branchId === target.id || normalizeBranchId(o.branchId) === normalizeBranchId(target.id)) &&
          !['completed', 'delivered', 'served', 'taken', 'cancelled'].includes(o.status)
      );

      if (pending.length > 0) {
        setShutdownModalState({
          isOpen: true,
          branch: target,
          pendingOrders: pending,
        });
        return;
      }
    }

    const nextState = !target.isOpen;
    updateBranchSettings(target.id, { isOpen: nextState });
    addToast({
      type: nextState ? 'success' : 'warning',
      title: nextState ? 'Branch Opened (Online) 🟢' : 'Branch Closed (Offline) 🔴',
      message: `${target.name} storefront is now ${nextState ? 'ONLINE and accepting orders' : 'OFFLINE and customer ordering is paused'}.`,
    });
  };

  const closeShutdownModal = () => {
    setShutdownModalState({ isOpen: false, branch: null, pendingOrders: [] });
  };

  const confirmShutdownKeepProcessing = () => {
    if (!shutdownModalState.branch) return;
    const target = shutdownModalState.branch;
    const pendingCount = shutdownModalState.pendingOrders.length;

    updateBranchSettings(target.id, { isOpen: false });
    addToast({
      type: 'info',
      title: 'Branch Offline (Processing Orders) 🟠',
      message: `${target.name} is now OFFLINE for new orders. ${pendingCount} pending order(s) will continue processing.`,
    });
    setShutdownModalState({ isOpen: false, branch: null, pendingOrders: [] });
  };

  const confirmShutdownCancelOrders = () => {
    if (!shutdownModalState.branch) return;
    const target = shutdownModalState.branch;
    const pending = shutdownModalState.pendingOrders;

    // 1. Mark branch offline
    updateBranchSettings(target.id, { isOpen: false });

    // 2. Cancel each pending order for this branch
    pending.forEach((ord) => {
      cancelOrder(ord.id, 'Branch Closed Offline by Manager / Owner');
    });

    addToast({
      type: 'warning',
      title: 'Branch Closed & Orders Cancelled 🔴',
      message: `${target.name} is now OFFLINE. ${pending.length} pending order(s) have been cancelled and moved to Order History.`,
    });
    setShutdownModalState({ isOpen: false, branch: null, pendingOrders: [] });
  };

  const createBranch = async (branchData: Partial<Branch>): Promise<boolean> => {
    const id = branchData.id || `branch-${branchData.city?.toLowerCase().replace(/\s+/g, '-') || 'cafe'}-${Date.now()}`;
    const newBranch: Branch = {
      id,
      name: branchData.name || 'New Branch',
      city: branchData.city || 'Lahore',
      address: branchData.address || '',
      phone: branchData.phone || '+92 300 0000000',
      openingHours: branchData.openingHours || '11:00 AM - 1:00 AM',
      isOpen: branchData.isOpen !== false,
      isBusy: Boolean(branchData.isBusy),
      prepTimeEstimateMin: Number(branchData.prepTimeEstimateMin) || 20,
      fullEditWindowMin: Number(branchData.fullEditWindowMin) || 5,
      stopAddOnsMinBeforeReady: Number(branchData.stopAddOnsMinBeforeReady) || 5,
      deliveryEnabled: branchData.deliveryEnabled !== false,
      latitude: Number(branchData.latitude) || 31.5204,
      longitude: Number(branchData.longitude) || 74.3587,
      maxOrderDistanceKm: Number(branchData.maxOrderDistanceKm) || 50,
      tableQrMaxDistanceMeters: Number(branchData.tableQrMaxDistanceMeters) || 300,
    };

    setBranches((prev) => {
      const updated = [...prev.filter((b) => b.id !== id), newBranch];
      broadcastBranches(updated);
      return updated;
    });

    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify(newBranch),
      });
      if (res.ok) {
        addToast({
          type: 'success',
          title: 'Branch Created! 🏢',
          message: `${newBranch.name} added to platform network.`,
        });
        return true;
      }
    } catch (_err) { }

    addToast({
      type: 'success',
      title: 'Branch Added',
      message: `${newBranch.name} recorded.`,
    });
    return true;
  };

  const updateBranchPaymentSettings = (branchId: string, settings: BranchPaymentSettings) => {
    setBranches((prev) => {
      const updated = prev.map((b) => (b.id === branchId || normalizeBranchId(b.id) === normalizeBranchId(branchId) ? { ...b, paymentSettings: settings } : b));
      broadcastBranches(updated);
      return updated;
    });

    // Asynchronously sync payment settings to PostgreSQL database
    try {
      fetch('/api/branches', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ branchId, settings: { paymentSettings: settings } }),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Payment Settings Saved! 💳',
      message: 'Branch payment options updated.',
    });
  };

  const addTableSession = (sessionData: Omit<TableSession, 'id'>) => {
    const newSession: TableSession = {
      ...sessionData,
      id: `sess-${Date.now()}`,
    };
    setTableSessions((prev) => {
      const updated = [newSession, ...prev];
      broadcastTableSessions(updated);
      return updated;
    });

    try {
      fetch('/api/tables/sessions', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify(newSession),
      }).catch(() => { });
    } catch (e) { }
  };

  const completeTableSession = (tableIdOrNumber: string) => {
    setTableSessions((prev) => {
      const updated = prev.map((s) => {
        if ((s.tableId === tableIdOrNumber || s.tableNumber === tableIdOrNumber) && s.status === 'occupied') {
          return {
            ...s,
            status: 'completed' as const,
            endedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            durationMin: s.durationMin || 45,
          };
        }
        return s;
      });
      broadcastTableSessions(updated);
      return updated;
    });

    try {
      fetch('/api/tables/sessions', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ tableId: tableIdOrNumber, branchId: currentBranchId, status: 'completed' }),
      }).catch(() => { });
    } catch (e) { }
  };

  const openShift = (openingFloat: number) => {
    const newShift: CashShift = {
      id: `sh-${Date.now()}`,
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      branchId: currentBranchId,
      openedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      openingFloat,
      cashCollected: 0,
      expectedCash: openingFloat,
      status: 'open',
    };
    setShifts((prev) => {
      const updated = [newShift, ...prev];
      broadcastShifts(updated);
      return updated;
    });

    try {
      fetch('/api/shifts', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify(newShift),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Shift Opened',
      message: `Starting float of Rs. ${openingFloat.toLocaleString()} recorded.`,
    });
  };

  const updateShiftOpeningBalance = (shiftId: string, newOpeningFloat: number) => {
    const cleanOpening = Math.max(0, Number(newOpeningFloat) || 0);
    setShifts((prev) => {
      const updated = prev.map((sh) => {
        if (sh.id !== shiftId) return sh;
        const nextExpected = cleanOpening + (Number(sh.cashCollected) || 0);
        const nextDiff =
          sh.countedCash !== undefined && sh.countedCash !== null
            ? Number(sh.countedCash) - nextExpected
            : sh.difference;
        return {
          ...sh,
          openingFloat: cleanOpening,
          expectedCash: nextExpected,
          difference: nextDiff,
        };
      });
      broadcastShifts(updated);
      return updated;
    });

    try {
      fetch('/api/shifts', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          shiftId,
          openingFloat: cleanOpening,
        }),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: 'Opening Balance Updated',
      message: `Cashier opening balance saved as Rs. ${cleanOpening.toLocaleString()}.`,
    });
  };

  const closeShift = (countedCash: number, differenceReason: string) => {
    let closedShift: CashShift | null = null;
    setShifts((prev) => {
      const updated = prev.map((sh) => {
        if (sh.status === 'open' && (sh.cashierId === currentUser.id || currentRole === 'branch_manager' || currentRole === 'cashier')) {
          const difference = countedCash - sh.expectedCash;
          closedShift = {
            ...sh,
            status: 'closed' as const,
            closedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            countedCash,
            difference,
            differenceReason,
          };
          return closedShift;
        }
        return sh;
      });
      broadcastShifts(updated);
      return updated;
    });

    if (closedShift) {
      try {
        fetch('/api/shifts', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({
            shiftId: (closedShift as CashShift).id,
            countedCash,
            difference: (closedShift as CashShift).difference,
            differenceReason,
            status: 'closed',
          }),
        }).catch(() => { });
      } catch (e) { }
    }

    // End of day / shift reconciliation: purge cancelled orders from database and local state
    try {
      fetch('/api/orders?purge=end_of_day', {
        method: 'DELETE',
        headers: getClientAuthHeaders(),
      }).catch(() => { });
      setOrders((prev) => {
        const withoutCancelled = prev.filter(
          (o) => o.status !== 'cancelled' && (o.status as string) !== 'canceled'
        );
        try {
          localStorage.setItem('foodies_orders_live', JSON.stringify(withoutCancelled));
          const cache = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
          if (Array.isArray(cache)) {
            const cleanCache = cache.filter((o: any) => o.status !== 'cancelled' && o.status !== 'canceled');
            localStorage.setItem('foodies_customer_history_cache', JSON.stringify(cleanCache));
          }
        } catch (e) { }
        return withoutCancelled;
      });
    } catch (e) { }

    addToast({
      type: 'info',
      title: 'Shift Closed & Reconciled',
      message: `End-of-shift count submitted to branch manager.`,
    });
  };

  const currentShift =
    shifts.find(
      (sh) =>
        sh.status === 'open' &&
        (sh.branchId === currentBranchId ||
          sh.branchId === currentBranch.id ||
          normalizeBranchId(sh.branchId) === normalizeBranchId(currentBranch.id))
    ) ||
    shifts.find((sh) => sh.status === 'open') ||
    DEFAULT_OPEN_SHIFT;

  const requestRefund = (orderId: string, amount: number, reason: string) => {
    const ord = orders.find((o) => o.id === orderId);
    const newReq: RefundRequest = {
      id: `ref-${Date.now()}`,
      orderId,
      orderNumber: ord?.orderNumber || 'Unknown',
      branchId: currentBranchId,
      amount,
      reason,
      requestedBy: currentUser.name,
      status: 'requested',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setRefundRequests((prev) => {
      const updated = [newReq, ...prev];
      broadcastRefunds(updated);
      return updated;
    });

    try {
      fetch('/api/refunds', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify(newReq),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'warning',
      title: 'Refund Requested',
      message: `Rs. ${amount.toLocaleString()} refund queued for manager approval.`,
    });
  };

  const decideRefund = (refundId: string, approved: boolean) => {
    const req = refundRequests.find((r) => r.id === refundId);
    setRefundRequests((prev) => {
      const updated = prev.map((r) =>
        r.id === refundId
          ? {
            ...r,
            status: approved ? ('approved' as const) : ('rejected' as const),
            approvedBy: currentUser.name,
            approvedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
          : r
      );
      broadcastRefunds(updated);
      return updated;
    });

    try {
      fetch('/api/refunds', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          refundId,
          status: approved ? 'approved' : 'rejected',
          approvedBy: currentUser.name,
        }),
      }).catch(() => { });
    } catch (e) { }

    if (approved && req) {
      setOrders((prev) => {
        const updated = prev.map((ord) => {
          if (ord.id === req.orderId || ord.orderNumber === req.orderNumber) {
            return { ...ord, paymentStatus: 'refunded' as const };
          }
          return ord;
        });
        broadcastOrders(updated);
        return updated;
      });

      try {
        fetch('/api/orders', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({ orderId: req.orderId, paymentStatus: 'refunded' }),
        }).catch(() => { });
      } catch (e) { }
    }

    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        branchId: currentBranchId,
        action: 'refund_approved',
        details: `${approved ? 'Approved' : 'Rejected'} refund request ID ${refundId} of Rs. ${req?.amount || 0}`,
      },
      ...prev,
    ]);

    addToast({
      type: approved ? 'success' : 'info',
      title: approved ? 'Refund Approved ✓' : 'Refund Rejected',
      message: approved
        ? `Refund of Rs. ${req?.amount || 0} successfully authorized by manager.`
        : `Refund request ID ${refundId} rejected.`,
    });
  };

  const updateUserStatus = (userId: string, status: 'active' | 'suspended' | 'deactivated') => {
    setUsers((prev) => {
      const next = prev.map((u) => (u.id === userId ? { ...u, status } : u));
      broadcastUsers(next);
      return next;
    });
    // Active session revocation if targeted user is currently signed in
    if (currentUser.id === userId && currentUser.role !== 'platform_owner') {
      if (status !== 'active') {
        setCurrentRole('customer');
        setCurrentUser({
          id: 'user-guest',
          name: 'Guest Customer',
          phone: '',
          email: '',
          role: 'customer',
          status: 'active',
        });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('foodies_staff_user');
          localStorage.removeItem('foodies_staff_session');
          localStorage.setItem('foodies_staff_role', 'customer');
        }
        addToast({
          type: 'error',
          title: `Account Access Revoked (${status.toUpperCase()}) 🚫`,
          message: `Your staff account has been ${status.toUpperCase()} by management. Access is revoked.`,
        });
      }
    }
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: status === 'suspended' ? 'account_suspended' : status === 'active' ? 'account_activated' : 'account_deactivated',
        details: `Changed status of user ${userId} to ${status}`,
      },
      ...prev,
    ]);
    fetch('/api/users', {
      method: 'PATCH',
      headers: getClientAuthHeaders(),
      body: JSON.stringify({ id: userId, status }),
    }).catch(() => { });
  };

  const createUser = (userData: Omit<User, 'id'> & { id?: string }) => {
    const userId = userData.id || `user-${Date.now()}`;
    const newUser: User = { ...userData, id: userId };
    setUsers((prev) => {
      const next = [...prev.filter((u) => u.id !== userId), newUser];
      broadcastUsers(next);
      return next;
    });
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'account_created',
        details: `Created new staff user ${newUser.name} (${newUser.role}) with ID ${newUser.id}`,
      },
      ...prev,
    ]);
    fetch('/api/users', {
      method: 'POST',
      headers: getClientAuthHeaders(),
      body: JSON.stringify(newUser),
    }).catch(() => { });
  };

  const deleteUser = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== userId);
      broadcastUsers(next);
      return next;
    });
    if (currentUser.id === userId && currentUser.role !== 'platform_owner') {
      setCurrentRole('customer');
      setCurrentUser({
        id: 'user-guest',
        name: 'Guest Customer',
        phone: '',
        email: '',
        role: 'customer',
        status: 'active',
      });
      if (typeof window !== 'undefined') {
        localStorage.removeItem('foodies_staff_user');
        localStorage.removeItem('foodies_staff_session');
        localStorage.setItem('foodies_staff_role', 'customer');
      }
    }
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'account_deleted',
        details: `Deleted user ${targetUser?.name || userId} (${targetUser?.role || 'user'})`,
      },
      ...prev,
    ]);
    fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: getClientAuthHeaders(),
    }).catch(() => { });
  };

  const updateUser = (userId: string, updates: Partial<User>) => {
    setUsers((prev) => {
      const next = prev.map((u) => (u.id === userId ? { ...u, ...updates } : u));
      broadcastUsers(next);
      return next;
    });
    // Active session update/revocation if targeted user is currently signed in
    if (currentUser.id === userId && currentUser.role !== 'platform_owner') {
      if (updates.status && updates.status !== 'active') {
        setCurrentRole('customer');
        setCurrentUser({
          id: 'user-guest',
          name: 'Guest Customer',
          phone: '',
          email: '',
          role: 'customer',
          status: 'active',
        });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('foodies_staff_user');
          localStorage.removeItem('foodies_staff_session');
          localStorage.setItem('foodies_staff_role', 'customer');
        }
        addToast({
          type: 'error',
          title: `Account Access Revoked (${updates.status.toUpperCase()}) 🚫`,
          message: `Your staff account has been ${updates.status.toUpperCase()} by management. Access is revoked.`,
        });
      } else {
        const updatedSelf = { ...currentUser, ...updates };
        setCurrentUser(updatedSelf);
        if (updates.role) {
          setCurrentRole(updates.role);
          store.dispatch(setReduxRole(updates.role));
        }
        if (updates.branchId) {
          setCurrentBranchId(updates.branchId);
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('foodies_staff_user', JSON.stringify(updatedSelf));
          if (updates.role) localStorage.setItem('foodies_staff_role', updates.role);
        }
      }
    }
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: 'Just now',
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'account_updated',
        details: `Updated user ${userId}: ${Object.keys(updates).join(', ')}`,
      },
      ...prev,
    ]);
    fetch('/api/users', {
      method: 'PATCH',
      headers: getClientAuthHeaders(),
      body: JSON.stringify({ id: userId, ...updates }),
    }).catch(() => { });
  };

  // Floor & Seating Actions
  const addFloor = (floorName: string) => {
    if (!floors.includes(floorName)) {
      setFloors((prev) => [...prev, floorName]);
      addToast({ type: 'success', title: 'Floor Added', message: `Added floor: ${floorName}` });
    }
  };

  const removeFloor = (floorName: string) => {
    setFloors((prev) => prev.filter((f) => f !== floorName));
    addToast({ type: 'info', title: 'Floor Removed', message: `Removed floor: ${floorName}` });
  };

  const addTable = (tableData: Omit<Table, 'id'>) => {
    const newTable: Table = {
      ...tableData,
      id: `table-${Date.now()}`,
      pin: Math.floor(1000 + Math.random() * 9000).toString(),
      chairs: tableData.chairs || tableData.capacity,
    };
    setTables((prev) => {
      const next = [...prev, newTable];
      broadcastTables(next);
      return next;
    });
    try {
      fetch('/api/tables', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify(newTable),
      }).catch(() => { });
    } catch (e) { }
    addToast({
      type: 'success',
      title: 'Table Added',
      message: `Table ${newTable.number} with ${newTable.capacity} chairs created on ${newTable.floor || 'Ground Floor'}`,
    });
  };

  const updateTable = (tableId: string, updates: Partial<Table>) => {
    setTables((prev) => {
      const next = prev.map((t) =>
        t.id === tableId
          ? {
            ...t,
            ...updates,
            capacity: updates.chairs !== undefined ? updates.chairs : updates.capacity !== undefined ? updates.capacity : t.capacity,
            chairs: updates.chairs !== undefined ? updates.chairs : updates.capacity !== undefined ? updates.capacity : t.chairs || t.capacity,
          }
          : t
      );
      broadcastTables(next);
      return next;
    });
    try {
      fetch('/api/tables', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          tableId,
          ...updates,
          tableNumber: updates.number,
        }),
      }).catch(() => { });
    } catch (e) { }
    addToast({ type: 'success', title: 'Table Updated', message: 'Seating layout updated.' });
  };

  const deleteTable = (tableId: string) => {
    setTables((prev) => {
      const next = prev.filter((t) => t.id !== tableId);
      broadcastTables(next);
      return next;
    });
    try {
      fetch(`/api/tables?id=${encodeURIComponent(tableId)}`, {
        method: 'DELETE',
        headers: getClientAuthHeaders(),
      }).catch(() => { });
    } catch (e) { }
    addToast({ type: 'info', title: 'Table Deleted', message: 'Table removed from floor layout.' });
  };

  // Menu & Categories Actions
  const addCategory = (category: string) => {
    if (!categories.includes(category)) {
      setCategories((prev) => {
        const updated = [...prev, category];
        broadcastMarketing({ categories: updated });
        return updated;
      });

      try {
        fetch('/api/marketing', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({ type: 'category', action: 'add', name: category }),
        }).catch(() => { });
      } catch (e) { }

      addToast({ type: 'success', title: 'Category Created', message: `Added category: ${category}` });
    }
  };

  const renameCategory = (oldCat: string, newCat: string) => {
    setCategories((prev) => {
      const updated = prev.map((c) => (c === oldCat ? newCat : c));
      broadcastMarketing({ categories: updated });
      return updated;
    });

    setMenuItems((prev) =>
      prev.map((item) => (item.category === oldCat ? { ...item, category: newCat } : item))
    );

    try {
      fetch('/api/marketing', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ type: 'category', action: 'rename', oldName: oldCat, newName: newCat }),
      }).catch(() => { });
    } catch (e) { }

    addToast({ type: 'success', title: 'Category Renamed', message: `Updated to ${newCat}` });
  };

  const deleteCategory = (category: string) => {
    setCategories((prev) => {
      const updated = prev.filter((c) => c !== category);
      broadcastMarketing({ categories: updated });
      return updated;
    });

    try {
      fetch('/api/marketing', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ type: 'category', action: 'delete', name: category }),
      }).catch(() => { });
    } catch (e) { }

    addToast({ type: 'info', title: 'Category Removed', message: `Removed ${category}` });
  };

  const updateMenuItem = (item: MenuItem) => {
    const normalizedItem: MenuItem = {
      ...item,
      basePrice: Number(item.basePrice) || 0,
    };
    setMenuItems((prev) => {
      const updated = prev.map((m) => (m.id === normalizedItem.id ? normalizedItem : m));
      broadcastMenu(updated);
      return updated;
    });

    // Recalculate any matching cart item
    setCart((prevCart) => {
      if (!prevCart || prevCart.length === 0) return prevCart;
      const updated = prevCart.map((ci) => {
        if (ci.menuItemId !== normalizedItem.id) return ci;
        let newUnitPrice = hasSelectedBranch
          ? ((normalizedItem.branchPriceOverrides && normalizedItem.branchPriceOverrides[currentBranchId] !== undefined)
            ? Number(normalizedItem.branchPriceOverrides[currentBranchId])
            : Number(normalizedItem.basePrice) || 0)
          : getItemMinPrice(normalizedItem);
        if (ci.size && normalizedItem.sizes) {
          const matchSize = normalizedItem.sizes.find((s) => s.name === ci.size);
          if (matchSize) newUnitPrice += Number(matchSize.priceDelta) || 0;
        }
        if (ci.extras && normalizedItem.extras) {
          ci.extras.forEach((ext) => {
            const matchExtra = normalizedItem.extras?.find((e) => e.name === ext);
            if (matchExtra) newUnitPrice += Number(matchExtra.price) || 0;
          });
        }
        return { ...ci, unitPrice: newUnitPrice };
      });
      store.dispatch(setReduxCart(updated));
      return updated;
    });

    // Asynchronously sync item update to PostgreSQL database
    try {
      fetch('/api/menu', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ itemId: normalizedItem.id, ...normalizedItem }),
      }).catch(() => { });
    } catch (e) { }

    addToast({ type: 'success', title: 'Menu Item Saved', message: `Updated details for ${normalizedItem.name}` });
  };

  const addMenuItem = (item: MenuItem) => {
    const normalizedItem: MenuItem = {
      ...item,
      basePrice: Number(item.basePrice) || 0,
    };
    setMenuItems((prev) => {
      const updated = [...prev, normalizedItem];
      broadcastMenu(updated);
      return updated;
    });

    // Asynchronously insert item into PostgreSQL database
    try {
      fetch('/api/menu', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify(normalizedItem),
      }).catch(() => { });
    } catch (e) { }

    addToast({ type: 'success', title: 'Item Created', message: `Added ${normalizedItem.name} to menu` });
  };

  const deleteMenuItem = (itemId: string) => {
    setMenuItems((prev) => {
      const updated = prev.filter((m) => m.id !== itemId);
      broadcastMenu(updated);
      return updated;
    });

    // Asynchronously delete item from PostgreSQL database
    try {
      fetch(`/api/menu?id=${itemId}`, {
        method: 'DELETE',
        headers: getClientAuthHeaders(),
      }).catch(() => { });
    } catch (e) { }

    addToast({ type: 'info', title: 'Item Removed', message: 'Item deleted from menu.' });
  };

  // Footer Actions
  const updateFooterSettings = (settings: Partial<FooterSettings>) => {
    const homeNotifKeys = [
      'homeNotificationEnabled',
      'homeNotificationBadge',
      'homeNotificationTitle',
      'homeNotificationMessage',
      'homeNotificationType',
      'homeNotificationUpdatedBy',
      'homeNotificationUpdatedAt',
    ];
    const hasHomeNotifChange = homeNotifKeys.some((k) => k in settings);
    const stampedSettings: Partial<FooterSettings> = hasHomeNotifChange
      ? {
        ...settings,
        homeNotificationUpdatedBy:
          settings.homeNotificationUpdatedBy || currentUser?.name || 'Branch Manager',
        homeNotificationUpdatedAt:
          settings.homeNotificationUpdatedAt || new Date().toISOString(),
      }
      : settings;

    setFooterSettings((prev) => {
      const updated = { ...prev, ...stampedSettings };
      broadcastMarketing({ footerSettings: updated });
      if (hasHomeNotifChange && typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            'foodies_web_home_notification',
            JSON.stringify({
              homeNotificationEnabled: updated.homeNotificationEnabled,
              homeNotificationBadge: updated.homeNotificationBadge,
              homeNotificationTitle: updated.homeNotificationTitle,
              homeNotificationMessage: updated.homeNotificationMessage,
              homeNotificationType: updated.homeNotificationType,
              homeNotificationUpdatedBy: updated.homeNotificationUpdatedBy,
              homeNotificationUpdatedAt: updated.homeNotificationUpdatedAt,
            })
          );
        } catch { }
      }
      return updated;
    });

    try {
      fetch('/api/marketing', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ type: 'footer', settings: stampedSettings }),
      }).catch(() => { });
    } catch (e) { }

    addToast({
      type: 'success',
      title: hasHomeNotifChange ? 'Web Home Notification Updated' : 'Footer Updated',
      message: hasHomeNotifChange
        ? 'Home notification banner saved & published to Web Home.'
        : 'Cafe footer contact & addresses saved.',
    });
  };

  // Banner & Deal Actions: Go Live Immediately on Publish
  const updateHeroBanner = (banner: HeroBanner) => {
    setHeroBanners((prev) => {
      const updated = prev.map((b) => (b.id === banner.id ? banner : b));
      broadcastMarketing({ heroBanners: updated });
      return updated;
    });

    try {
      fetch('/api/marketing', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ type: 'banner', banner }),
      }).catch(() => { });
    } catch (e) { }

    addToast({ type: 'success', title: 'Banner Updated', message: 'Hero banner changes are now live on the customer home page.' });
  };

  const addHeroBanner = (bannerData: Omit<HeroBanner, 'id'>) => {
    const newId = `b-${Date.now()}`;
    const newBanner: HeroBanner = { ...bannerData, id: newId };
    setHeroBanners((prev) => {
      const updated = [...prev, newBanner];
      broadcastMarketing({ heroBanners: updated });
      return updated;
    });

    try {
      fetch('/api/marketing', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ type: 'banner', banner: newBanner }),
      }).catch(() => { });
    } catch (e) { }

    addToast({ type: 'success', title: 'Banner Added', message: 'New banner added to customer carousel and live.' });
  };

  const deleteHeroBanner = (id: string) => {
    setHeroBanners((prev) => {
      const updated = prev.filter((b) => b.id !== id);
      broadcastMarketing({ heroBanners: updated });
      return updated;
    });

    try {
      fetch('/api/marketing', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ type: 'delete_banner', id }),
      }).catch(() => { });
    } catch (e) { }

    addToast({ type: 'info', title: 'Banner Removed', message: 'Banner removed from carousel.' });
  };

  const updateDealCard = (newDeal: DealCard) => {
    setDealCard(newDeal);
    broadcastMarketing({ dealCard: newDeal });

    try {
      fetch('/api/marketing', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ type: 'deal', deal: newDeal }),
      }).catch(() => { });
    } catch (e) { }

    addToast({ type: 'success', title: 'Special Deal Live', message: 'Special deal has been published live to customer screens.' });
  };

  const approveRequest = (requestId: string) => {
    const req = pendingApprovalRequests.find((r) => r.id === requestId);
    if (!req) return;

    if (req.type === 'banner' && req.bannerData) {
      if (req.action === 'add') {
        setHeroBanners((prev) => {
          const updated = [...prev, req.bannerData!];
          broadcastMarketing({ heroBanners: updated });
          return updated;
        });
        fetch('/api/marketing', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({ type: 'banner', banner: req.bannerData }),
        }).catch(() => { });
      } else if (req.action === 'update') {
        setHeroBanners((prev) => {
          const updated = prev.map((b) => (b.id === req.targetId ? req.bannerData! : b));
          broadcastMarketing({ heroBanners: updated });
          return updated;
        });
        fetch('/api/marketing', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({ type: 'banner', banner: req.bannerData }),
        }).catch(() => { });
      } else if (req.action === 'delete' && req.targetId) {
        setHeroBanners((prev) => {
          const updated = prev.filter((b) => b.id !== req.targetId);
          broadcastMarketing({ heroBanners: updated });
          return updated;
        });
        fetch('/api/marketing', {
          method: 'PATCH',
          headers: getClientAuthHeaders(),
          body: JSON.stringify({ type: 'delete_banner', id: req.targetId }),
        }).catch(() => { });
      }
    } else if (req.type === 'deal' && req.dealData) {
      setDealCard(req.dealData);
      broadcastMarketing({ dealCard: req.dealData });
      fetch('/api/marketing', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ type: 'deal', deal: req.dealData }),
      }).catch(() => { });
    }

    setPendingApprovalRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
            ...r,
            status: 'approved',
            decisionBy: currentUser.name,
            decisionAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
          : r
      )
    );
    addToast({
      type: 'success',
      title: 'Request Approved & Published',
      message: `${req.type === 'banner' ? 'Hero Banner' : 'Chef Special Deal'} is now published on the customer home screen!`,
    });
  };

  const rejectRequest = (requestId: string) => {
    setPendingApprovalRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
            ...r,
            status: 'rejected',
            decisionBy: currentUser.name,
            decisionAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          }
          : r
      )
    );
    addToast({
      type: 'warning',
      title: 'Request Rejected',
      message: 'The proposed banner/deal change was rejected.',
    });
  };

  const addAnnouncement = async (a: Omit<Announcement, 'id'>) => {
    const newA: Announcement = {
      ...a,
      id: `ann-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setAnnouncements((prev) => [newA, ...prev.filter((item) => item.id !== newA.id)]);
    store.dispatch(addReduxAnnouncement(newA));
    addToast({
      type: 'success',
      title: 'Announcement Posted',
      message: 'New announcement / info has been published.',
    });
    try {
      await fetch('/api/announcements', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify(newA),
      });
      broadcastStateMutation('SYNC_ANNOUNCEMENTS', [newA]);
    } catch (err) {
      console.error('Failed to post announcement:', err);
    }
  };

  const deleteAnnouncement = async (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    store.dispatch(deleteReduxAnnouncement(id));
    addToast({
      type: 'info',
      title: 'Announcement Removed',
      message: 'Announcement has been deleted.',
    });
    try {
      await fetch(`/api/announcements?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getClientAuthHeaders(),
      });
      broadcastStateMutation('SYNC_ANNOUNCEMENTS', { deletedId: id });
    } catch (err) {
      console.error('Failed to delete announcement:', err);
    }
  };

  const actorKey = currentUser?.id || (currentRole === 'customer' ? 'user-guest' : `role-${currentRole}`);

  // Placed orders tracked on this client device / session
  const [myPlacedOrderIds, setMyPlacedOrderIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (typeof window !== 'undefined') {
      try {
        const orderIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
        if (Array.isArray(orderIds)) orderIds.forEach((id: string) => s.add(String(id)));
        const placedIds = JSON.parse(localStorage.getItem('foodies_my_placed_order_ids') || '[]');
        if (Array.isArray(placedIds)) placedIds.forEach((id: string) => s.add(String(id)));
        const cache = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
        if (Array.isArray(cache)) {
          cache.forEach((o: any) => {
            if (o.id) s.add(o.id);
            if (o.orderNumber) s.add(String(o.orderNumber));
          });
        }
      } catch { }
    }
    return s;
  });

  // Calculate only the orders that legitimately belong to THIS customer
  const myCustomerOrdersSet = React.useMemo(() => {
    const s = new Set<string>(myPlacedOrderIds);
    if (currentRole === 'customer') {
      const myId = currentUser?.id && currentUser.id !== 'user-guest' && currentUser.id !== 'cust-walkin' ? currentUser.id : null;
      const myPhone = currentUser?.phone ? currentUser.phone.replace(/\D/g, '').slice(-10) : null;
      const myEmail = currentUser?.email ? currentUser.email.toLowerCase().trim() : null;

      orders.forEach((o) => {
        let isMine = false;
        if (myId && o.customerId === myId) isMine = true;
        if (myPhone && o.customerPhone && o.customerPhone.replace(/\D/g, '').slice(-10) === myPhone) isMine = true;
        if (myEmail && o.customerEmail && o.customerEmail.toLowerCase().trim() === myEmail) isMine = true;
        if (myPlacedOrderIds.has(o.id) || (o.orderNumber && myPlacedOrderIds.has(String(o.orderNumber)))) isMine = true;

        if (isMine) {
          if (o.id) s.add(o.id);
          if (o.orderNumber) s.add(String(o.orderNumber));
        }
      });
    }
    return s;
  }, [orders, currentRole, currentUser?.id, currentUser?.phone, currentUser?.email, myPlacedOrderIds]);

  const activeReceiverKey = React.useMemo(() => {
    if (currentRole === 'customer') {
      if (currentUser?.id && currentUser.id !== 'user-guest' && currentUser.id !== 'cust-walkin') {
        return `user:${currentUser.id}`;
      }
      if (currentUser?.phone) {
        return `cust:${currentUser.phone.replace(/\D/g, '').slice(-10)}`;
      }
      return 'role:customer';
    }
    if (currentUser?.id && currentUser.id !== 'user-guest') {
      return `user:${currentUser.id}`;
    }
    return `role:${currentRole}`;
  }, [currentRole, currentUser?.id, currentUser?.phone]);

  const myNotificationSettings = React.useMemo<ReceiverNotificationPreferences>(() => {
    const saved =
      receiverNotificationSettingsMap[activeReceiverKey] ||
      receiverNotificationSettingsMap[`role:${currentRole}`];
    if (!saved) {
      return {
        ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES,
        receiverKey: activeReceiverKey,
        events: { ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES.events },
      };
    }
    return {
      ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES,
      ...saved,
      receiverKey: activeReceiverKey,
      events: {
        ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES.events,
        ...(saved.events || {}),
      },
    };
  }, [activeReceiverKey, currentRole, receiverNotificationSettingsMap]);

  const inferNotificationEventKey = React.useCallback(
    (n: AppNotification): NotificationEventKey | null => {
      if (n.eventKey && n.eventKey in DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES.events) {
        return n.eventKey as NotificationEventKey;
      }
      const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();
      if (text.includes('payment') || text.includes('paid')) return 'paymentReceived';
      if (text.includes('assigned')) {
        if (text.includes('rider') || text.includes('delivery')) return 'riderAssigned';
        if (text.includes('waiter') || text.includes('table')) return 'waiterAssigned';
      }
      if (text.includes('cancelled') || text.includes('canceled')) return 'orderCancelled';
      if (text.includes('completed') || text.includes('collected & closed')) return 'orderCompleted';
      if (text.includes('served')) return 'orderServed';
      if (text.includes('out for delivery') || text.includes('en route') || text.includes('picked up')) return 'outForDelivery';
      if (text.includes('ready')) return 'orderReady';
      if (text.includes('cooking') || text.includes('preparing')) return 'cooking';
      if (text.includes('sent to kitchen') || text.includes('forwarded to kitchen') || text.includes('kitchen')) return 'sentToKitchen';
      if (text.includes('new order') || text.includes('order placed')) return 'orderPlaced';
      return null;
    },
    []
  );

  const isNotificationRelevant = React.useCallback(
    (n: AppNotification) => {
      // Per-Receiver Independent Rules Check (Only affects THIS receiver)
      if (myNotificationSettings.receiveNotifications === false) {
        return false;
      }
      if (
        Array.isArray(myNotificationSettings.mutedCategories) &&
        myNotificationSettings.mutedCategories.includes(n.category)
      ) {
        return false;
      }
      const evKey = inferNotificationEventKey(n);
      if (evKey && myNotificationSettings.events?.[evKey] === false) {
        return false;
      }

      const roles = Array.isArray(n.targetRoles) && n.targetRoles.length > 0 ? n.targetRoles : ['all'];
      const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
      const myPhone = normalizePhone(currentUser?.phone);
      const myId = currentUser?.id && currentUser.id !== 'user-guest' && currentUser.id !== 'cust-walkin' ? currentUser.id : null;
      const isSender = Boolean(n.senderId && currentUser?.id && n.senderId === currentUser.id);

      // Platform targeting check (Web portal hides 'app'-only notifications unless sender or platform_owner)
      if (n.targetPlatform === 'app' && currentRole !== 'platform_owner' && !isSender) {
        return false;
      }

      // -------------------------------------------------------------
      // 1. CUSTOMER VIEW
      // -------------------------------------------------------------
      if (currentRole === 'customer') {
        // A) If notification is associated with a specific ORDER:
        // ONLY the customer who placed / owns this order may see it (and only when customer/all is targeted)!
        if (n.orderId || n.orderNumber) {
          if (!roles.includes('all') && !roles.includes('customer')) {
            return false;
          }
          const idMatch = Boolean(n.targetUserId && myId && n.targetUserId === myId);
          const phoneMatch = Boolean(n.targetCustomerPhone && myPhone && normalizePhone(n.targetCustomerPhone) === myPhone);
          const orderMatch = Boolean(
            (n.orderId && myCustomerOrdersSet.has(n.orderId)) ||
            (n.orderNumber && myCustomerOrdersSet.has(String(n.orderNumber)))
          );
          // If it matches this customer, show it. If not, strictly hide (never show another customer's order)!
          return idMatch || phoneMatch || orderMatch;
        }

        // B) If notification is targeted to a SPECIFIC SINGLE PERSON (and not an order):
        if (n.targetUserId || n.targetCustomerPhone) {
          const idMatch = Boolean(n.targetUserId && myId && n.targetUserId === myId);
          const phoneMatch = Boolean(n.targetCustomerPhone && myPhone && normalizePhone(n.targetCustomerPhone) === myPhone);
          return idMatch || phoneMatch;
        }

        // C) GENERAL BROADCAST NOTIFICATION (No order, no specific user targeted):
        const roleMatches = roles.includes('all') || roles.includes('customer');
        if (!roleMatches) return false;

        const branchMatches = !n.branchId || n.branchId === 'all' || normalizeBranchId(n.branchId) === normalizeBranchId(currentBranchId);
        return branchMatches;
      }

      // -------------------------------------------------------------
      // 2. STAFF VIEW
      // -------------------------------------------------------------
      // Platform owner sees overall platform and branch operations
      if (currentRole === 'platform_owner') {
        // Owner inbox = what is addressed to the owner (branch opened/closed, broadcasts) + own messages.
        // Previously this returned true for EVERY notification, flooding the owner with each order's
        // customer/kitchen/waiter status updates.
        if (isSender) return true;
        if (n.targetUserId && currentUser?.id && n.targetUserId === currentUser.id) return true;
        return roles.includes('all') || roles.includes('platform_owner');
      }

      // Staff must belong to the matching branch
      const branchMatches = !n.branchId || n.branchId === 'all' || normalizeBranchId(n.branchId) === normalizeBranchId(currentBranchId);
      if (!branchMatches) return false;

      // Did I send it or was it specifically targeted to me (direct user, concerned rider, or concerned waiter)?
      if (isSender) return true;
      if (n.targetUserId && currentUser?.id && n.targetUserId === currentUser.id) return true;
      if (n.targetRiderId && currentUser?.id && n.targetRiderId === currentUser.id) return true;
      if (n.targetWaiterId && currentUser?.id && n.targetWaiterId === currentUser.id) return true;

      // If targeted to a specific other user (without an orderId), it's private to them
      if (n.targetUserId && (!currentUser?.id || n.targetUserId !== currentUser.id) && !n.orderId) {
        return false;
      }

      // Check if current staff role is in targetRoles (or 'all')
      const roleMatches = roles.includes('all') || roles.includes(currentRole);
      if (!roleMatches) return false;

      // If targetRoles ONLY targets 'customer' (e.g. ['customer']) and no staff role and not 'all':
      if (roles.length === 1 && roles[0] === 'customer') {
        return false;
      }

      // Rider filter: if notification is for rider assignment or assigned to a specific rider, ONLY that rider receives it
      if (currentRole === 'delivery_staff') {
        if (n.targetRiderId) {
          if (!currentUser?.id || n.targetRiderId !== currentUser.id) {
            return false;
          }
        }
        if (n.orderId || n.orderNumber) {
          const ord = orders.find(o => (n.orderId && o.id === n.orderId) || (n.orderNumber && o.orderNumber === n.orderNumber));
          if (ord?.assignedRiderId) {
            if (!currentUser?.id || ord.assignedRiderId !== currentUser.id) {
              return false;
            }
          }
        }
        // Delivery staff should not see waiter assignments, dine-in ready to serve, or table notices
        if (n.category === 'dine_in' && !n.targetRiderId) return false;
        if (evKey === 'waiterAssigned' || evKey === 'orderServed') return false;
      }

      // Waiter filter: if notification or dine-in order is assigned to another specific waiter, do not show to this waiter
      if (currentRole === 'floor_staff') {
        if (n.targetWaiterId) {
          if (!currentUser?.id || n.targetWaiterId !== currentUser.id) {
            return false;
          }
        }
        if (n.orderId || n.orderNumber) {
          const ord = orders.find(o => (n.orderId && o.id === n.orderId) || (n.orderNumber && o.orderNumber === n.orderNumber));
          if (ord?.assignedWaiterId) {
            if (!currentUser?.id || ord.assignedWaiterId !== currentUser.id) {
              return false;
            }
          }
        }
        // Floor staff should not see delivery rider assignments or out for delivery updates
        if (n.category === 'delivery' && !n.targetWaiterId) return false;
        if (evKey === 'riderAssigned' || evKey === 'outForDelivery') return false;
      }

      // Kitchen filter: kitchen chefs strictly receive notifications for new orders placed/sent to kitchen, cooking rush, and order cancellations
      if (currentRole === 'kitchen_staff') {
        if (
          evKey === 'riderAssigned' ||
          evKey === 'waiterAssigned' ||
          evKey === 'outForDelivery' ||
          evKey === 'orderServed' ||
          evKey === 'paymentReceived'
        ) {
          return false;
        }
        const isKitchenCategory = n.category === 'kitchen' || n.category === 'order_placed';
        const isKitchenEvent = evKey === 'orderPlaced' || evKey === 'sentToKitchen' || evKey === 'orderCancelled';
        const isDirectKitchenRole = roles.includes('kitchen_staff');
        if (!isKitchenCategory && !isKitchenEvent && !isDirectKitchenRole) {
          return false;
        }
      }

      return true;
    },
    [currentRole, currentUser?.id, currentUser?.phone, currentBranchId, myCustomerOrdersSet, orders, myNotificationSettings, inferNotificationEventKey]
  );

  const notifications = React.useMemo(
    () => allNotifications.filter(isNotificationRelevant),
    [allNotifications, isNotificationRelevant]
  );

  const unreadNotificationsCount = React.useMemo(
    () => notifications.filter((n) => !(n.readBy || []).includes(actorKey)).length,
    [notifications, actorKey]
  );

  // Request native browser desktop notification permissions
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => { });
      }
    }
  }, []);

  const spawnDesktopNotification = useCallback((notif: AppNotification) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const desktopNotif = new Notification(notif.title, {
          body: notif.message,
          tag: notif.id,
          icon: '/favicon.ico',
        });
        desktopNotif.onclick = () => {
          window.focus();
          markNotificationRead(notif.id);
          openNotificationModal('inbox');
        };
        activeBrowserNotificationsRef.current.set(notif.id, desktopNotif);
      } catch { }
    }
  }, []);

  // Trigger a live toast pop-up and native notification bar notification for each newly synced relevant notification
  useEffect(() => {
    for (const n of notifications) {
      if (!seenNotifIdsRef.current.has(n.id)) {
        seenNotifIdsRef.current.add(n.id);
        const isUnread = !(n.readBy || []).includes(actorKey);
        const isSelfSent = n.senderId && currentUser?.id && n.senderId === currentUser.id && n.senderRole === currentRole;
        const ageMs = Date.now() - (new Date(n.createdAt).getTime() || Date.now());
        if (
          isUnread &&
          !isSelfSent &&
          ageMs < 2 * 60 * 1000 &&
          myNotificationSettings.receiveNotifications !== false &&
          myNotificationSettings.showLiveToast !== false
        ) {
          addToast({
            type: n.type || 'info',
            title: n.title,
            message: n.message,
          });
          spawnDesktopNotification(n);
        }
      }
    }
  }, [notifications, actorKey, currentUser?.id, currentRole, spawnDesktopNotification, myNotificationSettings.receiveNotifications, myNotificationSettings.showLiveToast]);

  const openNotificationModal = (tab: 'inbox' | 'send' | 'settings' = 'inbox', prefillOrder?: Order) => {
    setNotificationModalDefaultTab(tab);
    setPrefillNotificationOrder(prefillOrder || null);
    setIsNotificationModalOpen(true);
  };

  const updateNotificationSettings = async (updates: Partial<NotificationSettings>): Promise<boolean> => {
    const allowedRoles: Role[] = ['platform_owner', 'branch_manager', 'cashier'];
    if (!allowedRoles.includes(currentRole)) {
      addToast({
        type: 'error',
        title: 'Unauthorized',
        message: 'Only Platform Owner, Branch Manager, or Cashier can update notification rules.',
      });
      return false;
    }

    const merged = mergeNotificationSettings(notificationSettings, {
      ...updates,
      updatedBy: currentUser?.name || currentRole,
      updatedByRole: currentRole,
      updatedAt: new Date().toISOString(),
    });

    setNotificationSettings(merged);
    store.dispatch(setReduxNotificationSettings(merged));
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('foodies_notification_settings', JSON.stringify(merged));
      } catch (e) { }
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_NOTIFICATION_SETTINGS',
          payload: merged,
          senderId: tabIdRef.current,
        });
      }
    }

    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          action: 'update_settings',
          settings: merged,
          actorName: currentUser?.name || currentRole,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        addToast({
          type: 'error',
          title: 'Failed to Save Rules',
          message: errData.error || 'Could not save notification rules to server.',
        });
        return false;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.notificationSettings) {
        setNotificationSettings(data.notificationSettings);
        store.dispatch(setReduxNotificationSettings(data.notificationSettings));
        try {
          localStorage.setItem('foodies_notification_settings', JSON.stringify(data.notificationSettings));
        } catch (e) { }
      }
      broadcastStateMutation('SYNC_NOTIFICATION_SETTINGS', data?.notificationSettings || merged);
      addToast({
        type: 'success',
        title: 'Notification Rules Saved',
        message: 'Changes are saved permanently across Web & Mobile until updated by authorized staff.',
      });
      return true;
    } catch (err) {
      console.error('Failed to save notification settings:', err);
      addToast({
        type: 'error',
        title: 'Save Error',
        message: 'Saved locally, but server sync failed.',
      });
      return false;
    }
  };

  const updateMyNotificationSettings = async (
    updates: Partial<ReceiverNotificationPreferences>,
    targetReceiverKey?: string
  ): Promise<boolean> => {
    const targetKey = targetReceiverKey || activeReceiverKey;
    const existing =
      receiverNotificationSettingsMap[targetKey] || {
        ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES,
        receiverKey: targetKey,
        events: { ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES.events },
      };

    const nextPrefs: ReceiverNotificationPreferences = {
      ...existing,
      ...updates,
      receiverKey: targetKey,
      receiveNotifications:
        updates.receiveNotifications ?? existing.receiveNotifications ?? true,
      showLiveToast: updates.showLiveToast ?? existing.showLiveToast ?? true,
      mutedCategories: Array.isArray(updates.mutedCategories)
        ? updates.mutedCategories
        : existing.mutedCategories || [],
      events: {
        ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES.events,
        ...(existing.events || {}),
        ...(updates.events || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    setReceiverNotificationSettingsMap((prev) => {
      const nextMap = { ...prev, [targetKey]: nextPrefs };
      try {
        localStorage.setItem('foodies_receiver_notif_settings_map', JSON.stringify(nextMap));
      } catch { }
      return nextMap;
    });

    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({
          action: 'update_receiver_settings',
          receiverKey: targetKey,
          settings: nextPrefs,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.receiverSettingsMap) {
          setReceiverNotificationSettingsMap(data.receiverSettingsMap);
          try {
            localStorage.setItem(
              'foodies_receiver_notif_settings_map',
              JSON.stringify(data.receiverSettingsMap)
            );
          } catch { }
        }
      }
    } catch { }

    addToast({
      type: 'success',
      title: 'Receiver Rules Saved',
      message: 'Notification settings updated independently for this receiver only.',
    });
    return true;
  };

  const sendNotification = async (payload: {
    id?: string;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    category?: NotificationCategory;
    branchId?: string;
    orderId?: string;
    orderNumber?: string;
    orderType?: OrderType;
    targetRoles: Array<Role | 'all'>;
    targetPlatform?: NotificationTargetPlatform;
    targetUserId?: string;
    targetCustomerPhone?: string;
    targetCustomerName?: string;
    targetWaiterId?: string;
    targetWaiterName?: string;
    targetRiderId?: string;
    targetRiderName?: string;
    silentToast?: boolean;
  }): Promise<AppNotification | null> => {
    // Only platform_owner (all branches) and branch_manager / cashier (their specific branch) can send notifications
    const canSendNotification =
      currentRole === 'platform_owner' || currentRole === 'branch_manager' || currentRole === 'cashier';
    if (!canSendNotification) {
      addToast({
        type: 'error',
        title: 'Permission Denied',
        message: 'Only Cashiers and Managers (for their branch) or Owner (all branches) can send notifications.',
      });
      return null;
    }

    const effectiveBranchId =
      currentRole === 'platform_owner'
        ? payload.branchId || 'all'
        : normalizeBranchId(currentBranchId);

    const newNotif: AppNotification = {
      id: payload.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: payload.title.trim(),
      message: payload.message.trim(),
      type: payload.type || 'info',
      category: payload.category || 'staff_alert',
      branchId: effectiveBranchId,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      orderType: payload.orderType,
      senderId: currentUser?.id || actorKey,
      senderName: currentUser?.name || currentRole,
      senderRole: currentRole,
      targetRoles: payload.targetRoles.length > 0 ? payload.targetRoles : ['all'],
      targetPlatform: payload.targetPlatform || 'all',
      targetUserId: payload.targetUserId,
      targetCustomerPhone: payload.targetCustomerPhone,
      targetCustomerName: payload.targetCustomerName,
      targetWaiterId: payload.targetWaiterId,
      targetWaiterName: payload.targetWaiterName,
      targetRiderId: payload.targetRiderId,
      targetRiderName: payload.targetRiderName,
      readBy: [actorKey],
      createdAt: new Date().toISOString(),
    };

    seenNotifIdsRef.current.add(newNotif.id);
    setAllNotifications((prev) => [newNotif, ...prev.filter((item) => item.id !== newNotif.id)]);
    store.dispatch(addReduxNotification(newNotif));
    spawnDesktopNotification(newNotif);

    if (!payload.silentToast) {
      const targetDesc =
        newNotif.targetPlatform === 'app'
          ? 'Mobile App users'
          : newNotif.targetPlatform === 'web'
            ? 'Web users'
            : 'concerned users on Web & Mobile';
      addToast({
        type: 'success',
        title: 'Notification Sent',
        message: `"${newNotif.title}" delivered to ${targetDesc}.`,
      });
    }

    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: getClientAuthHeaders(),
        body: JSON.stringify(newNotif),
      });
      broadcastStateMutation('SYNC_NOTIFICATIONS', [newNotif]);
    } catch (err) {
      console.error('Failed to send notification:', err);
    }

    return newNotif;
  };

  const markNotificationRead = async (id: string) => {
    const activeDesktop = activeBrowserNotificationsRef.current.get(id);
    if (activeDesktop) {
      try { activeDesktop.close(); } catch { }
      activeBrowserNotificationsRef.current.delete(id);
    }
    setAllNotifications((prev) =>
      prev.map((n) => (n.id === id && !n.readBy.includes(actorKey) ? { ...n, readBy: [...n.readBy, actorKey] } : n))
    );
    store.dispatch(markReduxNotificationRead({ id, userId: actorKey }));
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ id, userId: actorKey }),
      });
    } catch { }
  };

  const markAllNotificationsRead = async () => {
    activeBrowserNotificationsRef.current.forEach((n) => {
      try { n.close(); } catch { }
    });
    activeBrowserNotificationsRef.current.clear();
    setAllNotifications((prev) =>
      prev.map((n) => (!n.readBy.includes(actorKey) ? { ...n, readBy: [...n.readBy, actorKey] } : n))
    );
    store.dispatch(markReduxNotificationRead({ userId: actorKey, markAll: true }));
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: getClientAuthHeaders(),
        body: JSON.stringify({ markAllRead: true, userId: actorKey }),
      });
    } catch { }
  };

  const clearNotifications = async () => {
    activeBrowserNotificationsRef.current.forEach((n) => {
      try { n.close(); } catch { }
    });
    activeBrowserNotificationsRef.current.clear();
    setAllNotifications([]);
    store.dispatch(clearReduxNotifications());
    try {
      const scopeBranch = currentRole === 'platform_owner' ? 'all' : normalizeBranchId(currentBranchId);
      await fetch(`/api/notifications?branchId=${encodeURIComponent(scopeBranch)}`, {
        method: 'DELETE',
        headers: getClientAuthHeaders(),
      });
    } catch { }
  };

  const fetchOlderOrders = async (
    branchId?: string,
    dateScope: string = 'all',
    startDate?: string,
    endDate?: string
  ) => {
    setIsFetchingOlderOrders(true);
    try {
      const bId = branchId !== undefined ? branchId : (currentRole === 'platform_owner' ? 'all' : currentBranchId);
      const isCust = currentRole === 'customer';
      const custQuery = isCust && currentUser?.id && currentUser.id !== 'user-guest'
        ? `&customerId=${encodeURIComponent(currentUser.id)}&customerPhone=${encodeURIComponent(currentUser.phone || '')}`
        : '';
      const dateParams = startDate || endDate
        ? `&startDate=${encodeURIComponent(startDate || '')}&endDate=${encodeURIComponent(endDate || '')}`
        : `&dateScope=${encodeURIComponent(dateScope)}`;

      const url = bId && bId !== 'all'
        ? `/api/orders?branchId=${encodeURIComponent(bId)}&older=true${dateParams}${custQuery}`
        : `/api/orders?older=true${dateParams}${custQuery}`;

      const res = await fetch(url, { headers: getClientAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setOrders((prev) => {
            const combined = mergeOrderListsMonotonically(prev, data.orders, inFlightStatusRef.current, true);
            try {
              const nextJson = JSON.stringify(combined);
              if (localStorage.getItem('foodies_orders_live') !== nextJson) {
                localStorage.setItem('foodies_orders_live', nextJson);
              }
            } catch (e) { }
            queueMicrotask(() => store.dispatch(setReduxOrders(combined)));
            return areOrderListsEquivalent(prev, combined) ? prev : combined;
          });
          setHasLoadedOlderOrders(true);
        }
      }
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Fetch Failed',
        message: 'Could not fetch older records from database.',
      });
    } finally {
      setIsFetchingOlderOrders(false);
    }
  };

  const filterOrdersToToday = async () => {
    setIsFetchingOlderOrders(true);
    try {
      const bId = currentRole === 'platform_owner' ? 'all' : currentBranchId;
      const url = bId && bId !== 'all'
        ? `/api/orders?branchId=${bId}&dateScope=today`
        : `/api/orders?dateScope=today`;
      const res = await fetch(url, { headers: getClientAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          const cleanOrders = data.orders.filter(
            (o: Order) => !((o.status === 'cancelled' || (o.status as string) === 'canceled') && isOrderDayEnded(o.createdAt))
          );
          setOrders((prev) => {
            const activeOrTodayPrev = prev.filter(
              (o) =>
                !isOrderDayEnded(o.createdAt) ||
                ['placed', 'accepted', 'preparing', 'ready', 'served', 'out_for_delivery'].includes(o.status)
            );
            const merged = mergeOrderListsMonotonically(
              activeOrTodayPrev,
              cleanOrders,
              inFlightStatusRef.current,
              true
            );
            try {
              const nextJson = JSON.stringify(merged);
              if (localStorage.getItem('foodies_orders_live') !== nextJson) {
                localStorage.setItem('foodies_orders_live', nextJson);
              }
            } catch (e) { }
            queueMicrotask(() => store.dispatch(setReduxOrders(merged)));
            return areOrderListsEquivalent(prev, merged) ? prev : merged;
          });
          setHasLoadedOlderOrders(false);
          addToast({
            type: 'success',
            title: "Showing Today's Data 📅",
            message: 'Viewing today and active orders only.',
          });
        }
      }
    } finally {
      setIsFetchingOlderOrders(false);
    }
  };

  const refreshAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs?limit=200', { headers: getClientAuthHeaders(), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch (e) { }
  };

  const requestManagerAccess = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    const branchName = branch?.name || branchId;
    const nextReqs: Record<string, ManagerAccessRequest> = {
      ...managerAccessRequests,
      [branchId]: {
        branchId,
        status: 'pending',
        requestedBy: currentUser?.name || 'Platform Owner',
        requestedAt: new Date().toISOString(),
      },
    };
    setManagerAccessRequests(nextReqs);
    broadcastManagerAccessRequests(nextReqs);

    const logEntry: AuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      branchId,
      action: 'manager_access_requested',
      details: `Platform Owner (${currentUser.name}) requested authorization to act as Branch Manager for ${branchName}.`,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);
    fetch('/api/audit-logs', {
      method: 'POST',
      headers: getClientAuthHeaders(),
      body: JSON.stringify(logEntry),
    }).catch(() => { });

    addToast({
      type: 'info',
      title: 'Manager Access Requested ⏳',
      message: `Request sent to ${branchName} Branch Manager. Awaiting manager approval in Branch Staff Accounts.`,
    });
  };

  const respondManagerAccess = (branchId: string, accept: boolean) => {
    const branch = branches.find((b) => b.id === branchId);
    const branchName = branch?.name || branchId;
    const prevReq = managerAccessRequests[branchId];
    const nextReqs: Record<string, ManagerAccessRequest> = {
      ...managerAccessRequests,
      [branchId]: {
        branchId,
        status: accept ? 'approved' : 'rejected',
        requestedBy: prevReq?.requestedBy || 'Platform Owner',
        requestedAt: prevReq?.requestedAt,
        reviewedBy: currentUser?.name || 'Branch Manager',
        reviewedAt: new Date().toISOString(),
      },
    };
    setManagerAccessRequests(nextReqs);
    broadcastManagerAccessRequests(nextReqs);

    const logEntry: AuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      branchId,
      action: accept ? 'manager_access_granted' : 'manager_access_rejected',
      details: `Branch Manager (${currentUser.name}) ${accept ? 'ACCEPTED & AUTHORIZED' : 'DECLINED'} Platform Owner Manager-Mode request for ${branchName}.`,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);
    fetch('/api/audit-logs', {
      method: 'POST',
      headers: getClientAuthHeaders(),
      body: JSON.stringify(logEntry),
    }).catch(() => { });

    addToast({
      type: accept ? 'success' : 'warning',
      title: accept ? 'Owner Manager Access Approved ✓' : 'Owner Request Declined ✕',
      message: accept
        ? `Platform Owner is now authorized to switch into Manager Mode for ${branchName}.`
        : `Platform Owner request to switch to Manager Mode was declined.`,
    });
  };

  const revokeManagerAccess = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    const branchName = branch?.name || branchId;
    const nextReqs: Record<string, ManagerAccessRequest> = {
      ...managerAccessRequests,
      [branchId]: {
        branchId,
        status: 'none',
        requestedBy: '',
      },
    };
    setManagerAccessRequests(nextReqs);
    broadcastManagerAccessRequests(nextReqs);

    const logEntry: AuditLog = {
      id: `aud-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      branchId,
      action: 'manager_access_revoked',
      details: `Branch Manager (${currentUser.name}) revoked Platform Owner Manager-Mode authorization for ${branchName}.`,
    };
    setAuditLogs((prev) => [logEntry, ...prev]);
    fetch('/api/audit-logs', {
      method: 'POST',
      headers: getClientAuthHeaders(),
      body: JSON.stringify(logEntry),
    }).catch(() => { });

    addToast({
      type: 'info',
      title: 'Manager Access Revoked 🚫',
      message: `Platform Owner Manager-Mode authorization for ${branchName} has been revoked.`,
    });
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        currentRole,
        setCurrentRole,
        currentUser,
        setCurrentUser,
        currentBranchId,
        setCurrentBranchId,
        repriceCartForBranch,
        hasSelectedBranch,
        setHasSelectedBranch,
        currentBranch,
        branches,
        menuItems,
        orders,
        tables,
        floors,
        addFloor,
        removeFloor,
        addTable,
        updateTable,
        deleteTable,
        categories,
        addCategory,
        renameCategory,
        deleteCategory,
        updateMenuItem,
        addMenuItem,
        deleteMenuItem,
        allowRepresentativeMenuEdit,
        setAllowRepresentativeMenuEdit,
        footerSettings,
        updateFooterSettings,
        heroBanners,
        dealCard,
        allowRepresentativeDirectPublish,
        setAllowRepresentativeDirectPublish,
        pendingApprovalRequests,
        updateHeroBanner,
        addHeroBanner,
        deleteHeroBanner,
        updateDealCard,
        approveRequest,
        rejectRequest,
        shifts,
        refundRequests,
        auditLogs,
        cart,
        orderType,
        setOrderType,
        hasConfirmedOrderType,
        setHasConfirmedOrderType,
        menuSearchQuery,
        setMenuSearchQuery,
        toasts,
        addToast,
        removeToast,
        addToCart,
        updateCartItemQty,
        removeFromCart,
        clearCart,
        placeOrder,
        updateOrderStatus,
        sendOrderToKitchen,
        setOrderKitchenForwardTime,
        setAllOrdersKitchenForwardTime,
        recordCashPayment,
        updateOrderPayment,
        editOrderStage1,
        addAddOnsToOrderStage2,
        cancelOrder,
        assignRiderToOrder,
        unassignRiderFromOrder,
        acceptRiderOrder,
        finishRiderDelivery,
        updateRiderAvailability,
        departRider,
        customerCoordinates,
        setCustomerCoordinates,
        selectedDeliveryAddress,
        setSelectedDeliveryAddress,
        savedAddresses,
        addSavedAddress,
        deleteSavedAddress,
        detectAndStoreCurrentLocation,
        calculateDistanceKm,
        tableSessions,
        addTableSession,
        completeTableSession,
        updateTableStatus,
        markTableFree,
        generateTableQr,
        toggleTableQrAllowReserved,
        activeTableSession,
        setActiveTableSession,
        assignWaiterToOrder,
        markOrderDeliveredToTable,
        markOrderDoneAndCollected,
        cancelDineInOrder,
        addItemsToExistingOrder,
        toggleMenuItemBranchAvailability,
        updateMenuItemPrice,
        updateMenuItemBranchPrice,
        updateBranchSettings,
        updateBranchPaymentSettings,
        createBranch,
        toggleBranchStatus,
        shutdownModalState,
        closeShutdownModal,
        confirmShutdownKeepProcessing,
        confirmShutdownCancelOrders,
        openShift,
        closeShift,
        updateShiftOpeningBalance,
        currentShift,
        requestRefund,
        decideRefund,
        users,
        updateUserStatus,
        createUser,
        deleteUser,
        updateUser,
        hasLoadedOlderOrders,
        isFetchingOlderOrders,
        fetchOlderOrders,
        filterOrdersToToday,
        managerAccessRequests,
        requestManagerAccess,
        respondManagerAccess,
        revokeManagerAccess,
        refreshAuditLogs,
        branchUnavailableModal,
        setBranchUnavailableModal,
        closeBranchUnavailableModal,
        announcements,
        addAnnouncement,
        deleteAnnouncement,
        notifications,
        allNotifications,
        unreadNotificationsCount,
        notificationSettings,
        updateNotificationSettings,
        activeReceiverKey,
        myNotificationSettings,
        receiverNotificationSettingsMap,
        updateMyNotificationSettings,
        isNotificationModalOpen,
        setIsNotificationModalOpen,
        notificationModalDefaultTab,
        prefillNotificationOrder,
        openNotificationModal,
        sendNotification,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

// Redux Toolkit Direct Hooks, Store, Slices & Sync Engine Exports
export { useAppDispatch, useAppSelector } from '@/redux/hooks';
export { store } from '@/redux/store';
export {
  selectAllOrders,
  selectTodayOrders,
  selectActiveOrders,
  selectOrdersByBranch,
  selectOrderById,
  selectHasLoadedOlderOrders,
  selectIsFetchingOlderOrders,
} from '@/redux/slices/ordersSlice';
export {
  selectCartItems,
  selectCartCount,
  selectCartSubtotal,
} from '@/redux/slices/cartSlice';
export {
  selectBranches,
  selectCurrentBranchId,
  selectCurrentBranch,
  selectMenuItems,
  selectCategories,
  selectTables,
  selectBranchTables,
  selectShifts,
  selectCurrentShift,
  selectRefundRequests,
  selectHeroBanners,
  selectDealCard,
  selectFooterSettings,
  selectUsers,
  selectAuditLogs,
  selectTableSessions,
  selectActiveTableSession,
  selectCustomerCoordinates,
  selectAnnouncements,
  selectNotifications,
  selectNotificationSettings,
} from '@/redux/slices/cafeSlice';
export {
  selectTheme,
  selectCurrentRole,
  selectCurrentUser,
  selectToasts,
  selectMenuSearchQuery,
} from '@/redux/slices/uiSlice';
export { runSync, broadcastStateMutation } from '@/redux/sync/syncEngine';
