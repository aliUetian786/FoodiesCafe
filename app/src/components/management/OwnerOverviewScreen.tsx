'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import {
  TrendingUp,
  Building2,
  Banknote,
  AlertOctagon,
  Users,
  ShieldAlert,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

export const OwnerOverviewScreen: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const { branches, orders, shifts, complaints, setCurrentBranchId } = useApp();

  const totalSales = orders.reduce((sum, o) => sum + (o.paymentStatus === 'paid' ? o.total : 0), 0);
  const totalOrders = orders.length;
  const totalCashCollected = shifts.reduce((sum, s) => sum + Number(s.cashCollected || 0), 0);
  const openComplaintsCount = complaints.filter((c) => c.status !== 'closed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
          Platform Owner Overview
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Role: <strong>platform_owner</strong> · Central multi-branch visibility, cash health & anomaly alerts
        </p>
      </div>

      {/* ALL-BRANCHES SUMMARY CARDS (PRD Requirement) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>All-Branches Sales Today</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
            Rs. {totalSales.toLocaleString()}
          </div>
          <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>+14.2% vs yesterday</span>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Network Orders</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
            {totalOrders}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Across 3 branches</span>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cash Collected in Tills</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#16A34A', marginTop: '4px' }}>
            Rs. {totalCashCollected.toLocaleString()}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Physical drawer reconciliations</span>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Active Open Complaints</span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: openComplaintsCount > 0 ? '#EA580C' : '#16A34A', marginTop: '4px' }}>
            {openComplaintsCount}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Assigned to representatives</span>
        </div>
      </div>

      {/* CRITICAL ALERTS: FRAUD, CASH DISCREPANCY, REFUNDS (PRD Requirement) */}
      <div
        style={{
          backgroundColor: 'var(--status-preparing-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--status-preparing-text)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-preparing-text)', fontWeight: 800, fontSize: '15px' }}>
          <AlertOctagon size={20} />
          <span>MANAGEMENT AUDIT & ANOMALY ALERTS (3 Active)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>
              ✓ Till Drawers Reconciled
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              All branch drawers verified with zero unauthorized cash discrepancies.
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#D97706' }}>
              ⚠️ Shift Reconciliation Variance
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              F-7 Islamabad: Counted Rs. 38,900 vs expected Rs. 39,200 (Difference: -Rs. 300).
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-card)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB' }}>
              ℹ️ High Table Turnover Rate
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Clifton Karachi: 94% dine-in occupancy recorded this evening.
            </div>
          </div>
        </div>
      </div>

      {/* PER-BRANCH COMPARISON CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
          Branch Operational Health & Fast Links
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {branches.map((b) => (
            <div
              key={b.id}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                padding: '20px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    {b.name}
                  </h4>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{b.city}</span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: b.isOpen ? 'var(--status-ready-bg)' : 'var(--status-cancelled-bg)',
                    color: b.isOpen ? 'var(--status-ready-text)' : 'var(--status-cancelled-text)',
                  }}
                >
                  {b.isOpen ? 'OPEN' : 'CLOSED'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', fontSize: '12.5px', backgroundColor: 'var(--bg-card-subtle)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div>⏱️ Prep: <strong>{b.prepTimeEstimateMin}m</strong></div>
                <div>⚡ Edit Win: <strong>{b.fullEditWindowMin}m</strong></div>
                <div>🔒 Cutoff: <strong>{b.stopAddOnsMinBeforeReady}m</strong></div>
                <div>{b.isBusy ? '⚠️ Status: Busy' : '✓ Status: Normal'}</div>
              </div>

              <button
                onClick={() => {
                  setCurrentBranchId(b.id);
                  onNavigate('staff-manager');
                }}
                style={{
                  padding: '9px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>Switch Manager View</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
