'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, OrderStatus } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  ChefHat,
  Clock,
  Printer,
  CheckCircle,
  AlertOctagon,
  Flame,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const KitchenQueueScreen: React.FC = () => {
  const { orders, updateOrderStatus, currentBranch, toggleMenuItemBranchAvailability, menuItems, addToast } = useApp();

  const [confirmReadyOrderId, setConfirmReadyOrderId] = useState<string | null>(null);
  const [unavailableModalOpen, setUnavailableModalOpen] = useState(false);
  const [selectedUnavailableItemId, setSelectedUnavailableItemId] = useState(menuItems[0]?.id || 'm1');

  const branchOrders = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'completed');

  const incomingOrders = branchOrders.filter((o) => o.status === 'placed' || o.status === 'accepted');
  const preparingOrders = branchOrders.filter((o) => o.status === 'preparing');
  const readyOrders = branchOrders.filter((o) => o.status === 'ready');

  const handleStartPreparing = (orderId: string) => {
    updateOrderStatus(orderId, 'preparing');
  };

  const handleMarkReadyConfirm = () => {
    if (!confirmReadyOrderId) return;
    updateOrderStatus(confirmReadyOrderId, 'ready');
    setConfirmReadyOrderId(null);
  };

  const handleReportUnavailable = () => {
    toggleMenuItemBranchAvailability(selectedUnavailableItemId, currentBranch.id);
    const item = menuItems.find((m) => m.id === selectedUnavailableItemId);
    addToast({
      type: 'warning',
      title: 'Kitchen Flagged Item Unavailable',
      message: `${item?.name} marked out of stock in this branch.`,
    });
    setUnavailableModalOpen(false);
  };

  const renderTicket = (ord: Order) => (
    <div
      key={ord.id}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.04em' }}>
            {ord.type === 'dine_in' ? `DINE-IN · TABLE ${ord.tableNumber || '?'}` : 'TAKEAWAY COUNTER'}
          </span>
          <h4 style={{ fontSize: '18px', fontWeight: 800, margin: '2px 0 0', color: 'var(--text-main)' }}>
            Ticket #{ord.orderNumber}
          </h4>
        </div>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
          {ord.createdAt}
        </span>
      </div>

      {/* Items list with NEW ADD-ON highlighted (PRD Requirement) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
        {ord.items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: item.isAddOn ? '8px 10px' : '4px 0',
              borderRadius: item.isAddOn ? '6px' : '0',
              backgroundColor: item.isAddOn ? 'var(--primary-light)' : 'transparent',
              border: item.isAddOn ? '1px solid var(--primary)' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: item.isAddOn ? 'var(--primary)' : 'var(--text-main)' }}>
                {item.quantity} × {item.name}
              </div>
              {item.isAddOn && (
                <span style={{ fontSize: '10px', fontWeight: 800, backgroundColor: 'var(--primary)', color: '#FFFFFF', padding: '2px 6px', borderRadius: '4px' }}>
                  NEW ADD-ON
                </span>
              )}
            </div>

            {item.size && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Portion: {item.size}
              </div>
            )}
            {item.extras && item.extras.length > 0 && (
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                + {item.extras.join(', ')}
              </div>
            )}
            {item.instructions && (
              <div style={{ fontSize: '12px', color: '#EA580C', fontWeight: 600, fontStyle: 'italic', marginTop: '2px' }}>
                Note: &ldquo;{item.instructions}&rdquo;
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons for Kitchen */}
      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
        {ord.status === 'placed' || ord.status === 'accepted' ? (
          <button
            onClick={() => handleStartPreparing(ord.id)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <Flame size={16} />
            <span>Start Preparing</span>
          </button>
        ) : ord.status === 'preparing' ? (
          <button
            onClick={() => setConfirmReadyOrderId(ord.id)}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#16A34A',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle size={16} />
            <span>Mark Ready</span>
          </button>
        ) : (
          <div style={{ flex: 1, textAlign: 'center', color: '#16A34A', fontWeight: 800, fontSize: '13px' }}>
            ✓ Ready for Service
          </div>
        )}

        <button
          onClick={() => window.print()}
          title="Print Kitchen KOT Ticket"
          style={{
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <Printer size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Kitchen Top Bar & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Live Kitchen Queue Board
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Role: <strong>kitchen_staff</strong> · No customer PII, no pricing/cash or refund controls shown per security rules.
          </p>
        </div>

        <button
          onClick={() => setUnavailableModalOpen(true)}
          style={{
            padding: '10px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--status-cancelled-bg)',
            color: 'var(--status-cancelled-text)',
            border: '1px solid var(--status-cancelled-text)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <AlertOctagon size={16} />
          <span>Report Item Unavailable</span>
        </button>
      </div>

      {/* 3-COLUMN KANBAN QUEUE */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Incoming Column */}
        <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-main)' }}>
              1. Incoming Orders
            </span>
            <span style={{ backgroundColor: 'var(--primary)', color: '#FFFFFF', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 }}>
              {incomingOrders.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {incomingOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No incoming tickets
              </div>
            ) : (
              incomingOrders.map(renderTicket)
            )}
          </div>
        </div>

        {/* Preparing Column */}
        <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: '#C2410C' }}>
              2. Now Preparing
            </span>
            <span style={{ backgroundColor: '#EA580C', color: '#FFFFFF', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 }}>
              {preparingOrders.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {preparingOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Kitchen clear
              </div>
            ) : (
              preparingOrders.map(renderTicket)
            )}
          </div>
        </div>

        {/* Ready Column */}
        <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: '#15803D' }}>
              3. Ready for Service
            </span>
            <span style={{ backgroundColor: '#16A34A', color: '#FFFFFF', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 800 }}>
              {readyOrders.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {readyOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No tickets waiting
              </div>
            ) : (
              readyOrders.map(renderTicket)
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Popup before Marking Ready (PRD Section F16) */}
      <ModalConfirmation
        isOpen={!!confirmReadyOrderId}
        onClose={() => setConfirmReadyOrderId(null)}
        onConfirm={handleMarkReadyConfirm}
        title="Mark Order Ready for Service?"
        message="This will notify the floor staff / counter cashier and trigger the customer 'Ready' notification."
        confirmText="Yes, food is ready"
        cancelText="No, go back"
      />

      {/* Report Item Unavailable Modal */}
      {unavailableModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Report Out-of-Stock Item</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Kitchen ran out of ingredients? Toggling will gray out this dish immediately across the customer menu for {currentBranch.name}.
            </p>
            <select
              value={selectedUnavailableItemId}
              onChange={(e) => setSelectedUnavailableItemId(e.target.value)}
              style={{ padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13.5px' }}
            >
              {menuItems.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setUnavailableModalOpen(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-card-subtle)' }}>
                Cancel
              </button>
              <button onClick={handleReportUnavailable} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: '#DC2626', color: '#FFFFFF', fontWeight: 700 }}>
                Confirm Unavailable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
