'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Order } from '@/types/cafe';
import { HistoricalLoadingModal } from '@/components/common/HistoricalLoadingModal';
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  Calendar,
  Building2,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  Utensils,
  Bike,
} from 'lucide-react';

export interface CustomersOrdersScreenProps {
  initialStatus?: 'all' | 'pending';
  isBranchOrders?: boolean;
  title?: string;
}

export const CustomersOrdersScreen: React.FC<CustomersOrdersScreenProps> = ({
  initialStatus = 'all',
  isBranchOrders = false,
  title,
}) => {
  const {
    orders,
    branches,
    currentBranch,
    currentRole,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    fetchOlderOrders,
    filterOrdersToToday,
    addToast,
  } = useApp();

  const isManager = currentRole === 'branch_manager' || isBranchOrders;

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(isManager ? currentBranch.id : 'all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(initialStatus === 'pending' ? 'active' : 'all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateScope, setDateScope] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Selected Order for Detail Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Helper date functions
  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const isYesterday = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    );
  };

  const isWithinDays = (dateStr?: string, days: number = 7) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return d.getTime() >= cutoff;
  };

  const isWithinMonth = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const isWithinCustom = (dateStr?: string, start?: string, end?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    if (start) {
      const s = new Date(start);
      if (!isNaN(s.getTime()) && d < s) return false;
    }
    if (end) {
      const e = new Date(end);
      e.setHours(23, 59, 59, 999);
      if (!isNaN(e.getTime()) && d > e) return false;
    }
    return true;
  };

  // On-demand fetch when user selects older time periods
  const handleDateScopeChange = async (scope: 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all') => {
    setDateScope(scope);
    if (scope === 'today') {
      filterOrdersToToday();
    } else {
      await fetchOlderOrders(selectedBranch === 'all' ? undefined : selectedBranch, scope);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((ord) => {
    // Search
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      ord.orderNumber.toLowerCase().includes(q) ||
      ord.customerName.toLowerCase().includes(q) ||
      ord.customerPhone.toLowerCase().includes(q) ||
      (ord.tableNumber && ord.tableNumber.toLowerCase().includes(q)) ||
      (ord.items && ord.items.some((it) => it.name.toLowerCase().includes(q)));

    // Branch
    const matchesBranch = selectedBranch === 'all' || ord.branchId === selectedBranch;

    // Type
    const matchesType = typeFilter === 'all' || ord.type === typeFilter;

    // Status
    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = ord.status !== 'completed' && ord.status !== 'cancelled' && ord.status !== 'delivered';
    } else if (statusFilter === 'completed') {
      matchesStatus = ord.status === 'completed' || ord.status === 'delivered';
    } else if (statusFilter !== 'all') {
      matchesStatus = ord.status === statusFilter;
    }

    // Payment / Collections: Paid orders appear in Order History. Cancelled orders also appear here as cancelled.
    const isPaid = ord.paymentStatus === 'paid' || ord.paymentCollected === true;
    const isCancelled = ord.status === 'cancelled';
    if (!isPaid && !isCancelled) return false;

    let matchesPayment = true;
    if (paymentFilter !== 'all') {
      const m = (ord.paymentMethod || '').toLowerCase();
      const isCash = m.includes('cash') || m.includes('cod') || !m;
      if (paymentFilter === 'paid_cash') {
        matchesPayment = isPaid && isCash;
      } else if (paymentFilter === 'paid_online') {
        matchesPayment = isPaid && !isCash;
      } else if (paymentFilter === 'refunded') {
        matchesPayment = ord.paymentStatus === 'refunded';
      }
    }

    // Date
    let matchesDate = true;
    if (dateScope === 'today') {
      matchesDate = isToday(ord.createdAt);
    } else if (dateScope === 'yesterday') {
      matchesDate = isYesterday(ord.createdAt);
    } else if (dateScope === 'week') {
      matchesDate = isWithinDays(ord.createdAt, 7);
    } else if (dateScope === 'month') {
      matchesDate = isWithinMonth(ord.createdAt);
    } else if (dateScope === 'custom') {
      matchesDate = isWithinCustom(ord.createdAt, customStartDate, customEndDate);
    }

    return matchesSearch && matchesBranch && matchesType && matchesStatus && matchesPayment && matchesDate;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return { bg: '#DCFCE7', color: '#15803D', label: 'Completed' };
      case 'preparing':
        return { bg: 'var(--status-preparing-bg)', color: 'var(--status-preparing-text)', label: 'Preparing' };
      case 'ready':
      case 'served':
        return { bg: 'var(--status-ready-bg)', color: 'var(--status-ready-text)', label: status === 'served' ? 'Served' : 'Ready' };
      case 'placed':
      case 'accepted':
        return { bg: '#EFF6FF', color: '#2563EB', label: 'Accepted' };
      case 'cancelled':
        return { bg: 'var(--status-cancelled-bg)', color: 'var(--status-cancelled-text)', label: 'Cancelled' };
      case 'out_for_delivery':
        return { bg: '#CFFAFE', color: '#0891B2', label: 'Out for Delivery' };
      default:
        return { bg: 'var(--bg-card-subtle)', color: 'var(--text-secondary)', label: status };
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        height: '100%',
        maxHeight: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
        paddingRight: '4px',
      }}
    >
      {/* Prominent Loading Pop-up Sign Modal */}
      <HistoricalLoadingModal visible={isFetchingOlderOrders} />

      {/* ========================================================================= */}
      {/* STATIC TOP CONTROL BAR: SINGLE HORIZONTAL LINE FOR ALL FILTERS & ACTIONS    */}
      {/* ========================================================================= */}
      <div
        style={{
          flexShrink: 0,
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          padding: '6px 10px',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '2px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexWrap: 'nowrap',
          overflow: 'hidden',
          minHeight: '44px',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {/* Channel / Order Type Buttons: All, Takeaway, Dine-In, Delivery (Like Order Hub) */}
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'takeaway', label: 'Takeaway 🛍️' },
            { id: 'dine_in', label: 'Dine-In 🍽️' },
            { id: 'delivery', label: 'Delivery 🛵' },
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => setTypeFilter(ch.id)}
              style={{
                padding: '5px 9px',
                borderRadius: '5px',
                border: typeFilter === ch.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: typeFilter === ch.id ? 'var(--primary)' : 'transparent',
                color: typeFilter === ch.id ? '#FFFFFF' : 'var(--text-main)',
                fontSize: '11.5px',
                fontWeight: 750,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color)', flexShrink: 0 }} />

        {/* Date Scope Filter Dropdown (Positioned like Order Hub controls) */}
        <select
          value={dateScope}
          onChange={(e) => handleDateScopeChange(e.target.value as any)}
          style={{
            padding: '5px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '11.5px',
            fontWeight: 750,
            cursor: 'pointer',
            flexShrink: 0,
            outline: 'none',
          }}
        >
          <option value="today">⚡ Today's Orders</option>
          <option value="yesterday">📅 Yesterday</option>
          <option value="week">📅 Past 7 Days</option>
          <option value="month">📅 This Month (30 Days)</option>
          <option value="custom">📅 Custom Date Range</option>
          <option value="all">📅 All Time History</option>
        </select>

        {/* Custom Date Pickers (if Custom selected) */}
        {dateScope === 'custom' && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                fontSize: '11px',
                color: 'var(--text-main)',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={{
                padding: '4px 8px',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                fontSize: '11px',
                color: 'var(--text-main)',
              }}
            />
          </div>
        )}

        {/* Divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--border-color)', flexShrink: 0 }} />

        {/* Search Input: Flexible and fits the remaining screen space (Like Order Hub) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-full)',
            padding: '5px 10px',
            flex: 1,
            minWidth: '160px',
          }}
        >
          <Search size={13} color="var(--text-muted)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Order #, customer name, phone, dish..."
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '12px',
              width: '100%',
              color: 'var(--text-main)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0 2px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Orders Table Container (Scrollable when data is more than screen) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: '380px',
        }}
      >
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, maxHeight: 'calc(100vh - 290px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderBottom: '1.5px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  height: '34px',
                  lineHeight: '34px',
                }}
              >
                <th style={{ padding: '0 12px', height: '34px' }}>Order #</th>
                <th style={{ padding: '0 12px', height: '34px' }}>Branch</th>
                <th style={{ padding: '0 12px', height: '34px' }}>Customer & Contact</th>
                <th style={{ padding: '0 12px', height: '34px' }}>Fulfillment</th>
                <th style={{ padding: '0 12px', height: '34px' }}>Prep Stage</th>
                <th style={{ padding: '0 12px', height: '34px' }}>Payment</th>
                <th style={{ padding: '0 12px', height: '34px', textAlign: 'right' }}>Total (PKR)</th>
                <th style={{ padding: '0 12px', height: '34px', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No customer orders found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((ord) => {
                  const branchName = branches.find((b) => b.id === ord.branchId)?.name || ord.branchId;
                  const statusBadge = getStatusBadge(ord.status);
                  const isPaid = ord.paymentStatus === 'paid';
                  const isRefunded = ord.paymentStatus === 'refunded';

                  return (
                    <tr
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        height: '38px',
                        minHeight: '38px',
                        cursor: 'pointer',
                        transition: 'background-color 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--bg-card-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td style={{ padding: '0 12px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                        #{ord.orderNumber}
                      </td>

                      <td style={{ padding: '0 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        <span style={{ fontWeight: 650, color: 'var(--text-main)' }}>{branchName}</span>
                      </td>

                      <td style={{ padding: '0 12px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                        <span style={{ fontWeight: 750, color: 'var(--text-main)' }}>{ord.customerName}</span>
                        {ord.customerPhone && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                            ({ord.customerPhone})
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 750,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor:
                              ord.type === 'dine_in'
                                ? 'rgba(234, 88, 12, 0.12)'
                                : ord.type === 'takeaway'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : 'rgba(59, 130, 246, 0.12)',
                            color:
                              ord.type === 'dine_in'
                                ? '#EA580C'
                                : ord.type === 'takeaway'
                                ? '#059669'
                                : '#2563EB',
                          }}
                        >
                          {ord.type === 'dine_in' ? `🍽️ Dine-In ${ord.tableNumber ? `(Table #${ord.tableNumber})` : ''}` : ord.type === 'takeaway' ? '🛍️ Takeaway' : '🛵 Delivery'}
                        </span>
                      </td>

                      <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: statusBadge.bg,
                            color: statusBadge.color,
                          }}
                        >
                          {statusBadge.label}
                        </span>
                      </td>

                      <td style={{ padding: '0 12px', whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '2px 7px',
                            borderRadius: '4px',
                            backgroundColor: isRefunded ? '#FEE2E2' : isPaid ? '#DCFCE7' : 'var(--pay-unpaid-bg)',
                            color: isRefunded ? '#B91C1C' : isPaid ? '#15803D' : 'var(--pay-unpaid-text)',
                          }}
                        >
                          {ord.paymentStatus}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginLeft: '5px' }}>
                          ({ord.paymentMethod || 'Cash'})
                        </span>
                      </td>

                      <td style={{ padding: '0 12px', textAlign: 'right', fontWeight: 850, color: 'var(--primary)', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        Rs. {Number(ord.total).toLocaleString()}
                      </td>

                      <td style={{ padding: '0 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(ord);
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '5px',
                            backgroundColor: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--primary)',
                            fontWeight: 750,
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Eye size={11} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ORDER DETAILS POPUP MODAL */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '560px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Order Details
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Customer and Fulfillment Snapshot */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '12px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12.5px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Customer:</span>
                  <strong>{selectedOrder.customerName}</strong> ({selectedOrder.customerPhone})
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Fulfillment:</span>
                  <strong style={{ textTransform: 'uppercase' }}>{selectedOrder.type}</strong>
                  {selectedOrder.tableNumber ? ` (Table ${selectedOrder.tableNumber})` : ''}
                </div>
                {selectedOrder.deliveryAddress && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Delivery Address:</span>
                    <span>{selectedOrder.deliveryAddress}</span>
                  </div>
                )}
                {selectedOrder.notes && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block' }}>Customer Notes:</span>
                    <span>"{selectedOrder.notes}"</span>
                  </div>
                )}
              </div>

              {/* Items Breakdown */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Ordered Dishes & Items ({selectedOrder.items?.length || 0})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((it, idx) => (
                      <div
                        key={it.id || idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 750, fontSize: '13.5px', color: 'var(--text-main)' }}>
                            {it.quantity}x {it.name}
                            {it.isAddOn && (
                              <span style={{ fontSize: '10.5px', color: 'var(--primary)', marginLeft: '6px', fontWeight: 800 }}>
                                (Stage 2 Add-on)
                              </span>
                            )}
                          </div>
                          {it.size && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              Size: {it.size}
                            </div>
                          )}
                          {it.extras && it.extras.length > 0 && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              Extras: {it.extras.join(', ')}
                            </div>
                          )}
                        </div>

                        <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>
                          Rs. {(Number(it.unitPrice) * Number(it.quantity)).toLocaleString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No item breakdown stored.</div>
                  )}
                </div>
              </div>

              {/* Pricing Totals */}
              <div
                style={{
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Original Subtotal:</span>
                  <span>Rs. {Number(selectedOrder.originalSubtotal || 0).toLocaleString()}</span>
                </div>
                {Number(selectedOrder.addOnSubtotal || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Add-ons Subtotal:</span>
                    <span>Rs. {Number(selectedOrder.addOnSubtotal).toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Sales Tax:</span>
                  <span>Rs. {Number(selectedOrder.tax || 0).toLocaleString()}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '16px',
                    fontWeight: 900,
                    color: 'var(--primary)',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '8px',
                    marginTop: '4px',
                  }}
                >
                  <span>Grand Total:</span>
                  <span>Rs. {Number(selectedOrder.total || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
