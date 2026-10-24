'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Order } from '@/types/cafe';
import {
  ShoppingBag,
  Search,
  Filter,
  Eye,
  Calendar,
  Building2,
  Clock,
  ArrowRight,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  Utensils,
  Bike,
} from 'lucide-react';

export const CustomersOrdersScreen: React.FC = () => {
  const {
    orders,
    branches,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    fetchOlderOrders,
    filterOrdersToToday,
    addToast,
  } = useApp();

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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
      if (!hasLoadedOlderOrders) {
        await fetchOlderOrders(selectedBranch === 'all' ? undefined : selectedBranch, scope);
      }
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
      matchesStatus = ord.status !== 'completed' && ord.status !== 'cancelled';
    } else if (statusFilter !== 'all') {
      matchesStatus = ord.status === statusFilter;
    }

    // Payment
    const matchesPayment = paymentFilter === 'all' || ord.paymentStatus === paymentFilter;

    // Date
    let matchesDate = true;
    if (dateScope === 'today') {
      matchesDate = isToday(ord.createdAt) || (ord.status !== 'completed' && ord.status !== 'cancelled');
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
        gap: '20px',
        height: '100%',
        maxHeight: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
        paddingRight: '4px',
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '18px 24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          flexShrink: 0,
        }}
      >
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
              color: 'var(--primary)',
            }}
          >
            <ShoppingBag size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              All-Branch Real Customer Orders
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Real-time orders ledger · Defaults to Today's data · On-demand historical records from PostgreSQL
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {!hasLoadedOlderOrders ? (
            <button
              onClick={() => fetchOlderOrders(selectedBranch === 'all' ? undefined : selectedBranch, 'all')}
              disabled={isFetchingOlderOrders}
              style={{
                padding: '9px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--primary)',
                fontWeight: 750,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Download size={15} />
              <span>{isFetchingOlderOrders ? 'Loading Archive...' : '📂 Fetch Older Archive'}</span>
            </button>
          ) : (
            <button
              onClick={() => filterOrdersToToday()}
              style={{
                padding: '9px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: '#16A34A',
                fontWeight: 750,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Clock size={15} />
              <span>⚡ Reset to Today Only</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Date Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '14px 18px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          boxShadow: 'var(--shadow-sm)',
          flexShrink: 0,
        }}
      >
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '7px 12px',
            flex: 1,
            minWidth: '220px',
          }}
        >
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Order #, customer name, phone, dish..."
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '13px',
              width: '100%',
              color: 'var(--text-main)',
            }}
          />
        </div>

        {/* Date Scope Filter */}
        <select
          value={dateScope}
          onChange={(e) => handleDateScopeChange(e.target.value as any)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '12.5px',
            fontWeight: 750,
          }}
        >
          <option value="today">⚡ Today's Orders (Default)</option>
          <option value="yesterday">📅 Yesterday</option>
          <option value="week">📅 Past 7 Days</option>
          <option value="month">📅 This Month (30 Days)</option>
          <option value="custom">📅 Custom Date Range</option>
          <option value="all">📂 All Time History</option>
        </select>

        {/* Custom Date Pickers (if Custom selected) */}
        {dateScope === 'custom' && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                fontSize: '12px',
                color: 'var(--text-main)',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                fontSize: '12px',
                color: 'var(--text-main)',
              }}
            />
          </div>
        )}

        {/* Branch Filter */}
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '12.5px',
            fontWeight: 600,
          }}
        >
          <option value="all">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        {/* Fulfillment Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '12.5px',
            fontWeight: 600,
          }}
        >
          <option value="all">All Order Types</option>
          <option value="dine_in">🍽️ Dine-In</option>
          <option value="takeaway">🛍️ Takeaway</option>
          <option value="delivery">🛵 Delivery</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '12.5px',
            fontWeight: 600,
          }}
        >
          <option value="all">All Prep Statuses</option>
          <option value="active">Active In-Flight</option>
          <option value="preparing">Now Preparing</option>
          <option value="ready">Ready / Served</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {/* Payment Filter */}
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '12.5px',
            fontWeight: 600,
          }}
        >
          <option value="all">All Payments</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
          <option value="refunded">Refunded</option>
        </select>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  fontSize: '11.5px',
                  textTransform: 'uppercase',
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                }}
              >
                <th style={{ padding: '12px 18px' }}>Order #</th>
                <th style={{ padding: '12px 18px' }}>Branch</th>
                <th style={{ padding: '12px 18px' }}>Customer & Contact</th>
                <th style={{ padding: '12px 18px' }}>Fulfillment</th>
                <th style={{ padding: '12px 18px' }}>Prep Stage</th>
                <th style={{ padding: '12px 18px' }}>Payment</th>
                <th style={{ padding: '12px 18px', textAlign: 'right' }}>Total (PKR)</th>
                <th style={{ padding: '12px 18px', textAlign: 'center' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        #{ord.orderNumber}
                      </td>

                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: 650, color: 'var(--text-main)' }}>{branchName}</div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 750, color: 'var(--text-main)' }}>{ord.customerName}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{ord.customerPhone}</div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--bg-card-subtle)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {ord.type === 'dine_in' ? '🍽️ Dine-In' : ord.type === 'takeaway' ? '🛍️ Takeaway' : '🛵 Delivery'}
                          {ord.tableNumber ? ` (T-${ord.tableNumber})` : ''}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: statusBadge.bg,
                            color: statusBadge.color,
                          }}
                        >
                          {statusBadge.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: isRefunded ? '#FEE2E2' : isPaid ? '#DCFCE7' : '#FEF3C7',
                            color: isRefunded ? '#B91C1C' : isPaid ? '#15803D' : '#B45309',
                          }}
                        >
                          {ord.paymentStatus}
                        </span>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {ord.paymentMethod || 'Cash'}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: '14px' }}>
                        Rs. {Number(ord.total).toLocaleString()}
                      </td>

                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedOrder(ord)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--primary)',
                            fontWeight: 750,
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={13} />
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
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Order Details #{selectedOrder.orderNumber}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {branches.find((b) => b.id === selectedOrder.branchId)?.name || selectedOrder.branchId}
                </span>
              </div>
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
