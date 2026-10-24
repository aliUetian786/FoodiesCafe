'use client';

import React, { useState } from 'react';
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
    menuItems,
    toggleMenuItemBranchAvailability,
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

  const branchRiders = users.filter(
    (u) => u.role === 'delivery_staff' && (!u.branchId || u.branchId === currentBranch.id)
  );

  const branchDeliveryOrders = orders.filter(
    (o) => o.type === 'delivery' && (!o.branchId || o.branchId === currentBranch.id) && o.status !== 'completed' && o.status !== 'cancelled'
  );

  // Timing settings form state
  const [fullEditWindow, setFullEditWindow] = useState(currentBranch.fullEditWindowMin);
  const [prepTimeEstimate, setPrepTimeEstimate] = useState(currentBranch.prepTimeEstimateMin);
  const [stopAddonsTime, setStopAddonsTime] = useState(currentBranch.stopAddOnsMinBeforeReady);
  const [isBusyMode, setIsBusyMode] = useState(currentBranch.isBusy);
  
  // Payment settings state per order type
  const defaultPaymentSettings = currentBranch.paymentSettings || {
    dine_in: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
    takeaway: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
    delivery: { COD: true, Wallet: true, Card: true, Bank: true, Installment: true },
  };

  const [paymentConfig, setPaymentConfig] = useState(defaultPaymentSettings);
  const [paymentOrderTypeTab, setPaymentOrderTypeTab] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');

  const handleTogglePaymentMode = (mode: 'COD' | 'Wallet' | 'Card' | 'Bank' | 'Installment') => {
    setPaymentConfig((prev) => {
      const currentTabConfig = prev[paymentOrderTypeTab];
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

  // Today's metrics (Fast mode defaults to today's data)
  const branchOrders = orders.filter((o) => !o.branchId || o.branchId === currentBranch.id);
  const branchOrdersToday = branchOrders.filter((o) => isToday(o.createdAt));
  const totalOrdersToday = branchOrdersToday.length;
  const pendingOrders = branchOrdersToday.filter((o) => o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing').length;
  const totalCashCollected = currentShift?.cashCollected || 34200;

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
      {/* FAST PERFORMANCE BAR: SHOW TODAY ONLY & ON-DEMAND FETCH */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '12px 20px',
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
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: hasLoadedOlderOrders ? 'rgba(37, 99, 235, 0.1)' : 'rgba(22, 163, 74, 0.1)',
              color: hasLoadedOlderOrders ? '#2563EB' : '#16A34A',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{hasLoadedOlderOrders ? '📂 Full Historical Data' : '⚡ Fast Mode: Today Only'}</span>
          </span>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {hasLoadedOlderOrders
              ? `Loaded ${branchOrders.length} database order records. Detail operations view active.`
              : `Showing details of today (${totalOrdersToday} orders). Older records are kept in database archive to keep web ultra-fast.`}
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
              <span>{isFetchingOlderOrders ? '⏳ Fetching Records...' : '📂 Fetch Older Data ⬇'}</span>
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
              Save Timing Settings (Requires Confirmation)
            </button>
          </div>
        </div>

        {/* Busy Mode & Branch Hours Panel */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
            Operational State & Busy Mode
          </h3>

          <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px' }}>Busy Mode Switch</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Extends customer prep times and shows warning banner.
              </div>
            </div>
            <button
              onClick={handleToggleBusyMode}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isBusyMode ? '#DC2626' : '#16A34A',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              {isBusyMode ? 'BUSY (ON)' : 'NORMAL (OFF)'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <div>🕒 <strong>Opening Hours:</strong> {currentBranch.openingHours}</div>
            <div>📍 <strong>Address:</strong> {currentBranch.address}</div>
            <div>📞 <strong>Branch Phone:</strong> {currentBranch.phone}</div>
          </div>

          {/* Branch Staff Accounts Quick Summary */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Branch Staff Accounts
              </span>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {branchSubordinates.length} Subordinates · {activeStaffCount} Active
              </div>
            </div>
            <button
              onClick={() => onNavigate?.('staff-manager-accounts')}
              style={{
                fontSize: '11.5px',
                fontWeight: 750,
                color: 'var(--primary)',
                backgroundColor: 'var(--primary-light)',
                border: '1px solid rgba(234, 88, 12, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>Manage Staff Accounts</span>
              <ChevronRight size={14} />
            </button>
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
                Branch Payment Modes & Installment Rules
              </h3>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Configure which payment options (COD, Wallet, Card, Bank, Installments) customers can use for Dine-In, Takeaway, and Delivery.
            </p>
          </div>

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

      {/* RIDER FLEET & DELIVERY CONTROL HUB */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(234, 88, 12, 0.12)', color: '#EA580C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bike size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 850, margin: 0, color: 'var(--text-main)' }}>
                Rider Fleet & Delivery Operations Hub
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Control branch delivery staff duty status, assign orders, and monitor real-time shipping
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => onNavigate?.('staff-rider')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#EA580C',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
              }}
            >
              <Bike size={13} />
              <span>Open Rider Console</span>
            </button>
          </div>
        </div>

        {/* Riders List & Control Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
          {branchRiders.map((rider) => {
            const isAvail = rider.riderAvailability !== 'busy' && rider.riderAvailability !== 'offline';
            const activeOrder = orders.find((o) => o.assignedRiderId === rider.id && o.status !== 'completed' && o.status !== 'cancelled');

            return (
              <div
                key={rider.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: '14px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 850, fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{rider.name}</span>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 800 }}>
                        ID: {rider.id}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📱 {rider.phone} • ✉️ {rider.email || 'rider1.gulberg@foodiescafe.pk'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#15803D', fontWeight: 700, marginTop: '3px', display: 'flex', gap: '8px', backgroundColor: '#F0FDF4', padding: '2px 8px', borderRadius: '4px', border: '1px solid #DCFCE7' }}>
                      <span>🔑 Password: <strong>password123</strong></span>
                      <span>•</span>
                      <span>PIN: <strong>1234</strong></span>
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 800,
                      backgroundColor: isAvail ? '#DCFCE7' : rider.riderAvailability === 'busy' ? '#FEF3C7' : '#F1F5F9',
                      color: isAvail ? '#15803D' : rider.riderAvailability === 'busy' ? '#B45309' : '#64748B',
                      border: `1px solid ${isAvail ? '#BBF7D0' : rider.riderAvailability === 'busy' ? '#FDE68A' : '#CBD5E1'}`,
                    }}
                  >
                    {isAvail ? 'Available' : rider.riderAvailability === 'busy' ? 'On Route' : 'Offline'}
                  </span>
                </div>

                {/* Currently Assigned Delivery Order */}
                {activeOrder ? (
                  <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: '11.5px', color: '#1E40AF' }}>
                    <span style={{ fontWeight: 800 }}>Delivering #{activeOrder.orderNumber}:</span> {activeOrder.customerName}
                    <div style={{ color: '#3B82F6', marginTop: '2px', fontSize: '11px' }}>
                      📍 {activeOrder.deliveryAddress || 'Lahore'}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    No order assigned currently. Ready for dispatch.
                  </div>
                )}

                {/* Manager Duty Controls & Quick Switch to Rider Console */}
                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => updateRiderAvailability(rider.id, isAvail ? 'offline' : 'available')}
                    style={{
                      flex: 1,
                      padding: '6px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: '#FFFFFF',
                      fontSize: '11.5px',
                      fontWeight: 750,
                      cursor: 'pointer',
                      color: isAvail ? '#B91C1C' : '#15803D',
                    }}
                  >
                    {isAvail ? 'Set Shift Offline' : 'Set Available'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentUser(rider);
                      setCurrentRole('delivery_staff');
                      onNavigate?.('staff-rider');
                      addToast({
                        type: 'info',
                        title: 'Acting as Delivery Rider 🛵',
                        message: `Switched into Rider Console as ${rider.name} (${rider.email}).`,
                      });
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--primary)',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <Bike size={13} />
                    <span>Use Rider Account</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Unassigned / Pending Delivery Orders Queue */}
        {branchDeliveryOrders.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
              Pending Branch Delivery Shipments ({branchDeliveryOrders.length}):
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {branchDeliveryOrders.map((ord) => (
                <div
                  key={ord.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    fontSize: '12px',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 850, color: '#EA580C', marginRight: '6px' }}>
                      #{ord.orderNumber}
                    </span>
                    <span style={{ fontWeight: 700 }}>{ord.customerName}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                      • {ord.deliveryAddress || 'Address'} • Rs. {Number(ord.total).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      {ord.assignedRiderName ? `🛵 ${ord.assignedRiderName}` : 'Unassigned'}
                    </span>
                    <select
                      value={ord.assignedRiderId || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          assignRiderToOrder(ord.id, e.target.value);
                        }
                      }}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '11px',
                        fontWeight: 750,
                        backgroundColor: '#FFFFFF',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="" disabled>Assign Rider</option>
                      {branchRiders.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.riderAvailability === 'busy' ? 'Busy' : 'Ready'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MENU AVAILABILITY TOGGLES & REFUND APPROVALS QUEUE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Menu Availability Toggles */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
            Branch Menu Availability Toggles
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Managers can toggle availability for this branch only (owner controls master prices).
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
            {menuItems.map((item) => {
              const isAvailable = item.branchAvailability[currentBranch.id] ?? item.isAvailable;
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{item.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.category} · Rs. {item.basePrice}</div>
                  </div>

                  <button
                    onClick={() => toggleMenuItemBranchAvailability(item.id, currentBranch.id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isAvailable ? 'var(--status-ready-bg)' : 'var(--status-cancelled-bg)',
                      color: isAvailable ? 'var(--status-ready-text)' : 'var(--status-cancelled-text)',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    {isAvailable ? 'IN STOCK' : 'OUT OF STOCK'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Refund Approvals Queue */}
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

      {/* Confirmation Modal for Timing Settings (PRD Section F16) */}
      <ModalConfirmation
        isOpen={timingConfirmOpen}
        onClose={() => setTimingConfirmOpen(false)}
        onConfirm={handleSaveTimingSettings}
        title="Update Branch Timing Settings?"
        message="Changes to the full-edit window and add-ons deadline directly affect kitchen workflow and customer permissions."
        details={`Full Edit Window: ${fullEditWindow}m · Prep Estimate: ${prepTimeEstimate}m · Add-ons Cutoff: ${stopAddonsTime}m`}
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

