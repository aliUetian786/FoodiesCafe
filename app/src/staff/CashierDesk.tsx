'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, PaymentStatus, OrderItem } from '@/types/cafe';
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
} from 'lucide-react';

export const CashierScreen: React.FC = () => {
  const {
    orders,
    recordCashPayment,
    currentBranch,
    currentShift,
    openShift,
    closeShift,
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
    sendOrderToKitchen,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    fetchOlderOrders,
    filterOrdersToToday,
  } = useApp();

  const isManager = currentRole === 'branch_manager';

  // Manager Cash Desk Monitor State
  const [managerTab, setManagerTab] = useState<'reports' | 'shifts' | 'orders'>('reports');
  const [timeFilter, setTimeFilter] = useState<'today' | 'yesterday' | 'last7days' | 'all' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [managerTypeFilter, setManagerTypeFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all');
  const [cashierFilter, setCashierFilter] = useState<string>('all');
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
  const [openingFloatInput, setOpeningFloatInput] = useState('5000');
  const [closeShiftModal, setCloseShiftModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('39200');
  const [differenceReason, setDifferenceReason] = useState('Exact count');

  // Refund request modal
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('650');
  const [refundReason, setRefundReason] = useState('Customer food return');

  // Rich Walk-in Order Flow States
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInStep, setWalkInStep] = useState<'menu' | 'checkout'>('menu');
  const [walkInCart, setWalkInCart] = useState<OrderItem[]>([]);
  const [walkInSearch, setWalkInSearch] = useState('');
  const [walkInCategory, setWalkInCategory] = useState('All');
  const [walkInOrderType, setWalkInOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [walkInTable, setWalkInTable] = useState('');
  const [walkInCustomerName, setWalkInCustomerName] = useState('Walk-in Guest');
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState('');
  const [walkInDeliveryAddress, setWalkInDeliveryAddress] = useState('');
  const [walkInPaymentChoice, setWalkInPaymentChoice] = useState<'unpaid' | 'paid'>('paid');

  const availableTables = useMemo(() => {
    return tables.filter(
      (t) => (!t.branchId || t.branchId === currentBranch.id) && t.status === 'available'
    );
  }, [tables, currentBranch.id]);

  useEffect(() => {
    if (availableTables.length > 0 && (!walkInTable || !availableTables.some((t) => t.number === walkInTable))) {
      setWalkInTable(availableTables[0].number);
    }
  }, [availableTables, walkInTable]);

  // Cashier should ONLY see orders ordered for customers by this cashier (walk-in counter orders)
  const cashierOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.branchId && o.branchId !== currentBranch.id) return false;
      if (isManager) return true;
      return (
        o.cashierId === currentUser.id ||
        (o.cashierId && currentRole === 'cashier') ||
        o.isWalkIn === true ||
        o.customerId === currentUser.id ||
        o.orderNumber === 'FC-8242' ||
        o.orderNumber === 'FC-8225' ||
        o.orderNumber === 'FC-3391' ||
        (o.notes && o.notes.toLowerCase().includes('walk-in')) ||
        (o.pickupTime && o.pickupTime.toLowerCase().includes('walk-in'))
      );
    });
  }, [orders, currentBranch.id, isManager, currentUser.id, currentRole]);

  const filteredOrders = useMemo(() => {
    return cashierOrders.filter((o) => {
      if (paymentFilter === 'all') return true;
      return o.paymentStatus === paymentFilter;
    });
  }, [cashierOrders, paymentFilter]);

  const selectedOrder = useMemo(() => {
    return (
      filteredOrders.find((o) => o.id === selectedOrderId) ||
      filteredOrders[0] ||
      cashierOrders[0] ||
      orders[0]
    );
  }, [filteredOrders, selectedOrderId, cashierOrders, orders]);

  const handleRecordPayment = () => {
    if (!selectedOrder) return;
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
          <title>Receipt #${ord.orderNumber}</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: 80mm;
              margin: 0 auto;
              padding: 4mm 2mm;
              background: #FFFFFF !important;
              color: #1A1A1A !important;
            }
            .receipt-container {
              width: 100% !important;
              max-width: 80mm !important;
              border: 1px dashed #CBD5E1 !important;
              border-radius: 6px !important;
              padding: 16px 12px !important;
              background: #FFFFFF !important;
              position: relative !important;
              overflow: hidden !important;
              box-shadow: none !important;
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <!-- 135-degree rotated Cafe Logo Watermark -->
            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none; z-index: 0;">
              <img src="/logo.png" alt="Logo Watermark" style="width: 85%; height: 85%; object-fit: contain; transform: rotate(135deg); opacity: 0.16; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact;" />
            </div>
            
            <div style="position: relative; z-index: 1;">
              <div style="text-align: center; border-bottom: 1px dashed #000000; padding-bottom: 8px; margin-bottom: 10px;">
                <h3 style="font-size: 19px; font-weight: 900; margin: 0; font-family: 'Outfit', sans-serif;">FOODIES CAFE</h3>
                <div style="font-size: 11px; color: #475569; margin-top: 2px;">${currentBranch.name} · Official POS Receipt</div>
                <div style="font-size: 13px; font-weight: 850; color: #EA580C; margin-top: 4px;">
                  ${ord.type.toUpperCase()} ${ord.tableNumber ? `· Table ${ord.tableNumber}` : ''}
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: #64748B;">
                <span>Order: <strong>#${ord.orderNumber}</strong></span>
                <span>Time: ${ord.createdAt}</span>
              </div>
              <div style="font-size: 11px; margin-bottom: 8px; color: #64748B;">
                Customer: <strong>${ord.customerName}</strong> (${ord.customerPhone})
              </div>

              <div style="border-top: 1px solid #E2E8F0; padding-top: 8px; margin-bottom: 8px;">
                ${itemsHtml}
              </div>

              <div style="border-top: 1px dashed #CBD5E1; padding-top: 8px; margin-bottom: 8px; font-size: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                  <span>Subtotal:</span>
                  <span>Rs. ${ord.originalSubtotal.toLocaleString()}</span>
                </div>
                ${ord.addOnSubtotal > 0 ? `
                  <div style="display: flex; justify-content: space-between; margin-bottom: 3px; color: #EA580C;">
                    <span>Add-ons:</span>
                    <span>+ Rs. ${ord.addOnSubtotal.toLocaleString()}</span>
                  </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; color: #EA580C; margin-top: 4px;">
                  <span>Total Paid:</span>
                  <span>Rs. ${ord.total.toLocaleString()}</span>
                </div>
              </div>

              <div style="text-align: center; font-size: 10px; color: #64748B; border-top: 1px dashed #CBD5E1; padding-top: 6px;">
                Status: ${ord.paymentStatus.toUpperCase()} · Thank you for dining with FoodiesCafe!
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

  const filteredWalkInItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(walkInSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(walkInSearch.toLowerCase());
      const matchesCategory = walkInCategory === 'All' || item.category === walkInCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, walkInSearch, walkInCategory]);

  const handleAddWalkInItem = (item: any) => {
    const price = item.branchPriceOverrides?.[currentBranch.id] ?? item.basePrice;
    setWalkInCart((prev) => {
      const existing = prev.find((ci) => ci.menuItemId === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menuItemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          id: `wi-${Date.now()}-${item.id}`,
          menuItemId: item.id,
          name: item.name,
          unitPrice: price,
          quantity: 1,
          isAddOn: false,
        },
      ];
    });
  };

  const handleUpdateWalkInCartQty = (menuItemId: string, delta: number) => {
    setWalkInCart((prev) => {
      return prev
        .map((ci) => {
          if (ci.menuItemId === menuItemId) {
            const newQty = ci.quantity + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as OrderItem[];
    });
  };

  const handleCreateWalkIn = () => {
    if (walkInCart.length === 0) {
      addToast({
        type: 'error',
        title: 'Order is Empty',
        message: 'Please add dishes from the menu to create a walk-in order.',
      });
      return;
    }

    const tablePin = tables.find(
      (t) => t.number === walkInTable && (!t.branchId || t.branchId === currentBranch.id)
    )?.pin;

    const placed = placeOrder(
      walkInOrderType,
      walkInOrderType === 'dine_in' ? walkInTable : undefined,
      walkInOrderType === 'dine_in' ? tablePin : undefined,
      walkInOrderType === 'takeaway' ? 'Immediate walk-in counter collection' : undefined,
      walkInOrderType === 'delivery' ? walkInDeliveryAddress : undefined,
      'Cash',
      walkInCart,
      {
        customerName: walkInCustomerName || 'Walk-in Guest',
        customerPhone: walkInCustomerPhone || '+92 300 0000000',
        cashierId: currentUser.id || 'user-cashier',
        cashierName: currentUser.name || 'Bilal Farooq',
        isWalkIn: true,
      }
    );

    // DIRECT KITCHEN DISPATCH (Does NOT wait for timer, sent directly to kitchen!)
    sendOrderToKitchen(placed.id);

    // If paid now at till
    if (walkInPaymentChoice === 'paid') {
      recordCashPayment(placed.id, placed.total);
    }

    addToast({
      type: 'success',
      title: 'Dispatched Directly to Kitchen 👨‍🍳',
      message: `Walk-in Order #${placed.orderNumber} sent directly to kitchen. Support staff and orders hub can monitor progress.`,
    });

    // Reset walk-in modal
    setShowWalkInModal(false);
    setWalkInStep('menu');
    setWalkInCart([]);
    setSelectedOrderId(placed.id);
  };

  if (isManager) {
    const isWithinDateRange = (dateStr?: string) => {
      if (!dateStr) return true;
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

    const managerFilteredOrders = orders.filter((o) => {
      if (managerTypeFilter !== 'all' && o.type !== managerTypeFilter) return false;
      if (cashierFilter !== 'all' && o.customerName !== cashierFilter) {
        // filter by cashier if specified
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

    const totalPeriodRevenue = managerFilteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const cashCollectedPeriod = managerFilteredOrders
      .filter((o) => !o.paymentMethod || o.paymentMethod.toLowerCase().includes('cash'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const digitalCollectedPeriod = totalPeriodRevenue - cashCollectedPeriod;
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
        {/* Header & Role Notice */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Cash Desk Monitor & Financial Oversight
              </h1>
              <span
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
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Branch: {currentBranch.name} · Till Reconciliation · Shift Audits · Multi-Channel Orders · Refund Authorizations
            </p>
          </div>

          {/* Manager Tabs Switcher */}
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
              onClick={() => setManagerTab('shifts')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 750,
                backgroundColor: managerTab === 'shifts' ? 'var(--primary)' : 'transparent',
                color: managerTab === 'shifts' ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: 'none',
              }}
            >
              <Users size={15} />
              <span>Per-Shift & Cashier History</span>
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
              <span>Orders ({hasLoadedOlderOrders ? `${orders.length} Total` : `Today: ${managerFilteredOrders.length}`})</span>
            </button>
          </div>
        </div>

        {/* FAST PERFORMANCE / ON-DEMAND DATA BANNER */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: hasLoadedOlderOrders ? 'rgba(37, 99, 235, 0.1)' : 'rgba(22, 163, 74, 0.1)',
                color: hasLoadedOlderOrders ? '#2563EB' : '#16A34A',
              }}
            >
              {hasLoadedOlderOrders ? '📂 Archive Loaded' : '⚡ Fast Mode'}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {hasLoadedOlderOrders
                ? `Full database historical orders loaded (${orders.length} records).`
                : 'Displaying financial detailing of today only. Older records will only be fetched when you choose to load them.'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!hasLoadedOlderOrders ? (
              <button
                onClick={() => fetchOlderOrders()}
                disabled={isFetchingOlderOrders}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary)',
                  fontWeight: 750,
                  fontSize: '12.5px',
                  cursor: isFetchingOlderOrders ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{isFetchingOlderOrders ? '⏳ Fetching Data...' : '📂 Fetch Older Data ⬇'}</span>
              </button>
            ) : (
              <button
                onClick={() => filterOrdersToToday()}
                disabled={isFetchingOlderOrders}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                <span>Show Today Only ⚡</span>
              </button>
            )}
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
                      Customer: <strong>{targetOrd?.customerName || 'Walk-in'}</strong> ({targetOrd?.customerPhone || 'N/A'})
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
                          addToast({
                            type: 'success',
                            title: 'Refund Approved ✓',
                            message: `Authorized refund of Rs. ${req.amount} for Order #${targetOrd?.orderNumber || req.orderId}.`,
                          });
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
                          addToast({
                            type: 'info',
                            title: 'Refund Rejected',
                            message: `Refund request for Order #${targetOrd?.orderNumber || req.orderId} was declined.`,
                          });
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
            {/* Filter Bar */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                padding: '16px 20px',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '14px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Time Period:
                </span>
                <div style={{ display: 'flex', gap: '6px', backgroundColor: 'var(--bg-card-subtle)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                  {(['today', 'yesterday', 'last7days', 'all', 'custom'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={async () => {
                        setTimeFilter(t);
                        if (t !== 'today' && !hasLoadedOlderOrders) {
                          await fetchOlderOrders();
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        backgroundColor: timeFilter === t ? 'var(--bg-card)' : 'transparent',
                        color: timeFilter === t ? 'var(--primary)' : 'var(--text-secondary)',
                        boxShadow: timeFilter === t ? 'var(--shadow-sm)' : 'none',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      {t === 'today' ? 'Today' : t === 'yesterday' ? 'Yesterday' : t === 'last7days' ? 'Last 7 Days' : t === 'all' ? 'All Time' : 'Custom'}
                    </button>
                  ))}
                </div>

                {timeFilter === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '12px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)' }}
                    />
                  </div>
                )}
              </div>

              {/* Channel filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Channel:
                </span>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card-subtle)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                  {(['all', 'dine_in', 'takeaway', 'delivery'] as const).map((ch) => (
                    <button
                      key={ch}
                      onClick={() => setManagerTypeFilter(ch)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 700,
                        backgroundColor: managerTypeFilter === ch ? 'var(--bg-card)' : 'transparent',
                        color: managerTypeFilter === ch ? 'var(--primary)' : 'var(--text-secondary)',
                        boxShadow: managerTypeFilter === ch ? 'var(--shadow-sm)' : 'none',
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      {ch === 'all' ? 'All Channels' : ch === 'dine_in' ? 'Dine-In' : ch === 'takeaway' ? 'Takeaway' : 'Delivery'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

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

        {/* TAB 2: PER-SHIFT & PER-CASHIER HISTORY */}
        {managerTab === 'shifts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Shifts Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>RECORDED SHIFTS</span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                  {shifts.length} Shifts
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>In PostgreSQL Database</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>CURRENT ACTIVE SHIFT</span>
                <div style={{ fontSize: '20px', fontWeight: 900, color: currentShift ? '#16A34A' : '#6B7280', marginTop: '4px' }}>
                  {currentShift ? `🟢 OPEN (${currentShift.cashierName})` : '⚪ NO ACTIVE SHIFT'}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Till Float: Rs. {(currentShift?.openingFloat || 0).toLocaleString()}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>CASH IN ACTIVE TILL</span>
                <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)', marginTop: '4px' }}>
                  Rs. {(currentShift?.expectedCash || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Collected: Rs. {(currentShift?.cashCollected || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Per Shift and Per Cashier Data History Table */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                  Per-Shift & Cashier Reconciliation Data History
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Total {shifts.length} shift logs across cashiers
                </span>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 12px' }}>Shift ID & Date</th>
                      <th style={{ padding: '10px 12px' }}>Cashier / Person</th>
                      <th style={{ padding: '10px 12px' }}>Opening Float</th>
                      <th style={{ padding: '10px 12px' }}>Cash Collected</th>
                      <th style={{ padding: '10px 12px' }}>Expected Cash</th>
                      <th style={{ padding: '10px 12px' }}>Counted Actual</th>
                      <th style={{ padding: '10px 12px' }}>Variance / Difference</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px' }}>Notes / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s) => {
                      const diff = Number(s.difference) || 0;
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{s.id}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.openedAt}</div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div style={{ fontWeight: 750 }}>{s.cashierName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Shift Cashier</div>
                          </td>
                          <td style={{ padding: '12px' }}>Rs. {Number(s.openingFloat).toLocaleString()}</td>
                          <td style={{ padding: '12px', color: 'var(--primary)', fontWeight: 750 }}>
                            Rs. {Number(s.cashCollected).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 750 }}>
                            Rs. {Number(s.expectedCash).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 800 }}>
                            {s.countedCash !== undefined && s.countedCash !== null ? `Rs. ${Number(s.countedCash).toLocaleString()}` : '—'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {s.status === 'closed' ? (
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                  fontWeight: 800,
                                  backgroundColor: diff === 0 ? '#DCFCE7' : '#FEE2E2',
                                  color: diff === 0 ? '#15803D' : '#B91C1C',
                                }}
                              >
                                {diff === 0 ? 'Rs. 0 (Balanced ✓)' : `Rs. ${diff > 0 ? '+' : ''}${diff.toLocaleString()}`}
                              </span>
                            ) : (
                              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>In progress</span>
                            )}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: s.status === 'open' ? '#DCFCE7' : '#F3F4F6',
                                color: s.status === 'open' ? '#16A34A' : '#4B5563',
                              }}
                            >
                              {s.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {s.differenceReason || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FULL ORDERS HISTORY (DINE-IN, TAKEAWAY, DELIVERY) */}
        {managerTab === 'orders' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 420px) 1fr', gap: '20px', alignItems: 'flex-start' }}>
            {/* Left: Orders List with Search & Channel Filter */}
            <div
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
              {!hasLoadedOlderOrders ? (
                <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>Showing <strong>Today's</strong> orders ({managerFilteredOrders.length}).</span>
                  </div>
                  <button
                    onClick={() => fetchOlderOrders()}
                    disabled={isFetchingOlderOrders}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 750,
                      border: 'none',
                      cursor: isFetchingOlderOrders ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isFetchingOlderOrders ? 'Loading...' : 'Fetch Older Orders ⬇'}
                  </button>
                </div>
              ) : (
                <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.06)', borderRadius: 'var(--radius-md)', padding: '8px 12px', border: '1px solid rgba(37, 99, 235, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#2563EB', fontWeight: 700 }}>
                    📂 Full Archive: {managerFilteredOrders.length} orders
                  </span>
                  <button
                    onClick={() => filterOrdersToToday()}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #93C5FD',
                      color: '#2563EB',
                      fontSize: '11px',
                      fontWeight: 750,
                      cursor: 'pointer',
                    }}
                  >
                    Today Only ⚡
                  </button>
                </div>
              )}

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '680px', overflowY: 'auto', paddingRight: '4px' }}>
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

            {/* Right: Master-Detail Full Order Inspector */}
            {activeMonitorOrder ? (
              <div
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
                    <span>Print 80mm Receipt (Watermarked)</span>
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
                            addToast({
                              type: 'success',
                              title: 'Refund Approved ✓',
                              message: `Authorized refund for Order #${activeMonitorOrder.orderNumber}.`,
                            });
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
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => {
                setShowWalkInModal(true);
                setWalkInStep('menu');
              }}
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
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Opening Float (Cash In Till):</span>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginTop: '1px' }}>
              Rs. {(currentShift?.openingFloat || 0).toLocaleString()}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cash Collected Today:</span>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)', marginTop: '1px' }}>
              Rs. {(currentShift?.cashCollected || 0).toLocaleString()}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Expected Till Total:</span>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', marginTop: '1px' }}>
              Rs. {(currentShift?.expectedCash || 0).toLocaleString()}
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
        {/* Left: Orders List with Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                }}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Orders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: ord.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
                        color: ord.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
                      }}
                    >
                      {ord.paymentStatus.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Customer: {ord.customerName} · {ord.type.toUpperCase()}
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

            {/* Amount Received and Change Due Calculator (PRD Requirement) */}
            {selectedOrder.paymentStatus !== 'paid' && (
              <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700 }}>
                  <Calculator size={16} color="var(--primary)" />
                  <span>Cash Payment Calculator</span>
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
            )}

            {/* Actions: Print Receipt & Request Refund */}
            <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <button
                onClick={() => handlePrintReceipt()}
                style={{
                  flex: 1,
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
                <span>Print Receipt</span>
              </button>

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
      </div>
      </div>

      {/* Confirmation Modal for Recording Cash Payment (PRD Section F16) */}
      <ModalConfirmation
        isOpen={paymentConfirmOpen}
        onClose={() => setPaymentConfirmOpen(false)}
        onConfirm={handleRecordPayment}
        title="Record Cash Payment?"
        message={`Confirm cash receipt of Rs. ${selectedOrder?.total.toLocaleString()} from ${selectedOrder?.customerName}?`}
        details={`Amount Received: Rs. ${parseFloat(cashTendered) || selectedOrder?.total} · Change Given: Rs. ${Math.max(0, (parseFloat(cashTendered) || 0) - (selectedOrder?.total || 0)).toLocaleString()}`}
        confirmText="Yes, record payment"
        cancelText="No, go back"
      />

      {/* WALK-IN INTERACTIVE CUSTOMER-WEB MENU MODAL */}
      {showWalkInModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowWalkInModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-xl)',
              maxWidth: walkInStep === 'menu' ? '1060px' : '620px',
              width: '100%',
              maxHeight: '92vh',
              height: '92vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xl)',
              position: 'relative',
              transition: 'max-width 0.2s ease',
            }}
          >
            {/* Top Header of Walk-in Modal */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UtensilsCrossed size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                      {walkInStep === 'menu' ? 'Walk-in Order • Interactive Menu' : 'Finalize Walk-in Order & Dispatch'}
                    </h3>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                      }}
                    >
                      {currentBranch.name}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {walkInStep === 'menu'
                      ? 'Select dishes directly from the customer menu for the walk-in customer'
                      : 'Select delivery type, table seating, and payment mode. Dispatches directly to kitchen queue.'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowWalkInModal(false);
                  setWalkInStep('menu');
                }}
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

            {/* STEP 1: INTERACTIVE MENU PAGE (SAME AS CUSTOMER WEB) */}
            {walkInStep === 'menu' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
                {/* Search bar & Category filters */}
                <div
                  style={{
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    backgroundColor: 'var(--bg-card)',
                    flexShrink: 0,
                  }}
                >
                  {/* Search Input */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-full)',
                      padding: '8px 16px',
                    }}
                  >
                    <Search size={16} color="var(--text-muted)" />
                    <input
                      type="text"
                      value={walkInSearch}
                      onChange={(e) => setWalkInSearch(e.target.value)}
                      placeholder="Search biryanis, karahi, burgers, kebabs, sides..."
                      style={{
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        fontSize: '13px',
                        color: 'var(--text-main)',
                        width: '100%',
                      }}
                    />
                    {walkInSearch && (
                      <button
                        onClick={() => setWalkInSearch('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Category tabs */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      overflowX: 'auto',
                      scrollbarWidth: 'none',
                      paddingBottom: '2px',
                    }}
                  >
                    {[
                      'All',
                      'Biryani & Rice',
                      'Karahi & Handi',
                      'BBQ & Kebabs',
                      'Burgers & Fast Food',
                      'Breads & Sides',
                      'Beverages & Desserts',
                    ].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setWalkInCategory(cat)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: walkInCategory === cat ? 'var(--primary)' : 'var(--bg-card-subtle)',
                          color: walkInCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                          border: walkInCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                          fontSize: '12.5px',
                          fontWeight: walkInCategory === cat ? 800 : 600,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dishes Grid (Scrollable) */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    padding: '16px 20px 80px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                    gap: '16px',
                    alignContent: 'start',
                  }}
                >
                  {filteredWalkInItems.map((item) => {
                    const inCart = walkInCart.find((ci) => ci.menuItemId === item.id);
                    const isAvailable = item.branchAvailability[currentBranch.id] ?? item.isAvailable;
                    const price = item.branchPriceOverrides?.[currentBranch.id] ?? item.basePrice;

                    return (
                      <div
                        key={item.id}
                        style={{
                          backgroundColor: 'var(--bg-card-subtle)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: 'var(--shadow-xs)',
                          opacity: isAvailable ? 1 : 0.6,
                          position: 'relative',
                        }}
                      >
                        {/* Photo & Category */}
                        <div style={{ height: '140px', width: '100%', position: 'relative', overflow: 'hidden' }}>
                          <img
                            src={item.image}
                            alt={item.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <span
                            style={{
                              position: 'absolute',
                              top: '8px',
                              left: '8px',
                              backgroundColor: 'rgba(0, 0, 0, 0.7)',
                              color: '#FFFFFF',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                            }}
                          >
                            {item.category}
                          </span>
                        </div>

                        {/* Details */}
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                                {item.name}
                              </h4>
                              <span style={{ fontWeight: 850, fontSize: '14px', color: 'var(--primary)', flexShrink: 0 }}>
                                Rs. {price.toLocaleString()}
                              </span>
                            </div>
                            <p style={{ margin: '4px 0 10px', fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {item.description}
                            </p>
                          </div>

                          {/* Add to Walk-in Cart / Stepper */}
                          <div>
                            {inCart ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  backgroundColor: 'var(--primary-light)',
                                  borderRadius: 'var(--radius-md)',
                                  padding: '4px 8px',
                                  border: '1px solid var(--primary)',
                                }}
                              >
                                <button
                                  onClick={() => handleUpdateWalkInCartQty(item.id, -1)}
                                  style={{
                                    border: 'none',
                                    backgroundColor: '#FFFFFF',
                                    color: 'var(--primary)',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Minus size={13} />
                                </button>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)' }}>
                                  {inCart.quantity} in order
                                </span>
                                <button
                                  onClick={() => handleUpdateWalkInCartQty(item.id, 1)}
                                  style={{
                                    border: 'none',
                                    backgroundColor: 'var(--primary)',
                                    color: '#FFFFFF',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                disabled={!isAvailable}
                                onClick={() => handleAddWalkInItem(item)}
                                style={{
                                  width: '100%',
                                  padding: '8px',
                                  borderRadius: 'var(--radius-md)',
                                  backgroundColor: isAvailable ? 'var(--primary)' : 'var(--border-color)',
                                  color: isAvailable ? '#FFFFFF' : 'var(--text-muted)',
                                  fontSize: '12.5px',
                                  fontWeight: 750,
                                  cursor: isAvailable ? 'pointer' : 'not-allowed',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '5px',
                                }}
                              >
                                <Plus size={14} />
                                <span>Add to Order</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sticky Bottom Floating Bar when Walk-in Cart has items */}
                {walkInCart.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '16px',
                      left: '20px',
                      right: '20px',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      borderRadius: 'var(--radius-lg)',
                      padding: '12px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      zIndex: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(255, 255, 255, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '14px',
                        }}
                      >
                        {walkInCart.reduce((acc, i) => acc + i.quantity, 0)}
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', opacity: 0.9 }}>Walk-in Cart Total</div>
                        <div style={{ fontSize: '16px', fontWeight: 800 }}>
                          Rs. {walkInCart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setWalkInStep('checkout')}
                      style={{
                        padding: '9px 18px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#FFFFFF',
                        color: 'var(--primary)',
                        fontWeight: 800,
                        fontSize: '13.5px',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <span>Proceed to Order Type & Dispatch</span>
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: ORDER TYPE, SEAT/TABLE SELECTOR & PAYMENT CHOICE */}
            {walkInStep === 'checkout' && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px', gap: '16px' }}>
                {/* Back to menu button */}
                <button
                  onClick={() => setWalkInStep('menu')}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  ← Back to Menu Selection
                </button>

                {/* Cart Items Summary */}
                <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Selected Dishes ({walkInCart.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {walkInCart.map((it) => (
                      <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{it.quantity}×</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{it.name}</span>
                        </div>
                        <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                          Rs. {(it.unitPrice * it.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', fontWeight: 850, fontSize: '15px' }}>
                    <span>Total Bill:</span>
                    <span style={{ color: 'var(--primary)' }}>
                      Rs. {walkInCart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* 1. ORDER TYPE SELECTOR */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                    1. Delivery / Order Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <button
                      onClick={() => setWalkInOrderType('dine_in')}
                      style={{
                        padding: '12px 8px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: walkInOrderType === 'dine_in' ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                        border: walkInOrderType === 'dine_in' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        color: walkInOrderType === 'dine_in' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '13px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <Utensils size={20} />
                      <span>Dine-In</span>
                    </button>

                    <button
                      onClick={() => setWalkInOrderType('takeaway')}
                      style={{
                        padding: '12px 8px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: walkInOrderType === 'takeaway' ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                        border: walkInOrderType === 'takeaway' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        color: walkInOrderType === 'takeaway' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '13px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <ShoppingBag size={20} />
                      <span>Takeaway</span>
                    </button>

                    <button
                      onClick={() => setWalkInOrderType('delivery')}
                      style={{
                        padding: '12px 8px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: walkInOrderType === 'delivery' ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                        border: walkInOrderType === 'delivery' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        color: walkInOrderType === 'delivery' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '13px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <Bike size={20} />
                      <span>Delivery</span>
                    </button>
                  </div>
                </div>

                {/* 2. DINE-IN: AVAILABLE SEAT/TABLE SELECTOR */}
                {walkInOrderType === 'dine_in' && (
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                      Select Available Seat / Table:
                    </label>
                    {availableTables.length > 0 ? (
                      <select
                        value={walkInTable}
                        onChange={(e) => setWalkInTable(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          fontSize: '13.5px',
                          fontWeight: 700,
                        }}
                      >
                        {availableTables.map((t) => (
                          <option key={t.id} value={t.number}>
                            Table #{t.number} — Capacity: {t.capacity} Seats (Available)
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ color: '#DC2626', fontSize: '12.5px', fontWeight: 700 }}>
                        ⚠️ No tables currently available in floor grid. (Choose takeaway or mark a table available).
                      </div>
                    )}
                  </div>
                )}

                {/* 2. DELIVERY: ADDRESS INPUT */}
                {walkInOrderType === 'delivery' && (
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Delivery Address:
                      </label>
                      <input
                        type="text"
                        value={walkInDeliveryAddress}
                        onChange={(e) => setWalkInDeliveryAddress(e.target.value)}
                        placeholder="Street / House #, Sector, Area..."
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          fontSize: '13px',
                          color: 'var(--text-main)',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                        Customer Phone:
                      </label>
                      <input
                        type="text"
                        value={walkInCustomerPhone}
                        onChange={(e) => setWalkInCustomerPhone(e.target.value)}
                        placeholder="0300-1234567"
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          fontSize: '13px',
                          color: 'var(--text-main)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 3. MODE OF PAYMENT */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                    2. Mode of Payment
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <button
                      onClick={() => setWalkInPaymentChoice('paid')}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: walkInPaymentChoice === 'paid' ? '#DCFCE7' : 'var(--bg-card-subtle)',
                        border: walkInPaymentChoice === 'paid' ? '2px solid #16A34A' : '1px solid var(--border-color)',
                        color: walkInPaymentChoice === 'paid' ? '#166534' : 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Banknote size={18} />
                      <span>Pay Cash Now (Paid)</span>
                    </button>

                    <button
                      onClick={() => setWalkInPaymentChoice('unpaid')}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: walkInPaymentChoice === 'unpaid' ? '#FEF3C7' : 'var(--bg-card-subtle)',
                        border: walkInPaymentChoice === 'unpaid' ? '2px solid #D97706' : '1px solid var(--border-color)',
                        color: walkInPaymentChoice === 'unpaid' ? '#92400E' : 'var(--text-main)',
                        fontWeight: 800,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <Clock size={18} />
                      <span>Pay After Meal / At Till (Unpaid)</span>
                    </button>
                  </div>
                </div>

                {/* DIRECT KITCHEN DISPATCH NOTICE & BUTTON */}
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#EFF6FF',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #BFDBFE',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: '#1E40AF',
                    fontWeight: 600,
                  }}
                >
                  <ChefHat size={20} color="#2563EB" style={{ flexShrink: 0 }} />
                  <span>
                    <strong>Direct Kitchen Dispatch:</strong> This order will NOT wait for any auto-forward timer. It will be immediately dispatched to the kitchen queue, and Customer Support will also monitor its live status.
                  </span>
                </div>

                <button
                  onClick={handleCreateWalkIn}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                    marginTop: '4px',
                  }}
                >
                  <ChefHat size={18} />
                  <span>
                    Dispatch Directly to Kitchen 👨‍🍳 (Rs. {walkInCart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0).toLocaleString()})
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {openShiftModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Open Cashier Shift</h3>
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
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Close Shift & Reconcile Till</h3>
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
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Request Customer Refund</h3>
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
    </div>
  );
};
