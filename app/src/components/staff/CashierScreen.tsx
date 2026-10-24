'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, PaymentStatus } from '@/types/cafe';
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
    menuItems,
    placeOrder,
    addToCart,
    cart,
    addToast,
  } = useApp();

  const [paymentFilter, setPaymentFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  
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

  // Walk-in order drawer
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInItem, setWalkInItem] = useState(menuItems[0]?.id || 'm1');

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  const filteredOrders = orders.filter((o) => {
    if (paymentFilter === 'all') return true;
    return o.paymentStatus === paymentFilter;
  });

  const handleRecordPayment = () => {
    if (!selectedOrder) return;
    const tendered = parseFloat(cashTendered) || selectedOrder.total;
    const res = recordCashPayment(selectedOrder.id, tendered);
    setCalculatedChange(res.change);
    setPaymentConfirmOpen(false);
  };

  const handleCreateWalkIn = () => {
    const item = menuItems.find((m) => m.id === walkInItem) || menuItems[0];
    const walkInItemObj = {
      id: `oi-${Date.now()}`,
      menuItemId: item.id,
      name: item.name,
      unitPrice: item.basePrice,
      quantity: 1,
      isAddOn: false,
    };
    placeOrder('takeaway', undefined, undefined, 'Immediate walk-in counter collection', undefined, 'Cash', [walkInItemObj]);
    setShowWalkInModal(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Shift Quick Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Cashier Desk
          </h1>
        </div>

        {/* Shift Control Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowWalkInModal(true)}
            style={{
              padding: '9px 16px',
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
            }}
          >
            <PlusCircle size={16} color="var(--primary)" />
            <span>Walk-in Order</span>
          </button>

          {currentShift ? (
            <button
              onClick={() => setCloseShiftModal(true)}
              style={{
                padding: '9px 16px',
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
                padding: '9px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Open Cash Shift
            </button>
          )}
        </div>
      </div>

      {/* SHIFT PANEL SUMMARY (PRD Requirement) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '18px 24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
        }}
      >
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Shift Status:</span>
          <div style={{ fontSize: '17px', fontWeight: 800, color: currentShift ? '#16A34A' : '#DC2626', marginTop: '2px' }}>
            {currentShift ? '🟢 ACTIVE SHIFT OPEN' : '🔴 SHIFT CLOSED'}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Opening Float (Cash In Till):</span>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
            Rs. {(currentShift?.openingFloat || 0).toLocaleString()}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Cash Collected Today:</span>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
            Rs. {(currentShift?.cashCollected || 0).toLocaleString()}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Expected Till Total:</span>
          <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
            Rs. {(currentShift?.expectedCash || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* ORDERS DESK & PAYMENT WORKSTATION */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
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
            }}
          >
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

                {/* Change Due Display */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>Change Due to Customer:</span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: '#16A34A' }}>
                    Rs. {Math.max(0, (parseFloat(cashTendered) || 0) - selectedOrder.total).toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => setPaymentConfirmOpen(true)}
                  style={{
                    padding: '13px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontSize: '14.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                  }}
                >
                  <Banknote size={18} />
                  <span>Record Cash Payment (Rs. {selectedOrder.total.toLocaleString()})</span>
                </button>
              </div>
            )}

            {/* Actions: Print Receipt & Request Refund */}
            <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
              <button
                onClick={() => window.print()}
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
        )}
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

      {/* Walk-in Modal */}
      {showWalkInModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', maxWidth: '440px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Create Walk-in Counter Order</h3>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>Select Dish</label>
              <select
                value={walkInItem}
                onChange={(e) => setWalkInItem(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
              >
                {menuItems.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} (Rs. {m.basePrice})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setShowWalkInModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-card-subtle)' }}>
                Cancel
              </button>
              <button onClick={handleCreateWalkIn} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#FFFFFF', fontWeight: 700 }}>
                Place Walk-in
              </button>
            </div>
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
