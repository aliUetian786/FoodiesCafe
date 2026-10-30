'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  Complaint,
  ComplaintMessage,
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
} from '@/types/cafe';

import { store } from '@/redux/store';
import {
  setOrders as setReduxOrders,
  upsertOrder as upsertReduxOrder,
  updateOrderStatusInStore as updateReduxOrderStatus,
  filterOrdersToToday as filterReduxOrdersToToday,
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
  setComplaints as setReduxComplaints,
  setTableSessions as setReduxTableSessions,
  setUsers as setReduxUsers,
  setHeroBanners as setReduxHeroBanners,
  setDealCard as setReduxDealCard,
  setFooterSettings as setReduxFooterSettings,
  updateTableStatusInStore as updateReduxTableStatus,
} from '@/redux/slices/cafeSlice';
import {
  setCurrentRole as setReduxRole,
  setCurrentUser as setReduxUser,
  addToast as addReduxToast,
  removeToast as removeReduxToast,
  setMenuSearchQuery as setReduxSearchQuery,
} from '@/redux/slices/uiSlice';
import { runSync, broadcastStateMutation } from '@/redux/sync/syncEngine';

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

interface AppContextType {
  theme: 'light';
  toggleTheme: () => void;
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  currentBranchId: string;
  setCurrentBranchId: (id: string) => void;
  currentBranch: Branch;
  branches: Branch[];
  menuItems: MenuItem[];
  orders: Order[];
  tables: Table[];
  tableSessions: TableSession[];
  complaints: Complaint[];
  shifts: CashShift[];
  refundRequests: RefundRequest[];
  auditLogs: AuditLog[];
  cart: OrderItem[];
  menuSearchQuery: string;
  setMenuSearchQuery: (query: string) => void;
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  
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
      notes?: string;
      customerCoordinates?: { lat: number; lng: number };
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
  recordCashPayment: (orderId: string, amountReceived: number, silent?: boolean) => { change: number; success: boolean };
  editOrderStage1: (orderId: string, updatedItems: OrderItem[]) => void;
  addAddOnsToOrderStage2: (orderId: string, addOnItems: OrderItem[]) => void;
  cancelOrder: (orderId: string, reason: string) => void;

  // Delivery & Rider Actions
  assignRiderToOrder: (orderId: string, riderId: string, silent?: boolean) => void;
  unassignRiderFromOrder: (orderId: string) => void;
  finishRiderDelivery: (orderId: string, paymentCollected?: boolean) => void;
  updateRiderAvailability: (riderId: string, status: 'available' | 'busy' | 'offline') => void;
  departRider: (riderId: string) => void;
  customerCoordinates: { lat: number; lng: number } | null;
  setCustomerCoordinates: (coords: { lat: number; lng: number } | null) => void;
  
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
  
  // Branch & Settings Actions
  updateBranchSettings: (branchId: string, settings: Partial<Branch>) => void;
  updateBranchPaymentSettings: (branchId: string, settings: BranchPaymentSettings) => void;
  
  // Support & Complaints Actions
  submitComplaint: (subject: string, message: string, orderId?: string) => void;
  sendComplaintReply: (complaintId: string, text: string) => void;
  updateComplaintStatus: (complaintId: string, status: 'new' | 'in_progress' | 'resolved' | 'closed') => void;
  
  // Cashier Shifts
  openShift: (openingFloat: number) => void;
  closeShift: (countedCash: number, differenceReason: string) => void;
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
  fetchOlderOrders: (branchId?: string, dateScope?: string) => Promise<void>;
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

const INITIAL_MENU: MenuItem[] = [
  {
    id: 'm1',
    name: 'Royal Chicken Dum Biryani',
    category: 'Biryani & Rice',
    description: 'Fragrant long-grain basmati cooked with saffron, marinated chicken, caramelised onions & secret house spices in a sealed copper handi.',
    basePrice: 650,
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Regular (Single)', priceDelta: 0 },
      { name: 'Jumbo (Double)', priceDelta: 350 },
    ],
    extras: [
      { name: 'Extra Zeera Raita', price: 60 },
      { name: 'Fresh Kachumber Salad', price: 70 },
      { name: 'Extra Boiled Egg', price: 50 },
    ],
  },
  {
    id: 'm2',
    name: 'Desi Ghee Shinwari Chicken Karahi',
    category: 'Karahi & Handi',
    description: 'Fresh country chicken wok-tossed in pure organic desi ghee, ripe tomatoes, coarse crushed black pepper and ginger juliennes.',
    basePrice: 1250,
    image: '/hero-bg.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Half (serves 2)', priceDelta: 0 },
      { name: 'Full (serves 4)', priceDelta: 1100 },
    ],
    extras: [
      { name: 'Roghni Naan', price: 80 },
      { name: 'Garlic Butter Naan', price: 110 },
      { name: 'Mint Chutney', price: 50 },
    ],
  },
  {
    id: 'm3',
    name: 'Smoky Beef Seekh Kebabs (4 Pcs)',
    category: 'BBQ & Kebabs',
    description: 'Melt-in-mouth prime beef mince seasoned with roasted cumin, brown onion paste, coriander seeds and charcoal grilled over hot embers.',
    basePrice: 780,
    image: '/hero-bg.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': false, 'clifton-karachi': true },
    sizes: [
      { name: 'Standard (4 pcs)', priceDelta: 0 },
      { name: 'Platter (8 pcs)', priceDelta: 680 },
    ],
    extras: [
      { name: 'Tandoori Paratha', price: 90 },
      { name: 'Mint Coriander Dip', price: 40 },
    ],
  },
  {
    id: 'm4',
    name: 'The Foodies Crunch Burger',
    category: 'Burgers & Fast Food',
    description: 'Crispy fried buttermilk chicken fillet tossed in spicy glaze, topped with cheddar cheese, tangy coleslaw, garlic aioli on a toasted brioche.',
    basePrice: 620,
    image: '/hero-bg.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
    sizes: [
      { name: 'Single Fillet', priceDelta: 0 },
      { name: 'Double Monster Fillet', priceDelta: 280 },
    ],
    extras: [
      { name: 'Seasoned Masala Fries', price: 160 },
      { name: 'Cheese Dip Shot', price: 90 },
    ],
  },
  {
    id: 'm5',
    name: 'Fresh Tandoori Roghni Naan',
    category: 'Breads & Sides',
    description: 'Soft leavened bread brushed with clarified butter, toasted white sesame seeds and baked against clay tandoor walls.',
    basePrice: 80,
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm6',
    name: 'Traditional Peshawari Qahwa with Cardamom',
    category: 'Beverages & Desserts',
    description: 'Brewed green tea leaves infused with green cardamom pods, cinnamon bark, served with saffron candy crystals.',
    basePrice: 120,
    image: '/food-biryani.jpg',
    isAvailable: true,
    branchAvailability: { 'gulberg-lahore': true, 'f7-islamabad': true, 'clifton-karachi': true },
  },
  {
    id: 'm7',
    name: 'Shahi Malai Kulfi on Stick',
    category: 'Beverages & Desserts',
    description: 'Dense, creamy frozen dessert made from reduced whole milk, infused with roasted pistachios, almonds, and rose essence.',
    basePrice: 220,
    image: '/food-biryani.jpg',
    isAvailable: false, // Marked unavailable to test UI graying out rule
    branchAvailability: { 'gulberg-lahore': false, 'f7-islamabad': false, 'clifton-karachi': true },
  },
];

const INITIAL_FLOORS: string[] = [
  'Ground Floor (Main Dining)',
  '1st Floor (Family Hall)',
  'Rooftop Terrace (Open Air)',
];

const INITIAL_CATEGORIES: string[] = [
  'Biryani & Rice',
  'Shinwari & Karahi',
  'Burgers & Fast Food',
  'Tandoor & Breads',
  'Beverages & Desserts',
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
  { id: 'user-rep', name: 'Zara Noor', phone: '+92 300 4445566', email: 'rep.gulberg@foodiescafe.pk', role: 'branch_representative', branchId: 'gulberg-lahore', status: 'active', password: 'password123', pin: '1234' },
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
  { id: 'user-rep-isb', name: 'Ayesha Siddiqui', phone: '+92 300 3335544', email: 'rep.islamabad@foodiescafe.pk', role: 'branch_representative', branchId: 'f7-islamabad', status: 'active', password: 'password123', pin: '1234' },
  // Karachi Staff
  { id: 'user-bm-khi', name: 'Kamran Siddiqui', phone: '+92 300 5556677', email: 'manager.karachi@foodiescafe.pk', role: 'branch_manager', branchId: 'clifton-karachi', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-cashier-khi', name: 'Saad Ali', phone: '+92 300 5558899', email: 'cashier.karachi@foodiescafe.pk', role: 'cashier', branchId: 'clifton-karachi', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-kitchen-khi', name: 'Chef Zakir Hussain', phone: '+92 300 5557766', email: 'kitchen.karachi@foodiescafe.pk', role: 'kitchen_staff', branchId: 'clifton-karachi', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-floor-khi', name: 'Rizwan Ahmed', phone: '+92 300 5556655', email: 'floor.karachi@foodiescafe.pk', role: 'floor_staff', branchId: 'clifton-karachi', status: 'active', password: 'password123', pin: '1234' },
  { id: 'user-rep-khi', name: 'Mahnoor Baloch', phone: '+92 300 5555544', email: 'rep.karachi@foodiescafe.pk', role: 'branch_representative', branchId: 'clifton-karachi', status: 'active', password: 'password123', pin: '1234' },
];

const INITIAL_COMPLAINTS: Complaint[] = [];

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

const INITIAL_SHIFTS: CashShift[] = [DEFAULT_OPEN_SHIFT];

const INITIAL_AUDIT_LOGS: AuditLog[] = [];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Pure light mode forced for all portals per user request
  const theme = 'light' as const;
  const toggleTheme = () => {};

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
          } catch (e) {}
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
        } catch (e) {}
      }

      // Check customer user if not on staff path
      try {
        const saved = localStorage.getItem('foodies_customer_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.name && parsed.name !== 'Guest Customer' && parsed.role === 'customer') {
            return parsed;
          }
        }
      } catch (e) {}
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
      } else if (currentUser && currentUser.name && currentUser.name !== 'Guest Customer') {
        // Customer: save strictly to customer key
        localStorage.setItem('foodies_customer_user', JSON.stringify(currentUser));
      } else if (currentUser && currentUser.name === 'Guest Customer') {
        localStorage.removeItem('foodies_customer_user');
      }
    } catch (e) {}
  }, [currentUser]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (currentRole && currentRole !== 'customer') {
        localStorage.setItem('foodies_staff_role', currentRole);
      }
    } catch (e) {}
  }, [currentRole]);
  const [currentBranchId, setCurrentBranchId] = useState<string>(() => {
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
  const [branches, setBranches] = useState<Branch[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_branches_live');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
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
  const [allowRepresentativeDirectPublish, setAllowRepresentativeDirectPublish] = useState<boolean>(false);
  const [pendingApprovalRequests, setPendingApprovalRequests] = useState<BannerDealApprovalRequest[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>(INITIAL_COMPLAINTS);
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
                s.id === 'sh-today-1' && (s.cashCollected === 34200 || s.openingFloat === 5000 || s.expectedCash === 5000)
                  ? { ...s, openingFloat: 0, cashCollected: 0, expectedCash: 0 }
                  : s
              );
            if (clean.length > 0) return clean;
          }
        }
      } catch (e) {}
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
      } catch (e) {}
    }
    return INITIAL_USERS;
  });
  const [cart, setCart] = useState<OrderItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_cart');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // Automatically keep cart synchronized with localStorage and Redux store
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_cart', JSON.stringify(cart));
      store.dispatch(setReduxCart(cart));
    } catch (e) {}
  }, [cart]);
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [customerCoordinates, setCustomerCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const tabIdRef = useRef<string>(typeof window !== 'undefined' ? Math.random().toString(36).substring(2, 9) : 'tab');
  const liveBroadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastToastRef = useRef<{ title: string; message: string; timestamp: number } | null>(null);

  const [managerAccessRequests, setManagerAccessRequests] = useState<Record<string, ManagerAccessRequest>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_manager_access_requests');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
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
    } catch (e) {}
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
    } catch (e) {}
  };

  const broadcastOrders = (ordersList: Order[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_orders_live', JSON.stringify(ordersList));
      store.dispatch(setReduxOrders(ordersList));
      broadcastStateMutation('SYNC_ORDERS', ordersList);
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_ORDERS',
          payload: ordersList,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) {}
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
    } catch (e) {}
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
    } catch (e) {}
  };

  const broadcastComplaints = (complaintsList: Complaint[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('foodies_complaints', JSON.stringify(complaintsList));
      store.dispatch(setReduxComplaints(complaintsList));
      broadcastStateMutation('SYNC_COMPLAINTS', complaintsList);
      if (liveBroadcastChannelRef.current) {
        liveBroadcastChannelRef.current.postMessage({
          type: 'SYNC_COMPLAINTS',
          payload: complaintsList,
          senderId: tabIdRef.current,
        });
      }
    } catch (e) {}
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
    } catch (e) {}
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
    } catch (e) {}
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
    } catch (e) {}
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
    } catch (e) {}
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
    } catch (e) {}
  };

  useEffect(() => {
    // Ensure light theme is always enforced
    document.documentElement.setAttribute('data-theme', 'light');

    if (typeof window === 'undefined') return;

    // Load persisted marketing elements on first mount
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
      if (savedFooter) {
        const p = JSON.parse(savedFooter);
        if (p && p.helpline) setFooterSettings(p);
      }
      const savedCats = localStorage.getItem('foodies_categories');
      if (savedCats) {
        const p = JSON.parse(savedCats);
        if (Array.isArray(p) && p.length > 0) setCategories(p);
      }
    } catch (e) {}

    // Load persisted complaints on first mount (filter out stale dummy tickets)
    const savedComplaints = localStorage.getItem('foodies_complaints');
    if (savedComplaints) {
      try {
        const parsed = JSON.parse(savedComplaints);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleanComplaints = parsed.filter(
            (c: Complaint) => c.id !== 'cmp-101' && c.id !== 'cmp-102' && c.orderNumber !== 'FC-9999' && c.orderNumber !== 'FC-4352'
          );
          setComplaints(cleanComplaints);
          localStorage.setItem('foodies_complaints', JSON.stringify(cleanComplaints));
        }
      } catch (e) {}
    }

    // Load persisted orders on first mount (filter out stale dummy orders if any)
    const savedOrders = localStorage.getItem('foodies_orders_live');

    if (savedOrders) {
      try {
        const parsed = JSON.parse(savedOrders);
        if (Array.isArray(parsed)) {
          const cleanOrders = parsed.filter(
            (o: Order) =>
              !o.id?.startsWith('ord-seed-') &&
              !o.id?.startsWith('ord-10') &&
              o.id !== 'ord-seed-1' &&
              o.id !== 'ord-seed-2' &&
              o.id !== 'ord-seed-3' &&
              o.id !== 'ord-seed-4' &&
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
      } catch (e) {}
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
          const clean = parsed
            .filter((s: CashShift) => s.id !== 'sh-yesterday-1' && s.id !== 'sh-yesterday-2')
            .map((s: CashShift) =>
              s.id === 'sh-today-1' && (s.cashCollected === 34200 || s.openingFloat === 5000 || s.expectedCash === 5000)
                ? { ...s, openingFloat: 0, cashCollected: 0, expectedCash: 0 }
                : s
            );
          setShifts(clean.length > 0 ? clean : INITIAL_SHIFTS);
          localStorage.setItem('foodies_shifts_live', JSON.stringify(clean.length > 0 ? clean : INITIAL_SHIFTS));
        }
      }
    } catch (e) {}

    // Load persisted menu items on first mount
    const savedMenu = localStorage.getItem('foodies_menu_items');
    if (savedMenu) {
      try {
        const parsed = JSON.parse(savedMenu);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMenuItems(parsed);
        }
      } catch (e) {}
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
      } catch (e) {}
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
          } catch (e) {}
        }
      } else {
        const savedUser = localStorage.getItem('foodies_customer_user');
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            if (parsedUser && parsedUser.name && parsedUser.name !== 'Guest Customer' && parsedUser.role === 'customer') {
              setCurrentUser(parsedUser);
            }
          } catch (e) {}
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

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCustomerCoordinates({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          selectNearest(pos.coords.latitude, pos.coords.longitude);
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
          setOrders(event.data.payload);
        }
        if (event.data?.type === 'SYNC_TABLES' && Array.isArray(event.data.payload)) {
          setTables(event.data.payload);
        }
        if (event.data?.type === 'SYNC_MENU' && Array.isArray(event.data.payload)) {
          setMenuItems(event.data.payload);
        }
        if (event.data?.type === 'SYNC_COMPLAINTS' && Array.isArray(event.data.payload)) {
          setComplaints(event.data.payload);
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
        } catch (err) {}
      }
      if (e.key === 'foodies_orders_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setOrders(parsed);
          }
        } catch (err) {}
      }
      if (e.key === 'foodies_manager_access_requests' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) setManagerAccessRequests(parsed);
        } catch (err) {}
      }
      if (e.key === 'foodies_tables_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setTables(parsed);
          }
        } catch (err) {}
      }
      if (e.key === 'foodies_menu_items' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setMenuItems(parsed);
          }
        } catch (err) {}
      }
      if (e.key === 'foodies_complaints' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setComplaints(parsed);
          }
        } catch (err) {}
      }
      if (e.key === 'foodies_shifts_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setShifts(parsed);
        } catch (err) {}
      }
      if (e.key === 'foodies_refunds_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setRefundRequests(parsed);
        } catch (err) {}
      }
      if (e.key === 'foodies_table_sessions_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setTableSessions(parsed);
        } catch (err) {}
      }
      if (e.key === 'foodies_users_live' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setUsers(parsed);
        } catch (err) {}
      }
      if (e.key === 'foodies_hero_banners' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setHeroBanners(parsed);
        } catch (err) {}
      }
      if (e.key === 'foodies_deal_card' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) setDealCard(parsed);
        } catch (err) {}
      }
      if (e.key === 'foodies_footer_settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) setFooterSettings(parsed);
        } catch (err) {}
      }
      if (e.key === 'foodies_categories' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) setCategories(parsed);
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (channel) {
        channel.close();
        liveBroadcastChannelRef.current = null;
      }
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

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
        setOrders(state.orders.orders);
      }
      if (state.cart.items !== prevReduxState.cart.items) {
        setCart(state.cart.items);
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
      if (state.cafe.complaints !== prevReduxState.cafe.complaints) {
        setComplaints(state.cafe.complaints);
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
      if (state.cafe.footerSettings !== prevReduxState.cafe.footerSettings) {
        setFooterSettings(state.cafe.footerSettings);
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
    } catch (e) {}
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
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: matched.id, status: 'accepted', sentToKitchen: true }),
                }).catch(() => {});
              } catch (e) {}
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
    setCart((prev) => {
      const existing = prev.find(
        (i) => i.menuItemId === item.menuItemId && i.size === item.size && JSON.stringify(i.extras) === JSON.stringify(item.extras)
      );
      const nextCart = existing
        ? prev.map((i) => (i === existing ? { ...i, quantity: i.quantity + item.quantity } : i))
        : [...prev, item];
      try {
        localStorage.setItem('foodies_cart', JSON.stringify(nextCart));
        store.dispatch(setReduxCart(nextCart));
      } catch (e) {}
      return nextCart;
    });
    addToast({
      type: 'success',
      title: 'Added to Cart',
      message: `${item.name} (x${item.quantity}) added.`,
    });
  };

  const updateCartItemQty = (itemId: string, delta: number) => {
    setCart((prev) => {
      const nextCart = prev
        .map((i) => {
          if (i.id === itemId) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty } : null;
          }
          return i;
        })
        .filter(Boolean) as OrderItem[];
      try {
        localStorage.setItem('foodies_cart', JSON.stringify(nextCart));
        store.dispatch(setReduxCart(nextCart));
      } catch (e) {}
      return nextCart;
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const nextCart = prev.filter((i) => i.id !== itemId);
      try {
        localStorage.setItem('foodies_cart', JSON.stringify(nextCart));
        store.dispatch(setReduxCart(nextCart));
      } catch (e) {}
      return nextCart;
    });
  };

  const clearCart = () => {
    try {
      localStorage.setItem('foodies_cart', JSON.stringify([]));
      store.dispatch(setReduxCart([]));
    } catch (e) {}
    setCart([]);
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
      notes?: string;
      customerCoordinates?: { lat: number; lng: number };
    }
  ): Order => {
    const orderItems = customItems && customItems.length > 0 ? customItems : [...cart];
    const subtotal = orderItems.reduce((acc, item) => acc + Number(item.unitPrice) * Number(item.quantity), 0);
    const method = paymentMethod || 'COD';
    const routeToSupportFirst = footerSettings.orderRoutingSupportFirst ?? true;
    const autoMin = footerSettings.autoForwardKitchenMin ?? 3;
    const isTimed = (footerSettings.autoForwardMode ?? 'timed') === 'timed';
    const forwardTime = routeToSupportFirst && isTimed && autoMin > 0
      ? new Date(Date.now() + autoMin * 60 * 1000).toISOString()
      : undefined;

    const isStaffOrCashier = currentRole === 'cashier' || currentRole === 'branch_manager' || Boolean(options?.cashierId) || Boolean(options?.isWalkIn);
    const cashierId = options?.cashierId || (currentRole === 'cashier' ? (currentUser.id || 'user-cashier') : undefined);
    const cashierName = options?.cashierName || (currentRole === 'cashier' ? (currentUser.name || 'Bilal Farooq') : undefined);
    const isWalkIn = options?.isWalkIn ?? (currentRole === 'cashier' || Boolean(cashierId));
    const targetCustomerId = options?.customerId || (isStaffOrCashier ? 'cust-walkin' : currentUser.id);
    const targetCustomerPhone = options?.customerPhone || (isStaffOrCashier ? '+92 300 0000000' : currentUser.phone);
    const cleanTargetPhone = targetCustomerPhone?.replace(/\s+/g, '');

    // Look for existing active order from same account for the same fulfillment type
    let existingActiveOrder: Order | undefined = undefined;

    if (!isWalkIn && (cleanTargetPhone || targetCustomerId)) {
      if (type === 'dine_in') {
        // While the first order is still pending for dine-in, add to same order
        existingActiveOrder = orders.find((o) => {
          if (o.type !== 'dine_in') return false;
          if (o.status === 'completed' || o.status === 'cancelled') return false;
          if (o.branchId !== currentBranchId) return false;
          const oPhone = o.customerPhone?.replace(/\s+/g, '');
          if (cleanTargetPhone && oPhone && oPhone === cleanTargetPhone) return true;
          if (targetCustomerId && o.customerId && o.customerId === targetCustomerId) return true;
          return false;
        });
      } else if (type === 'takeaway' || type === 'delivery') {
        // For takeaway or delivery, while first order not handed over (not completed), add to same order
        existingActiveOrder = orders.find((o) => {
          if (o.type !== type) return false;
          if (o.status === 'completed' || o.status === 'cancelled') return false;
          if (o.branchId !== currentBranchId) return false;
          const oPhone = o.customerPhone?.replace(/\s+/g, '');
          if (cleanTargetPhone && oPhone && oPhone === cleanTargetPhone) return true;
          if (targetCustomerId && o.customerId && o.customerId === targetCustomerId) return true;
          return false;
        });
      }
    }

    if (existingActiveOrder) {
      const mergedItems = [...existingActiveOrder.items];
      orderItems.forEach((newItem) => {
        const existingIdx = mergedItems.findIndex(
          (it) =>
            it.name === newItem.name &&
            (it.size || 'Standard') === (newItem.size || 'Standard') &&
            JSON.stringify(it.extras || []) === JSON.stringify(newItem.extras || [])
        );

        if (existingIdx >= 0) {
          mergedItems[existingIdx] = {
            ...mergedItems[existingIdx],
            quantity: mergedItems[existingIdx].quantity + newItem.quantity,
          };
        } else {
          mergedItems.push({
            ...newItem,
            id: newItem.id || `item-add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            isAddOn: true,
            addedAtStage: 'stage2',
          });
        }
      });

      const addedAmount = orderItems.reduce((acc, it) => acc + Number(it.unitPrice) * Number(it.quantity), 0);
      const newAddOnSubtotal = Number(existingActiveOrder.addOnSubtotal || 0) + addedAmount;
      const newTotal = Number(existingActiveOrder.originalSubtotal || 0) + newAddOnSubtotal;
      const nextVersion = (Number(existingActiveOrder.version) || 1) + 1;

      const updatedOrder: Order = {
        ...existingActiveOrder,
        items: mergedItems,
        addOnSubtotal: newAddOnSubtotal,
        total: newTotal,
        version: nextVersion,
      };

      setOrders((prev) => {
        const updated = prev.map((o) => (o.id === existingActiveOrder!.id ? updatedOrder : o));
        broadcastOrders(updated);
        return updated;
      });
      clearCart();

      // Persist update to PostgreSQL
      try {
        fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: existingActiveOrder.id,
            items: mergedItems,
            addOnSubtotal: newAddOnSubtotal,
            total: newTotal,
            version: nextVersion,
          }),
        }).catch(() => {});
      } catch (e) {}

      const typeLabel =
        existingActiveOrder.type === 'dine_in'
          ? `Dine-In (Table ${existingActiveOrder.tableNumber || 'Seated'})`
          : existingActiveOrder.type === 'takeaway'
          ? 'Takeaway'
          : 'Delivery';

      addToast({
        type: 'success',
        title: 'Items Added to Existing Order! 🎉',
        message: `${orderItems.length} new item(s) added to your ${typeLabel} Order #${existingActiveOrder.orderNumber}. Total: Rs. ${newTotal.toLocaleString()}.`,
      });

      return updatedOrder;
    }

    const targetCustomerEmail = options?.customerEmail || (!isStaffOrCashier ? currentUser.email : undefined);

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      orderNumber: `FC-${Math.floor(1000 + Math.random() * 9000)}`,
      branchId: currentBranchId,
      customerId: targetCustomerId,
      customerName: options?.customerName || (isStaffOrCashier ? 'Walk-in Guest' : currentUser.name),
      customerPhone: targetCustomerPhone,
      customerEmail: targetCustomerEmail,
      type,
      tableNumber,
      tablePin,
      pickupTime: type === 'takeaway' ? (pickupTime || 'Immediate walk-in counter collection') : undefined,
      deliveryAddress: type === 'delivery' ? (deliveryAddress || currentUser.address) : undefined,
      status: 'placed',
      paymentStatus: 'unpaid',
      items: orderItems,
      originalSubtotal: subtotal,
      addOnSubtotal: 0,
      tax: 0,
      total: subtotal,
      notes: options?.notes,
      createdAt: `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
      readyTimeEstimated: `in ${currentBranch.prepTimeEstimateMin} mins`,
      version: 1,
      paymentMethod: method,
      sentToKitchen: !routeToSupportFirst,
      sentToKitchenAt: !routeToSupportFirst ? new Date().toISOString() : undefined,
      forwardToKitchenAt: forwardTime,
      cashierId,
      cashierName,
      isWalkIn,
      customerCoordinates: options?.customerCoordinates || customerCoordinates || undefined,
    };

    // Guarantee that this customer's order is immediately remembered on this device/account
    if (typeof window !== 'undefined') {
      try {
        const myIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
        if (!myIds.includes(newOrder.id)) {
          myIds.unshift(newOrder.id);
          localStorage.setItem('foodies_customer_order_ids', JSON.stringify(myIds));
        }
        const cache = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
        const updatedCache = [newOrder, ...cache.filter((o: any) => o.id !== newOrder.id)];
        localStorage.setItem('foodies_customer_history_cache', JSON.stringify(updatedCache));
      } catch (e) {}
    }

    setOrders((prev) => {
      const updated = [newOrder, ...prev];
      broadcastOrders(updated);
      return updated;
    });
    clearCart();

    if (type === 'dine_in' && tableNumber) {
      setTables((prev) => {
        const updated = prev.map((t) =>
          t.number === tableNumber && t.branchId === currentBranchId
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableNumber,
            branchId: currentBranchId,
            status: 'occupied',
            currentOrderId: newOrder.id,
          }),
        }).catch(() => {});
      } catch (e) {}
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

    // Persist order to PostgreSQL database and safely broadcast once confirmed in DB
    try {
      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.order) {
            store.dispatch(upsertReduxOrder(data.order));
            broadcastStateMutation('SYNC_ORDERS', [data.order]);
          }
        })
        .catch(() => {});
    } catch (e) {}

    return newOrder;
  };

  const sendOrderToKitchen = (orderId: string) => {
    let orderNum = '';
    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          orderNum = ord.orderNumber;
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: 'accepted', sentToKitchen: true }),
      }).catch(() => {});
    } catch (e) {}

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, autoForwardCustomMin: customMinutes, forwardToKitchenAt: targetIso }),
      }).catch(() => {});
    } catch (e) {}

    addToast({
      type: 'info',
      title: 'Auto-Forward Time Set ⏱️',
      message: `Order #${orderNum || orderId} will automatically advance to kitchen in ${customMinutes} min${customMinutes > 1 ? 's' : ''}.`,
    });
  };

  const updateOrderStatus = (
    orderId: string,
    newStatus: OrderStatus,
    reason?: string,
    customNotification?: { title: string; message: string; type?: 'info' | 'success' | 'warning' }
  ) => {
    let orderNum = '';
    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          orderNum = ord.orderNumber;
          const inKitchen = newStatus === 'accepted' || newStatus === 'preparing' || newStatus === 'ready' || newStatus === 'served';
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
      return updated;
    });

    // Asynchronously sync status update to PostgreSQL database
    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus }),
      }).catch(() => {});
    } catch (e) {}

    if (newStatus === 'completed' || newStatus === 'cancelled') {
      const targetOrd = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tableNumber: targetOrd.tableNumber,
              branchId: targetOrd.branchId || currentBranchId,
              status: 'available',
            }),
          }).catch(() => {});
        } catch (e) {}
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
  const assignRiderToOrder = (orderId: string, riderId: string, silent = false) => {
    const rider = users.find((u) => u.id === riderId);
    const riderName = rider?.name || 'Assigned Rider';
    let orderNum = '';

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          orderNum = ord.orderNumber;
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
      } catch (e) {}
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
      } catch (e) {}
      return updated;
    });

    setCurrentUser((prev) => {
      if (prev && prev.id === riderId) {
        const updated = { ...prev, riderActiveOrderId: prev.riderActiveOrderId || orderId };
        try {
          localStorage.setItem('foodies_current_user', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      }
      return prev;
    });

    // Asynchronously sync order update to PostgreSQL
    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          assignedRiderId: riderId,
          assignedRiderName: riderName,
          riderStatus: 'assigned',
        }),
      }).catch(() => {});
    } catch (e) {}

    if (!silent) {
      addToast({
        type: 'success',
        title: 'Rider Assigned! 🛵',
        message: `Order #${orderNum || orderId} assigned to ${riderName}. You can assign more orders or change before departure.`,
      });
    }
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
      } catch (e) {}
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
      } catch (e) {}
      return updated;
    });

    setCurrentUser((prev) => {
      if (prev && prev.id === riderId) {
        const updated = { ...prev, riderAvailability: 'busy' as const, riderActiveOrderId: orderIds[0] };
        try {
          localStorage.setItem('foodies_current_user', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      }
      return prev;
    });

    // 3. Persist rider busy availability to PostgreSQL
    try {
      fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: riderId,
          riderAvailability: 'busy',
          riderActiveOrderId: orderIds[0],
        }),
      }).catch(() => {});
    } catch (e) {}

    // 4. Persist orders status update to PostgreSQL
    orderIds.forEach((oId) => {
      try {
        fetch('/api/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: oId,
            status: 'out_for_delivery',
            riderStatus: 'en_route',
          }),
        }).catch(() => {});
      } catch (e) {}
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
      } catch (e) {}
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
          } catch (e) {}
          return updated;
        });

        setCurrentUser((prev) => {
          if (prev && prev.id === prevRiderId) {
            const updated = { ...prev, riderAvailability: 'available' as const, riderActiveOrderId: undefined };
            try {
              localStorage.setItem('foodies_current_user', JSON.stringify(updated));
            } catch (e) {}
            return updated;
          }
          return prev;
        });

        try {
          fetch('/api/users', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: prevRiderId,
              riderAvailability: 'available',
              riderActiveOrderId: null,
            }),
          }).catch(() => {});
        } catch (e) {}
      }
    }

    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          assignedRiderId: null,
          assignedRiderName: null,
          riderStatus: null,
        }),
      }).catch(() => {});
    } catch (e) {}

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
            completedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
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
      } catch (e) {}
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
        } catch (e) {}
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
          } catch (e) {}
          return updated;
        }
        return prev;
      });

      try {
        fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: riderIdToFree,
            riderAvailability: nextAvailability,
            riderActiveOrderId: shouldBeAvailable ? null : undefined,
            riderTotalDeliveries: newDeliveries,
          }),
        }).catch(() => {});
      } catch (e) {}
    }

    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: 'completed',
          paymentStatus: paymentCollected ? 'paid' : undefined,
          riderStatus: 'delivered',
          deliveredAt: new Date().toISOString(),
          paymentCollected: paymentCollected ?? true,
        }),
      }).catch(() => {});
    } catch (e) {}

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
      } catch (e) {}
      return updated;
    });

    setCurrentUser((prev) => {
      if (prev && prev.id === riderId) {
        const updated = { ...prev, riderAvailability: status };
        try {
          localStorage.setItem('foodies_current_user', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      }
      return prev;
    });

    try {
      fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: riderId,
          riderAvailability: status,
        }),
      }).catch(() => {});
    } catch (e) {}

    addToast({
      type: 'info',
      title: 'Rider Status Updated',
      message: `Status is now ${status === 'available' ? 'Online / Ready' : status === 'offline' ? 'Offline' : 'Busy'}.`,
    });
  };

  const recordCashPayment = (orderId: string, amountReceived: number) => {
    let change = 0;
    const ord = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    setOrders((prev) => {
      const updated = prev.map((item) => {
        if (item.id === orderId || item.orderNumber === orderId) {
          change = Math.max(0, amountReceived - Number(item.total));
          return { ...item, paymentStatus: 'paid' as const, status: 'completed' as const };
        }
        return item;
      });
      broadcastOrders(updated);
      return updated;
    });

    // Asynchronously sync payment status and completion to PostgreSQL database
    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentStatus: 'paid', status: 'completed' }),
      }).catch(() => {});
    } catch (e) {}

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableNumber: ord.tableNumber,
            status: 'available',
          }),
        }).catch(() => {});
      } catch (e) {}
    }

    const addedAmount = ord ? Number(ord.total) : amountReceived;

    const targetShift =
      shifts.find(
        (sh) =>
          sh.status === 'open' &&
          (sh.branchId === currentBranchId || sh.branchId === currentBranch.id || !sh.branchId || sh.id === 'sh-today-1')
      ) ||
      shifts.find((sh) => sh.status === 'open') ||
      shifts[0] ||
      DEFAULT_OPEN_SHIFT;

    const currentCollected = Number(targetShift.cashCollected || 0);
    const currentExpected = Number(targetShift.expectedCash || (targetShift.openingFloat || 0));
    const nextCashCollected = currentCollected + addedAmount;
    const nextExpectedCash = currentExpected + addedAmount;
    const targetShiftId = targetShift.id || 'sh-today-1';

    setShifts((prev) => {
      let found = false;
      const updated = prev.map((sh) => {
        if (
          sh.id === targetShiftId ||
          (sh.status === 'open' && (sh.branchId === currentBranchId || sh.branchId === currentBranch.id))
        ) {
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
      } catch (e) {}
      return finalShifts;
    });

    // Asynchronously persist shift totals to PostgreSQL
    try {
      fetch('/api/shifts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: targetShiftId,
          cashCollected: nextCashCollected,
          expectedCash: nextExpectedCash,
        }),
      }).catch((err) => console.error('Failed to sync shift to DB:', err));
    } catch (e) {}

    const tableInfo = ord?.tableNumber ? ` · Table #${ord.tableNumber} is now free` : '';
    addToast({
      type: 'success',
      title: 'Payment Settled & Bill Closed ✓',
      message: `Order #${ord?.orderNumber || orderId} settled (Rs. ${Number(ord?.total || amountReceived).toLocaleString()}). Change due: Rs. ${change.toLocaleString()}${tableInfo}.`,
    });

    return { change, success: true };
  };

  const editOrderStage1 = (orderId: string, updatedItems: OrderItem[]) => {
    const newSubtotal = updatedItems.reduce((acc, i) => acc + Number(i.unitPrice) * Number(i.quantity), 0);
    let updatedTotal = newSubtotal;
    let nextVersion = 2;

    setOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId || ord.orderNumber === orderId) {
          updatedTotal = newSubtotal + Number(ord.addOnSubtotal || 0);
          nextVersion = (Number(ord.version) || 1) + 1;
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          items: updatedItems,
          originalSubtotal: newSubtotal,
          total: updatedTotal,
          version: nextVersion,
        }),
      }).catch(() => {});
    } catch (e) {}

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
          nextVersion = (Number(ord.version) || 1) + 1;
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          items: combinedItems,
          addOnSubtotal: newAddOnSubtotal,
          total: updatedTotal,
          version: nextVersion,
        }),
      }).catch(() => {});
    } catch (e) {}

    addToast({
      type: 'success',
      title: 'Add-ons Added to Order',
      message: `Kitchen notified of NEW ADD-ON (+Rs. ${addOnTotal.toLocaleString()}).`,
    });
  };

  const cancelOrder = (orderId: string, reason: string) => {
    const targetOrd = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableNumber: targetOrd.tableNumber,
            branchId: targetOrd.branchId || currentBranchId,
            status: 'available',
          }),
        }).catch(() => {});
      } catch (e) {}
    }

    setOrders((prev) => {
      const updated = prev.map((ord) =>
        ord.id === orderId || ord.orderNumber === orderId
          ? { ...ord, status: 'cancelled' as const, notes: reason, forwardToKitchenAt: undefined }
          : ord
      );
      broadcastOrders(updated);
      return updated;
    });

    // Asynchronously sync cancellation to PostgreSQL database
    try {
      fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: 'cancelled', notes: reason }),
      }).catch(() => {});
    } catch (e) {}

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          qrCode: qrToken,
          qrExpiresAt: expiresAt,
          allowQrOrderOnReserved: allowOnReserved,
        }),
      });
    } catch (e) {}

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          allowQrOrderOnReserved: allow,
        }),
      });
    } catch (e) {}

    addToast({
      type: 'info',
      title: `Table ${targetTable.number} Setting Updated`,
      message: allow
        ? 'In-store QR scan allowed even if table is reserved online.'
        : 'In-store QR scan will show reserved notice and require picking another table.',
    });
  };

  const assignWaiterToOrder = async (orderId: string, waiterId: string, waiterName: string) => {
    setOrders((prev) => {
      const next = prev.map((o) => (o.id === orderId ? { ...o, assignedWaiterId: waiterId, assignedWaiterName: waiterName } : o));
      broadcastOrders(next);
      return next;
    });

    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          assignedWaiterId: waiterId,
          assignedWaiterName: waiterName,
        }),
      });
    } catch (e) {}
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status: 'cancelled',
          notes: `${targetOrder.notes ? `${targetOrder.notes} · ` : ''}Cancelled: ${reason}`,
        }),
      });
    } catch (e) {}

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
      return next;
    });

    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          items: updatedItems,
          addOnSubtotal: newAddOnSubtotal,
          total: newTotal,
          version: newVersion,
          sentToKitchen: true,
        }),
      });
    } catch (e) {}

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          status,
          reservedFor: status === 'reserved' ? reservationName || 'Reserved Guest' : undefined,
        }),
      }).catch(() => {});
    } catch (e) {}
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: tableIdOrNumber,
          status: 'available',
        }),
      }).catch(() => {});
    } catch (e) {}

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
          const current = item.branchAvailability[branchId] ?? true;
          updatedAvailability = { ...item.branchAvailability, [branchId]: !current };
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, branchAvailability: updatedAvailability }),
      }).catch(() => {});
    } catch (e) {}
  };

  const updateMenuItemPrice = (itemId: string, newBasePrice: number) => {
    const numPrice = Number(newBasePrice) || 0;
    setMenuItems((prev) => {
      const updated = prev.map((item) => (item.id === itemId ? { ...item, basePrice: numPrice } : item));
      broadcastMenu(updated);
      return updated;
    });

    // Asynchronously sync price change to PostgreSQL database
    try {
      fetch('/api/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, basePrice: numPrice }),
      }).catch(() => {});
    } catch (e) {}

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
      const updated = prev.map((b) => (b.id === branchId ? { ...b, ...settings } : b));
      broadcastBranches(updated);
      return updated;
    });

    // Asynchronously sync branch settings to PostgreSQL database
    try {
      fetch('/api/branches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, settings }),
      }).catch(() => {});
    } catch (e) {}
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

  const updateBranchPaymentSettings = (branchId: string, settings: BranchPaymentSettings) => {
    setBranches((prev) => {
      const updated = prev.map((b) => (b.id === branchId ? { ...b, paymentSettings: settings } : b));
      broadcastBranches(updated);
      return updated;
    });

    // Asynchronously sync payment settings to PostgreSQL database
    try {
      fetch('/api/branches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, settings: { paymentSettings: settings } }),
      }).catch(() => {});
    } catch (e) {}

    addToast({
      type: 'success',
      title: 'Payment Settings Saved! 💳',
      message: 'Branch payment options updated.',
    });
  };

  const submitComplaint = (subject: string, message: string, orderId?: string) => {
    const order = orders.find((o) => o.id === orderId);
    const newComplaint: Complaint = {
      id: `cmp-${Date.now()}`,
      ticketNumber: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: currentUser.id || 'user-guest',
      customerName: currentUser.name || 'Guest Customer',
      customerPhone: currentUser.phone || '+923000000000',
      branchId: currentBranchId,
      orderId,
      orderNumber: order?.orderNumber,
      subject,
      status: 'new',
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'customer',
          senderName: currentUser.name || 'Customer',
          text: message,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    setComplaints((prev) => {
      const updated = [newComplaint, ...prev];
      broadcastComplaints(updated);
      return updated;
    });

    // Asynchronously save complaint to PostgreSQL
    try {
      fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newComplaint),
      }).catch(() => {});
    } catch (e) {}

    addToast({
      type: 'success',
      title: 'Complaint / Query Submitted',
      message: `Ticket #${newComplaint.ticketNumber} created. Branch representative will reply shortly.`,
    });
  };

  const sendComplaintReply = (complaintId: string, text: string) => {
    const senderType: 'customer' | 'representative' = currentRole === 'customer' ? 'customer' : 'representative';
    const newMessage: ComplaintMessage = {
      id: `msg-${Date.now()}`,
      sender: senderType,
      senderName: currentUser.name || (currentRole === 'customer' ? 'Customer' : 'Zara Noor (Branch Rep)'),
      text,
      timestamp: new Date().toISOString(),
    };

    setComplaints((prev) => {
      const updated = prev.map((cmp) => {
        if (cmp.id === complaintId) {
          return {
            ...cmp,
            status: cmp.status === 'new' ? ('in_progress' as const) : cmp.status,
            messages: [...cmp.messages, newMessage],
          };
        }
        return cmp;
      });
      broadcastComplaints(updated);
      return updated;
    });

    // Asynchronously update complaint in PostgreSQL
    try {
      fetch('/api/complaints', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: complaintId,
          message: newMessage,
          status: 'in_progress',
        }),
      }).catch(() => {});
    } catch (e) {}
  };

  const updateComplaintStatus = (complaintId: string, status: 'new' | 'in_progress' | 'resolved' | 'closed') => {
    setComplaints((prev) => {
      const updated = prev.map((c) => (c.id === complaintId ? { ...c, status } : c));
      broadcastComplaints(updated);
      return updated;
    });

    // Asynchronously update status in PostgreSQL
    try {
      fetch('/api/complaints', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: complaintId, status }),
      }).catch(() => {});
    } catch (e) {}
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSession),
      }).catch(() => {});
    } catch (e) {}
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: tableIdOrNumber, branchId: currentBranchId, status: 'completed' }),
      }).catch(() => {});
    } catch (e) {}
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newShift),
      }).catch(() => {});
    } catch (e) {}

    addToast({
      type: 'success',
      title: 'Shift Opened',
      message: `Starting float of Rs. ${openingFloat.toLocaleString()} recorded.`,
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shiftId: (closedShift as CashShift).id,
            countedCash,
            difference: (closedShift as CashShift).difference,
            differenceReason,
            status: 'closed',
          }),
        }).catch(() => {});
      } catch (e) {}
    }

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
        (sh.branchId === currentBranchId || sh.branchId === currentBranch.id || !sh.branchId || sh.id === 'sh-today-1')
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReq),
      }).catch(() => {});
    } catch (e) {}

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundId,
          status: approved ? 'approved' : 'rejected',
          approvedBy: currentUser.name,
        }),
      }).catch(() => {});
    } catch (e) {}

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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: req.orderId, paymentStatus: 'refunded' }),
        }).catch(() => {});
      } catch (e) {}
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, status }),
    }).catch(() => {});
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    }).catch(() => {});
  };

  const deleteUser = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== userId);
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
        action: 'account_deleted',
        details: `Deleted user ${targetUser?.name || userId} (${targetUser?.role || 'user'})`,
      },
      ...prev,
    ]);
    fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }).catch(() => {});
  };

  const updateUser = (userId: string, updates: Partial<User>) => {
    setUsers((prev) => {
      const next = prev.map((u) => (u.id === userId ? { ...u, ...updates } : u));
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
        action: 'account_updated',
        details: `Updated user ${userId}: ${Object.keys(updates).join(', ')}`,
      },
      ...prev,
    ]);
    fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, ...updates }),
    }).catch(() => {});
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
    setTables((prev) => [...prev, newTable]);
    addToast({
      type: 'success',
      title: 'Table Added',
      message: `Table ${newTable.number} with ${newTable.capacity} chairs created on ${newTable.floor || 'Ground Floor'}`,
    });
  };

  const updateTable = (tableId: string, updates: Partial<Table>) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              ...updates,
              capacity: updates.chairs !== undefined ? updates.chairs : updates.capacity !== undefined ? updates.capacity : t.capacity,
              chairs: updates.chairs !== undefined ? updates.chairs : updates.capacity !== undefined ? updates.capacity : t.chairs || t.capacity,
            }
          : t
      )
    );
    addToast({ type: 'success', title: 'Table Updated', message: 'Seating layout updated.' });
  };

  const deleteTable = (tableId: string) => {
    setTables((prev) => prev.filter((t) => t.id !== tableId));
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'category', action: 'add', name: category }),
        }).catch(() => {});
      } catch (e) {}

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'category', action: 'rename', oldName: oldCat, newName: newCat }),
      }).catch(() => {});
    } catch (e) {}

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'category', action: 'delete', name: category }),
      }).catch(() => {});
    } catch (e) {}

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

    // Asynchronously sync item update to PostgreSQL database
    try {
      fetch('/api/menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: normalizedItem.id, ...normalizedItem }),
      }).catch(() => {});
    } catch (e) {}

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedItem),
      }).catch(() => {});
    } catch (e) {}

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
      }).catch(() => {});
    } catch (e) {}

    addToast({ type: 'info', title: 'Item Removed', message: 'Item deleted from menu.' });
  };

  // Footer Actions
  const updateFooterSettings = (settings: Partial<FooterSettings>) => {
    setFooterSettings((prev) => {
      const updated = { ...prev, ...settings };
      broadcastMarketing({ footerSettings: updated });
      return updated;
    });

    try {
      fetch('/api/marketing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'footer', settings }),
      }).catch(() => {});
    } catch (e) {}

    addToast({ type: 'success', title: 'Footer Updated', message: 'Cafe footer contact & addresses saved.' });
  };

  // Banner & Deal Actions with Representative Approval Flow
  const updateHeroBanner = (banner: HeroBanner) => {
    const isPrivileged = currentRole === 'branch_manager' || currentRole === 'platform_owner' || allowRepresentativeDirectPublish;
    if (isPrivileged) {
      setHeroBanners((prev) => {
        const updated = prev.map((b) => (b.id === banner.id ? banner : b));
        broadcastMarketing({ heroBanners: updated });
        return updated;
      });

      try {
        fetch('/api/marketing', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'banner', banner }),
        }).catch(() => {});
      } catch (e) {}

      addToast({ type: 'success', title: 'Banner Updated', message: 'Hero banner changes are now live on the customer home page.' });
    } else {
      const newRequest: BannerDealApprovalRequest = {
        id: `req-${Date.now()}`,
        type: 'banner',
        action: 'update',
        targetId: banner.id,
        submittedBy: currentUser.name || 'Branch Representative',
        submittedByRole: currentRole,
        submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
        bannerData: banner,
      };
      setPendingApprovalRequests((prev) => [newRequest, ...prev]);
      addToast({
        type: 'info',
        title: 'Submitted for Manager Approval',
        message: 'Your banner update was sent to the Branch Manager. It will display on customer screen once approved.',
      });
    }
  };

  const addHeroBanner = (bannerData: Omit<HeroBanner, 'id'>) => {
    const newId = `b-${Date.now()}`;
    const newBanner: HeroBanner = { ...bannerData, id: newId };
    const isPrivileged = currentRole === 'branch_manager' || currentRole === 'platform_owner' || allowRepresentativeDirectPublish;
    if (isPrivileged) {
      setHeroBanners((prev) => {
        const updated = [...prev, newBanner];
        broadcastMarketing({ heroBanners: updated });
        return updated;
      });

      try {
        fetch('/api/marketing', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'banner', banner: newBanner }),
        }).catch(() => {});
      } catch (e) {}

      addToast({ type: 'success', title: 'Banner Added', message: 'New banner added to customer carousel.' });
    } else {
      const newRequest: BannerDealApprovalRequest = {
        id: `req-${Date.now()}`,
        type: 'banner',
        action: 'add',
        submittedBy: currentUser.name || 'Branch Representative',
        submittedByRole: currentRole,
        submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
        bannerData: newBanner,
      };
      setPendingApprovalRequests((prev) => [newRequest, ...prev]);
      addToast({
        type: 'info',
        title: 'Submitted for Approval',
        message: 'New banner proposal sent to Branch Manager for review.',
      });
    }
  };

  const deleteHeroBanner = (id: string) => {
    const isPrivileged = currentRole === 'branch_manager' || currentRole === 'platform_owner' || allowRepresentativeDirectPublish;
    if (isPrivileged) {
      setHeroBanners((prev) => {
        const updated = prev.filter((b) => b.id !== id);
        broadcastMarketing({ heroBanners: updated });
        return updated;
      });

      try {
        fetch('/api/marketing', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'delete_banner', id }),
        }).catch(() => {});
      } catch (e) {}

      addToast({ type: 'info', title: 'Banner Removed', message: 'Banner removed from carousel.' });
    } else {
      const target = heroBanners.find((b) => b.id === id);
      const newRequest: BannerDealApprovalRequest = {
        id: `req-${Date.now()}`,
        type: 'banner',
        action: 'delete',
        targetId: id,
        submittedBy: currentUser.name || 'Branch Representative',
        submittedByRole: currentRole,
        submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
        bannerData: target,
      };
      setPendingApprovalRequests((prev) => [newRequest, ...prev]);
      addToast({ type: 'info', title: 'Delete Request Sent', message: 'Banner deletion requires Branch Manager approval.' });
    }
  };

  const updateDealCard = (newDeal: DealCard) => {
    const isPrivileged = currentRole === 'branch_manager' || currentRole === 'platform_owner' || allowRepresentativeDirectPublish;
    if (isPrivileged) {
      setDealCard(newDeal);
      broadcastMarketing({ dealCard: newDeal });

      try {
        fetch('/api/marketing', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'deal', deal: newDeal }),
        }).catch(() => {});
      } catch (e) {}

      addToast({ type: 'success', title: 'Chef Special Deal Updated', message: 'Customer special deal card is now live.' });
    } else {
      const newRequest: BannerDealApprovalRequest = {
        id: `req-${Date.now()}`,
        type: 'deal',
        action: 'update',
        submittedBy: currentUser.name || 'Branch Representative',
        submittedByRole: currentRole,
        submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
        dealData: newDeal,
      };
      setPendingApprovalRequests((prev) => [newRequest, ...prev]);
      addToast({
        type: 'info',
        title: 'Submitted for Manager Approval',
        message: 'Deal card update submitted. It will display on customer screen once approved by manager.',
      });
    }
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
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'banner', banner: req.bannerData }),
        }).catch(() => {});
      } else if (req.action === 'update') {
        setHeroBanners((prev) => {
          const updated = prev.map((b) => (b.id === req.targetId ? req.bannerData! : b));
          broadcastMarketing({ heroBanners: updated });
          return updated;
        });
        fetch('/api/marketing', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'banner', banner: req.bannerData }),
        }).catch(() => {});
      } else if (req.action === 'delete' && req.targetId) {
        setHeroBanners((prev) => {
          const updated = prev.filter((b) => b.id !== req.targetId);
          broadcastMarketing({ heroBanners: updated });
          return updated;
        });
        fetch('/api/marketing', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'delete_banner', id: req.targetId }),
        }).catch(() => {});
      }
    } else if (req.type === 'deal' && req.dealData) {
      setDealCard(req.dealData);
      broadcastMarketing({ dealCard: req.dealData });
      fetch('/api/marketing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'deal', deal: req.dealData }),
      }).catch(() => {});
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

  const fetchOlderOrders = async (branchId?: string, dateScope: string = 'all') => {
    setIsFetchingOlderOrders(true);
    try {
      const bId = branchId !== undefined ? branchId : (currentRole === 'platform_owner' ? 'all' : currentBranchId);
      const url = bId && bId !== 'all'
        ? `/api/orders?branchId=${bId}&dateScope=${dateScope}&older=true`
        : `/api/orders?dateScope=${dateScope}&older=true`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
          setHasLoadedOlderOrders(true);
          try {
            localStorage.setItem('foodies_orders_live', JSON.stringify(data.orders));
          } catch (e) {}
          addToast({
            type: 'info',
            title: 'Historical Data Loaded 📂',
            message: `Fetched ${data.orders.length} total orders from database archive.`,
          });
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
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setOrders(data.orders);
          setHasLoadedOlderOrders(false);
          try {
            localStorage.setItem('foodies_orders_live', JSON.stringify(data.orders));
          } catch (e) {}
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
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch (e) {}
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry),
    }).catch(() => {});

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry),
    }).catch(() => {});

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry),
    }).catch(() => {});

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
        complaints,
        shifts,
        refundRequests,
        auditLogs,
        cart,
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
        recordCashPayment,
        editOrderStage1,
        addAddOnsToOrderStage2,
        cancelOrder,
        assignRiderToOrder,
        unassignRiderFromOrder,
        finishRiderDelivery,
        updateRiderAvailability,
        departRider,
        customerCoordinates,
        setCustomerCoordinates,
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
        cancelDineInOrder,
        addItemsToExistingOrder,
        toggleMenuItemBranchAvailability,
        updateMenuItemPrice,
        updateBranchSettings,
        updateBranchPaymentSettings,
        submitComplaint,
        sendComplaintReply,
        updateComplaintStatus,
        openShift,
        closeShift,
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
  selectComplaints,
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
} from '@/redux/slices/cafeSlice';
export {
  selectTheme,
  selectCurrentRole,
  selectCurrentUser,
  selectToasts,
  selectMenuSearchQuery,
} from '@/redux/slices/uiSlice';
export { runSync, broadcastStateMutation } from '@/redux/sync/syncEngine';
