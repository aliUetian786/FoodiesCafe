'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, OrderStatus } from '@/types/cafe';
import {
  ShoppingBag,
  Utensils,
  Bike,
  Search,
  CheckCircle2,
  Clock,
  Printer,
  X,
  MapPin,
  Banknote,
  ChefHat,
  AlertCircle,
  Eye,
  Plus,
} from 'lucide-react';
import { WalkInOrderModal } from '@/staff/WalkInOrderModal';

interface CashierOrdersScreenProps {
  isFloorStaff?: boolean;
}

export const CashierOrdersScreen: React.FC<CashierOrdersScreenProps> = ({ isFloorStaff = false }) => {
  const { orders, currentBranch, currentUser, currentRole, recordCashPayment, addToast } = useApp();
  const isFloor = Boolean(isFloorStaff || currentRole === 'floor_staff');

  const [activeCategory, setActiveCategory] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');
  const [statusFilter, setStatusFilter] = useState<'all' | 'arrived' | 'preparing' | 'ready' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);

  // Filter orders: cashier or floor staff should only see their concerned orders (walk-in counter/table orders)
  const branchOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.branchId && o.branchId !== currentBranch.id) return false;
      if (isFloor) {
        if (o.type !== 'dine_in') return false;
        const isFloorOrder =
          o.cashierId === currentUser.id ||
          o.customerId === currentUser.id ||
          o.isWalkIn === true ||
          !!o.tableNumber ||
          (o.notes && o.notes.toLowerCase().includes('walk-in')) ||
          (o.pickupTime && o.pickupTime.toLowerCase().includes('walk-in'));
        return isFloorOrder;
      }
      return (
        o.cashierId === currentUser.id ||
        (o.cashierId && currentRole === 'cashier') ||
        o.isWalkIn === true ||
        o.customerId === currentUser.id ||
        o.orderNumber === 'FC-8242' ||
        o.orderNumber === 'FC-8225' ||
        o.orderNumber === 'FC-3391' ||
        (o.notes && o.notes.toLowerCase().includes('walk-in')) ||
        (o.pickupTime && o.pickupTime.toLowerCase().includes('walk-in'))
      );
    });
  }, [orders, currentBranch.id, currentUser.id, currentRole]);

  // Active counts for 3 categories
  const activeDineInCount = useMemo(() => {
    return branchOrders.filter(
      (o) => o.type === 'dine_in' && o.status !== 'completed' && o.status !== 'cancelled'
    ).length;
  }, [branchOrders]);

  const activeTakeawayCount = useMemo(() => {
    return branchOrders.filter(
      (o) => o.type === 'takeaway' && o.status !== 'completed' && o.status !== 'cancelled'
    ).length;
  }, [branchOrders]);

  const activeDeliveryCount = useMemo(() => {
    return branchOrders.filter(
      (o) => o.type === 'delivery' && o.status !== 'completed' && o.status !== 'cancelled'
    ).length;
  }, [branchOrders]);

  // Category-specific orders
  const categoryOrders = useMemo(() => {
    return branchOrders.filter((o) => o.type === activeCategory);
  }, [branchOrders, activeCategory]);

  // Filtered orders list by status and search
  const filteredOrders = useMemo(() => {
    return categoryOrders.filter((ord) => {
      // Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'arrived' && ord.status !== 'placed' && ord.status !== 'accepted') return false;
        if (statusFilter === 'preparing' && ord.status !== 'preparing') return false;
        if (statusFilter === 'ready' && ord.status !== 'ready' && ord.status !== 'served' && ord.status !== 'out_for_delivery') return false;
        if (statusFilter === 'completed' && ord.status !== 'completed') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = ord.orderNumber?.toLowerCase() || '';
        const name = ord.customerName?.toLowerCase() || '';
        const phone = ord.customerPhone?.replace(/\s+/g, '') || '';
        const table = ord.tableNumber?.toLowerCase() || '';
        return num.includes(q) || name.includes(q) || phone.includes(q) || table.includes(q);
      }

      return true;
    });
  }, [categoryOrders, statusFilter, searchQuery]);

  const getOrderStatusBadge = (status: string, type: string) => {
    switch (status) {
      case 'placed':
      case 'accepted':
        return { label: 'ORDER ARRIVED', bg: '#FEF3C7', color: '#92400E' };
      case 'preparing':
        return { label: 'COOKING IN KITCHEN', bg: '#DBEAFE', color: '#1E40AF' };
      case 'ready':
        if (type === 'takeaway') return { label: 'READY TO TAKE', bg: '#DCFCE7', color: '#166534' };
        if (type === 'delivery') return { label: 'READY TO SHIP', bg: '#DCFCE7', color: '#166534' };
        return { label: 'READY FOR SERVICE', bg: '#DCFCE7', color: '#166534' };
      case 'out_for_delivery':
        return { label: 'OUT FOR DELIVERY', bg: '#F3E8FF', color: '#6B21A8' };
      case 'served':
        return { label: 'SERVED TO TABLE', bg: '#E0E7FF', color: '#3730A3' };
      case 'completed':
        return { label: 'COMPLETED', bg: '#F1F5F9', color: '#334155' };
      case 'cancelled':
        return { label: 'CANCELLED', bg: '#FEE2E2', color: '#991B1B' };
      default:
        return { label: status.toUpperCase(), bg: '#F1F5F9', color: '#475569' };
    }
  };

  const handlePrintReceipt = (ord: Order) => {
    const existingIframe = document.getElementById('foodies-cashier-print-iframe');
    if (existingIframe) existingIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'foodies-cashier-print-iframe';
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

    const itemsHtml = ord.items
      .map(
        (item) => `
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-bottom: 6px; border-bottom: 1px dotted #CBD5E1; padding-bottom: 4px;">
          <span>${item.quantity} × ${item.name}</span>
          <span>Rs. ${(item.unitPrice * item.quantity).toLocaleString()}</span>
        </div>
      `
      )
      .join('');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt #${ord.orderNumber}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #0F172A; max-width: 320px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px dashed #94A3B8; padding-bottom: 12px; margin-bottom: 14px; }
            .total { font-size: 16px; font-weight: 800; border-top: 2px dashed #94A3B8; padding-top: 10px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2 style="margin: 0; font-size: 20px;">Foodies Cafe</h2>
            <div style="font-size: 12px; color: #475569;">${currentBranch.name}</div>
            <div style="font-size: 13px; font-weight: 800; margin-top: 6px;">Order #${ord.orderNumber} (${ord.type.toUpperCase()})</div>
          </div>
          <div>${itemsHtml}</div>
          <div class="total" style="display: flex; justify-content: space-between;">
            <span>TOTAL:</span>
            <span>Rs. ${Number(ord.total).toLocaleString()}</span>
          </div>
          <div style="text-align: center; font-size: 11px; color: #64748B; margin-top: 16px;">
            Payment: ${ord.paymentStatus.toUpperCase()} • Direct Kitchen Dispatch
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 2000);
    }, 300);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        backgroundColor: 'var(--bg-main)',
      }}
    >
      {/* ========================================================================= */}
      {/* STATIC TOP HEADER & 3 CATEGORY TABS                                       */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* STATIC TOP CONTROL BAR: CATEGORY TABS + STATUS FILTERS + RIGHT SEARCH & ACTION */}
      {/* ========================================================================= */}
      <div
        style={{
          flexShrink: 0,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 16px',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          minHeight: '52px',
          boxSizing: 'border-box',
        }}
      >
        {/* Left Side: 3 CATEGORY TABS (Dine-In, Takeaway, Delivery) [HIDDEN FOR FLOOR STAFF] + STATUS FILTERS */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isFloor && (
            <>
              <button
                onClick={() => {
                  setActiveCategory('dine_in');
                  setStatusFilter('all');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: activeCategory === 'dine_in' ? 'var(--primary)' : 'var(--bg-card-subtle)',
                  color: activeCategory === 'dine_in' ? '#FFFFFF' : 'var(--text-main)',
                  border: activeCategory === 'dine_in' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Utensils size={16} />
                <span>Dine-In Orders</span>
                {activeDineInCount > 0 && (
                  <span
                    style={{
                      backgroundColor: activeCategory === 'dine_in' ? '#FFFFFF' : 'var(--primary)',
                      color: activeCategory === 'dine_in' ? 'var(--primary)' : '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    {activeDineInCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveCategory('takeaway');
                  setStatusFilter('all');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: activeCategory === 'takeaway' ? 'var(--primary)' : 'var(--bg-card-subtle)',
                  color: activeCategory === 'takeaway' ? '#FFFFFF' : 'var(--text-main)',
                  border: activeCategory === 'takeaway' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <ShoppingBag size={16} />
                <span>Takeaway Orders</span>
                {activeTakeawayCount > 0 && (
                  <span
                    style={{
                      backgroundColor: activeCategory === 'takeaway' ? '#FFFFFF' : 'var(--primary)',
                      color: activeCategory === 'takeaway' ? 'var(--primary)' : '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    {activeTakeawayCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveCategory('delivery');
                  setStatusFilter('all');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: activeCategory === 'delivery' ? 'var(--primary)' : 'var(--bg-card-subtle)',
                  color: activeCategory === 'delivery' ? '#FFFFFF' : 'var(--text-main)',
                  border: activeCategory === 'delivery' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease',
                }}
              >
                <Bike size={16} />
                <span>Delivery Orders</span>
                {activeDeliveryCount > 0 && (
                  <span
                    style={{
                      backgroundColor: activeCategory === 'delivery' ? '#FFFFFF' : 'var(--primary)',
                      color: activeCategory === 'delivery' ? 'var(--primary)' : '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '10px',
                    }}
                  >
                    {activeDeliveryCount}
                  </span>
                )}
              </button>
            </>
          )}

          {/* Sub-status filter buttons: all, arrived, preparing, ready, completed */}
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexWrap: 'wrap', marginLeft: isFloor ? '0px' : '6px' }}>
            {(['all', 'arrived', 'preparing', 'ready', 'completed'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: statusFilter === tab ? '1px solid var(--text-main)' : '1px solid var(--border-color)',
                  backgroundColor: statusFilter === tab ? 'var(--text-main)' : 'transparent',
                  color: statusFilter === tab ? 'var(--bg-main)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Search Input in Top Right Corner + Walk-in Order Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: 'auto' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-full)',
              padding: '7px 14px',
              width: '240px',
            }}
          >
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, customer, table..."
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '12.5px',
                color: 'var(--text-main)',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={() => setWalkInModalOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 750,
              fontSize: '12.5px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px var(--primary-glow)',
              lineHeight: 1,
            }}
          >
            <Plus size={14} strokeWidth={2.4} color="#FFFFFF" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 750, color: '#FFFFFF', letterSpacing: '0.01em', lineHeight: 1 }}>Walk-in Order</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCROLLABLE ORDER CARDS CONTAINER (UNIFORM CARDS WITHOUT INLINE ITEMS)    */}
      {/* ========================================================================= */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {filteredOrders.length === 0 ? (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--border-color)',
              color: 'var(--text-muted)',
              maxWidth: '440px',
              margin: '40px auto',
            }}
          >
            <CheckCircle2 size={36} color="#16A34A" style={{ margin: '0 auto 10px', display: 'block' }} />
            <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>
              {currentRole === 'floor_staff' ? 'No Orders Found' : `No ${activeCategory.replace('_', ' ').toUpperCase()} Orders Found`}
            </div>
            <p style={{ fontSize: '13px', margin: '6px 0 0' }}>
              {currentRole === 'floor_staff'
                ? 'There are no active orders matching this status filter.'
                : 'There are no orders matching this view. Switch category or status filter above.'}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, 340px)',
              gap: '14px',
              alignItems: 'start',
            }}
          >
            {filteredOrders.map((ord) => {
              const statusInfo = getOrderStatusBadge(ord.status, ord.type);

              return (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrderDetail(ord)}
                  style={{
                    width: '340px',
                    minWidth: '340px',
                    maxWidth: '340px',
                    height: '185px',
                    minHeight: '185px',
                    maxHeight: '185px',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-md)',
                    border:
                      ord.status === 'placed' || ord.status === 'accepted'
                        ? '2px solid #F59E0B'
                        : ord.status === 'ready' || ord.status === 'served'
                        ? '2px solid #16A34A'
                        : ord.status === 'out_for_delivery'
                        ? '2px solid #2563EB'
                        : '1px solid var(--border-color)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  {/* Top: Order #, Status badge, Time/Table */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 850, fontSize: '15px', color: 'var(--text-main)' }}>
                        #{ord.orderNumber}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          backgroundColor: statusInfo.bg,
                          color: statusInfo.color,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                        }}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {ord.type === 'dine_in' && ord.tableNumber
                        ? `Table ${ord.tableNumber}`
                        : ord.pickupTime || (ord.createdAt ? ord.createdAt.split(',')[1] : 'Recent')}
                    </span>
                  </div>

                  {/* Customer name & Total */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0' }}>
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: '13.5px',
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {ord.customerName || 'Walk-in Guest'}
                      </div>
                      {ord.customerPhone && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          📞 {ord.customerPhone}
                        </span>
                      )}
                    </div>
                    <span style={{ fontWeight: 900, color: 'var(--text-main)', fontSize: '15px', flexShrink: 0 }}>
                      Rs. {Number(ord.total).toLocaleString()}
                    </span>
                  </div>

                  {/* Order Type & Items count (No item detail text on card face!) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                      {isFloor ? (
                        <span>{ord.tableNumber ? `Table #${ord.tableNumber}` : 'Table Seating'}</span>
                      ) : ord.type === 'dine_in' ? (
                        <span>{ord.tableNumber ? `Dine-In • Table ${ord.tableNumber}` : 'Dine-In Table'}</span>
                      ) : ord.type === 'delivery' ? (
                        <>
                          <MapPin size={11} color="var(--primary)" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ord.deliveryAddress || 'Delivery Address'}
                          </span>
                        </>
                      ) : (
                        <span>Takeaway Counter</span>
                      )}
                    </div>

                    <span
                      style={{
                        color: 'var(--primary)',
                        fontWeight: 750,
                        backgroundColor: 'var(--primary-light)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Eye size={12} />
                      <span>{ord.items.length} Items (Click to View)</span>
                    </span>
                  </div>

                  {/* Bottom: Kitchen Indicator & Payment status badge */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '4px',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#16A34A' }}>
                      <ChefHat size={14} color="#16A34A" />
                      <span>Direct Kitchen Sent</span>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: ord.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
                        color: ord.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {ord.paymentStatus === 'paid' ? 'PAID' : 'UNPAID CASH'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* POP-UP ORDER DETAIL MODAL                                                 */}
      {/* ========================================================================= */}
      {selectedOrderDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedOrderDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 850, color: 'var(--text-main)' }}>
                      Order #{selectedOrderDetail.orderNumber}
                    </h3>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                      }}
                    >
                      {isFloor
                        ? `Table #${selectedOrderDetail.tableNumber || '-'}`
                        : selectedOrderDetail.type === 'dine_in'
                        ? `Dine-In • Table ${selectedOrderDetail.tableNumber || '-'}`
                        : selectedOrderDetail.type === 'takeaway'
                        ? 'Takeaway'
                        : 'Delivery'}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Created: {selectedOrderDetail.createdAt || 'Recent'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Order Meta Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '12.5px',
                }}
              >
                <div>
                  <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Customer:</div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                    {selectedOrderDetail.customerName || 'Walk-in Guest'}
                  </div>
                  {selectedOrderDetail.customerPhone && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                      📞 {selectedOrderDetail.customerPhone}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Kitchen Dispatch:</div>
                  <div style={{ fontWeight: 800, color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ChefHat size={14} />
                    <span>Sent Directly to Kitchen</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                    Status: {selectedOrderDetail.status.toUpperCase()}
                  </div>
                </div>

                {selectedOrderDetail.type === 'dine_in' && selectedOrderDetail.tableNumber && (
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Seated Table:</div>
                    <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                      Table #{selectedOrderDetail.tableNumber}
                    </div>
                  </div>
                )}

                {selectedOrderDetail.type === 'delivery' && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Delivery Address:</div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {selectedOrderDetail.deliveryAddress || 'Provided by customer'}
                    </div>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                  Ordered Items ({selectedOrderDetail.items.length})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedOrderDetail.items.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>
                          {it.quantity} × {it.name}
                        </div>
                        {it.size && (
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Portion: {it.size}</div>
                        )}
                        {it.extras && it.extras.length > 0 && (
                          <div style={{ fontSize: '11.5px', color: 'var(--primary)', fontWeight: 600 }}>
                            Extras: {it.extras.join(', ')}
                          </div>
                        )}
                      </div>
                      <div style={{ fontWeight: 850, fontSize: '14px', color: 'var(--text-main)' }}>
                        Rs. {(it.unitPrice * it.quantity).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Totals */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>Rs. {Number(selectedOrderDetail.originalSubtotal || selectedOrderDetail.total).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Sales Tax</span>
                  <span>Rs. 0 (Included)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 850, color: 'var(--text-main)', marginTop: '4px' }}>
                  <span>Total Amount</span>
                  <span style={{ color: 'var(--primary)' }}>
                    Rs. {Number(selectedOrderDetail.total).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
                gap: '10px',
              }}
            >
              <button
                onClick={() => handlePrintReceipt(selectedOrderDetail)}
                style={{
                  padding: '9px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Printer size={15} />
                <span>Print Bill</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {selectedOrderDetail.paymentStatus === 'unpaid' && (
                  <button
                    onClick={() => {
                      recordCashPayment(selectedOrderDetail.id, selectedOrderDetail.total);
                      addToast({
                        type: 'success',
                        title: 'Cash Payment Recorded',
                        message: `Order #${selectedOrderDetail.orderNumber} marked as PAID.`,
                      });
                      setSelectedOrderDetail((prev) => (prev ? { ...prev, paymentStatus: 'paid' } : null));
                    }}
                    style={{
                      padding: '9px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '13px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Banknote size={15} />
                    <span>Record Cash Payment (Rs. {selectedOrderDetail.total.toLocaleString()})</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedOrderDetail(null)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Walk-in Order Modal */}
      {walkInModalOpen && (
        <WalkInOrderModal
          isFloorStaff={isFloor}
          onClose={() => setWalkInModalOpen(false)}
        />
      )}
    </div>
  );
};
