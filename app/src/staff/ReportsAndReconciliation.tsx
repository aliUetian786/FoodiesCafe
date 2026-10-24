'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  Banknote,
  PieChart,
  BarChart2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
} from 'lucide-react';

export const ReportsScreen: React.FC = () => {
  const {
    branches,
    orders,
    shifts,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    fetchOlderOrders,
    filterOrdersToToday,
    addToast,
  } = useApp();

  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all'>('today');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Date helpers
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
    return d.getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
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

  const handleDateChange = async (scope: 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all') => {
    setDateRange(scope);
    if (scope === 'today') {
      filterOrdersToToday();
    } else {
      if (!hasLoadedOlderOrders) {
        await fetchOlderOrders(selectedBranch === 'all' ? undefined : selectedBranch, scope);
      }
    }
  };

  // Filter real orders
  const filteredOrders = orders.filter((o) => {
    if (selectedBranch !== 'all' && o.branchId !== selectedBranch) return false;

    if (dateRange === 'today') {
      return isToday(o.createdAt) || (o.status !== 'completed' && o.status !== 'cancelled');
    }
    if (dateRange === 'yesterday') return isYesterday(o.createdAt);
    if (dateRange === 'week') return isWithinDays(o.createdAt, 7);
    if (dateRange === 'month') return isWithinMonth(o.createdAt);
    if (dateRange === 'custom') return isWithinCustom(o.createdAt, customStart, customEnd);
    return true;
  });

  // Real Financial Calculations
  const paidOrders = filteredOrders.filter((o) => o.paymentStatus === 'paid');
  const totalSalesVolume = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalOrdersCount = filteredOrders.length;

  // Real Branch Volume Breakdown
  const branchBreakdown = branches.map((b) => {
    const branchPaid = filteredOrders.filter((o) => o.branchId === b.id && o.paymentStatus === 'paid');
    const branchSales = branchPaid.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const percent = totalSalesVolume > 0 ? Math.round((branchSales / totalSalesVolume) * 100) : 0;
    return {
      id: b.id,
      name: b.name,
      sales: branchSales,
      percent,
      orderCount: filteredOrders.filter((o) => o.branchId === b.id).length,
    };
  });

  // Real Order Type Breakdown
  const dineInCount = filteredOrders.filter((o) => o.type === 'dine_in').length;
  const takeawayCount = filteredOrders.filter((o) => o.type === 'takeaway').length;
  const deliveryCount = filteredOrders.filter((o) => o.type === 'delivery').length;

  const dineInPercent = totalOrdersCount > 0 ? Math.round((dineInCount / totalOrdersCount) * 100) : 0;
  const takeawayPercent = totalOrdersCount > 0 ? Math.round((takeawayCount / totalOrdersCount) * 100) : 0;
  const deliveryPercent = totalOrdersCount > 0 ? Math.round((deliveryCount / totalOrdersCount) * 100) : 0;

  // Real Shifts for Cash Reconciliation
  const filteredShifts = shifts.filter((s) => {
    if (selectedBranch !== 'all' && s.branchId !== selectedBranch) return false;
    if (dateRange === 'today') return isToday(s.openedAt) || s.status === 'open';
    if (dateRange === 'yesterday') return isYesterday(s.openedAt);
    if (dateRange === 'week') return isWithinDays(s.openedAt, 7);
    if (dateRange === 'month') return isWithinMonth(s.openedAt);
    return true;
  });

  // Real Export CSV Handler
  const handleExportCSV = () => {
    try {
      const headers = ['Order Number', 'Branch', 'Customer', 'Phone', 'Type', 'Status', 'Payment', 'Total (PKR)', 'Date'];
      const rows = filteredOrders.map((o) => [
        o.orderNumber,
        branches.find((b) => b.id === o.branchId)?.name || o.branchId,
        o.customerName,
        o.customerPhone,
        o.type,
        o.status,
        o.paymentStatus,
        o.total,
        o.createdAt,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.map((cell) => `"${cell || ''}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `FoodiesCafe_Sales_Report_${dateRange}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addToast({
        type: 'success',
        title: 'Report Exported ✓',
        message: `Downloaded CSV with ${filteredOrders.length} verified records.`,
      });
    } catch (e) {
      addToast({ type: 'error', title: 'Export Failed', message: 'Could not generate CSV file.' });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        height: '100%',
        maxHeight: '100%',
        overflowY: 'auto',
        boxSizing: 'border-box',
        paddingRight: '4px',
      }}
    >
      {/* Top Banner Card */}
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
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Financial & Cash Reconciliation Reports
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Actual multi-branch sales volume · Till reconciliations · Fast Mode Today by default
            </p>
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          style={{
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none',
            boxShadow: '0 4px 12px var(--primary-glow)',
          }}
        >
          <Download size={16} />
          <span>Export CSV / Excel</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '14px 20px',
          display: 'flex',
          gap: '14px',
          alignItems: 'center',
          flexWrap: 'wrap',
          boxShadow: 'var(--shadow-sm)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 750, color: 'var(--text-main)' }}>
          <Filter size={16} color="var(--primary)" />
          <span>Report Scope:</span>
        </div>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <option value="all">All Branches (Consolidated)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={dateRange}
          onChange={(e) => handleDateChange(e.target.value as any)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '13px',
            fontWeight: 750,
          }}
        >
          <option value="today">⚡ Today's Data (Default Fast Mode)</option>
          <option value="yesterday">📅 Yesterday</option>
          <option value="week">📅 Past 7 Days</option>
          <option value="month">📅 This Month (30 Days)</option>
          <option value="custom">📅 Custom Date Range</option>
          <option value="all">📂 All Time History</option>
        </select>

        {dateRange === 'custom' && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
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
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
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

        {isFetchingOlderOrders && (
          <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, marginLeft: 'auto' }}>
            Fetching archive records from database...
          </span>
        )}
      </div>

      {/* SUMMARY KPI CARDS (Real data) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', flexShrink: 0 }}>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
            Period Sales Revenue
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            Rs. {totalSalesVolume.toLocaleString()}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            {paidOrders.length} verified paid transactions
          </span>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
            Order Volume Count
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {totalOrdersCount}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            All fulfillment channels
          </span>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
            Drawer Shifts Logged
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
            {filteredShifts.length}
          </div>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            Physical cash register reconciliations
          </span>
        </div>
      </div>

      {/* VISUAL BREAKDOWNS (Computed from actual database records) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', flexShrink: 0 }}>
        {/* Real Sales by Branch */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Sales Volume by Branch
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
              Total: Rs. {totalSalesVolume.toLocaleString()}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {branchBreakdown.map((b, idx) => {
              const colors = ['var(--primary)', '#EA580C', '#F59E0B'];
              const barColor = colors[idx % colors.length];

              return (
                <div key={b.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 650 }}>{b.name}</span>
                    <span style={{ fontWeight: 800 }}>
                      Rs. {b.sales.toLocaleString()} ({b.percent}%)
                    </span>
                  </div>
                  <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(b.percent, b.sales > 0 ? 5 : 0)}%`,
                        height: '100%',
                        backgroundColor: barColor,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real Order Type Distribution */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              Fulfillment Type Breakdown
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
              {totalOrdersCount} Total Orders
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 650 }}>🍽️ Dine-in ({dineInCount} orders)</span>
                <span style={{ fontWeight: 800 }}>{dineInPercent}%</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', overflow: 'hidden' }}>
                <div style={{ width: `${dineInPercent}%`, height: '100%', backgroundColor: '#16A34A', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 650 }}>🛍️ Takeaway Counter ({takeawayCount} orders)</span>
                <span style={{ fontWeight: 800 }}>{takeawayPercent}%</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', overflow: 'hidden' }}>
                <div style={{ width: `${takeawayPercent}%`, height: '100%', backgroundColor: '#2563EB', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 650 }}>🛵 Delivery Dispatch ({deliveryCount} orders)</span>
                <span style={{ fontWeight: 800 }}>{deliveryPercent}%</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', overflow: 'hidden' }}>
                <div style={{ width: `${deliveryPercent}%`, height: '100%', backgroundColor: '#0891B2', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* REAL CASH RECONCILIATION REPORT (Scrollable inside card) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '280px',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
              End-of-Day Cash Reconciliation Ledger
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Physical till drawer reconciliations, float amounts, expected vs counted cash, and documented explanations
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '340px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', position: 'sticky', top: 0, zIndex: 5 }}>
                <th style={{ padding: '12px 18px' }}>Date / Shift</th>
                <th style={{ padding: '12px 18px' }}>Cashier Name</th>
                <th style={{ padding: '12px 18px' }}>Branch</th>
                <th style={{ padding: '12px 18px' }}>Opening Float</th>
                <th style={{ padding: '12px 18px' }}>Expected in Till</th>
                <th style={{ padding: '12px 18px' }}>Counted Cash</th>
                <th style={{ padding: '12px 18px' }}>Difference</th>
                <th style={{ padding: '12px 18px' }}>Documented Reason</th>
              </tr>
            </thead>
            <tbody>
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No cash shifts recorded for this period.
                  </td>
                </tr>
              ) : (
                filteredShifts.map((row) => {
                  const bName = branches.find((b) => b.id === row.branchId)?.name || row.branchId;
                  const diff = typeof row.difference === 'number' ? row.difference : 0;
                  const counted = typeof row.countedCash === 'number' ? row.countedCash : row.cashCollected + row.openingFloat;

                  let dateFormatted = row.openedAt;
                  try {
                    const parsed = new Date(row.openedAt);
                    if (!isNaN(parsed.getTime())) {
                      dateFormatted = parsed.toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' (' + (row.status === 'open' ? 'Active' : 'Closed') + ')';
                    }
                  } catch (e) {}

                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 18px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {dateFormatted}
                      </td>
                      <td style={{ padding: '12px 18px' }}>{row.cashierName}</td>
                      <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>{bName}</td>
                      <td style={{ padding: '12px 18px' }}>Rs. {Number(row.openingFloat || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px 18px', fontWeight: 700 }}>Rs. {Number(row.expectedCash || 0).toLocaleString()}</td>
                      <td
                        style={{
                          padding: '12px 18px',
                          fontWeight: 750,
                          color: diff < 0 ? '#DC2626' : '#16A34A',
                        }}
                      >
                        Rs. {Number(counted || 0).toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: '12px 18px',
                          fontWeight: 800,
                          color: diff < 0 ? '#DC2626' : '#16A34A',
                        }}
                      >
                        {diff === 0 ? 'Rs. 0' : `${diff < 0 ? '-Rs. ' : '+Rs. '}${Math.abs(diff).toLocaleString()}`}
                      </td>
                      <td style={{ padding: '12px 18px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {row.differenceReason || (diff === 0 ? 'Exact count verified' : 'Pending manager review')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
