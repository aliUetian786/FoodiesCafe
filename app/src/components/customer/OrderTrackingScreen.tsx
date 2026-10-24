'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { OrderStatus } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Edit3,
  XCircle,
  Banknote,
  Utensils,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface OrderTrackingScreenProps {
  onNavigate: (view: string) => void;
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({ onNavigate }) => {
  const { orders, currentBranch, cancelOrder } = useApp();

  const activeOrder = orders[0]; // Most recent order
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of plans');

  if (!activeOrder) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800 }}>No Active Orders Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          You have not placed an order yet. Browse our menu to get started!
        </p>
        <button
          onClick={() => onNavigate('menu')}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
          }}
        >
          Browse Menu
        </button>
      </div>
    );
  }

  // Stepper definition
  const steps: { key: OrderStatus; label: string }[] = [
    { key: 'placed', label: 'Placed' },
    { key: 'accepted', label: 'Accepted' },
    { key: 'preparing', label: 'Preparing' },
    { key: 'ready', label: 'Ready' },
    { key: 'completed', label: 'Completed' },
  ];

  const getStepIndex = (status: OrderStatus) => {
    switch (status) {
      case 'placed':
        return 0;
      case 'accepted':
        return 1;
      case 'preparing':
        return 2;
      case 'ready':
      case 'out_for_delivery':
        return 3;
      case 'completed':
        return 4;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex(activeOrder.status);
  const isCancelled = activeOrder.status === 'cancelled';

  // Determine stage for edit button availability
  const canFullEdit = activeOrder.status === 'placed' || activeOrder.status === 'accepted';
  const canAddOns = activeOrder.status === 'preparing';
  const isLocked = activeOrder.status === 'ready' || activeOrder.status === 'completed' || isCancelled;

  // Separate regular items and add-ons
  const regularItems = activeOrder.items.filter((i) => !i.isAddOn);
  const addOnItems = activeOrder.items.filter((i) => i.isAddOn);

  return (
    <div style={{ maxWidth: '780px', margin: '24px auto 80px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header with Order # and Badge */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Live Order Tracking
          </span>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: '2px 0 0', color: 'var(--text-main)' }}>
            Order #{activeOrder.orderNumber}
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {activeOrder.type.toUpperCase()} {activeOrder.tableNumber ? `· Table ${activeOrder.tableNumber}` : ''} · {currentBranch.name}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 800,
              fontSize: '12.5px',
              textTransform: 'uppercase',
              backgroundColor: isCancelled ? 'var(--status-cancelled-bg)' : 'var(--status-preparing-bg)',
              color: isCancelled ? 'var(--status-cancelled-text)' : 'var(--status-preparing-text)',
            }}
          >
            {activeOrder.status}
          </span>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: activeOrder.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
              color: activeOrder.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
            }}
          >
            {activeOrder.paymentStatus === 'paid' ? 'PAID (CASH)' : 'UNPAID — PAY CASH AT CAFE'}
          </span>
        </div>
      </div>

      {/* HIGHLIGHTED NOTIFICATION CARD (PRD Requirement) */}
      <div
        style={{
          backgroundColor: 'var(--primary-light)',
          border: '2px solid var(--primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 6px 20px var(--primary-glow)',
          animation: 'pulseGlow 3s infinite',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Clock size={24} />
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--primary)' }}>
            Your food will be ready in about 10 minutes.
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '2px', lineHeight: 1.4 }}>
            You can start coming to the cafe or take your seat at Table {activeOrder.tableNumber || 'counter'}.
          </div>
        </div>
      </div>

      {/* BIG STATUS STEPPER */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '28px 20px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
          {/* Background Line */}
          <div
            style={{
              position: 'absolute',
              top: '18px',
              left: '5%',
              right: '5%',
              height: '4px',
              backgroundColor: 'var(--border-color)',
              zIndex: 1,
            }}
          />

          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx && !isCancelled;

            return (
              <div
                key={step.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  zIndex: 2,
                  width: '80px',
                }}
              >
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: isCurrent
                      ? 'var(--primary)'
                      : isCompleted
                      ? '#16A34A'
                      : 'var(--bg-card)',
                    border: isCurrent
                      ? '3px solid var(--primary-light)'
                      : isCompleted
                      ? '2px solid #16A34A'
                      : '2px solid var(--border-color)',
                    color: isCurrent || isCompleted ? '#FFFFFF' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '13px',
                    boxShadow: isCurrent ? '0 0 16px var(--primary-glow)' : 'none',
                  }}
                >
                  {isCompleted ? <CheckCircle2 size={18} /> : idx + 1}
                </div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: isCurrent ? 800 : 600,
                    color: isCurrent ? 'var(--primary)' : isCompleted ? 'var(--text-main)' : 'var(--text-muted)',
                    textAlign: 'center',
                  }}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Countdown Estimate */}
        <div
          style={{
            marginTop: '28px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-card-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            fontSize: '13.5px',
            color: 'var(--text-secondary)',
          }}
        >
          ⏱️ Estimated preparation completion: <strong>{activeOrder.readyTimeEstimated || 'in 12 minutes'}</strong>
        </div>
      </div>

      {/* ORDER ITEMS & ADD-ONS AS SEPARATE GROUP (PRD Requirement) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Order Items Breakdown
        </h3>

        {/* Group 1: Original Placed Items */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Original Items (Subtotal: Rs. {activeOrder.originalSubtotal.toLocaleString()})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {regularItems.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>
                    {item.name} × {item.quantity}
                  </div>
                  {item.extras && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Extras: {item.extras.join(', ')}</div>}
                </div>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>
                  Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Group 2: Add-on Items Group (PRD Requirement) */}
        {addOnItems.length > 0 && (
          <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                STAGE 2 ADD-ONS
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                (Subtotal: Rs. {activeOrder.addOnSubtotal.toLocaleString()})
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {addOnItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary-light)',
                    border: '1px solid var(--primary)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--primary)' }}>
                    ✨ {item.name} × {item.quantity} (Add-on)
                  </div>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary)' }}>
                    + Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total Summary */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Amount Due at Cafe</div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--primary)' }}>
              Rs. {activeOrder.total.toLocaleString()}
            </div>
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--pay-unpaid-text)', backgroundColor: 'var(--pay-unpaid-bg)', padding: '6px 12px', borderRadius: 'var(--radius-md)' }}>
            💵 Cash Payment
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS (Enable/Disable based on Stage) */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          disabled={isLocked}
          onClick={() => onNavigate('order-edit')}
          style={{
            flex: 1,
            padding: '13px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: isLocked ? 'var(--bg-card-subtle)' : 'var(--primary)',
            color: isLocked ? 'var(--text-muted)' : '#FFFFFF',
            fontWeight: 700,
            fontSize: '14px',
            cursor: isLocked ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Edit3 size={17} />
          <span>
            {canFullEdit
              ? 'Edit Order (Stage 1 Full Edit)'
              : canAddOns
              ? 'Add-ons Only (Stage 2 Edit)'
              : 'Editing Closed / Locked'}
          </span>
        </button>

        <button
          disabled={isLocked || activeOrder.status === 'preparing'}
          onClick={() => setCancelModalOpen(true)}
          style={{
            padding: '13px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid #DC2626',
            color: isLocked || activeOrder.status === 'preparing' ? 'var(--text-muted)' : '#DC2626',
            fontWeight: 700,
            fontSize: '14px',
            cursor: isLocked || activeOrder.status === 'preparing' ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <XCircle size={17} />
          <span>Cancel Order</span>
        </button>

        <button
          onClick={() => onNavigate('support')}
          style={{
            padding: '13px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Phone size={17} color="var(--primary)" />
          <span>Contact Branch</span>
        </button>
      </div>

      {/* Cancel Order Yes/No Popup */}
      <ModalConfirmation
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={() => cancelOrder(activeOrder.id, cancelReason)}
        title="Cancel This Order?"
        message="Are you sure you want to cancel your order before kitchen preparation begins? This action cannot be undone."
        details={`Order #${activeOrder.orderNumber} · Subtotal: Rs. ${activeOrder.total.toLocaleString()}`}
        confirmText="Yes, cancel order"
        cancelText="No, keep order"
        isDanger={true}
      />
    </div>
  );
};
