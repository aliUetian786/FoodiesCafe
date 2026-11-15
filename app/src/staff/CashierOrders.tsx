'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, OrderStatus, normalizeBranchId } from '@/types/cafe';
import {
  ShoppingBag,
  Utensils,
  Bike,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  X,
  MapPin,
  Banknote,
  ChefHat,
  AlertCircle,
  AlertTriangle,
  Eye,
  Plus,
  XCircle,
  ChevronRight,
  User as UserIcon,
  Bell,
} from 'lucide-react';
import { WalkInOrderModal } from '@/staff/WalkInOrderModal';
import { calculateHaversineKm, LOCAL_PAKISTAN_LANDMARKS } from '@/utils/openStreetMap';

function getOrderDeliveryCoords(targetOrder: Order, defaultCoords: { lat: number; lng: number }): { lat: number; lng: number } {
  if (targetOrder.customerCoordinates?.lat && targetOrder.customerCoordinates?.lng) {
    return {
      lat: Number(targetOrder.customerCoordinates.lat),
      lng: Number(targetOrder.customerCoordinates.lng),
    };
  }
  const addr = (targetOrder.deliveryAddress || '').toLowerCase();
  for (const lm of LOCAL_PAKISTAN_LANDMARKS) {
    if (addr.includes(lm.shortAddress.toLowerCase()) || addr.includes(lm.displayName.toLowerCase())) {
      return { lat: lm.lat, lng: lm.lng };
    }
  }
  const hash = Math.abs(
    (targetOrder.deliveryAddress || targetOrder.id || 'order').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  );
  const latOffset = ((hash % 40) - 20) * 0.0035;
  const lngOffset = (((hash * 7) % 40) - 20) * 0.0035;
  return {
    lat: defaultCoords.lat + (latOffset === 0 ? 0.015 : latOffset),
    lng: defaultCoords.lng + (lngOffset === 0 ? 0.012 : lngOffset),
  };
}

interface CashierOrdersScreenProps {
  isFloorStaff?: boolean;
}

export const CashierOrdersScreen: React.FC<CashierOrdersScreenProps> = ({ isFloorStaff = false }) => {
  const {
    orders,
    tables,
    currentBranch,
    currentUser,
    currentRole,
    recordCashPayment,
    updateTableStatus,
    updateTable,
    markTableFree,
    addToast,
    sendOrderToKitchen,
    setOrderKitchenForwardTime,
    setAllOrdersKitchenForwardTime,
    footerSettings,
    assignRiderToOrder,
    unassignRiderFromOrder,
    assignWaiterToOrder,
    users,
    cancelOrder,
    openNotificationModal,
  } = useApp();
  const isFloor = Boolean(isFloorStaff || currentRole === 'floor_staff');

  // Live timer tick for order forwarding countdown and kitchen stopwatch (1 second interval)
  const [now, setNow] = useState<number>(Date.now());
  React.useEffect(() => {
    const intv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intv);
  }, []);

  const [channelFilter, setChannelFilter] = useState<'all' | 'takeaway' | 'dine_in' | 'delivery'>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'arrived' | 'preparing' | 'ready'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [selectedOrderForTimer, setSelectedOrderForTimer] = useState<Order | null>(null);
  const [timerMinutesInput, setTimerMinutesInput] = useState<number>(3);

  // Check if rider is currently out for delivery on an active delivery trip
  const isRiderOutForDelivery = (riderId: string): boolean => {
    return orders.some((o) =>
      o.type === 'delivery' &&
      o.assignedRiderId === riderId &&
      (o.status === 'out_for_delivery' ||
       o.riderStatus === 'on_trip' ||
       o.riderStatus === 'en_route' ||
       o.riderStatus === 'picked_up') &&
      o.status !== 'completed' &&
      o.status !== 'delivered' &&
      o.status !== 'cancelled'
    );
  };

  // Available delivery riders for dispatch (active branch delivery staff not out for delivery)
  const availableRiders = useMemo(() => {
    const bId = normalizeBranchId(currentBranch.id);
    return users.filter((u) => {
      if (u.role !== 'delivery_staff') return false;
      if (u.status !== 'active') return false;
      if (u.riderAvailability === 'offline') return false;
      if (bId && bId !== 'all' && u.branchId && normalizeBranchId(u.branchId) !== bId) return false;
      // When rider has accepted an order and is out for delivery, cashier desk must not show him as available and cannot be assigned
      if (isRiderOutForDelivery(u.id)) return false;
      return true;
    });
  }, [users, currentBranch.id, orders]);

  // Available waiters / floor staff members for dine-in assignment
  const availableWaiters = useMemo(() => {
    const bId = normalizeBranchId(currentBranch.id);
    const list = users.filter((u) => {
      const isRole = u.role === 'floor_staff' || (u.role as string) === 'waiter';
      if (!isRole) return false;
      if (!bId || bId === 'all') return true;
      return !u.branchId || normalizeBranchId(u.branchId) === bId;
    });
    if (list.length === 0) {
      return users.filter((u) => u.role === 'floor_staff' || (u.role as string) === 'waiter');
    }
    return list;
  }, [users, currentBranch.id]);

  // Cashier Orders Hub: Active Takeaway, Delivery, and Dine-In orders
  // User Rule: Order will appear only in order hub until it is not marked paid, and when marked paid then it will not appear in order hub then it will show only in order history!
  const branchOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.branchId && normalizeBranchId(o.branchId) !== normalizeBranchId(currentBranch.id)) return false;
      if (
        o.status === 'completed' ||
        o.status === 'delivered' ||
        o.status === 'cancelled' ||
        o.riderStatus === 'delivered' ||
        o.paymentStatus === 'paid' ||
        Boolean(o.paymentCollected)
      ) return false;
      return true;
    });
  }, [orders, currentBranch.id]);

  // Active orders count
  const activeOrdersCount = useMemo(() => {
    return branchOrders.length;
  }, [branchOrders]);

  // Auto-assign closer en-route rider if distance between branch and new order is greater than distance between existing accepted order and new order
  React.useEffect(() => {
    const bCoords = {
      lat: Number(currentBranch.latitude) || 31.5126,
      lng: Number(currentBranch.longitude) || 74.3436,
    };

    branchOrders.forEach((ord) => {
      if (ord.type !== 'delivery') return;
      if (ord.assignedRiderId) return;
      if (ord.status === 'completed' || ord.status === 'delivered' || ord.status === 'cancelled') return;

      const newCoords = getOrderDeliveryCoords(ord, bCoords);
      const dBranchToNew = calculateHaversineKm(bCoords.lat, bCoords.lng, newCoords.lat, newCoords.lng);

      let bestRiderId: string | null = null;
      let minOrderDist = Infinity;

      availableRiders.forEach((r) => {
        const activeOrder = orders.find(
          (o) =>
            o.type === 'delivery' &&
            o.id !== ord.id &&
            o.assignedRiderId === r.id &&
            (o.riderStatus === 'accepted' ||
             o.riderStatus === 'en_route' ||
             o.riderStatus === 'picked_up' ||
             (o.riderStatus as string) === 'on_trip' ||
             o.status === 'out_for_delivery' ||
             o.status === 'preparing' ||
             o.status === 'accepted') &&
            o.status !== 'completed' &&
            o.status !== 'delivered' &&
            o.status !== 'cancelled'
        );

        if (activeOrder) {
          const existingCoords = getOrderDeliveryCoords(activeOrder, bCoords);
          const dExistingToNew = calculateHaversineKm(
            existingCoords.lat,
            existingCoords.lng,
            newCoords.lat,
            newCoords.lng
          );
          if (dBranchToNew > dExistingToNew && dExistingToNew < minOrderDist) {
            minOrderDist = dExistingToNew;
            bestRiderId = r.id;
          }
        }
      });

      if (bestRiderId) {
        assignRiderToOrder(ord.id, bestRiderId, true);
      }
    });
  }, [branchOrders, orders, availableRiders, currentBranch, assignRiderToOrder]);

  // Filtered orders list by channel, payment, status, and search
  const filteredOrders = useMemo(() => {
    return branchOrders.filter((ord) => {
      // Channel Filter
      if (channelFilter !== 'all' && ord.type !== channelFilter) return false;

      // Payment Filter
      if (paymentFilter === 'unpaid') {
        if (ord.paymentStatus === 'paid') return false;
      } else if (paymentFilter === 'paid') {
        if (ord.paymentStatus !== 'paid') return false;
      }

      // Status Filter (Completed removed, as completed moves to History)
      if (statusFilter !== 'all') {
        if (statusFilter === 'arrived' && ord.status !== 'placed' && ord.status !== 'accepted') return false;
        if (statusFilter === 'preparing' && ord.status !== 'preparing') return false;
        if (statusFilter === 'ready' && ord.status !== 'ready' && ord.status !== 'served' && ord.status !== 'out_for_delivery') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = ord.orderNumber?.toLowerCase() || '';
        const name = ord.customerName?.toLowerCase() || '';
        const phone = ord.customerPhone?.replace(/\s+/g, '') || '';
        const table = ord.tableNumber?.toLowerCase() || '';
        return num.includes(q) || name.includes(q) || phone.includes(q) || table.includes(q);
      }

      return true;
    });
  }, [branchOrders, channelFilter, paymentFilter, statusFilter, searchQuery]);

  // Priority Rank: Prepared & Ready at top (1), Preparing in middle (2), Need to prepare at last/bottom (3)
  const getOrderSortPriority = (status: OrderStatus): number => {
    if (status === 'ready' || status === 'served' || status === 'out_for_delivery') {
      return 1;
    }
    if (status === 'preparing') {
      return 2;
    }
    if (status === 'placed' || status === 'accepted') {
      return 3;
    }
    return 4;
  };

  // Sorted orders: Ready at TOP, Preparing in MIDDLE, Need to prepare at LAST/BOTTOM. Within same group, arrival time.
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const pA = getOrderSortPriority(a.status);
      const pB = getOrderSortPriority(b.status);
      if (pA !== pB) return pA - pB;
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [filteredOrders]);

  const formatArrivalInfo = (dateStr?: string) => {
    if (!dateStr) return { time: '--:--', date: '' };
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return {
          time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
          date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        };
      }
    } catch {}
    return { time: dateStr, date: '' };
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
      case 'delivered':
        return { label: 'DELIVERED & PAID', bg: '#DCFCE7', color: '#166534' };
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

  const getOrderTimerState = (ord: Order) => {
    // Stage check: Has it been forwarded to kitchen or started cooking?
    const isSentToKitchen = Boolean(
      ord.sentToKitchen ||
      ord.status === 'preparing' ||
      ord.status === 'ready' ||
      ord.status === 'served' ||
      ord.status === 'out_for_delivery'
    );

    if (!isSentToKitchen) {
      // Phase 1: Forwarding Countdown Timer (before moving to kitchen)
      const defaultMin = footerSettings?.autoForwardKitchenMin || 3;
      let targetTime = ord.forwardToKitchenAt ? new Date(ord.forwardToKitchenAt).getTime() : 0;
      if (!targetTime || isNaN(targetTime)) {
        const created = ord.createdAt ? new Date(ord.createdAt).getTime() : now;
        targetTime = created + defaultMin * 60 * 1000;
      }

      const remainingMs = targetTime - now;
      if (remainingMs <= 0) {
        return {
          stage: 'forwarding' as const,
          label: '00:00',
          remainingMs: 0,
        };
      }

      const totalSeconds = Math.floor(remainingMs / 1000);
      const mm = Math.floor(totalSeconds / 60);
      const ss = totalSeconds % 60;
      const formatted = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

      return {
        stage: 'countdown' as const,
        label: formatted,
        remainingMs,
      };
    } else {
      // Phase 2: Kitchen Preparation Stopwatch (after forwarding to kitchen)
      const isReady = ord.status === 'ready' || ord.status === 'served' || ord.status === 'out_for_delivery';
      const kitchenStartTime = ord.sentToKitchenAt || ord.preparationStartedAt || ord.createdAt;
      const startMs = kitchenStartTime ? new Date(kitchenStartTime).getTime() : now;
      const endMs = isReady && ord.completedAt ? new Date(ord.completedAt).getTime() : now;
      const elapsedMs = Math.max(0, endMs - startMs);

      const totalSeconds = Math.floor(elapsedMs / 1000);
      const mm = Math.floor(totalSeconds / 60);
      const ss = totalSeconds % 60;
      const formatted = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

      return {
        stage: isReady ? ('ready' as const) : ('stopwatch' as const),
        label: formatted,
        elapsedMs,
      };
    }
  };

  const handlePrintReceipt = (ord: Order) => {
    if (!ord) return;
    if (ord.status === 'cancelled') {
      addToast({
        type: 'error',
        title: 'Receipt Blocked',
        message: 'This order was cancelled. Payment receipts cannot be printed for cancelled orders.',
      });
      return;
    }

    const existingIframe = document.getElementById('foodies-cashier-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'foodies-cashier-print-iframe';
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
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px; border-bottom: 1px dotted #CBD5E1; padding-bottom: 4px;">
          <span>${item.quantity} × ${item.name}</span>
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

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2000);
    }, 300);
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
        backgroundColor: 'var(--bg-main)',
      }}
    >
      {/* ========================================================================= */}
      {/* STATIC TOP CONTROL BAR: SINGLE HORIZONTAL LINE FOR ALL FILTERS & ACTIONS    */}
      {/* ========================================================================= */}
      <div
        style={{
          flexShrink: 0,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '6px 10px',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'nowrap',
          overflow: 'hidden',
          minHeight: '44px',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {/* Channel Filters: All, Takeaway, Dine-In, Delivery */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'takeaway', label: 'Takeaway 🛍️' },
            { id: 'dine_in', label: 'Dine-In 🍽️' },
            { id: 'delivery', label: 'Delivery 🛵' },
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => setChannelFilter(ch.id as any)}
              style={{
                padding: '5px 9px',
                borderRadius: '5px',
                border: channelFilter === ch.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: channelFilter === ch.id ? 'var(--primary)' : 'transparent',
                color: channelFilter === ch.id ? '#FFFFFF' : 'var(--text-main)',
                fontSize: '11.5px',
                fontWeight: 750,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color)', flexShrink: 0 }} />

        {/* Payment Filters: All, Unpaid, Paid */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'unpaid', label: 'Unpaid' },
            { id: 'paid', label: 'Paid' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPaymentFilter(p.id as any)}
              style={{
                padding: '5px 8px',
                borderRadius: '5px',
                border: paymentFilter === p.id ? '1px solid #16A34A' : '1px solid var(--border-color)',
                backgroundColor: paymentFilter === p.id ? '#16A34A' : 'transparent',
                color: paymentFilter === p.id ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: '11.5px',
                fontWeight: 750,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color)', flexShrink: 0 }} />

        {/* Status Filters: All, Arrived, Cooking, Ready */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'arrived', label: 'Arrived' },
            { id: 'preparing', label: 'Cooking' },
            { id: 'ready', label: 'Ready' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              style={{
                padding: '5px 8px',
                borderRadius: '5px',
                border: statusFilter === tab.id ? '1px solid var(--text-main)' : '1px solid var(--border-color)',
                backgroundColor: statusFilter === tab.id ? 'var(--text-main)' : 'transparent',
                color: statusFilter === tab.id ? 'var(--bg-main)' : 'var(--text-secondary)',
                fontSize: '11.5px',
                fontWeight: 750,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input: Flexible and fits the remaining screen space */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-full)',
            padding: '5px 10px',
            flex: 1,
            minWidth: '120px',
          }}
        >
          <Search size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order #, customer, table..."
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '11.5px',
              color: 'var(--text-main)',
              width: '100%',
              minWidth: '60px',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', flexShrink: 0 }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* + Walk-in Order Button: Clean single plus */}
        <button
          onClick={() => setWalkInModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            border: 'none',
            fontWeight: 750,
            fontSize: '11.5px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            boxShadow: '0 2px 8px var(--primary-glow)',
            lineHeight: 1,
          }}
        >
          <Plus size={13} strokeWidth={2.4} color="#FFFFFF" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: 750, color: '#FFFFFF', letterSpacing: '0.01em', lineHeight: 1 }}>Walk-in</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* HORIZONTAL LINE ORDER LIST (TABLE / ROW VIEW)                              */}
      {/* ========================================================================= */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Table Header Row: Compact height matching rows */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '6px 14px',
            backgroundColor: 'var(--bg-card-subtle)',
            borderBottom: '1.5px solid var(--border-color)',
            fontSize: '11px',
            fontWeight: 800,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            minHeight: '34px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ width: '40px', textAlign: 'center', flexShrink: 0 }}>No.</div>
          <div style={{ flex: '1.2', minWidth: '150px', paddingRight: '8px' }}>Order No.</div>
          <div style={{ width: '135px', textAlign: 'center', flexShrink: 0 }}>Order Status</div>
          <div style={{ width: '75px', textAlign: 'center', flexShrink: 0 }}>Payment</div>
          <div style={{ width: '90px', textAlign: 'center', flexShrink: 0 }}>Time Arrived</div>
          <div style={{ width: '115px', textAlign: 'center', flexShrink: 0 }}>Timer</div>
          <div style={{ width: '150px', textAlign: 'center', flexShrink: 0 }}>Staff / Rider</div>
          <div style={{ width: '150px', textAlign: 'right', flexShrink: 0, paddingRight: '4px' }}>Actions</div>
        </div>

        {/* Empty state */}
        {sortedOrders.length === 0 ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              margin: 'auto',
            }}
          >
            <CheckCircle2 size={38} color="#16A34A" style={{ margin: '0 auto 12px', display: 'block' }} />
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>
              No Active Unpaid Orders
            </div>
            <p style={{ fontSize: '13px', margin: '6px 0 0' }}>
              All active orders are processed. Paid, completed, and cancelled orders are stored in Orders History.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sortedOrders.map((ord, idx) => {
              const statusInfo = getOrderStatusBadge(ord.status, ord.type);
              const arrival = formatArrivalInfo(ord.createdAt);
              const timerState = getOrderTimerState(ord);

              return (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrderDetail(ord)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 14px',
                    height: '38px',
                    minHeight: '38px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    boxSizing: 'border-box',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                  }}
                >
                  {/* 1. No. */}
                  <div
                    style={{
                      width: '40px',
                      textAlign: 'center',
                      flexShrink: 0,
                      fontWeight: 800,
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    #{idx + 1}
                  </div>

                  {/* 2. Order No. - Single line, NO customer name/phone/items/price */}
                  <div
                    style={{
                      flex: '1.2',
                      minWidth: '150px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingRight: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <span style={{ fontWeight: 900, fontSize: '13px', color: 'var(--text-main)', flexShrink: 0 }}>
                      #{ord.orderNumber}
                    </span>

                    {/* Order Type Badge */}
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 750,
                        backgroundColor:
                          ord.type === 'dine_in'
                            ? 'rgba(234, 88, 12, 0.12)'
                            : ord.type === 'takeaway'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(59, 130, 246, 0.12)',
                        color:
                          ord.type === 'dine_in'
                            ? '#EA580C'
                            : ord.type === 'takeaway'
                            ? '#059669'
                            : '#2563EB',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        flexShrink: 0,
                      }}
                    >
                      {ord.type === 'dine_in'
                        ? `🍽️ Dine-In ${ord.tableNumber ? `(Table #${ord.tableNumber})` : ''}`
                        : ord.type === 'takeaway'
                        ? '🛍️ Takeaway'
                        : '🛵 Delivery'}
                    </span>

                    {/* Channel badge: QR vs Walk-in vs Online */}
                    <span
                      style={{
                        fontSize: '9.5px',
                        fontWeight: 700,
                        backgroundColor: ord.isTableQr
                          ? '#FDF2F8'
                          : ord.isWalkIn
                          ? '#F1F5F9'
                          : '#EFF6FF',
                        color: ord.isTableQr
                          ? '#BE185D'
                          : ord.isWalkIn
                          ? '#475569'
                          : '#1D4ED8',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        border: `1px solid ${
                          ord.isTableQr
                            ? '#FBCFE8'
                            : ord.isWalkIn
                            ? '#CBD5E1'
                            : '#BFDBFE'
                        }`,
                        flexShrink: 0,
                      }}
                    >
                      {ord.isTableQr ? '📱 QR' : ord.isWalkIn ? '🚶 Walk-in' : '🌐 Online'}
                    </span>
                  </div>

                  {/* 3. Order Status */}
                  <div style={{ width: '135px', textAlign: 'center', flexShrink: 0 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        backgroundColor: statusInfo.bg,
                        color: statusInfo.color,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* 4. Payment Status */}
                  <div style={{ width: '75px', textAlign: 'center', flexShrink: 0 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--pay-unpaid-bg)',
                        color: 'var(--pay-unpaid-text)',
                        border: '1px solid rgba(220, 38, 38, 0.2)',
                        textTransform: 'uppercase',
                      }}
                    >
                      UNPAID
                    </span>
                  </div>

                  {/* 5. Time when it arrived - Single line, NO date */}
                  <div
                    style={{
                      width: '90px',
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: '11.5px', color: 'var(--text-main)' }}>
                      <Clock size={11} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                      {arrival.time}
                    </span>
                  </div>

                  {/* 6. Timer - Before Kitchen: Countdown Remaining; After Kitchen: Prep Stopwatch */}
                  <div
                    style={{ width: '115px', textAlign: 'center', flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {timerState.stage === 'countdown' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderForTimer(ord);
                          setTimerMinutesInput(ord.autoForwardCustomMin || footerSettings?.autoForwardKitchenMin || 3);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '5px',
                          border: '1px solid #FCD34D',
                          backgroundColor: '#FEF3C7',
                          color: '#B45309',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          lineHeight: 1,
                        }}
                        title="Click to adjust forwarding time to kitchen"
                      >
                        <Clock size={11} strokeWidth={2.4} style={{ display: 'inline', flexShrink: 0 }} />
                        <span>{timerState.label}</span>
                      </button>
                    ) : timerState.stage === 'forwarding' ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 7px',
                          borderRadius: '5px',
                          border: '1px solid #FED7AA',
                          backgroundColor: '#FFF7ED',
                          color: '#EA580C',
                          fontSize: '10.5px',
                          fontWeight: 800,
                        }}
                      >
                        <Clock size={10} style={{ display: 'inline' }} />
                        <span>00:00</span>
                      </span>
                    ) : timerState.stage === 'stopwatch' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderForTimer(ord);
                          setTimerMinutesInput(ord.autoForwardCustomMin || footerSettings?.autoForwardKitchenMin || 3);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '5px',
                          border: '1px solid #BFDBFE',
                          backgroundColor: '#EFF6FF',
                          color: '#1D4ED8',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          lineHeight: 1,
                        }}
                        title="Cooking in Kitchen • Click to view kitchen prep status"
                      >
                        <ChefHat size={11} strokeWidth={2.4} style={{ display: 'inline', flexShrink: 0 }} />
                        <span>{timerState.label}</span>
                      </button>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 7px',
                          borderRadius: '5px',
                          border: '1px solid #86EFAC',
                          backgroundColor: '#DCFCE7',
                          color: '#15803D',
                          fontSize: '10.5px',
                          fontWeight: 800,
                        }}
                        title="Ready for Service / Handover"
                      >
                        <CheckCircle2 size={10} style={{ display: 'inline' }} />
                        <span>Ready ({timerState.label})</span>
                      </span>
                    )}
                  </div>

                  {/* 7. Staff / Rider Selector */}
                  <div
                    style={{ width: '150px', textAlign: 'center', flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ord.type === 'delivery' ? (() => {
                      const isRiderAccepted = Boolean(
                        ord.assignedRiderId &&
                        (ord.riderStatus === 'accepted' ||
                         ord.riderStatus === 'en_route' ||
                         ord.riderStatus === 'picked_up' ||
                         (ord.riderStatus as string) === 'on_trip' ||
                         ord.status === 'out_for_delivery')
                      );

                      if (isRiderAccepted) {
                        return (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '5px',
                              border: '1.5px solid #2563EB',
                              backgroundColor: '#EFF6FF',
                              color: '#1E40AF',
                              fontSize: '11px',
                              fontWeight: 800,
                              maxWidth: '150px',
                            }}
                            title="Rider has accepted this order and cannot be changed in Cashier Order Hub"
                          >
                            <span>🛵 {ord.assignedRiderName || 'Rider'}</span>
                            <span
                              style={{
                                fontSize: '9px',
                                fontWeight: 900,
                                color: '#16A34A',
                                backgroundColor: '#DCFCE7',
                                padding: '1px 4px',
                                borderRadius: '3px',
                              }}
                            >
                              ACCEPTED
                            </span>
                          </div>
                        );
                      }

                      const branchCoords = {
                        lat: Number(currentBranch.latitude) || 31.5126,
                        lng: Number(currentBranch.longitude) || 74.3436,
                      };
                      const newOrderCoords = getOrderDeliveryCoords(ord, branchCoords);
                      const distBranchToNew = calculateHaversineKm(
                        branchCoords.lat,
                        branchCoords.lng,
                        newOrderCoords.lat,
                        newOrderCoords.lng
                      );

                      // Evaluate candidate riders with distance metrics
                      const evaluatedRiders = availableRiders.map((r) => {
                        const activeOrder = orders.find(
                          (o) =>
                            o.type === 'delivery' &&
                            o.id !== ord.id &&
                            o.assignedRiderId === r.id &&
                            (o.riderStatus === 'accepted' ||
                             o.riderStatus === 'en_route' ||
                             o.riderStatus === 'picked_up' ||
                             (o.riderStatus as string) === 'on_trip' ||
                             o.status === 'out_for_delivery' ||
                             o.status === 'preparing' ||
                             o.status === 'accepted') &&
                            o.status !== 'completed' &&
                            o.status !== 'delivered' &&
                            o.status !== 'cancelled'
                        );

                        if (activeOrder) {
                          const existingOrderCoords = getOrderDeliveryCoords(activeOrder, branchCoords);
                          const distExistingToNew = calculateHaversineKm(
                            existingOrderCoords.lat,
                            existingOrderCoords.lng,
                            newOrderCoords.lat,
                            newOrderCoords.lng
                          );
                          const isCloserThanBranch = distBranchToNew > distExistingToNew;
                          return {
                            rider: r,
                            hasActiveOrder: true,
                            distExistingToNew,
                            distBranchToNew,
                            isCloserThanBranch,
                            label: `${r.name} (${distExistingToNew} km to active delivery, ${distBranchToNew} km from branch)`,
                          };
                        }

                        return {
                          rider: r,
                          hasActiveOrder: false,
                          distExistingToNew: null,
                          distBranchToNew,
                          isCloserThanBranch: false,
                          label: `${r.name} (${distBranchToNew} km from branch)`,
                        };
                      });

                      // Sort: Riders with isCloserThanBranch come first at the top, sorted by distExistingToNew ascending
                      const closerRiders = evaluatedRiders
                        .filter((er) => er.isCloserThanBranch)
                        .sort((a, b) => (a.distExistingToNew || 0) - (b.distExistingToNew || 0));

                      const otherRiders = evaluatedRiders
                        .filter((er) => !er.isCloserThanBranch)
                        .sort((a, b) => a.distBranchToNew - b.distBranchToNew);

                      const sortedRiderItems = [...closerRiders, ...otherRiders];

                      // Automatically show the selected rider if they have an active order closer than branch
                      const topCloserCandidate = closerRiders[0]?.rider;
                      const selectedRiderId = ord.assignedRiderId || (topCloserCandidate ? topCloserCandidate.id : '');

                      const isOrderOutForDelivery =
                        ord.status === 'out_for_delivery' ||
                        ord.riderStatus === 'on_trip' ||
                        ord.riderStatus === 'picked_up' ||
                        ord.riderStatus === 'en_route';

                      // If this order is already out for delivery, lock the rider assignment so they cannot be reassigned
                      if (isOrderOutForDelivery) {
                        return (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: '#FEF3C7',
                              color: '#92400E',
                              fontSize: '11px',
                              fontWeight: 800,
                              border: '1px solid #FDE68A',
                              maxWidth: '165px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title="Rider has accepted and is out for delivery. Cannot reassign."
                          >
                            <span>🛵 {ord.assignedRiderName || 'Rider'} (Out for Delivery)</span>
                          </div>
                        );
                      }

                      return (
                        <select
                          value={selectedRiderId}
                          onChange={(e) => {
                            e.stopPropagation();
                            const targetRiderId = e.target.value;
                            if (!targetRiderId) {
                              unassignRiderFromOrder(ord.id);
                              addToast({
                                type: 'info',
                                title: 'Rider Unassigned',
                                message: `Unassigned rider from Order #${ord.orderNumber}.`,
                              });
                            } else {
                              if (isRiderOutForDelivery(targetRiderId) && ord.assignedRiderId !== targetRiderId) {
                                addToast({
                                  type: 'error',
                                  title: 'Rider Unavailable',
                                  message: 'This rider is currently out for delivery and cannot be assigned to another order.',
                                });
                                return;
                              }
                              assignRiderToOrder(ord.id, targetRiderId);
                            }
                          }}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '5px',
                            border: selectedRiderId ? '1.5px solid #2563EB' : '1px dashed var(--border-color)',
                            backgroundColor: selectedRiderId ? '#EFF6FF' : 'var(--bg-card-subtle)',
                            color: selectedRiderId ? '#1E40AF' : 'var(--text-muted)',
                            fontSize: '11px',
                            fontWeight: 750,
                            cursor: 'pointer',
                            outline: 'none',
                            maxWidth: '165px',
                            width: '100%',
                          }}
                        >
                          <option value="">🛵 Select Rider</option>
                          {sortedRiderItems.map((item) => (
                            <option key={item.rider.id} value={item.rider.id}>
                              {item.isCloserThanBranch ? `⭐ ${item.label}` : item.label}
                            </option>
                          ))}
                        </select>
                      );
                    })() : ord.type === 'dine_in' ? (() => {
                      const tableObj = tables.find(
                        (t) =>
                          String(t.number) === String(ord.tableNumber) &&
                          (!t.branchId || normalizeBranchId(t.branchId) === normalizeBranchId(currentBranch.id))
                      );

                      const resolvedWaiterId =
                        ord.assignedWaiterId ||
                        tableObj?.assignedWaiterId ||
                        (ord.isWalkIn && ord.cashierId ? ord.cashierId : '') ||
                        '';

                      const resolvedWaiterName =
                        ord.assignedWaiterName ||
                        tableObj?.assignedWaiterName ||
                        (ord.isWalkIn && ord.cashierName ? ord.cashierName : '') ||
                        '';

                      const matchingWaiter =
                        availableWaiters.find((w) => w.id === resolvedWaiterId || w.name === resolvedWaiterName) ||
                        users.find((u) => u.id === resolvedWaiterId || u.name === resolvedWaiterName);

                      const selectedValue = matchingWaiter ? matchingWaiter.id : (resolvedWaiterId || '');
                      const hasWaiter = Boolean(matchingWaiter || resolvedWaiterName);

                      return (
                        <select
                          value={selectedValue}
                          onChange={(e) => {
                            e.stopPropagation();
                            const targetWaiterId = e.target.value;
                            if (!targetWaiterId) {
                              assignWaiterToOrder(ord.id, '', '');
                              if (tableObj) {
                                updateTable(tableObj.id, {
                                  assignedWaiterId: '',
                                  assignedWaiterName: '',
                                });
                              }
                              addToast({
                                type: 'info',
                                title: 'Staff Unassigned',
                                message: `Unassigned staff from Dine-In Order #${ord.orderNumber}.`,
                              });
                            } else {
                              const selectedW = users.find((u) => u.id === targetWaiterId);
                              const wName = selectedW ? selectedW.name : targetWaiterId;
                              assignWaiterToOrder(ord.id, targetWaiterId, wName);
                              if (tableObj) {
                                updateTable(tableObj.id, {
                                  assignedWaiterId: targetWaiterId,
                                  assignedWaiterName: wName,
                                });
                              }
                              addToast({
                                type: 'success',
                                title: 'Staff Assigned',
                                message: `Assigned ${wName} to Table ${ord.tableNumber || ''} (Order #${ord.orderNumber}).`,
                              });
                            }
                          }}
                          style={{
                            padding: '2px 6px',
                            borderRadius: '5px',
                            border: hasWaiter ? '1.5px solid #16A34A' : '1px dashed var(--border-color)',
                            backgroundColor: hasWaiter ? '#F0FDF4' : 'var(--bg-card-subtle)',
                            color: hasWaiter ? '#15803D' : 'var(--text-muted)',
                            fontSize: '11px',
                            fontWeight: 750,
                            cursor: 'pointer',
                            outline: 'none',
                            maxWidth: '150px',
                            width: '100%',
                          }}
                        >
                          <option value="">👤 Select Waiter</option>
                          {availableWaiters.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name}
                            </option>
                          ))}
                          {matchingWaiter && !availableWaiters.some((w) => w.id === matchingWaiter.id) && (
                            <option value={matchingWaiter.id}>{matchingWaiter.name}</option>
                          )}
                          {!matchingWaiter && resolvedWaiterName && (
                            <option value={resolvedWaiterId || 'custom'}>{resolvedWaiterName}</option>
                          )}
                        </select>
                      );
                    })() : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                    )}
                  </div>

                  {/* 8. Actions */}
                  <div
                    style={{
                      width: '170px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '5px',
                      flexShrink: 0,
                      paddingRight: '4px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Quick Send to Kitchen Button */}
                    {!ord.sentToKitchen &&
                      ord.status !== 'cancelled' &&
                      ord.status !== 'completed' &&
                      ord.status !== 'ready' &&
                      ord.status !== 'delivered' &&
                      ord.status !== 'served' && (
                        <button
                          type="button"
                          onClick={() => sendOrderToKitchen(ord.id)}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            border: '1px solid #86EFAC',
                            backgroundColor: '#F0FDF4',
                            color: '#15803D',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                          title="Forward order directly to kitchen queue now"
                        >
                          <ChefHat size={11} />
                          <span>To Kitchen</span>
                        </button>
                      )}

                    {/* Quick Notify Customer & Concerned Staff Button */}
                    {ord.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => openNotificationModal('send', ord)}
                        style={{
                          padding: '3px 7px',
                          borderRadius: '5px',
                          border: '1px solid #FED7AA',
                          backgroundColor: '#FFF7ED',
                          color: '#C2410C',
                          fontSize: '11px',
                          fontWeight: 750,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                        title="Send custom or preset notification for this order"
                      >
                        <Bell size={11} />
                        <span>Notify</span>
                      </button>
                    )}

                    {/* Quick Cancel Order Button */}
                    <button
                      type="button"
                      onClick={() => setOrderToCancel(ord)}
                      style={{
                        padding: '3px 7px',
                        borderRadius: '5px',
                        border: '1px solid #FCA5A5',
                        backgroundColor: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: '11px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                      title="Cancel order and move to history"
                    >
                      <XCircle size={11} />
                      <span>Cancel</span>
                    </button>

                    {/* Quick Accept Payment for Takeaway Unpaid */}
                    {ord.type === 'takeaway' && ord.paymentStatus === 'unpaid' && (
                      <button
                        type="button"
                        onClick={() => recordCashPayment(ord.id, ord.total)}
                        style={{
                          padding: '3px 7px',
                          borderRadius: '5px',
                          backgroundColor: '#16A34A',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 750,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Banknote size={11} />
                        <span>Pay 💵</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* POP-UP ORDER DETAIL MODAL                                                 */}
      {/* ========================================================================= */}
      {selectedOrderDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
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
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 850, color: 'var(--text-main)' }}>
                  Order #{selectedOrderDetail.orderNumber}
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor:
                      selectedOrderDetail.type === 'dine_in'
                        ? 'rgba(234, 88, 12, 0.12)'
                        : selectedOrderDetail.type === 'takeaway'
                        ? 'rgba(16, 185, 129, 0.12)'
                        : 'rgba(59, 130, 246, 0.12)',
                    color:
                      selectedOrderDetail.type === 'dine_in'
                        ? '#EA580C'
                        : selectedOrderDetail.type === 'takeaway'
                        ? '#059669'
                        : '#2563EB',
                  }}
                >
                  {selectedOrderDetail.type.toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: selectedOrderDetail.isTableQr
                      ? '#FDF2F8'
                      : selectedOrderDetail.isWalkIn
                      ? '#F1F5F9'
                      : '#EFF6FF',
                    color: selectedOrderDetail.isTableQr
                      ? '#BE185D'
                      : selectedOrderDetail.isWalkIn
                      ? '#475569'
                      : '#1D4ED8',
                    border: `1px solid ${
                      selectedOrderDetail.isTableQr
                        ? '#FBCFE8'
                        : selectedOrderDetail.isWalkIn
                        ? '#CBD5E1'
                        : '#BFDBFE'
                    }`,
                  }}
                >
                  {selectedOrderDetail.isTableQr
                    ? '📱 Table QR'
                    : selectedOrderDetail.isWalkIn
                    ? '🚶 Walk-in Order'
                    : '🌐 Online Order'}
                </span>
              </div>

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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body - Outer card fixed, strictly unscrollable */}
            <div
              style={{
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {/* Order Meta Bar - Fixed */}
              <div
                style={{
                  flexShrink: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Customer:</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '13px' }}>
                    {selectedOrderDetail.customerName ||
                      (selectedOrderDetail.isWalkIn ? 'Walk-in Guest' : 'Online Customer')}
                  </div>
                  {selectedOrderDetail.customerPhone && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px', marginTop: '2px' }}>
                      📞 {selectedOrderDetail.customerPhone}
                    </div>
                  )}
                </div>

                {/* Delivery address written in place of kitchen dispatch */}
                <div>
                  <div style={{ color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} color="var(--primary)" />
                    <span>Delivery Address:</span>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '12px', marginTop: '2px', wordBreak: 'break-word', lineHeight: 1.35 }}>
                    {selectedOrderDetail.type === 'delivery'
                      ? (selectedOrderDetail.deliveryAddress || 'Gulberg III, Lahore')
                      : selectedOrderDetail.type === 'dine_in'
                      ? `Dine-In (Table #${selectedOrderDetail.tableNumber || 'N/A'})`
                      : 'Takeaway (Counter Pickup)'}
                  </div>
                </div>
              </div>

              {/* Items List - ONLY THIS IS SCROLLABLE */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <h4
                  style={{
                    flexShrink: 0,
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    margin: '0 0 8px',
                    letterSpacing: '0.02em',
                  }}
                >
                  Ordered Items ({selectedOrderDetail.items.length})
                </h4>

                <div
                  style={{
                    flex: 1,
                    minHeight: '60px',
                    maxHeight: '230px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '7px',
                    paddingRight: '4px',
                  }}
                >
                  {selectedOrderDetail.items.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        flexShrink: 0,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                          {it.quantity} × {it.name}
                        </div>
                        {it.size && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Portion: {it.size}</div>
                        )}
                        {it.extras && it.extras.length > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                            Extras: {it.extras.join(', ')}
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: 850, fontSize: '13.5px', color: 'var(--text-main)' }}>
                        Rs. {(it.unitPrice * it.quantity).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Totals - Fixed */}
              <div
                style={{
                  flexShrink: 0,
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>Rs. {Number(selectedOrderDetail.originalSubtotal || selectedOrderDetail.total).toLocaleString()}</span>
                </div>
                {selectedOrderDetail.addOnSubtotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#EA580C', fontWeight: 600 }}>
                    <span>Add-ons</span>
                    <span>+ Rs. {Number(selectedOrderDetail.addOnSubtotal).toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 850, color: 'var(--text-main)', marginTop: '2px', paddingTop: '4px', borderTop: '1px dashed var(--border-color)' }}>
                  <span>Total Bill</span>
                  <span style={{ color: 'var(--primary)' }}>
                    Rs. {Number(selectedOrderDetail.total).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions - Fixed */}
            <div
              style={{
                flexShrink: 0,
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
                gap: '10px',
              }}
            >
              {/* Left action: Cancel order (or status notice) */}
              <div>
                {selectedOrderDetail.status === 'cancelled' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontSize: '12px', fontWeight: 700 }}>
                    <AlertCircle size={15} />
                    <span>Order CANCELLED · Payment blocked</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOrderToCancel(selectedOrderDetail)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      color: '#DC2626',
                      fontWeight: 750,
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      cursor: 'pointer',
                    }}
                  >
                    <XCircle size={14} />
                    <span>Cancel Order</span>
                  </button>
                )}
              </div>

              {/* Right actions: Kitchen Dispatch, Notify, Takeaway collection, Table Free & Print Slip */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Direct Action: Forward to Kitchen Now */}
                {!selectedOrderDetail.sentToKitchen &&
                  selectedOrderDetail.status !== 'cancelled' &&
                  selectedOrderDetail.status !== 'completed' &&
                  selectedOrderDetail.status !== 'ready' &&
                  selectedOrderDetail.status !== 'delivered' &&
                  selectedOrderDetail.status !== 'served' && (
                    <button
                      type="button"
                      onClick={() => {
                        sendOrderToKitchen(selectedOrderDetail.id);
                        setSelectedOrderDetail(null);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#DCFCE7',
                        border: '1.5px solid #86EFAC',
                        color: '#15803D',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 1px 3px rgba(22, 163, 74, 0.15)',
                      }}
                    >
                      <ChefHat size={14} />
                      <span>Send to Kitchen 👨‍🍳</span>
                    </button>
                  )}

                {selectedOrderDetail.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      const ord = selectedOrderDetail;
                      setSelectedOrderDetail(null);
                      openNotificationModal('send', ord);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#FFF7ED',
                      border: '1px solid #FDBA74',
                      color: '#C2410C',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Bell size={14} />
                    <span>Notify User / Staff</span>
                  </button>
                )}

                {/* Takeaway cash collection */}
                {selectedOrderDetail.status !== 'cancelled' && selectedOrderDetail.paymentStatus === 'unpaid' && selectedOrderDetail.type === 'takeaway' && (
                  <button
                    type="button"
                    onClick={() => {
                      recordCashPayment(selectedOrderDetail.id, selectedOrderDetail.total);
                      setSelectedOrderDetail(null);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '12.5px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Banknote size={14} />
                    <span>Collect Cash (Rs. {selectedOrderDetail.total.toLocaleString()})</span>
                  </button>
                )}

                {/* Table Free option */}
                {selectedOrderDetail.tableNumber && selectedOrderDetail.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      markTableFree(selectedOrderDetail.tableNumber!);
                      setSelectedOrderDetail(null);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontWeight: 750,
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Mark Table Free 🪑
                  </button>
                )}

                {/* Print Order Paid Slip - written in place of paid at doorstep */}
                {selectedOrderDetail.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => handlePrintReceipt(selectedOrderDetail)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      border: 'none',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px var(--primary-glow)',
                    }}
                  >
                    <Printer size={14} />
                    <span>Print Order Paid Slip</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CANCEL ORDER CONFIRMATION POP-UP SCREEN                                   */}
      {/* ========================================================================= */}
      {orderToCancel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setOrderToCancel(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xl)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <AlertTriangle size={26} color="#DC2626" />
            </div>

            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 850, color: 'var(--text-main)' }}>
              Cancel Order #{orderToCancel.orderNumber}?
            </h3>

            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Are you sure you want to cancel this order? Once confirmed, this order will be marked as cancelled and moved immediately to <strong>Order History</strong>.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                style={{
                  padding: '9px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetNum = orderToCancel.orderNumber;
                  cancelOrder(orderToCancel.id, 'Cancelled by Cashier');
                  addToast({
                    type: 'info',
                    title: 'Order Cancelled',
                    message: `Order #${targetNum} cancelled and moved to Order History.`,
                  });
                  if (selectedOrderDetail?.id === orderToCancel.id) {
                    setSelectedOrderDetail(null);
                  }
                  setOrderToCancel(null);
                }}
                style={{
                  padding: '9px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                }}
              >
                Yes, Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Walk-in Order Modal */}
      {walkInModalOpen && (
        <WalkInOrderModal
          isFloorStaff={isFloor}
          onClose={() => setWalkInModalOpen(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* KITCHEN FORWARDING TIMER & PREP STOPWATCH SETTINGS MODAL                   */}
      {/* ========================================================================= */}
      {selectedOrderForTimer && (() => {
        const ord = selectedOrderForTimer;
        const curTimer = getOrderTimerState(ord);
        const isAlreadyInKitchen = Boolean(
          ord.sentToKitchen ||
          ord.status === 'preparing' ||
          ord.status === 'ready' ||
          ord.status === 'served' ||
          ord.status === 'out_for_delivery'
        );

        return (
          <div
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
            onClick={() => setSelectedOrderForTimer(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '440px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-xl)',
                border: '1px solid var(--border-color)',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: isAlreadyInKitchen ? '#EFF6FF' : '#FEF3C7',
                      color: isAlreadyInKitchen ? '#2563EB' : '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {isAlreadyInKitchen ? <ChefHat size={20} /> : <Clock size={20} />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: 'var(--text-main)' }}>
                      {isAlreadyInKitchen ? 'Kitchen Prep Stopwatch' : 'Kitchen Forwarding Timer'}
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Order #{ord.orderNumber} • {ord.type.toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrderForTimer(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '4px',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Status & Live Timer Box */}
              {!isAlreadyInKitchen ? (
                <div
                  style={{
                    backgroundColor: '#FEF3C7',
                    border: '1px solid #FCD34D',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Remaining Time to Move into Kitchen
                  </span>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#92400E', fontFamily: 'monospace', letterSpacing: '1px' }}>
                    {curTimer.label}
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#B45309', textAlign: 'center' }}>
                    Order does not move into kitchen until this timer ends.
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    backgroundColor: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Kitchen Cooking Stopwatch
                  </span>
                  <div style={{ fontSize: '32px', fontWeight: 900, color: '#1E40AF', fontFamily: 'monospace', letterSpacing: '1px' }}>
                    {curTimer.label}
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#1D4ED8', textAlign: 'center' }}>
                    {ord.status === 'ready'
                      ? '✅ Order is cooked and ready for service / handover.'
                      : '👨‍🍳 Counting elapsed cooking time in kitchen queue.'}
                  </span>
                </div>
              )}

              {/* Adjustment Controls (Before kitchen dispatch) */}
              {!isAlreadyInKitchen ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                    Set Forwarding Duration:
                  </label>

                  {/* Preset Quick Duration Pills */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {[1, 2, 3, 5, 10, 15].map((m) => {
                      const isSel = timerMinutesInput === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setTimerMinutesInput(m)}
                          style={{
                            flex: 1,
                            minWidth: '50px',
                            padding: '6px 0',
                            borderRadius: '6px',
                            border: isSel ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: isSel ? 'var(--primary)' : 'var(--bg-card-subtle)',
                            color: isSel ? '#FFFFFF' : 'var(--text-main)',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          {m}m
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Minutes Stepper */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '6px 12px',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Custom Minutes:
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setTimerMinutesInput((prev) => Math.max(1, prev - 1))}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          fontWeight: 800,
                          fontSize: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 900, fontSize: '14px', minWidth: '40px', textAlign: 'center', color: 'var(--text-main)' }}>
                        {timerMinutesInput} min{timerMinutesInput > 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTimerMinutesInput((prev) => prev + 1)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          fontWeight: 800,
                          fontSize: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 2 Main Action Options per user request */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    {/* Option 1: Apply to This Order */}
                    <button
                      type="button"
                      onClick={() => {
                        setOrderKitchenForwardTime(ord.id, timerMinutesInput);
                        setSelectedOrderForTimer(null);
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        border: 'none',
                        fontWeight: 850,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px var(--primary-glow)',
                      }}
                    >
                      <Clock size={15} />
                      <span>Apply to This Order (#{ord.orderNumber})</span>
                    </button>

                    {/* Option 2: Apply to All Orders */}
                    <button
                      type="button"
                      onClick={() => {
                        setAllOrdersKitchenForwardTime(timerMinutesInput);
                        setSelectedOrderForTimer(null);
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        border: '1.5px solid var(--primary)',
                        fontWeight: 850,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>⚡ Apply to All Orders</span>
                    </button>

                    {/* Direct Action: Forward to Kitchen Now */}
                    <button
                      type="button"
                      onClick={() => {
                        sendOrderToKitchen(ord.id);
                        setSelectedOrderForTimer(null);
                      }}
                      style={{
                        padding: '9px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        border: '1px solid #86EFAC',
                        fontWeight: 800,
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <ChefHat size={14} />
                      <span>Forward to Kitchen Now 👨‍🍳</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Already in Kitchen actions */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderForTimer(null)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 850,
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
