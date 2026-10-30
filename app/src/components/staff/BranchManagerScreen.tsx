'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
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
} from 'lucide-react';

export const BranchManagerScreen: React.FC = () => {
  const {
    currentBranch,
    updateBranchSettings,
    orders,
    menuItems,
    toggleMenuItemBranchAvailability,
    refundRequests,
    decideRefund,
    users,
    currentShift,
    addToast,
  } = useApp();

  // Timing settings form state
  const [fullEditWindow, setFullEditWindow] = useState(currentBranch.fullEditWindowMin);
  const [prepTimeEstimate, setPrepTimeEstimate] = useState(currentBranch.prepTimeEstimateMin);
  const [stopAddonsTime, setStopAddonsTime] = useState(currentBranch.stopAddOnsMinBeforeReady);
  const [isBusyMode, setIsBusyMode] = useState(currentBranch.isBusy);
  
  // Modals
  const [timingConfirmOpen, setTimingConfirmOpen] = useState(false);
  const [refundDecisionModal, setRefundDecisionModal] = useState<{ id: string; amount: number; reason: string; approve: boolean } | null>(null);

  // Today's metrics
  const branchOrders = orders.filter((o) => o.branchId === currentBranch.id);
  const totalOrdersToday = branchOrders.length;
  const pendingOrders = branchOrders.filter((o) => o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing').length;
  const totalCashCollected = Number(currentShift?.cashCollected || 0);

  const branchStaff = users.filter((u) => u.branchId === currentBranch.id);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>


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

          {/* Branch Staff List */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Branch Team Roster ({branchStaff.length} Members)
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {branchStaff.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '6px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)' }}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  <span style={{ textTransform: 'uppercase', fontSize: '10.5px', fontWeight: 700, color: 'var(--primary)' }}>
                    {s.role.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
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
