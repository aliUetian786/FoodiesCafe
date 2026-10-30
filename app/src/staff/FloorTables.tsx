'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Table, TableStatus } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
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
} from 'lucide-react';
import { WalkInOrderModal } from '@/staff/WalkInOrderModal';

interface FloorTablesScreenProps {
  initialView?: 'tables' | 'server_orders';
}

export const FloorTablesScreen: React.FC<FloorTablesScreenProps> = ({ initialView = 'tables' }) => {
  const {
    tables,
    currentBranchId,
    currentBranch,
    updateTableStatus,
    updateOrderStatus,
    orders,
    addToast,
    currentRole,
    tableSessions,
    users,
  } = useApp();

  const isManager = currentRole === 'branch_manager';

  const [viewMode, setViewMode] = useState<'tables' | 'server_orders'>(initialView);
  const [activeTab, setActiveTab] = useState<'grid' | 'reservations'>('grid');
  const [managerTab, setManagerTab] = useState<'sessions' | 'waiters' | 'layout'>('sessions');
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionDateFilter, setSessionDateFilter] = useState<'today' | 'all'>('today');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [confirmFreeTableId, setConfirmFreeTableId] = useState<string | null>(null);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [walkInTableDefault, setWalkInTableDefault] = useState<string | undefined>(undefined);

  const branchTables = useMemo(() => tables.filter((t) => t.branchId === currentBranchId), [tables, currentBranchId]);
  const dineInOrders = useMemo(() => orders.filter((o) => o.type === 'dine_in' && o.status !== 'completed' && o.status !== 'cancelled'), [orders]);
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
    const waiterStats = [
      { id: 'w1', name: 'Bilal Raza', role: 'Floor Captain & Waiter', baseOrders: 6, baseSales: 11450 },
      { id: 'w2', name: 'Usman Qureshi', role: 'Senior Floor Waiter', baseOrders: 4, baseSales: 7800 },
    ].map((w) => {
      const liveSessions = branchSessions.filter((s) => s.waiterName === w.name);
      const activeTbls = liveSessions.filter((s) => s.status === 'occupied').map((s) => s.tableNumber);
      const todayCount = liveSessions.filter((s) => isDateToday(s.startedAt)).length + w.baseOrders;
      const todaySales = liveSessions.reduce((acc, s) => acc + (Number(s.totalAmount) || 0), 0) + w.baseSales;
      return {
        ...w,
        totalOrdersServed: todayCount,
        activeTables: activeTbls,
        totalSales: todaySales,
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
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>SALES BILLED</div>
                      <div style={{ fontSize: '16px', fontWeight: 900, color: '#16A34A', marginTop: '2px' }}>
                        Rs. {w.totalSales.toLocaleString()}
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
                  Orders for Server / Waiter
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
                  {dineInOrders.length} Pending
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                Active dine-in food trays and beverage orders awaiting table dispatch
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              <span>Walk-in Order</span>
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
          }}
        >
          {dineInOrders.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
                gap: '12px',
                color: 'var(--text-muted)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <Bell size={26} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 850, color: 'var(--text-main)' }}>
                No Pending Server Orders
              </div>
              <div style={{ fontSize: '13px', maxWidth: '360px', lineHeight: 1.4 }}>
                All dine-in tables are served. New orders sent from kitchen or cashier will appear here immediately.
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px',
              }}
            >
              {dineInOrders.map((ord) => {
                const isReadyOrServed = ord.status === 'served' || ord.status === 'ready';

                return (
                  <div
                    key={ord.id}
                    style={{
                      padding: '18px',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: isReadyOrServed ? 'rgba(139, 92, 246, 0.06)' : 'var(--bg-card-subtle)',
                      border: isReadyOrServed ? '2px solid #8B5CF6' : '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 850, fontSize: '17px', color: 'var(--text-main)' }}>
                        Table {ord.tableNumber || '?'}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: ord.status === 'served' ? '#8B5CF6' : ord.status === 'ready' ? '#16A34A' : 'var(--status-preparing-bg)',
                          color: '#FFFFFF',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {ord.status === 'served' ? 'KITCHEN READY (SERVE)' : ord.status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Order #{ord.orderNumber} ({ord.items.length} items) · Total: Rs. {ord.total.toLocaleString()}
                    </div>

                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        borderTop: '1px dashed var(--border-color)',
                        paddingTop: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      {ord.items.map((i, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span><strong>{i.quantity}x</strong> {i.name}</span>
                          <span>Rs. {(i.unitPrice * i.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {ord.notes && (
                      <div style={{ fontSize: '12px', color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '6px 10px', borderRadius: '6px' }}>
                        Note: {ord.notes}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        updateOrderStatus(ord.id, 'completed', undefined, {
                          type: 'success',
                          title: 'Order Served to Table ✓',
                          message: `Order #${ord.orderNumber} served to Table ${ord.tableNumber || 'counter'}.`,
                        });
                      }}
                      style={{
                        marginTop: '4px',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isReadyOrServed ? '#16A34A' : 'var(--bg-card)',
                        color: isReadyOrServed ? '#FFFFFF' : 'var(--text-main)',
                        border: isReadyOrServed ? 'none' : '1px solid var(--border-color)',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: isReadyOrServed ? '0 2px 8px rgba(22, 163, 74, 0.3)' : 'none',
                      }}
                    >
                      <CheckCircle size={16} />
                      <span>Mark Delivered & Served ✓</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
      {/* ========================================================================= */}
      {/* STATIC TOP CONTROL BAR: FLOOR STAFF + WALK-IN ORDER + TABS (MATCHES ORDER HUB) */}
      {/* ========================================================================= */}
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
        {/* Left Side: Floor Staff Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 style={{ fontSize: '15px', fontWeight: 850, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.01em', lineHeight: 1 }}>
            Floor Staff
          </h1>
        </div>

        {/* Right Side: Tab Switch + Walk-in Order Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {/* Tab switch: Live Table Grid vs Reservations List (v1.1) */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-card-subtle)',
              padding: '2px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              gap: '2px',
              alignItems: 'center',
              boxSizing: 'border-box',
            }}
          >
            <button
              onClick={() => setActiveTab('grid')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: activeTab === 'grid' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'grid' ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                border: 'none',
                lineHeight: 1,
                transition: 'all 0.15s ease',
              }}
            >
              Live Table Grid
            </button>
            <button
              onClick={() => setActiveTab('reservations')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: activeTab === 'reservations' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'reservations' ? '#FFFFFF' : 'var(--text-secondary)',
                cursor: 'pointer',
                border: 'none',
                lineHeight: 1,
                transition: 'all 0.15s ease',
              }}
            >
              Reservations List (v1.1)
            </button>
          </div>

          {/* Walk-in Order Button */}
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
      </div>

      {activeTab === 'grid' ? (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
              Dining Room Layout ({branchTables.length} Tables)
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tap table to open quick actions</span>
          </div>

          {/* Table Chart Grid */}
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
          </div>
      ) : (
        /* RESERVATIONS LIST TAB (v1.1 PRD Requirement) */
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
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
            Time-Slot Table Bookings
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { id: 'res-1', guest: 'Mrs. Fatima Malik', table: 'T-02', time: '8:30 PM Tonight', party: '4 Guests', status: 'confirmed' },
              { id: 'res-2', guest: 'Dr. Arshad Beg', table: 'T-06', time: '9:00 PM Tonight', party: '8 Guests', status: 'requested' },
            ].map((res) => (
              <div
                key={res.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '15px' }}>{res.guest}</div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Table {res.table} · {res.time} · {res.party}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: 'var(--table-reserved-bg)',
                      color: 'var(--table-reserved-text)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {res.status}
                  </span>
                  <button
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Seat Guests
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WhatsApp Reactions-Style Pop-up Screen on Table Click */}
      {selectedTable && (
        <div
          onClick={() => setSelectedTable(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.36)',
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
              borderRadius: '28px',
              border: '1.5px solid var(--border-color)',
              padding: '12px 18px',
              boxShadow: '0 20px 48px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              maxWidth: '94vw',
              animation: 'scaleUp 0.15s ease',
            }}
          >
            {/* Table Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                fontSize: '13.5px',
                fontWeight: 850,
                color: 'var(--text-main)',
              }}
            >
              <span>Table {selectedTable.number}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 650 }}>
                ({selectedTable.capacity}p · {selectedTable.status.toUpperCase()})
              </span>
            </div>

            {/* Simple Row of Action Options (Like WhatsApp Reactions) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Option 1: Mark Table Free */}
              <button
                onClick={() => {
                  updateTableStatus(selectedTable.id, 'available');
                  setSelectedTable(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--table-available-bg)',
                  color: 'var(--table-available-text)',
                  border: '1.5px solid #16A34A',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
                title="Mark Free / Available"
              >
                <span>🟢</span>
                <span>Mark Free</span>
              </button>

              {/* Option 2: Mark Seated */}
              <button
                onClick={() => {
                  updateTableStatus(selectedTable.id, 'occupied');
                  setSelectedTable(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--table-occupied-bg)',
                  color: 'var(--table-occupied-text)',
                  border: '1.5px solid #EA580C',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
                title="Mark Seated / Occupied"
              >
                <span>🔴</span>
                <span>Seated</span>
              </button>

              {/* Option 3: Mark Cleaning */}
              <button
                onClick={() => {
                  updateTableStatus(selectedTable.id, 'cleaning');
                  setSelectedTable(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--table-cleaning-bg)',
                  color: 'var(--table-cleaning-text)',
                  border: '1.5px solid #CA8A04',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
                title="Mark Cleaning"
              >
                <span>🧹</span>
                <span>Cleaning</span>
              </button>

              {/* Option 4: Mark Reserved */}
              <button
                onClick={() => {
                  updateTableStatus(selectedTable.id, 'reserved');
                  setSelectedTable(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--table-reserved-bg)',
                  color: 'var(--table-reserved-text)',
                  border: '1.5px solid #9333EA',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
                title="Mark Reserved"
              >
                <span>🟣</span>
                <span>Reserved</span>
              </button>

              {/* Option 5: Take Walk-in Order */}
              <button
                onClick={() => {
                  setWalkInTableDefault(selectedTable.number);
                  setWalkInModalOpen(true);
                  setSelectedTable(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px var(--primary-glow)',
                  transition: 'all 0.12s ease',
                }}
                title="Take Order for this Table"
              >
                <Plus size={14} strokeWidth={2.4} />
                <span>+ Order</span>
              </button>

              {/* Close Button */}
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
