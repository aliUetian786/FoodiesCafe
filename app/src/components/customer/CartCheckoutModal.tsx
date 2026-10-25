'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Utensils,
  ShoppingBag,
  Truck,
  Clock,
  MapPin,
  Banknote,
  AlertCircle,
  QrCode,
  ArrowRight,
} from 'lucide-react';

interface CartCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

export const CartCheckoutModal: React.FC<CartCheckoutModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const {
    cart,
    updateCartItemQty,
    removeFromCart,
    placeOrder,
    currentBranch,
    tables,
    currentBranchId,
  } = useApp();

  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [selectedTable, setSelectedTable] = useState('T-01');
  const [pickupTimeOption, setPickupTimeOption] = useState('asap');
  const [scheduledTime, setScheduledTime] = useState('30 mins from now');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  if (!isOpen) return null;

  const subtotal = cart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  const tax = 0; // Tax included
  const total = subtotal + tax;

  const branchTables = tables.filter((t) => t.branchId === currentBranchId);

  const handlePlaceOrderClick = () => {
    if (cart.length === 0) return;
    setIsConfirmOpen(true);
  };

  const handleConfirmedOrder = () => {
    const tablePin = branchTables.find((t) => t.number === selectedTable)?.pin;
    const pickupTimeStr = pickupTimeOption === 'asap' ? 'As soon as ready' : scheduledTime;

    const newOrder = placeOrder(
      orderType,
      orderType === 'dine_in' ? selectedTable : undefined,
      orderType === 'dine_in' ? tablePin : undefined,
      orderType === 'takeaway' ? pickupTimeStr : undefined
    );

    setIsConfirmOpen(false);
    onClose();
    onNavigate('order-tracking');
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9500,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'flex-end',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            width: '100%',
            maxWidth: '480px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-xl)',
            borderLeft: '1px solid var(--border-color)',
            overflowY: 'auto',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              backgroundColor: 'var(--bg-card)',
              zIndex: 10,
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Cart
            </h3>

            <button
              onClick={onClose}
              style={{
                padding: '6px',
                borderRadius: '8px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Cart Items List */}
          <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <ShoppingBag size={48} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <h4 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                  Your Cart is Empty
                </h4>
                <p style={{ fontSize: '13px', marginTop: '4px' }}>
                  Add your favorite biryanis, karahis and sides to proceed.
                </p>
                <button
                  onClick={() => {
                    onClose();
                    onNavigate('menu');
                  }}
                  style={{
                    marginTop: '16px',
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontWeight: 700,
                  }}
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>
                            {item.name}
                          </div>
                          {item.size && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Portion: {item.size}
                            </div>
                          )}
                          {item.extras && item.extras.length > 0 && (
                            <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                              Extras: {item.extras.join(', ')}
                            </div>
                          )}
                          {item.instructions && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                              &ldquo;{item.instructions}&rdquo;
                            </div>
                          )}
                        </div>

                        <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>
                          Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                        </span>
                      </div>

                      {/* Quantity Stepper & Remove */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-full)',
                            padding: '4px 10px',
                          }}
                        >
                          <button
                            onClick={() => updateCartItemQty(item.id, -1)}
                            style={{ color: item.quantity === 1 ? '#DC2626' : 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title={item.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}
                          >
                            {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={14} />}
                          </button>
                          <span style={{ fontSize: '13px', fontWeight: 800, minWidth: '16px', textAlign: 'center' }}>
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartItemQty(item.id, 1)}
                            style={{ color: 'var(--text-main)', cursor: 'pointer' }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={{
                            color: '#DC2626',
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ORDER TYPE SELECTOR */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <label style={{ fontSize: '12.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                    Select Order Type
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <button
                      onClick={() => setOrderType('dine_in')}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: orderType === 'dine_in' ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                        border: orderType === 'dine_in' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        color: orderType === 'dine_in' ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <Utensils size={18} />
                      <span>Dine-in</span>
                    </button>

                    <button
                      onClick={() => setOrderType('takeaway')}
                      style={{
                        padding: '10px 6px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: orderType === 'takeaway' ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                        border: orderType === 'takeaway' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        color: orderType === 'takeaway' ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      <ShoppingBag size={18} />
                      <span>Takeaway</span>
                    </button>

                    <button
                      disabled
                      style={{
                        padding: '10px 6px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px dashed var(--border-color)',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '11px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: 0.6,
                        cursor: 'not-allowed',
                      }}
                    >
                      <Truck size={18} />
                      <span>Delivery</span>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--primary)' }}>
                        Coming Soon
                      </span>
                    </button>
                  </div>
                </div>

                {/* Dine-in Table Selection */}
                {orderType === 'dine_in' && (
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                        Choose Table at Cafe:
                      </span>
                      <button
                        onClick={() => {
                          onClose();
                          onNavigate('table-qr');
                        }}
                        style={{ fontSize: '11.5px', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <QrCode size={13} />
                        <span>Visual Grid / Scan QR</span>
                      </button>
                    </div>

                    <select
                      value={selectedTable}
                      onChange={(e) => setSelectedTable(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '13.5px',
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    >
                      {branchTables.map((t) => (
                        <option key={t.id} value={t.number} disabled={t.status === 'occupied' || t.status === 'unavailable'}>
                          {t.number} — Capacity {t.capacity} ({t.status.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Takeaway Time Options */}
                {orderType === 'takeaway' && (
                  <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                      Pickup Scheduling:
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={pickupTimeOption === 'asap'}
                        onChange={() => setPickupTimeOption('asap')}
                      />
                      <span>As soon as ready (approx {currentBranch.prepTimeEstimateMin} mins)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={pickupTimeOption === 'custom'}
                        onChange={() => setPickupTimeOption('custom')}
                      />
                      <span>Pick a specific pickup time today</span>
                    </label>
                  </div>
                )}

                {/* Order Summary & Cash-Only Notice */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                    <span>Subtotal</span>
                    <span>Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                    <span>Sales Tax</span>
                    <span>Rs. 0 (Included)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                    <span>Total Due</span>
                    <span style={{ color: 'var(--primary)' }}>Rs. {total.toLocaleString()}</span>
                  </div>

                  {/* Cash Notice (Mandatory Requirement) */}
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '10px 14px',
                      backgroundColor: 'var(--pay-unpaid-bg)',
                      color: 'var(--pay-unpaid-text)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Banknote size={17} />
                    <span>Pay cash at the cafe — no card or online payment required.</span>
                  </div>
                </div>

                {/* Place Order Button */}
                <button
                  onClick={handlePlaceOrderClick}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: 800,
                    boxShadow: '0 4px 16px var(--primary-glow)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '8px',
                  }}
                >
                  <span>Place Order — Rs. {total.toLocaleString()}</span>
                  <ArrowRight size={18} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Yes/No Confirmation Popup (PRD Section F16) */}
      <ModalConfirmation
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmedOrder}
        title="Submit New Order?"
        message={`Are you sure you want to send your order to the ${currentBranch.name} kitchen?`}
        details={`Order Type: ${orderType.toUpperCase()} ${orderType === 'dine_in' ? `(Table ${selectedTable})` : ''} · Total: Rs. ${total.toLocaleString()} (Cash only)`}
        confirmText="Yes, place order"
        cancelText="No, go back"
      />
    </>
  );
};
