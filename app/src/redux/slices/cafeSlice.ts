import { createSlice, PayloadAction, createSelector } from '@reduxjs/toolkit';
import {
  Branch,
  MenuItem,
  Table,
  TableStatus,
  TableSession,
  CashShift,
  RefundRequest,
  AuditLog,
  HeroBanner,
  DealCard,
  FooterSettings,
  User,
  ManagerAccessRequest,
  BranchPaymentSettings,
  Announcement,
  AppNotification,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '@/types/cafe';
import { INITIAL_MENU, INITIAL_CATEGORIES } from '@/database/embeddedSeed';

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
    paymentSettings: {
      dine_in: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
      takeaway: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
      delivery: { COD: true, Wallet: true, Card: true, Bank: true, Installment: true },
    },
  },
];

const INITIAL_TABLES: Table[] = [
  { id: 't1', number: 'T-01', branchId: 'gulberg-lahore', floor: 'Ground Floor (Main Dining)', capacity: 2, chairs: 2, status: 'available', pin: '4921' },
  { id: 't2', number: 'T-02', branchId: 'gulberg-lahore', floor: 'Ground Floor (Main Dining)', capacity: 4, chairs: 4, status: 'available', pin: '7182' },
  { id: 't3', number: 'T-03', branchId: 'gulberg-lahore', floor: 'Ground Floor (Main Dining)', capacity: 4, chairs: 4, status: 'available', pin: '3941' },
  { id: 't4', number: 'T-04', branchId: 'gulberg-lahore', floor: 'Ground Floor (Main Dining)', capacity: 6, chairs: 6, status: 'available', pin: '8812' },
  { id: 't5', number: 'T-05', branchId: 'gulberg-lahore', floor: '1st Floor (Family Hall)', capacity: 4, chairs: 4, status: 'available', pin: '1092' },
  { id: 't6', number: 'T-06', branchId: 'gulberg-lahore', floor: '1st Floor (Family Hall)', capacity: 8, chairs: 8, status: 'available', pin: '6523' },
  { id: 't7', number: 'T-07', branchId: 'gulberg-lahore', floor: 'Rooftop Terrace (Open Air)', capacity: 4, chairs: 4, status: 'available', pin: '9901' },
  { id: 't8', number: 'T-08', branchId: 'gulberg-lahore', floor: 'Rooftop Terrace (Open Air)', capacity: 2, chairs: 2, status: 'available', pin: '2311' },
  { id: 't9', number: 'T-01', branchId: 'f7-islamabad', floor: 'Ground Floor (Main Dining)', capacity: 4, chairs: 4, status: 'available', pin: '3312' },
  { id: 't10', number: 'T-02', branchId: 'f7-islamabad', floor: 'Ground Floor (Main Dining)', capacity: 6, chairs: 6, status: 'available', pin: '4419' },
  { id: 't11', number: 'T-03', branchId: 'f7-islamabad', floor: '1st Floor (Family Hall)', capacity: 4, chairs: 4, status: 'available', pin: '5521' },
  { id: 't12', number: 'T-01', branchId: 'clifton-karachi', floor: 'Ground Floor (Main Dining)', capacity: 4, chairs: 4, status: 'available', pin: '6618' },
  { id: 't13', number: 'T-02', branchId: 'clifton-karachi', floor: 'Rooftop Terrace (Open Air)', capacity: 6, chairs: 6, status: 'available', pin: '7729' },
];

const INITIAL_USERS: User[] = [
  { id: 'user-cust', name: 'Zeeshan Ahmed', phone: '+92 301 5551234', email: 'zeeshan@example.com', address: 'House 14, Street 9, Model Town, Lahore', role: 'customer', status: 'active', noShowCount: 0, password: 'password123', pin: '1234' },
  { id: 'user-owner', name: 'Malik Jahangir', phone: '+92 300 0000001', email: 'owner@foodiescafe.pk', role: 'platform_owner', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-bm', name: 'Rashid Mehmood', phone: '+92 300 2223344', email: 'manager.gulberg@foodiescafe.pk', role: 'branch_manager', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-kitchen', name: 'Chef Ustaad Aslam', phone: '+92 300 6667788', email: 'kitchen.gulberg@foodiescafe.pk', role: 'kitchen_staff', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-cashier', name: 'Bilal Farooq', phone: '+92 300 8889900', email: 'cashier.gulberg@foodiescafe.pk', role: 'cashier', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-floor', name: 'Kashif Ali', phone: '+92 300 1112233', email: 'floor.gulberg@foodiescafe.pk', role: 'floor_staff', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-rider-1', name: 'Tariq Mehmood (Rider)', phone: '+92 301 9991122', email: 'rider1.gulberg@foodiescafe.pk', role: 'delivery_staff', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234', riderAvailability: 'available', riderTotalDeliveries: 0 },
  { id: 'user-rider-2', name: 'Usman Ghani (Rider)', phone: '+92 302 8882233', email: 'rider2.gulberg@foodiescafe.pk', role: 'delivery_staff', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234', riderAvailability: 'available', riderTotalDeliveries: 0 },
  { id: 'user-bm-isb', name: 'Noman Bashir', phone: '+92 300 3334455', email: 'manager.islamabad@foodiescafe.pk', role: 'branch_manager', branchId: 'f7-islamabad', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-cashier-isb', name: 'Hamza Tariq', phone: '+92 300 3338899', email: 'cashier.islamabad@foodiescafe.pk', role: 'cashier', branchId: 'f7-islamabad', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-kitchen-isb', name: 'Chef Imran Khan', phone: '+92 300 3337766', email: 'kitchen.islamabad@foodiescafe.pk', role: 'kitchen_staff', branchId: 'f7-islamabad', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-floor-isb', name: 'Fahad Mustafa', phone: '+92 300 3336655', email: 'floor.islamabad@foodiescafe.pk', role: 'floor_staff', branchId: 'f7-islamabad', status: 'active', password: 'password123', pin: '1234' },
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

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Midnight Biryani & Karahi Feast: Flat 20% Off',
    tag: 'HOT DEAL',
    description: 'Enjoy 20% off all Mutton & Chicken Karahi orders between 10:00 PM and 2:00 AM across all branches.',
    validUntil: 'Tonight 02:00 AM',
    discountPercent: 20,
    badgeColor: '#EF4444',
  },
  {
    id: 'ann-2',
    title: 'Gulberg Rooftop Terrace Live BBQ Night',
    tag: 'BRANCH SPECIAL',
    description: 'Join us on the Gulberg Rooftop for live open-flame charcoal Seekh Kababs & Mutton Chops every Friday & Saturday.',
    branchId: 'gulberg-lahore',
    branchName: 'Gulberg Lahore',
    validUntil: 'Every Weekend',
    badgeColor: '#F59E0B',
  },
  {
    id: 'ann-3',
    title: 'Free Delivery on Doorstep Orders above Rs. 1500',
    tag: 'ANNOUNCEMENT',
    description: 'Zero delivery fee on all online delivery orders exceeding Rs. 1500 via the mobile app.',
    validUntil: 'Valid this Month',
    badgeColor: '#10B981',
  },
];

export interface CafeState {
  branches: Branch[];
  currentBranchId: string;
  menuItems: MenuItem[];
  categories: string[];
  tables: Table[];
  tableSessions: TableSession[];
  shifts: CashShift[];
  refundRequests: RefundRequest[];
  auditLogs: AuditLog[];
  heroBanners: HeroBanner[];
  dealCard: DealCard;
  footerSettings: FooterSettings;
  users: User[];
  announcements: Announcement[];
  managerAccessRequests: Record<string, ManagerAccessRequest>;
  notifications: AppNotification[];
  notificationSettings: NotificationSettings;
  floors: string[];
  activeTableSession: { tableId: string; tableNumber: string; branchId: string; seatedAt: string; orderId?: string } | null;
  customerCoordinates: { lat: number; lng: number } | null;
  allowRepresentativeMenuEdit: boolean;
  allowRepresentativeDirectPublish: boolean;
  lastFastSynced: string | null;
  lastFullSynced: string | null;
}

const getInitialBranchId = (): string => {
  if (typeof window === 'undefined') return 'gulberg-lahore';
  return (
    localStorage.getItem('foodies_customer_manual_branch') ||
    localStorage.getItem('foodies_customer_selected_branch') ||
    'gulberg-lahore'
  );
};

const initialState: CafeState = {
  branches: INITIAL_BRANCHES,
  currentBranchId: getInitialBranchId(),
  menuItems: INITIAL_MENU,
  categories: INITIAL_CATEGORIES,
  tables: INITIAL_TABLES,
  tableSessions: [],
  shifts: [DEFAULT_OPEN_SHIFT],
  refundRequests: [],
  auditLogs: [],
  heroBanners: INITIAL_HERO_BANNERS,
  dealCard: INITIAL_DEAL_CARD,
  footerSettings: INITIAL_FOOTER_SETTINGS,
  users: INITIAL_USERS,
  announcements: INITIAL_ANNOUNCEMENTS,
  managerAccessRequests: {},
  notifications: [
    {
      id: 'notif-seed-1',
      title: 'Welcome to Foodies Cafe Live Alerts',
      message: 'Real-time order updates for Dine-In, Takeaway Pickup & Doorstep Delivery are active.',
      type: 'success',
      category: 'system',
      branchId: 'all',
      senderId: 'user-owner',
      senderName: 'Malik Jahangir',
      senderRole: 'platform_owner',
      targetRoles: ['all'],
      readBy: [],
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-seed-2',
      title: 'Takeaway Express Counter Open',
      message: 'Place a Takeaway order via Web or Mobile and receive an instant pickup notification as soon as it is packed.',
      type: 'info',
      category: 'takeaway',
      branchId: 'gulberg-lahore',
      senderId: 'user-cashier',
      senderName: 'Bilal Farooq',
      senderRole: 'cashier',
      targetRoles: ['customer', 'cashier', 'branch_manager'],
      readBy: [],
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    {
      id: 'notif-seed-3',
      title: 'Rush Hour Kitchen Coordination Active',
      message: 'Cashier, Kitchen, Waiters & Delivery Riders receive automatic alerts when orders are placed or updated.',
      type: 'warning',
      category: 'staff_alert',
      branchId: 'all',
      senderId: 'user-bm',
      senderName: 'Rashid Mehmood',
      senderRole: 'branch_manager',
      targetRoles: ['branch_manager', 'cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff', 'platform_owner'],
      readBy: [],
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
  ],
  notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
  floors: ['Ground Floor (Main Dining)', '1st Floor (Family Hall)', 'Rooftop Terrace (Open Air)'],
  activeTableSession: null,
  customerCoordinates: null,
  allowRepresentativeMenuEdit: true,
  allowRepresentativeDirectPublish: false,
  lastFastSynced: null,
  lastFullSynced: null,
};

export function mergeReadBy(n: AppNotification, extraReadBy?: string[]): AppNotification {
  if (!extraReadBy || extraReadBy.length === 0) return n;
  const merged = Array.from(new Set([...(n.readBy || []), ...extraReadBy]));
  return merged.length === (n.readBy || []).length ? n : { ...n, readBy: merged };
}

const cafeSlice = createSlice({
  name: 'cafe',
  initialState,
  reducers: {
    setBranches: (state, action: PayloadAction<Branch[]>) => {
      state.branches = action.payload;
    },
    setCurrentBranchId: (state, action: PayloadAction<string>) => {
      state.currentBranchId = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('foodies_customer_selected_branch', action.payload);
        localStorage.setItem('foodies_customer_manual_branch', action.payload);
      }
    },
    updateBranchSettingsInStore: (
      state,
      action: PayloadAction<{ branchId: string; settings: Partial<Branch> }>
    ) => {
      const { branchId, settings } = action.payload;
      const idx = state.branches.findIndex((b) => b.id === branchId);
      if (idx >= 0) {
        state.branches[idx] = { ...state.branches[idx], ...settings };
      }
    },
    setMenuItems: (state, action: PayloadAction<MenuItem[]>) => {
      state.menuItems = action.payload;
    },
    upsertMenuItemInStore: (state, action: PayloadAction<MenuItem>) => {
      const item = action.payload;
      const idx = state.menuItems.findIndex((m) => m.id === item.id);
      if (idx >= 0) {
        state.menuItems[idx] = item;
      } else {
        state.menuItems.push(item);
      }
    },
    deleteMenuItemFromStore: (state, action: PayloadAction<string>) => {
      state.menuItems = state.menuItems.filter((m) => m.id !== action.payload);
    },
    toggleMenuItemBranchAvailabilityInStore: (
      state,
      action: PayloadAction<{ itemId: string; branchId: string }>
    ) => {
      const { itemId, branchId } = action.payload;
      const item = state.menuItems.find((m) => m.id === itemId);
      if (item) {
        const cur = item.branchAvailability?.[branchId] ?? item.isAvailable;
        item.branchAvailability = { ...item.branchAvailability, [branchId]: !cur };
      }
    },
    updateMenuItemPriceInStore: (
      state,
      action: PayloadAction<{
        itemId: string;
        newBasePrice: number;
        branchOverride?: { branchId: string; price: number };
      }>
    ) => {
      const { itemId, newBasePrice, branchOverride } = action.payload;
      const item = state.menuItems.find((m) => m.id === itemId);
      if (item) {
        item.basePrice = newBasePrice;
        if (branchOverride) {
          item.branchPriceOverrides = {
            ...item.branchPriceOverrides,
            [branchOverride.branchId]: branchOverride.price,
          };
        }
      }
    },
    setCategories: (state, action: PayloadAction<string[]>) => {
      state.categories = action.payload;
    },
    setTables: (state, action: PayloadAction<Table[]>) => {
      state.tables = action.payload;
    },
    updateTableStatusInStore: (
      state,
      action: PayloadAction<{
        tableId: string;
        status: TableStatus;
        reservationName?: string;
        customMessage?: string;
      }>
    ) => {
      const { tableId, status, reservationName } = action.payload;
      const t = state.tables.find((tbl) => tbl.id === tableId || tbl.number === tableId);
      if (t) {
        t.status = status;
        if (reservationName) t.reservedFor = reservationName;
        if (status === 'available') {
          t.currentOrderId = undefined;
          t.reservedFor = undefined;
        }
      }
    },
    setTableSessions: (state, action: PayloadAction<TableSession[]>) => {
      state.tableSessions = action.payload;
    },
    setShifts: (state, action: PayloadAction<CashShift[]>) => {
      state.shifts = action.payload;
    },
    setRefundRequests: (state, action: PayloadAction<RefundRequest[]>) => {
      state.refundRequests = action.payload;
    },
    setAuditLogs: (state, action: PayloadAction<AuditLog[]>) => {
      state.auditLogs = action.payload;
    },
    addAuditLogInStore: (state, action: PayloadAction<AuditLog>) => {
      state.auditLogs.unshift(action.payload);
    },
    setHeroBanners: (state, action: PayloadAction<HeroBanner[]>) => {
      state.heroBanners = action.payload;
    },
    setDealCard: (state, action: PayloadAction<DealCard>) => {
      state.dealCard = action.payload;
    },
    setFooterSettings: (state, action: PayloadAction<FooterSettings>) => {
      state.footerSettings = action.payload;
    },
    setUsers: (state, action: PayloadAction<User[]>) => {
      state.users = action.payload;
    },
    updateUserInStore: (state, action: PayloadAction<User>) => {
      const idx = state.users.findIndex((u) => u.id === action.payload.id);
      if (idx >= 0) {
        state.users[idx] = action.payload;
      } else {
        state.users.push(action.payload);
      }
    },
    deleteUserFromStore: (state, action: PayloadAction<string>) => {
      state.users = state.users.filter((u) => u.id !== action.payload);
    },
    setActiveTableSession: (
      state,
      action: PayloadAction<{ tableId: string; tableNumber: string; branchId: string; seatedAt: string; orderId?: string } | null>
    ) => {
      state.activeTableSession = action.payload;
    },
    setCustomerCoordinates: (state, action: PayloadAction<{ lat: number; lng: number } | null>) => {
      state.customerCoordinates = action.payload;
    },
    setAllowRepresentativeMenuEdit: (state, action: PayloadAction<boolean>) => {
      state.allowRepresentativeMenuEdit = action.payload;
    },
    setAllowRepresentativeDirectPublish: (state, action: PayloadAction<boolean>) => {
      state.allowRepresentativeDirectPublish = action.payload;
    },
    setManagerAccessRequests: (state, action: PayloadAction<Record<string, ManagerAccessRequest>>) => {
      state.managerAccessRequests = action.payload;
    },
    setAnnouncements: (state, action: PayloadAction<Announcement[]>) => {
      state.announcements = action.payload;
    },
    addAnnouncementInStore: (state, action: PayloadAction<Announcement>) => {
      state.announcements = [action.payload, ...state.announcements.filter((a) => a.id !== action.payload.id)];
    },
    deleteAnnouncementFromStore: (state, action: PayloadAction<string>) => {
      state.announcements = state.announcements.filter((a) => a.id !== action.payload);
    },
    setNotifications: (state, action: PayloadAction<AppNotification[]>) => {
      // Union read marks: a sync that started before "mark as read" reached the server must not
      // flip already-read notifications back to unread.
      const localReadBy = new Map(state.notifications.map((n) => [n.id, n.readBy || []]));
      state.notifications = action.payload.map((n) => mergeReadBy(n, localReadBy.get(n.id)));
    },
    addNotificationInStore: (state, action: PayloadAction<AppNotification>) => {
      const existing = state.notifications.find((n) => n.id === action.payload.id);
      state.notifications = [
        mergeReadBy(action.payload, existing?.readBy),
        ...state.notifications.filter((n) => n.id !== action.payload.id),
      ].slice(0, 150);
    },
    markNotificationReadInStore: (
      state,
      action: PayloadAction<{ id?: string; userId: string; markAll?: boolean }>
    ) => {
      const { id, userId, markAll } = action.payload;
      state.notifications = state.notifications.map((n) => {
        if (markAll || n.id === id) {
          if (!n.readBy.includes(userId)) {
            return { ...n, readBy: [...n.readBy, userId] };
          }
        }
        return n;
      });
    },
    removeNotificationFromStore: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },
    clearNotificationsInStore: (state) => {
      state.notifications = [];
    },
    setNotificationSettings: (state, action: PayloadAction<NotificationSettings>) => {
      state.notificationSettings = action.payload;
    },
    setSyncTimestamps: (state, action: PayloadAction<{ fast?: boolean; full?: boolean }>) => {
      const now = new Date().toISOString();
      if (action.payload.fast) state.lastFastSynced = now;
      if (action.payload.full) state.lastFullSynced = now;
    },
  },
});

export const {
  setBranches,
  setCurrentBranchId,
  updateBranchSettingsInStore,
  setMenuItems,
  upsertMenuItemInStore,
  deleteMenuItemFromStore,
  toggleMenuItemBranchAvailabilityInStore,
  updateMenuItemPriceInStore,
  setCategories,
  setTables,
  updateTableStatusInStore,
  setTableSessions,
  setShifts,
  setRefundRequests,
  setAuditLogs,
  addAuditLogInStore,
  setHeroBanners,
  setDealCard,
  setFooterSettings,
  setUsers,
  updateUserInStore,
  deleteUserFromStore,
  setActiveTableSession,
  setCustomerCoordinates,
  setAllowRepresentativeMenuEdit,
  setAllowRepresentativeDirectPublish,
  setManagerAccessRequests,
  setSyncTimestamps,
  setAnnouncements,
  addAnnouncementInStore,
  deleteAnnouncementFromStore,
  setNotifications,
  addNotificationInStore,
  markNotificationReadInStore,
  removeNotificationFromStore,
  clearNotificationsInStore,
  setNotificationSettings,
} = cafeSlice.actions;

// Selectors
export const selectBranches = (state: { cafe: CafeState }) => state.cafe.branches;
export const selectCurrentBranchId = (state: { cafe: CafeState }) => state.cafe.currentBranchId;
export const selectCurrentBranch = createSelector(
  [selectBranches, selectCurrentBranchId],
  (branches, branchId) => branches.find((b) => b.id === branchId) || branches[0]
);
export const selectMenuItems = (state: { cafe: CafeState }) => state.cafe.menuItems;
export const selectCategories = (state: { cafe: CafeState }) => state.cafe.categories;
export const selectTables = (state: { cafe: CafeState }) => state.cafe.tables;
export const selectBranchTables = (branchId: string) =>
  createSelector([selectTables], (tables) => tables.filter((t) => t.branchId === branchId));
export const selectShifts = (state: { cafe: CafeState }) => state.cafe.shifts;
export const selectCurrentShift = (branchId?: string) =>
  createSelector([selectShifts], (shifts) => {
    return (
      shifts.find((s) => s.status === 'open' && (!branchId || s.branchId === branchId)) ||
      shifts[0] ||
      null
    );
  });
export const selectRefundRequests = (state: { cafe: CafeState }) => state.cafe.refundRequests;
export const selectHeroBanners = (state: { cafe: CafeState }) => state.cafe.heroBanners;
export const selectDealCard = (state: { cafe: CafeState }) => state.cafe.dealCard;
export const selectFooterSettings = (state: { cafe: CafeState }) => state.cafe.footerSettings;
export const selectUsers = (state: { cafe: CafeState }) => state.cafe.users;
export const selectAuditLogs = (state: { cafe: CafeState }) => state.cafe.auditLogs;
export const selectTableSessions = (state: { cafe: CafeState }) => state.cafe.tableSessions;
export const selectActiveTableSession = (state: { cafe: CafeState }) => state.cafe.activeTableSession;
export const selectCustomerCoordinates = (state: { cafe: CafeState }) => state.cafe.customerCoordinates;
export const selectAnnouncements = (state: { cafe: CafeState }) => state.cafe.announcements;
export const selectNotifications = (state: { cafe: CafeState }) => state.cafe.notifications;
export const selectNotificationSettings = (state: { cafe: CafeState }) => state.cafe.notificationSettings;

export default cafeSlice.reducer;
