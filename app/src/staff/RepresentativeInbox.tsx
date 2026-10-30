'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Complaint, Order } from '@/types/cafe';
import {
  MessageSquare,
  Send,
  User,
  Phone,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  CornerUpRight,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  Bike,
  MapPin,
  Clock,
  Sparkles,
  Search,
  Receipt,
  Printer,
  Utensils,
  ChevronRight,
  ExternalLink,
  DollarSign,
  Package,
  X,
  Filter,
  Lock,
  Headphones,
  ChefHat,
  Timer,
} from 'lucide-react';

const parseTimestampMs = (ts?: string): number => {
  if (!ts) return 0;
  const t = new Date(ts).getTime();
  return isNaN(t) ? 0 : t;
};

const formatMessageTime = (timestamp?: string): string => {
  if (!timestamp) return 'Just now';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return timestamp;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const getNormalizedDate = (timestamp?: string): Date => {
  if (!timestamp) return new Date();
  const d = new Date(timestamp);
  if (!isNaN(d.getTime())) return d;
  if (timestamp.toLowerCase().includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  return new Date();
};

// Haversine distance calculator in kilometers
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function getOrderCoords(order: Order, branchLat: number, branchLng: number): { lat: number; lng: number } {
  if (order.customerCoordinates?.lat && order.customerCoordinates?.lng) {
    return { lat: order.customerCoordinates.lat, lng: order.customerCoordinates.lng };
  }
  let hash = 0;
  const str = order.deliveryAddress || order.id || order.orderNumber || '';
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = ((Math.abs(hash) % 40) - 20) * 0.0012;
  const lngOffset = ((Math.abs(hash >> 3) % 40) - 20) * 0.0012;
  return {
    lat: (branchLat || 31.5126) + latOffset,
    lng: (branchLng || 74.3436) + lngOffset,
  };
}

const getDayKey = (timestamp?: string): string => {
  const d = getNormalizedDate(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const getDayDividerLabel = (timestamp?: string): string => {
  const d = getNormalizedDate(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfTarget) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const LiveOrderCountdown: React.FC<{ forwardToKitchenAt?: string }> = ({ forwardToKitchenAt }) => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!forwardToKitchenAt) return null;
    const diff = Math.floor((new Date(forwardToKitchenAt).getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    if (!forwardToKitchenAt) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      const diff = Math.floor((new Date(forwardToKitchenAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(diff > 0 ? diff : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [forwardToKitchenAt]);

  if (secondsLeft === null) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <span
      style={{
        fontSize: '11px',
        color: secondsLeft <= 30 ? '#DC2626' : '#D97706',
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {timeStr}
    </span>
  );
};

interface RepresentativeScreenProps {
  initialTab?: 'support' | 'takeaway' | 'delivery' | 'dine_in';
}

export const RepresentativeScreen: React.FC<RepresentativeScreenProps> = ({
  initialTab = 'support',
}) => {
  const {
    complaints,
    sendComplaintReply,
    updateComplaintStatus,
    submitComplaint,
    orders,
    updateOrderStatus,
    cancelOrder,
    currentBranch,
    requestRefund,
    addToast,
    allowRepresentativeMenuEdit,
    users,
    currentRole,
    decideRefund,
    refundRequests,
    sendOrderToKitchen,
    setOrderKitchenForwardTime,
    footerSettings,
    updateFooterSettings,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    fetchOlderOrders,
    filterOrdersToToday,
    assignRiderToOrder,
    unassignRiderFromOrder,
  } = useApp();

  const isManager = currentRole === 'branch_manager';

  const branchRiders = useMemo(() => {
    return users.filter(
      (u) => u.role === 'delivery_staff' && (!u.branchId || u.branchId === currentBranch.id)
    );
  }, [users, currentBranch.id]);

  const freeRiders = useMemo(() => {
    return branchRiders.filter((r) => {
      const isOffline = r.riderAvailability === 'offline';
      const isBusy = r.riderAvailability === 'busy';
      const activeCount = orders.filter(
        (o) => o.assignedRiderId === r.id && o.status !== 'completed' && o.status !== 'cancelled'
      ).length;
      return (!r.status || r.status === 'active') && !isOffline && !isBusy && activeCount === 0;
    });
  }, [branchRiders, orders]);

  const [activeTab, setActiveTab] = useState<'support' | 'takeaway' | 'delivery' | 'dine_in'>(initialTab);
  const [customTimeModalOrderId, setCustomTimeModalOrderId] = useState<string | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState<number>(3);
  const [timerScope, setTimerScope] = useState<'specific' | 'whole'>('specific');
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('Customer requested order cancellation');
  const [selectedOrderForMenu, setSelectedOrderForMenu] = useState<Order | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [orderHistoryFilter, setOrderHistoryFilter] = useState<'all' | 'active' | 'completed'>('all');

  const handleConfirmCancelOrder = () => {
    if (!cancelModalOrder) return;
    cancelOrder(cancelModalOrder.id, cancelReasonInput || 'Cancelled by Customer Support prior to kitchen dispatch');
    addToast({
      type: 'warning',
      title: 'Order Cancelled',
      message: `Order #${cancelModalOrder.orderNumber} cancelled and removed from support table.`,
    });
    setCancelModalOrder(null);
  };

  const handlePrintReceipt = (ord: Order) => {
    const existingIframe = document.getElementById('foodies-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'foodies-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const itemsHtml = ord.items
      .map(
        (item) => `
        <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 700; margin-bottom: 4px; border-bottom: 1px dotted #CBD5E1; padding-bottom: 3px;">
          <span>${item.quantity} × ${item.name}${item.size ? ` (${item.size})` : ''}</span>
          <span>Rs. ${(item.unitPrice * item.quantity).toLocaleString()}</span>
        </div>
      `
      )
      .join('');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Paid Slip #${ord.orderNumber}</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @page {
              size: 80mm auto;
              margin: 0 !important;
              padding: 0 !important;
            }
            * {
              box-sizing: border-box !important;
              margin: 0;
              padding: 0;
              font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #FFFFFF !important;
              color: #000000 !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
            }
            .receipt-container {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 6px 8px 4px 8px !important;
              border: none !important;
              border-radius: 0 !important;
              background: #FFFFFF !important;
              position: relative !important;
              overflow: hidden !important;
              box-shadow: none !important;
              height: auto !important;
              min-height: 0 !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- 135-degree rotated Cafe Logo Watermark -->
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none; z-index: 0;">
              <img src="/logo.png" alt="Logo Watermark" style="width: 80%; height: 80%; object-fit: contain; transform: rotate(135deg); opacity: 0.15; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact;" />
            </div>
            
            <div style="position: relative; z-index: 1;">
              <div style="text-align: center; border-bottom: 1.5px dashed #000000; padding-bottom: 5px; margin-bottom: 6px;">
                <h3 style="font-size: 19px; font-weight: 900; margin: 0; font-family: 'Outfit', sans-serif; letter-spacing: 0.5px;">FOODIES CAFE</h3>
                <div style="font-size: 11px; font-weight: 600; color: #475569; margin-top: 1px;">${currentBranch.name} · Paid Slip</div>
                <div style="display: inline-block; font-size: 12.5px; font-weight: 850; color: #EA580C; background: #FFF7ED; padding: 2px 8px; border-radius: 4px; margin-top: 3px; border: 1px solid #FFEDD5;">
                  ${ord.type.toUpperCase()} ${ord.tableNumber ? `· TABLE ${ord.tableNumber}` : ''}
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; color: #334155; font-weight: 600;">
                <span>Slip: <strong>#${ord.orderNumber}</strong></span>
                <span>${ord.createdAt}</span>
              </div>
              <div style="font-size: 11px; margin-bottom: 5px; color: #334155;">
                Customer: <strong>${ord.customerName}</strong> (${ord.customerPhone})
              </div>

              <div style="border-top: 1px solid #CBD5E1; padding-top: 5px; margin-bottom: 6px;">
                ${itemsHtml}
              </div>

              <div style="border-top: 1.5px dashed #000000; padding-top: 5px; margin-bottom: 5px; font-size: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px; font-weight: 600; color: #475569;">
                  <span>Subtotal:</span>
                  <span>Rs. ${Number(ord.originalSubtotal).toLocaleString()}</span>
                </div>
                ${ord.addOnSubtotal > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 2px; color: #EA580C; font-weight: 600;">
                    <span>Add-ons:</span>
                    <span>+ Rs. ${Number(ord.addOnSubtotal).toLocaleString()}</span>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 900; color: #000000; margin-top: 4px; padding-top: 3px; border-top: 1px solid #CBD5E1;">
                  <span>TOTAL PAID:</span>
                  <span style="color: #EA580C;">Rs. ${Number(ord.total).toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #16A34A; margin-top: 3px;">
                  <span>PAYMENT STATUS:</span>
                  <span>${ord.paymentStatus === 'paid' ? 'PAID IN FULL ✓' : ord.paymentStatus.toUpperCase()} (${ord.paymentMethod || 'Cash'})</span>
                </div>
              </div>

              <div style="text-align: center; font-size: 10px; font-weight: 600; color: #64748B; border-top: 1px dashed #CBD5E1; padding-top: 4px; margin-top: 2px;">
                Thank you for dining with FoodiesCafe!
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
      }, 2000);
    }, 300);
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Branch filtered orders
  const branchOrders = useMemo(() => {
    return orders.filter((o) => !o.branchId || o.branchId === currentBranch.id);
  }, [orders, currentBranch.id]);

  // Track delivery orders that Customer Support has explicitly unassigned so auto-selection does not re-force
  const manuallyUnassignedOrdersRef = useRef<Set<string>>(new Set());

  // Automatically select and assign the nearest available rider for any active delivery order without a rider
  useEffect(() => {
    const bLat = currentBranch.latitude || 31.5126;
    const bLng = currentBranch.longitude || 74.3436;

    const unassignedDeliveryOrders = branchOrders.filter(
      (o) =>
        o.type === 'delivery' &&
        !o.assignedRiderId &&
        o.status !== 'completed' &&
        o.status !== 'cancelled' &&
        !manuallyUnassignedOrdersRef.current.has(o.id)
    );

    if (unassignedDeliveryOrders.length === 0) return;

    unassignedDeliveryOrders.forEach((ord) => {
      const targetCoords = getOrderCoords(ord, bLat, bLng);
      const candidates = branchRiders
        .filter((r) => (!r.status || r.status === 'active') && r.riderAvailability !== 'busy' && r.riderAvailability !== 'offline')
        .map((r) => {
          const riderActiveOrders = orders.filter(
            (o) => o.assignedRiderId === r.id && o.id !== ord.id && o.status !== 'completed' && o.status !== 'cancelled'
          );
          let minDist = calculateDistanceKm(bLat, bLng, targetCoords.lat, targetCoords.lng);
          riderActiveOrders.forEach((actOrd) => {
            const actCoords = getOrderCoords(actOrd, bLat, bLng);
            const d = calculateDistanceKm(actCoords.lat, actCoords.lng, targetCoords.lat, targetCoords.lng);
            if (d < minDist) {
              minDist = d;
            }
          });
          return {
            rider: r,
            distanceKm: minDist,
            activeCount: riderActiveOrders.length,
          };
        })
        .sort((a, b) => {
          if (Math.abs(a.distanceKm - b.distanceKm) > 0.05) {
            return a.distanceKm - b.distanceKm;
          }
          return a.activeCount - b.activeCount;
        });

      const best = candidates[0];
      if (best) {
        assignRiderToOrder(ord.id, best.rider.id, true);
      }
    });
  }, [branchOrders, branchRiders, currentBranch.latitude, currentBranch.longitude, orders, assignRiderToOrder]);

  // Orders routed directly to Customer Services awaiting kitchen dispatch (excluding cancelled)
  const ordersAwaitingKitchen = useMemo(() => {
    return branchOrders.filter((o) => o.status === 'placed' && !o.sentToKitchen);
  }, [branchOrders]);

  // ==========================================
  // TAKEAWAY ORDERS LIFECYCLE FOR BRANCH
  // ==========================================
  const allTakeawayOrders = useMemo(() => {
    return branchOrders.filter((o) => o.type === 'takeaway');
  }, [branchOrders]);

  const arrivedTakeawayOrders = useMemo(() => {
    return allTakeawayOrders.filter((o) => o.status === 'placed' || o.status === 'accepted');
  }, [allTakeawayOrders]);

  const preparingTakeawayOrders = useMemo(() => {
    return allTakeawayOrders.filter((o) => o.status === 'preparing');
  }, [allTakeawayOrders]);

  const readyTakeawayOrders = useMemo(() => {
    return allTakeawayOrders.filter((o) => o.status === 'ready');
  }, [allTakeawayOrders]);

  const completedTakeawayOrders = useMemo(() => {
    return allTakeawayOrders.filter((o) => o.status === 'completed');
  }, [allTakeawayOrders]);

  // ==========================================
  // DELIVERY ORDERS LIFECYCLE FOR BRANCH
  // ==========================================
  const allDeliveryOrders = useMemo(() => {
    return branchOrders.filter((o) => o.type === 'delivery');
  }, [branchOrders]);

  const arrivedDeliveryOrders = useMemo(() => {
    return allDeliveryOrders.filter((o) => o.status === 'placed' || o.status === 'accepted');
  }, [allDeliveryOrders]);

  const preparingDeliveryOrders = useMemo(() => {
    return allDeliveryOrders.filter((o) => o.status === 'preparing');
  }, [allDeliveryOrders]);

  const readyDeliveryOrders = useMemo(() => {
    return allDeliveryOrders.filter((o) => o.status === 'ready');
  }, [allDeliveryOrders]);

  const outDeliveryOrders = useMemo(() => {
    return allDeliveryOrders.filter((o) => o.status === 'out_for_delivery');
  }, [allDeliveryOrders]);

  const completedDeliveryOrders = useMemo(() => {
    return allDeliveryOrders.filter((o) => o.status === 'completed');
  }, [allDeliveryOrders]);

  // ==========================================
  // DINE-IN ORDERS LIFECYCLE FOR BRANCH
  // ==========================================
  const allDineInOrders = useMemo(() => {
    return branchOrders.filter((o) => o.type === 'dine_in');
  }, [branchOrders]);

  const arrivedDineInOrders = useMemo(() => {
    return allDineInOrders.filter((o) => o.status === 'placed' || o.status === 'accepted');
  }, [allDineInOrders]);

  const preparingDineInOrders = useMemo(() => {
    return allDineInOrders.filter((o) => o.status === 'preparing');
  }, [allDineInOrders]);

  const readyDineInOrders = useMemo(() => {
    return allDineInOrders.filter((o) => o.status === 'ready' || o.status === 'served');
  }, [allDineInOrders]);

  const completedDineInOrders = useMemo(() => {
    return allDineInOrders.filter((o) => o.status === 'completed');
  }, [allDineInOrders]);

  // ==========================================
  // ORDER LOOKUP & FILTER SEARCH STATES
  // ==========================================
  const [takeawayStatusTab, setTakeawayStatusTab] = useState<'all' | 'arrived' | 'preparing' | 'ready' | 'completed'>('all');
  const [takeawayFilterOption, setTakeawayFilterOption] = useState<string>('all');
  const [takeawaySearch, setTakeawaySearch] = useState('');

  const handleTakeawayFilterChange = (val: string) => {
    setTakeawayFilterOption(val);
    if (val === 'ready_pickup' || val === 'ready') {
      setTakeawayStatusTab('ready');
    } else if (val === 'arrived_badge' || val === 'arrived') {
      setTakeawayStatusTab('arrived');
    } else if (val === 'preparing') {
      setTakeawayStatusTab('preparing');
    } else if (val === 'completed') {
      setTakeawayStatusTab('completed');
    } else {
      setTakeawayStatusTab('all');
    }
  };
  const [deliveryStatusTab, setDeliveryStatusTab] = useState<'all' | 'arrived' | 'preparing' | 'ready' | 'out' | 'completed'>('all');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [shippingFilterOption, setShippingFilterOption] = useState<'ready_ship' | 'arrived'>('ready_ship');
  const [selectedFreeRiderId, setSelectedFreeRiderId] = useState<string>('');
  const [dineInStatusTab, setDineInStatusTab] = useState<'all' | 'arrived' | 'preparing' | 'ready' | 'completed'>('all');
  const [dineInFilterOption, setDineInFilterOption] = useState<string>('all');
  const [dineInSearch, setDineInSearch] = useState('');

  const handleDineInFilterChange = (val: string) => {
    setDineInFilterOption(val);
    if (val === 'ready_served' || val === 'ready') {
      setDineInStatusTab('ready');
    } else if (val === 'arrived_badge' || val === 'arrived') {
      setDineInStatusTab('arrived');
    } else if (val === 'preparing') {
      setDineInStatusTab('preparing');
    } else if (val === 'completed') {
      setDineInStatusTab('completed');
    } else {
      setDineInStatusTab('all');
    }
  };

  const getOrderStatusBadge = (status: string, type: string) => {
    switch (status) {
      case 'placed':
      case 'accepted':
        return { label: 'ORDER ARRIVED', bg: '#FEF3C7', color: '#92400E' };
      case 'preparing':
        return { label: 'COOKING IN KITCHEN', bg: '#DBEAFE', color: '#1E40AF' };
      case 'ready':
        if (type === 'takeaway') return { label: 'READY TO TAKE', bg: '#DCFCE7', color: '#166534' };
        if (type === 'delivery') return { label: 'READY TO SHIP', bg: '#DCFCE7', color: '#166534' };
        return { label: 'READY FOR SERVICE', bg: '#DCFCE7', color: '#166534' };
      case 'out_for_delivery':
        return { label: 'OUT FOR DELIVERY', bg: '#F3E8FF', color: '#6B21A8' };
      case 'served':
        return { label: 'SERVED TO TABLE', bg: '#E0E7FF', color: '#3730A3' };
      case 'completed':
        return { label: 'COMPLETED', bg: '#F1F5F9', color: '#334155' };
      case 'cancelled':
        return { label: 'CANCELLED', bg: '#FEE2E2', color: '#991B1B' };
      default:
        return { label: status.toUpperCase(), bg: '#F1F5F9', color: '#475569' };
    }
  };

  // -------------------------------------------------------------
  // SUPPORT & QUERIES: 3-CATEGORY STATE & CUSTOMER AGGREGATION
  // -------------------------------------------------------------
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'inquiries' | 'orders'>('all');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [readCustomerKeys, setReadCustomerKeys] = useState<Set<string>>(new Set());
  const [readCustomerTimestamps, setReadCustomerTimestamps] = useState<Record<string, number>>({});
  const [targetScrollMessageId, setTargetScrollMessageId] = useState<string | null>(null);
  const [mobileSupportView, setMobileSupportView] = useState<'list' | 'chat'>('list');
  const [showOrderHistoryModal, setShowOrderHistoryModal] = useState<boolean>(false);

  // Build a distinct, unified customer list from complaints, orders, and registered customers
  interface UnifiedCustomer {
    key: string;
    id: string;
    name: string;
    phone: string;
    email?: string;
    deliveryAddress?: string;
    hasActiveInquiry: boolean;
    hasNewComplaint: boolean;
    unreadCount: number;
    activeTicket?: Complaint;
    orderCount: number;
    lastOrder?: Order;
    latestInteractionTime: string;
    latestTimestampMs: number;
  }

  const unifiedCustomers: UnifiedCustomer[] = useMemo(() => {
    const map = new Map<string, UnifiedCustomer>();

    // 1. Add all customers from complaints
    complaints.forEach((cmp) => {
      const phoneClean = cmp.customerPhone?.replace(/\s+/g, '') || cmp.customerId;
      const key = phoneClean || cmp.id;
      const latestMsgMs = cmp.messages && cmp.messages.length > 0
        ? Math.max(...cmp.messages.map((m) => parseTimestampMs(m.timestamp)))
        : parseTimestampMs(cmp.createdAt);

      // Trailing unread messages from customer (messages sent by customer since last reply)
      let cmpUnread = 0;
      if (cmp.messages && cmp.messages.length > 0) {
        for (let i = cmp.messages.length - 1; i >= 0; i--) {
          if (cmp.messages[i].sender === 'customer') {
            cmpUnread++;
          } else {
            break;
          }
        }
      }
      if (cmpUnread === 0 && cmp.status === 'new') {
        cmpUnread = 1;
      }

      const isNewComplaint = (cmp.status === 'new') || (cmp.status === 'in_progress' && cmpUnread > 0);

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          id: cmp.customerId,
          name: cmp.customerName,
          phone: cmp.customerPhone,
          hasActiveInquiry: cmp.status === 'new' || cmp.status === 'in_progress',
          hasNewComplaint: isNewComplaint,
          unreadCount: isNewComplaint ? cmpUnread : 0,
          activeTicket: cmp,
          orderCount: 0,
          latestInteractionTime: cmp.createdAt || 'Recent',
          latestTimestampMs: latestMsgMs,
        });
      } else {
        if (!existing.activeTicket || cmp.status === 'new' || (cmp.status === 'in_progress' && cmpUnread > 0)) {
          existing.activeTicket = cmp;
          existing.hasActiveInquiry = cmp.status === 'new' || cmp.status === 'in_progress';
        }
        if (isNewComplaint) {
          existing.hasNewComplaint = true;
          existing.unreadCount = (existing.unreadCount || 0) + cmpUnread;
        }
        existing.latestTimestampMs = Math.max(existing.latestTimestampMs, latestMsgMs);
      }
    });

    // 2. Add or enrich with customers from orders
    orders.forEach((ord) => {
      if (!ord.customerPhone && !ord.customerName) return;
      const phoneClean = ord.customerPhone?.replace(/\s+/g, '') || ord.customerId;
      const key = phoneClean || ord.customerName;
      const ordMs = parseTimestampMs(ord.createdAt);
      const existing = map.get(key);
      if (existing) {
        existing.orderCount += 1;
        if (!existing.lastOrder) existing.lastOrder = ord;
        if (!existing.deliveryAddress && ord.deliveryAddress) existing.deliveryAddress = ord.deliveryAddress;
        existing.latestTimestampMs = Math.max(existing.latestTimestampMs, ordMs);
      } else {
        map.set(key, {
          key,
          id: ord.customerId || `cust-${ord.id}`,
          name: ord.customerName,
          phone: ord.customerPhone,
          deliveryAddress: ord.deliveryAddress,
          hasActiveInquiry: false,
          hasNewComplaint: false,
          unreadCount: 0,
          orderCount: 1,
          lastOrder: ord,
          latestInteractionTime: ord.createdAt || 'Recent',
          latestTimestampMs: ordMs,
        });
      }
    });

    // 3. Include registered customer users if not already present
    users
      .filter((u) => u.role === 'customer')
      .forEach((u) => {
        const phoneClean = u.phone?.replace(/\s+/g, '') || u.id;
        const key = phoneClean || u.id;
        if (!map.has(key)) {
          map.set(key, {
            key,
            id: u.id,
            name: u.name,
            phone: u.phone,
            email: u.email,
            deliveryAddress: u.address,
            hasActiveInquiry: false,
            hasNewComplaint: false,
            unreadCount: 0,
            orderCount: 0,
            latestInteractionTime: 'Active User',
            latestTimestampMs: 0,
          });
        }
      });

    return Array.from(map.values());
  }, [complaints, orders, users]);

  // Filtered customer list (sorted so incoming complaint senders appear on TOP, followed by latest message time)
  const filteredCustomers = useMemo(() => {
    const list = unifiedCustomers.filter((c) => {
      // Filter by type
      if (customerFilter === 'inquiries' && !c.hasActiveInquiry) return false;
      if (customerFilter === 'orders' && c.orderCount === 0) return false;

      // Filter by search
      if (customerSearch.trim()) {
        const q = customerSearch.toLowerCase().replace(/^#/, '');
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q);
        const matchesTicket = c.activeTicket?.ticketNumber?.toLowerCase().includes(q);
        const matchesOrder = orders.some((o) => {
          const isThisCust =
            (c.id && o.customerId === c.id) ||
            (c.phone && o.customerPhone?.replace(/\s+/g, '') === c.phone?.replace(/\s+/g, '')) ||
            (c.name && o.customerName?.toLowerCase().trim() === c.name?.toLowerCase().trim());
          return isThisCust && (o.orderNumber?.toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
        });
        return matchesName || matchesPhone || matchesTicket || matchesOrder;
      }
      return true;
    });

    // Dynamically sort:
    // 1. Senders with unread incoming complaints appear at the absolute TOP of sender list!
    // 2. Secondary sort: newest incoming / latest message sender first
    return list.sort((a, b) => {
      const aIsRead = readCustomerKeys.has(a.key) || (readCustomerTimestamps[a.key] && readCustomerTimestamps[a.key] >= a.latestTimestampMs);
      const bIsRead = readCustomerKeys.has(b.key) || (readCustomerTimestamps[b.key] && readCustomerTimestamps[b.key] >= b.latestTimestampMs);
      const aUnread = a.hasNewComplaint && !aIsRead;
      const bUnread = b.hasNewComplaint && !bIsRead;

      if (aUnread !== bUnread) {
        return aUnread ? -1 : 1;
      }
      return b.latestTimestampMs - a.latestTimestampMs;
    });
  }, [unifiedCustomers, customerFilter, customerSearch, orders, readCustomerKeys, readCustomerTimestamps]);

  // Ensure active selected customer
  const activeCustomer = useMemo(() => {
    if (selectedCustomerKey) {
      const found = unifiedCustomers.find((c) => c.key === selectedCustomerKey);
      if (found) return found;
    }
    return filteredCustomers[0] || unifiedCustomers[0] || null;
  }, [selectedCustomerKey, unifiedCustomers, filteredCustomers]);

  // Automatically update selected key if empty
  useEffect(() => {
    if (!selectedCustomerKey && activeCustomer) {
      setSelectedCustomerKey(activeCustomer.key);
    }
  }, [selectedCustomerKey, activeCustomer]);

  // Direct orders fetched for the active customer
  const customerOrders = useMemo(() => {
    if (!activeCustomer) return [];
    const activePhoneClean = activeCustomer.phone?.replace(/\s+/g, '');
    const activeName = activeCustomer.name?.toLowerCase().trim();

    return orders.filter((o) => {
      if (activeCustomer.id && o.customerId === activeCustomer.id) return true;
      if (activePhoneClean && o.customerPhone?.replace(/\s+/g, '') === activePhoneClean) return true;
      if (activeName && o.customerName?.toLowerCase().trim() === activeName) return true;
      return false;
    });
  }, [orders, activeCustomer]);

  // Active customer orders (placed, preparing, ready, out_for_delivery)
  const activeCustomerLiveOrders = useMemo(() => {
    return customerOrders.filter(
      (o) => o.status === 'placed' || o.status === 'preparing' || o.status === 'ready' || o.status === 'out_for_delivery'
    );
  }, [customerOrders]);

  // Past orders for customer
  const pastCustomerOrders = useMemo(() => {
    return customerOrders.filter(
      (o) => o.status === 'completed' || o.status === 'cancelled' || o.status === 'served'
    );
  }, [customerOrders]);

  // Filtered orders list for Card 3 scrollable view
  const filteredCustomerOrders = useMemo(() => {
    if (orderHistoryFilter === 'active') return activeCustomerLiveOrders;
    if (orderHistoryFilter === 'completed') return pastCustomerOrders;
    return customerOrders;
  }, [customerOrders, activeCustomerLiveOrders, pastCustomerOrders, orderHistoryFilter]);

  // Total customer spend
  const customerTotalSpend = useMemo(() => {
    return customerOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [customerOrders]);

  // Find active ticket / complaint for selected customer
  const activeTicket = useMemo(() => {
    if (!activeCustomer) return null;
    const phoneClean = activeCustomer.phone?.replace(/\s+/g, '');
    return (
      complaints.find(
        (c) =>
          c.customerId === activeCustomer.id ||
          (phoneClean && c.customerPhone?.replace(/\s+/g, '') === phoneClean)
      ) || activeCustomer.activeTicket || null
    );
  }, [activeCustomer, complaints]);

  // Find all tickets for selected customer (sorted chronologically)
  const activeCustomerTickets = useMemo(() => {
    if (!activeCustomer) return [];
    const phoneClean = activeCustomer.phone?.replace(/\s+/g, '');
    const list = complaints.filter(
      (c) =>
        c.customerId === activeCustomer.id ||
        (phoneClean && c.customerPhone?.replace(/\s+/g, '') === phoneClean)
    );
    if (list.length === 0 && activeCustomer.activeTicket) {
      list.push(activeCustomer.activeTicket);
    }
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activeCustomer, complaints]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Helper to find the first unseen message from this customer
  const findFirstUnreadCustomerMsgId = (cust: UnifiedCustomer): string | null => {
    const ticket = cust.activeTicket;
    if (!ticket || !ticket.messages || ticket.messages.length === 0) return null;

    let lastRepIdx = -1;
    for (let i = ticket.messages.length - 1; i >= 0; i--) {
      if (ticket.messages[i].sender !== 'customer') {
        lastRepIdx = i;
        break;
      }
    }
    const firstUnreadIdx = lastRepIdx + 1;
    if (firstUnreadIdx < ticket.messages.length && ticket.messages[firstUnreadIdx].sender === 'customer') {
      return ticket.messages[firstUnreadIdx].id;
    }
    if (ticket.messages.length > 0 && ticket.messages[0].sender === 'customer') {
      return ticket.messages[0].id;
    }
    return null;
  };

  // Handle clicking customer from list
  const handleSelectCustomer = (cust: UnifiedCustomer) => {
    setSelectedCustomerKey(cust.key);
    setMobileSupportView('chat');

    const isMarkedRead =
      readCustomerKeys.has(cust.key) ||
      (readCustomerTimestamps[cust.key] && readCustomerTimestamps[cust.key] >= cust.latestTimestampMs);
    const hasUnread = cust.hasNewComplaint && !isMarkedRead;

    // Direct scroll to unseen message if customer has unread message
    const unreadMsgId = hasUnread ? findFirstUnreadCustomerMsgId(cust) : null;

    // Mark customer chat as opened and read
    setReadCustomerKeys((prev) => {
      const next = new Set(prev);
      next.add(cust.key);
      return next;
    });
    setReadCustomerTimestamps((prev) => ({
      ...prev,
      [cust.key]: Date.now(),
    }));

    // If ticket is new, advance status to in_progress
    if (cust.activeTicket && cust.activeTicket.status === 'new') {
      updateComplaintStatus(cust.activeTicket.id, 'in_progress');
    }

    if (unreadMsgId) {
      setTargetScrollMessageId(unreadMsgId);
      setTimeout(() => {
        const el = document.getElementById(`rep-msg-${unreadMsgId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    } else {
      setTargetScrollMessageId(null);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  };

  // Auto-scroll chat: directly to unseen message if pending, or to bottom
  useEffect(() => {
    if (targetScrollMessageId) {
      const el = document.getElementById(`rep-msg-${targetScrollMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeCustomerTickets, targetScrollMessageId]);

  // Handle send reply in chat
  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isManager) return; // Manager cannot answer customer queries
    if (!chatInput.trim() || !activeCustomer) return;

    setTargetScrollMessageId(null);

    if (activeTicket) {
      sendComplaintReply(activeTicket.id, chatInput.trim());
    } else {
      // Create new complaint thread directly with this customer
      submitComplaint('Direct Support Inquiry', chatInput.trim(), activeCustomer.lastOrder?.id);
    }

    setChatInput('');
  };

  // Escalate
  const handleEscalate = () => {
    addToast({
      type: 'warning',
      title: 'Ticket Escalated',
      message: `Ticket #${activeTicket?.ticketNumber || 'TKT-LIVE'} escalated to Branch Manager Rashid Mehmood.`,
    });
  };

  // Close / Resolve ticket (throws away in-progress tag completely)
  const handleCloseTicket = () => {
    if (!activeTicket) return;
    updateComplaintStatus(activeTicket.id, 'closed');
    if (activeCustomer) {
      setReadCustomerKeys((prev) => {
        const next = new Set(prev);
        next.add(activeCustomer.key);
        return next;
      });
    }
    setTargetScrollMessageId(null);
    addToast({
      type: 'success',
      title: 'Ticket Resolved',
      message: `Inquiry #${activeTicket.ticketNumber} marked resolved and matter completed.`,
    });
  };

  const renderOrderCard = (ord: Order) => {
    const statusInfo = getOrderStatusBadge(ord.status, ord.type);
    const isAwaitingKitchen = !ord.sentToKitchen && (ord.status === 'placed' || ord.status === 'accepted');

    const bLat = currentBranch.latitude || 31.5126;
    const bLng = currentBranch.longitude || 74.3436;
    const targetCoords = ord.type === 'delivery' ? getOrderCoords(ord, bLat, bLng) : null;

    // Find nearest available candidate rider for this delivery order
    const availableRidersWithDist =
      ord.type === 'delivery' && targetCoords
        ? branchRiders
            .filter(
              (r) =>
                (!r.status || r.status === 'active') &&
                r.riderAvailability !== 'busy' &&
                r.riderAvailability !== 'offline'
            )
            .map((r) => {
              const riderActiveOrders = orders.filter(
                (o) =>
                  o.assignedRiderId === r.id &&
                  o.id !== ord.id &&
                  o.status !== 'completed' &&
                  o.status !== 'cancelled'
              );
              let minDist = calculateDistanceKm(bLat, bLng, targetCoords.lat, targetCoords.lng);
              let nearestStopRef = 'Branch';
              riderActiveOrders.forEach((actOrd) => {
                const actCoords = getOrderCoords(actOrd, bLat, bLng);
                const d = calculateDistanceKm(actCoords.lat, actCoords.lng, targetCoords.lat, targetCoords.lng);
                if (d < minDist) {
                  minDist = d;
                  nearestStopRef = `Order #${actOrd.orderNumber}`;
                }
              });
              return {
                rider: r,
                distanceKm: minDist,
                activeCount: riderActiveOrders.length,
                nearestStopRef,
              };
            })
            .sort((a, b) => {
              if (Math.abs(a.distanceKm - b.distanceKm) > 0.05) {
                return a.distanceKm - b.distanceKm;
              }
              return a.activeCount - b.activeCount;
            })
        : [];

    const nearestCandidate = availableRidersWithDist[0] || null;
    const isManuallyUnassigned = manuallyUnassignedOrdersRef.current.has(ord.id);
    const effectiveRiderId =
      ord.assignedRiderId || (!isManuallyUnassigned && nearestCandidate ? nearestCandidate.rider.id : '');

    return (
      <div
        key={ord.id}
        onClick={() => setSelectedOrderDetail(ord)}
        style={{
          width: '340px',
          minWidth: '340px',
          maxWidth: '340px',
          minHeight: '185px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          border:
            ord.status === 'placed' || ord.status === 'accepted'
              ? '2px solid #F59E0B'
              : ord.status === 'ready' || ord.status === 'served'
              ? '2px solid #16A34A'
              : ord.status === 'out_for_delivery'
              ? '2px solid #2563EB'
              : '1px solid var(--border-color)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Top: Order #, Status, Time/Table */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 850, fontSize: '15px', color: 'var(--text-main)' }}>
              #{ord.orderNumber}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                backgroundColor: statusInfo.bg,
                color: statusInfo.color,
                padding: '2px 7px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              {statusInfo.label}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {ord.type === 'dine_in' && ord.tableNumber
              ? `Table ${ord.tableNumber}`
              : ord.pickupTime || (ord.createdAt ? formatMessageTime(ord.createdAt) : 'Recent')}
          </span>
        </div>

        {/* Customer & Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {ord.customerName}
            </div>
            {ord.customerPhone && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                📞 {ord.customerPhone}
              </span>
            )}
          </div>
          <span style={{ fontWeight: 900, color: 'var(--text-main)', fontSize: '14px', flexShrink: 0 }}>
            Rs. {Number(ord.total).toLocaleString()}
          </span>
        </div>

        {/* Sub info & items count hint (no item detail text) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
            {ord.type === 'dine_in' ? (
              <span>{ord.tableNumber ? `Dine-In • Table ${ord.tableNumber}` : 'Dine-In Table'}</span>
            ) : ord.type === 'delivery' ? (
              <>
                <MapPin size={11} color="var(--primary)" style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ord.deliveryAddress || 'Customer Address'}
                </span>
              </>
            ) : (
              <span>Counter Handover</span>
            )}
          </div>
          <span style={{ color: 'var(--primary)', fontWeight: 750, flexShrink: 0 }}>
            📦 {ord.items.length} Items (View)
          </span>
        </div>

        {/* Dedicated Delivery Order Rider Assignment Row: Contained strictly inside the card */}
        {ord.type === 'delivery' && ord.status !== 'completed' && ord.status !== 'cancelled' && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              marginTop: '5px',
              paddingTop: '6px',
              borderTop: '1px dashed var(--border-color)',
              minWidth: 0,
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', flexShrink: 0 }}>
              <Bike size={13} color={effectiveRiderId ? '#EA580C' : '#94A3B8'} />
              <span>Rider:</span>
            </div>

            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', maxWidth: '280px', minWidth: 0, width: '100%' }}>
              <select
                value={effectiveRiderId}
                onChange={(e) => {
                  const rId = e.target.value;
                  if (rId) {
                    const chosen = users.find((u) => u.id === rId);
                    if (chosen?.riderAvailability === 'busy' && rId !== effectiveRiderId) {
                      addToast({
                        type: 'warning',
                        title: 'Rider is Busy',
                        message: `${chosen.name} has already departed on delivery and cannot accept more orders until return.`,
                      });
                      return;
                    }
                    if (chosen?.riderAvailability === 'offline' && rId !== effectiveRiderId) {
                      addToast({
                        type: 'warning',
                        title: 'Rider is Offline',
                        message: `${chosen.name} is currently off duty / shift offline.`,
                      });
                      return;
                    }
                    manuallyUnassignedOrdersRef.current.delete(ord.id);
                    assignRiderToOrder(ord.id, rId);
                  } else {
                    manuallyUnassignedOrdersRef.current.add(ord.id);
                    unassignRiderFromOrder(ord.id);
                    addToast({
                      type: 'info',
                      title: 'Rider Unassigned',
                      message: `Rider unassigned from Order #${ord.orderNumber}. Select a rider before dispatching.`,
                    });
                  }
                }}
                disabled={ord.status === 'out_for_delivery' && Boolean(ord.assignedRiderId)}
                title={
                  ord.status === 'out_for_delivery' && ord.assignedRiderId
                    ? `${ord.assignedRiderName || 'Rider'} has already departed on this delivery.`
                    : effectiveRiderId
                    ? 'Rider assigned (nearest available auto-selected; click to reassign)'
                    : 'Assign nearest rider to order'
                }
                style={{
                  width: '100%',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '4px 8px 4px 22px',
                  borderRadius: '7px',
                  backgroundColor: effectiveRiderId ? '#FFF7ED' : '#F8FAFC',
                  color: effectiveRiderId ? '#C2410C' : '#64748B',
                  border: `1px solid ${effectiveRiderId ? '#FFEDD5' : '#CBD5E1'}`,
                  cursor: ord.status === 'out_for_delivery' && ord.assignedRiderId ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">
                  {effectiveRiderId
                    ? '✕ Unassign Rider'
                    : branchRiders.length === 0
                    ? 'No Riders in Branch'
                    : '+ Select / Assign Rider'}
                </option>
                {(() => {
                  const options = [...branchRiders];
                  if (effectiveRiderId && !options.some((r) => r.id === effectiveRiderId)) {
                    const ex = users.find((u) => u.id === effectiveRiderId);
                    if (ex) options.push(ex);
                    else if (ord.assignedRiderName) {
                      options.push({ id: effectiveRiderId, name: ord.assignedRiderName } as any);
                    }
                  }

                  // Calculate approximate distance for each rider to this order
                  const ridersWithDist = options.map((r) => {
                    const isCurrent = r.id === effectiveRiderId;
                    const isNearest = nearestCandidate?.rider.id === r.id;
                    const isBusy = r.riderAvailability === 'busy';
                    const isOffline = r.riderAvailability === 'offline';

                    // All active orders of this rider (excluding this specific order)
                    const riderActiveOrders = orders.filter(
                      (o) => o.assignedRiderId === r.id && o.id !== ord.id && o.status !== 'completed' && o.status !== 'cancelled'
                    );
                    const riderActiveCount = orders.filter(
                      (o) => o.assignedRiderId === r.id && o.status !== 'completed' && o.status !== 'cancelled'
                    ).length;

                    // Compute minimum distance to this order's destination
                    let minDist = calculateDistanceKm(bLat, bLng, targetCoords ? targetCoords.lat : bLat, targetCoords ? targetCoords.lng : bLng);
                    let nearestStopRef = 'Branch';

                    if (targetCoords) {
                      riderActiveOrders.forEach((actOrd) => {
                        const actCoords = getOrderCoords(actOrd, bLat, bLng);
                        const d = calculateDistanceKm(actCoords.lat, actCoords.lng, targetCoords.lat, targetCoords.lng);
                        if (d < minDist) {
                          minDist = d;
                          nearestStopRef = `Order #${actOrd.orderNumber}`;
                        }
                      });
                    }

                    return {
                      rider: r,
                      isCurrent,
                      isNearest,
                      isBusy,
                      isOffline,
                      riderActiveCount,
                      distanceKm: minDist,
                      nearestStopRef,
                    };
                  });

                  // SORT: Current/selected rider first, then sort by distanceKm ASCENDING (nearest appears first!)
                  ridersWithDist.sort((a, b) => {
                    if (a.isCurrent) return -1;
                    if (b.isCurrent) return 1;
                    return a.distanceKm - b.distanceKm;
                  });

                  return ridersWithDist.map(({ rider: r, isCurrent, isNearest, isBusy, isOffline, riderActiveCount, distanceKm, nearestStopRef }) => {
                    let distText = `~${distanceKm} km`;
                    if (nearestStopRef !== 'Branch') {
                      distText += ` near ${nearestStopRef}`;
                    }

                    let label = `${r.name} • ${distText}`;
                    if (isCurrent) {
                      label += isBusy ? ' (Assigned • Busy)' : ` (Selected • ${riderActiveCount} Total)`;
                    } else if (isBusy) {
                      label += ' (Busy - On Delivery)';
                    } else if (isOffline) {
                      label += ' (Offline)';
                    } else {
                      label += riderActiveCount > 0 ? ` (Free • ${riderActiveCount} Active)` : ' (Free • Ready)';
                    }

                    if (isNearest && !isBusy && !isOffline) {
                      label += ' 📍 (Nearest)';
                    }

                    return (
                      <option
                        key={r.id}
                        value={r.id}
                        disabled={!isCurrent && (isBusy || isOffline)}
                      >
                        {label}
                      </option>
                    );
                  });
                })()}
              </select>
              <Bike
                size={11}
                color={effectiveRiderId ? '#EA580C' : '#94A3B8'}
                style={{ position: 'absolute', left: '6px', pointerEvents: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Bottom Actions Bar */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '6px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-color)',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: ord.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
              color: ord.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
              whiteSpace: 'nowrap',
            }}
          >
            {ord.paymentStatus === 'paid' ? 'PAID' : 'CASH'}
          </span>

          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {isAwaitingKitchen ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCancelModalOrder(ord);
                    setCancelReasonInput('Cancelled by Customer Support prior to kitchen dispatch');
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #FCA5A5',
                    color: '#DC2626',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomTimeModalOrderId(ord.id);
                    setCustomMinutesInput(ord.autoForwardCustomMin || footerSettings?.autoForwardKitchenMin || 3);
                    setTimerScope('specific');
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: ord.forwardToKitchenAt ? '#FEF3C7' : 'var(--bg-card-subtle)',
                    border: ord.forwardToKitchenAt ? '1px solid #FDE68A' : '1px solid var(--border-color)',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    color: ord.forwardToKitchenAt ? '#B45309' : 'var(--text-secondary)',
                  }}
                  title="Click to set timer for this order or whole orders"
                >
                  <Clock size={11} />
                  {ord.forwardToKitchenAt ? (
                    <LiveOrderCountdown forwardToKitchenAt={ord.forwardToKitchenAt} />
                  ) : (
                    <span>Set Timer</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => sendOrderToKitchen(ord.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '11px',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <Utensils size={11} />
                  <span>Mark Kitchen Ready</span>
                </button>
              </>
            ) : (
              <>
                {ord.status !== 'completed' && ord.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelModalOrder(ord);
                      setCancelReasonInput('Customer requested order cancellation');
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #FCA5A5',
                      color: '#DC2626',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}

                {ord.sentToKitchen && (ord.status === 'placed' || ord.status === 'accepted') && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', padding: '3px 6px', borderRadius: '4px', backgroundColor: '#FEF3C7' }}>
                    🍳 In Queue
                  </span>
                )}

                {ord.status === 'preparing' && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', padding: '3px 6px', borderRadius: '4px', backgroundColor: '#EFF6FF' }}>
                    👨‍🍳 Cooking
                  </span>
                )}

                {ord.type === 'takeaway' && ord.status === 'ready' && (
                  <button
                    type="button"
                    onClick={() => {
                      updateOrderStatus(ord.id, 'completed', undefined, {
                        type: 'success',
                        title: 'Takeaway Handed Over ✓',
                        message: `Order #${ord.orderNumber} handed to ${ord.customerName}.`,
                      });
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Hand Over ✓
                  </button>
                )}

                {ord.type === 'delivery' && ord.status === 'ready' && (
                  <button
                    type="button"
                    disabled={!effectiveRiderId}
                    onClick={() => {
                      if (!effectiveRiderId) {
                        addToast({
                          type: 'warning',
                          title: 'Rider Required',
                          message: 'Please assign an available rider before dispatching this delivery.',
                        });
                        return;
                      }
                      if (!ord.assignedRiderId && effectiveRiderId) {
                        assignRiderToOrder(ord.id, effectiveRiderId, true);
                      }
                      const rObj = users.find((u) => u.id === effectiveRiderId);
                      updateOrderStatus(ord.id, 'out_for_delivery', undefined, {
                        type: 'info',
                        title: 'Order Dispatched 🛵',
                        message: `Order #${ord.orderNumber} is now out for delivery with ${rObj?.name || ord.assignedRiderName || 'rider'}.`,
                      });
                    }}
                    title={
                      !effectiveRiderId
                        ? 'Cannot dispatch: Please select an available rider first'
                        : `Dispatch Order #${ord.orderNumber} with ${ord.assignedRiderName || users.find((u) => u.id === effectiveRiderId)?.name || 'rider'}`
                    }
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: effectiveRiderId ? '#EA580C' : '#E2E8F0',
                      color: effectiveRiderId ? '#FFFFFF' : '#94A3B8',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: effectiveRiderId ? 'pointer' : 'not-allowed',
                      border: effectiveRiderId ? 'none' : '1px solid #CBD5E1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: effectiveRiderId ? 1 : 0.65,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Send size={11} color={effectiveRiderId ? '#FFFFFF' : '#94A3B8'} />
                    <span style={{ color: effectiveRiderId ? '#FFFFFF' : '#94A3B8' }}>Dispatch Rider →</span>
                  </button>
                )}

                {ord.type === 'delivery' && ord.status === 'out_for_delivery' && (
                  <button
                    type="button"
                    onClick={() => {
                      updateOrderStatus(ord.id, 'completed', undefined, {
                        type: 'success',
                        title: 'Delivered ✓',
                        message: `Order #${ord.orderNumber} marked as delivered.`,
                      });
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Delivered ✓
                  </button>
                )}

                {ord.type === 'dine_in' && (ord.status === 'ready' || ord.status === 'served') && (
                  <button
                    type="button"
                    onClick={() => {
                      updateOrderStatus(ord.id, 'completed', undefined, {
                        type: 'success',
                        title: 'Table Completed ✓',
                        message: `Table ${ord.tableNumber || ''} Order #${ord.orderNumber} marked completed.`,
                      });
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Complete Table ✓
                  </button>
                )}

                {ord.status === 'completed' && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A' }}>
                    ✓ Closed
                  </span>
                )}

                {ord.status === 'cancelled' && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626' }}>
                    ✕ Cancelled
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* ========================================================================= */}
      {/* TAB 1: CUSTOMER SERVICES (STATIC 3-CARD WORKSPACE WITH HAIR-THIN GAP)     */}
      {/* ========================================================================= */}
      {activeTab === 'support' && (
        <div
          className="rep-support-workspace"
          style={{
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '320px 1fr 380px',
            gap: '1px', // Hair-thin gap separation between cards
            backgroundColor: 'var(--border-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
            overscrollBehavior: 'none',
          }}
        >
          {/* ===================================================================== */}
          {/* CARD 1 (LEFT): CUSTOMERS LIST                                         */}
          {/* ===================================================================== */}
          <div
            className={`rep-card-customers ${mobileSupportView === 'list' ? 'rep-mobile-show' : 'rep-mobile-hide'}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              height: '100%',
              maxHeight: '100%',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Header & Search (Static Top of Card 1) */}
            <div style={{ flexShrink: 0, padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Customers List ({filteredCustomers.length})
                  </span>
                  {unifiedCustomers.some((c) => {
                    const isRead = readCustomerKeys.has(c.key) || (readCustomerTimestamps[c.key] && readCustomerTimestamps[c.key] >= c.latestTimestampMs);
                    return c.hasNewComplaint && !isRead;
                  }) && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        backgroundColor: '#DC2626',
                        color: '#FFFFFF',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      ● {unifiedCustomers.filter((c) => {
                        const isRead = readCustomerKeys.has(c.key) || (readCustomerTimestamps[c.key] && readCustomerTimestamps[c.key] >= c.latestTimestampMs);
                        return c.hasNewComplaint && !isRead;
                      }).length} Urgent
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Active Sync</span>
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Search customer or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 30px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['all', 'inquiries', 'orders'] as const).map((mode) => {
                  const urgentCount = mode === 'inquiries' ? unifiedCustomers.filter((c) => {
                    const isRead = readCustomerKeys.has(c.key) || (readCustomerTimestamps[c.key] && readCustomerTimestamps[c.key] >= c.latestTimestampMs);
                    return c.hasNewComplaint && !isRead;
                  }).length : 0;
                  return (
                    <button
                      key={mode}
                      onClick={() => setCustomerFilter(mode)}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: '1px solid var(--border-color)',
                        backgroundColor: customerFilter === mode ? 'var(--primary)' : 'var(--bg-card-subtle)',
                        color: customerFilter === mode ? '#FFFFFF' : 'var(--text-secondary)',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>{mode === 'all' ? 'All' : mode === 'inquiries' ? 'Inquiries' : 'Orders'}</span>
                      {urgentCount > 0 && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 800,
                            backgroundColor: customerFilter === mode ? '#FFFFFF' : '#DC2626',
                            color: customerFilter === mode ? '#DC2626' : '#FFFFFF',
                            padding: '0 5px',
                            borderRadius: '8px',
                          }}
                        >
                          {urgentCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customers Scrollable List (Only customer list scrolls inside Card 1) */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain' }}>
              {filteredCustomers.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No customer matches found.
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const isSelected = activeCustomer?.key === cust.key;
                  const isMarkedRead =
                    readCustomerKeys.has(cust.key) ||
                    (readCustomerTimestamps[cust.key] && readCustomerTimestamps[cust.key] >= cust.latestTimestampMs);
                  const hasUnread = cust.hasNewComplaint && !isMarkedRead;
                  const isResolved = cust.activeTicket
                    ? cust.activeTicket.status === 'resolved' || cust.activeTicket.status === 'closed'
                    : false;
                  const hasTicket = !!cust.activeTicket;

                  const initials = cust.name
                    ? cust.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()
                    : 'CU';

                  return (
                    <div
                      key={cust.key}
                      onClick={() => handleSelectCustomer(cust)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isSelected
                          ? 'var(--primary-light)'
                          : hasUnread
                          ? '#FEF2F2'
                          : '#FFFFFF',
                        borderLeft: isSelected
                          ? '4px solid var(--primary)'
                          : hasUnread
                          ? '4px solid #DC2626'
                          : !isResolved && hasTicket
                          ? '4px solid #D97706'
                          : '4px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: hasUnread
                            ? '#FEE2E2'
                            : isSelected
                            ? 'var(--primary)'
                            : 'var(--bg-card-subtle)',
                          color: hasUnread
                            ? '#DC2626'
                            : isSelected
                            ? '#FFFFFF'
                            : 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '13px',
                          flexShrink: 0,
                          position: 'relative',
                        }}
                      >
                        {initials}
                        {hasUnread ? (
                          <span
                            title="New Unread Message"
                            style={{
                              position: 'absolute',
                              top: '-2px',
                              right: '-2px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: '#DC2626',
                              border: '2px solid #FFFFFF',
                              boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.4)',
                            }}
                          />
                        ) : !isResolved && hasTicket ? (
                          <span
                            title="Chat Opened · In Progress (Unresolved)"
                            style={{
                              position: 'absolute',
                              top: '-2px',
                              right: '-2px',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: '#D97706',
                              border: '2px solid #FFFFFF',
                            }}
                          />
                        ) : null}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontWeight: hasUnread ? 900 : 800,
                              fontSize: '13.5px',
                              color: hasUnread
                                ? '#DC2626'
                                : isSelected
                                ? 'var(--primary)'
                                : 'var(--text-main)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {cust.name}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            {hasUnread && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  backgroundColor: '#DC2626',
                                  color: '#FFFFFF',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
                                }}
                              >
                                ● {cust.unreadCount || 1} New
                              </span>
                            )}
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {cust.latestInteractionTime}
                            </span>
                          </div>
                        </div>

                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0' }}>
                          <Phone size={11} color={hasUnread ? '#DC2626' : 'var(--primary)'} />
                          <span>{cust.phone}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          {cust.activeTicket ? (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor:
                                  hasUnread
                                    ? '#FEE2E2'
                                    : isResolved
                                    ? '#DCFCE7'
                                    : '#FEF3C7',
                                color:
                                  hasUnread
                                    ? '#DC2626'
                                    : isResolved
                                    ? '#166534'
                                    : '#92400E',
                                border:
                                  hasUnread
                                    ? '1px solid #FCA5A5'
                                    : isResolved
                                    ? '1px solid #BBF7D0'
                                    : '1px solid #FDE68A',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              #{cust.activeTicket.ticketNumber}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {cust.lastOrder ? `Last: #${cust.lastOrder.orderNumber}` : 'Customer Contact'}
                            </span>
                          )}

                          {cust.orderCount > 0 && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                color: 'var(--text-secondary)',
                                backgroundColor: 'var(--bg-card-subtle)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {cust.orderCount} Orders
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ===================================================================== */}
          {/* CATEGORY 2 (CENTER): DIRECT 1-ON-1 LIVE CHAT                           */}
          {/* ===================================================================== */}
          <div
            className={`rep-card-chat ${mobileSupportView === 'chat' ? 'rep-mobile-show' : 'rep-mobile-hide'}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              maxHeight: '100%',
              backgroundColor: '#FAFAFA',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {activeCustomer ? (
              <>
                {/* Chat Top Header: Static at the top of Card 2 */}
                <div
                  style={{
                    flexShrink: 0,
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: '#FFFFFF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {/* Mobile Back Button to return to Customer List */}
                    <button
                      type="button"
                      className="rep-mobile-back-btn"
                      onClick={() => setMobileSupportView('list')}
                      title="Back to Customers List"
                      aria-label="Back to Customers List"
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-main)',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                      }}
                    >
                      <ArrowLeft size={14} />
                      <span>Back</span>
                    </button>

                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '13px',
                        flexShrink: 0,
                      }}
                    >
                      <User size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {activeCustomer.name}
                        </span>
                        <a
                          href={`tel:${activeCustomer.phone}`}
                          style={{
                            fontSize: '12px',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Phone size={11} />
                          {activeCustomer.phone}
                        </a>
                      </div>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {activeTicket
                          ? `Inquiry #${activeTicket.ticketNumber} · ${activeTicket.subject}`
                          : 'Direct Customer Channel · Ready for inquiries'}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Top Line: Order History, Escalate, Resolve) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {/* Order History Option in Top Line */}
                    <button
                      type="button"
                      onClick={() => setShowOrderHistoryModal(true)}
                      style={{
                        padding: '6px 11px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--primary-light)',
                        border: '1px solid var(--primary-subtle)',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        color: 'var(--primary)',
                        transition: 'all 0.15s ease',
                      }}
                      title="View Customer Order History in Pop-up"
                    >
                      <Receipt size={13} />
                      <span>Order History ({customerOrders.length})</span>
                    </button>

                    {activeTicket && (
                      <>
                        <button
                          type="button"
                          onClick={handleEscalate}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-color)',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#EA580C',
                          }}
                        >
                          <ShieldAlert size={13} />
                          <span>Escalate</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCloseTicket}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#16A34A',
                            border: 'none',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>Resolve</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Messages Feed (Scrolls internally; minHeight: 0 prevents card expansion) */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    padding: '20px',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {(() => {
                    let lastDayKey = '';
                    if (!activeCustomerTickets.some((t) => t.messages && t.messages.length > 0)) {
                      return (
                        <div
                          style={{
                            margin: 'auto',
                            textAlign: 'center',
                            maxWidth: '340px',
                            padding: '24px',
                            backgroundColor: '#FFFFFF',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px dashed var(--border-color)',
                          }}
                        >
                          <MessageSquare size={28} color="var(--primary)" style={{ margin: '0 auto 8px', display: 'block' }} />
                          <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                            Start Live Chat with {activeCustomer.name}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                            Send an instant direct update or reply. Messages synchronize to customer app in 0ms.
                          </p>
                        </div>
                      );
                    }

                    return activeCustomerTickets.map((ticket) => {
                      const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
                      const firstMsg = ticket.messages[0];
                      const ticketTimestamp = firstMsg?.timestamp || ticket.createdAt;
                      const ticketDayKey = getDayKey(ticketTimestamp);
                      const showDateDividerBeforeTopic = ticketDayKey !== lastDayKey;
                      if (showDateDividerBeforeTopic) {
                        lastDayKey = ticketDayKey;
                      }

                      return (
                        <React.Fragment key={ticket.id}>
                          {/* Date divider (e.g. Today) is written ABOVE the inquiry line */}
                          {showDateDividerBeforeTopic && (
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: '#E2E8F0',
                                  color: '#475569',
                                  padding: '3px 12px',
                                  borderRadius: '12px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                  letterSpacing: '0.02em',
                                }}
                              >
                                {getDayDividerLabel(ticketTimestamp)}
                              </span>
                            </div>
                          )}

                          {/* Render inquiry topic banner */}
                          {ticket.ticketNumber && (
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 2px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: '#FEF3C7',
                                  color: '#92400E',
                                  padding: '3px 14px',
                                  borderRadius: '12px',
                                  border: '1px solid #FDE68A',
                                }}
                              >
                                Inquiry #{ticket.ticketNumber} · {ticket.subject}
                              </span>
                            </div>
                          )}

                          {ticket.messages.map((m) => {
                            const isRep = m.sender !== 'customer';
                            const mDayKey = getDayKey(m.timestamp);
                            const showDateDivider = mDayKey !== lastDayKey;
                            if (showDateDivider) lastDayKey = mDayKey;
                            const isTargetUnseen = m.id === targetScrollMessageId;

                            return (
                              <React.Fragment key={m.id}>
                                {showDateDivider && (
                                  <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        backgroundColor: '#E2E8F0',
                                        color: '#475569',
                                        padding: '3px 12px',
                                        borderRadius: '12px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                        letterSpacing: '0.02em',
                                      }}
                                    >
                                      {getDayDividerLabel(m.timestamp)}
                                    </span>
                                  </div>
                                )}

                                {isTargetUnseen && (
                                  <div
                                    id="rep-unseen-divider"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '10px',
                                      margin: '12px 0 6px',
                                    }}
                                  >
                                    <div style={{ height: '1px', flex: 1, backgroundColor: '#DC2626', opacity: 0.35 }} />
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        backgroundColor: '#FEE2E2',
                                        color: '#DC2626',
                                        padding: '3px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid #FCA5A5',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        boxShadow: '0 1px 4px rgba(220, 38, 38, 0.15)',
                                        letterSpacing: '0.02em',
                                      }}
                                    >
                                      ● Unread Message Below
                                    </span>
                                    <div style={{ height: '1px', flex: 1, backgroundColor: '#DC2626', opacity: 0.35 }} />
                                  </div>
                                )}

                                <div
                                  id={`rep-msg-${m.id}`}
                                  style={{
                                    alignSelf: isRep ? 'flex-end' : 'flex-start',
                                    maxWidth: '78%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    transition: 'all 0.3s ease',
                                  }}
                                >
                                  {/* Name removed above message bubble as requested */}
                                  <div
                                    style={{
                                      position: 'relative',
                                      padding: '10px 14px 22px 14px',
                                      borderRadius: isRep ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                      backgroundColor: isRep ? 'var(--primary)' : '#FFFFFF',
                                      color: isRep ? '#FFFFFF' : 'var(--text-main)',
                                      border: isTargetUnseen
                                        ? '2px solid #DC2626'
                                        : isRep
                                        ? 'none'
                                        : '1px solid var(--border-color)',
                                      boxShadow: isTargetUnseen
                                        ? '0 0 0 3px rgba(220, 38, 38, 0.25), 0 2px 8px rgba(0,0,0,0.08)'
                                        : '0 1px 3px rgba(0,0,0,0.06)',
                                      fontSize: '13.5px',
                                      lineHeight: 1.45,
                                      minWidth: '85px',
                                    }}
                                  >
                                    <div style={{ wordBreak: 'break-word', paddingRight: '22px' }}>
                                      {m.text}
                                    </div>
                                    <div
                                      style={{
                                        position: 'absolute',
                                        bottom: '4px',
                                        right: '8px',
                                        fontSize: '10px',
                                        color: isRep ? 'rgba(255, 255, 255, 0.75)' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        userSelect: 'none',
                                      }}
                                    >
                                      {formatMessageTime(m.timestamp)}
                                      {isRep && <CheckCircle size={10} style={{ opacity: 0.85 }} />}
                                    </div>
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          })}

                          {/* When complaint is solved, display resolution message banner after last message */}
                          {isResolved && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px 0', gap: '8px' }}>
                              <div style={{ height: '1px', flex: 1, backgroundColor: '#86EFAC' }} />
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  backgroundColor: '#DCFCE7',
                                  color: '#15803D',
                                  padding: '4px 14px',
                                  borderRadius: '16px',
                                  border: '1px solid #BBF7D0',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  letterSpacing: '0.02em',
                                }}
                              >
                                <CheckCircle2 size={12} color="#16A34A" />
                                Matter has been resolved
                              </span>
                              <div style={{ height: '1px', flex: 1, backgroundColor: '#86EFAC' }} />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input & Quick Chips: Static at bottom of Card 2 in line with card bottom */}
                <div style={{ flexShrink: 0, marginTop: 'auto' }}>
                  {isManager ? (
                    <div
                      style={{
                        padding: '16px 20px',
                        backgroundColor: '#FFFBEB',
                        borderTop: '1px solid #FDE68A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Lock size={16} color="#D97706" />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400E' }}>
                            Manager Oversight Mode: Query Answering Disabled
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#B45309' }}>
                            Customer inquiries are answered directly by Support Representatives. Managers review escalations and authorize refund actions.
                          </div>
                        </div>
                      </div>

                      {activeTicket && (activeTicket.status === 'new' || activeTicket.assignedTo === 'manager') && (
                        <button
                          type="button"
                          onClick={() => {
                            updateComplaintStatus(activeTicket.id, 'resolved');
                            addToast({
                              type: 'success',
                              title: 'Escalation Resolved',
                              message: `Ticket #${activeTicket.ticketNumber} marked resolved by Branch Manager.`,
                            });
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            backgroundColor: '#16A34A',
                            color: '#FFFFFF',
                            fontWeight: 750,
                            fontSize: '12px',
                            cursor: 'pointer',
                            border: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Approve & Resolve Escalation ✓
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Quick Canned Chips */}
                      <div
                        style={{
                          padding: '8px 16px 0',
                          display: 'flex',
                          gap: '6px',
                          overflowX: 'auto',
                          backgroundColor: '#FFFFFF',
                          borderTop: '1px solid var(--border-color)',
                        }}
                      >
                        {[
                          'Your order is ready at the counter!',
                          'Rider has picked up and is en route.',
                          'Checking with kitchen ustaad now...',
                          'We have credited Rs. 250 as courtesy.',
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setChatInput(chip)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              backgroundColor: 'var(--bg-card-subtle)',
                              border: '1px solid var(--border-color)',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                            }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>

                      {/* Chat Composer */}
                      <form
                        onSubmit={handleSendChat}
                        style={{
                          padding: '12px 16px',
                          backgroundColor: '#FFFFFF',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder={`Reply directly to ${activeCustomer.name}...`}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="submit"
                          style={{
                            padding: '10px 18px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--primary)',
                            color: '#FFFFFF',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Send size={14} />
                          <span>Send</span>
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                Select a customer from the left list to open direct chat.
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* CATEGORY 3 (RIGHT): DIRECT ORDER HISTORY OF THIS SPECIFIC USER         */}
          {/* ===================================================================== */}
          <div
            className="rep-card-orders rep-desktop-only"
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              height: '100%',
              maxHeight: '100%',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Header & Quick Stats (Static Top of Card 3) */}
            <div
              style={{
                flexShrink: 0,
                padding: '12px 14px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Customer Order History
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {customerOrders.length} Records
                </span>
              </div>

              {activeCustomer && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                      Customer: <strong>{activeCustomer.name}</strong>
                    </p>
                    {activeCustomer.phone && (
                      <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>
                        {activeCustomer.phone}
                      </span>
                    )}
                  </div>

                  {/* Customer Quick Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', textAlign: 'center' }}>
                    <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL ORDERS</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {customerOrders.length}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700 }}>SPENT</div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--primary)' }}>
                        Rs. {customerTotalSpend.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700 }}>ACTIVE</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#16A34A' }}>
                        {activeCustomerLiveOrders.length}
                      </div>
                    </div>
                  </div>

                  {/* Filter Pills for Orders List */}
                  <div style={{ display: 'flex', gap: '6px', paddingTop: '2px' }}>
                    {(['all', 'active', 'completed'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setOrderHistoryFilter(mode)}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: '1px solid var(--border-color)',
                          backgroundColor: orderHistoryFilter === mode ? 'var(--primary)' : 'var(--bg-card-subtle)',
                          color: orderHistoryFilter === mode ? '#FFFFFF' : 'var(--text-secondary)',
                          textTransform: 'capitalize',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {mode === 'all'
                          ? `All (${customerOrders.length})`
                          : mode === 'active'
                          ? `Active (${activeCustomerLiveOrders.length})`
                          : `Past (${pastCustomerOrders.length})`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Scrollable Order List Inside Card 3 (Only Orders Scroll!) */}
            <div
              id="rep-customer-orders-scroll-container"
              style={{
                flex: 1,
                minHeight: 0,
                padding: '10px 12px',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {filteredCustomerOrders.length === 0 ? (
                <div
                  style={{
                    padding: '28px 12px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-card-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    margin: 'auto 0',
                  }}
                >
                  No orders found in this category.
                </div>
              ) : (
                filteredCustomerOrders.map((ord) => {
                  const isActive = ord.status !== 'completed' && ord.status !== 'cancelled' && ord.status !== 'served';
                  const statusInfo = getOrderStatusBadge(ord.status, ord.type);
                  const itemCount = ord.items.reduce((sum, item) => sum + (item.quantity || 1), 0);

                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrderForMenu(ord)}
                      title="Click to view full ordered menu and details"
                      style={{
                        height: '76px',
                        minHeight: '76px',
                        maxHeight: '76px',
                        width: '100%',
                        boxSizing: 'border-box',
                        backgroundColor: isActive ? '#FFFBEB' : '#FFFFFF',
                        borderRadius: 'var(--radius-md)',
                        border: isActive ? '1px solid #FCD34D' : '1px solid var(--border-color)',
                        borderLeft: isActive ? '4px solid #F59E0B' : '4px solid #CBD5E1',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.backgroundColor = isActive ? '#FEF3C7' : 'var(--bg-card-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isActive ? '#FCD34D' : 'var(--border-color)';
                        e.currentTarget.style.borderLeftColor = isActive ? '#F59E0B' : '#CBD5E1';
                        e.currentTarget.style.backgroundColor = isActive ? '#FFFBEB' : '#FFFFFF';
                      }}
                    >
                      {/* Row 1: Order #, Status badge, Timestamp */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                            #{ord.orderNumber}
                          </span>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '1.5px 6px',
                              borderRadius: '4px',
                              backgroundColor: statusInfo.bg,
                              color: statusInfo.color,
                            }}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {ord.createdAt || 'Recent'}
                        </span>
                      </div>

                      {/* Row 2: Type, Item count, Price, and View Menu badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                        <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 600 }}>
                          {ord.type.replace('_', ' ')} {ord.tableNumber ? `· T${ord.tableNumber}` : ''} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '12.5px' }}>
                            Rs. {Number(ord.total).toLocaleString()}
                          </span>
                          <span
                            title="Click to view full ordered items details"
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              color: 'var(--primary)',
                              backgroundColor: 'var(--primary-light)',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                            }}
                          >
                            <ExternalLink size={12} />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* SHARED ORDER CARD RENDERER (FIXED LENGTH/WIDTH, NO INLINE ITEM DETAILS)    */}
      {/* ========================================================================= */}
      {(() => {
        return null;
      })()}

      {/* ========================================================================= */}
      {/* TAB 2: TAKEAWAY ORDERS LIFECYCLE HUB (STATIC MAIN CARD)                   */}
      {/* ========================================================================= */}
      {activeTab === 'takeaway' && (
        <div
          style={{
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          {/* Static Top Header & Filters (Single Row) */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            {/* Left group: Icon, Takeaway Orders title & Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ShoppingBag size={20} />
                </div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  Takeaway Orders
                </h2>
              </div>

              {/* Status / Filter Dropdown with all features */}
              <select
                id="takeaway-orders-filter-dropdown"
                value={takeawayFilterOption}
                onChange={(e) => handleTakeawayFilterChange(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: 'var(--shadow-xs)',
                  minWidth: '160px',
                }}
              >
                <option value="ready_pickup">{readyTakeawayOrders.length} Ready for Pickup</option>
                <option value="arrived_badge">{arrivedTakeawayOrders.length} Arrived</option>
                <option value="all">All ({allTakeawayOrders.length})</option>
                <option value="arrived">Arrived ({arrivedTakeawayOrders.length})</option>
                <option value="preparing">In Kitchen ({preparingTakeawayOrders.length})</option>
                <option value="ready">Ready ({readyTakeawayOrders.length})</option>
                <option value="completed">Completed ({completedTakeawayOrders.length})</option>
              </select>
            </div>

            {/* Right side: Fixed to Right Wall Search Option */}
            <div style={{ position: 'relative', width: '260px', marginLeft: 'auto' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '9px' }} />
              <input
                type="text"
                value={takeawaySearch}
                onChange={(e) => setTakeawaySearch(e.target.value)}
                placeholder="Search order #, customer..."
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 30px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Scrollable Orders Workspace (Internal Scroll only) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px 20px',
              backgroundColor: '#F8FAFC',
            }}
          >
            {takeawayStatusTab === 'completed' && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: hasLoadedOlderOrders ? 'rgba(37, 99, 235, 0.08)' : '#FFFBEB',
                  border: hasLoadedOlderOrders ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid #FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '12px', color: hasLoadedOlderOrders ? '#1E40AF' : '#92400E', fontWeight: 650 }}>
                  {hasLoadedOlderOrders
                    ? `📂 Full archive loaded (${completedTakeawayOrders.length} completed orders).`
                    : `⚡ Fast Mode: Showing today's completed orders (${completedTakeawayOrders.length}).`}
                </span>
                {!hasLoadedOlderOrders ? (
                  <button
                    type="button"
                    onClick={() => fetchOlderOrders()}
                    disabled={isFetchingOlderOrders}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#EA580C',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 750,
                      border: 'none',
                      cursor: isFetchingOlderOrders ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isFetchingOlderOrders ? 'Loading...' : 'Fetch Older Records ⬇'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => filterOrdersToToday()}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #93C5FD',
                      color: '#2563EB',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Show Today Only ⚡
                  </button>
                )}
              </div>
            )}
            {(() => {
              const list = allTakeawayOrders.filter((ord) => {
                if (takeawayStatusTab === 'arrived' && ord.status !== 'placed' && ord.status !== 'accepted') return false;
                if (takeawayStatusTab === 'preparing' && ord.status !== 'preparing') return false;
                if (takeawayStatusTab === 'ready' && ord.status !== 'ready') return false;
                if (takeawayStatusTab === 'completed' && ord.status !== 'completed') return false;
                if (takeawaySearch.trim()) {
                  const q = takeawaySearch.toLowerCase().replace(/^#/, '');
                  const num = ord.orderNumber?.toLowerCase() || '';
                  const name = ord.customerName?.toLowerCase() || '';
                  const phone = ord.customerPhone?.replace(/\s+/g, '') || '';
                  return num.includes(q) || name.includes(q) || phone.includes(q);
                }
                return true;
              });

              if (list.length === 0) {
                return (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-muted)',
                      maxWidth: '420px',
                      margin: '40px auto',
                    }}
                  >
                    <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>
                      No Takeaway Orders In This View
                    </div>
                    <p style={{ fontSize: '12.5px', margin: '4px 0 0' }}>
                      All orders have progressed or switch filter tabs.
                    </p>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, 340px)',
                    gap: '14px',
                    alignItems: 'start',
                  }}
                >
                  {list.map((ord) => renderOrderCard(ord))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DELIVERY ORDERS LIFECYCLE HUB                                      */}
      {/* ========================================================================= */}
      {activeTab === 'delivery' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: '100%',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          {/* Header: Clean Single Row with Title, 3 Dropdowns, and Right-Wall Fixed Search */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              backgroundColor: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            {/* Left group: Icon and Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#FFEDD5',
                  color: '#EA580C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Bike size={20} />
              </div>
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                Delivery Orders
              </h2>
            </div>

            {/* Dropdown 1: All, Arrived, In Kitchen, Ready, Out with Rider, Delivered */}
            <select
              id="delivery-orders-filter-dropdown"
              value={deliveryStatusTab}
              onChange={(e) => setDeliveryStatusTab(e.target.value as any)}
              style={{
                padding: '7px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <option value="all">All ({allDeliveryOrders.length})</option>
              <option value="arrived">Arrived ({arrivedDeliveryOrders.length})</option>
              <option value="preparing">In Kitchen ({preparingDeliveryOrders.length})</option>
              <option value="ready">Ready ({readyDeliveryOrders.length})</option>
              <option value="out">Out with Rider ({outDeliveryOrders.length})</option>
              <option value="completed">Delivered ({completedDeliveryOrders.length})</option>
            </select>

            {/* Dropdown 2: Ready to Ship, Arrived */}
            <select
              id="delivery-shipping-filter-dropdown"
              value={deliveryStatusTab === 'ready' ? 'ready_ship' : deliveryStatusTab === 'arrived' ? 'arrived' : shippingFilterOption}
              onChange={(e) => {
                const val = e.target.value as 'ready_ship' | 'arrived';
                setShippingFilterOption(val);
                if (val === 'ready_ship') {
                  setDeliveryStatusTab('ready');
                } else if (val === 'arrived') {
                  setDeliveryStatusTab('arrived');
                }
              }}
              style={{
                padding: '7px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <option value="ready_ship">{readyDeliveryOrders.length} Ready to Ship</option>
              <option value="arrived">{arrivedDeliveryOrders.length} Arrived</option>
            </select>

            {/* Dropdown 3: Free Rider Name (only shows name of free riders) */}
            <select
              id="delivery-free-riders-dropdown"
              value={selectedFreeRiderId || (freeRiders[0]?.id || '')}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFreeRiderId(val);
                if (val) {
                  const r = freeRiders.find((rider) => rider.id === val);
                  if (r) {
                    addToast({
                      type: 'info',
                      title: 'Free Rider',
                      message: `${r.name} is available for order dispatch.`,
                    });
                  }
                }
              }}
              style={{
                padding: '7px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              {freeRiders.length === 0 ? (
                <option value="">No Free Riders</option>
              ) : (
                freeRiders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              )}
            </select>

            {/* Right side: Fixed to Right Wall Search Option */}
            <div style={{ position: 'relative', width: '250px', marginLeft: 'auto' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '9px' }} />
              <input
                type="text"
                value={deliverySearch}
                onChange={(e) => setDeliverySearch(e.target.value)}
                placeholder="Search order #, address, name..."
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 30px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Scrollable Orders Workspace (Internal Scroll only) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px 20px',
              backgroundColor: '#F8FAFC',
            }}
          >
            {deliveryStatusTab === 'completed' && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: hasLoadedOlderOrders ? 'rgba(37, 99, 235, 0.08)' : '#FFFBEB',
                  border: hasLoadedOlderOrders ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid #FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '12px', color: hasLoadedOlderOrders ? '#1E40AF' : '#92400E', fontWeight: 650 }}>
                  {hasLoadedOlderOrders
                    ? `📂 Full archive loaded (${completedDeliveryOrders.length} completed orders).`
                    : `⚡ Fast Mode: Showing today's completed orders (${completedDeliveryOrders.length}).`}
                </span>
                {!hasLoadedOlderOrders ? (
                  <button
                    type="button"
                    onClick={() => fetchOlderOrders()}
                    disabled={isFetchingOlderOrders}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#EA580C',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 750,
                      border: 'none',
                      cursor: isFetchingOlderOrders ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isFetchingOlderOrders ? 'Loading...' : 'Fetch Older Records ⬇'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => filterOrdersToToday()}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #93C5FD',
                      color: '#2563EB',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Show Today Only ⚡
                  </button>
                )}
              </div>
            )}
            {(() => {
              const list = allDeliveryOrders.filter((ord) => {
                if (deliveryStatusTab === 'arrived' && ord.status !== 'placed' && ord.status !== 'accepted') return false;
                if (deliveryStatusTab === 'preparing' && ord.status !== 'preparing') return false;
                if (deliveryStatusTab === 'ready' && ord.status !== 'ready') return false;
                if (deliveryStatusTab === 'out' && ord.status !== 'out_for_delivery') return false;
                if (deliveryStatusTab === 'completed' && ord.status !== 'completed') return false;
                if (deliverySearch.trim()) {
                  const q = deliverySearch.toLowerCase().replace(/^#/, '');
                  const num = ord.orderNumber?.toLowerCase() || '';
                  const name = ord.customerName?.toLowerCase() || '';
                  const phone = ord.customerPhone?.replace(/\s+/g, '') || '';
                  const addr = ord.deliveryAddress?.toLowerCase() || '';
                  return num.includes(q) || name.includes(q) || phone.includes(q) || addr.includes(q);
                }
                return true;
              });

              if (list.length === 0) {
                return (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-muted)',
                      maxWidth: '420px',
                      margin: '40px auto',
                    }}
                  >
                    <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>
                      No Delivery Orders In This View
                    </div>
                    <p style={{ fontSize: '12.5px', margin: '4px 0 0' }}>
                      All delivery shipments have progressed or check other status filter tabs.
                    </p>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, 340px)',
                    gap: '14px',
                    alignItems: 'start',
                  }}
                >
                  {list.map((ord) => renderOrderCard(ord))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DINE-IN ORDERS LIFECYCLE HUB                                       */}
      {/* ========================================================================= */}
      {activeTab === 'dine_in' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: '100%',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              backgroundColor: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            {/* Left group: Icon, Dine-In Orders title & Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Utensils size={22} />
                </div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                  Dine-In Orders
                </h2>
              </div>

              {/* Status / Filter Dropdown with all features */}
              <select
                id="dinein-orders-filter-dropdown"
                value={dineInFilterOption}
                onChange={(e) => handleDineInFilterChange(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: 'var(--shadow-xs)',
                  minWidth: '160px',
                }}
              >
                <option value="ready_served">{readyDineInOrders.length} Ready / Served</option>
                <option value="arrived_badge">{arrivedDineInOrders.length} Arrived</option>
                <option value="all">All ({allDineInOrders.length})</option>
                <option value="arrived">Arrived ({arrivedDineInOrders.length})</option>
                <option value="preparing">In Kitchen ({preparingDineInOrders.length})</option>
                <option value="ready">Ready ({readyDineInOrders.length})</option>
                <option value="completed">Completed ({completedDineInOrders.length})</option>
              </select>
            </div>

            {/* Right side: Fixed to Right Wall Search Option */}
            <div style={{ position: 'relative', width: '260px', marginLeft: 'auto' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '9px' }} />
              <input
                type="text"
                value={dineInSearch}
                onChange={(e) => setDineInSearch(e.target.value)}
                placeholder="Search order #, table, customer..."
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 30px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Scrollable Orders Workspace (Internal Scroll only) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px 20px',
              backgroundColor: '#F8FAFC',
            }}
          >
            {dineInStatusTab === 'completed' && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: hasLoadedOlderOrders ? 'rgba(37, 99, 235, 0.08)' : '#FFFBEB',
                  border: hasLoadedOlderOrders ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid #FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '12px', color: hasLoadedOlderOrders ? '#1E40AF' : '#92400E', fontWeight: 650 }}>
                  {hasLoadedOlderOrders
                    ? `📂 Full archive loaded (${completedDineInOrders.length} completed orders).`
                    : `⚡ Fast Mode: Showing today's completed orders (${completedDineInOrders.length}).`}
                </span>
                {!hasLoadedOlderOrders ? (
                  <button
                    type="button"
                    onClick={() => fetchOlderOrders()}
                    disabled={isFetchingOlderOrders}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#EA580C',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 750,
                      border: 'none',
                      cursor: isFetchingOlderOrders ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isFetchingOlderOrders ? 'Loading...' : 'Fetch Older Records ⬇'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => filterOrdersToToday()}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #93C5FD',
                      color: '#2563EB',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Show Today Only ⚡
                  </button>
                )}
              </div>
            )}
            {(() => {
              const list = allDineInOrders.filter((ord) => {
                if (dineInStatusTab === 'arrived' && ord.status !== 'placed' && ord.status !== 'accepted') return false;
                if (dineInStatusTab === 'preparing' && ord.status !== 'preparing') return false;
                if (dineInStatusTab === 'ready' && ord.status !== 'ready' && ord.status !== 'served') return false;
                if (dineInStatusTab === 'completed' && ord.status !== 'completed') return false;
                if (dineInSearch.trim()) {
                  const q = dineInSearch.toLowerCase().replace(/^#/, '');
                  const num = ord.orderNumber?.toLowerCase() || '';
                  const name = ord.customerName?.toLowerCase() || '';
                  const table = ord.tableNumber ? String(ord.tableNumber).toLowerCase() : '';
                  return num.includes(q) || name.includes(q) || table.includes(q);
                }
                return true;
              });

              if (list.length === 0) {
                return (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-muted)',
                      maxWidth: '420px',
                      margin: '40px auto',
                    }}
                  >
                    <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>
                      No Dine-In Orders In This View
                    </div>
                    <p style={{ fontSize: '12.5px', margin: '4px 0 0' }}>
                      All dine-in tables are clear or check other status filter tabs.
                    </p>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, 340px)',
                    gap: '14px',
                    alignItems: 'start',
                  }}
                >
                  {list.map((ord) => renderOrderCard(ord))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* CUSTOM KITCHEN DISPATCH TIME MODAL (2 OPTIONS: SPECIFIC ORDER OR WHOLE ORDERS) */}
      {customTimeModalOrderId && (() => {
        const targetOrder = orders.find((o) => o.id === customTimeModalOrderId);
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(3px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setCustomTimeModalOrderId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                maxWidth: '460px',
                width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 850, color: 'var(--text-main)' }}>
                    Kitchen Timer
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomTimeModalOrderId(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* 2 Selectable Options: Specific Order vs Whole Orders */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Apply Timer To:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                  <div
                    onClick={() => setTimerScope('specific')}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: timerScope === 'specific' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: timerScope === 'specific' ? 'var(--primary-light)' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="radio"
                        name="timerScope"
                        checked={timerScope === 'specific'}
                        onChange={() => setTimerScope('specific')}
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                        This Order
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '20px' }}>
                      Order #{targetOrder?.orderNumber || 'Selected'}
                    </span>
                  </div>

                  <div
                    onClick={() => setTimerScope('whole')}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: timerScope === 'whole' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: timerScope === 'whole' ? 'var(--primary-light)' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="radio"
                        name="timerScope"
                        checked={timerScope === 'whole'}
                        onChange={() => setTimerScope('whole')}
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                        Whole Orders
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '20px' }}>
                      All incoming & future
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Duration:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[1, 2, 3, 5, 10, 15].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setCustomMinutesInput(mins)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: customMinutesInput === mins ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: customMinutesInput === mins ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                        color: customMinutesInput === mins ? 'var(--primary)' : 'var(--text-main)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {mins} min{mins > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>Custom:</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: '80px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>minutes from now</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setCustomTimeModalOrderId(null)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#F1F5F9',
                    color: 'var(--text-secondary)',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (timerScope === 'specific') {
                      setOrderKitchenForwardTime(customTimeModalOrderId, customMinutesInput);
                      addToast({
                        type: 'success',
                        title: 'Timer Set',
                        message: `Timer set to ${customMinutesInput}m for Order #${targetOrder?.orderNumber}.`,
                      });
                    } else {
                      ordersAwaitingKitchen.forEach((o) => {
                        setOrderKitchenForwardTime(o.id, customMinutesInput);
                      });
                      updateFooterSettings({ autoForwardKitchenMin: customMinutesInput });
                      addToast({
                        type: 'success',
                        title: 'Whole Orders Timer Set',
                        message: `Timer set to ${customMinutesInput}m for all incoming & future orders.`,
                      });
                    }
                    setCustomTimeModalOrderId(null);
                  }}
                  style={{
                    flex: 2,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  {timerScope === 'specific'
                    ? `Set Timer for #${targetOrder?.orderNumber || 'Order'} (${customMinutesInput}m)`
                    : `Set Timer for Whole Orders (${customMinutesInput}m)`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* POP-UP ORDER DETAIL SCREEN */}
      {selectedOrderDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedOrderDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 850, color: 'var(--text-main)' }}>
                Order Details
              </h3>

              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div
              style={{
                padding: '20px 24px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Customer & Status Summary Card */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  backgroundColor: '#F8FAFC',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer</span>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)', marginTop: '2px' }}>
                    {selectedOrderDetail.customerName}
                  </div>
                  {selectedOrderDetail.customerPhone && (
                    <a
                      href={`tel:${selectedOrderDetail.customerPhone}`}
                      style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}
                    >
                      📞 {selectedOrderDetail.customerPhone}
                    </a>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payment & Status</span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: selectedOrderDetail.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
                        color: selectedOrderDetail.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
                      }}
                    >
                      {selectedOrderDetail.paymentStatus === 'paid' ? 'PAID' : 'CASH ON HAND / UNPAID'}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#E0E7FF',
                        color: '#3730A3',
                        textTransform: 'uppercase',
                      }}
                    >
                      {selectedOrderDetail.status}
                    </span>
                  </div>
                </div>

                {selectedOrderDetail.deliveryAddress && (
                  <div style={{ gridColumn: 'span 2', paddingTop: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery Destination</span>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginTop: '2px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <MapPin size={13} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{selectedOrderDetail.deliveryAddress}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Itemized Breakdown Table */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Itemized Order ({selectedOrderDetail.items.length} items)
                </h4>
                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Item</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'center', width: '60px' }}>Qty</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'right', width: '90px' }}>Price</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'right', width: '90px' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderDetail.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < selectedOrderDetail.items.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 750, color: 'var(--text-main)' }}>{item.name}</div>
                            {item.size && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Size: {item.size}
                              </div>
                            )}
                            {item.extras && item.extras.length > 0 && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Extras: {item.extras.join(', ')}
                              </div>
                            )}
                            {item.instructions && (
                              <div style={{ fontSize: '11px', color: '#D97706', fontStyle: 'italic', marginTop: '2px' }}>
                                Note: {item.instructions}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>
                            {item.quantity}x
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            Rs. {Number(item.unitPrice || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>
                            Rs. {Number((item.unitPrice || 0) * item.quantity).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pricing Totals */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '12px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '12.5px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>Rs. {Number(selectedOrderDetail.originalSubtotal || selectedOrderDetail.items.reduce((acc, i) => acc + (i.unitPrice || 0) * i.quantity, 0)).toLocaleString()}</span>
                </div>
                {selectedOrderDetail.addOnSubtotal ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Add-ons Subtotal</span>
                    <span>Rs. {Number(selectedOrderDetail.addOnSubtotal).toLocaleString()}</span>
                  </div>
                ) : null}
                {selectedOrderDetail.tax ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Tax</span>
                    <span>Rs. {Number(selectedOrderDetail.tax).toLocaleString()}</span>
                  </div>
                ) : null}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 900,
                    fontSize: '15px',
                    color: 'var(--text-main)',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ color: 'var(--primary)' }}>Rs. {Number(selectedOrderDetail.total).toLocaleString()}</span>
                </div>
              </div>

              {selectedOrderDetail.notes && (
                <div style={{ backgroundColor: '#FEF3C7', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid #FDE68A', fontSize: '12px', color: '#92400E' }}>
                  <strong>Order Notes:</strong> {selectedOrderDetail.notes}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handlePrintReceipt(selectedOrderDetail)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontWeight: 750,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Printer size={14} color="var(--primary)" />
                  <span>Print Order Paid Slip</span>
                </button>

                {!selectedOrderDetail.sentToKitchen && (selectedOrderDetail.status === 'placed' || selectedOrderDetail.status === 'accepted') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomTimeModalOrderId(selectedOrderDetail.id);
                        setCustomMinutesInput(selectedOrderDetail.autoForwardCustomMin || footerSettings?.autoForwardKitchenMin || 3);
                        setTimerScope('specific');
                        setSelectedOrderDetail(null);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#FEF3C7',
                        border: '1px solid #FDE68A',
                        color: '#B45309',
                        fontWeight: 800,
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={13} />
                      <span>Set Timer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sendOrderToKitchen(selectedOrderDetail.id);
                        setSelectedOrderDetail(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#16A34A',
                        border: 'none',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Utensils size={13} />
                      <span>Mark Kitchen Ready</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL ORDER CONFIRMATION MODAL */}
      {cancelModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setCancelModalOrder(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111827' }}>
                Cancel Order
              </h3>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '18px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                fontSize: '12.5px',
                color: '#92400E',
                lineHeight: 1.5,
              }}
            >
              <strong>Notice:</strong> Cancelling this order before it is forwarded to the kitchen immediately removes it from the customer support queue and prevents kitchen preparation.
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                Reason for Cancellation
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {[
                  'Customer requested order cancellation',
                  'Item out of stock',
                  'Customer changed mind',
                  'Duplicate order placed',
                  'Incorrect address or contact',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReasonInput(reason)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: cancelReasonInput === reason ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: cancelReasonInput === reason ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                      color: cancelReasonInput === reason ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: cancelReasonInput === reason ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="Enter cancellation reason..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                }}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelOrder}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Confirm Cancel Order ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Menu & Details Pop-up Modal */}
      {selectedOrderForMenu && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedOrderForMenu(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
                Order Details
              </h3>
              <button
                type="button"
                onClick={() => setSelectedOrderForMenu(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  lineHeight: '1',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Scrollable if tall) */}
            <div
              style={{
                padding: '16px 18px',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Customer & Fulfillment Info */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>CHANNEL</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                    {selectedOrderForMenu.type.replace('_', ' ')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {selectedOrderForMenu.type === 'dine_in'
                      ? 'TABLE'
                      : selectedOrderForMenu.type === 'delivery'
                      ? 'DELIVERY TO'
                      : 'PICKUP'}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {selectedOrderForMenu.type === 'dine_in'
                      ? `Table #${selectedOrderForMenu.tableNumber || 'N/A'}`
                      : selectedOrderForMenu.type === 'delivery'
                      ? (selectedOrderForMenu as any).deliveryAddress || 'Gulberg Area'
                      : selectedOrderForMenu.pickupTime || 'Standard'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>PAYMENT</div>
                  <div style={{ fontWeight: 700, color: selectedOrderForMenu.paymentStatus === 'paid' ? '#16A34A' : '#D97706', textTransform: 'capitalize' }}>
                    {selectedOrderForMenu.paymentStatus}
                  </div>
                </div>
              </div>

              {/* Ordered Menu Items */}
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>What Customer Ordered</span>
                  <span>{selectedOrderForMenu.items.reduce((s, i) => s + (i.quantity || 1), 0)} items</span>
                </div>

                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  {selectedOrderForMenu.items.map((item, idx) => {
                    const lineTotal = (item.unitPrice || 0) * (item.quantity || 1);
                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderBottom: idx === selectedOrderForMenu.items.length - 1 ? 'none' : '1px solid var(--border-color)',
                          backgroundColor: idx % 2 === 0 ? '#FFFFFF' : 'var(--bg-card-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <span
                            style={{
                              backgroundColor: 'var(--primary-light)',
                              color: 'var(--primary)',
                              fontWeight: 800,
                              fontSize: '11.5px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              marginTop: '1px',
                            }}
                          >
                            {item.quantity || 1}x
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                              {item.name}
                            </div>
                            {item.size && (
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                Size: {item.size}
                              </div>
                            )}
                            {item.extras && item.extras.length > 0 && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Extras: {item.extras.join(', ')}
                              </div>
                            )}
                            {item.instructions && (
                              <div style={{ fontSize: '11px', color: '#D97706', fontStyle: 'italic', marginTop: '2px' }}>
                                Note: &quot;{item.instructions}&quot;
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '8px' }}>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                            Rs. {lineTotal.toLocaleString()}
                          </div>
                          {(item.quantity || 1) > 1 && (
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                              @ Rs. {(item.unitPrice || 0).toLocaleString()} each
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Bill Summary */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Original Subtotal</span>
                  <span>Rs. {(selectedOrderForMenu.originalSubtotal || selectedOrderForMenu.total).toLocaleString()}</span>
                </div>
                {selectedOrderForMenu.addOnSubtotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Add-ons Subtotal</span>
                    <span>Rs. {selectedOrderForMenu.addOnSubtotal.toLocaleString()}</span>
                  </div>
                )}
                {selectedOrderForMenu.tax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Tax (GST)</span>
                    <span>Rs. {selectedOrderForMenu.tax.toLocaleString()}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 800,
                    fontSize: '14px',
                    color: 'var(--text-main)',
                    borderTop: '1px dashed var(--border-color)',
                    paddingTop: '6px',
                    marginTop: '2px',
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ color: 'var(--primary)' }}>Rs. {Number(selectedOrderForMenu.total).toLocaleString()}</span>
                </div>
              </div>

              {/* Notice if cancelled */}
              {selectedOrderForMenu.status === 'cancelled' && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    fontSize: '12px',
                    color: '#991B1B',
                  }}
                >
                  <strong>Cancelled:</strong> {(selectedOrderForMenu as any).cancelReason || 'This order was cancelled.'}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div
              style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              {selectedOrderForMenu.status !== 'cancelled' &&
                selectedOrderForMenu.status !== 'completed' &&
                selectedOrderForMenu.status !== 'served' && (
                  <button
                    type="button"
                    onClick={() => {
                      const ord = selectedOrderForMenu;
                      setSelectedOrderForMenu(null);
                      setCancelModalOrder(ord);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#FEE2E2',
                      color: '#DC2626',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      border: '1px solid #FCA5A5',
                    }}
                  >
                    Cancel Order ✕
                  </button>
                )}

              {selectedOrderForMenu.status === 'placed' && (
                <button
                  type="button"
                  onClick={() => {
                    sendOrderToKitchen(selectedOrderForMenu.id);
                    addToast({
                      type: 'success',
                      title: 'Sent to Kitchen',
                      message: `Order #${selectedOrderForMenu.orderNumber} sent directly to kitchen!`,
                    });
                    setSelectedOrderForMenu(null);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  Send to Kitchen Now 🍳
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedOrderForMenu(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Order History Pop-up Card Modal */}
      {showOrderHistoryModal && activeCustomer && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowOrderHistoryModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Top Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                    Order History · {activeCustomer.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {activeCustomer.phone && (
                      <span style={{ fontWeight: 600 }}>{activeCustomer.phone}</span>
                    )}
                    <span>·</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {customerOrders.length} {customerOrders.length === 1 ? 'Order' : 'Orders'} Total
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderHistoryModal(false)}
                aria-label="Close modal"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Stats Summary */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Orders</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                    {customerOrders.length}
                  </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Spend</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                    Rs. {customerTotalSpend.toLocaleString()}
                  </div>
                </div>
                <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Active Now</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>
                    {activeCustomerLiveOrders.length}
                  </div>
                </div>
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                {(['all', 'active', 'completed'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setOrderHistoryFilter(mode)}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid var(--border-color)',
                      backgroundColor: orderHistoryFilter === mode ? 'var(--primary)' : 'var(--bg-card-subtle)',
                      color: orderHistoryFilter === mode ? '#FFFFFF' : 'var(--text-secondary)',
                      textTransform: 'capitalize',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {mode === 'all'
                      ? `All (${customerOrders.length})`
                      : mode === 'active'
                      ? `Active (${activeCustomerLiveOrders.length})`
                      : `Past (${pastCustomerOrders.length})`}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Order List Inside Pop-up Card */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                maxHeight: '420px',
                padding: '14px 20px',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                backgroundColor: 'var(--bg-card-subtle)',
              }}
            >
              {filteredCustomerOrders.length === 0 ? (
                <div
                  style={{
                    padding: '36px 16px',
                    textAlign: 'center',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '13px',
                    margin: 'auto 0',
                  }}
                >
                  No orders found for this category.
                </div>
              ) : (
                filteredCustomerOrders.map((ord) => {
                  const isActive = ord.status !== 'completed' && ord.status !== 'cancelled' && ord.status !== 'served';
                  const statusInfo = getOrderStatusBadge(ord.status, ord.type);
                  const itemCount = ord.items.reduce((sum, item) => sum + (item.quantity || 1), 0);

                  return (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrderForMenu(ord);
                      }}
                      title="Click to view full ordered menu details and bill"
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: 'var(--radius-md)',
                        border: isActive ? '1px solid #FCD34D' : '1px solid var(--border-color)',
                        borderLeft: isActive ? '4px solid #F59E0B' : '4px solid #CBD5E1',
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {/* Row 1: Order #, Badge, Date */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>
                            #{ord.orderNumber}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              backgroundColor: statusInfo.bg,
                              color: statusInfo.color,
                            }}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {ord.createdAt || 'Recent'}
                        </span>
                      </div>

                      {/* Row 2: Type, Location, Item Count, Total */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 600 }}>
                          {ord.type.replace('_', ' ')} {ord.tableNumber ? `· Table ${ord.tableNumber}` : ''} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                        <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '13.5px' }}>
                          Rs. {Number(ord.total).toLocaleString()}
                        </span>
                      </div>

                      {/* Items Brief Preview */}
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--text-secondary)',
                          backgroundColor: 'var(--bg-card-subtle)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          {ord.items.map((i) => `${i.quantity || 1}x ${i.name || 'Item'}`).join(', ')}
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0,
                          }}
                        >
                          Bill Details <ChevronRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setShowOrderHistoryModal(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
