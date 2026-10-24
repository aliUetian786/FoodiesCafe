'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  FileClock,
  Search,
  Filter,
  ShieldCheck,
  Lock,
} from 'lucide-react';

export const AuditLogScreen: React.FC = () => {
  const { auditLogs, branches } = useApp();

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      log.actorName.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
          System Audit Trail & Permanent Action Ledger
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Immutable records of price changes, refunds, timing settings, and account modifications
        </p>
      </div>

      {/* Filter and Search */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '8px 14px', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by actor, details, or action..."
            style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '13px', width: '100%', color: 'var(--text-main)' }}
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}
        >
          <option value="all">All Action Types</option>
          <option value="price_change">Price Changes</option>
          <option value="refund_approved">Refund Approvals</option>
          <option value="timing_settings">Timing Settings</option>
          <option value="account_suspended">Account Status Changes</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>
              <th style={{ padding: '14px 18px' }}>Timestamp</th>
              <th style={{ padding: '14px 18px' }}>Authorized Actor</th>
              <th style={{ padding: '14px 18px' }}>Action Category</th>
              <th style={{ padding: '14px 18px' }}>Branch Context</th>
              <th style={{ padding: '14px 18px' }}>Event Audit Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => {
              const branchName = branches.find((b) => b.id === log.branchId)?.name || 'Global Platform';
              return (
                <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '14px 18px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {log.timestamp}
                  </td>
                  <td style={{ padding: '14px 18px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{log.actorName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {log.actorRole.replace('_', ' ')}
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
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                      }}
                    >
                      {log.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                    {branchName}
                  </td>
                  <td style={{ padding: '14px 18px', color: 'var(--text-main)', lineHeight: 1.45 }}>
                    {log.details}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
