'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Order } from '@/types/cafe';
import {
  RotateCcw,
  Receipt,
  FileText,
  AlertCircle,
  Clock,
  MapPin,
  Banknote,
  Printer,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';

export const OrderHistoryScreen: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const { orders, addToCart, addToast } = useApp();
  const [selectedOrder, setSelectedOrder] = useState<Order>(orders[0]);

  const handleReorder = (order: Order) => {
    order.items.forEach((item) => {
      addToCart({ ...item, id: `oi-${Date.now()}-${Math.random()}` });
    });
    addToast({
      type: 'success',
      title: 'Items Re-added to Cart',
      message: `${order.items.length} dishes from Order #${order.orderNumber} added to your cart.`,
    });
    onNavigate('menu');
  };

  return (
    <div style={{ maxWidth: '1080px', margin: '24px auto 80px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Order History & Itemized Receipts
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Historical price snapshots are permanently preserved. Cash-only receipts.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'flex-start' }}>
        {/* Left: Orders List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {orders.map((ord) => {
            const isSelected = selectedOrder?.id === ord.id;
            return (
              <div
                key={ord.id}
                onClick={() => setSelectedOrder(ord)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  padding: '18px',
                  boxShadow: isSelected ? '0 4px 16px var(--primary-glow)' : 'var(--shadow-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>
                    Order #{ord.orderNumber}
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--status-preparing-bg)',
                      color: 'var(--status-preparing-text)',
                    }}
                  >
                    {ord.status}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {ord.createdAt} · {ord.type.toUpperCase()} {ord.tableNumber ? `(Table ${ord.tableNumber})` : ''}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--primary)' }}>
                    Rs. {ord.total.toLocaleString()}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReorder(ord);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCcw size={13} color="var(--primary)" />
                    <span>Reorder</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Itemized Printable Receipt */}
        {selectedOrder && (
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '28px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Receipt Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed var(--border-color)', paddingBottom: '16px' }}>
              <div style={{ fontWeight: 800, fontSize: '20px', fontFamily: 'Outfit' }}>
                Foodies<span style={{ color: 'var(--primary)' }}>Cafe</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Customer Cash Receipt · Tax Invoice
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '8px' }}>
                Order #{selectedOrder.orderNumber}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {selectedOrder.createdAt} · Cash Only
              </div>
            </div>

            {/* Itemized Table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedOrder.items.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                  <div>
                    <span style={{ fontWeight: 700 }}>{i.name}</span> × {i.quantity}
                    {i.isAddOn && (
                      <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 800, marginLeft: '6px' }}>
                        (ADD-ON)
                      </span>
                    )}
                  </div>
                  <span style={{ fontWeight: 700 }}>
                    Rs. {(i.unitPrice * i.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Subtotal</span>
                <span>Rs. {selectedOrder.originalSubtotal.toLocaleString()}</span>
              </div>
              {selectedOrder.addOnSubtotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--primary)', fontWeight: 700 }}>
                  <span>Add-ons Subtotal</span>
                  <span>Rs. {selectedOrder.addOnSubtotal.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 800, marginTop: '4px' }}>
                <span>Total Amount Paid</span>
                <span style={{ color: 'var(--primary)' }}>Rs. {selectedOrder.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Cash Badge & Problem link */}
            <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                <Banknote size={16} color="var(--primary)" />
                <span>Payment Method: CASH</span>
              </div>
              <span style={{ color: '#16A34A', fontWeight: 800 }}>✓ Settled</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
              <button
                onClick={() => window.print()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Printer size={15} />
                <span>Print Receipt</span>
              </button>

              <button
                onClick={() => onNavigate('support')}
                style={{
                  color: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Report a problem with this order
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
