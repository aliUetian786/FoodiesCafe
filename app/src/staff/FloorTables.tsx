'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Table, TableStatus, normalizeBranchId } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import { HistoricalLoadingModal } from '@/components/common/HistoricalLoadingModal';
import {
  LayoutGrid,
  Users,
  CheckCircle,
  Clock,
  Sparkles,
  AlertOctagon,
  Calendar,
  Bell,
  RefreshCw,
  Search,
  Utensils,
  Award,
  TrendingUp,
  History,
  UserCheck,
  ShieldCheck,
  DollarSign,
  Plus,
  Banknote,
  CreditCard,
  ShoppingBag,
  Key,
  ChevronLeft,
  ChevronRight,
  X,
  ChefHat,
} from 'lucide-react';
import { WalkInOrderModal } from '@/staff/WalkInOrderModal';

const formatDateYYYYMMDD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

interface FloorTablesScreenProps {
  initialView?: 'tables' | 'server_orders';
}

export const FloorTablesScreen: React.FC<FloorTablesScreenProps> = ({ initialView = 'tables' }) => {
  const {
    tables,
    currentBranchId,
    currentBranch,
    updateTableStatus,
    updateTable,
    generateTableQr,
    updateOrderStatus,
    markOrderDeliveredToTable,
    markOrderDoneAndCollected,
    orders,
    addToast,
    currentRole,
    tableSessions,
    users,
    currentUser,
    fetchOlderOrders,
    isFetchingOlderOrders,
    filterOrdersToToday,
    addTable,
    deleteTable,
  } = useApp();

  const isManager = currentRole === 'branch_manager';
  const isFloorStaff = currentRole === 'floor_staff';

  const [viewMode, setViewMode] = useState<'tables' | 'server_orders'>(initialView);
  const [activeTab, setActiveTab] = useState<'grid' | 'reservations'>('grid');
  const [selectedFloor, setSelectedFloor] = useState<string>('All Floors');
  const [tableScope, setTableScope] = useState<'assigned' | 'all'>('all');
  const [managerTab, setManagerTab] = useState<'sessions' | 'waiters' | 'layout'>('sessions');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionDateFilter, setSessionDateFilter] = useState<'today' | 'all'>('today');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [confirmFreeTableId, setConfirmFreeTableId] = useState<string | null>(null);
  const [showFloorAddTable, setShowFloorAddTable] = useState(false);
  const [newFloorTableNum, setNewFloorTableNum] = useState('');
  const [newFloorTableCap, setNewFloorTableCap] = useState(4);
  const [newFloorTableFloor, setNewFloorTableFloor] = useState('Ground Floor');
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [walkInTableDefault, setWalkInTableDefault] = useState<string | undefined>(undefined);

  // Waiter Money Records & Server Orders Filter State
  const todayStr = useMemo(() => formatDateYYYYMMDD(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    return formatDateYYYYMMDD(yest);
  }, []);
  const [dateScope, setDateScope] = useState<'today' | 'yesterday' | 'week' | 'date' | 'all'>('today');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false);
  const [queueScope, setQueueScope] = useState<'station' | 'all'>('all');
  const [stageFilter, setStageFilter] = useState<'all' | 'ready' | 'cooking' | 'served'>('all');

  // On-demand database loading when querying older days
  useEffect(() => {
    if (viewMode === 'server_orders') {
      if (dateScope === 'today') {
        filterOrdersToToday();
      } else {
        fetchOlderOrders(
          currentBranch.id,
          dateScope === 'date' ? undefined : dateScope,
          dateScope === 'date' ? selectedDate : undefined,
          dateScope === 'date' ? selectedDate : undefined
        );
      }
    }
  }, [viewMode, dateScope, selectedDate, currentBranch.id]);

  const normCurrentBranchId = normalizeBranchId(currentBranchId);
  const branchTables = useMemo(
    () => tables.filter((t) => !t.branchId || t.branchId === currentBranchId || normalizeBranchId(t.branchId) === normCurrentBranchId),
    [tables, currentBranchId, normCurrentBranchId]
  );
  const myAssignedTableNums = useMemo(() => currentUser?.assignedTableNumbers || [], [currentUser?.assignedTableNumbers]);
  
  // Tables assigned to this floor staff member (via assignedTableNumbers, assignedWaiterId, or assignedWaiterName)
  const myAssignedTables = useMemo(() => {
    return branchTables.filter(
      (t) =>
        (myAssignedTableNums.length > 0 && myAssignedTableNums.includes(t.number)) ||
        (currentUser?.id && t.assignedWaiterId === currentUser.id) ||
        (currentUser?.name && t.assignedWaiterName === currentUser.name)
    );
  }, [branchTables, myAssignedTableNums, currentUser?.id, currentUser?.name]);

  const hasAssignedStation = myAssignedTables.length > 0;

  // Available Waiters / Floor Staff for table assignment
  const availableWaiters = useMemo(() => {
    const bId = normalizeBranchId(currentBranchId);
    const list = (users || []).filter((u) => {
      const isRole = u.role === 'floor_staff' || (u.role as string) === 'waiter';
      if (!isRole) return false;
      if (!bId || bId === 'all') return true;
      return !u.branchId || normalizeBranchId(u.branchId) === bId;
    });
    if (list.length === 0) {
      return (users || []).filter((u) => u.role === 'floor_staff' || (u.role as string) === 'waiter');
    }
    return list;
  }, [users, currentBranchId]);

  const displayedBranchTables = useMemo(() => {
    let list = branchTables;
    if (selectedFloor !== 'All Floors') {
      list = list.filter((t) => (t.floor || 'Ground Floor') === selectedFloor);
    }
    if (isFloorStaff && tableScope === 'assigned') {
      return list.filter(
        (t) =>
          (myAssignedTableNums.length > 0 && myAssignedTableNums.includes(t.number)) ||
          (currentUser?.id && t.assignedWaiterId === currentUser.id) ||
          (currentUser?.name && t.assignedWaiterName === currentUser.name)
      );
    }
    return list;
  }, [branchTables, selectedFloor, isFloorStaff, tableScope, myAssignedTableNums, currentUser?.id, currentUser?.name]);

  const branchDineInOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.type === 'dine_in' &&
          (!o.branchId || o.branchId === currentBranchId || normalizeBranchId(o.branchId) === normCurrentBranchId)
      ),
    [orders, currentBranchId, normCurrentBranchId]
  );

  const dineInOrders = useMemo(
    () =>
      branchDineInOrders.filter(
        (o) =>
          o.status !== 'completed' &&
          o.status !== 'cancelled' &&
          o.paymentStatus !== 'paid' &&
          !o.paymentCollected
      ),
    [branchDineInOrders]
  );

  const servedDineInOrders = useMemo(
    () =>
      branchDineInOrders.filter(
        (o) =>
          o.paymentStatus === 'paid' ||
          Boolean(o.paymentCollected) ||
          o.status === 'completed'
      ),
    [branchDineInOrders]
  );

  const getOrderDateStr = (o: any): string => {
    const ts = o.completedAt || o.deliveredAt || o.createdAt;
    if (!ts) return todayStr;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return todayStr;
    return formatDateYYYYMMDD(d);
  };

  const filteredServedOrders = useMemo(() => {
    const now = new Date();
    const weekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    return servedDineInOrders.filter((o) => {
      const orderDateStr = getOrderDateStr(o);
      const parsedTime = new Date(o.completedAt || o.deliveredAt || o.createdAt).getTime();
      const orderTimeMs = isNaN(parsedTime) ? now.getTime() : parsedTime;
      if (dateScope === 'today') return orderDateStr === todayStr;
      if (dateScope === 'yesterday') return orderDateStr === yesterdayStr;
      if (dateScope === 'date') return orderDateStr === selectedDate;
      if (dateScope === 'week') return orderTimeMs >= weekAgoMs;
      return true;
    });
  }, [servedDineInOrders, dateScope, selectedDate, todayStr, yesterdayStr]);

  const totalOrdersCount = filteredServedOrders.length;
  const totalCashCollected = useMemo(
    () =>
      filteredServedOrders
        .filter((o) => (o.paymentStatus === 'paid' || Boolean(o.paymentCollected)) && ((o.paymentMethod || '').includes('Cash') || (o.paymentMethod || '').includes('COD') || !o.paymentMethod))
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    [filteredServedOrders]
  );
  const totalOnlinePaid = useMemo(
    () =>
      filteredServedOrders
        .filter((o) => (o.paymentStatus === 'paid' || Boolean(o.paymentCollected)) && !(o.paymentMethod || '').includes('Cash') && !(o.paymentMethod || '').includes('COD'))
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    [filteredServedOrders]
  );
  const totalSettledValue = useMemo(
    () =>
      filteredServedOrders
        .filter((o) => o.paymentStatus === 'paid' || Boolean(o.paymentCollected))
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    [filteredServedOrders]
  );

  const recentDays = useMemo(() => {
    const days: { dateStr: string; label: string; weekday: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = formatDateYYYYMMDD(d);
      let label = `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
      if (i === 0) label = 'Today';
      else if (i === 1) label = 'Yesterday';
      days.push({
        dateStr: str,
        label,
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }
    return days;
  }, []);

  const activeScopeLabel = useMemo(() => {
    if (dateScope === 'today') return `Today (${formatDisplayDate(todayStr)})`;
    if (dateScope === 'yesterday') return `Yesterday (${formatDisplayDate(yesterdayStr)})`;
    if (dateScope === 'date') return `${formatDisplayDate(selectedDate)}`;
    if (dateScope === 'week') return 'Past 7 Days';
    return 'All Time History';
  }, [dateScope, selectedDate, todayStr, yesterdayStr]);

  const handleStepDay = (delta: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() + delta);
    if (curr > new Date()) {
      addToast({ type: 'warning', title: 'Future Date', message: 'Cannot select future dates.' });
      return;
    }
    const nextStr = formatDateYYYYMMDD(curr);
    setSelectedDate(nextStr);
    setDateScope('date');
  };

  const stationActiveOrders = useMemo(() => {
    if (!hasAssignedStation) return dineInOrders;
    return dineInOrders.filter(
      (o) =>
        (o.tableNumber && myAssignedTableNums.includes(o.tableNumber)) ||
        (currentUser?.id && o.assignedWaiterId === currentUser.id) ||
        (currentUser?.name && o.assignedWaiterName === currentUser.name) ||
        myAssignedTables.some((t) => String(t.number) === String(o.tableNumber))
    );
  }, [dineInOrders, hasAssignedStation, myAssignedTableNums, currentUser?.id, currentUser?.name, myAssignedTables]);

  const baseServerOrders = queueScope === 'station' ? stationActiveOrders : dineInOrders;
  const readyCount = useMemo(() => baseServerOrders.filter((o) => o.status === 'ready').length, [baseServerOrders]);
  const cookingCount = useMemo(
    () => baseServerOrders.filter((o) => o.status === 'preparing' || o.status === 'accepted' || o.status === 'placed').length,
    [baseServerOrders]
  );
  const servedCount = useMemo(() => baseServerOrders.filter((o) => o.status === 'served').length, [baseServerOrders]);

  const displayedServerOrders = useMemo(() => {
    return baseServerOrders.filter((o) => {
      if (stageFilter === 'ready') return o.status === 'ready';
      if (stageFilter === 'cooking') return o.status === 'preparing' || o.status === 'accepted' || o.status === 'placed';
      if (stageFilter === 'served') return o.status === 'served';
      return true;
    });
  }, [baseServerOrders, stageFilter]);

  const activeOrderForSelectedTable = useMemo(() => {
    if (!selectedTable) return null;
    return dineInOrders.find(
      (o) =>
        String(o.tableNumber) === String(selectedTable.number) ||
        String(o.tableNumber) === String(selectedTable.id)
    );
  }, [dineInOrders, selectedTable]);
  const branchSessions = (tableSessions || []).filter((s) => !s.branchId || s.branchId === currentBranchId);

  const isDateToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const sessionsToday = branchSessions.filter((s) => isDateToday(s.startedAt) || s.status === 'occupied');
  const activeTablesCount = branchTables.filter((t) => t.status === 'occupied').length;
  const completedTodaySessions = sessionsToday.filter((s) => s.status === 'completed' && s.durationMin && s.durationMin > 0);
  const avgDurationMin = completedTodaySessions.length > 0
    ? Math.round(completedTodaySessions.reduce((sum, s) => sum + (s.durationMin || 0), 0) / completedTodaySessions.length)
    : 42;
  const todayDineInRevenue = sessionsToday.reduce((sum, s) => sum + (Number(s.totalAmount) || 0), 0);

  const filteredSessions = branchSessions.filter((s) => {
    if (sessionDateFilter === 'today' && !isDateToday(s.startedAt) && s.status !== 'occupied') return false;
    if (sessionSearch.trim()) {
      const q = sessionSearch.toLowerCase();
      const matchTbl = s.tableNumber?.toLowerCase().includes(q);
      const matchWaiter = s.waiterName?.toLowerCase().includes(q);
      const matchGuest = s.customerName?.toLowerCase().includes(q);
      const matchOrd = s.orderNumber?.toLowerCase().includes(q);
      if (!matchTbl && !matchWaiter && !matchGuest && !matchOrd) return false;
    }
    return true;
  });

  const getStatusStyle = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return { bg: 'var(--table-available-bg)', text: 'var(--table-available-text)' };
      case 'reserved':
        return { bg: 'var(--table-reserved-bg)', text: 'var(--table-reserved-text)' };
      case 'occupied':
        return { bg: 'var(--table-occupied-bg)', text: 'var(--table-occupied-text)' };
      case 'cleaning':
        return { bg: 'var(--table-cleaning-bg)', text: 'var(--table-cleaning-text)' };
      default:
        return { bg: 'var(--table-unavailable-bg)', text: 'var(--table-unavailable-text)' };
    }
  };

  const handleMarkFreeConfirmed = () => {
    if (!confirmFreeTableId) return;
    updateTableStatus(confirmFreeTableId, 'available');
    setConfirmFreeTableId(null);
    setSelectedTable(null);
  };

  if (isManager) {
    // 1. Gather floor staff: registered branch floor staff users + fallback
    const registeredFloorUsers = users.filter(
      (u) => u.role === 'floor_staff' && (!u.branchId || u.branchId === currentBranch.id)
    );

    const floorStaffList = [
      ...registeredFloorUsers.map((u) => ({
        id: u.id,
        name: u.name,
        role: 'Floor Staff & Waiter',
        baseOrders: 0,
        baseSales: 0,
      })),
    ];

    if (floorStaffList.length === 0) {
      floorStaffList.push(
        { id: 'user-floor', name: 'Bilal Raza', role: 'Floor Captain & Waiter', baseOrders: 6, baseSales: 11450 },
        { id: 'w2', name: 'Usman Qureshi', role: 'Senior Floor Waiter', baseOrders: 4, baseSales: 7800 }
      );
    }

    const waiterStats = floorStaffList.map((w) => {
      // Find dine-in orders attributed to this waiter
      const waiterOrders = branchDineInOrders.filter((o) => {
        const matchId = o.assignedWaiterId === w.id;
        const matchName = Boolean(
          o.assignedWaiterName &&
          w.name &&
          o.assignedWaiterName.toLowerCase().includes(w.name.toLowerCase())
        );
        return matchId || matchName;
      });

      // Orders served today
      const servedOrdersToday = waiterOrders.filter(
        (o) =>
          isDateToday(o.deliveredAt || o.completedAt || o.createdAt) &&
          (o.status === 'served' || o.status === 'completed' || o.paymentCollected || o.paymentStatus === 'paid')
      );

      // Orders where payment was collected / received
      const paidOrdersToday = waiterOrders.filter(
        (o) =>
          (o.paymentCollected === true || o.paymentStatus === 'paid') &&
          isDateToday(o.completedAt || o.deliveredAt || o.createdAt)
      );

      const dynamicSales = paidOrdersToday.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const cashReceived = paidOrdersToday
        .filter((o) => !o.paymentMethod || o.paymentMethod.toLowerCase().includes('cash') || o.paymentMethod.toLowerCase().includes('cod'))
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const digitalReceived = Math.max(0, dynamicSales - cashReceived);

      const liveSessions = branchSessions.filter((s) => s.waiterName === w.name);
      const activeTblsFromSessions = liveSessions.filter((s) => s.status === 'occupied').map((s) => s.tableNumber);
      const activeTblsFromTables = branchTables
        .filter(
          (t) =>
            t.status === 'occupied' &&
            (t.assignedWaiterId === w.id || (w.name && t.assignedWaiterName?.toLowerCase().includes(w.name.toLowerCase())))
        )
        .map((t) => t.number);
      const activeTbls = Array.from(new Set([...activeTblsFromSessions, ...activeTblsFromTables]));

      const todayCount = servedOrdersToday.length + (w.baseOrders || 0);
      const todaySales = dynamicSales + (w.baseSales || 0);

      return {
        ...w,
        totalOrdersServed: todayCount,
        activeTables: activeTbls,
        totalSales: todaySales,
        cashReceived,
        digitalReceived,
        paidOrdersCount: paidOrdersToday.length,
      };
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Header Title: Waiter & Floor */}
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Waiter & Floor
          </h1>
        </div>

        {/* 1. FIRST DISPLAY THIS: 4 TOP KPI CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>TABLES OCCUPIED TODAY</span>
              <Users size={16} color="var(--primary)" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)', marginTop: '6px' }}>
              {sessionsToday.length} Sessions
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Distinct table seatings today
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>CURRENTLY OCCUPIED</span>
              <Clock size={16} color="#EA580C" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#EA580C', marginTop: '6px' }}>
              {activeTablesCount} of {branchTables.length} Tables
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {Math.round((activeTablesCount / (branchTables.length || 1)) * 100)}% active dining room occupancy
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>AVG SEATING DURATION</span>
              <TrendingUp size={16} color="#16A34A" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#16A34A', marginTop: '6px' }}>
              {avgDurationMin} Mins
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Average table turnover duration today
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '18px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>DINE-IN REVENUE TODAY</span>
              <DollarSign size={16} color="#2563EB" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#2563EB', marginTop: '6px' }}>
              Rs. {todayDineInRevenue.toLocaleString()}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Total bill from today's table sessions
            </div>
          </div>
        </div>

        {/* 2. BELOW THAT DISPLAY THIS: Manager Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            gap: '4px',
            width: 'fit-content',
            maxWidth: '100%',
            overflowX: 'auto',
          }}
        >
          <button
            onClick={() => setManagerTab('sessions')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 750,
              backgroundColor: managerTab === 'sessions' ? 'var(--primary)' : 'transparent',
              color: managerTab === 'sessions' ? '#FFFFFF' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <History size={15} />
            <span>Table Occupancy Log ({branchSessions.length})</span>
          </button>
          <button
            onClick={() => setManagerTab('waiters')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 750,
              backgroundColor: managerTab === 'waiters' ? 'var(--primary)' : 'transparent',
              color: managerTab === 'waiters' ? '#FFFFFF' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <Award size={15} />
            <span>Waiter Performance & Orders</span>
          </button>
          <button
            onClick={() => setManagerTab('layout')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 750,
              backgroundColor: managerTab === 'layout' ? 'var(--primary)' : 'transparent',
              color: managerTab === 'layout' ? '#FFFFFF' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <LayoutGrid size={15} />
            <span>Live Room Layout ({branchTables.length})</span>
          </button>
        </div>

        {/* TAB 1: TABLE SESSIONS & OCCUPANCY HISTORY (START TO END DATE & TIME) */}
        {managerTab === 'sessions' && (
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
            {/* Filter Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                  Table Occupancy & Seating History (Start to End)
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Detailed historical timestamp records of every physical table occupied
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card-subtle)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
                  <button
                    onClick={() => setSessionDateFilter('today')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: sessionDateFilter === 'today' ? 'var(--bg-card)' : 'transparent',
                      color: sessionDateFilter === 'today' ? 'var(--primary)' : 'var(--text-secondary)',
                      boxShadow: sessionDateFilter === 'today' ? 'var(--shadow-sm)' : 'none',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Today Only ({sessionsToday.length})
                  </button>
                  <button
                    onClick={() => setSessionDateFilter('all')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '5px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: sessionDateFilter === 'all' ? 'var(--bg-card)' : 'transparent',
                      color: sessionDateFilter === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
                      boxShadow: sessionDateFilter === 'all' ? 'var(--shadow-sm)' : 'none',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    All History ({branchSessions.length})
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-card-subtle)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input
                    type="text"
                    placeholder="Search table, waiter, guest..."
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12.5px', color: 'var(--text-main)', width: '180px' }}
                  />
                </div>
              </div>
            </div>

            {/* Table Log */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 12px' }}>Table # & Floor</th>
                    <th style={{ padding: '10px 12px' }}>Customer / Guest</th>
                    <th style={{ padding: '10px 12px' }}>Seated At (Start Time)</th>
                    <th style={{ padding: '10px 12px' }}>Departed At (End Time)</th>
                    <th style={{ padding: '10px 12px' }}>Duration</th>
                    <th style={{ padding: '10px 12px' }}>Assigned Waiter</th>
                    <th style={{ padding: '10px 12px' }}>Order #</th>
                    <th style={{ padding: '10px 12px' }}>Total Bill</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No table sessions match your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((sess) => (
                      <tr key={sess.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 850, color: 'var(--text-main)', fontSize: '14px' }}>
                            Table {sess.tableNumber}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {sess.floor || 'Ground Floor'}
                          </div>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 700 }}>
                          {sess.customerName || 'Walk-in Guests'}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-main)' }}>
                          <div style={{ fontWeight: 750 }}>{sess.startedAt}</div>
                        </td>
                        <td style={{ padding: '12px', color: sess.status === 'occupied' ? '#EA580C' : 'var(--text-secondary)' }}>
                          {sess.status === 'occupied' ? (
                            <span style={{ fontWeight: 800 }}>🟢 Currently Seated</span>
                          ) : (
                            <span style={{ fontWeight: 700 }}>{sess.endedAt || '—'}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 750 }}>
                          {sess.status === 'occupied' ? (
                            <span style={{ color: '#EA580C' }}>In progress</span>
                          ) : (
                            <span>{sess.durationMin ? `${sess.durationMin} mins` : '—'}</span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{sess.waiterName}</span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 750, color: 'var(--text-secondary)' }}>
                          {sess.orderNumber ? `#${sess.orderNumber}` : '—'}
                        </td>
                        <td style={{ padding: '12px', fontWeight: 850, color: 'var(--text-main)' }}>
                          Rs. {Number(sess.totalAmount).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: sess.status === 'occupied' ? 'rgba(234, 88, 12, 0.12)' : '#DCFCE7',
                              color: sess.status === 'occupied' ? '#EA580C' : '#15803D',
                              textTransform: 'uppercase',
                            }}
                          >
                            {sess.status === 'occupied' ? 'Occupied Now' : 'Completed'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: WAITER PERFORMANCE & TOTAL ORDERS */}
        {managerTab === 'waiters' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Waiter KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {waiterStats.map((w) => (
                <div
                  key={w.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    padding: '20px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--primary-glow)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--primary)',
                          fontWeight: 900,
                          fontSize: '16px',
                        }}
                      >
                        {w.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 850, fontSize: '16px', color: 'var(--text-main)' }}>{w.name}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{w.role}</div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      ACTIVE ON FLOOR
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: 'var(--bg-card-subtle)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ORDERS TODAY</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--primary)', marginTop: '2px' }}>
                        {w.totalOrdersServed}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>ACTIVE TABLES</div>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: '#EA580C', marginTop: '2px' }}>
                        {w.activeTables.length > 0 ? w.activeTables.join(', ') : 'None'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>PAYMENT RECEIVED</div>
                      <div style={{ fontSize: '16px', fontWeight: 900, color: '#16A34A', marginTop: '2px' }}>
                        Rs. {w.totalSales.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {w.paidOrdersCount || 0} Paid Orders
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Service Rating: <strong>4.9 / 5.0 ⭐</strong></span>
                    <span>100% On-time Table Delivery</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Orders Waiting for Waiter Service (Read-Only) */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={18} color="var(--primary)" />
                  <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                    Active Dine-in Orders in Service Pipeline ({dineInOrders.length})
                  </h3>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Manager Observation Mode (Waiters deliver food to tables)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                {dineInOrders.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '24px', gridColumn: '1 / -1' }}>
                    No active dine-in orders pending delivery.
                  </div>
                ) : (
                  dineInOrders.map((ord) => (
                    <div
                      key={ord.id}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 850, fontSize: '15px' }}>
                          Table {ord.tableNumber || '?'} · #{ord.orderNumber}
                        </span>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: ord.status === 'served' ? '#8B5CF6' : ord.status === 'ready' ? '#16A34A' : 'var(--status-preparing-bg)',
                            color: '#FFFFFF',
                            textTransform: 'uppercase',
                          }}
                        >
                          {ord.status.toUpperCase()}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {ord.customerName} · Total: Rs. {ord.total.toLocaleString()}
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Items: {ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE ROOM LAYOUT (OBSERVATION MODE) */}
        {managerTab === 'layout' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
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
                  Physical Dining Room Layout ({branchTables.length} Tables)
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Tap table to inspect details (Observation Mode)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
                {branchTables.map((tbl) => {
                  const style = getStatusStyle(tbl.status);
                  const isSelected = selectedTable?.id === tbl.id;

                  return (
                    <div
                      key={tbl.id}
                      onClick={() => setSelectedTable(tbl)}
                      style={{
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        padding: '16px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        boxShadow: isSelected ? '0 4px 14px var(--primary-glow)' : 'none',
                        transition: 'transform 0.15s ease',
                        transform: isSelected ? 'scale(1.03)' : 'none',
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-main)' }}>
                        {tbl.number}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {tbl.capacity} Guests
                      </div>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: style.bg,
                          color: style.text,
                        }}
                      >
                        {tbl.status}
                      </span>

                      {tbl.status === 'occupied' && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {tbl.seatedAt || 'Active'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedTable && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '18px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>
                      Selected: Table {selectedTable.number} ({selectedTable.status.toUpperCase()})
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>
                      Capacity: {selectedTable.capacity} Guests
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Floor: <strong>{selectedTable.floor || 'Ground Floor'}</strong> · Seated Since: <strong>{selectedTable.seatedAt || 'N/A'}</strong>
                  </div>

                  <div style={{ backgroundColor: '#FEF3C7', padding: '10px 14px', borderRadius: '6px', fontSize: '12px', color: '#92400E', border: '1px solid #FCD34D' }}>
                    🔒 <strong>Manager Notice:</strong> Physical table seating & status transitions are executed by Floor Captains & Waiters.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'server_orders') {
    return (
      <div
        style={{
          height: 'calc(100vh - 85px)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          backgroundColor: 'var(--bg-main)',
        }}
      >
        {/* Top Control Bar */}
        <div
          style={{
            flexShrink: 0,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 16px',
            boxShadow: 'var(--shadow-sm)',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            minHeight: '52px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <Bell size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '16px', fontWeight: 850, margin: 0, color: 'var(--text-main)', lineHeight: 1 }}>
                  Order
                </h1>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    padding: '2px 8px',
                    borderRadius: '10px',
                  }}
                >
                  {displayedServerOrders.length} Pending
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => {
                setWalkInTableDefault(undefined);
                setWalkInModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 750,
                fontSize: '12.5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px var(--primary-glow)',
                lineHeight: 1,
              }}
            >
              <Plus size={14} strokeWidth={2.4} color="#FFFFFF" />
              <span>+ Walk-in Order</span>
            </button>
            <button
              onClick={() => setViewMode('tables')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
                fontWeight: 750,
                fontSize: '12.5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                lineHeight: 1,
              }}
            >
              <LayoutGrid size={14} color="var(--primary)" />
              <span>Floor Tables Grid</span>
            </button>
          </div>
        </div>

        {/* Orders Content Area - Fully Scrollable */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: '16px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* WAITER MONEY RECORDS SECTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'yesterday', label: 'Yesterday' },
                  { id: 'week', label: 'Past 7 Days' },
                  { id: 'date', label: 'Pick Date 📅' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map((sc) => {
                const isActive = dateScope === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => {
                      if (sc.id === 'date') {
                        setIsDatePickerModalOpen(true);
                      } else {
                        setDateScope(sc.id);
                        if (sc.id === 'today') setSelectedDate(todayStr);
                        if (sc.id === 'yesterday') setSelectedDate(yesterdayStr);
                      }
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '10px',
                      backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-card-subtle)',
                      border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 750,
                      cursor: 'pointer',
                    }}
                  >
                    {sc.id === 'date' && dateScope === 'date' ? formatDisplayDate(selectedDate) : sc.label}
                  </button>
                );
              })}

              <div
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '11.5px',
                }}
              >
                <span style={{ fontWeight: 800, color: 'var(--text-muted)' }}>RECORD PERIOD:</span>
                <span style={{ fontWeight: 850, color: 'var(--primary)' }}>{activeScopeLabel}</span>
              </div>
            </div>

            <HistoricalLoadingModal visible={isFetchingOlderOrders} />

            {/* 4 Metric KPI Cards for Waiter Money Records */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
              <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: '14px', padding: '14px', border: '1.5px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CheckCircle size={15} color="#0284C7" />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Orders Served</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)' }}>{totalOrdersCount}</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: '14px', padding: '14px', border: '1.5px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Banknote size={15} color="#D97706" />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Cash in Hand (Table Cash)</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#D97706' }}>Rs. {totalCashCollected.toLocaleString()}</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: '14px', padding: '14px', border: '1.5px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={15} color="#16A34A" />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Prepaid / Online</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#16A34A' }}>Rs. {totalOnlinePaid.toLocaleString()}</div>
              </div>

              <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: '14px', padding: '14px', border: '1.5px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign size={15} color="var(--primary)" />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Total Settled Value</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)' }}>Rs. {totalSettledValue.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* INCOMING ACTIVE DINE-IN ORDERS QUEUE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '3px 9px', borderRadius: '8px' }}>
                {displayedServerOrders.length} Pending
              </span>
            </div>

            {/* Stage Filter Row */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setStageFilter('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  backgroundColor: stageFilter === 'all' ? 'var(--primary)' : 'var(--bg-card-subtle)',
                  border: stageFilter === 'all' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  color: stageFilter === 'all' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: 750,
                  cursor: 'pointer',
                }}
              >
                All Active ({baseServerOrders.length})
              </button>
              <button
                onClick={() => setStageFilter('ready')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  backgroundColor: stageFilter === 'ready' ? '#DCFCE7' : 'var(--bg-card-subtle)',
                  border: stageFilter === 'ready' ? '1px solid #16A34A' : '1px solid var(--border-color)',
                  color: stageFilter === 'ready' ? '#15803D' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: stageFilter === 'ready' ? 850 : 750,
                  cursor: 'pointer',
                }}
              >
                🔥 Hot Food Ready ({readyCount})
              </button>
              <button
                onClick={() => setStageFilter('cooking')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  backgroundColor: stageFilter === 'cooking' ? '#FEF3C7' : 'var(--bg-card-subtle)',
                  border: stageFilter === 'cooking' ? '1px solid #D97706' : '1px solid var(--border-color)',
                  color: stageFilter === 'cooking' ? '#B45309' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: stageFilter === 'cooking' ? 850 : 750,
                  cursor: 'pointer',
                }}
              >
                🍳 Cooking ({cookingCount})
              </button>
              <button
                onClick={() => setStageFilter('served')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  backgroundColor: stageFilter === 'served' ? '#EDE9FE' : 'var(--bg-card-subtle)',
                  border: stageFilter === 'served' ? '1px solid #7C3AED' : '1px solid var(--border-color)',
                  color: stageFilter === 'served' ? '#6D28D9' : 'var(--text-secondary)',
                  fontSize: '11.5px',
                  fontWeight: stageFilter === 'served' ? 850 : 750,
                  cursor: 'pointer',
                }}
              >
                🍽️ Seated & Dining ({servedCount})
              </button>
            </div>
          </div>

          {displayedServerOrders.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 20px',
                textAlign: 'center',
                gap: '10px',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
              }}
            >
              <ChefHat size={38} color="var(--text-muted)" />
              <div style={{ fontSize: '16px', fontWeight: 850, color: 'var(--text-main)' }}>
                No Orders Pending Delivery
              </div>
              <div style={{ fontSize: '13px', maxWidth: '420px', lineHeight: 1.4 }}>
                {queueScope === 'station' && hasAssignedStation
                  ? `No active cooking or ready orders for your assigned station (${myAssignedTableNums.join(', ')}). Switch to "All Dine-In Orders" to inspect cafe-wide orders.`
                  : 'Hot food ready from kitchen line will appear here for serving to seated guests.'}
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                gap: '16px',
              }}
            >
              {displayedServerOrders.map((ord) => {
                const isKitchenReady = ord.status === 'ready';
                const isFoodServed = ord.status === 'served';
                const isAssignedToMe =
                  (ord.tableNumber && myAssignedTableNums.includes(ord.tableNumber)) ||
                  ord.assignedWaiterId === currentUser?.id;

                return (
                  <div
                    key={ord.id}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: isKitchenReady ? '#FAFAF9' : isFoodServed ? '#FAF5FF' : 'var(--bg-card-subtle)',
                      border: isKitchenReady
                        ? '2px solid #16A34A'
                        : isFoodServed
                        ? '2px solid #8B5CF6'
                        : '1.5px solid var(--border-color)',
                      borderLeft: isAssignedToMe ? '4px solid var(--primary)' : undefined,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            backgroundColor: 'var(--primary)',
                            color: '#FFFFFF',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            fontWeight: 850,
                            fontSize: '13px',
                          }}
                        >
                          <Utensils size={13} />
                          <span>Table {ord.tableNumber || 'Seated'}</span>
                        </span>
                        {isAssignedToMe && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              backgroundColor: 'var(--primary-light)',
                              color: 'var(--primary)',
                              padding: '3px 7px',
                              borderRadius: '6px',
                            }}
                          >
                            ★ Your Station
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 850,
                          backgroundColor: isKitchenReady ? '#DCFCE7' : isFoodServed ? '#EDE9FE' : '#FEF3C7',
                          color: isKitchenReady ? '#15803D' : isFoodServed ? '#6D28D9' : '#B45309',
                          padding: '4px 9px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {isKitchenReady ? 'HOT FOOD READY' : isFoodServed ? 'SEATED & DINING' : 'COOKING IN KITCHEN'}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 900, fontSize: '15px', color: 'var(--text-main)' }}>
                        Order #{ord.orderNumber}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Guest: {ord.customerName} • {ord.paymentMethod} •{' '}
                        <strong style={{ color: ord.paymentStatus === 'paid' ? '#16A34A' : '#D97706' }}>
                          {ord.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                        </strong>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-main)',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '8px',
                        padding: '10px',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {ord.items.map((i, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>• {i.quantity}x {i.name} {i.size ? `(${i.size})` : ''}</span>
                          <span>Rs. {(i.unitPrice * i.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                      {ord.notes && (
                        <div style={{ fontSize: '11px', color: '#D97706', fontStyle: 'italic', marginTop: '4px' }}>
                          Note: {ord.notes}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: '8px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--primary)' }}>
                          Rs. {Number(ord.total).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 700 }}>
                          {ord.paymentMethod}
                        </div>
                      </div>

                      {isKitchenReady ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => markOrderDeliveredToTable(ord.id)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#0284C7',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <CheckCircle size={14} />
                            <span>Deliver 🍽️</span>
                          </button>
                          <button
                            onClick={() => markOrderDoneAndCollected(ord.id, true)}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '8px',
                              backgroundColor: '#16A34A',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                            }}
                          >
                            <CheckCircle size={14} />
                            <span>Payment Received ✓</span>
                          </button>
                        </div>
                      ) : isFoodServed ? (
                        <button
                          onClick={() => markOrderDoneAndCollected(ord.id, true)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#16A34A',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <CheckCircle size={14} />
                          <span>Payment Received & Free Table ✓</span>
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', fontWeight: 750, color: '#D97706' }}>
                            <Clock size={13} />
                            <span>Cooking</span>
                          </span>
                          <button
                            onClick={() => markOrderDoneAndCollected(ord.id, true)}
                            style={{
                              padding: '7px 11px',
                              borderRadius: '8px',
                              backgroundColor: '#16A34A',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle size={13} />
                            <span>Done & Collected ✓</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Date Picker Modal */}
        {isDatePickerModalOpen && (
          <div
            onClick={() => setIsDatePickerModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: '20px',
                padding: '20px',
                width: '100%',
                maxWidth: '420px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-xl)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 850 }}>Pick Record Date</h3>
                </div>
                <button
                  onClick={() => setIsDatePickerModalOpen(false)}
                  style={{ border: 'none', background: 'var(--bg-card-subtle)', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <button
                  onClick={() => handleStepDay(-1)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-subtle)', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >
                  <ChevronLeft size={15} />
                  <span>Prev Day</span>
                </button>
                <span style={{ fontWeight: 850, fontSize: '13px' }}>{formatDisplayDate(selectedDate)}</span>
                <button
                  onClick={() => handleStepDay(1)}
                  disabled={selectedDate === todayStr}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-subtle)', fontWeight: 700, fontSize: '12px', cursor: selectedDate === todayStr ? 'not-allowed' : 'pointer', opacity: selectedDate === todayStr ? 0.4 : 1 }}
                >
                  <span>Next Day</span>
                  <ChevronRight size={15} />
                </button>
              </div>

              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Recent Days Quick Pick:
              </div>
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px' }}>
                {recentDays.map((d) => {
                  const isSel = selectedDate === d.dateStr;
                  return (
                    <button
                      key={d.dateStr}
                      onClick={() => {
                        setSelectedDate(d.dateStr);
                        if (d.dateStr === todayStr) setDateScope('today');
                        else if (d.dateStr === yesterdayStr) setDateScope('yesterday');
                        else setDateScope('date');
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '10px',
                        backgroundColor: isSel ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                        border: isSel ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        minWidth: '58px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '9px', fontWeight: 700, color: isSel ? 'var(--primary)' : 'var(--text-muted)', textTransform: 'uppercase' }}>{d.weekday}</div>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: isSel ? 'var(--primary)' : 'var(--text-main)' }}>{d.label}</div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setDateScope('date');
                  setIsDatePickerModalOpen(false);
                }}
                style={{
                  width: '100%',
                  marginTop: '14px',
                  padding: '11px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Apply & View Records ({formatDisplayDate(selectedDate)})
              </button>
            </div>
          </div>
        )}

        {/* Walk-in Order Modal */}
        {walkInModalOpen && (
          <WalkInOrderModal
            initialTableNumber={walkInTableDefault}
            isFloorStaff={true}
            onClose={() => {
              setWalkInModalOpen(false);
              setWalkInTableDefault(undefined);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        height: 'calc(100vh - 85px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        backgroundColor: 'var(--bg-main)',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flex: 1,
          minHeight: 0,
          boxSizing: 'border-box',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Floor Staff
          </h3>
          <button
            onClick={() => {
              setWalkInTableDefault(undefined);
              setWalkInModalOpen(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 750,
              fontSize: '12.5px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px var(--primary-glow)',
              lineHeight: 1,
              boxSizing: 'border-box',
            }}
          >
            <Plus size={14} strokeWidth={2.4} color="#FFFFFF" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 750, color: '#FFFFFF', letterSpacing: '0.01em', lineHeight: 1 }}>Walk-in Order</span>
          </button>
        </div>

        {/* Table Chart Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '14px' }}>
              {displayedBranchTables.map((tbl) => {
                const style = getStatusStyle(tbl.status);
                const isSelected = selectedTable?.id === tbl.id;
                const isAssignedToMe =
                  myAssignedTableNums.includes(tbl.number) ||
                  (currentUser?.id && tbl.assignedWaiterId === currentUser.id) ||
                  (currentUser?.name && tbl.assignedWaiterName === currentUser.name);

                return (
                  <div
                    key={tbl.id}
                    onClick={() => setSelectedTable(tbl)}
                    style={{
                      backgroundColor: 'var(--bg-card-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--primary)' : isAssignedToMe ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                      padding: '16px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 4px 14px var(--primary-glow)' : 'none',
                      transition: 'transform 0.15s ease',
                      transform: isSelected ? 'scale(1.03)' : 'none',
                      position: 'relative',
                    }}
                  >
                    {isAssignedToMe ? (
                      <div
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 800,
                          color: '#15803D',
                          backgroundColor: '#DCFCE7',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        ★ Assigned to You
                      </div>
                    ) : tbl.assignedWaiterName ? (
                      <div
                        style={{
                          fontSize: '9.5px',
                          fontWeight: 700,
                          color: '#2563EB',
                          backgroundColor: '#EFF6FF',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        👤 {tbl.assignedWaiterName.split(' ')[0]}
                      </div>
                    ) : null}

                    <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-main)' }}>
                      {tbl.number}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {tbl.capacity} Guests
                    </div>
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: style.bg,
                        color: style.text,
                      }}
                    >
                      {tbl.status}
                    </span>

                    {tbl.status === 'occupied' && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {tbl.seatedAt || 'Active'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

      {/* Unified Table Detail & Quick Actions Modal on Table Click */}
      {selectedTable && (
        <div
          onClick={() => setSelectedTable(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '22px',
              border: '1.5px solid var(--border-color)',
              padding: '20px',
              boxShadow: '0 20px 48px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              width: '100%',
              maxWidth: '540px',
              maxHeight: '90vh',
              overflowY: 'auto',
              animation: 'scaleUp 0.15s ease',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>
                  Table {selectedTable.number}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedTable.floor || 'Ground Floor'} • {selectedTable.capacity} Chairs • {selectedTable.status.toUpperCase()}
                </div>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 850,
                  padding: 0,
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Waiter Station Info + Assignment */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '12px 14px',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 650 }}>
                    Assigned Floor Staff / Waiter:
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: selectedTable.assignedWaiterName ? '#15803D' : 'var(--text-main)', marginTop: '2px' }}>
                    {selectedTable.assignedWaiterName ? `👤 ${selectedTable.assignedWaiterName}` : 'Unassigned'}
                  </div>
                </div>

                {isFloorStaff && selectedTable.assignedWaiterId !== currentUser?.id && (
                  <button
                    onClick={() => {
                      if (!currentUser) return;
                      updateTable(selectedTable.id, {
                        assignedWaiterId: currentUser.id,
                        assignedWaiterName: currentUser.name,
                      });
                      setSelectedTable((prev) =>
                        prev
                          ? {
                              ...prev,
                              assignedWaiterId: currentUser.id,
                              assignedWaiterName: currentUser.name,
                            }
                          : null
                      );
                      addToast({
                        type: 'success',
                        title: 'Table Claimed ✓',
                        message: `Table ${selectedTable.number} assigned to ${currentUser.name}.`,
                      });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <UserCheck size={13} />
                    <span>Claim Table</span>
                  </button>
                )}
              </div>

              {/* Waiter selector dropdown for Cashier, Manager, Floor Staff */}
              <div>
                <select
                  value={selectedTable.assignedWaiterId || ''}
                  onChange={(e) => {
                    const targetId = e.target.value;
                    if (!targetId) {
                      updateTable(selectedTable.id, {
                        assignedWaiterId: '',
                        assignedWaiterName: '',
                      });
                      setSelectedTable((prev) =>
                        prev ? { ...prev, assignedWaiterId: undefined, assignedWaiterName: undefined } : null
                      );
                      addToast({
                        type: 'info',
                        title: 'Table Unassigned',
                        message: `Table #${selectedTable.number} is now unassigned.`,
                      });
                    } else {
                      const targetW = availableWaiters.find((w) => w.id === targetId) || users.find((u) => u.id === targetId);
                      const wName = targetW ? targetW.name : targetId;
                      updateTable(selectedTable.id, {
                        assignedWaiterId: targetId,
                        assignedWaiterName: wName,
                      });
                      setSelectedTable((prev) =>
                        prev ? { ...prev, assignedWaiterId: targetId, assignedWaiterName: wName } : null
                      );
                      addToast({
                        type: 'success',
                        title: 'Staff Assigned ✓',
                        message: `Table #${selectedTable.number} assigned to ${wName}.`,
                      });
                    }
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: selectedTable.assignedWaiterId ? '1.5px solid #2563EB' : '1px solid var(--border-color)',
                    backgroundColor: selectedTable.assignedWaiterId ? '#EFF6FF' : 'var(--bg-input)',
                    color: selectedTable.assignedWaiterId ? '#1E40AF' : 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: 700,
                    width: '100%',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="">-- Assign Service Waiter --</option>
                  {availableWaiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({(w.role as string) === 'waiter' ? 'Waiter' : 'Floor Staff'})
                    </option>
                  ))}
                  {selectedTable.assignedWaiterId && !availableWaiters.some((w) => w.id === selectedTable.assignedWaiterId) && (
                    <option value={selectedTable.assignedWaiterId}>
                      {selectedTable.assignedWaiterName || selectedTable.assignedWaiterId}
                    </option>
                  )}
                  {!selectedTable.assignedWaiterId && selectedTable.assignedWaiterName && (
                    <option value={selectedTable.assignedWaiterName}>{selectedTable.assignedWaiterName}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Active 4-Digit QR PIN Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary)',
                borderRadius: '12px',
                padding: '10px 14px',
                gap: '10px',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 650 }}>
                  Active Table 4-Digit QR PIN:
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--primary)', letterSpacing: '2px', marginTop: '2px' }}>
                  {selectedTable.pin || 'Not Set'}
                </div>
              </div>
              <button
                onClick={async () => {
                  const pin = Math.floor(1000 + Math.random() * 9000).toString();
                  updateTable(selectedTable.id, { pin });
                  setSelectedTable((prev) => (prev ? { ...prev, pin } : null));
                  generateTableQr(selectedTable.id, 120).catch(() => {});
                  addToast({
                    type: 'success',
                    title: 'Table PIN Generated 🔑',
                    message: `Table ${selectedTable.number} QR PIN is now ${pin}.`,
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '7px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={13} />
                <span>Generate PIN</span>
              </button>
            </div>

            {/* Active Dine-In Order Box (if table has an active order) */}
            {activeOrderForSelectedTable && (
              <div
                style={{
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: '14px',
                  padding: '14px',
                  border: '1.5px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-main)' }}>
                      Order #{activeOrderForSelectedTable.orderNumber}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      Guest: {activeOrderForSelectedTable.customerName} • {activeOrderForSelectedTable.paymentMethod}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 850,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor:
                        activeOrderForSelectedTable.status === 'ready'
                          ? '#DCFCE7'
                          : activeOrderForSelectedTable.status === 'served'
                          ? '#EDE9FE'
                          : '#FEF3C7',
                      color:
                        activeOrderForSelectedTable.status === 'ready'
                          ? '#15803D'
                          : activeOrderForSelectedTable.status === 'served'
                          ? '#6D28D9'
                          : '#B45309',
                    }}
                  >
                    {activeOrderForSelectedTable.status === 'ready'
                      ? 'FOOD READY'
                      : activeOrderForSelectedTable.status === 'served'
                      ? 'GUESTS DINING'
                      : 'COOKING'}
                  </span>
                </div>

                <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '8px', padding: '8px 10px', border: '1px solid var(--border-color)', fontSize: '12px' }}>
                  {activeOrderForSelectedTable.items.map((it, idx) => (
                    <div key={idx} style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      • {it.quantity}x {it.name}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--primary)' }}>
                    Total: Rs. {Number(activeOrderForSelectedTable.total).toLocaleString()}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 850,
                      color: activeOrderForSelectedTable.paymentStatus === 'paid' ? '#16A34A' : '#D97706',
                    }}
                  >
                    {activeOrderForSelectedTable.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {activeOrderForSelectedTable.status === 'ready' && (
                    <button
                      onClick={() => markOrderDeliveredToTable(activeOrderForSelectedTable.id)}
                      style={{
                        flex: 1,
                        padding: '9px 12px',
                        borderRadius: '10px',
                        backgroundColor: '#0284C7',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <CheckCircle size={14} />
                      <span>Deliver Food 🍽️</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      markOrderDoneAndCollected(activeOrderForSelectedTable.id, true);
                      setSelectedTable(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '9px 12px',
                      borderRadius: '10px',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <CheckCircle size={14} />
                    <span>Done & Collected (Free Table) ✓</span>
                  </button>
                </div>
              </div>
            )}

            {/* Status Change Buttons */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                Change Table Status:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    updateTableStatus(selectedTable.id, 'available');
                    setSelectedTable(null);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--table-available-bg)',
                    color: 'var(--table-available-text)',
                    border: '1.5px solid #16A34A',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <span>🟢</span>
                  <span>Mark Free</span>
                </button>

                <button
                  onClick={() => {
                    updateTableStatus(selectedTable.id, 'occupied');
                    setSelectedTable(null);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--table-occupied-bg)',
                    color: 'var(--table-occupied-text)',
                    border: '1.5px solid #EA580C',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <span>🔴</span>
                  <span>Seated</span>
                </button>

                <button
                  onClick={() => {
                    updateTableStatus(selectedTable.id, 'cleaning');
                    setSelectedTable(null);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--table-cleaning-bg)',
                    color: 'var(--table-cleaning-text)',
                    border: '1.5px solid #CA8A04',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <span>🧹</span>
                  <span>Cleaning</span>
                </button>

                <button
                  onClick={() => {
                    updateTableStatus(selectedTable.id, 'reserved');
                    setSelectedTable(null);
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--table-reserved-bg)',
                    color: 'var(--table-reserved-text)',
                    border: '1.5px solid #9333EA',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <span>🟣</span>
                  <span>Reserved</span>
                </button>
              </div>
            </div>

            {/* Bottom Actions: Walk-in Order & Go to Waiter Orders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => {
                  setWalkInTableDefault(selectedTable.number);
                  setWalkInModalOpen(true);
                  setSelectedTable(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '11px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px var(--primary-glow)',
                }}
              >
                <Utensils size={15} />
                <span>+ New Walk-in Order (Table {selectedTable.number})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to delete Table #${selectedTable.number}? This will permanently remove it from the floor plan.`)) {
                    deleteTable(selectedTable.id);
                    setSelectedTable(null);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#DC2626',
                  border: '1px solid #EF4444',
                  fontSize: '12px',
                  fontWeight: 750,
                  cursor: 'pointer',
                }}
              >
                <span>🗑️</span>
                <span>Delete Table #{selectedTable.number}</span>
              </button>

              <button
                onClick={() => {
                  setSelectedTable(null);
                  setViewMode('server_orders');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--primary)',
                  border: '1px solid var(--border-color)',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <LayoutGrid size={14} />
                <span>Go to Waiter Orders Queue</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal before Marking Table Free (PRD Section F16) */}
      <ModalConfirmation
        isOpen={!!confirmFreeTableId}
        onClose={() => setConfirmFreeTableId(null)}
        onConfirm={handleMarkFreeConfirmed}
        title="Mark Table Free?"
        message="Confirm that the table has been cleaned, sanitized, and is ready for new dine-in guests."
        confirmText="Yes, mark table free"
        cancelText="No, go back"
      />

      {/* Walk-in Order Modal */}
      {walkInModalOpen && (
        <WalkInOrderModal
          initialTableNumber={walkInTableDefault}
          isFloorStaff={true}
          onClose={() => {
            setWalkInModalOpen(false);
            setWalkInTableDefault(undefined);
          }}
        />
      )}
    </div>
  );
};
