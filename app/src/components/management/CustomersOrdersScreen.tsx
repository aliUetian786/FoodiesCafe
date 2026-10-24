'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { User, Order } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  Users,
  ShoppingBag,
  ShieldAlert,
  UserCheck,
  UserX,
  Filter,
  Eye,
  AlertTriangle,
} from 'lucide-react';

export const CustomersOrdersScreen: React.FC = () => {
  const { orders, users, updateUserStatus, branches } = useApp();

  const [activeTab, setActiveTab] = useState<'orders' | 'customers'>('orders');
  const [suspendModalUser, setSuspendModalUser] = useState<User | null>(null);

  const customersList = users.filter((u) => u.role === 'customer');

  const handleToggleSuspend = () => {
    if (!suspendModalUser) return;
    const nextStatus = suspendModalUser.status === 'suspended' ? 'active' : 'suspended';
    updateUserStatus(suspendModalUser.id, nextStatus);
    setSuspendModalUser(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Central Customer & Order Registry
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Consolidated orders, customer abuse mitigation, no-show counters & account suspension
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: activeTab === 'orders' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'orders' ? '#FFFFFF' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            All-Branch Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              backgroundColor: activeTab === 'customers' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'customers' ? '#FFFFFF' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Customers Registry ({customersList.length})
          </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        /* ALL ORDERS TABLE */
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
                <th style={{ padding: '14px 18px' }}>Order Number</th>
                <th style={{ padding: '14px 18px' }}>Branch</th>
                <th style={{ padding: '14px 18px' }}>Customer Details</th>
                <th style={{ padding: '14px 18px' }}>Order Type</th>
                <th style={{ padding: '14px 18px' }}>Prep Status</th>
                <th style={{ padding: '14px 18px' }}>Payment Status</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Total (Cash)</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((ord) => {
                const branchName = branches.find((b) => b.id === ord.branchId)?.name || ord.branchId;
                return (
                  <tr key={ord.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--text-main)' }}>
                      #{ord.orderNumber}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      {branchName}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700 }}>{ord.customerName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ord.customerPhone}</div>
                    </td>
                    <td style={{ padding: '14px 18px', textTransform: 'uppercase', fontSize: '11.5px', fontWeight: 700 }}>
                      {ord.type} {ord.tableNumber ? `(T-${ord.tableNumber})` : ''}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--status-preparing-bg)',
                          color: 'var(--status-preparing-text)',
                        }}
                      >
                        {ord.status}
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
                          backgroundColor: ord.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
                          color: ord.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
                        }}
                      >
                        {ord.paymentStatus}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: 'var(--primary)', fontSize: '14.5px' }}>
                      Rs. {ord.total.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CUSTOMERS REGISTRY TABLE */
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
                <th style={{ padding: '14px 18px' }}>Customer Name</th>
                <th style={{ padding: '14px 18px' }}>Verified Phone</th>
                <th style={{ padding: '14px 18px' }}>Email</th>
                <th style={{ padding: '14px 18px' }}>No-Show Count (Abuse Risk)</th>
                <th style={{ padding: '14px 18px' }}>Account Status</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Security Actions</th>
              </tr>
            </thead>
            <tbody>
              {customersList.map((cust) => {
                const isSuspended = cust.status === 'suspended';
                return (
                  <tr key={cust.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {cust.name}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      {cust.phone}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      {cust.email}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          color: (cust.noShowCount || 0) > 0 ? '#DC2626' : '#16A34A',
                        }}
                      >
                        {cust.noShowCount || 0} No-shows
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
                          backgroundColor: isSuspended ? '#FEE2E2' : '#DCFCE7',
                          color: isSuspended ? '#B91C1C' : '#15803D',
                        }}
                      >
                        {cust.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        onClick={() => setSuspendModalUser(cust)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isSuspended ? '#DCFCE7' : '#FEE2E2',
                          border: isSuspended ? '1px solid #16A34A' : '1px solid #DC2626',
                          color: isSuspended ? '#15803D' : '#DC2626',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          cursor: 'pointer',
                        }}
                      >
                        {isSuspended ? 'Reactivate Account' : 'Suspend Account'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Policy Reminder: NO Delete Button */}
          <div style={{ padding: '14px 18px', backgroundColor: 'var(--bg-card-subtle)', fontSize: '12px', color: 'var(--text-muted)' }}>
            🔒 Per cash-only security rules, deletion of customer accounts is restricted. Administrators suspend or reactivate accounts to preserve order history and audit integrity.
          </div>
        </div>
      )}

      {/* Confirmation Modal for Account Suspension */}
      {suspendModalUser && (
        <ModalConfirmation
          isOpen={true}
          onClose={() => setSuspendModalUser(null)}
          onConfirm={handleToggleSuspend}
          title={suspendModalUser.status === 'suspended' ? 'Reactivate Customer Account?' : 'Suspend Customer Account?'}
          message={
            suspendModalUser.status === 'suspended'
              ? `Restore ordering privileges for ${suspendModalUser.name}?`
              : `Suspending ${suspendModalUser.name} will block them from placing dine-in, takeaway, or QR orders.`
          }
          confirmText={suspendModalUser.status === 'suspended' ? 'Yes, reactivate' : 'Yes, suspend account'}
          cancelText="No, go back"
          isDanger={suspendModalUser.status !== 'suspended'}
        />
      )}
    </div>
  );
};
