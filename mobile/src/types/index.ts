export type MobileRole = 'customer' | 'platform_owner' | 'branch_manager' | 'cashier' | 'kitchen_staff' | 'floor_staff' | 'delivery_staff';

export type UserStatus = 'active' | 'suspended' | 'deactivated';

export interface SavedDeliveryAddress {
  id: string;
  label: string;
  address: string;
  city?: string;
  coordinates?: { lat: number; lng: number };
  isDefault?: boolean;
}

export interface MobileUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: MobileRole;
  branchId?: string;
  status: UserStatus;
  address?: string;
  savedAddresses?: SavedDeliveryAddress[];
  riderAvailability?: 'available' | 'busy' | 'offline';
  riderTotalDeliveries?: number;
  riderActiveOrderId?: string;
  assignedFloor?: string;
  assignedTableNumbers?: string[];
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  openingHours: string;
  isOpen: boolean;
  isBusy: boolean;
  prepTimeEstimateMin: number;
  fullEditWindowMin?: number;
  stopAddOnsMinBeforeReady?: number;
  deliveryEnabled: boolean;
  latitude: number;
  longitude: number;
  coordinates?: { lat: number; lng: number };
  maxOrderDistanceKm: number;
  tableQrMaxDistanceMeters: number;
  paymentSettings?: any;
  minDeliveryAmount?: number;
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
  branchAvailability: Record<string, boolean>;
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
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  originalSubtotal: number;
  addOnSubtotal: number;
  tax: number;
  total: number;
  createdAt: string;
  preparationStartedAt?: string;
  completedAt?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: 'customer' | 'staff' | 'branch_offline' | string;
  deliveryAddress?: string;
  paymentMethod: string;
  customerCoordinates?: { lat: number; lng: number };
  assignedRiderId?: string;
  assignedRiderName?: string;
  riderStatus?: 'assigned' | 'accepted' | 'picked_up' | 'en_route' | 'delivered' | 'on_trip';
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  isTableQr?: boolean;
  isWalkIn?: boolean;
  sentToKitchen?: boolean;
  sentToKitchenAt?: string;
  forwardToKitchenAt?: string;
  cashierId?: string;
  cashierName?: string;
  shiftId?: string;
  paymentCollected?: boolean;
  deliveredAt?: string;
  version?: number;
}

export type TableStatus = 'available' | 'reserved' | 'occupied' | 'cleaning' | 'unavailable';

export interface Table {
  id: string;
  number: string;
  branchId: string;
  capacity: number;
  floor: string;
  status: TableStatus;
  currentOrderId?: string;
  pin?: string;
  qrCode?: string;
  assignedWaiterId?: string;
  assignedWaiterName?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  branchId?: string | null;
  action: string;
  details: string;
}

export interface Announcement {
  id: string;
  title: string;
  tag: string;
  description: string;
  validUntil?: string;
  branchId?: string;
  branchName?: string;
  discountPercent?: number;
  badgeColor?: string;
  createdAt?: string;
}

export interface CartItem extends OrderItem {}

export type CancellationActor = 'customer' | 'staff' | 'branch_offline';

export interface CancellationAttribution {
  isCustomer: boolean;
  actor: CancellationActor;
  badge: string;
  title: string;
  description: string;
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
      description: 'This order was cancelled by cafe staff prior to receipt. All records are saved in Order History.',
    };
  }

  const rawActor = ord.cancelledBy?.toLowerCase();
  if (rawActor === 'customer' || rawActor === 'user') {
    return {
      isCustomer: true,
      actor: 'customer',
      badge: 'CANCELLED (BY YOU)',
      title: 'Order Cancelled by You',
      description: 'You cancelled this order. All records are saved in Order History.',
    };
  }

  if (rawActor === 'branch_offline' || rawActor === 'branch_closed') {
    return {
      isCustomer: false,
      actor: 'branch_offline',
      badge: 'CANCELLED (BRANCH CLOSED)',
      title: 'Cancelled (Branch Closed)',
      description: 'This order was cancelled because the branch went offline before receipt. All records are saved in Order History.',
    };
  }

  if (rawActor === 'staff' || rawActor === 'cashier' || rawActor === 'manager' || rawActor === 'owner') {
    return {
      isCustomer: false,
      actor: 'staff',
      badge: 'CANCELLED (BY STAFF)',
      title: 'Order Cancelled by Staff',
      description: 'This order was cancelled by cafe staff prior to receipt. All records are saved in Order History.',
    };
  }

  const text = `${ord.cancellationReason || ''} ${ord.notes || ''}`.toLowerCase();
  if (
    text.includes('customer') ||
    text.includes('by you') ||
    text.includes('deselected') ||
    text.includes('user cancelled') ||
    text.includes('cancelled by customer')
  ) {
    return {
      isCustomer: true,
      actor: 'customer',
      badge: 'CANCELLED (BY YOU)',
      title: 'Order Cancelled by You',
      description: 'You cancelled this order. All records are saved in Order History.',
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
      title: 'Cancelled (Branch Closed)',
      description: 'This order was cancelled because the branch went offline before receipt. All records are saved in Order History.',
    };
  }

  return {
    isCustomer: false,
    actor: 'staff',
    badge: 'CANCELLED (BY STAFF)',
    title: 'Order Cancelled by Staff',
    description: 'This order was cancelled by cafe staff prior to receipt. All records are saved in Order History.',
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
  senderRole?: MobileRole | 'system';
  targetRoles: Array<MobileRole | 'all'>;
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



