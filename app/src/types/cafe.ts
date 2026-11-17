export type Role =
  | 'platform_owner'
  | 'branch_manager'
  | 'kitchen_staff'
  | 'cashier'
  | 'floor_staff'
  | 'delivery_staff'
  | 'customer';

export type UserStatus = 'active' | 'suspended' | 'deactivated';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  password?: string;
  pin?: string;
  address?: string;
  role: Role;
  branchId?: string;
  status: UserStatus;
  noShowCount?: number;
  riderAvailability?: 'available' | 'busy' | 'offline';
  riderTotalDeliveries?: number;
  riderActiveOrderId?: string;
  assignedFloor?: string;
  assignedTableNumbers?: string[];
}

export type PaymentMode = 'COD' | 'Wallet' | 'Card' | 'Bank' | 'Installment';

export interface OrderTypePaymentSettings {
  COD: boolean;
  Wallet: boolean;
  Card: boolean;
  Bank: boolean;
  Installment: boolean;
}

export interface BranchPaymentSettings {
  dine_in: OrderTypePaymentSettings;
  takeaway: OrderTypePaymentSettings;
  delivery: OrderTypePaymentSettings;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  openingHours: string;
  isOpen: boolean;
  isBusy: boolean; // "Orders paused / longer prep time"
  prepTimeEstimateMin: number;
  fullEditWindowMin: number;
  stopAddOnsMinBeforeReady: number;
  deliveryEnabled: boolean;
  latitude?: number;
  longitude?: number;
  maxOrderDistanceKm?: number;
  tableQrMaxDistanceMeters?: number;
  paymentSettings?: BranchPaymentSettings;
  minDeliveryAmount?: number; // Minimum order subtotal required for delivery orders
  autoScheduleEnabled?: boolean; // Open/close automatically at openingHours (Asia/Karachi)
}

export function normalizeBranchId(id?: string): string {
  if (!id) return 'gulberg-lahore';
  if (id === 'all') return 'all';
  if (id === 'branch-1' || id === 'branch-gulberg' || id.includes('gulberg')) return 'gulberg-lahore';
  if (id === 'branch-2' || id === 'branch-f7' || id.includes('f7') || id.includes('islamabad')) return 'f7-islamabad';
  if (id === 'branch-3' || id === 'branch-clifton' || id.includes('clifton') || id.includes('karachi')) return 'clifton-karachi';
  return id;
}

export interface MenuItemOption {
  name: string;
  priceDelta: number;
}

export interface MenuItemExtra {
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  image: string;
  isAvailable: boolean;
  branchAvailability: Record<string, boolean>; // branchId -> boolean
  branchPriceOverrides?: Record<string, number>;
  sizes?: MenuItemOption[];
  extras?: MenuItemExtra[];
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  size?: string;
  extras?: string[];
  instructions?: string;
  unitPrice: number;
  quantity: number;
  isAddOn?: boolean;
  addedAtStage?: 'stage1' | 'stage2';
  /** Add-on added after cooking started; the kitchen must mark it received before 'ready'. */
  kitchenPending?: boolean;
}

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'delivered'
  | 'taken';

export const STATUS_RANK: Record<OrderStatus, number> = {
  placed: 1,
  accepted: 2,
  preparing: 3,
  ready: 4,
  out_for_delivery: 5,
  served: 6,
  delivered: 6,
  taken: 6,
  completed: 7,
  cancelled: 8,
};

export type PaymentStatus = 'unpaid' | 'paid' | 'partially_refunded' | 'refunded';

export type TableStatus = 'available' | 'reserved' | 'occupied' | 'cleaning' | 'unavailable';

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  type: OrderType;
  tableNumber?: string;
  tablePin?: string;
  pickupTime?: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  originalSubtotal: number;
  addOnSubtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  preparationStartedAt?: string;
  readyTimeEstimated?: string;
  completedAt?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: 'customer' | 'staff' | 'branch_offline' | string;
  deliveryAddress?: string;
  version: number;
  paymentMethod: string;
  sentToKitchen?: boolean;
  sentToKitchenAt?: string;
  forwardToKitchenAt?: string;
  autoForwardCustomMin?: number;
  cashierId?: string;
  cashierName?: string;
  shiftId?: string;
  isWalkIn?: boolean;
  customerCoordinates?: { lat: number; lng: number };
  assignedRiderId?: string;
  assignedRiderName?: string;
  riderStatus?: 'assigned' | 'accepted' | 'picked_up' | 'en_route' | 'delivered' | 'on_trip';
  deliveredAt?: string;
  paymentCollected?: boolean;
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  isTableQr?: boolean;
  tableQrSessionId?: string;
  waiterNotified?: boolean;
}

export interface Table {
  id: string;
  number: string;
  branchId: string;
  capacity: number; // chair count
  chairs?: number; // customizable chair count
  floor?: string; // e.g. 'Ground Floor', '1st Floor Family Lounge', 'Rooftop Terrace'
  status: TableStatus;
  currentOrderId?: string;
  seatedAt?: string;
  reservedFor?: string;
  pin?: string;
  qrCode?: string;
  qrGeneratedAt?: string;
  qrExpiresAt?: string;
  qrValidMinutes?: number;
  allowQrOrderOnReserved?: boolean;
  assignedWaiterId?: string;
  assignedWaiterName?: string;
}

export interface TableSession {
  id: string;
  tableId: string;
  tableNumber: string;
  branchId: string;
  floor: string;
  startedAt: string;
  endedAt?: string;
  durationMin?: number;
  customerName?: string;
  orderId?: string;
  orderNumber?: string;
  waiterName: string;
  totalAmount: number;
  status: 'occupied' | 'completed';
  createdAt?: string;
}

export interface FooterSettings {
  helpline: string;
  email: string;
  hours: string;
  addressLahore: string;
  addressIslamabad: string;
  addressKarachi: string;
  tagline: string;
  copyrightText: string;
  // Customer Order Routing & Kitchen Dispatch Settings
  orderRoutingSupportFirst?: boolean; // When true, incoming customer orders go directly to Customer Services (Support) first
  autoForwardKitchenMin?: number; // Custom auto-forward time in minutes (e.g. 1, 2, 3, 5, 10 min).
  autoForwardMode?: 'manual' | 'timed'; // 'manual' = Support clicks ready; 'timed' = auto-forward after custom time
  // Web Home Notification Banner (Appears directly below the Order Mode Row on Web Home; editable by Manager)
  homeNotificationEnabled?: boolean;
  homeNotificationBadge?: string;
  homeNotificationTitle?: string;
  homeNotificationMessage?: string;
  homeNotificationType?: 'promo' | 'info' | 'warning' | 'success';
  homeNotificationUpdatedBy?: string;
  homeNotificationUpdatedAt?: string;
}

export interface HeroBanner {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  imageUrl: string;
  categoryLink?: string;
  active: boolean;
}

export interface DealCard {
  title: string;
  subtitle: string;
  price: string;
  tag: string;
  imageUrl: string;
  categoryLink?: string;
}

export interface Announcement {
  id: string;
  title: string;
  tag: string;
  description: string;
  imageUrl?: string;
  validUntil?: string;
  branchId?: string;
  branchName?: string;
  discountPercent?: number;
  badgeColor?: string;
  createdAt?: string;
}

export interface BannerDealApprovalRequest {
  id: string;
  type: 'banner' | 'deal';
  action: 'update' | 'add' | 'delete';
  targetId?: string;
  submittedBy: string;
  submittedByRole: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  bannerData?: HeroBanner;
  dealData?: DealCard;
  decisionBy?: string;
  decisionAt?: string;
  notes?: string;
}

export interface CashShift {
  id: string;
  cashierId: string;
  cashierName: string;
  branchId: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  cashCollected: number;
  expectedCash: number;
  countedCash?: number;
  difference?: number;
  differenceReason?: string;
  status: 'open' | 'closed';
}

export interface RefundRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  branchId: string;
  amount: number;
  reason: string;
  requestedBy: string;
  status: 'requested' | 'approved' | 'rejected' | 'completed';
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ManagerAccessRequest {
  branchId: string;
  status: 'none' | 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  requestedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  branchId?: string;
  action:
  | 'price_change'
  | 'refund_approved'
  | 'refund_rejected'
  | 'role_change'
  | 'order_cancelled'
  | 'timing_settings'
  | 'table_override'
  | 'account_suspended'
  | 'account_activated'
  | 'account_deactivated'
  | 'account_created'
  | 'account_deleted'
  | 'account_updated'
  | 'busy_mode_toggled'
  | 'shift_verified'
  | 'manager_access_requested'
  | 'manager_access_granted'
  | 'manager_access_rejected'
  | 'manager_access_revoked'
  | string;
  details: string;
  oldValue?: string;
  newValue?: string;
}

export type CancellationActor = 'customer' | 'staff' | 'branch_offline';

export interface CancellationAttribution {
  isCustomer: boolean;
  actor: CancellationActor;
  badge: string;
  title: string;
  description: string;
}

/**
 * True once the order has reached the kitchen: sent by staff, accepted or later, or its
 * auto-forward time has passed (the kitchen screen shows it from then on). From this point a
 * customer can no longer cancel; they can only add items until the order is ready.
 */
export function isOrderInKitchen(o: {
  status?: string;
  sentToKitchen?: boolean;
  forwardToKitchenAt?: string;
}): boolean {
  if (o.sentToKitchen) return true;
  if (o.status && o.status !== 'placed') return true;
  if (o.forwardToKitchenAt) {
    const t = new Date(o.forwardToKitchenAt).getTime();
    if (!isNaN(t) && Date.now() >= t) return true;
  }
  return false;
}

export function getCancellationAttribution(ord?: {
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: string;
} | null): CancellationAttribution {
  if (!ord) {
    return {
      isCustomer: false,
      actor: 'staff',
      badge: 'CANCELLED (BY STAFF)',
      title: 'Order Cancelled by Staff',
      description: 'This order was cancelled by cafe staff prior to receipt. All records and receipts are saved permanently in your Order History.',
    };
  }

  const rawActor = ord.cancelledBy?.toLowerCase();
  if (rawActor === 'customer' || rawActor === 'user') {
    return {
      isCustomer: true,
      actor: 'customer',
      badge: 'CANCELLED (BY YOU)',
      title: 'Order Cancelled by You',
      description: 'You cancelled this order. All records and receipts are saved permanently in your Order History.',
    };
  }

  if (rawActor === 'branch_offline' || rawActor === 'branch_closed') {
    return {
      isCustomer: false,
      actor: 'branch_offline',
      badge: 'CANCELLED (BRANCH CLOSED)',
      title: 'Cancelled (Branch Closed Offline)',
      description: 'This order was cancelled because the branch was closed offline prior to receipt. All records and receipts are saved permanently in your Order History.',
    };
  }

  if (rawActor === 'staff' || rawActor === 'cashier' || rawActor === 'manager' || rawActor === 'owner') {
    return {
      isCustomer: false,
      actor: 'staff',
      badge: 'CANCELLED (BY STAFF)',
      title: 'Order Cancelled by Staff',
      description: 'This order was cancelled by cafe staff prior to receipt. All records and receipts are saved permanently in your Order History.',
    };
  }

  // Fallback inspect text in cancellationReason and notes
  const text = `${ord.cancellationReason || ''} ${ord.notes || ''}`.toLowerCase();
  if (
    text.includes('customer') ||
    text.includes('by you') ||
    text.includes('deselected') ||
    text.includes('user cancelled') ||
    text.includes('cancelled by user')
  ) {
    return {
      isCustomer: true,
      actor: 'customer',
      badge: 'CANCELLED (BY YOU)',
      title: 'Order Cancelled by You',
      description: 'You cancelled this order. All records and receipts are saved permanently in your Order History.',
    };
  }

  if (
    text.includes('branch closed') ||
    text.includes('shutdown') ||
    text.includes('offline')
  ) {
    return {
      isCustomer: false,
      actor: 'branch_offline',
      badge: 'CANCELLED (BRANCH CLOSED)',
      title: 'Cancelled (Branch Closed Offline)',
      description: 'This order was cancelled because the branch was closed offline prior to receipt. All records and receipts are saved permanently in your Order History.',
    };
  }

  // Default fallback is staff cancellation
  return {
    isCustomer: false,
    actor: 'staff',
    badge: 'CANCELLED (BY STAFF)',
    title: 'Order Cancelled by Staff',
    description: 'This order was cancelled by cafe staff prior to receipt. All records and receipts are saved permanently in your Order History.',
  };
}

export type NotificationCategory =
  | 'order_placed'
  | 'takeaway'
  | 'dine_in'
  | 'delivery'
  | 'kitchen'
  | 'staff_alert'
  | 'promo'
  | 'system';

export type NotificationTargetPlatform = 'all' | 'web' | 'app';

export type NotificationEventKey =
  | 'orderPlaced'
  | 'sentToKitchen'
  | 'cooking'
  | 'orderReady'
  | 'outForDelivery'
  | 'orderServed'
  | 'orderCompleted'
  | 'orderCancelled'
  | 'waiterAssigned'
  | 'riderAssigned'
  | 'paymentReceived';

export interface RecipientNotificationRules {
  customer: {
    orderPlaced: boolean;
    cooking: boolean;
    orderReady: boolean;
    outForDelivery: boolean;
    orderCompleted: boolean;
    orderCancelled: boolean;
  };
  rider: {
    orderAssigned: boolean;
    orderReady: boolean;
    orderCancelled: boolean;
  };
  waiter: {
    orderAssigned: boolean;
    orderReady: boolean;
    orderCancelled: boolean;
  };
  kitchen: {
    newOrderPlaced: boolean;
    orderCancelled: boolean;
  };
  cashierAndManager: {
    orderPlaced: boolean;
    orderCancelled: boolean;
    paymentReceived: boolean;
  };
}

export const DEFAULT_RECIPIENT_NOTIFICATION_RULES: RecipientNotificationRules = {
  customer: {
    orderPlaced: true,
    cooking: true,
    orderReady: true,
    outForDelivery: true,
    orderCompleted: true,
    orderCancelled: true,
  },
  rider: {
    orderAssigned: true,
    orderReady: true,
    orderCancelled: true,
  },
  waiter: {
    orderAssigned: true,
    orderReady: true,
    orderCancelled: true,
  },
  kitchen: {
    newOrderPlaced: true,
    orderCancelled: true,
  },
  cashierAndManager: {
    orderPlaced: true,
    orderCancelled: true,
    paymentReceived: true,
  },
};

export interface NotificationSettings {
  id?: string;
  defaultPlatform: NotificationTargetPlatform;
  notifyCustomer: boolean;
  notifyConcernedRider: boolean;
  notifyConcernedWaiter: boolean;
  notifyKitchen: boolean;
  notifyCashierAndManager: boolean;
  events: Record<NotificationEventKey, boolean>;
  recipientRules?: RecipientNotificationRules;
  updatedBy?: string;
  updatedByRole?: string;
  updatedAt?: string;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  id: 'global',
  defaultPlatform: 'all',
  notifyCustomer: true,
  notifyConcernedRider: true,
  notifyConcernedWaiter: true,
  notifyKitchen: true,
  notifyCashierAndManager: true,
  events: {
    orderPlaced: true,
    sentToKitchen: true,
    cooking: true,
    orderReady: true,
    outForDelivery: true,
    orderServed: true,
    orderCompleted: true,
    orderCancelled: true,
    waiterAssigned: true,
    riderAssigned: true,
    paymentReceived: true,
  },
  recipientRules: DEFAULT_RECIPIENT_NOTIFICATION_RULES,
};

export interface ReceiverNotificationPreferences {
  receiverKey?: string;
  receiverLabel?: string;
  receiveNotifications: boolean;
  showLiveToast: boolean;
  mutedCategories?: string[];
  events: Record<NotificationEventKey, boolean>;
  updatedAt?: string;
}

export const DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES: ReceiverNotificationPreferences = {
  receiveNotifications: true,
  showLiveToast: true,
  mutedCategories: [],
  events: {
    orderPlaced: true,
    sentToKitchen: true,
    cooking: true,
    orderReady: true,
    outForDelivery: true,
    orderServed: true,
    orderCompleted: true,
    orderCancelled: true,
    waiterAssigned: true,
    riderAssigned: true,
    paymentReceived: true,
  },
};

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: NotificationCategory;
  branchId?: string;
  orderId?: string;
  orderNumber?: string;
  orderType?: OrderType;
  senderId?: string;
  senderName?: string;
  senderRole?: Role | 'system';
  targetRoles: Array<Role | 'all'>;
  targetPlatform?: NotificationTargetPlatform;
  targetUserId?: string;
  targetCustomerPhone?: string;
  targetCustomerName?: string;
  targetWaiterId?: string;
  targetWaiterName?: string;
  targetRiderId?: string;
  targetRiderName?: string;
  eventKey?: string;
  readBy: string[];
  createdAt: string;
}



