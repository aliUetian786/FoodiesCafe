'use client';

import { HistoricalLoadingModal } from '../components/common/HistoricalLoadingModal';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, PaymentStatus, OrderItem, normalizeBranchId } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  Banknote,
  Receipt,
  Calculator,
  Printer,
  PlusCircle,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Users,
  Calendar,
  TrendingUp,
  FileText,
  CheckCircle,
  XCircle,
  Search,
  DollarSign,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  ShoppingBag,
  Utensils,
  Bike,
  X,
  Plus,
  Minus,
  ChefHat,
  Trash2,
  UtensilsCrossed,
  QrCode,
  Bell,
} from 'lucide-react';
import { TableQrModal } from './TableQrModal';
import { WalkInOrderModal } from './WalkInOrderModal';
import { AssignTablesModal } from './AssignTablesModal';

export const CashierScreen: React.FC = () => {
  const {
    orders,
    recordCashPayment,
    currentBranch,
    currentShift,
    openShift,
    closeShift,
    updateShiftOpeningBalance,
    requestRefund,
    decideRefund,
    refundRequests,
    shifts,
    users,
    currentRole,
    currentUser,
    menuItems,
    placeOrder,
    addToCart,
    cart,
    addToast,
    tables,
    updateTableStatus,
    markTableFree,
    sendOrderToKitchen,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    fetchOlderOrders,
    filterOrdersToToday,
    openNotificationModal,
  } = useApp();

  const isManager = currentRole === 'branch_manager';

  // Manager Cash Desk Monitor State
  const [managerTab, setManagerTab] = useState<'reports' | 'orders'>('reports');
  const [timeFilter, setTimeFilter] = useState<'today' | 'yesterday' | 'last7days' | 'all' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [managerTypeFilter, setManagerTypeFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all');
  const [shiftCashierFilter, setShiftCashierFilter] = useState<string>('all');
  const [managerSearch, setManagerSearch] = useState<string>('');
  const [selectedMonitorOrderId, setSelectedMonitorOrderId] = useState<string>(orders[0]?.id || '');

  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  
  // Payment calculator
  const [cashTendered, setCashTendered] = useState<string>('2000');
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [calculatedChange, setCalculatedChange] = useState<number | null>(null);

  // Shift Management Modals
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [openingFloatInput, setOpeningFloatInput] = useState('');
  const [closeShiftModal, setCloseShiftModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [differenceReason, setDifferenceReason] = useState('Exact count');
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editOpeningValue, setEditOpeningValue] = useState<string>('');

  // Refund request modal
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  // Table QR Code Management
  const [showTableQrModal, setShowTableQrModal] = useState(false);

  // Table Waiter Assignment Management
  const [showAssignTablesModal, setShowAssignTablesModal] = useState(false);

  // Walk-in Order Flow State
  const [showWalkInModal, setShowWalkInModal] = useState(false);

  // Helper to test if date string is today
  const isToday = (dateStr?: string) => {
    if (!dateStr) return true;
    const s = String(dateStr).toLowerCase();
    if (s.includes('today') || s.includes('just now') || s.includes('m ago') || s.includes('s ago')) return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    const isSameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    const isWithin24Hours = (now.getTime() - d.getTime()) < 24 * 60 * 60 * 1000;
    return isSameDay || isWithin24Hours;
  };

  // Cashier Desk: Counter orders for this branch (takeaway orders or cashier walk-ins, active or placed today)
  const cashierOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.branchId && o.branchId !== currentBranch.id && normalizeBranchId(o.branchId) !== normalizeBranchId(currentBranch.id)) return false;
      // Allow all takeaway orders, dine-in table orders, table QR orders, and any walk-in/desk orders
      const isDeskOrder = o.type === 'takeaway' || o.type === 'dine_in' || Boolean(o.isTableQr) || Boolean(o.cashierId) || Boolean(o.isWalkIn);
      if (!isDeskOrder) return false;
      // Keep all active orders (placed, accepted, preparing, ready, served) visible so they never disappear mid-session, plus today's completed/paid
      const isRecentOrActive = (!['completed', 'cancelled'].includes(o.status)) || isToday(o.createdAt);
      if (!isRecentOrActive) return false;
      return true;
    });
  }, [orders, currentBranch.id]);

  const filteredOrders = useMemo(() => {
    return cashierOrders.filter((o) => {
      if (paymentFilter === 'unpaid') {
        return o.paymentStatus !== 'paid' && o.status !== 'cancelled';
      }
      if (paymentFilter === 'paid') {
        return o.paymentStatus === 'paid';
      }
      return true;
    });
  }, [cashierOrders, paymentFilter]);

  // Cash collected today across branch (takeaway at desk + delivery COD collected by riders)
  const todayBranchCashOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.branchId && o.branchId !== currentBranch.id && normalizeBranchId(o.branchId) !== normalizeBranchId(currentBranch.id)) return false;
      if (!isToday(o.createdAt)) return false;
      const isPaid = o.paymentStatus === 'paid' || o.paymentCollected === true;
      if (!isPaid) return false;
      const m = (o.paymentMethod || '').toLowerCase();
      const isCashOrCod = m.includes('cash') || m.includes('cod') || !m;
      return isCashOrCod;
    });
  }, [orders, currentBranch.id]);

  const todayCashCollectedFromOrders = useMemo(() => {
    return todayBranchCashOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [todayBranchCashOrders]);

  const effectiveCashCollected = useMemo(() => {
    return Math.max(Number(currentShift?.cashCollected || 0), todayCashCollectedFromOrders);
  }, [currentShift?.cashCollected, todayCashCollectedFromOrders]);

  const effectiveExpectedTill = useMemo(() => {
    return Number(currentShift?.openingFloat || 0) + effectiveCashCollected;
  }, [currentShift?.openingFloat, effectiveCashCollected]);

  const latestClosedBranchShift = useMemo(() => {
    return shifts.find(
      (s) => s.status === 'closed' && (!s.branchId || s.branchId === currentBranch.id)
    ) || null;
  }, [shifts, currentBranch.id]);

  const activeBranchShiftForManager = useMemo(() => {
    return (
      shifts.find(
        (s) => s.status === 'open' && (!s.branchId || s.branchId === currentBranch.id)
      ) || null
    );
  }, [shifts, currentBranch.id]);

  const selectedOrder = useMemo(() => {
    return (
      filteredOrders.find((o) => o.id === selectedOrderId) ||
      filteredOrders[0] ||
      cashierOrders[0] ||
      null
    );
  }, [filteredOrders, selectedOrderId, cashierOrders]);

  const handleRecordPayment = () => {
    if (!selectedOrder) return;
    if (selectedOrder.status === 'cancelled') {
      addToast({
        type: 'error',
        title: 'Payment Blocked',
        message: 'This order was cancelled. Payment cannot be collected.',
      });
      return;
    }
    if (selectedOrder.type !== 'takeaway') {
      addToast({
        type: 'error',
        title: 'Takeaway Only',
        message: 'Cashier can only accept payment for takeaway orders. Dine-In is collected by Waiter, and Delivery is collected by Rider.',
      });
      return;
    }
    const tendered = parseFloat(cashTendered) || 0;
    if (tendered < selectedOrder.total) {
      addToast({
        type: 'error',
        title: 'Payment Incomplete',
        message: `Cash tendered (Rs. ${tendered.toLocaleString()}) is less than total bill (Rs. ${selectedOrder.total.toLocaleString()}). Full payment required.`,
      });
      return;
    }
    const res = recordCashPayment(selectedOrder.id, tendered);
    setCalculatedChange(res.change);
    setPaymentConfirmOpen(false);
  };

  const handlePrintReceipt = (targetOrder?: Order) => {
    const ord = targetOrder || selectedOrder;
    if (!ord) return;
    if (ord.status === 'cancelled') {
      addToast({
        type: 'error',
        title: 'Receipt Blocked',
        message: 'This order was cancelled. Payment receipts cannot be printed for cancelled orders.',
      });
      return;
    }

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

  if (isManager) {
    const isWithinDateRange = (dateStr?: string) => {
      if (!dateStr) return true;
      if (dateStr.toLowerCase().includes('today') || dateStr.toLowerCase().includes('just now')) {
        return timeFilter === 'today' || timeFilter === 'all';
      }
      if (dateStr.toLowerCase().includes('yesterday')) {
        return timeFilter === 'yesterday' || timeFilter === 'all';
      }
      const orderDate = new Date(dateStr);
      const now = new Date();
      if (isNaN(orderDate.getTime())) return true;

      if (timeFilter === 'today') {
        return (
          orderDate.getFullYear() === now.getFullYear() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getDate() === now.getDate()
        );
      }
      if (timeFilter === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        return (
          orderDate.getFullYear() === yesterday.getFullYear() &&
          orderDate.getMonth() === yesterday.getMonth() &&
          orderDate.getDate() === yesterday.getDate()
        );
      }
      if (timeFilter === 'last7days') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return orderDate >= weekAgo;
      }
      if (timeFilter === 'custom') {
        if (customStart && orderDate < new Date(customStart)) return false;
        if (customEnd && orderDate > new Date(customEnd)) return false;
        return true;
      }
      return true; // 'all'
    };

    const selectedShift = shiftCashierFilter.startsWith('shift:')
      ? shifts.find((s) => s.id === shiftCashierFilter.replace('shift:', ''))
      : null;
    const targetCashierId = shiftCashierFilter.startsWith('cashier:')
      ? shiftCashierFilter.replace('cashier:', '')
      : null;
    const targetCashierUser = targetCashierId ? users.find((u) => u.id === targetCashierId) : null;
    const cashierShifts = targetCashierId
      ? shifts.filter(
          (s) =>
            s.cashierId === targetCashierId ||
            (targetCashierUser && s.cashierName && s.cashierName.toLowerCase().includes(targetCashierUser.name.toLowerCase()))
        )
      : [];
    const cashierShiftIds = cashierShifts.map((s) => s.id);

    const branchCashiers = users.filter(
      (u) =>
        (u.role === 'cashier' || u.role === 'branch_manager') &&
        (!u.branchId || u.branchId === currentBranch.id)
    );

    const managerFilteredOrders = orders.filter((o) => {
      // Must match branch if order has branchId
      if (o.branchId && o.branchId !== currentBranch.id) return false;
      if (managerTypeFilter !== 'all' && o.type !== managerTypeFilter) return false;
      
      // Shift / Cashier filter
      if (shiftCashierFilter !== 'all') {
        if (selectedShift) {
          const matchShiftId = o.shiftId === selectedShift.id;
          const matchCashierId = Boolean(o.cashierId && o.cashierId === selectedShift.cashierId);
          const matchCashierName = Boolean(
            o.cashierName &&
            selectedShift.cashierName &&
            o.cashierName.toLowerCase().includes(selectedShift.cashierName.toLowerCase())
          );
          const isShiftBranch = !selectedShift.branchId || selectedShift.branchId === currentBranch.id;
          
          if (matchShiftId || matchCashierId || matchCashierName) {
            // matches directly
          } else if (isShiftBranch && !o.cashierId && !o.shiftId) {
            // Unassigned order at this branch: check if shift matches this branch
            const isOnlyShift = shifts.filter((s) => !s.branchId || s.branchId === currentBranch.id).length <= 1;
            const shiftOpenedToday = selectedShift.openedAt?.toLowerCase().includes('today') || isWithinDateRange(selectedShift.openedAt);
            if (!isOnlyShift && !shiftOpenedToday) return false;
          } else {
            return false;
          }
        } else if (targetCashierId) {
          const matchDirect = o.cashierId === targetCashierId;
          const matchName = Boolean(
            targetCashierUser &&
            o.cashierName &&
            o.cashierName.toLowerCase().includes(targetCashierUser.name.toLowerCase())
          );
          const matchShift = o.shiftId ? cashierShiftIds.includes(o.shiftId) : false;

          if (matchDirect || matchName || matchShift) {
            // matches directly
          } else if (!o.cashierId && !o.shiftId && targetCashierUser) {
            // Unassigned orders: attribute to primary cashier if branch matches
            const isPrimary = branchCashiers[0]?.id === targetCashierId;
            if (!isPrimary) return false;
          } else {
            return false;
          }
        }
      }

      if (managerSearch.trim()) {
        const q = managerSearch.toLowerCase();
        const matchNum = o.orderNumber?.toLowerCase().includes(q);
        const matchCust = o.customerName?.toLowerCase().includes(q);
        const matchPhone = o.customerPhone?.toLowerCase().includes(q);
        const matchItem = o.items?.some((i) => i.name.toLowerCase().includes(q));
        if (!matchNum && !matchCust && !matchPhone && !matchItem) return false;
      }
      return isWithinDateRange(o.createdAt);
    });

    const pendingRefunds = refundRequests.filter((r) => r.status === 'requested');
    const activeMonitorOrder = orders.find((o) => o.id === selectedMonitorOrderId) || managerFilteredOrders[0] || orders[0];

    // Compute period collections with recorded shift collections fallback
    const rawOrderRevenue = managerFilteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const rawCashFromOrders = managerFilteredOrders
      .filter((o) => !o.paymentMethod || o.paymentMethod.toLowerCase().includes('cash') || o.paymentMethod.toLowerCase().includes('cod'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const relevantShifts = selectedShift
      ? [selectedShift]
      : targetCashierId
      ? cashierShifts
      : shifts.filter((s) => !s.branchId || s.branchId === currentBranch.id);

    const recordedShiftCash = relevantShifts.reduce((sum, s) => sum + (Number(s.cashCollected) || 0), 0);
    const cashCollectedPeriod = Math.max(rawCashFromOrders, recordedShiftCash);
    const digitalCollectedPeriod = Math.max(0, rawOrderRevenue - rawCashFromOrders);
    const totalPeriodRevenue = Math.max(rawOrderRevenue, cashCollectedPeriod + digitalCollectedPeriod);

    const approvedRefundsPeriod = refundRequests
      .filter((r) => r.status === 'approved' && isWithinDateRange(r.createdAt))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const netCollectionsPeriod = totalPeriodRevenue - approvedRefundsPeriod;

    const dineInOrdersList = managerFilteredOrders.filter((o) => o.type === 'dine_in');
    const dineInRevenue = dineInOrdersList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const takeawayOrdersList = managerFilteredOrders.filter((o) => o.type === 'takeaway');
    const takeawayRevenue = takeawayOrdersList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const deliveryOrdersList = managerFilteredOrders.filter((o) => o.type === 'delivery');
    const deliveryRevenue = deliveryOrdersList.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <HistoricalLoadingModal visible={isFetchingOlderOrders} />
        {/* Header & Role Notice */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className="cashier-title-desktop" style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Cash Desk Monitor & Financial Oversight
              </h1>
              <h1 className="cashier-title-mobile" style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Cash Desk
              </h1>
              <span
                className="cashier-badge-desktop"
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'rgba(234, 88, 12, 0.1)',
                  color: '#EA580C',
                  border: '1px solid rgba(234, 88, 12, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Lock size={12} />
                <span>OBSERVATION & APPROVAL MODE</span>
              </span>
            </div>
            <p className="cashier-desc-desktop" style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Branch: {currentBranch.name} · Till Reconciliation · Shift Audits · Multi-Channel Orders · Refund Authorizations
            </p>
          </div>

          {/* Manager Tabs Switcher: Reports and Orders (Per-Shift handled by Dropdown in Calculation Report) */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-card)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              gap: '4px',
            }}
          >
            <button
              onClick={() => setManagerTab('reports')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 750,
                backgroundColor: managerTab === 'reports' ? 'var(--primary)' : 'transparent',
                color: managerTab === 'reports' ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: 'none',
              }}
            >
              <TrendingUp size={15} />
              <span>Calculation Reports</span>
            </button>
            <button
              onClick={() => setManagerTab('orders')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 750,
                backgroundColor: managerTab === 'orders' ? 'var(--primary)' : 'transparent',
                color: managerTab === 'orders' ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: 'none',
              }}
            >
              <Receipt size={15} />
              <span>Orders ({managerFilteredOrders.length})</span>
            </button>
          </div>
        </div>

        {/* ACTION REQUIRED POP-UP CARD: PENDING REFUND REQUESTS */}
        {pendingRefunds.length > 0 && (
          <div
            style={{
              backgroundColor: '#FEF3C7',
              border: '2px solid #F59E0B',
              borderRadius: 'var(--radius-lg)',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 4px 18px rgba(245, 158, 11, 0.25)',
              animation: 'pulseActionReq 2s infinite ease-in-out',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    backgroundColor: '#F59E0B',
                    color: '#FFFFFF',
                    borderRadius: 'var(--radius-full)',
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: 900,
                  }}
                >
                  ⚠️ ACTION REQUIRED
                </span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#92400E' }}>
                  {pendingRefunds.length} Customer Refund Request(s) Awaiting Branch Manager Approval
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#B45309', fontWeight: 600 }}>
                Only Branch Managers can approve or reject financial reversals
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
              {pendingRefunds.map((req) => {
                const targetOrd = orders.find((o) => o.id === req.orderId);
                return (
                  <div
                    key={req.id}
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #FCD34D',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 850, fontSize: '14.5px', color: 'var(--text-main)' }}>
                        Order #{targetOrd?.orderNumber || req.orderId}
                      </span>
                      <span style={{ fontWeight: 900, fontSize: '16px', color: '#DC2626' }}>
                        Rs. {Number(req.amount).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      Customer: <strong>{targetOrd?.customerName || (targetOrd?.isWalkIn ? 'Walk-in' : 'Online Customer')}</strong> ({targetOrd?.customerPhone || 'N/A'})
                    </div>

                    <div style={{ fontSize: '12px', color: '#78350F', backgroundColor: '#FFFBEB', padding: '6px 10px', borderRadius: '4px' }}>
                      Reason: <em>"{req.reason}"</em>
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Requested by Cashier: <strong>{req.requestedBy}</strong> · {req.createdAt}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      <button
                        onClick={() => {
                          decideRefund(req.id, true);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '6px',
                          backgroundColor: '#16A34A',
                          color: '#FFFFFF',
                          fontWeight: 750,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <CheckCircle size={14} />
                        <span>Approve Refund ✓</span>
                      </button>
                      <button
                        onClick={() => {
                          decideRefund(req.id, false);
                        }}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '6px',
                          backgroundColor: '#F3F4F6',
                          color: '#DC2626',
                          fontWeight: 750,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          border: '1px solid #E5E7EB',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <XCircle size={14} />
                        <span>Reject ✗</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 1: FINANCIAL CALCULATION REPORTS */}
        {managerTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 3 Filter Dropdowns: Time Period, Channel, Shift of Cashier */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                padding: '16px 20px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                alignItems: 'flex-end',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Dropdown 1: Time */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 180px', minWidth: '150px' }}>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={13} color="var(--primary)" />
                  <span>Time Period</span>
                </label>
                <select
                  value={timeFilter}
                  onChange={async (e) => {
                    const val = e.target.value as any;
                    setTimeFilter(val);
                    if (val !== 'today' && !hasLoadedOlderOrders) {
                      await fetchOlderOrders();
                    }
                  }}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 650,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last7days">Last 7 Days</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>

              {/* Dropdown 2: Channel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 180px', minWidth: '150px' }}>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Filter size={13} color="var(--primary)" />
                  <span>Channel</span>
                </label>
                <select
                  value={managerTypeFilter}
                  onChange={(e) => setManagerTypeFilter(e.target.value as any)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 650,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All Channels</option>
                  <option value="dine_in">Dine-In</option>
                  <option value="takeaway">Takeaway</option>
                  <option value="delivery">Delivery</option>
                </select>
              </div>

              {/* Dropdown 3: Shift of Cashier */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: '1 1 240px', minWidth: '200px' }}>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={13} color="var(--primary)" />
                  <span>Shift of Cashier</span>
                </label>
                <select
                  value={shiftCashierFilter}
                  onChange={(e) => setShiftCashierFilter(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 650,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All Shifts & Cashiers</option>
                  {shifts
                    .filter((s) => !s.branchId || s.branchId === currentBranch.id)
                    .map((s) => (
                    <option key={s.id} value={`shift:${s.id}`}>
                      Shift #{s.id} · {s.cashierName} ({s.status.toUpperCase()})
                    </option>
                  ))}
                  {users
                    .filter((u) => (u.role === 'cashier' || u.role === 'branch_manager') && (!u.branchId || u.branchId === currentBranch.id))
                    .map((u) => (
                      <option key={u.id} value={`cashier:${u.id}`}>
                        Cashier: {u.name} ({u.role === 'cashier' ? 'Cashier' : 'Manager'})
                      </option>
                    ))}
                </select>
              </div>

              {/* Custom Date Inputs if custom is selected */}
              {timeFilter === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', paddingTop: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-secondary)' }}>From:</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 650, color: 'var(--text-secondary)' }}>To:</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}
                  />
                </div>
              )}
            </div>

            {/* Always-Visible Cashier Account Balance (Opening & Closing) Card for Manager */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid #FDBA74',
                padding: '18px 20px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Banknote size={18} color="#EA580C" />
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 850, color: 'var(--text-main)' }}>
                    Cashier Account Balance (Opening & Closing) — Manager Control
                  </h4>
                </div>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#C2410C', backgroundColor: '#FFF7ED', padding: '4px 10px', borderRadius: '999px', border: '1px solid #FED7AA' }}>
                  Manager can inspect & edit Cashier Opening Balance
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {/* Open Shift Box */}
                <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803D', textTransform: 'uppercase' }}>
                    When Account Opened ({activeBranchShiftForManager ? `🟢 Open • ${activeBranchShiftForManager.cashierName}` : 'No Active Open Shift'})
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#166534', fontWeight: 650 }}>Opening Balance:</span>
                    <span style={{ fontSize: '17px', fontWeight: 900, color: '#14532D' }}>
                      Rs. {Number(activeBranchShiftForManager?.openingFloat || 0).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#166534', fontWeight: 650 }}>Current Amount in Account:</span>
                    <span style={{ fontSize: '15px', fontWeight: 850, color: '#15803D' }}>
                      Rs. {activeBranchShiftForManager
                        ? (Number(activeBranchShiftForManager.openingFloat || 0) + Math.max(Number(activeBranchShiftForManager.cashCollected || 0), cashCollectedPeriod)).toLocaleString()
                        : '0'}
                    </span>
                  </div>
                  {activeBranchShiftForManager && (
                    <div style={{ marginTop: '8px' }}>
                      {editingShiftId === activeBranchShiftForManager.id ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="number"
                            value={editOpeningValue}
                            onChange={(e) => setEditOpeningValue(e.target.value)}
                            placeholder="New Opening Rs."
                            style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #86EFAC', fontSize: '12.5px', fontWeight: 700, backgroundColor: '#FFFFFF' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              updateShiftOpeningBalance(activeBranchShiftForManager.id, parseFloat(editOpeningValue) || 0);
                              setEditingShiftId(null);
                            }}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#16A34A', color: '#FFFFFF', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingShiftId(null)}
                            style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#475569', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingShiftId(activeBranchShiftForManager.id);
                            setEditOpeningValue(String(activeBranchShiftForManager.openingFloat || 0));
                          }}
                          style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #16A34A', backgroundColor: '#FFFFFF', color: '#15803D', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Edit Opening Balance
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Closed Shift Box */}
                <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    After Closing Account ({latestClosedBranchShift ? `${latestClosedBranchShift.cashierName} • ${latestClosedBranchShift.closedAt || 'Closed'}` : 'No Closed Shift Yet'})
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 650 }}>Opened Balance:</span>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                      Rs. {Number(latestClosedBranchShift?.openingFloat || 0).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#475569', fontWeight: 650 }}>Closing Account Balance:</span>
                    <span style={{ fontSize: '17px', fontWeight: 900, color: '#EA580C' }}>
                      {latestClosedBranchShift
                        ? `Rs. ${Number(latestClosedBranchShift.countedCash ?? latestClosedBranchShift.expectedCash ?? 0).toLocaleString()}`
                        : '—'}
                    </span>
                  </div>
                  {latestClosedBranchShift && (
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: (Number(latestClosedBranchShift.difference) || 0) === 0 ? '#16A34A' : '#DC2626' }}>
                        Diff: Rs. {(Number(latestClosedBranchShift.difference) || 0) >= 0 ? '+' : ''}{(Number(latestClosedBranchShift.difference) || 0).toLocaleString()}
                      </span>
                      {editingShiftId === latestClosedBranchShift.id ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="number"
                            value={editOpeningValue}
                            onChange={(e) => setEditOpeningValue(e.target.value)}
                            style={{ width: '90px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', fontWeight: 700 }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              updateShiftOpeningBalance(latestClosedBranchShift.id, parseFloat(editOpeningValue) || 0);
                              setEditingShiftId(null);
                            }}
                            style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', backgroundColor: '#EA580C', color: '#FFFFFF', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingShiftId(latestClosedBranchShift.id);
                            setEditOpeningValue(String(latestClosedBranchShift.openingFloat || 0));
                          }}
                          style={{ padding: '4px 9px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', color: '#334155', fontSize: '11px', fontWeight: 750, cursor: 'pointer' }}
                        >
                          Edit Opening Balance
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Shift Reconciliation Card (When a shift is selected via dropdown) */}
            {selectedShift && (
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                  padding: '18px 20px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                      Shift #{selectedShift.id} Audit · {selectedShift.cashierName}
                    </h4>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: selectedShift.status === 'open' ? '#DCFCE7' : '#F3F4F6',
                        color: selectedShift.status === 'open' ? '#16A34A' : '#4B5563',
                      }}
                    >
                      {selectedShift.status.toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Opened: {selectedShift.openedAt} {selectedShift.closedAt ? `· Closed: ${selectedShift.closedAt}` : ''}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                      <span>OPENING BALANCE</span>
                      {editingShiftId !== selectedShift.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingShiftId(selectedShift.id);
                            setEditOpeningValue(String(selectedShift.openingFloat || 0));
                          }}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: '#EA580C',
                            fontSize: '10.5px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                    {editingShiftId === selectedShift.id ? (
                      <div style={{ display: 'flex', gap: '4px', marginTop: '4px', alignItems: 'center' }}>
                        <input
                          type="number"
                          value={editOpeningValue}
                          onChange={(e) => setEditOpeningValue(e.target.value)}
                          style={{ width: '85px', padding: '4px 6px', borderRadius: '5px', border: '1px solid var(--border-color)', fontSize: '12px', fontWeight: 700 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateShiftOpeningBalance(selectedShift.id, parseFloat(editOpeningValue) || 0);
                            setEditingShiftId(null);
                          }}
                          style={{ padding: '4px 8px', borderRadius: '5px', border: 'none', backgroundColor: '#16A34A', color: '#FFFFFF', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                        Rs. {Number(selectedShift.openingFloat || 0).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>CASH COLLECTED</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                      Rs. {Number(selectedShift.cashCollected || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>EXPECTED IN DRAWER</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                      Rs. {Number(selectedShift.expectedCash || 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ACTUAL COUNTED</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                      {selectedShift.countedCash !== undefined && selectedShift.countedCash !== null
                        ? `Rs. ${Number(selectedShift.countedCash).toLocaleString()}`
                        : '— (Active)'}
                    </div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>VARIANCE / DIFF</div>
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 800,
                        color: (Number(selectedShift.difference) || 0) === 0 ? '#16A34A' : '#DC2626',
                        marginTop: '2px',
                      }}
                    >
                      {selectedShift.status === 'closed'
                        ? `Rs. ${(Number(selectedShift.difference) || 0) > 0 ? '+' : ''}${(Number(selectedShift.difference) || 0).toLocaleString()}`
                        : '—'}
                    </div>
                  </div>
                </div>
                {selectedShift.differenceReason && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    Reconciliation Note: {selectedShift.differenceReason}
                  </div>
                )}
              </div>
            )}

            {/* 8 Metric Calculation Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL REVENUE</span>
                  <Banknote size={16} color="var(--primary)" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)', marginTop: '6px' }}>
                  Rs. {totalPeriodRevenue.toLocaleString()}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {managerFilteredOrders.length} orders in selected period
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>CASH IN TILLS</span>
                  <DollarSign size={16} color="#16A34A" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#16A34A', marginTop: '6px' }}>
                  Rs. {cashCollectedPeriod.toLocaleString()}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Physical paper cash in drawer
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>DIGITAL / RAAST / CARD</span>
                  <CreditCard size={16} color="#2563EB" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#2563EB', marginTop: '6px' }}>
                  Rs. {digitalCollectedPeriod.toLocaleString()}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Non-cash settlements
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>REFUNDS ISSUED</span>
                  <RotateCcw size={16} color="#DC2626" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#DC2626', marginTop: '6px' }}>
                  Rs. {approvedRefundsPeriod.toLocaleString()}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Approved return deductions
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>NET COLLECTIONS</span>
                  <ShieldCheck size={16} color="#059669" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#059669', marginTop: '6px' }}>
                  Rs. {netCollectionsPeriod.toLocaleString()}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Revenue minus customer refunds
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>DINE-IN TOTAL</span>
                  <Utensils size={16} color="#9333EA" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#9333EA', marginTop: '6px' }}>
                  Rs. {dineInRevenue.toLocaleString()}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {dineInOrdersList.length} dine-in table bills
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>TAKEAWAY TOTAL</span>
                  <ShoppingBag size={16} color="#D97706" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#D97706', marginTop: '6px' }}>
                  Rs. {takeawayRevenue.toLocaleString()}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {takeawayOrdersList.length} counter pickup orders
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>DELIVERY TOTAL</span>
                  <Bike size={16} color="#0D9488" />
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#0D9488', marginTop: '6px' }}>
                  Rs. {deliveryRevenue.toLocaleString()}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {deliveryOrdersList.length} rider delivered orders
                </div>
              </div>
            </div>

            {/* Financial Reconciliation Summary Table */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                Channel & Settlement Distribution Analysis
              </h3>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 12px' }}>Fulfillment Channel</th>
                      <th style={{ padding: '10px 12px' }}>Total Orders</th>
                      <th style={{ padding: '10px 12px' }}>Paid Orders</th>
                      <th style={{ padding: '10px 12px' }}>Unpaid / Pending</th>
                      <th style={{ padding: '10px 12px' }}>Channel Revenue</th>
                      <th style={{ padding: '10px 12px' }}>% of Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 750, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Utensils size={15} color="#9333EA" />
                        <span>Dine-In Tables</span>
                      </td>
                      <td style={{ padding: '12px' }}>{dineInOrdersList.length}</td>
                      <td style={{ padding: '12px', color: '#16A34A', fontWeight: 700 }}>{dineInOrdersList.filter(o => o.paymentStatus === 'paid').length}</td>
                      <td style={{ padding: '12px', color: '#DC2626' }}>{dineInOrdersList.filter(o => o.paymentStatus !== 'paid').length}</td>
                      <td style={{ padding: '12px', fontWeight: 800 }}>Rs. {dineInRevenue.toLocaleString()}</td>
                      <td style={{ padding: '12px', fontWeight: 750 }}>
                        {totalPeriodRevenue > 0 ? ((dineInRevenue / totalPeriodRevenue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 750, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShoppingBag size={15} color="#D97706" />
                        <span>Takeaway Counter</span>
                      </td>
                      <td style={{ padding: '12px' }}>{takeawayOrdersList.length}</td>
                      <td style={{ padding: '12px', color: '#16A34A', fontWeight: 700 }}>{takeawayOrdersList.filter(o => o.paymentStatus === 'paid').length}</td>
                      <td style={{ padding: '12px', color: '#DC2626' }}>{takeawayOrdersList.filter(o => o.paymentStatus !== 'paid').length}</td>
                      <td style={{ padding: '12px', fontWeight: 800 }}>Rs. {takeawayRevenue.toLocaleString()}</td>
                      <td style={{ padding: '12px', fontWeight: 750 }}>
                        {totalPeriodRevenue > 0 ? ((takeawayRevenue / totalPeriodRevenue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 750, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bike size={15} color="#0D9488" />
                        <span>Home Delivery</span>
                      </td>
                      <td style={{ padding: '12px' }}>{deliveryOrdersList.length}</td>
                      <td style={{ padding: '12px', color: '#16A34A', fontWeight: 700 }}>{deliveryOrdersList.filter(o => o.paymentStatus === 'paid').length}</td>
                      <td style={{ padding: '12px', color: '#DC2626' }}>{deliveryOrdersList.filter(o => o.paymentStatus !== 'paid').length}</td>
                      <td style={{ padding: '12px', fontWeight: 800 }}>Rs. {deliveryRevenue.toLocaleString()}</td>
                      <td style={{ padding: '12px', fontWeight: 750 }}>
                        {totalPeriodRevenue > 0 ? ((deliveryRevenue / totalPeriodRevenue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 900, fontSize: '14px', backgroundColor: 'var(--bg-card-subtle)' }}>
                      <td style={{ padding: '12px' }}>Gross Total</td>
                      <td style={{ padding: '12px' }}>{managerFilteredOrders.length}</td>
                      <td style={{ padding: '12px', color: '#16A34A' }}>{managerFilteredOrders.filter(o => o.paymentStatus === 'paid').length}</td>
                      <td style={{ padding: '12px', color: '#DC2626' }}>{managerFilteredOrders.filter(o => o.paymentStatus !== 'paid').length}</td>
                      <td style={{ padding: '12px', color: 'var(--primary)' }}>Rs. {totalPeriodRevenue.toLocaleString()}</td>
                      <td style={{ padding: '12px' }}>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: FULL ORDERS HISTORY (DINE-IN, TAKEAWAY, DELIVERY) */}
        {managerTab === 'orders' && (
          <div
            className="cashier-orders-grid"
            style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '20px', alignItems: 'flex-start' }}
          >
            {/* Left: Orders List with Search & Channel Filter */}
            <div
              className="cashier-orders-list-pane"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                padding: '18px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search order #, customer, phone, dish..."
                  value={managerSearch}
                  onChange={(e) => setManagerSearch(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Order Channel Quick Filter */}
              <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card-subtle)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
                {(['all', 'dine_in', 'takeaway', 'delivery'] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setManagerTypeFilter(ch)}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: 750,
                      backgroundColor: managerTypeFilter === ch ? 'var(--bg-card)' : 'transparent',
                      color: managerTypeFilter === ch ? 'var(--primary)' : 'var(--text-secondary)',
                      boxShadow: managerTypeFilter === ch ? 'var(--shadow-sm)' : 'none',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    {ch === 'all' ? 'All' : ch === 'dine_in' ? 'Dine-In' : ch === 'takeaway' ? 'Takeaway' : 'Delivery'}
                  </button>
                ))}
              </div>

              {/* Scrollable Orders List */}
              <div
                className="cashier-orders-list-scroll"
                style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '680px', overflowY: 'auto', paddingRight: '4px' }}
              >
                {managerFilteredOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No orders match your filter criteria.
                  </div>
                ) : (
                  managerFilteredOrders.map((ord) => {
                    const isSelected = activeMonitorOrder?.id === ord.id;
                    return (
                      <div
                        key={ord.id}
                        onClick={() => setSelectedMonitorOrderId(ord.id)}
                        style={{
                          backgroundColor: isSelected ? 'var(--bg-card-subtle)' : 'var(--bg-card)',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          padding: '12px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          boxShadow: isSelected ? '0 4px 12px var(--primary-glow)' : 'none',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 850, fontSize: '14px', color: 'var(--text-main)' }}>
                            #{ord.orderNumber}
                          </span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: ord.type === 'dine_in' ? 'rgba(147, 51, 234, 0.12)' : ord.type === 'takeaway' ? 'rgba(217, 119, 6, 0.12)' : 'rgba(13, 148, 136, 0.12)',
                              color: ord.type === 'dine_in' ? '#9333EA' : ord.type === 'takeaway' ? '#D97706' : '#0D9488',
                              textTransform: 'uppercase',
                            }}
                          >
                            {ord.type === 'dine_in' ? `Dine-In · T-${ord.tableNumber || '?'}` : ord.type}
                          </span>
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {ord.customerName} · {ord.items.length} item(s)
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontWeight: 850, fontSize: '15px', color: 'var(--primary)' }}>
                            Rs. {ord.total.toLocaleString()}
                          </span>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: ord.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : ord.paymentStatus === 'refunded' ? '#FEE2E2' : 'var(--pay-unpaid-bg)',
                              color: ord.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : ord.paymentStatus === 'refunded' ? '#DC2626' : 'var(--pay-unpaid-text)',
                            }}
                          >
                            {ord.paymentStatus.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Master-Detail Full Order Inspector (Hidden on mobile) */}
            {activeMonitorOrder ? (
              <div
                className="cashier-order-detail-pane"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-color)',
                  padding: '24px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '18px',
                }}
              >
                {/* Header of Detail */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ fontSize: '22px', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                        Order #{activeMonitorOrder.orderNumber}
                      </h2>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: activeMonitorOrder.type === 'dine_in' ? '#F3E8FF' : activeMonitorOrder.type === 'takeaway' ? '#FEF3C7' : '#CCFBF1',
                          color: activeMonitorOrder.type === 'dine_in' ? '#9333EA' : activeMonitorOrder.type === 'takeaway' ? '#D97706' : '#0F766E',
                          textTransform: 'uppercase',
                        }}
                      >
                        {activeMonitorOrder.type.toUpperCase()} {activeMonitorOrder.tableNumber ? `· Table ${activeMonitorOrder.tableNumber}` : ''}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: activeMonitorOrder.paymentStatus === 'paid' ? '#DCFCE7' : activeMonitorOrder.paymentStatus === 'refunded' ? '#FEE2E2' : '#FEF3C7',
                          color: activeMonitorOrder.paymentStatus === 'paid' ? '#16A34A' : activeMonitorOrder.paymentStatus === 'refunded' ? '#DC2626' : '#D97706',
                          textTransform: 'uppercase',
                        }}
                      >
                        Payment: {activeMonitorOrder.paymentStatus}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Placed: <strong>{activeMonitorOrder.createdAt}</strong> · Fulfillment Status: <strong style={{ textTransform: 'uppercase' }}>{activeMonitorOrder.status}</strong>
                    </div>
                  </div>

                  {/* Print Thermal Receipt Button */}
                  <button
                    onClick={() => handlePrintReceipt(activeMonitorOrder)}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '12.5px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Printer size={15} color="var(--primary)" />
                    <span>Print Order Paid Slip</span>
                  </button>
                </div>

                {/* Customer & Fulfillment Info Card */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 18px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '14px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>CUSTOMER NAME</span>
                    <div style={{ fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{activeMonitorOrder.customerName}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>PHONE NUMBER</span>
                    <div style={{ fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>{activeMonitorOrder.customerPhone || 'N/A'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>PAYMENT METHOD</span>
                    <div style={{ fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>{activeMonitorOrder.paymentMethod || 'Cash'}</div>
                  </div>
                  {activeMonitorOrder.deliveryAddress && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>DELIVERY ADDRESS</span>
                      <div style={{ fontWeight: 750, color: 'var(--text-main)', marginTop: '2px' }}>{activeMonitorOrder.deliveryAddress}</div>
                    </div>
                  )}
                </div>

                {/* Full Order Detail: Items Table */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    ORDER ITEMS ({activeMonitorOrder.items.length})
                  </h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px 10px' }}>Item Name</th>
                        <th style={{ padding: '8px 10px' }}>Qty</th>
                        <th style={{ padding: '8px 10px' }}>Unit Price</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMonitorOrder.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '10px' }}>
                            <div style={{ fontWeight: 750, color: 'var(--text-main)' }}>{item.name}</div>
                            {item.size && (
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Size: {item.size}</div>
                            )}
                            {item.extras && item.extras.length > 0 && (
                              <div style={{ fontSize: '11px', color: '#EA580C' }}>
                                Extras: {item.extras.join(', ')}
                              </div>
                            )}
                            {item.instructions && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                "{item.instructions}"
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px', fontWeight: 800 }}>{item.quantity}×</td>
                          <td style={{ padding: '10px' }}>Rs. {item.unitPrice.toLocaleString()}</td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 850 }}>
                            Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div style={{ borderTop: '2px dashed var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Original Subtotal:</span>
                    <span>Rs. {activeMonitorOrder.originalSubtotal?.toLocaleString() || activeMonitorOrder.total.toLocaleString()}</span>
                  </div>
                  {activeMonitorOrder.addOnSubtotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EA580C' }}>
                      <span>Add-ons Subtotal:</span>
                      <span>+ Rs. {activeMonitorOrder.addOnSubtotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 900, color: 'var(--primary)', marginTop: '6px' }}>
                    <span>Total Amount:</span>
                    <span>Rs. {activeMonitorOrder.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* If order has pending refund request */}
                {pendingRefunds.some((r) => r.orderId === activeMonitorOrder.id) && (
                  <div style={{ backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400E' }}>
                      ⚠️ Active Refund Request Pending for this Order
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {pendingRefunds.filter((r) => r.orderId === activeMonitorOrder.id).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            decideRefund(r.id, true);
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#16A34A',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 750,
                            cursor: 'pointer',
                            border: 'none',
                          }}
                        >
                          Approve Refund ✓
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="cashier-order-detail-pane" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                Select an order from the list to view its complete details.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

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
        gap: '8px',
      }}
    >
      {/* 1. TOP STATIC BLOCK: Header, Shift Controls, and Shift Panel Summary */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginBottom: '2px',
        }}
      >
        {/* Top Header & Shift Quick Panel */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-main)', lineHeight: 1.2 }}>
              Cashier Desk
            </h1>
          </div>

          {/* Shift Control Buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowWalkInModal(true)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <PlusCircle size={15} color="var(--primary)" />
              <span>Walk-in Order</span>
            </button>

            <button
              onClick={() => setShowTableQrModal(true)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                border: '1.5px solid var(--primary)',
                color: 'var(--primary)',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: 'var(--shadow-sm)',
              }}
              title="Manage dine-in tables, create new tables, delete tables, and generate QR codes"
            >
              <Utensils size={16} color="var(--primary)" />
              <span>Tables & QR Codes</span>
            </button>

            <button
              onClick={() => setShowAssignTablesModal(true)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                border: '1.5px solid #2563EB',
                color: '#2563EB',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Users size={16} color="#2563EB" />
              <span>Assign Tables</span>
            </button>

            {currentShift ? (
              <button
                onClick={() => setCloseShiftModal(true)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--status-cancelled-bg)',
                  color: 'var(--status-cancelled-text)',
                  border: '1px solid var(--status-cancelled-text)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close Shift (Reconcile Cash)
              </button>
            ) : (
              <button
                onClick={() => setOpenShiftModal(true)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Open Cash Shift
              </button>
            )}
          </div>
        </div>

        {/* SHIFT PANEL SUMMARY (Static and placed closer to header and content below) */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: '10px 18px',
            boxShadow: 'var(--shadow-sm)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Shift Status:</span>
            <div style={{ fontSize: '15px', fontWeight: 800, color: currentShift ? '#16A34A' : '#DC2626', marginTop: '1px' }}>
              {currentShift ? '🟢 ACTIVE SHIFT OPEN' : '🔴 SHIFT CLOSED'}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Opening Account Balance:</span>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginTop: '1px' }}>
              Rs. {(currentShift?.openingFloat ?? latestClosedBranchShift?.openingFloat ?? 0).toLocaleString()}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cash Collected Today:</span>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', marginTop: '1px' }}>
              Rs. {effectiveCashCollected.toLocaleString()}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Live Account Amount (Open):</span>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#16A34A', marginTop: '1px' }}>
              Rs. {effectiveExpectedTill.toLocaleString()}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Last Closing Account Amount:</span>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#EA580C', marginTop: '1px' }}>
              {latestClosedBranchShift
                ? `Rs. ${Number(latestClosedBranchShift.countedCash ?? latestClosedBranchShift.expectedCash ?? 0).toLocaleString()}`
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. SCROLLABLE BOTTOM: ORDERS DESK & PAYMENT WORKSTATION */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'flex-start' }}>
        {/* Left: Orders List with Takeaway Badge & Payment Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Header indicator: Takeaway Orders Today */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-card-subtle)',
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShoppingBag size={15} color="var(--primary)" />
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                Takeaway Orders
              </span>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 750,
                color: 'var(--primary)',
                backgroundColor: 'var(--bg-card)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-color)',
              }}
            >
              Today Only
            </span>
          </div>

          {/* Payment Status Filter */}
          <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-card-subtle)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            {(['all', 'unpaid', 'paid'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setPaymentFilter(filter)}
                style={{
                  flex: 1,
                  padding: '7px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  backgroundColor: paymentFilter === filter ? 'var(--bg-card)' : 'transparent',
                  color: paymentFilter === filter ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: paymentFilter === filter ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Orders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredOrders.length === 0 && (
              <div
                style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-color)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <ShoppingBag size={28} color="var(--text-muted)" />
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                  No Takeaway Orders For Today
                </div>
                <div style={{ fontSize: '12px' }}>
                  Only your takeaway orders placed today appear on this desk.
                </div>
              </div>
            )}

            {filteredOrders.map((ord) => {
              const isSelected = selectedOrder?.id === ord.id;
              return (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrderId(ord.id)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    padding: '16px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    boxShadow: isSelected ? '0 4px 12px var(--primary-glow)' : 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '15px' }}>Order #{ord.orderNumber}</span>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor:
                          ord.status === 'cancelled'
                            ? '#FEE2E2'
                            : ord.paymentStatus === 'paid'
                            ? 'var(--pay-paid-bg)'
                            : 'var(--pay-unpaid-bg)',
                        color:
                          ord.status === 'cancelled'
                            ? '#991B1B'
                            : ord.paymentStatus === 'paid'
                            ? 'var(--pay-paid-text)'
                            : 'var(--pay-unpaid-text)',
                      }}
                    >
                      {ord.status === 'cancelled'
                        ? 'CANCELLED'
                        : ord.paymentStatus === 'paid'
                        ? 'PAID (CASHIER)'
                        : 'UNPAID'}
                    </span>
                  </div>

                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Customer: {ord.customerName} · TAKEAWAY
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>
                      Rs. {ord.total.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{ord.createdAt}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Order Detail Panel with Calculator & Payment Recording */}
        {selectedOrder && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 135-degree rotated Cafe Logo Watermark replacing plain card background */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              <img
                src="/logo.png"
                alt="Cafe Logo Watermark"
                style={{
                  width: '85%',
                  height: '85%',
                  objectFit: 'contain',
                  transform: 'rotate(135deg)',
                  opacity: 0.16,
                  display: 'block',
                }}
              />
            </div>

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                  Order #{selectedOrder.orderNumber}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Customer: {selectedOrder.customerName} ({selectedOrder.customerPhone})
                </span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: selectedOrder.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
                  color: selectedOrder.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
                }}
              >
                {selectedOrder.paymentStatus.toUpperCase()}
              </span>
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedOrder.items.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                  <span>{i.name} × {i.quantity}</span>
                  <span style={{ fontWeight: 700 }}>Rs. {(i.unitPrice * i.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* Total breakdown */}
            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span>Original Subtotal</span>
                <span>Rs. {selectedOrder.originalSubtotal.toLocaleString()}</span>
              </div>
              {selectedOrder.addOnSubtotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--primary)', fontWeight: 700 }}>
                  <span>Stage 2 Add-ons Subtotal</span>
                  <span>+ Rs. {selectedOrder.addOnSubtotal.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 800, marginTop: '4px' }}>
                <span>Total Due:</span>
                <span style={{ color: 'var(--primary)' }}>Rs. {selectedOrder.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Workstation: Calculator for Takeaway, Waiter notice for Dine-in, Rider notice for Delivery, Blocked for Cancelled */}
            {selectedOrder.status === 'cancelled' ? (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1.5px solid #FCA5A5',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#DC2626' }}>
                  ❌ Order Cancelled
                </div>
                <div style={{ fontSize: '12px', color: '#991B1B', fontWeight: 600 }}>
                  This order was cancelled. Payment confirmation and receipts are blocked.
                </div>
              </div>
            ) : selectedOrder.paymentStatus !== 'paid' ? (
              selectedOrder.type !== 'takeaway' ? (
                selectedOrder.type === 'dine_in' ? (
                  <div
                    style={{
                      backgroundColor: '#EFF6FF',
                      border: '1.5px solid #BFDBFE',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Utensils size={16} />
                      <span>Dine-In Order · Table #{selectedOrder.tableNumber || '?'}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#1E3A8A', lineHeight: 1.5 }}>
                      Payment collection is handled at the table by <strong>Floor Staff / Waiter</strong>. Once the waiter marks payment received, this order will automatically show here as <strong>PAID</strong>. Cashiers cannot collect payment for dine-in orders directly.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      backgroundColor: '#FAF5FF',
                      border: '1.5px solid #E9D5FF',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 800, color: '#6B21A8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Bike size={16} />
                      <span>Delivery Order</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#581C87', lineHeight: 1.5 }}>
                      Payment is collected at the customer doorstep by the <strong>Delivery Rider</strong> upon handover. Once the rider marks payment collected, this order will automatically show here as <strong>PAID</strong>. Cashiers cannot collect payment for delivery orders directly.
                    </p>
                  </div>
                )
              ) : (
                <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700 }}>
                    <Calculator size={16} color="var(--primary)" />
                    <span>Takeaway Cash Payment Calculator</span>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                      Cash Received from Customer (Rs.)
                    </label>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                        fontSize: '16px',
                        fontWeight: 800,
                        color: 'var(--text-main)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Change Due / Shortage Display */}
                  {(() => {
                    const tenderedNum = parseFloat(cashTendered) || 0;
                    const isUnderpaid = tenderedNum < selectedOrder.total;
                    const shortage = selectedOrder.total - tenderedNum;
                    const changeDue = Math.max(0, tenderedNum - selectedOrder.total);

                    return (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            backgroundColor: isUnderpaid ? '#FEF2F2' : 'var(--bg-card)',
                            borderRadius: '6px',
                            border: isUnderpaid ? '1px solid #FCA5A5' : '1px solid var(--border-color)',
                          }}
                        >
                          <span style={{ fontSize: '13px', fontWeight: 700, color: isUnderpaid ? '#DC2626' : 'var(--text-main)' }}>
                            {isUnderpaid ? 'Shortage / Underpayment:' : 'Change Due to Customer:'}
                          </span>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: isUnderpaid ? '#DC2626' : '#16A34A' }}>
                            {isUnderpaid ? `- Rs. ${shortage.toLocaleString()}` : `Rs. ${changeDue.toLocaleString()}`}
                          </span>
                        </div>

                        {isUnderpaid && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 12px',
                              backgroundColor: '#FEF2F2',
                              color: '#DC2626',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              border: '1px dashed #EF4444',
                            }}
                          >
                            <AlertTriangle size={15} />
                            <span>Customer must pay the full price. Short by Rs. {shortage.toLocaleString()}</span>
                          </div>
                        )}

                        <button
                          disabled={isUnderpaid}
                          onClick={() => !isUnderpaid && setPaymentConfirmOpen(true)}
                          style={{
                            padding: '13px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: isUnderpaid ? '#94A3B8' : '#16A34A',
                            color: isUnderpaid ? '#F1F5F9' : '#FFFFFF',
                            fontSize: '14.5px',
                            fontWeight: 800,
                            cursor: isUnderpaid ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            boxShadow: isUnderpaid ? 'none' : '0 4px 12px rgba(22, 163, 74, 0.3)',
                            opacity: isUnderpaid ? 0.6 : 1,
                            pointerEvents: isUnderpaid ? 'none' : 'auto',
                          }}
                        >
                          <Banknote size={18} />
                          <span>
                            {isUnderpaid
                              ? `Short by Rs. ${shortage.toLocaleString()} — Cannot Record`
                              : `Record Cash Payment (Rs. ${selectedOrder.total.toLocaleString()})`}
                          </span>
                        </button>
                      </>
                    );
                  })()}
                </div>
              )
            ) : (
              <div
                style={{
                  backgroundColor: '#DCFCE7',
                  border: '1.5px solid #86EFAC',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#166534',
                  fontSize: '13px',
                  fontWeight: 750,
                }}
              >
                <CheckCircle2 size={18} color="#166534" />
                <span>
                  Order Payment Completed ({selectedOrder.type === 'dine_in' ? 'Collected by Waiter at Table' : selectedOrder.type === 'delivery' ? 'Collected by Rider at Doorstep' : 'Collected by Cashier'})
                </span>
              </div>
            )}

            {/* Actions: Print Receipt & Request Refund */}
            <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px', flexWrap: 'wrap' }}>
              {selectedOrder.tableNumber && selectedOrder.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => {
                    markTableFree(selectedOrder.tableNumber!);
                  }}
                  style={{
                    flex: 1,
                    minWidth: '160px',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontWeight: 800,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <span>Mark Table #{selectedOrder.tableNumber} Free 🪑</span>
                </button>
              )}

              {selectedOrder.status !== 'cancelled' && (
                <button
                  onClick={() => handlePrintReceipt()}
                  style={{
                    flex: 1,
                    minWidth: '130px',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <Printer size={15} />
                  <span>Print Order Paid Slip</span>
                </button>
              )}

              <button
                onClick={() => setRefundModalOpen(true)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid #DC2626',
                  color: '#DC2626',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                Request Refund
              </button>
            </div>
            </div>
          </div>
        )}

        {!selectedOrder && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--border-color)',
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <ShoppingBag size={42} strokeWidth={1.5} color="var(--text-muted)" />
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
              No Order Selected
            </div>
            <div style={{ fontSize: '12.5px', maxWidth: '320px', lineHeight: 1.5 }}>
              Select a takeaway order from the list on the left to record cash payments, calculate change, or print receipts.
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Confirmation Modal for Recording Cash Payment (PRD Section F16) */}
      <ModalConfirmation
        isOpen={paymentConfirmOpen && selectedOrder?.status !== 'cancelled' && selectedOrder?.type === 'takeaway'}
        onClose={() => setPaymentConfirmOpen(false)}
        onConfirm={handleRecordPayment}
        title="Record Cash Payment?"
        message={`Confirm cash receipt of Rs. ${selectedOrder?.total.toLocaleString()} from ${selectedOrder?.customerName}?`}
        details={`Amount Received: Rs. ${parseFloat(cashTendered) || selectedOrder?.total} · Change Given: Rs. ${Math.max(0, (parseFloat(cashTendered) || 0) - (selectedOrder?.total || 0)).toLocaleString()}`}
        confirmText="Yes, record payment"
        cancelText="No, go back"
      />

      {/* Walk-in Order Modal */}
      <WalkInOrderModal
        isOpen={showWalkInModal}
        onClose={() => setShowWalkInModal(false)}
        onOrderSuccess={(ord) => setSelectedOrderId(ord.id)}
      />

      {/* Open Shift Modal */}
      {openShiftModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Open Shift</h3>
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Opening Float (Starting cash in till)
              </label>
              <input
                type="number"
                value={openingFloatInput}
                onChange={(e) => setOpeningFloatInput(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '15px', color: 'var(--text-main)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setOpenShiftModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-card-subtle)' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  openShift(parseFloat(openingFloatInput) || 0);
                  setOpenShiftModal(false);
                }}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#FFFFFF', fontWeight: 700 }}
              >
                Confirm Open Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {closeShiftModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', maxWidth: '440px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Close Shift</h3>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Expected in Drawer:</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--primary)' }}>
                Rs. {(currentShift?.expectedCash || 0).toLocaleString()}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Actual Counted Cash
              </label>
              <input
                type="number"
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '15px', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Difference Explanation / Note
              </label>
              <input
                type="text"
                value={differenceReason}
                onChange={(e) => setDifferenceReason(e.target.value)}
                placeholder="Reason if any discrepancy exists..."
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-main)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setCloseShiftModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-card-subtle)' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  closeShift(parseFloat(countedCashInput) || 0, differenceReason);
                  setCloseShiftModal(false);
                }}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#DC2626', color: '#FFFFFF', fontWeight: 700 }}
              >
                Submit Reconciliation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Refund Modal */}
      {refundModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Request Refund</h3>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Refund Amount (Rs.)</label>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '14px', color: 'var(--text-main)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Reason</label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13px', color: 'var(--text-main)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setRefundModalOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-card-subtle)' }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  requestRefund(selectedOrder.id, parseFloat(refundAmount) || 0, refundReason);
                  setRefundModalOpen(false);
                }}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#EA580C', color: '#FFFFFF', fontWeight: 700 }}
              >
                Queue for Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table QR Codes Management Modal */}
      {showTableQrModal && (
        <TableQrModal
          isOpen={showTableQrModal}
          onClose={() => setShowTableQrModal(false)}
          onSimulateCustomerScan={(tbl) => {
            if (typeof window !== 'undefined') {
              window.location.href = `/?tableQr=${encodeURIComponent(tbl)}`;
            }
          }}
        />
      )}

      {/* Table Waiter Assignment Management Modal */}
      {showAssignTablesModal && (
        <AssignTablesModal
          isOpen={showAssignTablesModal}
          onClose={() => setShowAssignTablesModal(false)}
        />
      )}
    </div>
  );
};
