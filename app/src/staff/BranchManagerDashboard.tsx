'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import { Role } from '@/types/cafe';
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
  Bike,
  Navigation,
  Package,
  Phone,
} from 'lucide-react';

interface BranchManagerScreenProps {
  onNavigate?: (view: string) => void;
}

export const BranchManagerScreen: React.FC<BranchManagerScreenProps> = ({ onNavigate }) => {
  const {
    currentBranch,
    updateBranchSettings,
    updateBranchPaymentSettings,
    orders,
    refundRequests,
    decideRefund,
    users,
    currentShift,
    addToast,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    fetchOlderOrders,
    filterOrdersToToday,
    assignRiderToOrder,
    updateRiderAvailability,
    setCurrentUser,
    setCurrentRole,
  } = useApp();

  // Timing & distance settings form state
  const [fullEditWindow, setFullEditWindow] = useState(currentBranch.fullEditWindowMin);
  const [prepTimeEstimate, setPrepTimeEstimate] = useState(currentBranch.prepTimeEstimateMin);
  const [stopAddonsTime, setStopAddonsTime] = useState(currentBranch.stopAddOnsMinBeforeReady);
  const [maxOrderDistance, setMaxOrderDistance] = useState(currentBranch.maxOrderDistanceKm ?? 50);
  const [tableQrMaxDistance, setTableQrMaxDistance] = useState(currentBranch.tableQrMaxDistanceMeters ?? 300);
  const [isBusyMode, setIsBusyMode] = useState(currentBranch.isBusy);
  
  // Payment settings state per order type
  const defaultPaymentSettings = currentBranch.paymentSettings || {
    dine_in: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
    takeaway: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
    delivery: { COD: true, Wallet: true, Card: true, Bank: true, Installment: true },
  };

  const [paymentConfig, setPaymentConfig] = useState(defaultPaymentSettings);
  const [paymentOrderTypeTab, setPaymentOrderTypeTab] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');

  useEffect(() => {
    if (currentBranch.paymentSettings) {
      const parsed = typeof currentBranch.paymentSettings === 'string'
        ? JSON.parse(currentBranch.paymentSettings)
        : currentBranch.paymentSettings;
      setPaymentConfig(parsed);
    }
  }, [currentBranch.paymentSettings]);

  const handleTogglePaymentMode = (mode: 'COD' | 'Wallet' | 'Card' | 'Bank' | 'Installment') => {
    setPaymentConfig((prev) => {
      const currentTabConfig = prev[paymentOrderTypeTab] || { COD: true, Wallet: true, Card: true, Bank: true, Installment: false };
      const updated = {
        ...prev,
        [paymentOrderTypeTab]: {
          ...currentTabConfig,
          [mode]: !currentTabConfig[mode],
        },
      };
      updateBranchPaymentSettings(currentBranch.id, updated);
      return updated;
    });
  };

  const handleApplyToAllOrderTypes = () => {
    const currentTabSettings = paymentConfig[paymentOrderTypeTab];
    const updated = {
      dine_in: { ...currentTabSettings },
      takeaway: { ...currentTabSettings },
      delivery: { ...currentTabSettings },
    };
    setPaymentConfig(updated);
    updateBranchPaymentSettings(currentBranch.id, updated);
    addToast({
      type: 'success',
      title: 'Settings Synced to All Order Types',
      message: `Active payment options from ${paymentOrderTypeTab.replace('_', '-')} applied to Dine-In, Takeaway, and Delivery.`,
    });
  };

  // Modals for timing & refunds
  const [timingConfirmOpen, setTimingConfirmOpen] = useState(false);
  const [refundDecisionModal, setRefundDecisionModal] = useState<{ id: string; amount: number; reason: string; approve: boolean } | null>(null);

  // Today's date comparator
  const isToday = (dateStr?: string) => {
    if (!dateStr) return true;
    if (typeof dateStr === 'string' && dateStr.toLowerCase().includes('today')) return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  // Today's metrics (Fast mode defaults to today's data, memoized for Redux performance)
  const { branchOrders, branchOrdersToday, totalOrdersToday, pendingOrders } = useMemo(() => {
    const bOrders = orders.filter((o) => !o.branchId || o.branchId === currentBranch.id);
    const bOrdersToday = bOrders.filter((o) => isToday(o.createdAt));
    const totalToday = bOrdersToday.length;
    const pending = bOrdersToday.filter(
      (o) => o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing'
    ).length;

    return {
      branchOrders: bOrders,
      branchOrdersToday: bOrdersToday,
      totalOrdersToday: totalToday,
      pendingOrders: pending,
    };
  }, [orders, currentBranch.id]);

  const totalCashCollected = Number(currentShift?.cashCollected || 0);

  // Branch Subordinates under this Manager (Cashier, Kitchen, Floor, Rep, Delivery)
  const subordinateRoles: Role[] = ['cashier', 'kitchen_staff', 'floor_staff', 'branch_representative', 'delivery_staff'];
  const branchSubordinates = users.filter(
    (u) => (!u.branchId || u.branchId === currentBranch.id) && subordinateRoles.includes(u.role)
  );
  const activeStaffCount = branchSubordinates.filter((u) => u.status === 'active').length;
  const suspendedStaffCount = branchSubordinates.filter((u) => u.status === 'suspended').length;

  const pendingRefunds = refundRequests.filter((r) => r.status === 'requested');

  const handleSaveTimingSettings = () => {
    updateBranchSettings(currentBranch.id, {
      fullEditWindowMin: fullEditWindow,
      prepTimeEstimateMin: prepTimeEstimate,
      stopAddOnsMinBeforeReady: stopAddonsTime,
      maxOrderDistanceKm: maxOrderDistance,
      tableQrMaxDistanceMeters: tableQrMaxDistance,
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
      {/* TODAY'S OVERVIEW CARDS (PRD Requirement) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Orders Today</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {totalOrdersToday}
          </div>
          <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>Dine-in & Takeaway</span>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Active in Kitchen</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#EA580C', marginTop: '4px' }}>
            {pendingOrders}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Orders pending</span>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Prep Time</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            {currentBranch.prepTimeEstimateMin}m
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Configured window</span>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cash Collected Today</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
            Rs. {totalCashCollected.toLocaleString()}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Till Drawer Total</span>
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

        {/* Refund Approvals Queue (Moved into first grid) */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
            Refund Approvals Queue
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingRefunds.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No pending refunds requiring manager sign-off.
              </div>
            ) : (
              pendingRefunds.map((ref) => (
                <div
                  key={ref.id}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 800, fontSize: '14px' }}>Order #{ref.orderNumber}</span>
                    <span style={{ fontWeight: 800, color: '#DC2626', fontSize: '14px' }}>Rs. {ref.amount.toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Reason: {ref.reason} · Requested by: {ref.requestedBy}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => setRefundDecisionModal({ id: ref.id, amount: ref.amount, reason: ref.reason, approve: true })}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: '6px',
                        backgroundColor: '#16A34A',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Approve Refund
                    </button>
                    <button
                      onClick={() => setRefundDecisionModal({ id: ref.id, amount: ref.amount, reason: ref.reason, approve: false })}
                      style={{
                        flex: 1,
                        padding: '6px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid #DC2626',
                        color: '#DC2626',
                        fontWeight: 700,
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* BRANCH PAYMENT MODES & INSTALLMENTS CONFIGURATION (Manager Controlled per Order Option) */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Branch Payment Modes
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Desktop View: Separate Button + Tab Pills */}
            <div className="bm-payment-tabs-desktop" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleApplyToAllOrderTypes}
                title="Sync current tab payment options across Dine-In, Takeaway & Delivery"
                style={{
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>⚡ Apply to All Order Types</span>
              </button>

              {/* Order Type Tabs */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: 'var(--radius-full)',
                  padding: '4px',
                  gap: '4px',
                }}
              >
                {(['dine_in', 'takeaway', 'delivery'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setPaymentOrderTypeTab(tab)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 'var(--radius-full)',
                      border: 'none',
                      backgroundColor: paymentOrderTypeTab === tab ? 'var(--primary)' : 'transparent',
                      color: paymentOrderTypeTab === tab ? '#FFFFFF' : 'var(--text-secondary)',
                      fontWeight: 800,
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tab.replace('_', '-')}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile / Phone View: Single Dropdown with all 4 options */}
            <div className="bm-payment-tabs-mobile" style={{ display: 'none', width: '100%' }}>
              <select
                value={paymentOrderTypeTab}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'apply_all') {
                    handleApplyToAllOrderTypes();
                  } else {
                    setPaymentOrderTypeTab(val as 'dine_in' | 'takeaway' | 'delivery');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--primary)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="dine_in">Dine-In</option>
                <option value="takeaway">Takeaway</option>
                <option value="delivery">Delivery</option>
                <option value="apply_all">⚡ Apply to All Order Types</option>
              </select>
            </div>
          </div>
        </div>

        {/* Payment Modes Grid for Selected Order Type Tab */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {/* 1. COD / Cash */}
          <div
            onClick={() => handleTogglePaymentMode('COD')}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${paymentConfig[paymentOrderTypeTab]?.COD ? 'var(--primary)' : 'var(--border-color)'}`,
              backgroundColor: paymentConfig[paymentOrderTypeTab]?.COD ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Banknote size={18} color={paymentConfig[paymentOrderTypeTab]?.COD ? 'var(--primary)' : 'var(--text-muted)'} />
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>COD / Cash</span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 850,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: paymentConfig[paymentOrderTypeTab]?.COD ? 'var(--primary)' : 'var(--border-color)',
                  color: paymentConfig[paymentOrderTypeTab]?.COD ? '#FFFFFF' : 'var(--text-muted)',
                }}
              >
                {paymentConfig[paymentOrderTypeTab]?.COD ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Cash on delivery or payment at cafe counter
            </span>
          </div>

          {/* 2. Wallet */}
          <div
            onClick={() => handleTogglePaymentMode('Wallet')}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${paymentConfig[paymentOrderTypeTab]?.Wallet ? 'var(--primary)' : 'var(--border-color)'}`,
              backgroundColor: paymentConfig[paymentOrderTypeTab]?.Wallet ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={18} color={paymentConfig[paymentOrderTypeTab]?.Wallet ? 'var(--primary)' : 'var(--text-muted)'} />
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>Mobile Wallet</span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 850,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: paymentConfig[paymentOrderTypeTab]?.Wallet ? 'var(--primary)' : 'var(--border-color)',
                  color: paymentConfig[paymentOrderTypeTab]?.Wallet ? '#FFFFFF' : 'var(--text-muted)',
                }}
              >
                {paymentConfig[paymentOrderTypeTab]?.Wallet ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              JazzCash / Easypaisa mobile payments
            </span>
          </div>

          {/* 3. Card */}
          <div
            onClick={() => handleTogglePaymentMode('Card')}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${paymentConfig[paymentOrderTypeTab]?.Card ? 'var(--primary)' : 'var(--border-color)'}`,
              backgroundColor: paymentConfig[paymentOrderTypeTab]?.Card ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color={paymentConfig[paymentOrderTypeTab]?.Card ? 'var(--primary)' : 'var(--text-muted)'} />
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>Card</span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 850,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: paymentConfig[paymentOrderTypeTab]?.Card ? 'var(--primary)' : 'var(--border-color)',
                  color: paymentConfig[paymentOrderTypeTab]?.Card ? '#FFFFFF' : 'var(--text-muted)',
                }}
              >
                {paymentConfig[paymentOrderTypeTab]?.Card ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Visa, Mastercard & PayPak debit/credit cards
            </span>
          </div>

          {/* 4. Bank */}
          <div
            onClick={() => handleTogglePaymentMode('Bank')}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${paymentConfig[paymentOrderTypeTab]?.Bank ? 'var(--primary)' : 'var(--border-color)'}`,
              backgroundColor: paymentConfig[paymentOrderTypeTab]?.Bank ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={18} color={paymentConfig[paymentOrderTypeTab]?.Bank ? 'var(--primary)' : 'var(--text-muted)'} />
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>Bank Transfer</span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 850,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: paymentConfig[paymentOrderTypeTab]?.Bank ? 'var(--primary)' : 'var(--border-color)',
                  color: paymentConfig[paymentOrderTypeTab]?.Bank ? '#FFFFFF' : 'var(--text-muted)',
                }}
              >
                {paymentConfig[paymentOrderTypeTab]?.Bank ? 'ACTIVE' : 'OFF'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Direct bank transfer via Raast / IBAN
            </span>
          </div>

          {/* 5. Installments (BNPL feature) */}
          <div
            onClick={() => handleTogglePaymentMode('Installment')}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${paymentConfig[paymentOrderTypeTab]?.Installment ? '#8B5CF6' : 'var(--border-color)'}`,
              backgroundColor: paymentConfig[paymentOrderTypeTab]?.Installment ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-card-subtle)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color={paymentConfig[paymentOrderTypeTab]?.Installment ? '#8B5CF6' : 'var(--text-muted)'} />
                <span style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>Installments (BNPL)</span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 850,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: paymentConfig[paymentOrderTypeTab]?.Installment ? '#8B5CF6' : 'var(--border-color)',
                  color: paymentConfig[paymentOrderTypeTab]?.Installment ? '#FFFFFF' : 'var(--text-muted)',
                }}
              >
                {paymentConfig[paymentOrderTypeTab]?.Installment ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Enable 3-month installment plans for customers. If disabled, this option will not appear.
            </span>
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

      {/* Confirmation Modal for Refund Decision */}
      {refundDecisionModal && (
        <ModalConfirmation
          isOpen={true}
          onClose={() => setRefundDecisionModal(null)}
          onConfirm={() => {
            decideRefund(refundDecisionModal.id, refundDecisionModal.approve);
            setRefundDecisionModal(null);
          }}
          title={refundDecisionModal.approve ? 'Approve Cash Refund?' : 'Reject Refund Request?'}
          message={refundDecisionModal.approve ? `Confirm cash refund of Rs. ${refundDecisionModal.amount.toLocaleString()}?` : 'Reject this refund request?'}
          details={`Reason: ${refundDecisionModal.reason}`}
          confirmText={refundDecisionModal.approve ? 'Yes, approve refund' : 'Yes, reject'}
          cancelText="No, cancel"
          isDanger={!refundDecisionModal.approve}
        />
      )}

    </div>
  );
};

