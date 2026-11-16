'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { HistoricalLoadingModal } from '@/components/common/HistoricalLoadingModal';
import {
  FileClock,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  Lock,
  RefreshCw,
  Building2,
  Calendar,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  UtensilsCrossed,
  Sliders,
} from 'lucide-react';

export const AuditLogScreen: React.FC = () => {
  const { auditLogs, branches, refreshAuditLogs } = useApp();

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState<'mgr_cashier' | 'all' | 'branch_manager' | 'cashier' | 'staff'>('mgr_cashier');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week' | 'all'>('today');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAuditLogs();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Load the trail as soon as the owner opens the screen and keep it fresh while it is open.
  useEffect(() => {
    void refreshAuditLogs();
    const t = setInterval(() => void refreshAuditLogs(), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    if (dateStr.toLowerCase().includes('just now') || dateStr.toLowerCase().includes('today')) return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
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

  const filteredLogs = auditLogs.filter((log) => {
    // Logins and staff-account registrations are not operational changes; keep them out of the trail.
    if (log.action === 'staff_login' || log.action === 'staff_created') return false;

    // Search query
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      log.actorName.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      (log.branchId && log.branchId.toLowerCase().includes(q));

    // Role filter (Focus on manager activity actions)
    let matchesRole = true;
    if (roleFilter === 'mgr_cashier') {
      matchesRole = log.actorRole === 'branch_manager' || log.actorRole === 'cashier';
    } else if (roleFilter === 'branch_manager') {
      matchesRole = log.actorRole === 'branch_manager' || log.action.includes('manager');
    } else if (roleFilter === 'cashier') {
      matchesRole = log.actorRole === 'cashier';
    } else if (roleFilter === 'staff') {
      matchesRole = log.actorRole !== 'platform_owner';
    }

    // Branch filter
    const matchesBranch = branchFilter === 'all' || log.branchId === branchFilter;

    // Action filter
    let matchesAction = true;
    if (actionFilter !== 'all') {
      if (actionFilter === 'refunds') {
        matchesAction = log.action.includes('refund');
      } else if (actionFilter === 'staff') {
        matchesAction = log.action.includes('account');
      } else if (actionFilter === 'pricing') {
        matchesAction = log.action.includes('price');
      } else if (actionFilter === 'settings') {
        matchesAction = log.action.includes('timing') || log.action.includes('busy');
      } else if (actionFilter === 'manager_access') {
        matchesAction = log.action.includes('manager_access');
      } else if (actionFilter === 'shifts') {
        matchesAction = log.action.includes('shift');
      } else if (actionFilter === 'orders') {
        matchesAction = log.action.startsWith('order_');
      } else if (actionFilter === 'menu') {
        matchesAction = log.action.startsWith('menu_');
      } else if (actionFilter === 'branch') {
        matchesAction = log.action.startsWith('branch_');
      } else {
        matchesAction = log.action === actionFilter;
      }
    }

    // Date filter
    let matchesDate = true;
    if (dateFilter === 'today') {
      matchesDate = isToday(log.timestamp);
    } else if (dateFilter === 'yesterday') {
      matchesDate = isYesterday(log.timestamp);
    }

    return matchesSearch && matchesRole && matchesBranch && matchesAction && matchesDate;
  });

  const getActionBadge = (action: string) => {
    if (action.includes('refund')) {
      return { label: 'Refund Approval', color: '#DC2626', bg: '#FEE2E2' };
    }
    if (action.includes('account_created') || action.includes('account_activated')) {
      return { label: 'Staff Provisioning', color: '#16A34A', bg: '#DCFCE7' };
    }
    if (action.includes('account_suspended') || action.includes('account_deleted')) {
      return { label: 'Staff Revocation', color: '#B91C1C', bg: '#FEE2E2' };
    }
    if (action.includes('price')) {
      return { label: 'Price Override', color: '#D97706', bg: '#FEF3C7' };
    }
    if (action.includes('timing') || action.includes('busy')) {
      return { label: 'Operational Timing', color: '#2563EB', bg: '#DBEAFE' };
    }
    if (action.includes('manager_access')) {
      return { label: 'Owner Delegation', color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)' };
    }
    if (action.includes('shift')) {
      return { label: 'Shift Verification', color: '#0891B2', bg: '#CFFAFE' };
    }
    if (action.startsWith('order_payment')) {
      return { label: 'Payment Change', color: '#15803D', bg: '#DCFCE7' };
    }
    if (action === 'order_cancelled') {
      return { label: 'Order Cancelled', color: '#B91C1C', bg: '#FEE2E2' };
    }
    if (action.startsWith('order_')) {
      return { label: 'Order Change', color: '#C2410C', bg: '#FFEDD5' };
    }
    if (action.startsWith('menu_')) {
      return { label: 'Menu Change', color: '#D97706', bg: '#FEF3C7' };
    }
    if (action.startsWith('branch_')) {
      return { label: 'Branch Settings', color: '#2563EB', bg: '#DBEAFE' };
    }
    if (action.includes('table')) {
      return { label: 'Table Change', color: '#0F766E', bg: '#CCFBF1' };
    }
    return { label: action.replace(/_/g, ' '), color: 'var(--text-main)', bg: 'var(--bg-card-subtle)' };
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
      <HistoricalLoadingModal visible={isRefreshing} />
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
            <FileClock size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Manager Activity Audit Ledger
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Permanent audit log of what branch managers and station personnel executed across all branches
            </p>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            padding: '9px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-card-subtle)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-main)',
            fontWeight: 750,
            fontSize: '12.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh Ledger'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          padding: '14px 18px',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          boxShadow: 'var(--shadow-sm)',
          flexShrink: 0,
        }}
      >
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
            placeholder="Search by manager name, action details, or branch..."
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

        {/* Actor Role Filter: Focus on Manager Activity */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '12.5px',
            fontWeight: 700,
          }}
        >
          <option value="mgr_cashier">👔 Managers & Cashiers</option>
          <option value="branch_manager">👔 Branch Managers Actions</option>
          <option value="all">👥 All Authorized Staff</option>
          <option value="cashier">💰 Cashier Actions</option>
          <option value="staff">🛠️ Line Staff Actions</option>
        </select>

        {/* Action Category Filter */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
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
          <option value="all">All Action Categories</option>
          <option value="orders">Order & Payment Changes</option>
          <option value="menu">Menu & Price Changes</option>
          <option value="branch">Branch Open/Close & Hours</option>
          <option value="refunds">Refund Approvals</option>
          <option value="staff">Staff Provisioning & Status</option>
          <option value="pricing">Price Adjustments</option>
          <option value="settings">Timing & Busy Mode</option>
          <option value="manager_access">Owner Access Delegation</option>
          <option value="shifts">Till Shifts Verified</option>
        </select>

        {/* Branch Filter */}
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
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

        {/* Date Filter: Today Fast Mode by default */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-main)',
            fontSize: '12.5px',
            fontWeight: 700,
          }}
        >
          <option value="today">⚡ Today (Fast Mode)</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">Past 7 Days</option>
          <option value="all">All Historical Logs</option>
        </select>
      </div>

      {/* Audit Log Table (Scrollable inside card) */}
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
          minHeight: '360px',
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
                <th style={{ padding: '12px 18px', width: '160px' }}>Timestamp</th>
                <th style={{ padding: '12px 18px', width: '190px' }}>Authorized Manager / Actor</th>
                <th style={{ padding: '12px 18px', width: '160px' }}>Action Category</th>
                <th style={{ padding: '12px 18px', width: '180px' }}>Branch Context</th>
                <th style={{ padding: '12px 18px' }}>Event Audit Trail Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No audit log records found matching the active filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const branchName = branches.find((b) => b.id === log.branchId)?.name || log.branchId || 'Global Network';
                  const badge = getActionBadge(log.action);
                  const isManager = log.actorRole === 'branch_manager';

                  // Format timestamp
                  let timeDisplay = log.timestamp;
                  try {
                    const parsed = new Date(log.timestamp);
                    if (!isNaN(parsed.getTime())) {
                      timeDisplay = parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + parsed.toLocaleDateString([], { day: 'numeric', month: 'short' });
                    }
                  } catch (e) {}

                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isManager ? 'rgba(124, 58, 237, 0.015)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '12px', fontFamily: 'monospace' }}>
                        {timeDisplay}
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>{log.actorName}</span>
                        </div>
                        <div
                          style={{
                            fontSize: '10.5px',
                            color: isManager ? '#7C3AED' : 'var(--text-muted)',
                            fontWeight: 750,
                            textTransform: 'uppercase',
                          }}
                        >
                          {log.actorRole.replace(/_/g, ' ')}
                        </div>
                      </td>

                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                        <div style={{ fontWeight: 600 }}>{branchName}</div>
                      </td>

                      <td style={{ padding: '14px 18px', color: 'var(--text-main)', lineHeight: 1.45, fontSize: '12.5px' }}>
                        {log.details}
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
