import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Platform, StatusBar as RNStatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { reverseGeocodeOpenStreetMap } from '../utils/openStreetMap';
import {
  MobileRole,
  MobileUser,
  Branch,
  MenuItem,
  Order,
  Table,
  CartItem,
  TableStatus,
  OrderStatus,
  AuditLog,
  OrderType,
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
  SavedDeliveryAddress,
  STATUS_RANK,
} from '../types';
import {
  SEED_BRANCHES,
  SEED_MENU_ITEMS,
  SEED_TABLES,
  SEED_ORDERS,
  SEED_USERS,
  SEED_AUDIT_LOGS,
  SEED_ANNOUNCEMENTS,
  SEED_NOTIFICATIONS,
  fetchLiveSyncData,
  apiFetch,
  normalizeBranchId,
  getItemMinPrice,
  getItemEffectivePrice,
  getApiBaseUrl,
  postNotificationToServer,
  updateNotificationSettingsOnServer,
  updateReceiverNotificationSettingsOnServer,
  patchNotificationReadOnServer,
  deleteNotificationsOnServer,
} from '../services/api';
import {
  requestNativeNotificationPermissions,
  presentNativeNotification,
  dismissNativeNotification,
  dismissAllNativeNotifications,
  addNotificationResponseListener,
} from '../services/nativeNotifications';
import {
  saveSecureAuthToken,
  getSecureAuthToken,
  clearSecureAuthToken,
} from '../services/secureTokenStore';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'danger' | 'warning' | 'info';
}

const GUEST_CUSTOMER: MobileUser = {
  id: 'guest',
  name: 'Guest Customer',
  phone: '',
  email: '',
  role: 'customer',
  status: 'active',
};

// Customer session duration: 30 days for mobile app
const CUSTOMER_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface AppContextType {
  role: MobileRole;
  setRole: (role: MobileRole) => void;
  appMode: 'customer' | 'staff';
  setAppMode: (mode: 'customer' | 'staff') => void;

  // Staff Authentication
  staffUser: MobileUser | null;
  staffLoginCounter: number;
  loginStaff: (user: MobileUser, password?: string) => Promise<void> | void;
  logoutStaff: () => Promise<void> | void;

  // Customer Authentication & Session
  customerUser: MobileUser | null;
  customerLoginCounter: number;
  isCustomerLoggedIn: boolean;
  loginCustomer: (user: MobileUser) => void;
  logoutCustomer: () => void;

  // Current active user (role-aware)
  currentUser: MobileUser;
  setCurrentUser: (user: MobileUser) => void;
  updateCurrentUser: (updates: Partial<MobileUser>) => void;

  // Branch & Navigation
  currentBranch: Branch;
  setBranchId: (branchId: string) => void;
  hasSelectedBranch: boolean;
  setHasSelectedBranch: (selected: boolean) => void;
  branches: Branch[];
  menuItems: MenuItem[];
  categories: string[];
  tables: Table[];
  orders: Order[];
  auditLogs: AuditLog[];
  refreshData: () => Promise<void>;

  // Cart
  cart: CartItem[];
  addToCart: (
    item: MenuItem,
    size?: string,
    extras?: string[],
    instructions?: string,
    startCoords?: { startX: number; startY: number }
  ) => void;
  updateCartQty: (itemId: string, delta: number) => void;
  removeFromCart: (itemId: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;

  // Flying Item Animation (Matching Web foodies-flying-piece)
  flyingItem: { id: string; startX: number; startY: number; dishImage?: string; iconType?: 'burger' | 'bucket' } | null;
  triggerFlyToCart: (coords: { startX: number; startY: number }, dishImage?: string) => void;
  dismissFlyingItem: () => void;

  // Announcements
  announcements: Announcement[];
  addAnnouncement: (a: Omit<Announcement, 'id'>) => void;
  deleteAnnouncement: (id: string) => void;

  // Live Notifications (Web & Mobile Parity)
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
  openNotificationModal: (tab?: 'inbox' | 'send' | 'settings', order?: Order | null) => void;
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
    targetRoles: Array<MobileRole | 'all'>;
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
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;

  // Fulfillment / Order Type
  orderType: OrderType | null;
  setOrderType: (type: OrderType | null) => void;

  // Customer actions
  customerCoordinates: { lat: number; lng: number };
  setCustomerCoordinates: (coords: { lat: number; lng: number }) => void;
  placeOrder: (orderData: Partial<Order>) => Order;
  cancelOrder: (orderId: string, reason?: string) => boolean;
  updateOrderStatus: (orderId: string, status: OrderStatus, extraFields?: Record<string, any>) => void;
  updateOrderPayment: (orderId: string, paymentStatus: 'paid' | 'unpaid') => void;
  editOrderStage1: (orderId: string, updatedItems: CartItem[]) => void;

  // On-demand Historical / Multi-day Data Loading
  hasLoadedOlderOrders: boolean;
  isFetchingOlderOrders: boolean;
  fetchOlderOrders: (branchId?: string, dateScope?: string, startDate?: string, endDate?: string) => Promise<void>;
  filterOrdersToToday: () => Promise<void>;

  // Staff Administration & Users
  users: MobileUser[];
  createUser: (userData: Partial<MobileUser>) => Promise<MobileUser | null>;
  updateUser: (userId: string, updates: Partial<MobileUser>) => Promise<boolean>;
  deleteUser: (userId: string) => Promise<boolean>;

  // Menu Management
  createMenuItem: (itemData: Partial<MenuItem>) => Promise<boolean>;
  deleteMenuItem: (itemId: string) => Promise<boolean>;
  toggleMenuItemBranchAvailability: (itemId: string, branchId: string) => Promise<void>;
  updateMenuItemBranchPrice: (itemId: string, branchId: string, overridePrice: number) => Promise<void>;
  addCategory: (categoryName: string) => void;
  renameCategory: (oldCat: string, newCat: string) => void;
  deleteCategory: (categoryName: string) => void;
  importSheetCatalog: (payload: {
    categories: string[];
    menuItems: { action: 'create' | 'update'; item: MenuItem }[];
    dealsAndBanners?: any[];
  }) => Promise<boolean>;

  // Financials & Refunds
  refunds: any[];
  requestRefund: (orderId: string, amount: number, reason: string) => Promise<void>;
  approveRefund: (refundId: string) => Promise<void>;
  rejectRefund: (refundId: string) => Promise<void>;
  shifts: any[];
  openShift: (openingFloat: number) => Promise<void>;
  closeShift: (countedCash: number, differenceReason: string) => Promise<void>;
  updateShiftOpeningBalance: (shiftId: string, newOpeningFloat: number) => Promise<void>;

  // Branch Governance
  createBranch: (branchData: Partial<Branch>) => Promise<boolean>;

  // Owner & Manager actions
  updateMenuItemStock: (menuItemId: string, isAvailable: boolean) => void;
  updateMenuItemPrice: (menuItemId: string, newPrice: number) => void;
  updateBranchSettings: (branchId: string, updates: Partial<Branch>) => void;
  toggleBranchStatus: (branchId: string) => void;
  shutdownModalState: {
    visible: boolean;
    branch: Branch | null;
    pendingOrders: Order[];
  };
  closeShutdownModal: () => void;
  confirmShutdownKeepProcessing: () => void;
  confirmShutdownCancelOrders: () => void;

  // Floor Staff & Table actions
  addTable: (tableData: Omit<Table, 'id'>) => void;
  deleteTable: (tableId: string) => void;
  updateTableStatus: (tableId: string, status: TableStatus) => void;
  updateTable: (tableId: string, updates: Partial<Table>) => void;
  markTableFree: (tableIdOrNumber: string) => void;
  generateTableQr: (tableId: string, validMinutes: number, allowOnReserved?: boolean) => Promise<Table | null>;
  toggleTableQrAllowReserved: (tableId: string, allow: boolean) => Promise<void>;
  assignWaiterToOrder: (orderId: string, waiterId: string, waiterName: string) => Promise<void>;
  assignRiderToOrder: (orderId: string, riderId: string) => Promise<void>;
  unassignRiderFromOrder: (orderId: string) => Promise<void>;
  acceptRiderOrder: (orderId: string) => Promise<void>;
  markOrderDeliveredToTable: (orderId: string) => void;
  markOrderDoneAndCollected: (orderId: string, cashCollected?: boolean) => void;
  generateTablePin: (tableId: string) => string;
  placeFloorWalkInOrder: (tableNumber: string, items: CartItem[], customerName?: string) => Order;

  // Rider actions
  riderAvailability: 'available' | 'busy' | 'offline';
  toggleRiderDuty: () => void;
  updateRiderAvailability: (status: 'available' | 'busy' | 'offline', riderId?: string) => void;
  departRider: (riderId?: string) => void;
  markDeliveryCompleted: (orderId: string, cashCollected: boolean) => void;

  // Toast
  toast: ToastMessage | null;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
  headerHeight: number;
  setHeaderHeight: (h: number) => void;

  // Branch Item Unavailability Alert Modal
  branchUnavailableModal: { visible: boolean; branchName: string; itemNames: string[] } | null;
  setBranchUnavailableModal: (modal: { visible: boolean; branchName: string; itemNames: string[] } | null) => void;
  closeBranchUnavailableModal: () => void;

  // Saved Delivery Addresses & Order Type Confirmation
  savedAddresses: SavedDeliveryAddress[];
  addSavedAddress: (addr: Omit<SavedDeliveryAddress, 'id'>) => SavedDeliveryAddress;
  deleteSavedAddress: (id: string) => void;
  selectedDeliveryAddress: string;
  setSelectedDeliveryAddress: (addr: string) => void;
  detectAndStoreCurrentLocation: () => Promise<{
    coords: { lat: number; lng: number };
    address: string;
    city: string;
  } | null>;
  hasConfirmedOrderType: boolean;
  setHasConfirmedOrderType: (confirmed: boolean) => void;
  calculateDistanceKm: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  isBottomSheetOpen: boolean;
  setBottomSheetOpen: (open: boolean) => void;
}

function buildMobileOrderNotificationRoles(
  orderType: OrderType | undefined,
  settings: NotificationSettings
): Array<MobileRole | 'all'> {
  const roles: Array<MobileRole | 'all'> = ['platform_owner'];
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

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<MobileRole>('customer');
  const [appMode, setAppModeState] = useState<'customer' | 'staff'>('customer');

  // Dedicated staff user
  const [staffUser, setStaffUserState] = useState<MobileUser | null>(null);
  const [staffLoginCounter, setStaffLoginCounter] = useState<number>(0);

  // Dedicated logged-in customer user (null when guest / logged out)
  const [customerUser, setCustomerUserState] = useState<MobileUser | null>(null);
  const [customerLoginCounter, setCustomerLoginCounter] = useState<number>(0);

  // Custom in-memory overrides
  const [customUserData, setCustomUserData] = useState<Partial<MobileUser>>({});

  // Core data states
  const [branches, setBranches] = useState<Branch[]>(SEED_BRANCHES);
  const [currentBranchId, setCurrentBranchId] = useState<string>('gulberg-lahore');
  const [menuItems, setMenuItems] = useState<MenuItem[]>(SEED_MENU_ITEMS);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [tables, setTables] = useState<Table[]>(SEED_TABLES);
  const [orders, setOrders] = useState<Order[]>(SEED_ORDERS);
  const [hasLoadedOlderOrders, setHasLoadedOlderOrders] = useState<boolean>(false);
  const [isFetchingOlderOrders, setIsFetchingOlderOrders] = useState<boolean>(false);
  const ordersRef = useRef<Order[]>(orders);
  const inFlightOrdersRef = useRef<Map<string, {
    status?: OrderStatus;
    riderStatus?: 'assigned' | 'accepted' | 'picked_up' | 'en_route' | 'delivered' | 'on_trip';
    paymentStatus?: 'paid' | 'unpaid';
    paymentCollected?: boolean;
    timestamp: number;
  }>>(new Map());
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
  const [users, setUsers] = useState<MobileUser[]>(SEED_USERS);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(SEED_AUDIT_LOGS);
  const [announcements, setAnnouncements] = useState<Announcement[]>(SEED_ANNOUNCEMENTS);
  const [allNotifications, setAllNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [receiverNotificationSettingsMap, setReceiverNotificationSettingsMap] = useState<
    Record<string, ReceiverNotificationPreferences>
  >({});
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [notificationModalDefaultTab, setNotificationModalDefaultTab] = useState<'inbox' | 'send' | 'settings'>('inbox');
  const [prefillNotificationOrder, setPrefillNotificationOrder] = useState<Order | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set(SEED_NOTIFICATIONS.map((n) => n.id)));
  const isFirstNotifLoadRef = useRef<boolean>(true);
  const [myPlacedOrderIds, setMyPlacedOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem('@foodies_customer_order_ids')
      .then((val) => {
        if (val) {
          try {
            const arr = JSON.parse(val);
            if (Array.isArray(arr)) {
              setMyPlacedOrderIds(new Set(arr.map(String)));
            }
          } catch { }
        }
      })
      .catch(() => { });
  }, []);

  // Request native device notification permissions on startup
  useEffect(() => {
    requestNativeNotificationPermissions().catch(() => { });
  }, []);

  const [flyingItem, setFlyingItem] = useState<{ id: string; startX: number; startY: number; dishImage?: string; iconType?: 'burger' | 'bucket' } | null>(null);
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [bottomSheetOpenCount, setBottomSheetOpenCount] = useState(0);
  const setBottomSheetOpen = useCallback((open: boolean) => {
    setBottomSheetOpenCount((prev) => (open ? prev + 1 : Math.max(0, prev - 1)));
  }, []);
  const isBottomSheetOpen = bottomSheetOpenCount > 0 || isNotificationModalOpen;
  const [headerHeight, setHeaderHeight] = useState<number>(
    Platform.OS === 'android'
      ? Math.max(RNStatusBar.currentHeight || 0, 30) + 14 + 38 + 12
      : Platform.OS === 'ios'
        ? 104
        : 72
  );
  const [riderAvailability, setRiderAvailability] = useState<'available' | 'busy' | 'offline'>('available');
  const [customerCoordinates, setCustomerCoordinatesState] = useState<{ lat: number; lng: number }>({
    lat: 31.5204,
    lng: 74.3587,
  });

  const setCustomerCoordinates = useCallback((coords: { lat: number; lng: number }) => {
    setCustomerCoordinatesState(coords);
    AsyncStorage.setItem('@foodies_customer_coordinates', JSON.stringify(coords)).catch(() => { });
  }, []);

  const DEFAULT_SAVED_ADDRESSES: SavedDeliveryAddress[] = [
    {
      id: 'addr-default-1',
      label: 'Home',
      address: 'House #14, Street 5, Main Boulevard Gulberg III, Lahore',
      city: 'Lahore',
      coordinates: { lat: 31.5204, lng: 74.3587 },
      isDefault: true,
    },
  ];

  const [savedAddresses, setSavedAddresses] = useState<SavedDeliveryAddress[]>(DEFAULT_SAVED_ADDRESSES);
  const [selectedDeliveryAddress, setSelectedDeliveryAddressState] = useState<string>('House #14, Street 5, Main Boulevard Gulberg III, Lahore');

  const setSelectedDeliveryAddress = useCallback((addr: string) => {
    setSelectedDeliveryAddressState(addr);
    AsyncStorage.setItem('@foodies_selected_delivery_address', addr).catch(() => { });
  }, []);

  const [hasConfirmedOrderType, setHasConfirmedOrderType] = useState<boolean>(false);
  const [hasSelectedBranch, setHasSelectedBranch] = useState<boolean>(false);

  // Hydrate persisted current coordinates, delivery address, and saved addresses on startup
  useEffect(() => {
    AsyncStorage.multiGet([
      '@foodies_customer_coordinates',
      '@foodies_selected_delivery_address',
      '@foodies_saved_addresses',
    ])
      .then(([[, coordsRaw], [, addrRaw], [, savedRaw]]) => {
        if (coordsRaw) {
          try {
            const parsed = JSON.parse(coordsRaw);
            if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
              setCustomerCoordinatesState(parsed);
            }
          } catch { }
        }
        if (addrRaw && addrRaw.trim()) {
          setSelectedDeliveryAddressState(addrRaw);
        }
        if (savedRaw) {
          try {
            const parsed = JSON.parse(savedRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSavedAddresses(parsed);
            }
          } catch { }
        }
      })
      .catch(() => { });
  }, []);

  // 1. Initial Storage Hydration (Customer & Staff Sessions)
  useEffect(() => {
    // Load Customer session with 30-day expiration check
    AsyncStorage.multiGet(['foodies_customer_user', 'foodies_customer_login_time'])
      .then(([[, savedCust], [, loginTimeStr]]) => {
        if (savedCust) {
          try {
            const loginTime = loginTimeStr ? parseInt(loginTimeStr, 10) : 0;
            const now = Date.now();
            if (loginTime > 0 && now - loginTime > CUSTOMER_SESSION_MAX_AGE_MS) {
              // 30 days expired: wipe customer session
              AsyncStorage.multiRemove([
                'foodies_customer_user',
                'foodies_customer_login_time',
                '@foodies_customer_order_ids',
                'foodies_customer_session',
              ]).catch(() => { });
              setCustomerUserState(null);
              showToast('Your session has expired (30 days). Please sign in again with email.', 'info');
              return;
            }

            const parsed = JSON.parse(savedCust);
            if (parsed && parsed.name && parsed.name !== 'Guest Customer') {
              setCustomerUserState(parsed);
              if (!loginTimeStr) {
                AsyncStorage.setItem('foodies_customer_login_time', Date.now().toString()).catch(() => { });
              }
              if (parsed.savedAddresses && Array.isArray(parsed.savedAddresses) && parsed.savedAddresses.length > 0) {
                AsyncStorage.getItem('@foodies_saved_addresses').then((existingSaved) => {
                  if (!existingSaved) setSavedAddresses(parsed.savedAddresses);
                }).catch(() => { });
              }
              if (parsed.address) {
                AsyncStorage.getItem('@foodies_selected_delivery_address').then((existingAddr) => {
                  if (!existingAddr) setSelectedDeliveryAddressState(parsed.address);
                }).catch(() => { });
              }
            }
          } catch { }
        }
      })
      .catch(() => { });

    // Load App Mode
    AsyncStorage.getItem('foodies_app_mode')
      .then((savedMode) => {
        if (savedMode === 'customer' || savedMode === 'staff') {
          setAppModeState(savedMode);
        }
      })
      .catch(() => { });

    // Load Staff session
    AsyncStorage.getItem('foodies_staff_user')
      .then(async (savedStaff) => {
        if (savedStaff) {
          try {
            const u = JSON.parse(savedStaff);
            setStaffUserState(u);
            setRoleState(u.role);
            if (u.branchId) {
              const normB = normalizeBranchId(u.branchId);
              setCurrentBranchId(normB);
              setHasSelectedBranch(true);
            }
            const existingToken = await getSecureAuthToken();
            if (!existingToken) {
              const baseUrl = getApiBaseUrl();
              const res = await fetch(`${baseUrl}/api/auth/staff`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  identifier: u.email || u.id,
                  password: u.password || 'password123',
                }),
              });
              const data = await res.json();
              if (data?.sessionToken) {
                await saveSecureAuthToken(data.sessionToken);
              }
            }
          } catch { }
        }
      })
      .catch(() => { });

    // Hydrate customer selected branch
    AsyncStorage.getItem('@foodies_customer_selected_branch')
      .then((savedBranch) => {
        if (savedBranch) {
          setCurrentBranchId(normalizeBranchId(savedBranch));
          setHasSelectedBranch(true);
        }
      })
      .catch(() => { });

    // Hydrate notification settings from permanent store
    AsyncStorage.getItem('@foodies_notification_settings')
      .then((saved) => {
        if (saved) {
          try {
            const p = JSON.parse(saved);
            if (p && typeof p === 'object') {
              setNotificationSettings(mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, p));
            }
          } catch { }
        }
      })
      .catch(() => { });

    // Hydrate per-receiver independent notification settings map
    AsyncStorage.getItem('@foodies_receiver_notif_settings_map')
      .then((saved) => {
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && typeof parsed === 'object') {
              setReceiverNotificationSettingsMap(parsed);
            }
          } catch { }
        }
      })
      .catch(() => { });

    // Hydrate permanent menu items, categories & tables so staff edits survive restarts
    AsyncStorage.getItem('@foodies_menu_permanent_store')
      .then((savedMenu) => {
        if (savedMenu) {
          try {
            const parsed = JSON.parse(savedMenu);
            if (Array.isArray(parsed) && parsed.length > 0) setMenuItems(parsed);
          } catch { }
        }
      })
      .catch(() => { });

    AsyncStorage.getItem('@foodies_categories_permanent_store')
      .then((savedCats) => {
        if (savedCats) {
          try {
            const parsed = JSON.parse(savedCats);
            if (Array.isArray(parsed) && parsed.length > 0) setCustomCategories(parsed);
          } catch { }
        }
      })
      .catch(() => { });

    AsyncStorage.getItem('@foodies_tables_store')
      .then((savedTables) => {
        if (savedTables) {
          try {
            const parsed = JSON.parse(savedTables);
            if (Array.isArray(parsed) && parsed.length > 0) setTables(parsed);
          } catch { }
        }
      })
      .catch(() => { });

    // Hydrate permanent branches settings from AsyncStorage
    AsyncStorage.getItem('@foodies_branches_permanent_store')
      .then((savedBranches) => {
        if (savedBranches) {
          try {
            const parsed = JSON.parse(savedBranches);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setBranches((curr) =>
                curr.map((b) => {
                  const match = parsed.find((p: Branch) => p.id === b.id || normalizeBranchId(p.id) === normalizeBranchId(b.id));
                  return match ? { ...b, ...match } : b;
                })
              );
            }
          } catch { }
        }
      })
      .catch(() => { });

    // Hydrate permanent order history from AsyncStorage
    AsyncStorage.getItem('@foodies_orders_permanent_store')
      .then((savedOrders) => {
        if (savedOrders) {
          try {
            const parsed = JSON.parse(savedOrders);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const liveOnly = parsed.filter(
                (o: Order) =>
                  !o.id?.startsWith('ord-del-') &&
                  !o.id?.startsWith('ord-dine-') &&
                  !o.id?.startsWith('ord-seed-') &&
                  !o.id?.startsWith('ord-take-') &&
                  o.id !== 'ord-101' &&
                  o.id !== 'ord-102' &&
                  o.orderNumber !== 'FC-8821' &&
                  o.orderNumber !== 'FC-8822' &&
                  o.orderNumber !== 'FC-6202' &&
                  o.orderNumber !== 'FC-6101' &&
                  o.orderNumber !== 'FC-6102'
              );
              setOrders(liveOnly);
              AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(liveOnly)).catch(() => { });
            } else {
              setOrders([]);
            }
          } catch {
            setOrders([]);
          }
        } else {
          setOrders([]);
        }
      })
      .catch(() => { });
  }, []);

  // 2. Initial Full Sync from PostgreSQL Backend
  const refreshData = useCallback(async () => {
    try {
      const isStaffMode = appMode === 'staff' || (role !== 'customer' && role !== 'platform_owner');
      const syncBranchId = role === 'platform_owner' || role === 'kitchen_staff' ? 'all' : currentBranchId;
      const syncPhone = isStaffMode ? undefined : customerUser?.phone;
      const syncId = isStaffMode ? undefined : customerUser?.id;
      const syncOrderIds = isStaffMode ? undefined : ordersRef.current.map((o) => o.id);
      const data = await fetchLiveSyncData('full', syncBranchId, syncPhone, syncId, role, syncOrderIds);
      if (data) {
        if (data.branches?.length) {
          setBranches((prev) => {
            const merged = prev.map((b) => {
              const match = data.branches.find((dbB: Branch) => dbB.id === b.id || normalizeBranchId(dbB.id) === normalizeBranchId(b.id));
              return match ? { ...b, ...match } : b;
            });
            AsyncStorage.setItem('@foodies_branches_permanent_store', JSON.stringify(merged)).catch(() => { });
            return merged;
          });
        }
        if (data.menuItems?.length) {
          setMenuItems(data.menuItems);
          AsyncStorage.setItem('@foodies_menu_permanent_store', JSON.stringify(data.menuItems)).catch(() => { });
        }
        if (Array.isArray((data as any).categories) && (data as any).categories.length) {
          setCustomCategories((data as any).categories);
          AsyncStorage.setItem('@foodies_categories_permanent_store', JSON.stringify((data as any).categories)).catch(() => { });
        }
        if (data.tables?.length) {
          setTables(data.tables);
          AsyncStorage.setItem('@foodies_tables_store', JSON.stringify(data.tables)).catch(() => { });
        }
        if (Array.isArray(data.orders) && data.orders.length > 0) {
          setOrders((prev) => {
            const map = new Map<string, Order>();
            const orderNumToId = new Map<string, string>();
            prev
              .filter(
                (o) =>
                  !o.id?.startsWith('ord-del-') &&
                  !o.id?.startsWith('ord-dine-') &&
                  !o.id?.startsWith('ord-seed-') &&
                  !o.id?.startsWith('ord-take-') &&
                  o.orderNumber !== 'FC-8821' &&
                  o.orderNumber !== 'FC-8822'
              )
              .forEach((o) => {
                map.set(o.id, o);
                if (o.orderNumber) orderNumToId.set(o.orderNumber, o.id);
              });
            data.orders.forEach((inc: Order) => {
              const matchedId = map.has(inc.id)
                ? inc.id
                : (inc.orderNumber && orderNumToId.get(inc.orderNumber)) || undefined;
              const existing = matchedId ? map.get(matchedId) : undefined;
              const targetKey = inc.id || existing?.id || '';
              const inFlight = inFlightOrdersRef.current.get(targetKey) || (inc.orderNumber ? inFlightOrdersRef.current.get(inc.orderNumber) : undefined);
              const isLocallyPaid =
                Boolean(existing && (existing.paymentStatus === 'paid' || existing.paymentCollected === true)) ||
                Boolean(inFlight && (inFlight.paymentStatus === 'paid' || inFlight.paymentCollected === true)) ||
                inc.paymentStatus === 'paid' ||
                Boolean(inc.paymentCollected);

              const incStatus = inc.status as string;
              const existingStatus = existing?.status as string | undefined;
              const inFlightStatus = inFlight?.status as string | undefined;

              const isDeliveryFinished =
                (inc.type === 'delivery' || existing?.type === 'delivery') &&
                isLocallyPaid &&
                (incStatus === 'delivered' || incStatus === 'completed' || existingStatus === 'completed' || inc.riderStatus === 'delivered' || inFlight?.riderStatus === 'delivered');

              const isDineInFinished =
                (inc.type === 'dine_in' || existing?.type === 'dine_in') &&
                isLocallyPaid &&
                (incStatus === 'served' || incStatus === 'completed' || existingStatus === 'served' || existingStatus === 'completed');

              const isTakeawayFinished =
                (inc.type === 'takeaway' || existing?.type === 'takeaway') &&
                isLocallyPaid &&
                (incStatus === 'taken' || incStatus === 'completed' || existingStatus === 'taken' || existingStatus === 'completed');

              const isOrderFinished =
                incStatus === 'completed' ||
                existingStatus === 'completed' ||
                inFlightStatus === 'completed' ||
                isDeliveryFinished ||
                isDineInFinished ||
                isTakeawayFinished;

              if (existing) {
                const existingRank = STATUS_RANK[existing.status] || 0;
                const incomingRank = STATUS_RANK[inc.status] || 0;
                const isLocalCancelled = existing.status === 'cancelled';
                const preserveLocal =
                  isLocalCancelled ||
                  (existing.status !== 'cancelled' &&
                    inc.status !== 'cancelled' &&
                    existingRank > incomingRank);

                const resolvedStatus = isLocalCancelled
                  ? ('cancelled' as OrderStatus)
                  : isOrderFinished
                    ? ('completed' as OrderStatus)
                    : inFlight?.status || (preserveLocal ? existing.status : inc.status);

                if (matchedId && matchedId !== targetKey) {
                  map.delete(matchedId);
                }
                map.set(targetKey, {
                  ...inc,
                  id: targetKey,
                  status: resolvedStatus,
                  paymentStatus: (isOrderFinished || isLocallyPaid) && inc.paymentStatus !== 'refunded' ? 'paid' : (inc.paymentStatus || existing.paymentStatus),
                  paymentCollected: Boolean(isOrderFinished || isLocallyPaid || existing.paymentCollected || inc.paymentCollected),
                  sentToKitchen: existing.sentToKitchen || inc.sentToKitchen,
                  sentToKitchenAt: inc.sentToKitchenAt || existing.sentToKitchenAt,
                  preparationStartedAt: inc.preparationStartedAt || existing.preparationStartedAt,
                  completedAt: isOrderFinished ? (inc.completedAt || existing.completedAt || new Date().toISOString()) : (inc.completedAt || existing.completedAt),
                  deliveredAt: isOrderFinished ? (inc.deliveredAt || existing.deliveredAt || new Date().toISOString()) : (inc.deliveredAt || existing.deliveredAt),
                  assignedRiderId: inc.assignedRiderId || existing.assignedRiderId,
                  assignedRiderName: inc.assignedRiderName || existing.assignedRiderName,
                  assignedWaiterId: inc.assignedWaiterId || existing.assignedWaiterId,
                  assignedWaiterName: inc.assignedWaiterName || existing.assignedWaiterName,
                  riderStatus: (isOrderFinished && (inc.type === 'delivery' || existing.type === 'delivery')) ? 'delivered' : (inFlight?.riderStatus || inc.riderStatus || existing.riderStatus),
                });
              } else {
                map.set(inc.id, isOrderFinished ? {
                  ...inc,
                  status: 'completed',
                  riderStatus: inc.type === 'delivery' ? 'delivered' : inc.riderStatus,
                  paymentStatus: 'paid',
                  paymentCollected: true,
                  completedAt: inc.completedAt || new Date().toISOString(),
                  deliveredAt: inc.deliveredAt || new Date().toISOString(),
                } : {
                  ...inc,
                  status: inFlight?.status || inc.status,
                  paymentStatus: (inFlight?.paymentStatus === 'paid') ? 'paid' : inc.paymentStatus,
                  paymentCollected: Boolean(inc.paymentCollected || inFlight?.paymentCollected),
                  riderStatus: inFlight?.riderStatus || inc.riderStatus,
                });
              }
            });
            const merged = Array.from(map.values()).sort(
              (a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0)
            );
            AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(merged)).catch(() => { });
            return merged;
          });
        }
        if (Array.isArray(data.users) && data.users.length) setUsers(data.users);
        if (Array.isArray((data as any).refunds)) setRefunds((data as any).refunds);
        if (Array.isArray((data as any).shifts)) setShifts((data as any).shifts);
        if (Array.isArray((data as any).announcements)) setAnnouncements((data as any).announcements);
        if (Array.isArray((data as any).notifications)) setAllNotifications((data as any).notifications);
        if ((data as any).notificationSettings && typeof (data as any).notificationSettings === 'object') {
          const incoming = (data as any).notificationSettings;
          const merged = mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, incoming);
          setNotificationSettings(merged);
          AsyncStorage.setItem('@foodies_notification_settings', JSON.stringify(merged)).catch(() => { });
        }
        if ((data as any).receiverNotificationSettingsMap && typeof (data as any).receiverNotificationSettingsMap === 'object') {
          const incomingMap = (data as any).receiverNotificationSettingsMap;
          setReceiverNotificationSettingsMap((prev) => {
            const merged = { ...prev, ...incomingMap };
            AsyncStorage.setItem('@foodies_receiver_notif_settings_map', JSON.stringify(merged)).catch(() => { });
            return merged;
          });
        }
      }
    } catch (_e) { }
  }, [currentBranchId, role, appMode, customerUser?.phone, customerUser?.id]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // 3. Fallback High-Frequency Live Polling (3.5s for Staff, 8s for Customers with ETag 304 support)
  // Keeps Web and Mobile in Real-Time Parity for order updates, status shifts, and payment confirmations
  useEffect(() => {
    const isStaffMode = appMode === 'staff' || role !== 'customer';
    const pollInterval = isStaffMode ? 2500 : 5000;

    const pollTimer = setInterval(async () => {
      try {
        const syncBranchId = role === 'platform_owner' || role === 'kitchen_staff' ? 'all' : currentBranchId;
        const syncPhone = isStaffMode ? undefined : customerUser?.phone;
        const syncId = isStaffMode ? undefined : customerUser?.id;
        const syncOrderIds = isStaffMode ? undefined : ordersRef.current.map((o) => o.id);
        const live = await fetchLiveSyncData('live', syncBranchId, syncPhone, syncId, role, syncOrderIds);
        if (live) {
          if (Array.isArray(live.orders) && live.orders.length > 0) {
            setOrders((prev) => {
              const map = new Map<string, Order>();
              const orderNumToId = new Map<string, string>();
              prev
                .filter(
                  (o) =>
                    !o.id?.startsWith('ord-del-') &&
                    !o.id?.startsWith('ord-dine-') &&
                    !o.id?.startsWith('ord-seed-') &&
                    !o.id?.startsWith('ord-take-') &&
                    o.orderNumber !== 'FC-8821' &&
                    o.orderNumber !== 'FC-8822'
                )
                .forEach((o) => {
                  map.set(o.id, o);
                  if (o.orderNumber) orderNumToId.set(o.orderNumber, o.id);
                });
              live.orders.forEach((inc: Order) => {
                const matchedId = map.has(inc.id)
                  ? inc.id
                  : (inc.orderNumber && orderNumToId.get(inc.orderNumber)) || undefined;
                const existing = matchedId ? map.get(matchedId) : undefined;
                const targetKey = inc.id || existing?.id || '';
                const inFlight = inFlightOrdersRef.current.get(targetKey) || (inc.orderNumber ? inFlightOrdersRef.current.get(inc.orderNumber) : undefined);
                const isLocallyPaid =
                  Boolean(existing && (existing.paymentStatus === 'paid' || existing.paymentCollected === true)) ||
                  Boolean(inFlight && (inFlight.paymentStatus === 'paid' || inFlight.paymentCollected === true)) ||
                  inc.paymentStatus === 'paid' ||
                  Boolean(inc.paymentCollected);

                const incStatus = inc.status as string;
                const existingStatus = existing?.status as string | undefined;
                const inFlightStatus = inFlight?.status as string | undefined;

                const isDeliveryFinished =
                  (inc.type === 'delivery' || existing?.type === 'delivery') &&
                  isLocallyPaid &&
                  (incStatus === 'delivered' || incStatus === 'completed' || existingStatus === 'completed' || inc.riderStatus === 'delivered' || inFlight?.riderStatus === 'delivered');

                const isDineInFinished =
                  (inc.type === 'dine_in' || existing?.type === 'dine_in') &&
                  isLocallyPaid &&
                  (incStatus === 'served' || incStatus === 'completed' || existingStatus === 'served' || existingStatus === 'completed');

                const isTakeawayFinished =
                  (inc.type === 'takeaway' || existing?.type === 'takeaway') &&
                  isLocallyPaid &&
                  (incStatus === 'taken' || incStatus === 'completed' || existingStatus === 'taken' || existingStatus === 'completed');

                const isTerminalSettled =
                  incStatus === 'completed' ||
                  existingStatus === 'completed' ||
                  inFlightStatus === 'completed' ||
                  isDeliveryFinished ||
                  isDineInFinished ||
                  isTakeawayFinished;

                if (existing) {
                  const existingRank = STATUS_RANK[existing.status] || 0;
                  const incomingRank = STATUS_RANK[inc.status] || 0;
                  const isLocalCancelled = existing.status === 'cancelled';
                  const preserveLocal =
                    isLocalCancelled ||
                    (existing.status !== 'cancelled' &&
                      inc.status !== 'cancelled' &&
                      existingRank > incomingRank);

                  const resolvedStatus = isLocalCancelled
                    ? 'cancelled'
                    : isTerminalSettled
                      ? ('completed' as OrderStatus)
                      : inFlight?.status || (preserveLocal ? existing.status : inc.status);

                  if (matchedId && matchedId !== targetKey) {
                    map.delete(matchedId);
                  }
                  map.set(targetKey, {
                    ...inc,
                    id: targetKey,
                    status: resolvedStatus,
                    paymentStatus: (isTerminalSettled || isLocallyPaid) && inc.paymentStatus !== 'refunded' ? 'paid' : (inc.paymentStatus || existing.paymentStatus),
                    paymentCollected: Boolean(isTerminalSettled || isLocallyPaid || existing.paymentCollected || inc.paymentCollected),
                    sentToKitchen: existing.sentToKitchen || inc.sentToKitchen,
                    sentToKitchenAt: inc.sentToKitchenAt || existing.sentToKitchenAt,
                    preparationStartedAt: inc.preparationStartedAt || existing.preparationStartedAt,
                    completedAt: isTerminalSettled ? (inc.completedAt || existing.completedAt || new Date().toISOString()) : (inc.completedAt || existing.completedAt),
                    deliveredAt: isTerminalSettled ? (inc.deliveredAt || existing.deliveredAt || new Date().toISOString()) : (inc.deliveredAt || existing.deliveredAt),
                    assignedRiderId: inc.assignedRiderId || existing.assignedRiderId,
                    assignedRiderName: inc.assignedRiderName || existing.assignedRiderName,
                    assignedWaiterId: inc.assignedWaiterId || existing.assignedWaiterId,
                    assignedWaiterName: inc.assignedWaiterName || existing.assignedWaiterName,
                    riderStatus: (isTerminalSettled && (inc.type === 'delivery' || existing?.type === 'delivery')) ? 'delivered' : (inFlight?.riderStatus || inc.riderStatus || existing.riderStatus),
                  });
                } else {
                  map.set(inc.id, isTerminalSettled ? {
                    ...inc,
                    status: 'completed',
                    riderStatus: inc.type === 'delivery' ? 'delivered' : inc.riderStatus,
                    paymentStatus: 'paid',
                    paymentCollected: true,
                    completedAt: inc.completedAt || new Date().toISOString(),
                    deliveredAt: inc.deliveredAt || new Date().toISOString(),
                  } : inc);
                }
              });
              const merged = Array.from(map.values()).sort(
                (a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0)
              );
              AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(merged)).catch(() => { });
              return merged;
            });
          }
          if (Array.isArray(live.tables) && live.tables.length > 0) {
            setTables(live.tables);
          }
          if (Array.isArray(live.branches) && live.branches.length > 0) {
            setBranches((prev) => {
              const merged = prev.map((b) => {
                const match = live.branches.find((lb: Branch) => lb.id === b.id || normalizeBranchId(lb.id) === normalizeBranchId(b.id));
                return match ? { ...b, ...match } : b;
              });
              AsyncStorage.setItem('@foodies_branches_permanent_store', JSON.stringify(merged)).catch(() => { });
              return merged;
            });
          }
          if (Array.isArray(live.menuItems) && live.menuItems.length > 0) {
            setMenuItems(live.menuItems);
            AsyncStorage.setItem('@foodies_menu_permanent_store', JSON.stringify(live.menuItems)).catch(() => { });
          }
          if (Array.isArray((live as any).categories) && (live as any).categories.length > 0) {
            setCustomCategories((live as any).categories);
            AsyncStorage.setItem('@foodies_categories_permanent_store', JSON.stringify((live as any).categories)).catch(() => { });
          }
          if (Array.isArray(live.users) && live.users.length > 0) {
            setUsers(live.users);

            // Active Staff Session Revocation Check: If suspended or deactivated in DB, immediately log out
            if (staffUser && staffUser.role !== 'platform_owner') {
              const freshSelf = live.users.find(
                (u: MobileUser) => u.id === staffUser.id || u.email.toLowerCase() === staffUser.email.toLowerCase()
              );
              if (freshSelf) {
                if (freshSelf.status !== 'active') {
                  setStaffUserState(null);
                  setAppModeState('customer');
                  setRoleState('customer');
                  clearSecureAuthToken();
                  AsyncStorage.removeItem('foodies_staff_user').catch(() => { });
                  AsyncStorage.setItem('foodies_app_mode', 'customer').catch(() => { });
                  setToast({
                    id: `toast-${Date.now()}`,
                    type: 'danger',
                    message: `Account Access Revoked: Your staff account has been ${freshSelf.status.toUpperCase()} by management.`,
                  });
                } else if (
                  freshSelf.name !== staffUser.name ||
                  freshSelf.role !== staffUser.role ||
                  freshSelf.branchId !== staffUser.branchId ||
                  freshSelf.status !== staffUser.status
                ) {
                  setStaffUserState((prev) => (prev ? { ...prev, ...freshSelf } : prev));
                  if (freshSelf.role !== staffUser.role) {
                    setRoleState(freshSelf.role);
                  }
                  if (freshSelf.branchId && freshSelf.branchId !== staffUser.branchId) {
                    setCurrentBranchId(normalizeBranchId(freshSelf.branchId));
                  }
                }
              }
            }
          }
          if (Array.isArray(live.refunds)) {
            setRefunds(live.refunds);
          }
          if (Array.isArray(live.shifts)) {
            setShifts(live.shifts);
          }
          if (Array.isArray((live as any).announcements)) {
            setAnnouncements((live as any).announcements);
          }
          if (Array.isArray((live as any).notifications)) {
            setAllNotifications((live as any).notifications);
          }
          if ((live as any).notificationSettings && typeof (live as any).notificationSettings === 'object') {
            const incoming = (live as any).notificationSettings;
            const merged = mergeNotificationSettings(DEFAULT_NOTIFICATION_SETTINGS, incoming);
            setNotificationSettings(merged);
            AsyncStorage.setItem('@foodies_notification_settings', JSON.stringify(merged)).catch(() => { });
          }
          if ((live as any).receiverNotificationSettingsMap && typeof (live as any).receiverNotificationSettingsMap === 'object') {
            const incomingMap = (live as any).receiverNotificationSettingsMap;
            setReceiverNotificationSettingsMap((prev) => {
              const merged = { ...prev, ...incomingMap };
              AsyncStorage.setItem('@foodies_receiver_notif_settings_map', JSON.stringify(merged)).catch(() => { });
              return merged;
            });
          }
        }
      } catch (_e) { }
    }, pollInterval);

    return () => clearInterval(pollTimer);
  }, [currentBranchId, staffUser, role, appMode, customerUser?.id, customerUser?.phone]);

  // Staff Sign In / Sign Out
  const loginStaff = async (user: MobileUser, password?: string) => {
    // Check live user record for status
    let liveUser = users.find((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()) || user;
    if (liveUser.status && liveUser.status !== 'active') {
      const st = liveUser.status.toUpperCase();
      showToast(`Account Access Prohibited: Staff account for ${liveUser.name} is ${st}. Login revoked by management.`, 'danger');
      return;
    }

    // Call /api/auth/staff to verify credentials and obtain cryptographically signed HMAC session token
    const pwd = password || (liveUser as any).password || 'password123';
    try {
      const baseUrl = getApiBaseUrl();
      const authRes = await fetch(`${baseUrl}/api/auth/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: liveUser.email || liveUser.phone || liveUser.id,
          password: pwd,
        }),
      });
      const authData = await authRes.json().catch(() => null);

      if (!authRes.ok) {
        showToast(
          authData?.error || (authRes.status === 403 ? 'Account deactivated or suspended by management.' : 'Invalid staff password or credentials.'),
          'danger'
        );
        return;
      }

      if (authData?.sessionToken) {
        await saveSecureAuthToken(authData.sessionToken);
      }
      if (authData?.user) {
        liveUser = { ...liveUser, ...authData.user };
      }
    } catch (_err) {
      // Offline fallback: verify status and password strictly if server is unreachable
      if (liveUser.status && liveUser.status !== 'active') {
        showToast(`Account Access Prohibited: Staff account for ${liveUser.name} is ${liveUser.status.toUpperCase()}.`, 'danger');
        return;
      }
      const expPwd = (liveUser as any).password || 'password123';
      if (pwd !== expPwd && pwd !== (liveUser as any).pin) {
        showToast('Invalid staff password or credentials.', 'danger');
        return;
      }
    }

    setStaffUserState(liveUser);
    setRoleState(liveUser.role);
    setAppModeState('staff');
    if (liveUser.branchId) {
      const normB = normalizeBranchId(liveUser.branchId);
      setCurrentBranchId(normB);
      setHasSelectedBranch(true);
      AsyncStorage.setItem('@foodies_customer_selected_branch', normB).catch(() => { });
    }
    setStaffLoginCounter((prev) => prev + 1);
    AsyncStorage.setItem('foodies_app_mode', 'staff').catch(() => { });
    AsyncStorage.setItem('foodies_staff_user', JSON.stringify(liveUser)).catch(() => { });
    showToast(`Signed in as ${liveUser.name}`, 'success');
    refreshData();
  };

  const logoutStaff = async () => {
    setStaffUserState(null);
    setStaffLoginCounter((prev) => prev + 1);
    await clearSecureAuthToken();
    AsyncStorage.removeItem('foodies_staff_user').catch(() => { });
    showToast('Signed out of staff operations', 'info');
  };

  // Customer Sign In / Sign Out (30-day session lifespan)
  const loginCustomer = (user: MobileUser) => {
    setCustomerUserState(user);
    setCustomUserData({});
    setCustomerLoginCounter((prev) => prev + 1);
    AsyncStorage.setItem('foodies_customer_user', JSON.stringify(user)).catch(() => { });
    AsyncStorage.setItem('foodies_customer_login_time', Date.now().toString()).catch(() => { });
    showToast(`Welcome back, ${user.name}!`, 'success');
  };

  const logoutCustomer = () => {
    setCustomerUserState(null);
    setCustomUserData({});
    setCustomerLoginCounter((prev) => prev + 1);
    setMyPlacedOrderIds(new Set());
    AsyncStorage.multiRemove([
      'foodies_customer_user',
      'foodies_customer_login_time',
      '@foodies_customer_order_ids',
      'foodies_customer_session',
    ]).catch(() => { });
    showToast('Signed out of customer account', 'info');
  };

  // Periodic customer session expiry check (30 days)
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const loginTimeStr = await AsyncStorage.getItem('foodies_customer_login_time');
        if (customerUser) {
          if (!loginTimeStr) {
            AsyncStorage.setItem('foodies_customer_login_time', Date.now().toString()).catch(() => { });
            return;
          }
          const loginTime = parseInt(loginTimeStr, 10);
          if (loginTime > 0 && Date.now() - loginTime > CUSTOMER_SESSION_MAX_AGE_MS) {
            logoutCustomer();
            showToast('Your session has expired (30 days). Please sign in again with email.', 'info');
          }
        }
      } catch { }
    }, 60000);
    return () => clearInterval(timer);
  }, [customerUser]);

  const setAppMode = (mode: 'customer' | 'staff') => {
    setAppModeState(mode);
    AsyncStorage.setItem('foodies_app_mode', mode).catch(() => { });
    if (mode === 'customer') {
      setRoleState('customer');
    } else if (staffUser) {
      setRoleState(staffUser.role);
    }
  };

  const updateCurrentUser = (updates: Partial<MobileUser>) => {
    setCustomUserData((prev) => ({ ...prev, ...updates }));
    if (customerUser) {
      const updated = { ...customerUser, ...updates };
      setCustomerUserState(updated);
      AsyncStorage.setItem('foodies_customer_user', JSON.stringify(updated)).catch(() => { });
      if (customerUser.id && customerUser.id !== 'guest') {
        apiFetch('/api/users', {
          method: 'PATCH',
          body: JSON.stringify({ id: customerUser.id, ...updates }),
        }).catch(() => { });
      }
    } else if (staffUser && staffUser.id) {
      const updatedStaff = { ...staffUser, ...updates };
      setStaffUserState(updatedStaff);
      AsyncStorage.setItem('foodies_staff_user', JSON.stringify(updatedStaff)).catch(() => { });
      apiFetch('/api/users', {
        method: 'PATCH',
        body: JSON.stringify({ id: staffUser.id, ...updates }),
      }).catch(() => { });
    }
    showToast('Profile updated successfully!', 'success');
  };

  // Active user per role & appMode
  const currentUser = useMemo<MobileUser>(() => {
    if (appMode === 'staff') {
      let base: MobileUser;
      switch (role) {
        case 'platform_owner':
          base = staffUser || SEED_USERS.find((u) => u.role === 'platform_owner') || SEED_USERS[0];
          break;
        case 'branch_manager':
          base = staffUser || SEED_USERS.find((u) => u.role === 'branch_manager') || SEED_USERS[1];
          break;
        case 'floor_staff':
          base = staffUser || SEED_USERS.find((u) => u.role === 'floor_staff') || SEED_USERS[2];
          break;
        case 'delivery_staff':
          base = staffUser || SEED_USERS.find((u) => u.role === 'delivery_staff') || SEED_USERS[3];
          break;
        default:
          base = staffUser || SEED_USERS[0];
          break;
      }
      return { ...base, ...customUserData };
    }

    // Customer App
    const base = customerUser || GUEST_CUSTOMER;
    return { ...base, ...customUserData };
  }, [appMode, role, staffUser, customerUser, customUserData]);

  const triggerFlyToCart = (coords: { startX: number; startY: number }, dishImage?: string) => {
    setFlyingItem({ id: Date.now().toString(), startX: coords.startX, startY: coords.startY, dishImage });
  };

  const dismissFlyingItem = () => {
    setFlyingItem(null);
  };

  const addAnnouncement = async (a: Omit<Announcement, 'id'>) => {
    const newA: Announcement = { ...a, id: `ann-${Date.now()}` };
    setAnnouncements((prev) => [newA, ...prev.filter((item) => item.id !== newA.id)]);
    showToast('Announcement posted successfully!', 'success');
    try {
      await apiFetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newA),
      });
    } catch (_err) { }
  };

  const deleteAnnouncement = async (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    showToast('Announcement removed', 'info');
    try {
      await apiFetch(`/api/announcements?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    } catch (_err) { }
  };

  const setRole = (newRole: MobileRole) => {
    setRoleState(newRole);
    AsyncStorage.setItem('foodies_mobile_role', newRole).catch(() => { });
  };

  const [branchUnavailableModal, setBranchUnavailableModal] = useState<{
    visible: boolean;
    branchName: string;
    itemNames: string[];
  } | null>(null);

  const closeBranchUnavailableModal = () => setBranchUnavailableModal(null);

  const setBranchId = (branchId: string) => {
    const norm = normalizeBranchId(branchId);
    setCurrentBranchId(norm);
    setHasSelectedBranch(true);
    AsyncStorage.setItem('@foodies_customer_selected_branch', norm).catch(() => { });

    // Recalculate all cart item prices to this newly selected branch's actual pricing
    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart;
      return prevCart.map((cartItem) => {
        const dish = menuItems.find(
          (m) => m.id === cartItem.menuItemId || m.name.toLowerCase() === cartItem.name.toLowerCase()
        );
        if (!dish) return cartItem;
        let newUnitPrice = Number(dish.branchPriceOverrides?.[norm] ?? dish.basePrice) || 0;
        if (cartItem.size && dish.sizes) {
          const matchSize = dish.sizes.find((s) => s.name === cartItem.size);
          if (matchSize) newUnitPrice += Number(matchSize.priceDelta) || 0;
        }
        if (cartItem.extras && dish.extras) {
          cartItem.extras.forEach((ext) => {
            const matchExtra = dish.extras?.find((e) => e.name === ext);
            if (matchExtra) newUnitPrice += Number(matchExtra.price) || 0;
          });
        }
        return { ...cartItem, unitPrice: newUnitPrice };
      });
    });

    const targetBranch = branches.find((b) => b.id === norm);
    const targetBranchName = targetBranch ? targetBranch.name : norm;

    // Check if any items currently in cart are unavailable at this newly selected branch
    if (cart.length > 0) {
      const unavailableInCart = cart.filter((cartItem) => {
        const dish = menuItems.find(
          (m) => m.id === cartItem.menuItemId || m.name.toLowerCase() === cartItem.name.toLowerCase()
        );
        if (!dish) return false;
        const isAvailAtBranch = dish.branchAvailability?.[norm] !== false && dish.isAvailable !== false;
        return !isAvailAtBranch;
      });

      if (unavailableInCart.length > 0) {
        const names = Array.from(new Set(unavailableInCart.map((i) => i.name)));
        setBranchUnavailableModal({
          visible: true,
          branchName: targetBranchName,
          itemNames: names,
        });
      }
    }
  };

  const currentBranch = useMemo(
    () => branches.find((b) => b.id === currentBranchId || normalizeBranchId(b.id) === normalizeBranchId(currentBranchId)) || branches[0],
    [branches, currentBranchId]
  );

  const categories = useMemo(() => {
    const list: string[] = [
      'Biryani & Rice',
      'Karahi & Handi',
      'BBQ & Kebabs',
      'Burgers & Fast Food',
      'Tandoor & Breads',
      'Beverages & Desserts',
    ];
    menuItems.forEach((m) => {
      if (m.category && m.category.trim() && !list.includes(m.category.trim())) {
        list.push(m.category.trim());
      }
    });
    customCategories.forEach((c) => {
      if (c && c.trim() && !list.includes(c.trim())) {
        list.push(c.trim());
      }
    });
    return list;
  }, [menuItems, customCategories]);

  const addCategory = (categoryName: string) => {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    setCustomCategories((prev) => {
      const next = prev.includes(trimmed) ? prev : [...prev, trimmed];
      AsyncStorage.setItem('@foodies_categories_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    apiFetch('/api/marketing', {
      method: 'PATCH',
      body: JSON.stringify({ type: 'category', action: 'add', name: trimmed }),
    }).catch(() => { });
  };

  const renameCategory = (oldCat: string, newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed || trimmed === oldCat) return;
    setCustomCategories((prev) => {
      const next = prev.map((c) => (c === oldCat ? trimmed : c));
      AsyncStorage.setItem('@foodies_categories_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    setMenuItems((prev) => {
      const next = prev.map((m) => (m.category === oldCat ? { ...m, category: trimmed } : m));
      AsyncStorage.setItem('@foodies_menu_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    apiFetch('/api/marketing', {
      method: 'PATCH',
      body: JSON.stringify({ type: 'category', action: 'rename', oldName: oldCat, newName: trimmed }),
    }).catch(() => { });
    showToast(`Category renamed to "${trimmed}"`, 'success');
  };

  const deleteCategory = (categoryName: string) => {
    setCustomCategories((prev) => {
      const next = prev.filter((c) => c !== categoryName);
      AsyncStorage.setItem('@foodies_categories_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    apiFetch('/api/marketing', {
      method: 'PATCH',
      body: JSON.stringify({ type: 'category', action: 'delete', name: categoryName }),
    }).catch(() => { });
    showToast(`Category "${categoryName}" removed`, 'info');
  };

  const importSheetCatalog = async (payload: {
    categories: string[];
    menuItems: { action: 'create' | 'update'; item: MenuItem }[];
    dealsAndBanners?: any[];
  }): Promise<boolean> => {
    try {
      if (payload.categories.length > 0) {
        setCustomCategories((prev) => {
          const next = new Set(prev);
          payload.categories.forEach((c) => {
            if (c && c.trim()) next.add(c.trim());
          });
          return Array.from(next);
        });
      }

      if (payload.menuItems.length > 0) {
        setMenuItems((prev) => {
          const map = new Map<string, MenuItem>();
          prev.forEach((m) => map.set(m.id, m));
          payload.menuItems.forEach(({ item }) => {
            const byName = Array.from(map.values()).find(
              (existing) => existing.name.toLowerCase().trim() === item.name.toLowerCase().trim()
            );
            if (byName) {
              map.set(byName.id, { ...byName, ...item, id: byName.id });
            } else {
              map.set(item.id, item);
            }
          });
          return Array.from(map.values());
        });
      }

      if (payload.dealsAndBanners && payload.dealsAndBanners.length > 0) {
        const newAnnouncements: Announcement[] = payload.dealsAndBanners.map((d: any, idx: number) => ({
          id: `ann-sheet-${Date.now()}-${idx}`,
          title: d.title,
          tag: d.badgeOrTag || 'SPECIAL OFFER',
          description: d.subtitle || '',
          validUntil: 'Active Offer',
          badgeColor: '#EF4444',
        }));
        setAnnouncements((prev) => [...newAnnouncements, ...prev]);
      }

      await apiFetch('/api/sheets/import', {
        method: 'POST',
        body: JSON.stringify({
          action: 'commit_import',
          categories: payload.categories,
          menuItems: payload.menuItems.map((m) => m.item),
          dealsAndBanners: payload.dealsAndBanners || [],
        }),
      });

      showToast(
        `Sheet imported: ${payload.menuItems.length} dishes across ${payload.categories.length || 1} categories!`,
        'success'
      );
      return true;
    } catch {
      showToast('Imported locally (sync pending)', 'info');
      return true;
    }
  };

  const showToast = (message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 3200);
  };

  const notifUserKey = useMemo(() => {
    if (appMode === 'customer' || role === 'customer') {
      return customerUser?.id || customerUser?.phone || 'customer-guest';
    }
    return currentUser?.id || `staff-${role}`;
  }, [appMode, role, customerUser?.id, customerUser?.phone, currentUser?.id]);

  const activeReceiverKey = useMemo(() => {
    const activeRole: MobileRole = appMode === 'customer' ? 'customer' : role;
    if (activeRole === 'customer') {
      if (customerUser?.id && customerUser.id !== 'user-guest' && customerUser.id !== 'cust-guest') {
        return `user:${customerUser.id}`;
      }
      if (customerUser?.phone) {
        return `cust:${customerUser.phone.replace(/\D/g, '').slice(-10)}`;
      }
      return 'role:customer';
    }
    if (currentUser?.id && currentUser.id !== 'user-guest') {
      return `user:${currentUser.id}`;
    }
    return `role:${activeRole}`;
  }, [appMode, role, customerUser?.id, customerUser?.phone, currentUser?.id]);

  const myNotificationSettings = useMemo<ReceiverNotificationPreferences>(() => {
    const activeRole: MobileRole = appMode === 'customer' ? 'customer' : role;
    const saved =
      receiverNotificationSettingsMap[activeReceiverKey] ||
      receiverNotificationSettingsMap[`role:${activeRole}`];
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
  }, [appMode, role, activeReceiverKey, receiverNotificationSettingsMap]);

  const inferMobileNotificationEventKey = useCallback(
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

  // Calculate only the orders that legitimately belong to THIS customer
  const myCustomerOrdersSet = useMemo(() => {
    const s = new Set<string>(myPlacedOrderIds);
    if (appMode === 'customer') {
      const myId = customerUser?.id && customerUser.id !== 'user-guest' && customerUser.id !== 'cust-guest' ? customerUser.id : null;
      const myPhone = customerUser?.phone ? customerUser.phone.replace(/\D/g, '').slice(-10) : null;
      const myEmail = customerUser?.email ? customerUser.email.toLowerCase().trim() : null;

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
  }, [orders, appMode, customerUser?.id, customerUser?.phone, customerUser?.email, myPlacedOrderIds]);

  const notifications = useMemo(() => {
    const activeRole: MobileRole = appMode === 'customer' ? 'customer' : role;
    const normCurBranch = normalizeBranchId(currentBranchId);
    const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
    const myPhone = normalizePhone(customerUser?.phone);
    const myCustomerId = customerUser?.id && customerUser.id !== 'user-guest' && customerUser.id !== 'cust-guest' ? customerUser.id : null;

    return allNotifications
      .filter((n) => {
        const targetRoles = Array.isArray(n.targetRoles) && n.targetRoles.length > 0 ? n.targetRoles : ['all'];
        const isSender = Boolean(n.senderId && currentUser?.id && n.senderId === currentUser.id);

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
        const evKey = inferMobileNotificationEventKey(n);
        if (evKey && myNotificationSettings.events?.[evKey] === false) {
          return false;
        }

        // Platform targeting: Mobile App hides Web-only notifications unless sender or platform_owner
        if (n.targetPlatform === 'web' && activeRole !== 'platform_owner' && !isSender) {
          return false;
        }

        // -------------------------------------------------------------
        // A. CUSTOMER MODE
        // -------------------------------------------------------------
        if (activeRole === 'customer') {
          // 1. Order-specific notification: MUST belong to this customer and include customer/all!
          if (n.orderId || n.orderNumber) {
            if (!targetRoles.includes('all') && !targetRoles.includes('customer')) {
              return false;
            }
            const idMatch = Boolean(n.targetUserId && myCustomerId && n.targetUserId === myCustomerId);
            const phoneMatch = Boolean(n.targetCustomerPhone && myPhone && normalizePhone(n.targetCustomerPhone) === myPhone);
            const orderMatch = Boolean(
              (n.orderId && myCustomerOrdersSet.has(n.orderId)) ||
              (n.orderNumber && myCustomerOrdersSet.has(String(n.orderNumber)))
            );
            return idMatch || phoneMatch || orderMatch;
          }

          // 2. Direct personal notification to a single person (not an order):
          if (n.targetUserId || n.targetCustomerPhone) {
            const idMatch = Boolean(n.targetUserId && myCustomerId && n.targetUserId === myCustomerId);
            const phoneMatch = Boolean(n.targetCustomerPhone && myPhone && normalizePhone(n.targetCustomerPhone) === myPhone);
            return idMatch || phoneMatch;
          }

          // 3. General broadcast notification for customers / all:
          const roleMatches = targetRoles.includes('all') || targetRoles.includes('customer');
          if (!roleMatches) return false;

          const branchMatches = !n.branchId || n.branchId === 'all' || normalizeBranchId(n.branchId) === normCurBranch;
          return branchMatches;
        }

        // -------------------------------------------------------------
        // B. STAFF MODE
        // -------------------------------------------------------------
        // Owner oversees platform and branch operations
        if (activeRole === 'platform_owner') {
          if (n.targetUserId && currentUser?.id && n.targetUserId !== currentUser.id && n.senderId !== currentUser.id && !targetRoles.includes('platform_owner') && !targetRoles.includes('all')) {
            return false;
          }
          return true;
        }

        // Branch match for staff
        const branchMatches = !n.branchId || n.branchId === 'all' || normalizeBranchId(n.branchId) === normCurBranch;
        if (!branchMatches) return false;

        // Did I send it or was it specifically targeted to me (user, concerned rider, or concerned waiter)?
        if (isSender) return true;
        if (n.targetUserId && currentUser?.id && n.targetUserId === currentUser.id) return true;
        if (n.targetRiderId && currentUser?.id && n.targetRiderId === currentUser.id) return true;
        if (n.targetWaiterId && currentUser?.id && n.targetWaiterId === currentUser.id) return true;

        // If targeted to a specific other user (without an orderId), it's private to them
        if (n.targetUserId && (!currentUser?.id || n.targetUserId !== currentUser.id) && !n.orderId) {
          return false;
        }

        // Check if role matches
        const roleMatches = targetRoles.includes('all') || targetRoles.includes(activeRole);
        if (!roleMatches) return false;

        // If customer-only notification:
        if (targetRoles.length === 1 && targetRoles[0] === 'customer') {
          return false;
        }

        // Rider filter: if notification is for rider assignment or assigned to a specific rider, ONLY that rider receives it
        if (activeRole === 'delivery_staff') {
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
          if (n.category === 'dine_in' && !n.targetRiderId) return false;
          if (evKey === 'waiterAssigned' || evKey === 'orderServed') return false;
        }

        // Waiter filter: if notification or dine-in order is assigned to another specific waiter, do not show to this waiter
        if (activeRole === 'floor_staff') {
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
          if (n.category === 'delivery' && !n.targetWaiterId) return false;
          if (evKey === 'riderAssigned' || evKey === 'outForDelivery') return false;
        }

        // Kitchen filter: kitchen chefs strictly receive notifications for new orders placed/sent to kitchen, cooking rush, and order cancellations
        if (activeRole === 'kitchen_staff') {
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
          const isDirectKitchenRole = targetRoles.includes('kitchen_staff');
          if (!isKitchenCategory && !isKitchenEvent && !isDirectKitchenRole) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0));
  }, [allNotifications, appMode, role, currentBranchId, currentUser?.id, customerUser?.id, customerUser?.phone, myCustomerOrdersSet, orders, myNotificationSettings, inferMobileNotificationEventKey]);

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => {
      const readList = Array.isArray(n.readBy) ? n.readBy : [];
      if (readList.includes(notifUserKey)) return false;
      if (currentUser?.id && readList.includes(currentUser.id)) return false;
      if (customerUser?.phone && readList.includes(customerUser.phone)) return false;
      return true;
    }).length;
  }, [notifications, notifUserKey, currentUser?.id, customerUser?.phone]);

  useEffect(() => {
    if (isFirstNotifLoadRef.current) {
      notifications.forEach((n) => seenNotifIdsRef.current.add(n.id));
      isFirstNotifLoadRef.current = false;
      return;
    }

    const now = Date.now();
    const unseen = notifications.filter((n) => !seenNotifIdsRef.current.has(n.id));
    if (unseen.length === 0) return;

    unseen.forEach((n) => {
      seenNotifIdsRef.current.add(n.id);
      const ageMs = now - (new Date(n.createdAt).getTime() || 0);
      if (
        myNotificationSettings.receiveNotifications !== false &&
        myNotificationSettings.showLiveToast !== false &&
        ageMs <= 180000 &&
        (!n.senderId || n.senderId !== currentUser?.id)
      ) {
        presentNativeNotification(n, unreadNotificationsCount);
      }
    });

    const latest = unseen[0];
    const ageMs = now - (new Date(latest.createdAt).getTime() || 0);
    if (
      myNotificationSettings.receiveNotifications !== false &&
      myNotificationSettings.showLiveToast !== false &&
      ageMs <= 120000 &&
      (!latest.senderId || latest.senderId !== currentUser?.id)
    ) {
      const toastType = latest.type === 'error' ? 'danger' : (latest.type || 'info');
      showToast(`${latest.title}: ${latest.message}`, toastType);
    }
  }, [notifications, currentUser?.id, unreadNotificationsCount, myNotificationSettings.receiveNotifications, myNotificationSettings.showLiveToast]);

  const openNotificationModal = useCallback(
    (tab: 'inbox' | 'send' | 'settings' = 'inbox', order?: Order | null) => {
      setNotificationModalDefaultTab(tab);
      setPrefillNotificationOrder(order || null);
      setIsNotificationModalOpen(true);
    },
    []
  );

  const updateNotificationSettings = useCallback(
    async (updates: Partial<NotificationSettings>): Promise<boolean> => {
      const allowedRoles: MobileRole[] = ['platform_owner', 'branch_manager', 'cashier'];
      if (!allowedRoles.includes(role)) {
        showToast('Only Platform Owner, Branch Manager, or Cashier can manage notification rules.', 'danger');
        return false;
      }

      const merged = mergeNotificationSettings(notificationSettings, {
        ...updates,
        updatedBy: currentUser?.name || role,
        updatedByRole: role,
        updatedAt: new Date().toISOString(),
      });

      setNotificationSettings(merged);
      AsyncStorage.setItem('@foodies_notification_settings', JSON.stringify(merged)).catch(() => { });

      try {
        const authToken = await getSecureAuthToken();
        const res = await updateNotificationSettingsOnServer(merged, currentUser?.name || role, authToken || undefined);
        if (!res.ok) {
          showToast(res.error || 'Could not sync notification rules to server.', 'danger');
          return false;
        }
        if (res.data?.notificationSettings) {
          setNotificationSettings(res.data.notificationSettings);
          AsyncStorage.setItem('@foodies_notification_settings', JSON.stringify(res.data.notificationSettings)).catch(() => { });
        }
        showToast('Notification rules saved permanently ✓', 'success');
        return true;
      } catch {
        showToast('Saved locally; server sync will retry automatically.', 'warning');
        return false;
      }
    },
    [currentUser?.name, notificationSettings, role]
  );

  const updateMyNotificationSettings = useCallback(
    async (
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
        AsyncStorage.setItem(
          '@foodies_receiver_notif_settings_map',
          JSON.stringify(nextMap)
        ).catch(() => { });
        return nextMap;
      });

      try {
        const authToken = await getSecureAuthToken();
        const res = await updateReceiverNotificationSettingsOnServer(targetKey, nextPrefs, authToken || undefined);
        if (res.data?.receiverSettingsMap) {
          setReceiverNotificationSettingsMap(res.data.receiverSettingsMap);
          AsyncStorage.setItem(
            '@foodies_receiver_notif_settings_map',
            JSON.stringify(res.data.receiverSettingsMap)
          ).catch(() => { });
        }
        showToast('Your notification rules updated (only affects this receiver) ✓', 'success');
        return true;
      } catch {
        showToast('Your receiver rules saved locally ✓', 'info');
        return true;
      }
    },
    [activeReceiverKey, receiverNotificationSettingsMap]
  );

  const pushOptimisticNotification = useCallback(
    (notif: AppNotification) => {
      seenNotifIdsRef.current.add(notif.id);
      setAllNotifications((prev) => [notif, ...prev.filter((item) => item.id !== notif.id)].slice(0, 120));
      presentNativeNotification(notif, 1);
    },
    []
  );

  const pushOrderNotification = useCallback(
    (
      ord: Order,
      opts: {
        id: string;
        title: string;
        message: string;
        type?: 'info' | 'success' | 'warning' | 'error';
        targetRoles: Array<MobileRole | 'all'>;
        targetUserId?: string;
        targetWaiterId?: string;
        targetWaiterName?: string;
        targetRiderId?: string;
        targetRiderName?: string;
        eventKey?: NotificationEventKey;
        senderRole?: MobileRole | 'system';
        senderName?: string;
      }
    ) => {
      if (opts.eventKey && notificationSettings.events[opts.eventKey] === false) {
        return;
      }
      const cat: NotificationCategory =
        ord.type === 'takeaway' ? 'takeaway' : ord.type === 'dine_in' ? 'dine_in' : 'delivery';
      pushOptimisticNotification({
        id: opts.id,
        title: opts.title,
        message: opts.message,
        type: opts.type || 'info',
        category: cat,
        branchId: ord.branchId,
        orderId: ord.id,
        orderNumber: ord.orderNumber,
        orderType: ord.type,
        senderId: opts.senderRole === 'system' ? undefined : currentUser?.id,
        senderName: opts.senderName || currentUser?.name || 'Staff',
        senderRole: opts.senderRole || role,
        targetRoles: opts.eventKey ? buildMobileOrderNotificationRoles(ord.type, notificationSettings) : opts.targetRoles,
        targetPlatform: notificationSettings.defaultPlatform || 'all',
        targetUserId: opts.targetUserId ?? ord.customerId,
        targetCustomerPhone: ord.customerPhone,
        targetCustomerName: ord.customerName,
        targetWaiterId: opts.targetWaiterId ?? ord.assignedWaiterId,
        targetWaiterName: opts.targetWaiterName ?? ord.assignedWaiterName,
        targetRiderId: opts.targetRiderId ?? ord.assignedRiderId,
        targetRiderName: opts.targetRiderName ?? ord.assignedRiderName,
        eventKey: opts.eventKey,
        readBy: opts.senderRole === 'system' ? [] : (currentUser?.id ? [currentUser.id] : []),
        createdAt: new Date().toISOString(),
      });
    },
    [currentUser?.id, currentUser?.name, notificationSettings, pushOptimisticNotification, role]
  );

  const sendNotification = useCallback(
    async (payload: {
      id?: string;
      title: string;
      message: string;
      type?: 'info' | 'success' | 'warning' | 'error';
      category?: NotificationCategory;
      branchId?: string;
      orderId?: string;
      orderNumber?: string;
      orderType?: OrderType;
      targetRoles: Array<MobileRole | 'all'>;
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
      const canSendNotification =
        appMode === 'staff' &&
        (role === 'platform_owner' || role === 'branch_manager' || role === 'cashier');
      if (!canSendNotification) {
        showToast('Only Cashier/Manager (for this branch) or Owner can send notifications.', 'danger');
        return null;
      }

      const effectiveBranchId =
        role === 'platform_owner' ? payload.branchId || 'all' : currentBranchId;

      const notif: AppNotification = {
        id: payload.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: payload.title.trim(),
        message: payload.message.trim(),
        type: payload.type || 'info',
        category: payload.category || 'staff_alert',
        branchId: effectiveBranchId,
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        orderType: payload.orderType,
        senderId: currentUser?.id,
        senderName: currentUser?.name || 'Staff',
        senderRole: role,
        targetRoles: payload.targetRoles.length > 0 ? payload.targetRoles : ['all'],
        targetPlatform: payload.targetPlatform || 'all',
        targetUserId: payload.targetUserId,
        targetCustomerPhone: payload.targetCustomerPhone,
        targetCustomerName: payload.targetCustomerName,
        targetWaiterId: payload.targetWaiterId,
        targetWaiterName: payload.targetWaiterName,
        targetRiderId: payload.targetRiderId,
        targetRiderName: payload.targetRiderName,
        readBy: currentUser?.id ? [currentUser.id] : [notifUserKey],
        createdAt: new Date().toISOString(),
      };

      pushOptimisticNotification(notif);
      if (!payload.silentToast) {
        showToast('Notification sent to concerned users ✓', 'success');
      }

      try {
        const res = await postNotificationToServer(notif);
        if (res.ok && res.data?.notification) {
          seenNotifIdsRef.current.add(res.data.notification.id);
          setAllNotifications((prev) => [
            res.data!.notification!,
            ...prev.filter((item) => item.id !== res.data!.notification!.id && item.id !== notif.id),
          ].slice(0, 120));
          return res.data.notification;
        }
      } catch { }

      return notif;
    },
    [appMode, currentBranchId, currentUser?.id, currentUser?.name, notifUserKey, pushOptimisticNotification, role]
  );

  const markNotificationRead = useCallback(
    (id: string) => {
      dismissNativeNotification(id);
      setAllNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== id) return n;
          const existing = Array.isArray(n.readBy) ? n.readBy : [];
          if (existing.includes(notifUserKey)) return n;
          return { ...n, readBy: [...existing, notifUserKey] };
        })
      );
      patchNotificationReadOnServer({ id, userKey: notifUserKey }).catch(() => { });
    },
    [notifUserKey]
  );

  const markAllNotificationsRead = useCallback(() => {
    dismissAllNativeNotifications();
    const visibleIds = new Set(notifications.map((n) => n.id));
    setAllNotifications((prev) =>
      prev.map((n) => {
        if (!visibleIds.has(n.id)) return n;
        const existing = Array.isArray(n.readBy) ? n.readBy : [];
        if (existing.includes(notifUserKey)) return n;
        return { ...n, readBy: [...existing, notifUserKey] };
      })
    );
    patchNotificationReadOnServer({ markAll: true, userKey: notifUserKey }).catch(() => { });
  }, [notifications, notifUserKey]);

  const clearNotifications = useCallback(() => {
    dismissAllNativeNotifications();
    const visibleIds = new Set(notifications.map((n) => n.id));
    setAllNotifications((prev) => prev.filter((n) => !visibleIds.has(n.id)));
    deleteNotificationsOnServer({
      clearAll: true,
      branchId: role === 'platform_owner' || appMode === 'customer' ? 'all' : currentBranchId,
    }).catch(() => { });
  }, [appMode, currentBranchId, notifications, role]);

  const markNotificationReadRef = useRef(markNotificationRead);
  markNotificationReadRef.current = markNotificationRead;
  const openNotificationModalRef = useRef(openNotificationModal);
  openNotificationModalRef.current = openNotificationModal;

  // When user taps a notification in the device's native notification bar:
  // mark it as read and open the Notification Center
  useEffect(() => {
    const unsubscribe = addNotificationResponseListener((notifId) => {
      if (notifId) {
        markNotificationReadRef.current(String(notifId));
      }
      openNotificationModalRef.current('inbox');
    });
    return unsubscribe;
  }, []);

  // Cart operations
  const addToCart = (
    item: MenuItem,
    size?: string,
    extras?: string[],
    instructions?: string,
    startCoords?: { startX: number; startY: number }
  ) => {
    const dish = menuItems.find((m) => m.id === item.id) || item;
    if (hasSelectedBranch) {
      const isAvailAtBranch = dish.branchAvailability?.[currentBranchId] !== false && dish.isAvailable !== false;
      if (!isAvailAtBranch) {
        setBranchUnavailableModal({
          visible: true,
          branchName: currentBranch.name,
          itemNames: [item.name],
        });
        return;
      }
    }

    const cartItemId = `${item.id}-${size || 'std'}-${(extras || []).sort().join('-')}`;
    let unitPrice = hasSelectedBranch
      ? (dish.branchPriceOverrides?.[currentBranchId] ?? dish.basePrice)
      : getItemMinPrice(dish);

    const sizesList = dish.sizes || item.sizes;
    if (size && sizesList) {
      const matchSize = sizesList.find((s) => s.name === size);
      if (matchSize) unitPrice += matchSize.priceDelta;
    }
    const extrasList = dish.extras || item.extras;
    if (extras && extrasList) {
      extras.forEach((ext) => {
        const matchExtra = extrasList.find((e) => e.name === ext);
        if (matchExtra) unitPrice += matchExtra.price;
      });
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.id === cartItemId);
      if (existing) {
        return prev.map((i) =>
          i.id === cartItemId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      const newItem: CartItem = {
        id: cartItemId,
        menuItemId: item.id,
        name: item.name,
        unitPrice,
        quantity: 1,
        size,
        extras,
        instructions,
      };
      return [...prev, newItem];
    });

    if (startCoords) {
      triggerFlyToCart(startCoords, item.image);
    }
  };

  const updateCartQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.id === itemId) {
            const newQty = it.quantity + delta;
            return newQty > 0 ? { ...it, quantity: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((it) => it.id !== itemId));
  };

  const clearCart = () => setCart([]);

  const cartCount = useMemo(() => cart.reduce((c, i) => c + i.quantity, 0), [cart]);
  const cartSubtotal = useMemo(() => cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0), [cart]);

  // =========================================================================
  // REAL-TIME POSTGRESQL & NEXT.JS WEB BACKEND ORDERS INTEGRATION
  // =========================================================================
  const placeOrder = (orderData: Partial<Order>): Order => {
    const normBranchId = normalizeBranchId(orderData.branchId || currentBranchId);
    const id = `ord-${Date.now()}`;
    const orderNumber = `FC-${Math.floor(1000 + Math.random() * 9000)}`;

    const sourceItems = orderData.items && orderData.items.length > 0 ? orderData.items : cart;
    const validatedItems: CartItem[] = sourceItems.map((it, idx) => ({
      id: it.id || `item-${Date.now()}-${idx}`,
      menuItemId: it.menuItemId || it.id || `m-${idx + 1}`,
      name: it.name || 'Foodies Special Dish',
      unitPrice: Number(it.unitPrice) || 0,
      quantity: Number(it.quantity) || 1,
      size: it.size || undefined,
      extras: Array.isArray(it.extras) ? it.extras : [],
      instructions: it.instructions || undefined,
    }));

    const subtotal = orderData.originalSubtotal !== undefined
      ? Number(orderData.originalSubtotal)
      : cartSubtotal;
    const tax = Math.round(subtotal * 0.16 * 10) / 10;
    const total = Math.round((subtotal + tax) * 10) / 10;

    const rawMethod = orderData.paymentMethod || 'Cash on Delivery (COD)';
    const isDigitalPrepaid = /jazzcash|easypaisa|card|bank|online|raast|stripe|wallet/i.test(rawMethod);
    const safePaymentStatus: 'paid' | 'unpaid' =
      orderData.paymentStatus === 'paid' || (orderData.paymentStatus !== 'unpaid' && isDigitalPrepaid)
        ? 'paid'
        : 'unpaid';
    const isPaymentCollected =
      (orderData as any).paymentCollected !== undefined
        ? Boolean((orderData as any).paymentCollected)
        : safePaymentStatus === 'paid';

    const isOrderWalkIn = Boolean((orderData as any).isWalkIn);
    const isOrderTableQr = (orderData as any).isTableQr !== undefined
      ? Boolean((orderData as any).isTableQr)
      : (orderData.type === 'dine_in' && Boolean(orderData.tableNumber) && !isOrderWalkIn);

    const matchingTable = (orderData.type === 'dine_in' || (!orderData.type && orderData.tableNumber)) && orderData.tableNumber
      ? tables.find(
          (t) =>
            (!t.branchId || normalizeBranchId(t.branchId) === normBranchId) &&
            (t.number.toLowerCase() === String(orderData.tableNumber).toLowerCase() ||
             t.id === orderData.tableNumber ||
             t.number.replace(/\D/g, '') === String(orderData.tableNumber).replace(/\D/g, ''))
        )
      : undefined;

    const autoWaiterId =
      orderData.assignedWaiterId ||
      matchingTable?.assignedWaiterId ||
      (role === 'floor_staff' ? staffUser?.id : undefined);
    const autoWaiterName =
      orderData.assignedWaiterName ||
      matchingTable?.assignedWaiterName ||
      (role === 'floor_staff' ? staffUser?.name : undefined);

    const newOrder: Order = {
      id,
      orderNumber,
      branchId: normBranchId,
      customerId: orderData.customerId || (currentUser.id && currentUser.id !== 'user-guest' ? currentUser.id : 'cust-guest'),
      customerName: orderData.customerName || currentUser.name || 'Guest Customer',
      customerPhone: orderData.customerPhone || currentUser.phone || '03001234567',
      customerEmail: orderData.customerEmail || currentUser.email || undefined,
      type: orderData.type || 'dine_in',
      tableNumber: orderData.tableNumber || undefined,
      tablePin: orderData.type === 'dine_in' ? (orderData.tablePin || String(Math.floor(1000 + Math.random() * 9000))) : undefined,
      status: 'placed',
      paymentStatus: safePaymentStatus,
      paymentCollected: isPaymentCollected,
      paymentMethod: rawMethod,
      items: validatedItems,
      originalSubtotal: subtotal,
      addOnSubtotal: 0,
      tax,
      total,
      createdAt: new Date().toISOString(),
      deliveryAddress: orderData.deliveryAddress || undefined,
      customerCoordinates: orderData.type === 'delivery' ? (orderData.customerCoordinates || customerCoordinates) : undefined,
      notes: orderData.notes || undefined,
      sentToKitchen: true,
      sentToKitchenAt: new Date().toISOString(),
      isWalkIn: isOrderWalkIn,
      isTableQr: isOrderTableQr,
      assignedWaiterId: autoWaiterId,
      assignedWaiterName: autoWaiterName,
      version: 1,
    };

    // 1. Optimistic local mobile state update & permanent storage
    setOrders((prev) => {
      const next = [newOrder, ...prev.filter((o) => o.id !== newOrder.id)];
      AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });

    setMyPlacedOrderIds((prev) => {
      const next = new Set(prev);
      if (newOrder.id) next.add(newOrder.id);
      if (newOrder.orderNumber) next.add(String(newOrder.orderNumber));
      AsyncStorage.setItem('@foodies_customer_order_ids', JSON.stringify(Array.from(next))).catch(() => { });
      return next;
    });

    // Immediately mark table as occupied in mobile state and database if Dine-In
    if (newOrder.type === 'dine_in' && newOrder.tableNumber) {
      setTables((prev) => {
        const updated = prev.map((t) => {
          const matchBranch = normalizeBranchId(t.branchId) === normBranchId;
          const matchTable = String(t.number) === String(newOrder.tableNumber) || String(t.id) === String(newOrder.tableNumber);
          if (matchBranch && matchTable) {
            return {
              ...t,
              status: 'occupied' as TableStatus,
              currentOrderId: newOrder.id,
              activeSessionStart: new Date().toISOString(),
            };
          }
          return t;
        });
        AsyncStorage.setItem('@foodies_tables_store', JSON.stringify(updated)).catch(() => { });
        return updated;
      });

      apiFetch('/api/tables', {
        method: 'PATCH',
        body: JSON.stringify({
          tableNumber: newOrder.tableNumber,
          branchId: normBranchId,
          status: 'occupied',
          currentOrderId: newOrder.id,
        }),
      }).catch(() => { });
    }

    clearCart();
    setOrderType(null);
    setHasConfirmedOrderType(false);
    setHasSelectedBranch(false);
    AsyncStorage.removeItem('@foodies_customer_selected_branch').catch(() => { });
    showToast(`Order #${newOrder.orderNumber} placed successfully!`, 'success');

    const typeLabel =
      newOrder.type === 'takeaway'
        ? 'Takeaway'
        : newOrder.type === 'dine_in'
          ? 'Dine-In'
          : 'Delivery';
    const orderCat: NotificationCategory =
      newOrder.type === 'takeaway'
        ? 'takeaway'
        : newOrder.type === 'dine_in'
          ? 'dine_in'
          : 'delivery';

    if (notificationSettings.events.orderPlaced !== false) {
      pushOptimisticNotification({
        id: `notif-placed-${newOrder.id}`,
        title: `Order Confirmed • ${typeLabel} #${newOrder.orderNumber}`,
        message:
          newOrder.type === 'takeaway'
            ? `Your Takeaway order #${newOrder.orderNumber} is confirmed (Rs. ${newOrder.total}). Preparing for counter pickup!`
            : newOrder.type === 'dine_in'
              ? `Your Dine-In order #${newOrder.orderNumber}${newOrder.tableNumber ? ` (Table ${newOrder.tableNumber})` : ''} is confirmed (Rs. ${newOrder.total}). Kitchen preparing now!`
              : `Your Delivery order #${newOrder.orderNumber} is confirmed (Rs. ${newOrder.total}). Kitchen preparing for delivery dispatch!`,
        type: 'success',
        category: orderCat,
        branchId: normBranchId,
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        orderType: newOrder.type,
        senderName: newOrder.customerName || 'Foodies Cafe',
        senderRole: 'system',
        targetRoles: buildMobileOrderNotificationRoles(newOrder.type, notificationSettings),
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
      });
    }

    // 2. Transmit to Web Backend (PostgreSQL + Server-Sent Events)
    const idempotencyKey = `idem-${newOrder.id}-${newOrder.orderNumber}`;
    const postPayload = {
      id: newOrder.id,
      orderNumber: newOrder.orderNumber,
      idempotencyKey,
      branchId: normBranchId,
      customerId: newOrder.customerId,
      customerName: newOrder.customerName,
      customerPhone: newOrder.customerPhone,
      customerEmail: newOrder.customerEmail || null,
      type: newOrder.type,
      tableNumber: newOrder.tableNumber || null,
      tablePin: newOrder.tablePin || null,
      status: 'placed',
      paymentStatus: safePaymentStatus,
      paymentCollected: isPaymentCollected,
      paymentMethod: newOrder.paymentMethod,
      items: validatedItems,
      originalSubtotal: newOrder.originalSubtotal,
      addOnSubtotal: 0,
      tax: newOrder.tax,
      total: newOrder.total,
      createdAt: newOrder.createdAt,
      notes: newOrder.notes || null,
      deliveryAddress: newOrder.deliveryAddress || null,
      customerCoordinates: newOrder.customerCoordinates || null,
      sentToKitchen: true, // Immediate kitchen queue visibility across web and mobile
      isTableQr: isOrderTableQr,
      isWalkIn: isOrderWalkIn,
      version: 1,
    };

    apiFetch('/api/orders', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(postPayload),
    }).then((res) => {
      if (res.ok) {
        console.log(`[Sync Success] Order #${newOrder.orderNumber} dispatched to Web Backend & PostgreSQL.`);
      } else {
        console.warn(`[Sync Error] Web Backend rejected order:`, res.error);
      }
    }).catch((err) => {
      console.warn(`[Sync Error] Order transmission error:`, err.message);
    });

    return newOrder;
  };

  const cancelOrder = (orderId: string, reason?: string): boolean => {
    const target = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (!target) return false;

    if (target.type === 'delivery' && (Boolean(target.assignedRiderId) || target.status === 'out_for_delivery')) {
      showToast('A delivery rider is already assigned to this order. Cancellation is locked.', 'danger');
      return false;
    }

    const isCustomer = role === 'customer' || appMode === 'customer';
    if (isCustomer) {
      if (target.status !== 'placed' || target.sentToKitchen) {
        showToast('Order cannot be cancelled once Customer Support has accepted it.', 'danger');
        return false;
      }
    }

    if (target.status === 'ready' || target.status === 'out_for_delivery' || target.status === 'completed' || target.status === 'served' || target.status === 'delivered') {
      showToast('Cannot cancel order once food is ready or out for delivery.', 'danger');
      return false;
    }

    const cancelActor: 'customer' | 'staff' | 'branch_offline' =
      (reason && (reason.toLowerCase().includes('branch') || reason.toLowerCase().includes('shutdown') || reason.toLowerCase().includes('offline')))
        ? 'branch_offline'
        : (reason && (reason.toLowerCase().includes('customer') || reason.toLowerCase().includes('user') || reason.toLowerCase().includes('deselected')))
          ? 'customer'
          : isCustomer
            ? 'customer'
            : 'staff';
    const defaultReason = cancelActor === 'customer'
      ? 'Cancelled by customer'
      : (cancelActor === 'branch_offline' ? 'Cancelled due to branch shutdown offline by manager' : 'Cancelled by Staff');
    const cancelNotes = reason || defaultReason;

    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? {
            ...o,
            status: 'cancelled' as OrderStatus,
            notes: cancelNotes,
            cancellationReason: cancelNotes,
            cancelledBy: cancelActor,
          }
          : o
      );
      AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });

    if (target.tableNumber) {
      setTables((prev) =>
        prev.map((t) =>
          t.number === target.tableNumber
            ? { ...t, status: 'available', currentOrderId: undefined }
            : t
        )
      );
    }

    showToast(`Order #${target.orderNumber} has been cancelled.`, 'info');
    pushOrderNotification(target, {
      id: `notif-cancel-${target.id}-${Date.now()}`,
      title: `Order #${target.orderNumber} Cancelled`,
      message: `Order #${target.orderNumber} was cancelled (${cancelNotes}).`,
      type: 'warning',
      targetRoles: ['customer', 'cashier', 'branch_manager', 'kitchen_staff', 'platform_owner'],
      eventKey: 'orderCancelled',
    });

    // Notify Web Backend
    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: target.id,
        status: 'cancelled',
        notes: cancelNotes,
        cancellationReason: cancelNotes,
        cancelledBy: cancelActor,
        expectedVersion: target.version,
        actorId: currentUser?.id || (cancelActor === 'customer' ? 'customer' : 'staff'),
        actorName: currentUser?.name || (cancelActor === 'customer' ? 'Customer' : 'Staff'),
        actorRole: role || (cancelActor === 'customer' ? 'customer' : 'staff'),
      }),
    }).catch(() => { });

    return true;
  };

  const fetchOlderOrders = async (
    branchId?: string,
    dateScope: string = 'all',
    startDate?: string,
    endDate?: string
  ) => {
    setIsFetchingOlderOrders(true);
    try {
      const bId = branchId !== undefined ? branchId : (role === 'platform_owner' ? 'all' : currentBranchId);
      const isCust = role === 'customer' || appMode === 'customer';
      const custQuery = isCust && currentUser?.id && currentUser.id !== 'user-guest'
        ? `&customerId=${encodeURIComponent(currentUser.id)}&customerPhone=${encodeURIComponent(currentUser.phone || '')}`
        : '';
      const dateParams = startDate || endDate
        ? `&startDate=${encodeURIComponent(startDate || '')}&endDate=${encodeURIComponent(endDate || '')}`
        : `&dateScope=${encodeURIComponent(dateScope)}`;

      const url = bId && bId !== 'all'
        ? `/api/orders?branchId=${encodeURIComponent(bId)}&older=true${dateParams}${custQuery}`
        : `/api/orders?older=true${dateParams}${custQuery}`;

      const res = await apiFetch<{ orders: Order[] }>(url);
      if (res.ok && res.data && Array.isArray(res.data.orders)) {
        setOrders((prev) => {
          const map = new Map<string, Order>();
          res.data!.orders.forEach((o) => map.set(o.id, o));
          prev.forEach((o) => map.set(o.id, o));
          const sorted = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          return sorted;
        });
        setHasLoadedOlderOrders(true);
      }
    } catch (e) {
      showToast('Could not load historical records from database.', 'danger');
    } finally {
      setIsFetchingOlderOrders(false);
    }
  };

  const filterOrdersToToday = async () => {
    setIsFetchingOlderOrders(true);
    try {
      const bId = role === 'platform_owner' ? 'all' : currentBranchId;
      const url = bId && bId !== 'all'
        ? `/api/orders?branchId=${encodeURIComponent(bId)}&dateScope=today`
        : `/api/orders?dateScope=today`;
      const res = await apiFetch<{ orders: Order[] }>(url);
      if (res.ok && res.data && Array.isArray(res.data.orders)) {
        setOrders(res.data.orders);
        setHasLoadedOlderOrders(false);
        showToast("Showing Today's Data & Active Orders 📅", 'success');
      }
    } finally {
      setIsFetchingOlderOrders(false);
    }
  };

  const updateOrderStatus = (
    orderId: string,
    status: OrderStatus,
    extraFields?: Record<string, any>
  ) => {
    const existingOrd = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    // Track in-flight status so polling preserves it
    inFlightOrdersRef.current.set(orderId, {
      status,
      riderStatus: extraFields?.riderStatus,
      paymentStatus: extraFields?.paymentStatus,
      paymentCollected: extraFields?.paymentCollected,
      timestamp: Date.now(),
    });

    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? {
            ...o,
            status,
            ...(extraFields || {}),
            preparationStartedAt:
              status === 'preparing' ? new Date().toISOString() : o.preparationStartedAt,
            completedAt:
              status === 'completed' || status === 'delivered' || status === 'served' || status === 'taken'
                ? new Date().toISOString()
                : o.completedAt,
          }
          : o
      );
      AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });

    showToast(`Order status updated to ${status.replace(/_/g, ' ').toUpperCase()}`, 'success');

    if (existingOrd) {
      const eventKey: NotificationEventKey =
        status === 'preparing'
          ? 'cooking'
          : status === 'ready'
            ? 'orderReady'
            : status === 'out_for_delivery'
              ? 'outForDelivery'
              : status === 'served'
                ? 'orderServed'
                : status === 'completed' || status === 'delivered' || status === 'taken'
                  ? 'orderCompleted'
                  : status === 'cancelled'
                    ? 'orderCancelled'
                    : 'sentToKitchen';

      if (notificationSettings.events[eventKey] !== false) {
        const ordCategory: NotificationCategory =
          existingOrd.type === 'takeaway'
            ? 'takeaway'
            : existingOrd.type === 'dine_in'
              ? 'dine_in'
              : 'delivery';
        let stageTitle = `Order #${existingOrd.orderNumber} • ${status.replace(/_/g, ' ').toUpperCase()}`;
        let stageMsg = `Order #${existingOrd.orderNumber} status updated to ${status.replace(/_/g, ' ')}.`;
        let stageType: AppNotification['type'] = 'info';

        if (status === 'preparing') {
          stageTitle = `Order #${existingOrd.orderNumber} • Cooking in Kitchen 👨‍🍳`;
          stageMsg = `Our chefs are actively preparing your fresh order #${existingOrd.orderNumber}.`;
        } else if (status === 'ready') {
          stageType = 'success';
          if (existingOrd.type === 'takeaway') {
            stageTitle = `Order #${existingOrd.orderNumber} • Ready for Pickup! 🛍️`;
            stageMsg = `Your Takeaway order #${existingOrd.orderNumber} is hot, packed, and ready at the counter!`;
          } else if (existingOrd.type === 'dine_in') {
            stageTitle = `Order #${existingOrd.orderNumber} • Ready to Serve 🍽️`;
            stageMsg = `Your Dine-In order #${existingOrd.orderNumber}${existingOrd.tableNumber ? ` (Table ${existingOrd.tableNumber})` : ''} is ready and being served to your table!`;
          } else {
            stageTitle = `Order #${existingOrd.orderNumber} • Packed & Ready 🛵`;
            stageMsg = `Your Delivery order #${existingOrd.orderNumber} is packed and ready for rider dispatch.`;
          }
        } else if (status === 'out_for_delivery') {
          stageTitle = `Order #${existingOrd.orderNumber} • Out for Delivery 🛵`;
          stageMsg = `Your rider is on the way with order #${existingOrd.orderNumber}!`;
        } else if (status === 'served') {
          stageType = 'success';
          stageTitle = `Order #${existingOrd.orderNumber} • Served 🍽️`;
          stageMsg = `Your order #${existingOrd.orderNumber} has been served at Table ${existingOrd.tableNumber || '-'}. Enjoy your meal!`;
        } else if (status === 'completed' || status === 'delivered' || status === 'taken') {
          stageType = 'success';
          stageTitle = `Order #${existingOrd.orderNumber} • Delivered & Completed ✓`;
          stageMsg = `Your order #${existingOrd.orderNumber} has been completed. Thank you for dining with Foodies Cafe!`;
        } else if (status === 'cancelled') {
          stageType = 'error';
          stageTitle = `Order #${existingOrd.orderNumber} • Cancelled`;
          stageMsg = `Order #${existingOrd.orderNumber} was cancelled.`;
        }

        pushOptimisticNotification({
          id: `notif-status-${existingOrd.id}-${status}-${Date.now()}`,
          title: stageTitle,
          message: stageMsg,
          type: stageType,
          category: ordCategory,
          branchId: existingOrd.branchId,
          orderId: existingOrd.id,
          orderNumber: existingOrd.orderNumber,
          orderType: existingOrd.type,
          senderId: currentUser?.id,
          senderName: currentUser?.name || 'Staff',
          senderRole: role,
          targetRoles: buildMobileOrderNotificationRoles(existingOrd.type, notificationSettings),
          targetPlatform: notificationSettings.defaultPlatform || 'all',
          targetUserId: existingOrd.customerId,
          targetCustomerPhone: existingOrd.customerPhone,
          targetCustomerName: existingOrd.customerName,
          targetWaiterId: existingOrd.assignedWaiterId,
          targetWaiterName: existingOrd.assignedWaiterName,
          targetRiderId: existingOrd.assignedRiderId,
          targetRiderName: existingOrd.assignedRiderName,
          eventKey,
          readBy: currentUser?.id ? [currentUser.id] : [],
          createdAt: new Date().toISOString(),
        });
      }
    }

    const nextOrderSnapshot = existingOrd
      ? {
          ...existingOrd,
          status,
          ...(extraFields || {}),
          preparationStartedAt:
            status === 'preparing' ? new Date().toISOString() : existingOrd.preparationStartedAt,
          completedAt:
            status === 'completed' || status === 'delivered' || status === 'served' || status === 'taken'
              ? new Date().toISOString()
              : existingOrd.completedAt,
        }
      : undefined;

    // Notify Web Backend & PostgreSQL via PATCH /api/orders
    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId,
        type: existingOrd?.type,
        orderSnapshot: nextOrderSnapshot,
        status,
        expectedVersion: existingOrd?.version,
        actorId: currentUser?.id,
        actorName: currentUser?.name,
        actorRole: currentUser?.role || role || 'delivery_staff',
        ...(extraFields || {}),
      }),
    }).catch(() => { });
  };

  const updateOrderPayment = (orderId: string, paymentStatus: 'paid' | 'unpaid') => {
    const existingOrd =
      orders.find((o) => o.id === orderId || o.orderNumber === orderId) ||
      ordersRef.current.find((o) => o.id === orderId || o.orderNumber === orderId);
    const isFulfilledDelivery =
      Boolean(existingOrd) &&
      (existingOrd?.status === 'out_for_delivery' ||
        existingOrd?.status === 'delivered' ||
        (existingOrd?.type === 'delivery' && existingOrd?.riderStatus === 'delivered'));
    const isFulfilledDineIn =
      existingOrd?.type === 'dine_in' && existingOrd?.status === 'served';
    const isFulfilledTakeaway =
      existingOrd?.type === 'takeaway' && existingOrd?.status === 'taken';
    const shouldCompleteOnPay =
      paymentStatus === 'paid' &&
      (isFulfilledDelivery || isFulfilledDineIn || isFulfilledTakeaway);
    const nowIso = new Date().toISOString();
    const resolvedNextStatus: OrderStatus | undefined = shouldCompleteOnPay
      ? 'completed'
      : paymentStatus === 'paid' && existingOrd?.status === 'placed'
        ? 'accepted'
        : existingOrd?.status;
    const nextOrderSnapshot = existingOrd
      ? {
          ...existingOrd,
          paymentStatus,
          paymentCollected: paymentStatus === 'paid',
          status: resolvedNextStatus || existingOrd.status,
          riderStatus:
            paymentStatus === 'paid' && isFulfilledDelivery
              ? ('delivered' as const)
              : existingOrd.riderStatus,
          completedAt: shouldCompleteOnPay ? nowIso : existingOrd.completedAt,
          deliveredAt:
            paymentStatus === 'paid' && isFulfilledDelivery
              ? existingOrd.deliveredAt || nowIso
              : existingOrd.deliveredAt,
        }
      : undefined;

    // Track in-flight payment status so polling NEVER reverts to unpaid
    inFlightOrdersRef.current.set(orderId, {
      paymentStatus,
      paymentCollected: paymentStatus === 'paid',
      status: shouldCompleteOnPay ? 'completed' : undefined,
      riderStatus: paymentStatus === 'paid' && isFulfilledDelivery ? 'delivered' : undefined,
      timestamp: Date.now(),
    });

    setOrders((prev) => {
      const next = prev.map((o) => {
        if (o.id !== orderId && o.orderNumber !== orderId) return o;
        const oFulfilledDelivery =
          o.status === 'out_for_delivery' ||
          o.status === 'delivered' ||
          (o.type === 'delivery' && o.riderStatus === 'delivered');
        const oFulfilledDineIn = o.type === 'dine_in' && o.status === 'served';
        const oFulfilledTakeaway = o.type === 'takeaway' && o.status === 'taken';
        const oShouldComplete =
          paymentStatus === 'paid' &&
          (oFulfilledDelivery || oFulfilledDineIn || oFulfilledTakeaway);
        return {
          ...o,
          paymentStatus,
          paymentCollected: paymentStatus === 'paid',
          status: oShouldComplete
            ? ('completed' as OrderStatus)
            : paymentStatus === 'paid' && o.status === 'placed'
              ? ('accepted' as OrderStatus)
              : o.status,
          riderStatus:
            paymentStatus === 'paid' && oFulfilledDelivery
              ? ('delivered' as const)
              : o.riderStatus,
          completedAt: oShouldComplete ? nowIso : o.completedAt,
          deliveredAt:
            paymentStatus === 'paid' && oFulfilledDelivery
              ? o.deliveredAt || nowIso
              : o.deliveredAt,
        };
      });
      AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });

    showToast(`Order #${orderId} marked as ${paymentStatus.toUpperCase()} ✓`, 'success');

    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId,
        type: existingOrd?.type,
        orderSnapshot: nextOrderSnapshot,
        paymentStatus,
        paymentCollected: paymentStatus === 'paid',
        status: shouldCompleteOnPay ? 'completed' : undefined,
        riderStatus: paymentStatus === 'paid' && isFulfilledDelivery ? 'delivered' : undefined,
        completedAt: shouldCompleteOnPay ? nowIso : undefined,
        deliveredAt: paymentStatus === 'paid' && isFulfilledDelivery ? nowIso : undefined,
        actorId: currentUser?.id,
        actorName: currentUser?.name,
        actorRole: currentUser?.role || role || 'delivery_staff',
      }),
    }).catch(() => { });
  };

  const editOrderStage1 = (orderId: string, updatedItems: CartItem[]) => {
    const newSubtotal = updatedItems.reduce(
      (acc, i) => acc + Number(i.unitPrice) * Number(i.quantity),
      0
    );
    const tax = Math.round(newSubtotal * 0.16 * 10) / 10;
    const newTotal = newSubtotal + tax;
    let prevVersion = 1;
    let nextVersion = 2;

    setOrders((prev) => {
      const next = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          prevVersion = Number(ord.version) || 1;
          nextVersion = prevVersion + 1;
          return {
            ...ord,
            items: updatedItems,
            subtotal: newSubtotal,
            tax,
            total: newTotal,
            version: nextVersion,
          };
        }
        return ord;
      });
      AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });

    showToast('Order updated with new items!', 'success');

    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId,
        items: updatedItems,
        subtotal: newSubtotal,
        total: newTotal,
        expectedVersion: prevVersion,
        version: nextVersion,
        actorId: currentUser?.id,
        actorName: currentUser?.name,
        actorRole: role,
      }),
    }).catch(() => { });
  };

  // Staff Administration Actions (Manager & Owner)
  const createUser = async (userData: Partial<MobileUser>): Promise<MobileUser | null> => {
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      if (res.ok && res.data?.user) {
        const newUser: MobileUser = res.data.user;
        setUsers((prev) => [...prev.filter((u) => u.id !== newUser.id), newUser]);
        showToast(`Staff account for ${newUser.name} created!`, 'success');
        return newUser;
      } else {
        showToast(res.error || 'Failed to create staff account', 'danger');
        return null;
      }
    } catch {
      showToast('Network error creating staff account', 'danger');
      return null;
    }
  };

  const updateUser = async (userId: string, updates: Partial<MobileUser>): Promise<boolean> => {
    try {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)));
      if (currentUser?.id === userId) {
        updateCurrentUser(updates);
      }
      if (staffUser?.id === userId && staffUser.role !== 'platform_owner') {
        if (updates.status && updates.status !== 'active') {
          await logoutStaff();
          showToast(`Account Access Revoked: Account is ${updates.status.toUpperCase()}.`, 'danger');
        } else {
          setStaffUserState((prev) => (prev ? { ...prev, ...updates } : prev));
          if (updates.role) setRoleState(updates.role);
          if (updates.branchId) setCurrentBranchId(normalizeBranchId(updates.branchId));
        }
      }
      const res = await apiFetch('/api/users', {
        method: 'PATCH',
        body: JSON.stringify({ id: userId, ...updates }),
      });
      if (res.ok) {
        showToast('Staff account updated successfully', 'success');
        refreshData();
        return true;
      } else {
        showToast(res.error || 'Failed to update staff account', 'danger');
        return false;
      }
    } catch {
      showToast('Network error updating staff account', 'danger');
      return false;
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    try {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      const res = await apiFetch(`/api/users?id=${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Staff account removed', 'info');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Menu Management Actions (Manager & Owner)
  const createMenuItem = async (itemData: Partial<MenuItem>): Promise<boolean> => {
    try {
      const res = await apiFetch('/api/menu', {
        method: 'POST',
        body: JSON.stringify(itemData),
      });
      if (res.ok && res.data?.item) {
        setMenuItems((prev) => {
          const next = [...prev, res.data.item];
          AsyncStorage.setItem('@foodies_menu_permanent_store', JSON.stringify(next)).catch(() => { });
          return next;
        });
        showToast(`Dish ${itemData.name} added to catalog!`, 'success');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const deleteMenuItem = async (itemId: string): Promise<boolean> => {
    try {
      setMenuItems((prev) => {
        const next = prev.filter((m) => m.id !== itemId);
        AsyncStorage.setItem('@foodies_menu_permanent_store', JSON.stringify(next)).catch(() => { });
        return next;
      });
      const res = await apiFetch(`/api/menu?id=${itemId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Dish removed from catalog', 'info');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const toggleMenuItemBranchAvailability = async (itemId: string, branchId: string) => {
    const item = menuItems.find((m) => m.id === itemId);
    if (!item) return;
    const currentVal = item.branchAvailability?.[branchId] !== false;
    const updatedAvail = { ...(item.branchAvailability || {}), [branchId]: !currentVal };

    setMenuItems((prev) => {
      const next = prev.map((m) => (m.id === itemId ? { ...m, branchAvailability: updatedAvail } : m));
      AsyncStorage.setItem('@foodies_menu_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    showToast(`${item.name} marked ${!currentVal ? 'In Stock' : 'Unavailable'} for branch`, 'info');

    apiFetch('/api/menu', {
      method: 'PATCH',
      body: JSON.stringify({ id: itemId, itemId, branchAvailability: updatedAvail }),
    }).catch(() => { });
  };

  const updateMenuItemBranchPrice = async (itemId: string, branchId: string, overridePrice: number) => {
    const item = menuItems.find((m) => m.id === itemId);
    if (!item) return;
    const updatedOverrides = { ...(item.branchPriceOverrides || {}), [branchId]: overridePrice };

    setMenuItems((prev) => {
      const next = prev.map((m) => (m.id === itemId ? { ...m, branchPriceOverrides: updatedOverrides } : m));
      AsyncStorage.setItem('@foodies_menu_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });

    // Recalculate any matching items in the customer's cart
    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart;
      return prevCart.map((ci) => {
        if (ci.menuItemId !== itemId) return ci;
        const dish = { ...item, branchPriceOverrides: updatedOverrides };
        let newUnitPrice = hasSelectedBranch
          ? (branchId === currentBranchId ? overridePrice : (dish.branchPriceOverrides?.[currentBranchId] ?? dish.basePrice))
          : getItemMinPrice(dish);
        if (ci.size && dish.sizes) {
          const matchSize = dish.sizes.find((s) => s.name === ci.size);
          if (matchSize) newUnitPrice += matchSize.priceDelta;
        }
        if (ci.extras && dish.extras) {
          ci.extras.forEach((ext) => {
            const matchExtra = dish.extras?.find((e) => e.name === ext);
            if (matchExtra) newUnitPrice += matchExtra.price;
          });
        }
        return { ...ci, unitPrice: newUnitPrice };
      });
    });

    showToast(`Branch price updated to Rs. ${overridePrice}`, 'success');

    apiFetch('/api/menu', {
      method: 'PATCH',
      body: JSON.stringify({ id: itemId, itemId, branchPriceOverrides: updatedOverrides }),
    }).catch(() => { });
  };

  // Financials & Refund Approvals (Manager & Owner)
  const requestRefund = async (orderId: string, amount: number, reason: string) => {
    const newReq = {
      id: `ref-${Date.now()}`,
      orderId,
      branchId: normalizeBranchId(currentBranchId),
      amount,
      reason,
      requestedBy: currentUser.name,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setRefunds((prev) => [newReq, ...prev]);
    showToast('Refund request submitted for approval', 'info');
    apiFetch('/api/refunds', {
      method: 'POST',
      body: JSON.stringify(newReq),
    }).catch(() => { });
  };

  const approveRefund = async (refundId: string) => {
    setRefunds((prev) =>
      prev.map((r) => (r.id === refundId ? { ...r, status: 'approved', reviewedBy: currentUser.name } : r))
    );
    showToast('Refund request approved successfully ✓', 'success');

    apiFetch('/api/refunds', {
      method: 'PATCH',
      body: JSON.stringify({ refundId, status: 'approved', approvedBy: currentUser.name }),
    }).catch(() => { });
  };

  const rejectRefund = async (refundId: string) => {
    setRefunds((prev) =>
      prev.map((r) => (r.id === refundId ? { ...r, status: 'rejected', reviewedBy: currentUser.name } : r))
    );
    showToast('Refund request rejected', 'info');

    apiFetch('/api/refunds', {
      method: 'PATCH',
      body: JSON.stringify({ refundId, status: 'rejected', approvedBy: currentUser.name }),
    }).catch(() => { });
  };

  const openShift = async (openingFloat: number) => {
    const newShift = {
      id: `shift-${Date.now()}`,
      branchId: normalizeBranchId(currentBranchId),
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      openedAt: new Date().toISOString(),
      openingFloat,
      status: 'open',
    };
    setShifts((prev) => [newShift, ...prev]);
    showToast(`Cashier shift opened with Rs. ${openingFloat}`, 'success');
    apiFetch('/api/shifts', {
      method: 'POST',
      body: JSON.stringify(newShift),
    }).catch(() => { });
  };

  const closeShift = async (countedCash: number, differenceReason: string) => {
    const openOne = shifts.find((s) => s.status === 'open' && normalizeBranchId(s.branchId) === normalizeBranchId(currentBranchId));
    if (!openOne) return;
    const closedAt = new Date().toISOString();
    setShifts((prev) =>
      prev.map((s) => (s.id === openOne.id ? { ...s, status: 'closed', closedAt, countedCash, differenceReason } : s))
    );
    showToast('Cashier shift closed & reconciled ✓', 'success');
    apiFetch('/api/shifts', {
      method: 'PATCH',
      body: JSON.stringify({
        shiftId: openOne.id,
        closedAt,
        countedCash,
        differenceReason,
        status: 'closed',
      }),
    }).catch(() => { });
  };

  const updateShiftOpeningBalance = async (shiftId: string, newOpeningFloat: number) => {
    const cleanOpening = Math.max(0, Number(newOpeningFloat) || 0);
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== shiftId) return s;
        const cashCollected = Number(s.cashCollected || 0);
        const expectedCash = cleanOpening + cashCollected;
        const difference =
          s.countedCash !== undefined && s.countedCash !== null
            ? Number(s.countedCash) - expectedCash
            : s.difference;
        return {
          ...s,
          openingFloat: cleanOpening,
          expectedCash,
          difference,
        };
      })
    );
    showToast(`Cashier opening balance updated to Rs. ${cleanOpening.toLocaleString()} ✓`, 'success');
    apiFetch('/api/shifts', {
      method: 'PATCH',
      body: JSON.stringify({
        shiftId,
        openingFloat: cleanOpening,
      }),
    }).catch(() => { });
  };

  // Branch Creation (Owner) — Persisted to Global Backend
  const createBranch = async (branchData: Partial<Branch>): Promise<boolean> => {
    try {
      const newBranchId = branchData.id || `branch-${Date.now()}`;
      const newB: Branch = {
        id: newBranchId,
        name: branchData.name || 'New Branch',
        city: branchData.city || 'Lahore',
        address: branchData.address || '',
        phone: branchData.phone || '+92 300 0000000',
        openingHours: branchData.openingHours || '11:00 AM - 1:00 AM',
        isOpen: true,
        isBusy: false,
        prepTimeEstimateMin: 20,
        deliveryEnabled: true,
        latitude: branchData.latitude || 31.5204,
        longitude: branchData.longitude || 74.3587,
        maxOrderDistanceKm: branchData.maxOrderDistanceKm || 50,
        tableQrMaxDistanceMeters: branchData.tableQrMaxDistanceMeters || 300,
      };
      setBranches((prev) => [...prev, newB]);
      await apiFetch('/api/branches', {
        method: 'POST',
        body: JSON.stringify(newB),
      });
      showToast(`Branch ${newB.name} created!`, 'success');
      return true;
    } catch {
      return false;
    }
  };

  // Owner & Manager Actions
  const updateMenuItemStock = (menuItemId: string, isAvailable: boolean) => {
    setMenuItems((prev) => {
      const next = prev.map((m) => (m.id === menuItemId ? { ...m, isAvailable } : m));
      AsyncStorage.setItem('@foodies_menu_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    showToast(`Dish marked ${isAvailable ? 'In Stock' : 'Unavailable'}`, 'success');

    apiFetch('/api/menu', {
      method: 'PATCH',
      body: JSON.stringify({ id: menuItemId, itemId: menuItemId, isAvailable }),
    }).catch(() => { });
  };

  const updateMenuItemPrice = (menuItemId: string, newPrice: number) => {
    setMenuItems((prev) => {
      const next = prev.map((m) => (m.id === menuItemId ? { ...m, basePrice: newPrice } : m));
      AsyncStorage.setItem('@foodies_menu_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });

    // Recalculate any matching items in the customer's cart
    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart;
      return prevCart.map((ci) => {
        if (ci.menuItemId !== menuItemId) return ci;
        const targetDish = menuItems.find((m) => m.id === menuItemId);
        if (!targetDish) return ci;
        const dish = { ...targetDish, basePrice: newPrice };
        let newUnitPrice = hasSelectedBranch
          ? (dish.branchPriceOverrides?.[currentBranchId] ?? newPrice)
          : getItemMinPrice(dish);
        if (ci.size && dish.sizes) {
          const matchSize = dish.sizes.find((s) => s.name === ci.size);
          if (matchSize) newUnitPrice += matchSize.priceDelta;
        }
        if (ci.extras && dish.extras) {
          ci.extras.forEach((ext) => {
            const matchExtra = dish.extras?.find((e) => e.name === ext);
            if (matchExtra) newUnitPrice += matchExtra.price;
          });
        }
        return { ...ci, unitPrice: newUnitPrice };
      });
    });

    showToast('Dish base price updated successfully', 'success');

    apiFetch('/api/menu', {
      method: 'PATCH',
      body: JSON.stringify({ id: menuItemId, itemId: menuItemId, basePrice: newPrice }),
    }).catch(() => { });
  };

  const updateBranchSettings = (branchId: string, updates: Partial<Branch>) => {
    const norm = normalizeBranchId(branchId);
    setBranches((prev) => {
      const next = prev.map((b) => (b.id === norm || b.id === branchId ? { ...b, ...updates } : b));
      AsyncStorage.setItem('@foodies_branches_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    showToast('Branch operational settings updated', 'success');

    apiFetch('/api/branches', {
      method: 'PATCH',
      body: JSON.stringify({ branchId: norm, settings: updates, ...updates }),
    }).catch(() => { });
  };

  const [shutdownModalState, setShutdownModalState] = useState<{
    visible: boolean;
    branch: Branch | null;
    pendingOrders: Order[];
  }>({
    visible: false,
    branch: null,
    pendingOrders: [],
  });

  const toggleBranchStatus = (branchId: string) => {
    const norm = normalizeBranchId(branchId);
    const target = branches.find((b) => b.id === norm || b.id === branchId);
    if (!target) return;

    // If currently OPEN and going to mark OFFLINE, check for pending in-progress orders
    if (target.isOpen) {
      const pending = orders.filter(
        (o) =>
          (o.branchId === norm || o.branchId === branchId) &&
          !['completed', 'delivered', 'served', 'taken', 'cancelled'].includes(o.status)
      );

      if (pending.length > 0) {
        setShutdownModalState({
          visible: true,
          branch: target,
          pendingOrders: pending,
        });
        return;
      }
    }

    const nextStatus = !target.isOpen;

    setBranches((prev) =>
      prev.map((b) => (b.id === norm || b.id === branchId ? { ...b, isOpen: nextStatus } : b))
    );
    showToast(`Branch marked ${nextStatus ? 'Open' : 'Closed'}`, 'info');

    apiFetch('/api/branches', {
      method: 'PATCH',
      body: JSON.stringify({ branchId: norm, settings: { isOpen: nextStatus }, isOpen: nextStatus }),
    }).catch(() => { });
  };

  const closeShutdownModal = () => {
    setShutdownModalState({ visible: false, branch: null, pendingOrders: [] });
  };

  const confirmShutdownKeepProcessing = () => {
    if (!shutdownModalState.branch) return;
    const target = shutdownModalState.branch;
    const norm = normalizeBranchId(target.id);
    const count = shutdownModalState.pendingOrders.length;

    setBranches((prev) =>
      prev.map((b) => (b.id === norm || b.id === target.id ? { ...b, isOpen: false } : b))
    );
    showToast(`${target.name} marked Closed. ${count} orders will continue processing.`, 'info');

    apiFetch('/api/branches', {
      method: 'PATCH',
      body: JSON.stringify({ branchId: norm, settings: { isOpen: false }, isOpen: false }),
    }).catch(() => { });

    setShutdownModalState({ visible: false, branch: null, pendingOrders: [] });
  };

  const confirmShutdownCancelOrders = () => {
    if (!shutdownModalState.branch) return;
    const target = shutdownModalState.branch;
    const norm = normalizeBranchId(target.id);
    const pending = shutdownModalState.pendingOrders;

    // 1. Mark branch closed
    setBranches((prev) =>
      prev.map((b) => (b.id === norm || b.id === target.id ? { ...b, isOpen: false } : b))
    );
    apiFetch('/api/branches', {
      method: 'PATCH',
      body: JSON.stringify({ branchId: norm, settings: { isOpen: false }, isOpen: false }),
    }).catch(() => { });

    // 2. Mark pending orders as cancelled
    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) =>
        (o.branchId === norm || o.branchId === target.id) &&
          !['completed', 'delivered', 'served', 'taken', 'cancelled'].includes(o.status)
          ? {
            ...o,
            status: 'cancelled' as OrderStatus,
            notes: (o.notes ? o.notes + ' | ' : '') + 'Cancelled due to branch shutdown offline by manager',
            cancellationReason: 'Cancelled due to branch shutdown offline by manager',
            cancelledBy: 'branch_offline',
            updatedAt: now,
          }
          : o
      )
    );

    // Sync cancelled orders to backend
    for (const ord of pending) {
      apiFetch('/api/orders', {
        method: 'PATCH',
        body: JSON.stringify({
          orderId: ord.id,
          orderNumber: ord.orderNumber,
          status: 'cancelled',
          notes: (ord.notes ? ord.notes + ' | ' : '') + 'Cancelled due to branch shutdown offline by manager',
          cancellationReason: 'Cancelled due to branch shutdown offline by manager',
          cancelledBy: 'branch_offline',
        }),
      }).catch(() => { });
    }

    // Release any associated tables
    setTables((prev) =>
      prev.map((t) =>
        (t.branchId === norm || t.branchId === target.id) && t.status === 'occupied'
          ? { ...t, status: 'available' as const, currentOrderId: undefined }
          : t
      )
    );

    showToast(`${target.name} closed offline & ${pending.length} orders cancelled.`, 'warning');
    setShutdownModalState({ visible: false, branch: null, pendingOrders: [] });
  };

  // Floor Staff & Table Actions (Connected to Global Backend)
  const addTable = (tableData: Omit<Table, 'id'>) => {
    const newTable: Table = {
      ...tableData,
      id: `tbl-${Date.now()}`,
    };
    setTables((prev) => {
      const next = [...prev, newTable];
      AsyncStorage.setItem('@foodies_tables_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    showToast(`Table ${newTable.number} added!`, 'success');
    apiFetch('/api/tables', {
      method: 'POST',
      body: JSON.stringify(newTable),
    }).catch(() => { });
  };

  const deleteTable = (tableId: string) => {
    setTables((prev) => {
      const next = prev.filter((t) => t.id !== tableId);
      AsyncStorage.setItem('@foodies_tables_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    showToast('Table removed', 'info');
    apiFetch(`/api/tables?tableId=${encodeURIComponent(tableId)}`, {
      method: 'DELETE',
    }).catch(() => { });
  };

  const updateTableStatus = (tableId: string, status: TableStatus) => {
    setTables((prev) => {
      const next = prev.map((t) => (t.id === tableId ? { ...t, status } : t));
      AsyncStorage.setItem('@foodies_tables_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    showToast(`Table status changed to ${status}`, 'success');

    apiFetch('/api/tables', {
      method: 'PATCH',
      body: JSON.stringify({ tableId, status }),
    }).catch(() => { });
  };

  const updateTable = (tableId: string, updates: Partial<Table>) => {
    setTables((prev) => {
      const next = prev.map((t) => (t.id === tableId || t.number === tableId ? { ...t, ...updates } : t));
      AsyncStorage.setItem('@foodies_tables_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    apiFetch('/api/tables', {
      method: 'PATCH',
      body: JSON.stringify({ tableId, ...updates }),
    }).catch(() => { });
  };

  const markTableFree = (tableIdOrNumber: string) => {
    setTables((prev) => {
      const next = prev.map((t) =>
        t.id === tableIdOrNumber || t.number === tableIdOrNumber
          ? { ...t, status: 'available' as TableStatus, currentOrderId: undefined, seatedAt: undefined }
          : t
      );
      AsyncStorage.setItem('@foodies_tables_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    showToast(`Table ${tableIdOrNumber} cleared and available`, 'success');
    apiFetch('/api/tables', {
      method: 'PATCH',
      body: JSON.stringify({
        tableId: tableIdOrNumber,
        tableNumber: tableIdOrNumber,
        branchId: normalizeBranchId(currentBranchId),
        status: 'available',
      }),
    }).catch(() => { });
  };

  const generateTableQr = async (tableId: string, validMinutes: number, allowOnReserved = false): Promise<Table | null> => {
    try {
      const res = await apiFetch('/api/tables/qr', {
        method: 'POST',
        body: JSON.stringify({
          tableId,
          validMinutes,
          allowOnReserved,
          branchId: normalizeBranchId(currentBranchId),
        }),
      });
      if (res.ok && res.data?.table) {
        setTables((prev) => {
          const next = prev.map((t) => (t.id === tableId ? { ...t, ...res.data.table } : t));
          AsyncStorage.setItem('@foodies_tables_store', JSON.stringify(next)).catch(() => { });
          return next;
        });
        showToast('Table QR generated ✓', 'success');
        return res.data.table;
      }
    } catch { }
    return null;
  };

  const toggleTableQrAllowReserved = async (tableId: string, allow: boolean) => {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, qrAllowOnReserved: allow } : t)));
    apiFetch('/api/tables', {
      method: 'PATCH',
      body: JSON.stringify({ tableId, qrAllowOnReserved: allow }),
    }).catch(() => { });
  };

  const assignWaiterToOrder = async (orderId: string, waiterId: string, waiterName: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? { ...o, assignedWaiterId: waiterId, assignedWaiterName: waiterName }
          : o
      )
    );
    showToast(`Assigned ${waiterName} to order`, 'success');
    const waiterOrd = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (waiterOrd) {
      pushOrderNotification(waiterOrd, {
        id: `notif-waiter-${waiterOrd.id}-${Date.now()}`,
        title: `Waiter Assigned • Table ${waiterOrd.tableNumber || '-'}`,
        message: `${waiterName} assigned to Dine-In Order #${waiterOrd.orderNumber}.`,
        type: 'info',
        targetRoles: ['customer', 'floor_staff', 'branch_manager', 'cashier'],
        targetWaiterId: waiterId,
        targetWaiterName: waiterName,
        eventKey: 'waiterAssigned',
      });
    }
    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId,
        assignedWaiterId: waiterId,
        assignedWaiterName: waiterName,
      }),
    }).catch(() => { });
  };

  const assignRiderToOrder = async (orderId: string, riderId: string) => {
    const rider = users.find((u) => u.id === riderId);
    const riderName = rider?.name || 'Delivery Rider';
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? { ...o, assignedRiderId: riderId, assignedRiderName: riderName, riderStatus: 'assigned' }
          : o
      )
    );
    showToast(`Assigned ${riderName} to delivery order`, 'success');
    const riderOrd = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (riderOrd) {
      pushOrderNotification(riderOrd, {
        id: `notif-rider-${riderOrd.id}-${Date.now()}`,
        title: `Rider Assigned • Order #${riderOrd.orderNumber}`,
        message: `${riderName} has been assigned to deliver Order #${riderOrd.orderNumber}.`,
        type: 'info',
        targetRoles: ['customer', 'delivery_staff', 'branch_manager', 'cashier'],
        targetRiderId: riderId,
        targetRiderName: riderName,
        eventKey: 'riderAssigned',
      });
    }
    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId,
        assignedRiderId: riderId,
        assignedRiderName: riderName,
        riderStatus: 'assigned',
      }),
    }).catch(() => { });
  };

  const unassignRiderFromOrder = async (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? { ...o, assignedRiderId: undefined, assignedRiderName: undefined, riderStatus: undefined }
          : o
      )
    );
    showToast('Rider unassigned from order', 'info');
    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId,
        assignedRiderId: null,
        assignedRiderName: null,
        riderStatus: null,
      }),
    }).catch(() => { });
  };

  const acceptRiderOrder = async (orderId: string) => {
    inFlightOrdersRef.current.set(orderId, {
      riderStatus: 'accepted',
      timestamp: Date.now(),
    });
    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? { ...o, riderStatus: 'accepted' as const }
          : o
      );
      AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });
    showToast('Order Accepted! 🛵', 'success');
    const accOrd = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (accOrd) {
      pushOrderNotification(accOrd, {
        id: `notif-rider-accept-${accOrd.id}-${Date.now()}`,
        title: `Rider En Route • Order #${accOrd.orderNumber}`,
        message: `${currentUser?.name || 'Your rider'} accepted delivery for Order #${accOrd.orderNumber}.`,
        type: 'success',
        targetRoles: ['customer', 'branch_manager', 'cashier', 'delivery_staff'],
        eventKey: 'outForDelivery',
      });
    }
    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId,
        riderStatus: 'accepted',
        actorRole: 'delivery_staff',
        actorId: currentUser?.id,
        actorName: currentUser?.name,
      }),
    }).catch(() => { });
  };

  const markOrderDeliveredToTable = (orderId: string) => {
    const target =
      orders.find((o) => o.id === orderId || o.orderNumber === orderId) ||
      ordersRef.current.find((o) => o.id === orderId || o.orderNumber === orderId);
    const targetOrderId = target?.id || orderId;
    const nowIso = new Date().toISOString();

    const matchingTable = target?.tableNumber
      ? tables.find(
          (t) =>
            t.number === target.tableNumber ||
            t.id === target.tableNumber ||
            t.number.replace(/\D/g, '') === String(target.tableNumber).replace(/\D/g, '')
        )
      : undefined;

    const resolvedWaiterId =
      target?.assignedWaiterId ||
      matchingTable?.assignedWaiterId ||
      (role === 'floor_staff' ? staffUser?.id : undefined);
    const resolvedWaiterName =
      target?.assignedWaiterName ||
      matchingTable?.assignedWaiterName ||
      (role === 'floor_staff' ? staffUser?.name : undefined);

    inFlightOrdersRef.current.set(targetOrderId, {
      status: 'served',
      timestamp: Date.now(),
    });
    if (target?.orderNumber) {
      inFlightOrdersRef.current.set(target.orderNumber, {
        status: 'served',
        timestamp: Date.now(),
      });
    }

    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === targetOrderId || o.orderNumber === targetOrderId || o.id === orderId || o.orderNumber === orderId
          ? {
            ...o,
            status: 'served' as OrderStatus,
            deliveredAt: nowIso,
            assignedWaiterId: resolvedWaiterId || o.assignedWaiterId,
            assignedWaiterName: resolvedWaiterName || o.assignedWaiterName,
          }
          : o
      );
      ordersRef.current = next;
      AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });

    showToast(`Order #${target?.orderNumber || ''} delivered to table. Guests dining 🍽️`, 'success');

    const nextDeliveredSnapshot = target
      ? {
          ...target,
          status: 'served' as OrderStatus,
          deliveredAt: nowIso,
          assignedWaiterId: resolvedWaiterId || target.assignedWaiterId,
          assignedWaiterName: resolvedWaiterName || target.assignedWaiterName,
        }
      : undefined;

    // Sync to Web Backend & PostgreSQL
    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: targetOrderId,
        type: target?.type || 'dine_in',
        orderSnapshot: nextDeliveredSnapshot,
        status: 'served',
        deliveredAt: nowIso,
        assignedWaiterId: resolvedWaiterId,
        assignedWaiterName: resolvedWaiterName,
        actorRole: role,
        actorId: staffUser?.id,
        actorName: staffUser?.name,
      }),
    }).catch(() => { });
  };

  const markOrderDoneAndCollected = (orderId: string, cashCollected = true) => {
    const target =
      orders.find((o) => o.id === orderId || o.orderNumber === orderId) ||
      ordersRef.current.find((o) => o.id === orderId || o.orderNumber === orderId);
    const targetOrderId = target?.id || orderId;
    const nowIso = new Date().toISOString();

    inFlightOrdersRef.current.set(targetOrderId, {
      status: 'completed',
      paymentStatus: 'paid',
      paymentCollected: true,
      timestamp: Date.now(),
    });
    if (target?.orderNumber) {
      inFlightOrdersRef.current.set(target.orderNumber, {
        status: 'completed',
        paymentStatus: 'paid',
        paymentCollected: true,
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
            paymentStatus: (cashCollected ? 'paid' : o.paymentStatus) as 'paid' | 'unpaid',
            paymentCollected: cashCollected ? true : o.paymentCollected,
            assignedWaiterId: o.assignedWaiterId || (role === 'floor_staff' ? staffUser?.id : undefined),
            assignedWaiterName: o.assignedWaiterName || (role === 'floor_staff' ? staffUser?.name : undefined),
          }
          : o
      );
      ordersRef.current = next;
      AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(next)).catch(() => { });
      return next;
    });

    // Free the table
    if (target?.tableNumber) {
      setTables((prev) => {
        const next = prev.map((t) =>
          String(t.number) === String(target.tableNumber) || String(t.id) === String(target.tableNumber)
            ? { ...t, status: 'available' as TableStatus, currentOrderId: undefined, seatedAt: undefined }
            : t
        );
        AsyncStorage.setItem('@foodies_tables_store', JSON.stringify(next)).catch(() => { });
        return next;
      });

      apiFetch('/api/tables', {
        method: 'PATCH',
        body: JSON.stringify({
          tableNumber: target.tableNumber,
          branchId: target.branchId || currentBranchId,
          status: 'available',
        }),
      }).catch(() => { });
    }

    showToast(`Table ${target?.tableNumber || ''} cleared & Order #${target?.orderNumber || ''} done and collected ✓`, 'success');

    const nextDoneSnapshot = target
      ? {
          ...target,
          status: 'completed' as OrderStatus,
          completedAt: nowIso,
          deliveredAt: target.deliveredAt || nowIso,
          paymentStatus: (cashCollected ? 'paid' : target.paymentStatus) as 'paid' | 'unpaid',
          paymentCollected: cashCollected ? true : target.paymentCollected,
          assignedWaiterId: target.assignedWaiterId || (role === 'floor_staff' ? staffUser?.id : undefined),
          assignedWaiterName: target.assignedWaiterName || (role === 'floor_staff' ? staffUser?.name : undefined),
        }
      : undefined;

    // Sync to Web Backend & PostgreSQL
    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId: targetOrderId,
        type: target?.type || 'dine_in',
        orderSnapshot: nextDoneSnapshot,
        status: 'completed',
        paymentStatus: cashCollected ? 'paid' : target?.paymentStatus,
        paymentCollected: cashCollected,
        completedAt: nowIso,
        deliveredAt: target?.deliveredAt || nowIso,
        actorRole: role,
        actorId: staffUser?.id,
        actorName: staffUser?.name,
      }),
    }).catch(() => { });
  };

  const generateTablePin = (tableId: string): string => {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, pin } : t))
    );
    showToast(`New Table PIN generated: ${pin}`, 'success');

    apiFetch('/api/tables', {
      method: 'PATCH',
      body: JSON.stringify({ tableId, pin }),
    }).catch(() => { });

    return pin;
  };

  const placeFloorWalkInOrder = (tableNumber: string, items: CartItem[], customerName = 'Walk-in Guest'): Order => {
    const normBranchId = normalizeBranchId(currentBranchId);
    const subtotal = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
    const tax = Math.round(subtotal * 0.16 * 10) / 10;
    const total = subtotal + tax;
    const newOrderNumber = `FC-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: newOrderNumber,
      branchId: normBranchId,
      customerId: 'walk-in-customer',
      customerName,
      customerPhone: '03000000000',
      type: 'dine_in',
      tableNumber,
      status: 'accepted',
      paymentStatus: 'unpaid',
      items,
      originalSubtotal: subtotal,
      addOnSubtotal: 0,
      tax,
      total,
      createdAt: new Date().toISOString(),
      paymentMethod: 'Cash on Delivery (COD)',
      assignedWaiterId: currentUser.id,
      assignedWaiterName: currentUser.name,
    };

    setOrders((prev) => [newOrder, ...prev]);
    setTables((prev) =>
      prev.map((t) =>
        t.number === tableNumber
          ? { ...t, status: 'occupied', currentOrderId: newOrder.id }
          : t
      )
    );
    showToast(`Table ${tableNumber} walk-in order dispatched to kitchen!`, 'success');

    // Transmit to Web Backend
    apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        id: newOrder.id,
        orderNumber: newOrder.orderNumber,
        branchId: normBranchId,
        customerId: 'walk-in-customer',
        customerName,
        customerPhone: '03000000000',
        type: 'dine_in',
        tableNumber,
        status: 'accepted',
        paymentStatus: 'unpaid',
        paymentMethod: 'Cash',
        items,
        originalSubtotal: subtotal,
        addOnSubtotal: 0,
        tax,
        total,
        createdAt: newOrder.createdAt,
        isWalkIn: true,
        sentToKitchen: true,
        isTableQr: true,
      }),
    }).catch(() => { });

    return newOrder;
  };

  // Rider Actions
  const updateRiderAvailability = (status: 'available' | 'busy' | 'offline', riderId?: string) => {
    const targetId = riderId || currentUser?.id;
    setRiderAvailability(status);

    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetId || (u.role === 'delivery_staff' && !riderId)
          ? { ...u, riderAvailability: status }
          : u
      )
    );

    if (staffUser && staffUser.role === 'delivery_staff') {
      const updatedStaff: MobileUser = { ...staffUser, riderAvailability: status };
      setStaffUserState(updatedStaff);
      AsyncStorage.setItem('foodies_staff_user', JSON.stringify(updatedStaff)).catch(() => { });
    }

    const label =
      status === 'busy'
        ? '🟠 Going for Delivery (Busy)'
        : status === 'available'
          ? '🟢 Online (Ready)'
          : '⚫ Offline (Off Duty)';
    showToast(`Rider duty status: ${label}`, status === 'busy' ? 'warning' : 'info');

    if (targetId) {
      apiFetch('/api/users', {
        method: 'PATCH',
        body: JSON.stringify({ id: targetId, riderAvailability: status }),
      }).catch(() => { });
    }
  };

  const departRider = (riderId?: string) => {
    const targetId = riderId || currentUser?.id;
    const activeAssigned = orders.filter(
      (o) =>
        o.type === 'delivery' &&
        o.status !== 'completed' &&
        o.status !== 'delivered' &&
        o.status !== 'cancelled' &&
        (!targetId || !o.assignedRiderId || o.assignedRiderId === targetId)
    );

    if (activeAssigned.length === 0) {
      showToast('No active assigned orders to depart with', 'warning');
      return;
    }

    const orderIds = activeAssigned.map((o) => o.id);

    // 1. Mark orders as out_for_delivery
    setOrders((prev) =>
      prev.map((o) => {
        if (orderIds.includes(o.id)) {
          return {
            ...o,
            status: 'out_for_delivery' as OrderStatus,
            riderStatus: 'en_route',
            dispatchedAt: new Date().toISOString(),
          };
        }
        return o;
      })
    );

    // 2. Set rider availability to busy (Going for Delivery)
    updateRiderAvailability('busy', targetId);

    // 3. Persist order statuses
    orderIds.forEach((id) => {
      inFlightOrdersRef.current.set(id, {
        status: 'out_for_delivery',
        riderStatus: 'en_route',
        timestamp: Date.now(),
      });
      apiFetch('/api/orders', {
        method: 'PATCH',
        body: JSON.stringify({
          orderId: id,
          status: 'out_for_delivery',
          riderStatus: 'en_route',
          actorRole: 'delivery_staff',
          actorId: currentUser?.id,
          actorName: currentUser?.name || 'Rider',
        }),
      }).catch(() => { });
    });

    showToast(`Departed for delivery! Marked Busy — no new orders will be assigned 🛵`, 'success');
  };

  const toggleRiderDuty = () => {
    const nextStatus: 'available' | 'offline' = riderAvailability === 'available' ? 'offline' : 'available';
    updateRiderAvailability(nextStatus);
  };

  const markDeliveryCompleted = (orderId: string, cashCollected: boolean) => {
    let allDeliveriesFinished = false;

    // Register in-flight to prevent polling from reverting to unpaid/older status
    inFlightOrdersRef.current.set(orderId, {
      status: 'completed',
      riderStatus: 'delivered',
      paymentStatus: 'paid',
      paymentCollected: true,
      timestamp: Date.now(),
    });

    setOrders((prev) => {
      const next = prev.map((o) =>
        o.id === orderId || o.orderNumber === orderId
          ? {
            ...o,
            status: 'completed' as OrderStatus,
            riderStatus: 'delivered' as const,
            completedAt: new Date().toISOString(),
            deliveredAt: new Date().toISOString(),
            paymentStatus: 'paid' as const,
            paymentCollected: true,
          }
          : o
      );
      AsyncStorage.setItem('@foodies_orders_permanent_store', JSON.stringify(next)).catch(() => { });

      const remainingActive = next.filter(
        (o) =>
          o.type === 'delivery' &&
          o.assignedRiderId === currentUser?.id &&
          o.status !== 'completed' &&
          o.status !== 'delivered' &&
          o.status !== 'cancelled'
      );
      allDeliveriesFinished = remainingActive.length === 0;

      return next;
    });

    // If rider finished all assigned delivery trips, automatically return to Available (Online / Ready)
    if (allDeliveriesFinished) {
      updateRiderAvailability('available', currentUser?.id);
    }

    showToast(
      cashCollected ? 'Delivery completed & cash collected ✓' : 'Delivery completed ✓',
      'success'
    );
    const delOrd = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (delOrd) {
      pushOrderNotification(delOrd, {
        id: `notif-delivered-${delOrd.id}-${Date.now()}`,
        title: `Order #${delOrd.orderNumber} Delivered ✓`,
        message: cashCollected
          ? `Order #${delOrd.orderNumber} delivered and Rs. ${delOrd.total} collected.`
          : `Order #${delOrd.orderNumber} has been delivered cleanly.`,
        type: 'success',
        targetRoles: ['customer', 'branch_manager', 'cashier', 'platform_owner'],
        eventKey: 'orderCompleted',
      });
    }

    // Sync to Web Backend & PostgreSQL with delivery_staff role and complete delivered attributes
    apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({
        orderId,
        status: 'completed',
        riderStatus: 'delivered',
        paymentStatus: 'paid',
        paymentCollected: true,
        deliveredAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        actorRole: 'delivery_staff',
        actorId: currentUser?.id,
        actorName: currentUser?.name || 'Rider',
      }),
    }).catch(() => { });
  };

  const calculateDistanceKm = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return Math.round(d * 10) / 10;
  }, []);

  const addSavedAddress = useCallback(
    (addr: Omit<SavedDeliveryAddress, 'id'>): SavedDeliveryAddress => {
      const newId = `addr-${Date.now()}`;
      const newAddressItem: SavedDeliveryAddress = {
        ...addr,
        id: newId,
      };
      setSavedAddresses((prev) => {
        const next = [newAddressItem, ...prev];
        AsyncStorage.setItem('@foodies_saved_addresses', JSON.stringify(next)).catch(() => { });
        return next;
      });
      setSelectedDeliveryAddress(newAddressItem.address);
      if (newAddressItem.coordinates) {
        setCustomerCoordinates(newAddressItem.coordinates);
      }
      if (customerUser) {
        const updatedCust: MobileUser = {
          ...customerUser,
          address: newAddressItem.address,
          savedAddresses: [newAddressItem, ...(customerUser.savedAddresses || []).filter((a) => a.id !== newId)],
        };
        setCustomerUserState(updatedCust);
        AsyncStorage.setItem('foodies_customer_user', JSON.stringify(updatedCust)).catch(() => { });
      }
      return newAddressItem;
    },
    [customerUser, setCustomerCoordinates, setSelectedDeliveryAddress]
  );

  const deleteSavedAddress = useCallback(
    (id: string) => {
      setSavedAddresses((prev) => {
        const next = prev.filter((a) => a.id !== id);
        AsyncStorage.setItem('@foodies_saved_addresses', JSON.stringify(next)).catch(() => { });
        return next;
      });
      if (customerUser && customerUser.savedAddresses) {
        const updatedCust: MobileUser = {
          ...customerUser,
          savedAddresses: customerUser.savedAddresses.filter((a) => a.id !== id),
        };
        setCustomerUserState(updatedCust);
        AsyncStorage.setItem('foodies_customer_user', JSON.stringify(updatedCust)).catch(() => { });
      }
    },
    [customerUser]
  );

  const detectAndStoreCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let coords = customerCoordinates;
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coords = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        };
      }
      setCustomerCoordinates(coords);
      const geo = await reverseGeocodeOpenStreetMap(coords.lat, coords.lng);
      setSelectedDeliveryAddress(geo.address);
      return { coords, address: geo.address, city: geo.city };
    } catch {
      return null;
    }
  }, [customerCoordinates, setCustomerCoordinates, setSelectedDeliveryAddress]);

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        appMode,
        setAppMode,

        staffUser,
        staffLoginCounter,
        loginStaff,
        logoutStaff,

        customerUser,
        customerLoginCounter,
        isCustomerLoggedIn: Boolean(
          customerUser &&
          customerUser.name &&
          customerUser.name !== 'Guest Customer' &&
          customerUser.id !== 'user-guest' &&
          customerUser.id !== 'cust-guest' &&
          customerUser.id !== 'guest'
        ),
        loginCustomer,
        logoutCustomer,

        currentUser,
        setCurrentUser: (u) => {
          if (appMode === 'customer') {
            loginCustomer(u);
          } else {
            loginStaff(u);
          }
        },
        updateCurrentUser,

        currentBranch,
        setBranchId,
        hasSelectedBranch,
        setHasSelectedBranch,
        branches,
        menuItems,
        categories,
        tables,
        orders,
        auditLogs,
        refreshData,

        cart,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        cartCount,
        cartSubtotal,

        flyingItem,
        triggerFlyToCart,
        dismissFlyingItem,

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

        orderType,
        setOrderType,

        customerCoordinates,
        setCustomerCoordinates,
        placeOrder,
        cancelOrder,
        updateOrderStatus,
        updateOrderPayment,
        editOrderStage1,

        hasLoadedOlderOrders,
        isFetchingOlderOrders,
        fetchOlderOrders,
        filterOrdersToToday,

        users,
        createUser,
        updateUser,
        deleteUser,

        createMenuItem,
        deleteMenuItem,
        toggleMenuItemBranchAvailability,
        updateMenuItemBranchPrice,
        addCategory,
        renameCategory,
        deleteCategory,
        importSheetCatalog,

        refunds,
        requestRefund,
        approveRefund,
        rejectRefund,
        shifts,
        openShift,
        closeShift,
        updateShiftOpeningBalance,

        createBranch,

        updateMenuItemStock,
        updateMenuItemPrice,
        updateBranchSettings,
        toggleBranchStatus,
        shutdownModalState,
        closeShutdownModal,
        confirmShutdownKeepProcessing,
        confirmShutdownCancelOrders,

        addTable,
        deleteTable,
        updateTableStatus,
        updateTable,
        markTableFree,
        generateTableQr,
        toggleTableQrAllowReserved,
        assignWaiterToOrder,
        assignRiderToOrder,
        unassignRiderFromOrder,
        acceptRiderOrder,
        markOrderDeliveredToTable,
        markOrderDoneAndCollected,
        generateTablePin,
        placeFloorWalkInOrder,

        riderAvailability,
        toggleRiderDuty,
        updateRiderAvailability,
        departRider,
        markDeliveryCompleted,

        toast,
        showToast,
        headerHeight,
        setHeaderHeight,

        branchUnavailableModal,
        setBranchUnavailableModal,
        closeBranchUnavailableModal,

        savedAddresses,
        addSavedAddress,
        deleteSavedAddress,
        selectedDeliveryAddress,
        setSelectedDeliveryAddress,
        detectAndStoreCurrentLocation,
        hasConfirmedOrderType,
        setHasConfirmedOrderType,
        calculateDistanceKm,
        isBottomSheetOpen,
        setBottomSheetOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
