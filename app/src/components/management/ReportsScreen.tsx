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
} from 'lucide-react';

export const ReportsScreen: React.FC = () => {
  const { branches, shifts, addToast } = useApp();

  const [dateRange, setDateRange] = useState('Today (15 Oct)');
  const [selectedBranch, setSelectedBranch] = useState('all');

  const handleExportCSV = () => {
    addToast({
      type: 'success',
      title: 'Report Export Initiated',
      message: 'Downloading FoodiesCafe_Sales_Reconciliation.csv file...',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Financial & Cash Reconciliation Reports
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Shift-by-shift till cash counts, reconciliation variance, and multi-branch volume
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          style={{
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
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
          gap: '16px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700 }}>
          <Filter size={16} color="var(--primary)" />
          <span>Report Filters:</span>
        </div>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px' }}
        >
          <option value="all">All Branches (Consolidated)</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '13px' }}
        >
          <option value="today">Today (15 Oct 2026)</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">Past 7 Days</option>
          <option value="month">This Month</option>
        </select>
      </div>

      {/* VISUAL CHARTS & BREAKDOWN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Sales by Branch */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Sales Volume by Branch</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span>Gulberg Lahore (Flagship)</span>
                <span style={{ fontWeight: 700 }}>Rs. 58,400 (59%)</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', overflow: 'hidden' }}>
                <div style={{ width: '59%', height: '100%', backgroundColor: 'var(--primary)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span>F-7 Markaz Islamabad</span>
                <span style={{ fontWeight: 700 }}>Rs. 24,100 (25%)</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', overflow: 'hidden' }}>
                <div style={{ width: '25%', height: '100%', backgroundColor: '#EA580C' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span>Clifton Karachi</span>
                <span style={{ fontWeight: 700 }}>Rs. 15,950 (16%)</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', overflow: 'hidden' }}>
                <div style={{ width: '16%', height: '100%', backgroundColor: '#F59E0B' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Order Type Distribution */}
        <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Order Type Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span>🍽️ Dine-in (Tables & QR Orders)</span>
                <span style={{ fontWeight: 700 }}>68%</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', overflow: 'hidden' }}>
                <div style={{ width: '68%', height: '100%', backgroundColor: '#16A34A' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                <span>🛍️ Takeaway Counter Collections</span>
                <span style={{ fontWeight: 700 }}>32%</span>
              </div>
              <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', overflow: 'hidden' }}>
                <div style={{ width: '32%', height: '100%', backgroundColor: '#2563EB' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CASH RECONCILIATION REPORT (PRD Section F12 Requirement) */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
              End-of-Day Cash Reconciliation Ledger
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Expected cash vs counted cash per shift, with documented discrepancy explanations
            </span>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 18px' }}>Date / Shift</th>
              <th style={{ padding: '12px 18px' }}>Cashier Name</th>
              <th style={{ padding: '12px 18px' }}>Branch</th>
              <th style={{ padding: '12px 18px' }}>Opening Float</th>
              <th style={{ padding: '12px 18px' }}>Expected in Till</th>
              <th style={{ padding: '12px 18px' }}>Counted Cash</th>
              <th style={{ padding: '12px 18px' }}>Difference</th>
              <th style={{ padding: '12px 18px' }}>Reason / Note</th>
            </tr>
          </thead>
          <tbody>
            {[
              { id: '1', date: 'Today (Shift 1)', cashier: 'Bilal Farooq', branch: 'Gulberg Lahore', float: 5000, expected: 39200, counted: 39200, diff: 0, reason: 'Exact count verified' },
              { id: '2', date: 'Yesterday (Shift 2)', cashier: 'Usman Ghani', branch: 'F-7 Islamabad', float: 5000, expected: 41500, counted: 41200, diff: -300, reason: 'Small coins shortage' },
              { id: '3', date: 'Yesterday (Shift 1)', cashier: 'Kamran Ali', branch: 'Clifton Karachi', float: 5000, expected: 28900, counted: 28900, diff: 0, reason: 'Reconciled without variance' },
            ].map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '12px 18px', fontWeight: 700 }}>{row.date}</td>
                <td style={{ padding: '12px 18px' }}>{row.cashier}</td>
                <td style={{ padding: '12px 18px' }}>{row.branch}</td>
                <td style={{ padding: '12px 18px' }}>Rs. {row.float.toLocaleString()}</td>
                <td style={{ padding: '12px 18px', fontWeight: 700 }}>Rs. {row.expected.toLocaleString()}</td>
                <td style={{ padding: '12px 18px', fontWeight: 700, color: row.diff < 0 ? '#DC2626' : '#16A34A' }}>
                  Rs. {row.counted.toLocaleString()}
                </td>
                <td style={{ padding: '12px 18px', fontWeight: 800, color: row.diff < 0 ? '#DC2626' : '#16A34A' }}>
                  {row.diff === 0 ? 'Rs. 0' : `-Rs. ${Math.abs(row.diff)}`}
                </td>
                <td style={{ padding: '12px 18px', color: 'var(--text-secondary)' }}>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
