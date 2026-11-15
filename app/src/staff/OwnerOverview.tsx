'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { StoreMapModal } from '../customer/StoreMapModal';
import { normalizeBranchId } from '@/types/cafe';
import {
  TrendingUp,
  Building2,
  Banknote,
  AlertOctagon,
  Users,
  ShieldAlert,
  ArrowRight,
  CheckCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  RotateCcw,
  Bike,
  Utensils,
  Store,
  Bell,
  MapPin,
} from 'lucide-react';

export const OwnerOverviewScreen: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const {
    branches,
    orders,
    shifts,
    refundRequests,
    setCurrentBranchId,
    setCurrentRole,
    managerAccessRequests,
    requestManagerAccess,
    revokeManagerAccess,
    updateBranchSettings,
    toggleBranchStatus,
    addToast,
    openNotificationModal,
  } = useApp();

  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);

  // Helper to test if a timestamp/date string represents today
  const isToday = (dateStr?: string) => {
    if (!dateStr) return true;
    if (typeof dateStr === 'string' && (
      dateStr.toLowerCase().includes('today') ||
      dateStr.toLowerCase().includes('just now') ||
      dateStr.toLowerCase().includes('ago') ||
      dateStr.toLowerCase().includes('min')
    )) {
      return true;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const isOrderPaid = (o: any) => {
    if (!o || o.status === 'cancelled') return false;
    if (o.paymentStatus === 'paid') return true;
    if (o.paymentCollected === true) return true;
    if (o.status === 'completed' || o.status === 'delivered') return true;
    const method = String(o.paymentMethod || '').toLowerCase();
    if (o.paymentStatus !== 'unpaid' && (
      method.includes('wallet') ||
      method.includes('card') ||
      method.includes('bank') ||
      method.includes('jazz') ||
      method.includes('easy') ||
      method.includes('raast') ||
      method.includes('installment')
    )) {
      return true;
    }
    return false;
  };

  // 1. ROW 1: TRUE ACTUAL DATA COMPUTED FROM DATABASE (Memoized for Redux performance)
  const { todayOrders, paidOrdersTodayCount, totalSalesToday, totalOrdersTodayCount, totalCashCollectedToday, totalInProgressOrdersCount } = useMemo(() => {
    const tOrders = orders.filter(
      (o) => isToday(o.createdAt) || (o.status !== 'completed' && o.status !== 'cancelled')
    );
    const paidTodayOrders = tOrders.filter(isOrderPaid);
    const sales = paidTodayOrders.reduce(
      (sum, o) => sum + Number(o.total || 0),
      0
    );
    const inProgress = tOrders.filter(
      (o) =>
        o.status === 'placed' ||
        o.status === 'accepted' ||
        o.status === 'preparing' ||
        o.status === 'ready' ||
        o.status === 'out_for_delivery'
    ).length;
    const cash = shifts
      .filter((s) => isToday(s.openedAt) || s.status === 'open')
      .reduce((sum, s) => sum + Number(s.cashCollected || 0), 0);

    return {
      todayOrders: tOrders,
      paidOrdersTodayCount: paidTodayOrders.length,
      totalSalesToday: sales,
      totalOrdersTodayCount: tOrders.length,
      totalCashCollectedToday: cash,
      totalInProgressOrdersCount: inProgress,
    };
  }, [orders, shifts]);

  // 2. ROW 2: TRUE ACTUAL MANAGEMENT AUDIT & ANOMALY ALERTS FROM DATABASE
  const { pendingRefunds, shiftVariances, busyBranches, totalAnomaliesCount } = useMemo(() => {
    const refunds = refundRequests.filter((r) => r.status === 'requested');
    const variances = shifts.filter((s) => typeof s.difference === 'number' && s.difference !== 0);
    const busy = branches.filter((b) => b.isBusy);
    return {
      pendingRefunds: refunds,
      shiftVariances: variances,
      busyBranches: busy,
      totalAnomaliesCount: refunds.length + variances.length + busy.length,
    };
  }, [refundRequests, shifts, branches]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        overflowY: 'auto',
        maxHeight: '100%',
        paddingRight: '6px',
      }}
    >
      {/* Page Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          Platform Owner Console
        </h1>
      </div>

      {/* ROW 1: 4 TOP CARDS (Strictly Counting for Today) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {/* Card 1: Paid Sales Today */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            All-Branches Sales Today
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: totalSalesToday > 0 ? '#16A34A' : 'var(--primary)', marginTop: '4px', letterSpacing: '-0.02em' }}>
            Rs. {totalSalesToday.toLocaleString()}
          </div>
          <span style={{ fontSize: '12px', color: totalSalesToday > 0 ? '#16A34A' : 'var(--text-muted)', fontWeight: 600 }}>
            {paidOrdersTodayCount > 0 ? `✓ ${paidOrdersTodayCount} Live Verified Paid Order${paidOrdersTodayCount === 1 ? '' : 's'}` : 'Awaiting today first paid orders'}
          </span>
        </div>

        {/* Card 2: Total Orders Today (Clickable - Navigates to Orders History) */}
        <div
          onClick={() => onNavigate('mgmt-customers')}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Network Orders Today
            </span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '2px 8px', borderRadius: '6px' }}>
              View ➔
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px', letterSpacing: '-0.02em' }}>
            {totalOrdersTodayCount}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Across all 3 active branches • Click to view
          </span>
        </div>

        {/* Card 3: Pending Orders (Today) (Clickable - Replaces Avg Paid Order) */}
        <div
          onClick={() => onNavigate('mgmt-customers-pending')}
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = '#EA580C';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Pending Orders (Today)
            </span>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#D97706', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '6px' }}>
              View ➔
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: totalInProgressOrdersCount > 0 ? '#EA580C' : 'var(--text-main)', marginTop: '4px', letterSpacing: '-0.02em' }}>
            {totalInProgressOrdersCount}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Active in kitchen / delivery • Click to view
          </span>
        </div>

        {/* Card 4: Active Open Branches */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Open Branches
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px', letterSpacing: '-0.02em' }}>
            {branches.filter((b) => b.isOpen).length} / {branches.length}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            All 3 city branches connected live
          </span>
        </div>
      </div>

      {/* PER-BRANCH COMPARISON & MUTUAL MANAGER AGREEMENT SWITCH CARDS (STRICTLY TODAY'S METRICS) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Branch Operational Health & Access Control
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Per platform isolation policy, switching to Branch Manager mode requires mutual agreement: send request here, and Branch Manager must accept in Branch Staff Accounts.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {branches.map((b) => {
            const req = managerAccessRequests[b.id];
            const isApproved = req?.status === 'approved';
            const isPending = req?.status === 'pending';
            const isRejected = req?.status === 'rejected';

            const normBId = normalizeBranchId(b.id);
            const bOrders = orders.filter(
              (o) => !o.branchId || o.branchId === b.id || normalizeBranchId(o.branchId) === normBId
            );
            const bOrdersToday = bOrders.filter((o) => isToday(o.createdAt));
            const bPaidOrdersList = bOrdersToday.filter(isOrderPaid);
            const bSalesToday = bPaidOrdersList.reduce(
              (sum, o) => sum + Number(o.total || 0),
              0
            );
            const bInProgress = bOrdersToday.filter(
              (o) =>
                o.status === 'placed' ||
                o.status === 'accepted' ||
                o.status === 'preparing' ||
                o.status === 'ready' ||
                o.status === 'out_for_delivery'
            ).length;
            const bPaidOrders = bPaidOrdersList.length;

            return (
              <div
                key={b.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: isApproved ? '1.5px solid #16A34A' : isPending ? '1.5px solid #EA580C' : '1px solid var(--border-color)',
                  padding: '20px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      {b.name}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingBranchId(b.id)}
                      title="Click to view and edit branch location & OpenStreetMap pin"
                      style={{
                        background: 'none',
                        border: '1px solid rgba(234, 88, 12, 0.25)',
                        padding: '2px 7px',
                        marginTop: '4px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(234, 88, 12, 0.08)',
                        color: '#C2410C',
                        fontSize: '11.5px',
                        fontWeight: 650,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textAlign: 'left',
                      }}
                    >
                      <MapPin size={12} color="#EA580C" />
                      <span>{b.city} • {b.address} (Edit Location 📍)</span>
                    </button>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: b.isOpen ? 'var(--status-ready-bg)' : 'var(--status-cancelled-bg)',
                      color: b.isOpen ? 'var(--status-ready-text)' : 'var(--status-cancelled-text)',
                    }}
                  >
                    {b.isOpen ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>

                {/* Real-Time Live Branch Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 750, textTransform: 'uppercase', display: 'block' }}>Sales Today</span>
                    <strong style={{ fontSize: '14px', color: '#16A34A' }}>Rs. {bSalesToday.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 750, textTransform: 'uppercase', display: 'block' }}>Orders Today</span>
                    <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>{bOrdersToday.length} <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>({bPaidOrders} Paid)</span></strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 750, textTransform: 'uppercase', display: 'block' }}>In Progress</span>
                    <strong style={{ fontSize: '14px', color: '#EA580C' }}>{bInProgress} Orders</strong>
                  </div>
                </div>

                {/* Operational Details */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '8px',
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>⏱️ Prep: <strong>{b.prepTimeEstimateMin}m</strong></div>
                  <div>⚡ Edit Win: <strong>{b.fullEditWindowMin}m</strong></div>
                  <div>🛵 Delivery: <strong>{b.deliveryEnabled !== false ? 'Enabled' : 'Paused'} ({b.maxOrderDistanceKm || 50}km)</strong></div>
                  <div>📍 Table QR: <strong>{b.tableQrMaxDistanceMeters || 300}m</strong></div>
                </div>

                {/* Platform Owner Quick Operational Overrides */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Storefront Open/Closed Toggle */}
                  <button
                    onClick={() => toggleBranchStatus(b.id)}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: `1.5px solid ${b.isOpen ? '#16A34A' : '#DC2626'}`,
                      backgroundColor: b.isOpen ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.08)',
                      color: b.isOpen ? '#15803D' : '#DC2626',
                      fontWeight: 800,
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    {b.isOpen ? <CheckCircle size={13} /> : <XCircle size={13} />}
                    <span>{b.isOpen ? 'Store: OPEN' : 'Store: CLOSED'}</span>
                  </button>

                  {/* Rush Hour Toggle */}
                  <button
                    onClick={() => {
                      const nextBusy = !b.isBusy;
                      updateBranchSettings(b.id, { isBusy: nextBusy });
                      addToast({
                        type: 'info',
                        title: nextBusy ? 'Busy Mode On' : 'Busy Mode Off',
                        message: `${b.name} rush hour mode set to ${nextBusy ? 'Active (+15m)' : 'Normal'}.`,
                      });
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: `1.5px solid ${b.isBusy ? '#EA580C' : 'var(--border-color)'}`,
                      backgroundColor: b.isBusy ? 'rgba(234, 88, 12, 0.1)' : 'var(--bg-card-subtle)',
                      color: b.isBusy ? '#EA580C' : 'var(--text-muted)',
                      fontWeight: 750,
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <AlertOctagon size={13} />
                    <span>{b.isBusy ? 'Rush Active' : 'Rush Mode'}</span>
                  </button>

                  {/* Delivery Toggle */}
                  <button
                    onClick={() => {
                      const nextDelivery = b.deliveryEnabled === false;
                      updateBranchSettings(b.id, { deliveryEnabled: nextDelivery });
                      addToast({
                        type: nextDelivery ? 'success' : 'warning',
                        title: nextDelivery ? 'Delivery Active' : 'Delivery Paused',
                        message: `${b.name} doorstep delivery ${nextDelivery ? 'enabled' : 'paused'}.`,
                      });
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: `1.5px solid ${b.deliveryEnabled !== false ? '#2563EB' : 'var(--border-color)'}`,
                      backgroundColor: b.deliveryEnabled !== false ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-card-subtle)',
                      color: b.deliveryEnabled !== false ? '#2563EB' : 'var(--text-muted)',
                      fontWeight: 750,
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <Bike size={13} />
                    <span>{b.deliveryEnabled !== false ? 'Delivery: ON' : 'Delivery: OFF'}</span>
                  </button>
                </div>

                {/* MUTUAL AGREEMENT SWITCH TO MANAGER MODE WORKFLOW */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {isApproved ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#16A34A', fontWeight: 700 }}>
                        <CheckCircle2 size={15} />
                        <span>Manager Mode Authorized by Branch Manager</span>
                      </div>
                      <button
                        onClick={() => {
                          setCurrentBranchId(b.id);
                          setCurrentRole('branch_manager');
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('foodies_staff_role', 'branch_manager');
                          }
                          onNavigate('staff-manager');
                          addToast({
                            type: 'success',
                            title: 'Manager Mode Activated 👔',
                            message: `Mutual agreement verified. Now operating as Branch Manager for ${b.name}.`,
                          });
                        }}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--primary)',
                          color: '#FFFFFF',
                          fontWeight: 800,
                          fontSize: '13px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          border: 'none',
                          boxShadow: '0 2px 8px var(--primary-glow)',
                        }}
                      >
                        <span>Switch to Manager View</span>
                        <ArrowRight size={15} />
                      </button>
                    </>
                  ) : isPending ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          color: '#D97706',
                          backgroundColor: 'rgba(217, 119, 6, 0.08)',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          fontWeight: 700,
                        }}
                      >
                        <Clock size={15} />
                        <span>Awaiting Branch Manager Acceptance in Staff Accounts...</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          disabled
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-muted)',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                          }}
                        >
                          <Lock size={13} />
                          <span>Manager Mode Locked</span>
                        </button>
                        <button
                          onClick={() => revokeManagerAccess(b.id)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-color)',
                            color: '#DC2626',
                            fontWeight: 700,
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : isRejected ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          color: '#DC2626',
                          backgroundColor: 'rgba(220, 38, 38, 0.08)',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          fontWeight: 700,
                        }}
                      >
                        <XCircle size={15} />
                        <span>Request Declined by Branch Manager</span>
                      </div>
                      <button
                        onClick={() => requestManagerAccess(b.id)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>Request Manager Access Again</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <button
                        onClick={() => requestManagerAccess(b.id)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1.5px solid var(--border-color)',
                          color: 'var(--text-main)',
                          fontWeight: 750,
                          fontSize: '12.5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '7px',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <Lock size={14} color="var(--primary)" />
                        <span>Request Manager Access</span>
                      </button>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                        Requires mutual agreement: manager will review in Branch Staff
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Branch Location & OpenStreetMap Editor Modal */}
      {editingBranchId && (
        <StoreMapModal
          isOpen={true}
          onClose={() => setEditingBranchId(null)}
          startInEditMode={true}
          initialEditingBranchId={editingBranchId}
        />
      )}
    </div>
  );
};
