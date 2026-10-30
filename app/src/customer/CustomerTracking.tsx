'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { OrderStatus, Order } from '@/types/cafe';
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
  ShoppingBag,
  Truck,
  ChevronRight,
  Receipt,
  Layers,
  KeyRound,
  Check,
} from 'lucide-react';

interface OrderTrackingScreenProps {
  onNavigate: (view: string) => void;
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({ onNavigate }) => {
  const { orders, currentBranch, currentUser, cancelOrder } = useApp();

  // Find customer's relevant orders with multi-source fallback
  const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
  const cleanPhone = normalizePhone(currentUser?.phone);

  const customerOrders = React.useMemo(() => {
    let localPlacedIds: string[] = [];
    let localCachedOrders: Order[] = [];
    if (typeof window !== 'undefined') {
      try {
        localPlacedIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
        localCachedOrders = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
      } catch (e) {}
    }

    const pool = [...orders];
    localCachedOrders.forEach((co) => {
      if (!pool.some((o) => o.id === co.id || o.orderNumber === co.orderNumber)) {
        pool.push(co);
      }
    });

    return pool.filter((o) => {
      // 1. Placed on this device/browser
      if (localPlacedIds.includes(o.id) || localPlacedIds.includes(o.orderNumber)) return true;
      // 2. Phone match
      if (cleanPhone && normalizePhone(o.customerPhone) === cleanPhone) return true;
      // 3. Customer ID match
      if (currentUser?.id && currentUser.id !== 'user-guest' && o.customerId === currentUser.id) return true;
      // 4. Email match
      if (currentUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === currentUser.email.toLowerCase()) return true;
      // 5. Customer name match if authenticated
      if (currentUser?.name && currentUser.name !== 'Guest Customer' && o.customerName === currentUser.name) return true;
      return false;
    });
  }, [orders, cleanPhone, currentUser]);

  const relevantOrders = customerOrders;

  // Current active orders (not cancelled, prioritized by not completed)
  const currentOrders = relevantOrders
    .filter((o) => o.status !== 'cancelled')
    .sort((a, b) => {
      const aActive = a.status !== 'completed' ? 1 : 0;
      const bActive = b.status !== 'completed' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    currentOrders[0]?.id || ''
  );

  // Keep selectedOrderId valid if orders update
  useEffect(() => {
    if (currentOrders.length > 0) {
      if (!currentOrders.some((o) => o.id === selectedOrderId)) {
        setSelectedOrderId(currentOrders[0].id);
      }
    }
  }, [currentOrders, selectedOrderId]);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cannotCancelModalOpen, setCannotCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of plans');

  const activeOrder = currentOrders.find((o) => o.id === selectedOrderId) || currentOrders[0];

  if (!activeOrder) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)' }}>No Active Orders Found</h2>
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
            cursor: 'pointer',
            border: 'none',
            boxShadow: '0 4px 14px var(--primary-glow)',
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
      case 'served':
        return 3;
      case 'completed':
        return 4;
      default:
        return 0;
    }
  };

  const currentStepIdx = getStepIndex(activeOrder.status);
  const isCancelled = activeOrder.status === 'cancelled';

  // Manager-selectable flexible window (in minutes) from branch settings
  const flexibleWindowMin = currentBranch.fullEditWindowMin || 15;
  const createdAtTime = new Date(activeOrder.createdAt).getTime();
  const elapsedMinutes = !isNaN(createdAtTime) ? (Date.now() - createdAtTime) / (1000 * 60) : 0;
  const isWithinFlexibleWindow = elapsedMinutes <= flexibleWindowMin;

  // Active status checks
  const isEditable = (activeOrder.status === 'placed' || activeOrder.status === 'accepted') && isWithinFlexibleWindow;

  // Separate regular items and add-ons
  const regularItems = activeOrder.items.filter((i) => !i.isAddOn && i.addedAtStage !== 'stage2');
  const addOnItems = activeOrder.items.filter((i) => i.isAddOn || i.addedAtStage === 'stage2');
  const isUpdatedOrder = (activeOrder.version && activeOrder.version > 1) || addOnItems.length > 0;

  const renderStatusBadge = (status: OrderStatus) => {
    let bg = 'var(--status-preparing-bg)';
    let text = 'var(--status-preparing-text)';
    let label = status.toUpperCase();

    if (status === 'placed') {
      bg = '#FEF3C7';
      text = '#92400E';
      label = 'PLACED';
    } else if (status === 'accepted') {
      bg = 'var(--primary-light)';
      text = 'var(--primary)';
      label = 'ACCEPTED';
    } else if (status === 'preparing') {
      bg = 'var(--status-preparing-bg)';
      text = 'var(--status-preparing-text)';
      label = 'PREPARING';
    } else if (status === 'ready' || status === 'served') {
      bg = 'var(--status-ready-bg)';
      text = 'var(--status-ready-text)';
      label = status === 'served' ? 'SERVED TO TABLE' : 'READY';
    } else if (status === 'out_for_delivery') {
      bg = '#EFF6FF';
      text = '#1D4ED8';
      label = 'OUT FOR DELIVERY';
    } else if (status === 'completed') {
      bg = '#DCFCE7';
      text = '#15803D';
      label = 'COMPLETED';
    } else if (status === 'cancelled') {
      bg = 'var(--status-cancelled-bg)';
      text = 'var(--status-cancelled-text)';
      label = 'CANCELLED';
    }

    return (
      <span
        style={{
          padding: '4px 10px',
          borderRadius: 'var(--radius-full)',
          fontWeight: 800,
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          backgroundColor: bg,
          color: text,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    );
  };

  const renderFulfillmentIcon = (type: string) => {
    if (type === 'dine_in') return <Utensils size={13} color="var(--primary)" />;
    if (type === 'takeaway') return <ShoppingBag size={13} color="var(--primary)" />;
    return <Truck size={13} color="var(--primary)" />;
  };

  return (
    <>
      <style>{`
        .foodies-tracking-page-container {
          max-width: 1240px;
          margin: 12px auto 20px;
          padding: 0 16px;
          box-sizing: border-box;
          height: calc(100vh - 105px);
          max-height: calc(100vh - 105px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .foodies-tracking-master-card {
          display: grid;
          grid-template-columns: 360px 1fr;
          flex: 1;
          min-height: 0;
          height: 100%;
          border-radius: 24px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-card);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          box-sizing: border-box;
        }

        .foodies-tracking-left-panel {
          border-right: 1px solid var(--border-color);
          background-color: var(--bg-card);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: 100%;
          min-height: 0;
        }

        .foodies-tracking-left-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .foodies-tracking-left-scroll::-webkit-scrollbar,
        .foodies-tracking-right-panel::-webkit-scrollbar {
          width: 6px;
        }
        .foodies-tracking-left-scroll::-webkit-scrollbar-track,
        .foodies-tracking-right-panel::-webkit-scrollbar-track {
          background: transparent;
        }
        .foodies-tracking-left-scroll::-webkit-scrollbar-thumb,
        .foodies-tracking-right-panel::-webkit-scrollbar-thumb {
          background-color: var(--border-color);
          border-radius: 999px;
        }
        .foodies-tracking-left-scroll::-webkit-scrollbar-thumb:hover,
        .foodies-tracking-right-panel::-webkit-scrollbar-thumb:hover {
          background-color: var(--text-muted);
        }

        .foodies-tracking-right-panel {
          flex: 1;
          min-width: 0;
          height: 100%;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          box-sizing: border-box;
        }

        @media (max-width: 900px) {
          .foodies-tracking-page-container {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            margin-bottom: 60px !important;
          }

          .foodies-tracking-master-card {
            grid-template-columns: 1fr;
            height: auto;
            max-height: none;
          }

          .foodies-tracking-left-panel {
            border-right: none;
            border-bottom: 1px solid var(--border-color);
            height: auto;
            max-height: 240px;
          }

          .foodies-tracking-left-scroll {
            flex-direction: row;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 12px;
            gap: 12px;
          }

          .foodies-tracking-order-item-card {
            min-width: 260px;
            max-width: 280px;
            flex-shrink: 0;
          }

          .foodies-tracking-right-panel {
            padding: 20px 16px;
            height: auto;
            overflow-y: visible;
          }
        }
      `}</style>

      <div className="foodies-tracking-page-container">
        {/* Top Header */}
        <div
          style={{
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: 'var(--primary)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Live Order Tracking
            </span>
            <h1
              style={{
                fontSize: 'clamp(22px, 3.5vw, 28px)',
                fontWeight: 850,
                margin: '2px 0 0',
                color: 'var(--text-main)',
                letterSpacing: '-0.02em',
              }}
            >
              Order Status
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => onNavigate('menu')}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              <Utensils size={14} color="var(--primary)" />
              <span>Order More Items</span>
            </button>
          </div>
        </div>

        {/* MASTER COHESIVE CARD CONTAINER (Left: Scrollable Orders Card, Right: Scrollable Detail Card) */}
        <div className="foodies-tracking-master-card">
          {/* LEFT SIDE: SCROLLABLE CURRENT ORDERS CARD */}
          <div className="foodies-tracking-left-panel">
            {/* Left Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 850, color: 'var(--text-main)' }}>
                  Current Orders
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Select an order to view full details
                </div>
              </div>
              <span
                style={{
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  fontWeight: 800,
                  fontSize: '11.5px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                {currentOrders.length} {currentOrders.length === 1 ? 'Order' : 'Orders'}
              </span>
            </div>

            {/* Left Scrollable List of Order Cards */}
            <div className="foodies-tracking-left-scroll">
              {currentOrders.map((ord) => {
                const isSelected = ord.id === activeOrder.id;
                const ordHasAddons = (ord.version && ord.version > 1) || ord.items.some((i) => i.isAddOn);

                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrderId(ord.id)}
                    className="foodies-tracking-order-item-card"
                    style={{
                      position: 'relative',
                      borderRadius: '16px',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                      boxShadow: isSelected ? '0 6px 20px var(--primary-glow)' : 'var(--shadow-sm)',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {/* Cafe Logo Watermark at 135 Degrees */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        pointerEvents: 'none',
                        zIndex: 0,
                      }}
                    >
                      <img
                        src="/logo.png"
                        alt="Logo Watermark"
                        style={{
                          width: '70%',
                          height: '70%',
                          objectFit: 'contain',
                          transform: 'rotate(135deg)',
                          opacity: isSelected ? 0.14 : 0.08,
                          display: 'block',
                        }}
                      />
                    </div>

                    {/* Top Row: Order # and Status Badge */}
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ fontWeight: 850, fontSize: '15px', color: 'var(--text-main)' }}>
                        Order #{ord.orderNumber}
                      </div>
                      {renderStatusBadge(ord.status)}
                    </div>

                    {/* Middle Row: Fulfillment Badge & Updated Pill */}
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 750,
                          backgroundColor: 'var(--bg-card)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        {renderFulfillmentIcon(ord.type)}
                        <span>
                          {ord.type === 'dine_in'
                            ? `Table ${ord.tableNumber || 'Seated'}`
                            : ord.type === 'takeaway'
                            ? 'Takeaway'
                            : 'Delivery'}
                        </span>
                      </span>

                      {ordHasAddons && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            backgroundColor: 'rgba(230, 81, 0, 0.12)',
                            color: 'var(--primary)',
                            padding: '2px 7px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '10.5px',
                          }}
                        >
                          <Sparkles size={11} />
                          Updated Order
                        </span>
                      )}
                    </div>

                    {/* Items snippet */}
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ord.items.length} item(s) · {ord.items.map((i) => i.name).slice(0, 2).join(', ')}
                      {ord.items.length > 2 ? '...' : ''}
                    </div>

                    {/* Bottom Row: Total, Payment status & Arrow */}
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '2px',
                        paddingTop: '6px',
                        borderTop: '1px dashed var(--border-color)',
                      }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: 850, color: 'var(--primary)' }}>
                        Rs. {Number(ord.total).toLocaleString()}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor:
                              ord.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
                            color:
                              ord.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
                          }}
                        >
                          {ord.paymentStatus === 'paid' ? 'PAID' : 'UNPAID CASH'}
                        </span>
                        <ChevronRight
                          size={15}
                          color={isSelected ? 'var(--primary)' : 'var(--text-muted)'}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT SIDE: SCROLLABLE DETAIL CARD (THE WHOLE ORDER DETAIL IN ONE SCROLLABLE CARD) */}
          <div className="foodies-tracking-right-panel">
            {/* Header with Order # and Status */}
            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: '18px',
                border: '1px solid var(--border-color)',
                padding: '20px 22px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 850, margin: 0, color: 'var(--text-main)' }}>
                    Order #{activeOrder.orderNumber}
                  </h2>
                  {isUpdatedOrder && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        backgroundColor: 'var(--primary-light)',
                        border: '1px solid var(--primary)',
                        color: 'var(--primary)',
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        fontWeight: 800,
                      }}
                    >
                      <Sparkles size={12} />
                      UPDATED WITH NEW ITEMS
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {activeOrder.type.toUpperCase()}{' '}
                  {activeOrder.tableNumber ? `· Table ${activeOrder.tableNumber}` : ''} · {currentBranch.name}
                  {activeOrder.createdAt ? ` · ${activeOrder.createdAt}` : ''}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                {renderStatusBadge(activeOrder.status)}
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor:
                      activeOrder.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
                    color:
                      activeOrder.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
                  }}
                >
                  {activeOrder.paymentStatus === 'paid' ? 'PAID (CASH)' : 'UNPAID — PAY CASH AT CAFE'}
                </span>
              </div>
            </div>

            {/* HIGHLIGHTED DYNAMIC NOTIFICATION CARD */}
            {(() => {
              const isAwaitingSupport = activeOrder.status === 'placed' && !activeOrder.sentToKitchen;
              const isPreparing = activeOrder.status === 'preparing';
              const isReady = activeOrder.status === 'ready' || activeOrder.status === 'served';
              const isOut = activeOrder.status === 'out_for_delivery';
              const isComp = activeOrder.status === 'completed';

              let title = 'Your food will be ready in about 10 minutes.';
              let desc = `You can start coming to the cafe or take your seat at Table ${activeOrder.tableNumber || 'counter'}.`;
              let bgColor = 'var(--primary-light)';
              let borderColor = 'var(--primary)';
              let iconBg = 'var(--primary)';
              let titleColor = 'var(--primary)';

              if (isAwaitingSupport) {
                title = 'Order Received · Customer Services Verification';
                desc = 'Customer Services is verifying your order details before queueing it to the kitchen.';
                bgColor = '#FEF3C7';
                borderColor = '#F59E0B';
                iconBg = '#D97706';
                titleColor = '#92400E';
              } else if (isPreparing) {
                title = 'Chefs are Cooking in Kitchen 👨‍🍳';
                desc = `Freshly preparing your dishes at ${currentBranch.name}. Estimated prep completion: ${activeOrder.readyTimeEstimated || 'in 12 mins'}.`;
                bgColor = 'var(--status-preparing-bg)';
                borderColor = 'var(--primary)';
                iconBg = 'var(--primary)';
                titleColor = 'var(--status-preparing-text)';
              } else if (isReady) {
                if (activeOrder.type === 'dine_in') {
                  title = `Food Plated & Ready for Table ${activeOrder.tableNumber || 'Your Table'}! 🍽️`;
                  desc = 'Our floor servers are bringing hot fresh dishes straight to your table.';
                } else if (activeOrder.type === 'takeaway') {
                  title = 'Packed & Ready for Pickup at Counter! 🛍️';
                  desc = `Please show Order #${activeOrder.orderNumber} at the cashier counter to collect your meal.`;
                } else {
                  title = 'Packed & Ready for Rider Dispatch 📦';
                  desc = 'Delivery parcel is sealed and being assigned to delivery driver.';
                }
                bgColor = 'var(--status-ready-bg)';
                borderColor = '#16A34A';
                iconBg = '#16A34A';
                titleColor = 'var(--status-ready-text)';
              } else if (isOut) {
                title = 'Rider is Out for Delivery! 🛵';
                desc = `On the way to ${activeOrder.deliveryAddress || 'your delivery address'}.`;
                bgColor = '#EFF6FF';
                borderColor = '#3B82F6';
                iconBg = '#2563EB';
                titleColor = '#1D4ED8';
              } else if (isComp) {
                title = 'Order Delivered & Completed ✓';
                desc = 'Thank you for dining with FoodiesCafe! We hope you enjoyed your fresh meal.';
                bgColor = 'var(--bg-card-subtle)';
                borderColor = 'var(--border-color)';
                iconBg = '#16A34A';
                titleColor = 'var(--text-main)';
              }

              return (
                <div
                  style={{
                    backgroundColor: bgColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: '16px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    boxShadow: isAwaitingSupport
                      ? '0 6px 20px rgba(245, 158, 11, 0.2)'
                      : '0 6px 20px var(--primary-glow)',
                    animation: 'pulseGlow 3s infinite',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      backgroundColor: iconBg,
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Clock size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: titleColor }}>
                      {title}
                    </div>
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-main)',
                        marginTop: '2px',
                        lineHeight: 1.4,
                      }}
                    >
                      {desc}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* BIG STATUS STEPPER */}
            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: '18px',
                border: '1px solid var(--border-color)',
                padding: '26px 20px 20px',
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
                        width: '74px',
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
                          color: isCurrent
                            ? 'var(--primary)'
                            : isCompleted
                            ? 'var(--text-main)'
                            : 'var(--text-muted)',
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
                  marginTop: '24px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                ⏱️ Estimated preparation completion: <strong>{activeOrder.readyTimeEstimated || 'in 12 minutes'}</strong>
              </div>
            </div>

            {/* FULFILLMENT & SEATING SPECIFICS */}
            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {renderFulfillmentIcon(activeOrder.type)}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>
                    {activeOrder.type === 'dine_in'
                      ? `Dine-In Seating · Table ${activeOrder.tableNumber || 'Selected'}`
                      : activeOrder.type === 'takeaway'
                      ? 'Takeaway Counter Pickup'
                      : 'Home Delivery Address'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {activeOrder.type === 'dine_in'
                      ? `Table PIN: ${activeOrder.tablePin || 'Verified'} · Dine comfortably at cafe`
                      : activeOrder.type === 'takeaway'
                      ? activeOrder.pickupTime || 'Immediate counter collection'
                      : activeOrder.deliveryAddress || 'Delivery to customer doorstep'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Customer: <strong>{activeOrder.customerName}</strong> ({activeOrder.customerPhone})
              </div>
            </div>

            {/* ORDER ITEMS & ADD-ONS BREAKDOWN (THE WHOLE ORDER DETAIL) */}
            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: '18px',
                border: '1px solid var(--border-color)',
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16.5px', fontWeight: 850, color: 'var(--text-main)', margin: 0 }}>
                  Order Dishes & Items Breakdown
                </h3>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Total Items: {activeOrder.items.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0)}
                </span>
              </div>

              {/* Group 1: Original Placed Items */}
              <div>
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    marginBottom: '8px',
                    letterSpacing: '0.04em',
                  }}
                >
                  Original Items (Subtotal: Rs. {Number(activeOrder.originalSubtotal).toLocaleString()})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {regularItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                          {item.name} × {item.quantity}
                        </div>
                        {item.size && item.size !== 'Standard' && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            Size: {item.size}
                          </div>
                        )}
                        {item.extras && item.extras.length > 0 && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            Extras: {item.extras.join(', ')}
                          </div>
                        )}
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                        Rs. {(Number(item.unitPrice) * Number(item.quantity)).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group 2: Add-on Items Group */}
              {addOnItems.length > 0 && (
                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 850,
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Sparkles size={12} />
                      STAGE 2 ADD-ONS / NEW ITEMS
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      (Subtotal: Rs. {Number(activeOrder.addOnSubtotal || 0).toLocaleString()})
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {addOnItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--primary-light)',
                          border: '1px solid var(--primary)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary)' }}>
                            ✨ {item.name} × {item.quantity} (Add-on)
                          </div>
                          {item.size && item.size !== 'Standard' && (
                            <div style={{ fontSize: '11.5px', color: 'var(--primary)' }}>
                              Size: {item.size}
                            </div>
                          )}
                          {item.extras && item.extras.length > 0 && (
                            <div style={{ fontSize: '11.5px', color: 'var(--primary)', opacity: 0.85 }}>
                              Extras: {item.extras.join(', ')}
                            </div>
                          )}
                        </div>
                        <span style={{ fontWeight: 850, fontSize: '14px', color: 'var(--primary)' }}>
                          + Rs. {(Number(item.unitPrice) * Number(item.quantity)).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Summary */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Total Payable Amount at Cafe
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 850, color: 'var(--primary)' }}>
                    Rs. {Number(activeOrder.total).toLocaleString()}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 750,
                    color: 'var(--pay-unpaid-text)',
                    backgroundColor: 'var(--pay-unpaid-bg)',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Banknote size={16} />
                  <span>Cash Payment at Counter</span>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS (Edit, Cancel, Support) */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                disabled={!isEditable || isCancelled}
                onClick={() => onNavigate('order-edit')}
                style={{
                  flex: 1,
                  padding: '13px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: !isEditable || isCancelled ? 'var(--bg-card-subtle)' : 'var(--primary)',
                  color: !isEditable || isCancelled ? 'var(--text-muted)' : '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: !isEditable || isCancelled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: 'none',
                  boxShadow: !isEditable || isCancelled ? 'none' : '0 4px 14px var(--primary-glow)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Edit3 size={17} />
                <span>Edit Order</span>
              </button>

              <button
                disabled={isCancelled || activeOrder.status === 'completed'}
                onClick={() => {
                  if (activeOrder.status === 'preparing' || !isWithinFlexibleWindow) {
                    setCannotCancelModalOpen(true);
                  } else {
                    setCancelModalOpen(true);
                  }
                }}
                style={{
                  padding: '13px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card)',
                  border:
                    isCancelled || activeOrder.status === 'completed'
                      ? '1px solid var(--border-color)'
                      : '1px solid #DC2626',
                  color: isCancelled || activeOrder.status === 'completed' ? 'var(--text-muted)' : '#DC2626',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: isCancelled || activeOrder.status === 'completed' ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
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
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Phone size={17} color="var(--primary)" />
                <span>Contact Cafe Support</span>
              </button>
            </div>
          </div>
        </div>

        {/* Cancel Order Confirmation Popup */}
        <ModalConfirmation
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          onConfirm={() => {
            cancelOrder(activeOrder.id, cancelReason);
            setCancelModalOpen(false);
          }}
          title="Cancel This Order?"
          message="Are you sure you want to cancel your order before kitchen preparation begins? This action cannot be undone."
          details={`Order #${activeOrder.orderNumber} · Subtotal: Rs. ${Number(activeOrder.total).toLocaleString()}`}
          confirmText="Yes, cancel order"
          cancelText="No, keep order"
          isDanger={true}
        />

        {/* Informational Modal when trying to cancel after preparation started */}
        <ModalConfirmation
          isOpen={cannotCancelModalOpen}
          onClose={() => setCannotCancelModalOpen(false)}
          onConfirm={() => {
            setCannotCancelModalOpen(false);
            onNavigate('support');
          }}
          title="Cannot Cancel Order Directly"
          message="Kitchen preparation has already started! Once our chefs begin cooking your food, the order cannot be cancelled directly from the app. Please inform the branch assistant or representative to request assistance."
          details={`Order #${activeOrder.orderNumber} · Status: PREPARING IN KITCHEN`}
          confirmText="Contact Branch Representative"
          cancelText="Close"
          isDanger={false}
        />
      </div>
    </>
  );
};
