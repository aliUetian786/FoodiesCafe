export type Role =
  | 'platform_owner'
  | 'branch_manager'
  | 'branch_representative'
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
}

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

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
  deliveryAddress?: string;
  version: number;
  paymentMethod: string;
  sentToKitchen?: boolean;
  sentToKitchenAt?: string;
  forwardToKitchenAt?: string;
  autoForwardCustomMin?: number;
  cashierId?: string;
  cashierName?: string;
  isWalkIn?: boolean;
  customerCoordinates?: { lat: number; lng: number };
  assignedRiderId?: string;
  assignedRiderName?: string;
  riderStatus?: 'assigned' | 'picked_up' | 'en_route' | 'delivered';
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

export interface ComplaintMessage {
  id: string;
  sender: 'customer' | 'representative' | 'manager';
  senderName: string;
  text: string;
  timestamp: string;
}

export interface Complaint {
  id: string;
  ticketNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  branchId: string;
  orderId?: string;
  orderNumber?: string;
  subject: string;
  status: 'new' | 'in_progress' | 'resolved' | 'closed';
  messages: ComplaintMessage[];
  assignedTo?: string;
  createdAt: string;
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

