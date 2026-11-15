'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import { StoreMapModal } from '../customer/StoreMapModal';
import { Role, normalizeBranchId, Order } from '@/types/cafe';
import {
  BarChart3,
  Clock,
  Banknote,
  Utensils,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  Users,
  Settings,
  CreditCard,
  Smartphone,
  Building,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Bike,
  Navigation,
  Package,
  Phone,
  Bell,
  MapPin,
  Receipt,
  Wallet,
} from 'lucide-react';

interface BranchManagerScreenProps {
  onNavigate?: (view: string) => void;
}

export const BranchManagerScreen: React.FC<BranchManagerScreenProps> = ({ onNavigate }) => {
  const {
    currentBranch,
    updateBranchSettings,
    toggleBranchStatus,
    orders,
    tables,
    users,
    currentShift,
    shifts,
    updateShiftOpeningBalance,
    footerSettings,
    updateFooterSettings,
    addToast,
    assignRiderToOrder,
    updateRiderAvailability,
    setCurrentUser,
    setCurrentRole,
    openNotificationModal,
  } = useApp();

  // Timing & distance settings form state
  const [fullEditWindow, setFullEditWindow] = useState(currentBranch.fullEditWindowMin);
  const [prepTimeEstimate, setPrepTimeEstimate] = useState(currentBranch.prepTimeEstimateMin);
  const [stopAddonsTime, setStopAddonsTime] = useState(currentBranch.stopAddOnsMinBeforeReady);
  const [maxOrderDistance, setMaxOrderDistance] = useState(currentBranch.maxOrderDistanceKm ?? 50);
  const [tableQrMaxDistance, setTableQrMaxDistance] = useState(currentBranch.tableQrMaxDistanceMeters ?? 300);
  const [minDeliveryAmount, setMinDeliveryAmount] = useState(currentBranch.minDeliveryAmount ?? 500);
  const [isBusyMode, setIsBusyMode] = useState(currentBranch.isBusy);

  // Modals for timing & available tables
  const [timingConfirmOpen, setTimingConfirmOpen] = useState(false);
  const [showAvailableTablesModal, setShowAvailableTablesModal] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);

  // Cashier Opening Balance Edit & Web Home Notification Banner Editor
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editOpeningVal, setEditOpeningVal] = useState<string>('');
  const [homeNotifEnabled, setHomeNotifEnabled] = useState<boolean>(footerSettings.homeNotificationEnabled !== false);
  const [homeNotifBadge, setHomeNotifBadge] = useState<string>(footerSettings.homeNotificationBadge || 'LIVE ORDER NOTICE');
  const [homeNotifTitle, setHomeNotifTitle] = useState<string>(
    footerSettings.homeNotificationTitle || 'Fresh Handi & Dum Biryani Batch Ready — Fast Dine-In, Takeaway & Delivery!'
  );
  const [homeNotifMessage, setHomeNotifMessage] = useState<string>(
    footerSettings.homeNotificationMessage || 'Select your order mode above to browse today’s live branch menu, local chef deals, and real-time order tracking.'
  );
  const [homeNotifType, setHomeNotifType] = useState<'promo' | 'info' | 'warning' | 'success'>(
    footerSettings.homeNotificationType || 'promo'
  );

  useEffect(() => {
    setHomeNotifEnabled(footerSettings.homeNotificationEnabled !== false);
    if (footerSettings.homeNotificationBadge !== undefined) setHomeNotifBadge(footerSettings.homeNotificationBadge);
    if (footerSettings.homeNotificationTitle !== undefined) setHomeNotifTitle(footerSettings.homeNotificationTitle);
    if (footerSettings.homeNotificationMessage !== undefined) setHomeNotifMessage(footerSettings.homeNotificationMessage);
    if (footerSettings.homeNotificationType !== undefined) setHomeNotifType(footerSettings.homeNotificationType);
  }, [
    footerSettings.homeNotificationEnabled,
    footerSettings.homeNotificationBadge,
    footerSettings.homeNotificationTitle,
    footerSettings.homeNotificationMessage,
    footerSettings.homeNotificationType,
  ]);

  // Today's date comparator with ISO, timestamp, and formatted date support
  const isDateToday = (val?: any) => {
    if (!val) return true;
    if (typeof val === 'number') {
      const d = new Date(val);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (typeof val === 'string') {
      const lower = val.toLowerCase();
      if (lower.includes('today') || lower.includes('just now') || lower.includes('min ago') || lower.includes('sec ago')) return true;
      let target = val;
      if (val.includes('•')) {
        const parts = val.split('•');
        target = parts[1]?.trim() || parts[0]?.trim();
      }
      const d = new Date(target);
      if (!isNaN(d.getTime())) {
        const now = new Date();
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      const dDirect = new Date(val);
      if (!isNaN(dDirect.getTime())) {
        const now = new Date();
        return dDirect.getDate() === now.getDate() && dDirect.getMonth() === now.getMonth() && dDirect.getFullYear() === now.getFullYear();
      }
    }
    return false;
  };

  const normCurrentBranchId = normalizeBranchId(currentBranch.id);

  // Real-time branch metrics (live from database and floor staff updates)
  const {
    branchOrders,
    branchOrdersToday,
    totalOrdersToday,
    dineInTodayCount,
    takeawayTodayCount,
    deliveryTodayCount,
    inProgressOrders,
    kitchenCount,
    readyCount,
    transitCount,
    paidOrdersToday,
    totalCollectionsToday,
    cashCollectionsToday,
    digitalCollectionsToday,
    totalCashCollected,
    unpaidOrdersToday,
    unpaidTotalToday,
    occupiedTableCount,
    totalTableCount,
    tableOccupancyPercent,
    availableTables,
    onlineRidersCount,
    totalRidersCount,
    activeDeliveriesCount,
  } = useMemo(() => {
    const bOrders = orders.filter(
      (o) => !o.branchId || o.branchId === currentBranch.id || normalizeBranchId(o.branchId) === normCurrentBranchId
    );
    const bOrdersToday = bOrders.filter((o) => isDateToday(o.createdAt));
    const totalToday = bOrdersToday.length;

    const dineInToday = bOrdersToday.filter((o) => (o.type || (o as any).orderType) === 'dine_in').length;
    const takeawayToday = bOrdersToday.filter((o) => (o.type || (o as any).orderType) === 'takeaway').length;
    const deliveryToday = bOrdersToday.filter((o) => (o.type || (o as any).orderType) === 'delivery').length;

    // Cooking & In Progress: orders currently being prepared, packaged, or in transit
    const inProg = bOrders.filter(
      (o) =>
        o.status === 'placed' ||
        o.status === 'accepted' ||
        o.status === 'preparing' ||
        o.status === 'ready' ||
        o.status === 'out_for_delivery'
    );
    const inKitchen = bOrders.filter((o) => o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing').length;
    const readyToServe = inProg.filter((o) => o.status === 'ready').length;
    const outTransit = inProg.filter((o) => o.status === 'out_for_delivery').length;

    // Paid orders and real verified collections for today
    const paidToday = bOrdersToday.filter(
      (o) =>
        o.status !== 'cancelled' &&
        (o.paymentStatus === 'paid' ||
          o.paymentCollected === true ||
          o.status === 'completed' ||
          o.status === 'delivered' ||
          o.status === 'served' ||
          o.status === 'taken')
    );
    const totalCollections = paidToday.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const cashPaidToday = paidToday.filter(
      (o) =>
        !o.paymentMethod ||
        o.paymentMethod.toLowerCase().includes('cash') ||
        o.paymentMethod.toLowerCase().includes('cod')
    );
    const cashCollections = cashPaidToday.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const digitalCollections = Math.max(0, totalCollections - cashCollections);

    const shiftCash = Number(currentShift?.cashCollected || 0);
    const effectiveTillCash = Math.max(shiftCash, cashCollections);

    // Unpaid orders pending
    const unpaidToday = bOrdersToday.filter(
      (o) =>
        o.status !== 'cancelled' &&
        o.paymentStatus !== 'paid' &&
        o.paymentCollected !== true &&
        o.status !== 'completed' &&
        o.status !== 'delivered' &&
        o.status !== 'served' &&
        o.status !== 'taken'
    );
    const unpaidTotal = unpaidToday.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    // Real table occupancy from floor staff (live tables state synchronized across all staff)
    const bTables = tables.filter(
      (t) => !t.branchId || t.branchId === currentBranch.id || normalizeBranchId(t.branchId) === normCurrentBranchId
    );
    const occupiedT = bTables.filter((t) => t.status === 'occupied').length;
    const totalT = bTables.length;
    const occPercent = totalT > 0 ? Math.round((occupiedT / totalT) * 100) : 0;
    const availTables = bTables.filter((t) => t.status !== 'occupied');

    // Delivery fleet for this branch
    const branchRiders = users.filter(
      (u) => u.role === 'delivery_staff' && (!u.branchId || u.branchId === currentBranch.id || normalizeBranchId(u.branchId) === normCurrentBranchId)
    );
    const onlineRiders = branchRiders.filter((r) => r.status === 'active').length;
    const activeDeliv = bOrdersToday.filter(
      (o) => (o.type || (o as any).orderType) === 'delivery' && (o.status === 'out_for_delivery' || o.status === 'preparing' || o.status === 'accepted')
    ).length;

    return {
      branchOrders: bOrders,
      branchOrdersToday: bOrdersToday,
      totalOrdersToday: totalToday,
      dineInTodayCount: dineInToday,
      takeawayTodayCount: takeawayToday,
      deliveryTodayCount: deliveryToday,
      inProgressOrders: inProg,
      kitchenCount: inKitchen,
      readyCount: readyToServe,
      transitCount: outTransit,
      paidOrdersToday: paidToday,
      totalCollectionsToday: totalCollections,
      cashCollectionsToday: cashCollections,
      digitalCollectionsToday: digitalCollections,
      totalCashCollected: effectiveTillCash,
      unpaidOrdersToday: unpaidToday,
      unpaidTotalToday: unpaidTotal,
      occupiedTableCount: occupiedT,
      totalTableCount: totalT,
      tableOccupancyPercent: occPercent,
      availableTables: availTables,
      onlineRidersCount: onlineRiders,
      totalRidersCount: branchRiders.length,
      activeDeliveriesCount: activeDeliv,
    };
  }, [orders, tables, users, currentBranch.id, normCurrentBranchId, currentShift?.cashCollected]);

  // Staff Collections Filter ('all' | 'cashier' | 'rider' | 'waiter' | 'user:<id>')
  const [collectionsStaffFilter, setCollectionsStaffFilter] = useState<string>('all');
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  // Staff Collections Breakdown (Cashier, Rider, Waiter)
  const staffCollectionsData = useMemo(() => {
    // Branch cashiers, riders, and waiters
    const branchCashiers = users.filter(
      (u) => u.role === 'cashier' && (!u.branchId || normalizeBranchId(u.branchId) === normCurrentBranchId)
    );
    const branchRiders = users.filter(
      (u) => u.role === 'delivery_staff' && (!u.branchId || normalizeBranchId(u.branchId) === normCurrentBranchId)
    );
    const branchWaiters = users.filter(
      (u) => (u.role === 'floor_staff' || (u.role as string) === 'waiter') && (!u.branchId || normalizeBranchId(u.branchId) === normCurrentBranchId)
    );

    // Paid & completed orders today for this branch
    const bPaidOrdersToday = orders.filter((o) => {
      const matchBranch = !o.branchId || o.branchId === currentBranch.id || normalizeBranchId(o.branchId) === normCurrentBranchId;
      if (!matchBranch) return false;
      if (o.status === 'cancelled') return false;
      const isPaid = o.paymentStatus === 'paid' || Boolean(o.paymentCollected);
      if (!isPaid) return false;
      return isDateToday(o.completedAt || o.deliveredAt || o.createdAt);
    });

    const isOrderCash = (o: Order) => {
      const method = (o.paymentMethod || '').toLowerCase();
      return method.includes('cash') || method.includes('cod');
    };

    const calculateForStaff = (user: typeof users[0], roleCategory: 'cashier' | 'rider' | 'waiter') => {
      let matchedOrders: Order[] = [];

      if (roleCategory === 'cashier') {
        const cashierShifts = (shifts || []).filter(
          (s) => s.cashierId === user.id || (user.name && s.cashierName?.toLowerCase().includes(user.name.toLowerCase()))
        );
        const shiftIds = cashierShifts.map((s) => s.id);

        matchedOrders = bPaidOrdersToday.filter((o) => {
          if (o.cashierId === user.id) return true;
          if ((o as any).staffId === user.id) return true;
          if (o.shiftId && shiftIds.includes(o.shiftId)) return true;
          if (user.name && o.cashierName && o.cashierName.toLowerCase().includes(user.name.toLowerCase())) return true;
          if (!o.cashierId && !o.shiftId && branchCashiers[0]?.id === user.id) {
            return o.isWalkIn || o.type === 'takeaway' || (!o.assignedRiderId && !o.assignedWaiterId);
          }
          return false;
        });
      } else if (roleCategory === 'rider') {
        matchedOrders = bPaidOrdersToday.filter((o) => {
          if (o.type !== 'delivery') return false;
          if (o.assignedRiderId === user.id) return true;
          if (user.name && o.assignedRiderName && o.assignedRiderName.toLowerCase().includes(user.name.toLowerCase())) return true;
          return false;
        });
      } else if (roleCategory === 'waiter') {
        matchedOrders = bPaidOrdersToday.filter((o) => {
          if (o.type !== 'dine_in') return false;
          if (o.assignedWaiterId === user.id) return true;
          if (user.name && o.assignedWaiterName && o.assignedWaiterName.toLowerCase().includes(user.name.toLowerCase())) return true;
          if (!o.assignedWaiterId && !o.assignedWaiterName && user.assignedTableNumbers && o.tableNumber && user.assignedTableNumbers.includes(String(o.tableNumber))) return true;
          return false;
        });
      }

      // Unique orders
      const uniqueOrders = Array.from(new Map(matchedOrders.map((o) => [o.id, o])).values());

      const rawCash = uniqueOrders.filter(isOrderCash).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      
      // For cashier: consider shift cashCollected if higher
      let effectiveCash = rawCash;
      if (roleCategory === 'cashier') {
        const userShifts = (shifts || []).filter((s) => s.cashierId === user.id);
        const shiftCashTotal = userShifts.reduce((sum, s) => sum + (Number(s.cashCollected) || 0), 0);
        effectiveCash = Math.max(rawCash, shiftCashTotal);
      }

      const digitalCollected = uniqueOrders.filter((o) => !isOrderCash(o)).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const totalCollected = effectiveCash + digitalCollected;

      return {
        user,
        roleCategory,
        orders: uniqueOrders,
        ordersCount: uniqueOrders.length,
        cashCollected: effectiveCash,
        digitalCollected,
        totalCollected,
      };
    };

    const cashiers = branchCashiers.map((u) => calculateForStaff(u, 'cashier'));
    const riders = branchRiders.map((u) => calculateForStaff(u, 'rider'));
    const waiters = branchWaiters.map((u) => calculateForStaff(u, 'waiter'));

    const allStaff = [...cashiers, ...riders, ...waiters];

    const grandTotal = allStaff.reduce((sum, s) => sum + s.totalCollected, 0);
    const grandCash = allStaff.reduce((sum, s) => sum + s.cashCollected, 0);
    const grandDigital = allStaff.reduce((sum, s) => sum + s.digitalCollected, 0);
    const grandOrders = allStaff.reduce((sum, s) => sum + s.ordersCount, 0);

    return {
      allStaff,
      cashiers,
      riders,
      waiters,
      grandTotal,
      grandCash,
      grandDigital,
      grandOrders,
    };
  }, [users, orders, currentBranch.id, normCurrentBranchId, shifts]);

  const displayedStaffList = useMemo(() => {
    if (collectionsStaffFilter === 'all') {
      return staffCollectionsData.allStaff;
    }
    if (collectionsStaffFilter === 'cashier') {
      return staffCollectionsData.cashiers;
    }
    if (collectionsStaffFilter === 'rider') {
      return staffCollectionsData.riders;
    }
    if (collectionsStaffFilter === 'waiter') {
      return staffCollectionsData.waiters;
    }
    if (collectionsStaffFilter.startsWith('user:')) {
      const uId = collectionsStaffFilter.replace('user:', '');
      return staffCollectionsData.allStaff.filter((s) => s.user.id === uId);
    }
    return staffCollectionsData.allStaff;
  }, [collectionsStaffFilter, staffCollectionsData]);

  // Branch Subordinates under this Manager (Cashier, Kitchen, Floor, Delivery)
  const subordinateRoles: Role[] = ['cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff'];
  const branchSubordinates = users.filter(
    (u) => (!u.branchId || u.branchId === currentBranch.id) && subordinateRoles.includes(u.role)
  );
  const activeStaffCount = branchSubordinates.filter((u) => u.status === 'active').length;
  const suspendedStaffCount = branchSubordinates.filter((u) => u.status === 'suspended').length;

  const isBranchOnline = currentBranch.isOpen ?? true;
  const isDeliveryEnabled = currentBranch.deliveryEnabled ?? true;

  const handleToggleStorefront = () => {
    toggleBranchStatus(currentBranch.id);
  };

  const handleToggleDelivery = () => {
    const nextDelivery = !isDeliveryEnabled;
    updateBranchSettings(currentBranch.id, { deliveryEnabled: nextDelivery });
    addToast({
      type: nextDelivery ? 'success' : 'warning',
      title: nextDelivery ? 'Doorstep Delivery Enabled 🛵' : 'Doorstep Delivery Paused ⏸️',
      message: `${currentBranch.name} is now ${nextDelivery ? 'accepting rider delivery orders' : 'only accepting Dine-In & Takeaway'}.`,
    });
  };

  const handleStepPrepTime = (delta: number) => {
    const nextPrep = Math.max(5, (currentBranch.prepTimeEstimateMin || 20) + delta);
    setPrepTimeEstimate(nextPrep);
    updateBranchSettings(currentBranch.id, { prepTimeEstimateMin: nextPrep });
    addToast({
      type: 'info',
      title: 'Prep Time Updated ⏱️',
      message: `Average preparation estimate set to ${nextPrep} minutes.`,
    });
  };

  const handleSaveTimingSettings = () => {
    updateBranchSettings(currentBranch.id, {
      fullEditWindowMin: fullEditWindow,
      prepTimeEstimateMin: prepTimeEstimate,
      stopAddOnsMinBeforeReady: stopAddonsTime,
      maxOrderDistanceKm: maxOrderDistance,
      tableQrMaxDistanceMeters: tableQrMaxDistance,
      minDeliveryAmount: Number(minDeliveryAmount) || 500,
      isBusy: isBusyMode,
    });
    setTimingConfirmOpen(false);
  };

  const handleToggleBusyMode = () => {
    const nextBusy = !isBusyMode;
    setIsBusyMode(nextBusy);
    updateBranchSettings(currentBranch.id, { isBusy: nextBusy });
    addToast({
      type: 'info',
      title: nextBusy ? 'Busy Mode Activated' : 'Busy Mode Turned Off',
      message: nextBusy
        ? 'Customer banner displayed: orders prep time extended by +15m.'
        : 'Normal operations restored.',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* 1. STOREFRONT OPERATIONAL CONTROL BAR (Online/Offline, Delivery, Prep Time, Rush Hour) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '18px 22px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: isBranchOnline ? 'rgba(22, 163, 74, 0.12)' : 'rgba(220, 38, 38, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isBranchOnline ? '#16A34A' : '#DC2626',
            }}
          >
            <Building size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Overview • {currentBranch.name}
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isBranchOnline ? '#DCFCE7' : '#FEE2E2',
                  color: isBranchOnline ? '#15803D' : '#B91C1C',
                }}
              >
                {isBranchOnline ? '🟢 ONLINE & OPEN' : '🔴 OFFLINE / CLOSED'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMapModalOpen(true)}
              title="Click to view and edit branch location & OpenStreetMap pin"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'none',
                border: '1px solid rgba(234, 88, 12, 0.25)',
                padding: '3px 8px',
                marginTop: '4px',
                borderRadius: '6px',
                backgroundColor: 'rgba(234, 88, 12, 0.08)',
                color: '#C2410C',
                fontSize: '12px',
                fontWeight: 650,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <MapPin size={13} color="#EA580C" />
              <span>{currentBranch.address} • {currentBranch.city} (Edit Location 📍)</span>
            </button>
          </div>
        </div>

        {/* Operational Quick Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Online/Offline Toggle */}
          <button
            onClick={handleToggleStorefront}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: `1.5px solid ${isBranchOnline ? '#16A34A' : '#DC2626'}`,
              backgroundColor: isBranchOnline ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)',
              color: isBranchOnline ? '#15803D' : '#DC2626',
              fontWeight: 800,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isBranchOnline ? <CheckCircle size={15} /> : <XCircle size={15} />}
            <span>{isBranchOnline ? 'Storefront: OPEN' : 'Storefront: CLOSED'}</span>
          </button>

          {/* Doorstep Delivery Toggle */}
          <button
            onClick={handleToggleDelivery}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: `1.5px solid ${isDeliveryEnabled ? '#2563EB' : 'var(--border-color)'}`,
              backgroundColor: isDeliveryEnabled ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card-subtle)',
              color: isDeliveryEnabled ? '#2563EB' : 'var(--text-muted)',
              fontWeight: 750,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Bike size={15} />
            <span>{isDeliveryEnabled ? 'Delivery: Active' : 'Delivery: Paused'}</span>
          </button>

          {/* Quick Prep Stepper */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'var(--bg-card-subtle)',
              padding: '4px 8px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              onClick={() => handleStepPrepTime(-5)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '14px',
                color: 'var(--text-main)',
                padding: '2px 6px',
              }}
            >
              -
            </button>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
              ⏱️ {currentBranch.prepTimeEstimateMin || 20}m
            </span>
            <button
              onClick={() => handleStepPrepTime(5)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 800,
                fontSize: '14px',
                color: 'var(--text-main)',
                padding: '2px 6px',
              }}
            >
              +
            </button>
          </div>

          {/* Rush Hour Toggle */}
          <button
            onClick={handleToggleBusyMode}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: `1.5px solid ${isBusyMode ? '#EA580C' : 'var(--border-color)'}`,
              backgroundColor: isBusyMode ? 'rgba(234, 88, 12, 0.1)' : 'var(--bg-card-subtle)',
              color: isBusyMode ? '#EA580C' : 'var(--text-muted)',
              fontWeight: 750,
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertTriangle size={15} />
            <span>{isBusyMode ? 'Rush Hour (+15m)' : 'Rush Mode'}</span>
          </button>
        </div>
      </div>

      {/* 2. DYNAMIC REAL-TIME CALCULATION GRID (6 Interactive Cards) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Total Orders Today (Clickable -> Opens Orders screen) */}
        <div
          onClick={() => onNavigate?.('staff-orders')}
          role="button"
          tabIndex={0}
          title="Click to view all Orders today"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.18s ease-in-out',
            position: 'relative',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.08)';
            e.currentTarget.style.borderColor = 'var(--primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Orders Today
            </span>
            <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}>
              View Orders →
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {totalOrdersToday}
          </div>
          <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 650 }}>
            Dine-In ({dineInTodayCount}) • Takeaway ({takeawayTodayCount}) • Delivery ({deliveryTodayCount})
          </span>
        </div>

        {/* Card 2: Cooking & In Progress */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cooking & In Progress</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#EA580C', marginTop: '4px' }}>
            {inProgressOrders.length}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Kitchen ({kitchenCount}) • Ready ({readyCount}) • In Transit ({transitCount})
          </span>
        </div>

        {/* Card 3: Paid Collections */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Paid Revenue Today</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
            Rs. {totalCollectionsToday.toLocaleString()}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {paidOrdersToday.length} Paid • Till: Rs. {totalCashCollected.toLocaleString()} • Digital: Rs. {digitalCollectionsToday.toLocaleString()}
          </span>
        </div>

        {/* Card 4: Unpaid Orders */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Unpaid Orders Pending</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: unpaidOrdersToday.length > 0 ? '#DC2626' : 'var(--text-main)', marginTop: '4px' }}>
            {unpaidOrdersToday.length} <span style={{ fontSize: '16px', fontWeight: 600 }}>({`Rs. ${unpaidTotalToday.toLocaleString()}`})</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Awaiting cashier settlement or COD delivery
          </span>
        </div>

        {/* Card 5: Table Occupancy / Occupied Tables */}
        <div
          onClick={() => setShowAvailableTablesModal(true)}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          title="Click to view all available tables"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Occupied Tables
            </span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#16A34A', backgroundColor: 'rgba(22, 163, 74, 0.12)', padding: '2px 8px', borderRadius: '12px' }}>
              {availableTables.length} Available
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#8B5CF6', marginTop: '4px' }}>
            {occupiedTableCount} <span style={{ fontSize: '18px', fontWeight: 650, color: 'var(--text-secondary)' }}>of {totalTableCount} Occupied ({tableOccupancyPercent}%)</span>
          </div>
          <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
            <span>🔍 Click to view available tables ({availableTables.length} Free) →</span>
          </span>
        </div>

        {/* Card 6: Delivery Fleet */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Delivery Fleet</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>
            {activeDeliveriesCount} Active
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {onlineRidersCount} of {totalRidersCount} riders online & available
          </span>
        </div>
      </div>

      {/* 3. MANAGER POWER ACTIONS QUICK NAVIGATION */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            ⚡ Branch Station Live Navigators
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Jump directly to any branch operational desk
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <button
            onClick={() => onNavigate?.('staff-kitchen')}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 750,
              fontSize: '13px',
              color: 'var(--text-main)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Utensils size={16} color="#EA580C" />
              <span>Kitchen Queue ({kitchenCount})</span>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </button>

          <button
            onClick={() => onNavigate?.('staff-cashier')}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 750,
              fontSize: '13px',
              color: 'var(--text-main)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Banknote size={16} color="#16A34A" />
              <span>Cashier Till & Desk</span>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </button>

          <button
            onClick={() => onNavigate?.('staff-floor')}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontWeight: 750,
              fontSize: '13px',
              color: 'var(--text-main)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} color="#8B5CF6" />
              <span>Floor Tables Map</span>
            </div>
            <ChevronRight size={14} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      {/* 4. STAFF COLLECTIONS TRACKER (CASHIER, RIDER, WAITER) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1.5px solid var(--border-color)',
          padding: '22px 24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Top Header Row with Title and Role Dropdown */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(22, 163, 74, 0.12)',
                color: '#16A34A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Banknote size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 900, color: 'var(--text-main)' }}>
                  Staff Collections & Reconciliation
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: '#DCFCE7',
                    color: '#15803D',
                    border: '1px solid #BBF7D0',
                  }}
                >
                  Live Today
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Total money collected by Cashier, Delivery Riders, and Waiters
              </div>
            </div>
          </div>

          {/* Right: Dropdown Selector for Cashier, Rider, Waiter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label
              htmlFor="staff-collections-role-dropdown"
              style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}
            >
              Filter Staff:
            </label>
            <select
              id="staff-collections-role-dropdown"
              value={collectionsStaffFilter}
              onChange={(e) => setCollectionsStaffFilter(e.target.value)}
              style={{
                padding: '9px 14px',
                borderRadius: '10px',
                border: '1.5px solid #2563EB',
                backgroundColor: '#EFF6FF',
                color: '#1E40AF',
                fontSize: '13px',
                fontWeight: 800,
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.15)',
              }}
            >
              <option value="all">👥 All Staff (Cashier, Rider, Waiter)</option>
              <optgroup label="Roles">
                <option value="cashier">💵 Cashier ({staffCollectionsData.cashiers.length})</option>
                <option value="rider">🛵 Rider ({staffCollectionsData.riders.length})</option>
                <option value="waiter">🍽️ Waiter ({staffCollectionsData.waiters.length})</option>
              </optgroup>
              {staffCollectionsData.cashiers.length > 0 && (
                <optgroup label="Cashiers">
                  {staffCollectionsData.cashiers.map((c) => (
                    <option key={c.user.id} value={`user:${c.user.id}`}>
                      💵 {c.user.name} (Cashier) • Rs. {c.totalCollected.toLocaleString()}
                    </option>
                  ))}
                </optgroup>
              )}
              {staffCollectionsData.riders.length > 0 && (
                <optgroup label="Riders">
                  {staffCollectionsData.riders.map((r) => (
                    <option key={r.user.id} value={`user:${r.user.id}`}>
                      🛵 {r.user.name} (Rider) • Rs. {r.totalCollected.toLocaleString()}
                    </option>
                  ))}
                </optgroup>
              )}
              {staffCollectionsData.waiters.length > 0 && (
                <optgroup label="Waiters">
                  {staffCollectionsData.waiters.map((w) => (
                    <option key={w.user.id} value={`user:${w.user.id}`}>
                      🍽️ {w.user.name} (Waiter) • Rs. {w.totalCollected.toLocaleString()}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Aggregate KPI Summary Banner */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
              Filtered Collections
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#16A34A', marginTop: '2px' }}>
              Rs. {displayedStaffList.reduce((sum, s) => sum + s.totalCollected, 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {displayedStaffList.reduce((sum, s) => sum + s.ordersCount, 0)} Total Orders Settled
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
              Cash In Hand
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#EA580C', marginTop: '2px' }}>
              Rs. {displayedStaffList.reduce((sum, s) => sum + s.cashCollected, 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Physical cash collected from customers
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
              Digital / Prepaid
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#2563EB', marginTop: '2px' }}>
              Rs. {displayedStaffList.reduce((sum, s) => sum + s.digitalCollected, 0).toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Online / Card / Wallet verified
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
              Staff on Duty
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)', marginTop: '2px' }}>
              {displayedStaffList.length} Staff
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {staffCollectionsData.cashiers.length} Cashier • {staffCollectionsData.riders.length} Rider • {staffCollectionsData.waiters.length} Waiter
            </div>
          </div>
        </div>

        {/* Staff Members List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
          {displayedStaffList.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-muted)',
                fontSize: '13px',
                fontWeight: 700,
              }}
            >
              No staff members found for the selected filter.
            </div>
          ) : (
            displayedStaffList.map((item) => {
              const isExpanded = expandedStaffId === item.user.id;
              const roleBadgeColor =
                item.roleCategory === 'cashier'
                  ? { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0', label: '💵 CASHIER' }
                  : item.roleCategory === 'rider'
                  ? { bg: '#FFEDD5', text: '#C2410C', border: '#FED7AA', label: '🛵 RIDER' }
                  : { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF', label: '🍽️ WAITER' };

              return (
                <div
                  key={item.user.id}
                  style={{
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '14px',
                      backgroundColor: 'var(--bg-card-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          backgroundColor: roleBadgeColor.bg,
                          color: roleBadgeColor.text,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: '16px',
                        }}
                      >
                        {item.roleCategory === 'cashier' ? '💵' : item.roleCategory === 'rider' ? '🛵' : '🍽️'}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '15px', fontWeight: 850, color: 'var(--text-main)' }}>
                            {item.user.name}
                          </span>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '8px',
                              backgroundColor: roleBadgeColor.bg,
                              color: roleBadgeColor.text,
                              border: `1px solid ${roleBadgeColor.border}`,
                            }}
                          >
                            {roleBadgeColor.label}
                          </span>
                          <span style={{ fontSize: '11px', color: item.user.status === 'active' ? '#16A34A' : '#94A3B8', fontWeight: 700 }}>
                            {item.user.status === 'active' ? '🟢 Active' : '⚪ Offline'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {item.user.phone || item.user.email} • {item.ordersCount} Orders Collected
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 }}>
                          TOTAL COLLECTED
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#16A34A' }}>
                          Rs. {item.totalCollected.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Cash: <strong style={{ color: '#EA580C' }}>Rs. {item.cashCollected.toLocaleString()}</strong> • Digital: <strong style={{ color: '#2563EB' }}>Rs. {item.digitalCollected.toLocaleString()}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedStaffId(isExpanded ? null : item.user.id)}
                        disabled={item.ordersCount === 0}
                        style={{
                          padding: '7px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: item.ordersCount > 0 ? '#FFFFFF' : 'var(--bg-input)',
                          color: item.ordersCount > 0 ? 'var(--text-main)' : 'var(--text-muted)',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: item.ordersCount > 0 ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span>{item.ordersCount} Orders</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Itemized Orders List */}
                  {isExpanded && item.orders.length > 0 && (
                    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        Itemized Collections for {item.user.name}:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {item.orders.map((ord) => {
                          const isCash = (ord.paymentMethod || '').toLowerCase().includes('cash') || (ord.paymentMethod || '').toLowerCase().includes('cod');
                          const orderTime = ord.completedAt || ord.deliveredAt || ord.createdAt;
                          const formattedTime = orderTime ? (orderTime.includes('T') ? orderTime.slice(11, 16) : orderTime) : '';

                          return (
                            <div
                              key={ord.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                backgroundColor: 'var(--bg-card-subtle)',
                                border: '1px solid var(--border-color)',
                                fontSize: '12.5px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontWeight: 850, color: 'var(--text-main)' }}>
                                  #{ord.orderNumber}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 750,
                                    padding: '2px 6px',
                                    borderRadius: '6px',
                                    backgroundColor: ord.type === 'delivery' ? '#FFF7ED' : ord.type === 'dine_in' ? '#EFF6FF' : '#F5F3FF',
                                    color: ord.type === 'delivery' ? '#EA580C' : ord.type === 'dine_in' ? '#2563EB' : '#7C3AED',
                                  }}
                                >
                                  {ord.type === 'delivery' ? '🛵 Delivery' : ord.type === 'dine_in' ? `🍽️ Table ${ord.tableNumber || '?'}` : '🛍️ Takeaway'}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>
                                  {ord.customerName} {formattedTime ? `• ${formattedTime}` : ''}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: isCash ? '#FEF3C7' : '#DCFCE7',
                                    color: isCash ? '#B45309' : '#15803D',
                                  }}
                                >
                                  {isCash ? '💵 Cash / COD' : `💳 ${ord.paymentMethod || 'Online'}`}
                                </span>
                                <strong style={{ color: 'var(--text-main)', fontSize: '13px' }}>
                                  Rs. {Number(ord.total).toLocaleString()}
                                </strong>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CASHIER ACCOUNT BALANCES (OPENING & CLOSING) + WEB HOME NOTIFICATION BANNER EDITOR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Card A: Cashier Opening & Closing Account Balances */}
        {(() => {
          const branchShiftsList = (shifts || []).filter(
            (s) => !s.branchId || normalizeBranchId(s.branchId) === normCurrentBranchId
          );
          const openShiftRow = branchShiftsList.find((s) => s.status === 'open') || currentShift || null;
          const closedShiftRow = branchShiftsList.find((s) => s.status === 'closed') || null;
          const liveExpected = openShiftRow
            ? Number(openShiftRow.openingFloat || 0) + Number(openShiftRow.cashCollected || 0)
            : 0;

          return (
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid #FDBA74',
                padding: '20px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Banknote size={18} color="#EA580C" />
                  <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                    Cashier Desk Account (Opening & Closing)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate?.('staff-cashier')}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#EA580C',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Open Cash Desk →
                </button>
              </div>

              {/* Active Open Shift */}
              <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803D', textTransform: 'uppercase' }}>
                  {openShiftRow ? `🟢 Active Open Account • ${openShiftRow.cashierName}` : 'No Active Shift Open Right Now'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#166534', fontWeight: 650 }}>Opening Balance:</span>
                  <strong style={{ color: '#14532D' }}>Rs. {Number(openShiftRow?.openingFloat || 0).toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '13px' }}>
                  <span style={{ color: '#166534', fontWeight: 650 }}>Current Amount in Account:</span>
                  <strong style={{ color: '#15803D' }}>Rs. {liveExpected.toLocaleString()}</strong>
                </div>
                {openShiftRow && (
                  <div style={{ marginTop: '8px' }}>
                    {editingShiftId === openShiftRow.id ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="number"
                          value={editOpeningVal}
                          onChange={(e) => setEditOpeningVal(e.target.value)}
                          placeholder="Opening Balance Rs."
                          style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #86EFAC', fontSize: '12.5px', fontWeight: 700, backgroundColor: '#FFFFFF' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateShiftOpeningBalance(openShiftRow.id, parseFloat(editOpeningVal) || 0);
                            setEditingShiftId(null);
                          }}
                          style={{ padding: '6px 10px', borderRadius: '6px', border: 'none', backgroundColor: '#16A34A', color: '#FFFFFF', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingShiftId(null)}
                          style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingShiftId(openShiftRow.id);
                          setEditOpeningVal(String(openShiftRow.openingFloat || 0));
                        }}
                        style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid #16A34A', backgroundColor: '#FFFFFF', color: '#15803D', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                      >
                        Edit Cashier Opening Balance
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Latest Closed Shift */}
              <div style={{ padding: '12px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  {closedShiftRow ? `🔴 After Closing Account • ${closedShiftRow.cashierName} (${closedShiftRow.closedAt || 'Closed'})` : 'No Closed Account Record Yet'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '13px' }}>
                  <span style={{ color: '#475569', fontWeight: 650 }}>Opened Balance:</span>
                  <strong style={{ color: '#0F172A' }}>Rs. {Number(closedShiftRow?.openingFloat || 0).toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '13px' }}>
                  <span style={{ color: '#475569', fontWeight: 650 }}>After Closing Counted Balance:</span>
                  <strong style={{ color: '#EA580C' }}>
                    {closedShiftRow
                      ? `Rs. ${Number(closedShiftRow.countedCash ?? closedShiftRow.expectedCash ?? 0).toLocaleString()}`
                      : '—'}
                  </strong>
                </div>
                {closedShiftRow && (
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: (Number(closedShiftRow.difference) || 0) === 0 ? '#16A34A' : '#DC2626' }}>
                      Diff: Rs. {(Number(closedShiftRow.difference) || 0) >= 0 ? '+' : ''}{(Number(closedShiftRow.difference) || 0).toLocaleString()}
                    </span>
                    {editingShiftId === closedShiftRow.id ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="number"
                          value={editOpeningVal}
                          onChange={(e) => setEditOpeningVal(e.target.value)}
                          style={{ width: '90px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px', fontWeight: 700 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            updateShiftOpeningBalance(closedShiftRow.id, parseFloat(editOpeningVal) || 0);
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
                          setEditingShiftId(closedShiftRow.id);
                          setEditOpeningVal(String(closedShiftRow.openingFloat || 0));
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
          );
        })()}

        {/* Card B: Web Home Notification Banner (Below Order Row) — Manager Editable */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #BFDBFE',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} color="#2563EB" />
              <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                Web Home Notification (Below Order Row)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setHomeNotifEnabled((v) => !v)}
              style={{
                padding: '4px 10px',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: homeNotifEnabled ? '#DCFCE7' : '#FEE2E2',
                color: homeNotifEnabled ? '#15803D' : '#DC2626',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {homeNotifEnabled ? 'VISIBLE ON HOME' : 'HIDDEN'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Badge Label</label>
              <input
                type="text"
                value={homeNotifBadge}
                onChange={(e) => setHomeNotifBadge(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '12.5px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Notice Style</label>
              <select
                value={homeNotifType}
                onChange={(e) => setHomeNotifType(e.target.value as any)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '12.5px' }}
              >
                <option value="promo">Orange Promo</option>
                <option value="info">Blue Info</option>
                <option value="success">Green Success</option>
                <option value="warning">Amber Alert</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Notification Headline</label>
            <input
              type="text"
              value={homeNotifTitle}
              onChange={(e) => setHomeNotifTitle(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '12.5px' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>Supporting Message</label>
            <textarea
              rows={2}
              value={homeNotifMessage}
              onChange={(e) => setHomeNotifMessage(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '12.5px', resize: 'vertical' }}
            />
          </div>

          <button
            type="button"
            onClick={() =>
              updateFooterSettings({
                homeNotificationEnabled: homeNotifEnabled,
                homeNotificationBadge: homeNotifBadge,
                homeNotificationTitle: homeNotifTitle,
                homeNotificationMessage: homeNotifMessage,
                homeNotificationType: homeNotifType,
              })
            }
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Save Web Home Notification
          </button>
        </div>
      </div>

      {/* BUSY MODE & TIMING SETTINGS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Timing Settings Form */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
              Order-Timing & Two-Stage Rules Settings
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Stage 1: Full-Edit Window After Placement (Minutes)
              </label>
              <input
                type="number"
                value={fullEditWindow}
                onChange={(e) => setFullEditWindow(parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '14px', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Standard Kitchen Preparation Time (Minutes)
              </label>
              <input
                type="number"
                value={prepTimeEstimate}
                onChange={(e) => setPrepTimeEstimate(parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '14px', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Stage 2 Cutoff: Stop Add-ons Before Ready Time (Minutes)
              </label>
              <input
                type="number"
                value={stopAddonsTime}
                onChange={(e) => setStopAddonsTime(parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '14px', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 750, display: 'block', marginBottom: '4px', color: 'var(--text-main)' }}>
                Max Order Acceptance Distance (km)
              </label>
              <input
                type="number"
                value={maxOrderDistance}
                onChange={(e) => setMaxOrderDistance(parseFloat(e.target.value) || 0)}
                placeholder="e.g. 50"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '14px', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 750, display: 'block', marginBottom: '4px', color: 'var(--text-main)' }}>
                Table QR Max Ordering Distance (Meters)
              </label>
              <input
                type="number"
                value={tableQrMaxDistance}
                onChange={(e) => setTableQrMaxDistance(parseInt(e.target.value) || 0)}
                placeholder="e.g. 300"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '14px', color: 'var(--text-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 750, display: 'block', marginBottom: '4px', color: 'var(--text-main)' }}>
                Minimum Delivery Order Amount (Rs.)
              </label>
              <input
                type="number"
                value={minDeliveryAmount}
                onChange={(e) => setMinDeliveryAmount(parseInt(e.target.value) || 0)}
                placeholder="e.g. 500"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '14px', color: 'var(--text-main)' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Customers cannot checkout for delivery if cart item value is less than this amount.
              </span>
            </div>

            <button
              onClick={() => setTimingConfirmOpen(true)}
              style={{
                marginTop: '8px',
                padding: '11px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
              }}
            >
              Confirm Action
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Timing Settings (PRD Section F16) */}
      <ModalConfirmation
        isOpen={timingConfirmOpen}
        onClose={() => setTimingConfirmOpen(false)}
        onConfirm={handleSaveTimingSettings}
        title="Update Branch Timing & Distance Settings?"
        message="Changes to operational cutoffs and distance radii directly affect kitchen workflow and customer ordering permissions."
        details={`Full Edit Window: ${fullEditWindow}m · Prep Estimate: ${prepTimeEstimate}m · Add-ons Cutoff: ${stopAddonsTime}m · Max Allowed Distance: ${maxOrderDistance}km · Table QR Radius: ${tableQrMaxDistance}m`}
        confirmText="Yes, save settings"
        cancelText="No, go back"
      />

      {/* Available Tables Modal Dialog */}
      {showAvailableTablesModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 12, 10, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowAvailableTablesModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Utensils size={18} color="#16A34A" />
                  <span>Available Tables ({availableTables.length} Free)</span>
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {currentBranch.name} • {occupiedTableCount} of {totalTableCount} tables currently occupied
                </span>
              </div>
              <button
                onClick={() => setShowAvailableTablesModal(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: '20px',
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              {availableTables.length === 0 ? (
                <div style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '36px', marginBottom: '8px' }}>🚫</div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>
                    All Tables Currently Occupied
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                    Every table across {currentBranch.name} is currently occupied by active dining guests.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                  {availableTables.map((tbl) => (
                    <div
                      key={tbl.id || tbl.number}
                      onClick={() => {
                        setShowAvailableTablesModal(false);
                        onNavigate?.('staff-floor');
                      }}
                      style={{
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: '12px',
                        border: '1.5px solid #16A34A',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-main)' }}>
                          {tbl.number}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#DCFCE7', color: '#15803D' }}>
                          FREE
                        </span>
                      </div>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {tbl.floor || 'Dining Hall'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 650 }}>
                        👥 {tbl.capacity || tbl.chairs || 4} Seats
                      </span>
                      {tbl.pin && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          PIN: {tbl.pin}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-card-subtle)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowAvailableTablesModal(false);
                  onNavigate?.('staff-floor');
                }}
                style={{
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Open Floor Layout Map</span>
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setShowAvailableTablesModal(false)}
                style={{
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  padding: '8px 18px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Location & OpenStreetMap Editor Modal */}
      <StoreMapModal
        isOpen={mapModalOpen}
        onClose={() => setMapModalOpen(false)}
        startInEditMode={true}
        initialEditingBranchId={currentBranch.id}
      />

    </div>
  );
};

