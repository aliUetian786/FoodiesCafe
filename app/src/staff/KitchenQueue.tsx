'use client';

import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, normalizeBranchId } from '@/types/cafe';
import {
  ChefHat,
  CheckCircle,
  Utensils,
  ShoppingBag,
  Bike,
  Eye,
} from 'lucide-react';

export const KitchenQueueScreen: React.FC = () => {
  const { orders, updateOrderStatus, currentBranch, footerSettings, currentRole, currentUser, addToast } = useApp();

  const isManager =
    currentRole === 'branch_manager' ||
    currentUser?.role === 'branch_manager' ||
    currentRole === 'platform_owner' ||
    currentUser?.role === 'platform_owner';

  // Live timer tick for accurate forwardToKitchenAt countdown transitions in kitchen queue
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setTick((t) => (t + 1) % 10000), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter orders strictly for current branch and categorize only into Arrived & Ready to Serve
  const { arrivedOrders, readyToServeOrders } = useMemo(() => {
    const isOrderDispatchedToKitchen = (o: Order) => {
      if (o.sentToKitchen) return true;
      if (o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready' || o.status === 'served') return true;
      if (o.forwardToKitchenAt && Date.now() >= new Date(o.forwardToKitchenAt).getTime()) return true;
      return false;
    };

    const arrived: Order[] = [];
    const readyToServe: Order[] = [];
    const branchId = currentBranch.id;

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (o.branchId && normalizeBranchId(o.branchId) !== normalizeBranchId(branchId)) continue;
      if (
        o.status === 'cancelled' ||
        o.status === 'completed' ||
        o.status === 'delivered' ||
        o.status === 'served' ||
        o.status === 'taken'
      ) continue;

      if (o.status === 'ready') {
        readyToServe.push(o);
      } else if (o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing') {
        if (isOrderDispatchedToKitchen(o)) {
          arrived.push(o);
        }
      }
    }

    return {
      arrivedOrders: arrived,
      readyToServeOrders: readyToServe,
    };
  }, [orders, currentBranch.id, footerSettings?.orderRoutingSupportFirst, tick]);

  const handleMarkOrderReceived = (orderId: string) => {
    if (isManager) {
      addToast({
        type: 'warning',
        title: 'Monitor Mode Only',
        message: 'Managers have view-only access. Only Kitchen Staff can receive orders.',
      });
      return;
    }
    const ord = orders.find((o) => o.id === orderId);
    updateOrderStatus(orderId, 'preparing', undefined, {
      type: 'info',
      title: 'Order Received ✓',
      message: `Order #${ord?.orderNumber || ''} marked as received in kitchen.`,
    });
  };

  const handleMarkOrderReady = (orderId: string) => {
    if (isManager) {
      addToast({
        type: 'warning',
        title: 'Monitor Mode Only',
        message: 'Managers cannot mark orders as ready. Only Kitchen Staff can take kitchen actions.',
      });
      return;
    }
    const ord = orders.find((o) => o.id === orderId);
    updateOrderStatus(orderId, 'ready', undefined, {
      type: 'success',
      title: 'Order Ready to Serve 🍽️',
      message: `Order #${ord?.orderNumber || ''} marked as ready to serve!`,
    });
  };

  const renderTicketCard = (ord: Order, isReadyToServeView = false) => {
    const isReceived = ord.status === 'preparing';

    return (
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
        {/* Ticket Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: 'var(--primary)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {ord.type === 'dine_in' ? (
                  <>
                    <Utensils size={13} />
                    <span>DINE-IN · TABLE {ord.tableNumber || '?'}</span>
                  </>
                ) : ord.type === 'takeaway' ? (
                  <>
                    <ShoppingBag size={13} />
                    <span>TAKEAWAY COUNTER</span>
                  </>
                ) : (
                  <>
                    <Bike size={13} />
                    <span>HOME DELIVERY</span>
                  </>
                )}
              </span>
            </div>
            <h4 style={{ fontSize: '18px', fontWeight: 850, margin: '3px 0 0', color: 'var(--text-main)' }}>
              Ticket #{ord.orderNumber}
            </h4>
          </div>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
            {ord.createdAt}
          </span>
        </div>

        {/* Customer & Address Details */}
        {(ord.customerName || ord.customerPhone || ord.deliveryAddress) && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {ord.customerName && (
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                {ord.customerName}
              </span>
            )}
            {ord.customerPhone && (
              <span> • {ord.customerPhone}</span>
            )}
            {ord.deliveryAddress && (
              <div style={{ marginTop: '2px', color: 'var(--text-muted)' }}>
                📍 {ord.deliveryAddress}
              </div>
            )}
          </div>
        )}

        {/* Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
          {ord.items.map((item) => (
            <div key={item.id} style={{ padding: '3px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 750, fontSize: '14px', color: 'var(--text-main)' }}>
                  {item.quantity} × {item.name}
                </div>
                {item.isAddOn && (
                  <span style={{ fontSize: '10px', fontWeight: 800, backgroundColor: 'var(--primary)', color: '#FFFFFF', padding: '1px 6px', borderRadius: '4px' }}>
                    ADD-ON
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

        {/* Order Notes */}
        {ord.notes && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card-subtle)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <strong>Special Note:</strong> {ord.notes}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {!isReadyToServeView ? (
            !isReceived ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#D97706', backgroundColor: '#FEF3C7', padding: '2px 8px', borderRadius: '4px' }}>
                    {isManager ? 'ORDER ARRIVED · QUEUED' : 'ORDER ARRIVED'}
                  </span>
                </div>
                {isManager ? (
                  <div
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px',
                      color: 'var(--text-muted)',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    <Eye size={15} />
                    <span>Order Preparation Monitor · View Only</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleMarkOrderReceived(ord.id)}
                    style={{
                      width: '100%',
                      padding: '11px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)',
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <CheckCircle size={16} />
                    <span>Mark Order Received</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563EB', backgroundColor: '#DBEAFE', padding: '2px 8px', borderRadius: '4px' }}>
                    {isManager ? '🍳 IN PREPARATION · COOKING' : 'ORDER RECEIVED'}
                  </span>
                </div>
                {isManager ? (
                  <div
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '7px',
                      color: 'var(--primary)',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    <Eye size={15} />
                    <span>Order Preparation in Progress · View Only</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleMarkOrderReady(ord.id)}
                    style={{
                      width: '100%',
                      padding: '11px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      border: 'none',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                      transition: 'opacity 0.15s ease',
                    }}
                  >
                    <CheckCircle size={16} />
                    <span>Mark Order Ready</span>
                  </button>
                )}
              </>
            )
          ) : (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#DCFCE7',
                border: '1.5px solid #86EFAC',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                color: '#166534',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 850, fontSize: '13px' }}>
                <CheckCircle size={16} color="#16A34A" />
                <span>Order Ready to Serve</span>
              </div>
              <span style={{ fontSize: '11px', color: '#15803D', fontWeight: 600 }}>
                {ord.type === 'dine_in'
                  ? 'Ready for server to deliver to table'
                  : ord.type === 'takeaway'
                  ? 'Ready at counter for customer pickup'
                  : 'Ready for rider pickup'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Clean Kitchen Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChefHat size={24} color="var(--primary)" />
          </div>
          <div>
            <h1 style={{ fontSize: 'clamp(20px, 4vw, 26px)', fontWeight: 850, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              {isManager ? 'Kitchen Monitor' : 'Kitchen Queue'}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Branch: <strong>{currentBranch.name}</strong> · {isManager ? 'Live Order Preparation (View Only)' : 'Live Order Arrived & Marked Ready'}
            </p>
          </div>
        </div>
      </div>

      {/* 2 Clear Sections: Order Arrived & Order Ready to Serve */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
          gap: '20px',
          alignItems: 'start',
        }}
      >
        {/* SECTION 1: ORDER ARRIVED */}
        <div
          style={{
            backgroundColor: 'var(--bg-card-subtle)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid var(--border-color)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 850, textTransform: 'uppercase', color: 'var(--text-main)', letterSpacing: '0.02em' }}>
              {isManager ? 'Order Preparation' : 'Order Arrived'}
            </span>
            <span
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                padding: '2px 9px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
              }}
            >
              {arrivedOrders.length}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {arrivedOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                {isManager ? 'No orders in preparation at the moment' : 'No orders arrived at the moment'}
              </div>
            ) : (
              arrivedOrders.map((ord) => renderTicketCard(ord, false))
            )}
          </div>
        </div>

        {/* SECTION 2: ORDER READY TO SERVE */}
        <div
          style={{
            backgroundColor: 'var(--bg-card-subtle)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid var(--border-color)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 850, textTransform: 'uppercase', color: '#15803D', letterSpacing: '0.02em' }}>
              {isManager ? 'Ready to Serve' : 'Marked Ready'}
            </span>
            <span
              style={{
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                padding: '2px 9px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
              }}
            >
              {readyToServeOrders.length}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {readyToServeOrders.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No orders ready to serve right now
              </div>
            ) : (
              readyToServeOrders.map((ord) => renderTicketCard(ord, true))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
