'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, getCancellationAttribution } from '@/types/cafe';
import {
  Receipt,
  RotateCcw,
  X,
  Printer,
  Calendar,
  Clock,
  MapPin,
  ShoppingBag,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { HistoricalLoadingModal } from '@/components/common/HistoricalLoadingModal';
import { CustomerLoginModal } from './CustomerLoginModal';

interface CustomerHistoryProps {
  onNavigate: (view: string) => void;
}

function getDisplayStatus(status: string, orderType: string = 'delivery', ord?: Order) {
  const s = (status || '').toLowerCase();
  const t = (orderType || '').toLowerCase();

  if (s === 'cancelled') {
    const cancelAttr = ord ? getCancellationAttribution(ord) : null;
    const label = cancelAttr?.isCustomer ? 'CANCELLED (BY YOU)' : (cancelAttr?.badge || 'CANCELLED');
    return { label, color: '#DC2626', bg: '#FEE2E2' };
  }
  if (t === 'dine_in' || s === 'served') {
    return { label: 'SERVED', color: '#4F46E5', bg: '#EEF2FF' };
  }
  if (t === 'takeaway' || s === 'taken') {
    return { label: 'TAKEN', color: '#334155', bg: '#F1F5F9' };
  }
  return { label: 'DELIVERED', color: '#059669', bg: '#ECFDF5' };
}

export const OrderHistoryScreen: React.FC<CustomerHistoryProps> = ({ onNavigate }) => {
  const {
    orders,
    currentUser,
    addToCart,
    addToast,
    branches,
    currentBranch,
    menuItems,
    fetchOlderOrders,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
  } = useApp();
  const [selectedReceipt, setSelectedReceipt] = useState<Order | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const isCustomerLoggedIn = Boolean(
    currentUser &&
    currentUser.name &&
    currentUser.name !== 'Guest Customer' &&
    currentUser.role === 'customer' &&
    currentUser.id !== 'user-guest' &&
    currentUser.id !== 'guest'
  );

  // Exception handler: properly load older days' data from database on demand
  useEffect(() => {
    if (isCustomerLoggedIn && !hasLoadedOlderOrders && !isFetchingOlderOrders) {
      fetchOlderOrders();
    }
  }, [isCustomerLoggedIn, hasLoadedOlderOrders, isFetchingOlderOrders, fetchOlderOrders]);

  const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
  const userPhoneClean = normalizePhone(currentUser?.phone);

  // Comprehensive customer orders matching with multi-source fallback (only when logged in)
  const customerOrders = useMemo(() => {
    if (!isCustomerLoggedIn) {
      return [];
    }

    let localPlacedIds: string[] = [];
    let localCachedOrders: Order[] = [];
    if (typeof window !== 'undefined') {
      try {
        localPlacedIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
        localCachedOrders = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
      } catch (e) { }
    }

    const pool = [...orders];
    localCachedOrders.forEach((co) => {
      const idx = pool.findIndex((o) => o.id === co.id || o.orderNumber === co.orderNumber);
      if (idx === -1) {
        pool.push(co);
      } else {
        if (co.status === 'cancelled' && pool[idx].status !== 'cancelled') {
          pool[idx] = { ...pool[idx], status: 'cancelled' };
        }
      }
    });

    return pool.filter((o) => {
      // 1. Customer ID match
      if (currentUser?.id && currentUser.id !== 'user-guest' && o.customerId === currentUser.id) return true;
      // 2. Email match
      if (currentUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === currentUser.email.toLowerCase()) return true;
      // 3. Customer name match if authenticated
      if (currentUser?.name && currentUser.name !== 'Guest Customer' && o.customerName === currentUser.name) return true;
      // 4. Phone match
      if (userPhoneClean && normalizePhone(o.customerPhone) === userPhoneClean) return true;
      // 5. Placed on this device/browser
      if (localPlacedIds.includes(o.id) || localPlacedIds.includes(o.orderNumber)) return true;
      return false;
    });
  }, [orders, userPhoneClean, currentUser, isCustomerLoggedIn]);

  // Exclude in-tracking and unpaid orders: strictly only paid orders appear in history
  // List new orders in history at top (sorted strictly by createdAt descending)
  const historyOrders = useMemo(() => {
    return customerOrders
      .filter(
        (o) =>
          (o.paymentStatus === 'paid' || o.paymentCollected === true || o.status === 'cancelled') &&
          (o.status === 'completed' ||
            o.status === 'delivered' ||
            o.status === 'served' ||
            o.status === 'taken' ||
            o.status === 'cancelled')
      )
      .sort((a, b) => {
        const tA = new Date(a.createdAt).getTime() || 0;
        const tB = new Date(b.createdAt).getTime() || 0;
        return tB - tA;
      });
  }, [customerOrders]);

  const hasActiveOrders = useMemo(() => {
    return customerOrders.some(
      (o) =>
        o.status !== 'completed' &&
        o.status !== 'delivered' &&
        o.status !== 'served' &&
        o.status !== 'taken' &&
        o.status !== 'cancelled'
    );
  }, [customerOrders]);

  const handleReorder = (order: Order) => {
    order.items.forEach((item) => {
      addToCart({
        id: `cart-reorder-${Date.now()}-${Math.random()}`,
        menuItemId: item.menuItemId,
        name: item.name,
        unitPrice: Number(item.unitPrice),
        quantity: item.quantity || 1,
        size: item.size || 'Standard',
        extras: item.extras || [],
        instructions: item.instructions || '',
      });
    });

    addToast({
      type: 'success',
      title: 'Order Reordered! 🛒',
      message: `${order.items.length} item(s) from Order #${order.orderNumber} added to your cart.`,
    });
    onNavigate('menu');
  };

  // Thermal slip print action using clean hidden iframe
  const handlePrintSlip = (ord: Order) => {
    const liveTime = new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const liveDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timestampStr = `${liveDate} at ${liveTime}`;

    const existingIframe = document.getElementById('foodies-history-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'foodies-history-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const orderBranch = branches.find((b) => b.id === ord.branchId) || currentBranch;
    const st = getDisplayStatus(ord.status, ord.type);

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Receipt #${ord.orderNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; font-size: 13px; color: #111827; background: #FFF; }
            .center { text-align: center; }
            .header { border-bottom: 1px dashed #D1D5DB; padding-bottom: 12px; margin-bottom: 12px; }
            .title { font-size: 20px; font-weight: 900; }
            .brand { color: #D96528; }
            .divider { border-top: 1px dashed #D1D5DB; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 12px; }
            .item-row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 13px; }
            .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 850; margin-top: 6px; }
            .print-time { background: #F3F4F6; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #374151; margin-top: 6px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="header center">
            <div class="title">Foodies<span class="brand">Cafe</span></div>
            <div style="font-size: 11px; color: #6B7280; margin-top: 2px;">Official 80mm POS Thermal Receipt</div>
            <div style="font-size: 11px; color: #6B7280;">GST Registered · NTN: 8492019-3</div>
            <div style="font-size: 15px; font-weight: 850; margin-top: 6px;">Order #${ord.orderNumber}</div>
            <div style="font-size: 11px; color: #4B5563; margin-top: 2px;">${ord.type.toUpperCase().replace('_', ' ')} · ${orderBranch?.name || 'Main Branch'}</div>
            <div class="print-time">Printed Live: ${timestampStr}</div>
          </div>
          <div class="row"><span>Customer:</span><strong>${ord.customerName || 'Guest'}</strong></div>
          <div class="row"><span>Status:</span><strong>${st.label}</strong></div>
          ${ord.tableNumber ? `<div class="row"><span>Table:</span><strong>${ord.tableNumber}</strong></div>` : ''}
          ${ord.deliveryAddress ? `<div class="row"><span>Delivery to:</span><strong>${ord.deliveryAddress}</strong></div>` : ''}
          <div class="divider"></div>
          <div>
            ${ord.items.map((it) => `
              <div class="item-row">
                <span>${it.quantity}x ${it.name}${it.size ? ` (${it.size})` : ''}</span>
                <strong>Rs. ${(Number(it.unitPrice) * Number(it.quantity)).toLocaleString()}</strong>
              </div>
            `).join('')}
          </div>
          <div class="divider"></div>
          <div class="row"><span>Subtotal:</span><span>Rs. ${Number(ord.originalSubtotal || ord.total).toLocaleString()}</span></div>
          <div class="row"><span>GST (16%):</span><span>Rs. ${Number(ord.tax || 0).toLocaleString()}</span></div>
          <div class="total-row"><span>GRAND TOTAL:</span><span style="color: #D96528;">Rs. ${Number(ord.total).toLocaleString()}</span></div>
          <div class="divider"></div>
          <div class="center" style="font-size: 11px; color: #6B7280; margin-top: 10px;">
            Thank you for dining with FoodiesCafe!<br>
            Exact time printed at that moment: ${liveTime}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 250);

    addToast({
      type: 'success',
      title: 'Receipt Printed ✓',
      message: `Bill for Order #${ord.orderNumber} printed live at ${liveTime}.`,
    });
  };

  if (!isCustomerLoggedIn) {
    return (
      <div
        className="foodies-history-wrapper"
        style={{
          maxWidth: '860px',
          margin: '18px auto 40px',
          padding: '0 16px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ marginBottom: '18px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 850,
              color: 'var(--text-main)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Order History & Receipts
          </h1>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-muted)',
              margin: '3px 0 0',
            }}
          >
            Permanent record of all your delicious cafe orders
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '50px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            boxShadow: 'var(--shadow-sm)',
            marginTop: '30px',
          }}
        >
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              backgroundColor: 'rgba(217, 101, 40, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Receipt size={38} />
          </div>

          <h3
            style={{
              fontSize: '22px',
              fontWeight: 850,
              color: 'var(--text-main)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Sign In to View Order History
          </h3>

          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              margin: 0,
              maxWidth: '440px',
              lineHeight: 1.6,
            }}
          >
            Please sign in with your email to view your past orders, receipts, and easily reorder your favorites.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginTop: '16px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <button
              onClick={() => setLoginModalOpen(true)}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px var(--primary-glow)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Sign In with Email</span>
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => onNavigate('menu')}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                border: '1.5px solid var(--border-color)',
                borderRadius: '12px',
                padding: '12px 22px',
                fontWeight: 750,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <ShoppingBag size={16} />
              <span>Browse Menu</span>
              <ArrowRight size={15} />
            </button>
          </div>

          <CustomerLoginModal
            isOpen={loginModalOpen}
            onClose={() => setLoginModalOpen(false)}
            onSuccess={() => {
              setLoginModalOpen(false);
              onNavigate('home');
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="foodies-history-wrapper"
      style={{
        maxWidth: '860px',
        margin: '18px auto 40px',
        padding: '0 16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Page Title & Subtitle */}
      <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 850,
              color: 'var(--text-main)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Order History & Receipts
          </h1>
          <p
            style={{
              fontSize: '13.5px',
              color: 'var(--text-muted)',
              margin: '3px 0 0',
            }}
          >
            Permanent record of all your delicious cafe orders
          </p>
        </div>
      </div>

      {/* Pop-up Circle Loading Sign when retrieving order records from database */}
      <HistoricalLoadingModal visible={isFetchingOlderOrders} />

      {/* Active Order Banner if active orders exist in tracking */}
      {hasActiveOrders && (
        <div
          onClick={() => onNavigate('tracking')}
          style={{
            backgroundColor: '#EFF6FF',
            border: '1.5px solid #BFDBFE',
            borderRadius: '16px',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 10px rgba(59, 130, 246, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>🛵</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1D4ED8' }}>
                Active Order In Progress
              </div>
              <div style={{ fontSize: '12px', color: '#3B82F6', marginTop: '1px' }}>
                Tap to view live tracking & status
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#1D4ED8' }}>
            <span>Track</span>
            <ArrowRight size={14} />
          </div>
        </div>
      )}

      {/* Empty State */}
      {historyOrders.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '20px',
            padding: '50px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Receipt size={32} />
          </div>

          <h3 style={{ fontSize: '18px', fontWeight: 850, color: 'var(--text-main)', margin: 0 }}>
            {hasActiveOrders ? 'Order Currently In Progress!' : 'No Previous Orders'}
          </h3>

          <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
            {hasActiveOrders
              ? 'Your active order is being prepared and tracked live. Receipts will appear here once received!'
              : 'Your past order receipts and completed deliveries will appear here.'}
          </p>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            {hasActiveOrders ? (
              <button
                onClick={() => onNavigate('tracking')}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px var(--primary-glow)',
                }}
              >
                <span>Track Active Order</span>
                <ArrowRight size={15} />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('menu')}
                style={{
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px var(--primary-glow)',
                }}
              >
                <span>Browse Menu & Order</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Orders List Feed */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {historyOrders.map((ord) => {
            const st = getDisplayStatus(ord.status, ord.type, ord);
            const dateStr = new Date(ord.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div
                key={ord.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '18px',
                  padding: '18px 20px',
                  boxShadow: '0 2px 12px var(--shadow-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Top Row: Order # and Status Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '16.5px', fontWeight: 850, color: 'var(--text-main)' }}>
                      Order #{ord.orderNumber}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <Calendar size={12} />
                      <span>{dateStr}</span>
                    </div>
                    {ord.status === 'cancelled' && (
                      <div style={{ fontSize: '11px', color: '#DC2626', fontWeight: 700, marginTop: '2px' }}>
                        {getCancellationAttribution(ord).isCustomer
                          ? 'Cancelled by you'
                          : (getCancellationAttribution(ord).badge === 'CANCELLED (BRANCH CLOSED)'
                              ? 'Cancelled: Branch closed offline by staff'
                              : 'Cancelled by cafe staff')}
                      </div>
                    )}
                  </div>

                  <span
                    style={{
                      backgroundColor: st.bg,
                      color: st.color,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 850,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {st.label}
                  </span>
                </div>

                {/* Dishes Summary Box */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {ord.items.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span style={{ color: 'var(--text-main)', fontWeight: 650 }}>
                        • {it.quantity}x {it.name} {it.size ? `(${it.size})` : ''}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>
                        Rs. {(Number(it.unitPrice) * Number(it.quantity)).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Footer: Price & Payment on left, actions on right */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '2px',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '16.5px', fontWeight: 900, color: 'var(--primary)' }}>
                      Rs. {Number(ord.total).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {ord.paymentMethod || 'Cash Payment'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Receipt Button */}
                    <button
                      onClick={() => setSelectedReceipt(ord)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 750,
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Receipt size={13} color="var(--primary)" />
                      Receipt
                    </button>

                    {/* Reorder Button */}
                    <button
                      onClick={() => handleReorder(ord)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px var(--primary-glow)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <RotateCcw size={13} />
                      Reorder
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= 80MM THERMAL RECEIPT / BILL MODAL ================= */}
      {selectedReceipt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(3px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedReceipt(null);
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              color: '#111827',
              borderRadius: '18px',
              width: '100%',
              maxWidth: '380px',
              padding: '22px',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', borderBottom: '1px dashed #D1D5DB', paddingBottom: '12px' }}>
              <button
                onClick={() => setSelectedReceipt(null)}
                style={{
                  position: 'absolute',
                  top: '14px',
                  right: '14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  color: '#9CA3AF',
                }}
              >
                <X size={18} />
              </button>
              <div style={{ fontSize: '20px', fontWeight: 900 }}>Foodies<span style={{ color: '#D96528' }}>Cafe</span></div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>Official 80mm POS Thermal Receipt</div>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>GST Registered • NTN: 8492019-3</div>
            </div>

            {/* Meta */}
            <div style={{ padding: '10px 0', borderBottom: '1px dashed #D1D5DB', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Order:</span>
                <strong>#{selectedReceipt.orderNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Date:</span>
                <span>{new Date(selectedReceipt.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Type:</span>
                <span style={{ fontWeight: 700 }}>{selectedReceipt.type.toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Status:</span>
                <span style={{ fontWeight: 800, color: getDisplayStatus(selectedReceipt.status, selectedReceipt.type).color }}>
                  {getDisplayStatus(selectedReceipt.status, selectedReceipt.type).label}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Printed:</span>
                <span style={{ fontWeight: 800, color: '#D96528' }}>
                  {selectedReceipt.createdAt ? new Date(selectedReceipt.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : 'Just now'}
                </span>
              </div>
            </div>

            {/* Items List */}
            <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '8px 0', borderBottom: '1px dashed #D1D5DB', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedReceipt.items.map((it, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span>{it.quantity}x {it.name}</span>
                  <strong>Rs. {(Number(it.unitPrice) * Number(it.quantity)).toLocaleString()}</strong>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ padding: '10px 0', borderBottom: '1px dashed #D1D5DB', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>Subtotal</span>
                <span>Rs. {(selectedReceipt.originalSubtotal || selectedReceipt.total).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6B7280' }}>GST (16%)</span>
                <span>Rs. {(selectedReceipt.tax || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 900, marginTop: '4px' }}>
                <span>GRAND TOTAL</span>
                <span style={{ color: '#D96528' }}>Rs. {Number(selectedReceipt.total).toLocaleString()}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', padding: '12px 0 10px', fontSize: '11px', color: '#6B7280' }}>
              Thank you for dining with FoodiesCafe!<br />
              Printed live at that exact moment
            </div>

            {/* Print Button */}
            <button
              onClick={() => handlePrintSlip(selectedReceipt)}
              style={{
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '10px',
                padding: '11px',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px var(--primary-glow)',
              }}
            >
              <Printer size={16} />
              Print Thermal Slip
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export { OrderHistoryScreen as CustomerHistory };
