'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Role, User, UserStatus } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  Building2,
  Users,
  PlusCircle,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  PowerOff,
} from 'lucide-react';

export const BranchesStaffScreen: React.FC = () => {
  const { branches, users, updateUserStatus, createUser, addToast } = useApp();

  const [activeTab, setActiveTab] = useState<'staff' | 'branches'>('staff');
  
  // New Staff Modal
  const [newStaffModal, setNewStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<Role>('kitchen_staff');
  const [newStaffBranch, setNewStaffBranch] = useState(branches[0]?.id || 'gulberg-lahore');

  // Deactivation confirmation modal (danger variant per PRD)
  const [deactivateUserModal, setDeactivateUserModal] = useState<{ id: string; name: string; action: 'suspend' | 'deactivate' } | null>(null);

  const predefinedRoles: { role: Role; label: string }[] = [
    { role: 'platform_owner', label: 'Platform Owner' },
    { role: 'branch_manager', label: 'Branch Manager' },
    { role: 'branch_representative', label: 'Branch Representative' },
    { role: 'kitchen_staff', label: 'Kitchen Staff' },
    { role: 'cashier', label: 'Cashier' },
    { role: 'floor_staff', label: 'Floor Staff / Waiter' },
    { role: 'delivery_staff', label: 'Delivery Staff (v1.1)' },
    { role: 'customer', label: 'Customer' },
  ];

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    createUser({
      name: newStaffName,
      phone: newStaffPhone,
      email: newStaffEmail,
      role: newStaffRole,
      branchId: newStaffBranch,
      status: 'active',
    });
    addToast({
      type: 'success',
      title: 'Staff Account Created',
      message: `${newStaffName} assigned as ${newStaffRole.replace('_', ' ')}.`,
    });
    setNewStaffModal(false);
  };

  const handleConfirmedDeactivate = () => {
    if (!deactivateUserModal) return;
    const nextStatus: UserStatus = deactivateUserModal.action === 'deactivate' ? 'deactivated' : 'suspended';
    updateUserStatus(deactivateUserModal.id, nextStatus);
    setDeactivateUserModal(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Branches & Staff Access Administration
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Predefined 8 role model · Strict branch isolation · Instant access revocation
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('staff')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: activeTab === 'staff' ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === 'staff' ? '#FFFFFF' : 'var(--text-main)',
              border: '1px solid var(--border-color)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Staff Accounts ({users.filter((u) => u.role !== 'customer').length})
          </button>
          <button
            onClick={() => setActiveTab('branches')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: activeTab === 'branches' ? 'var(--primary)' : 'var(--bg-card)',
              color: activeTab === 'branches' ? '#FFFFFF' : 'var(--text-main)',
              border: '1px solid var(--border-color)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Branch Entities ({branches.length})
          </button>

          <button
            onClick={() => setNewStaffModal(true)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <PlusCircle size={16} />
            <span>+ Add Staff</span>
          </button>
        </div>
      </div>

      {activeTab === 'staff' ? (
        /* STAFF ROSTER TABLE */
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                <th style={{ padding: '14px 18px' }}>Staff Name</th>
                <th style={{ padding: '14px 18px' }}>Predefined Role</th>
                <th style={{ padding: '14px 18px' }}>Assigned Branch</th>
                <th style={{ padding: '14px 18px' }}>Contact</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const branchName = branches.find((b) => b.id === u.branchId)?.name || 'All Branches';
                const isSuspended = u.status === 'suspended';
                const isDeactivated = u.status === 'deactivated';

                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {u.name}
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
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      {branchName}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                      {u.phone}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: isDeactivated ? '#FEE2E2' : isSuspended ? '#FEF3C7' : '#DCFCE7',
                          color: isDeactivated ? '#B91C1C' : isSuspended ? '#B45309' : '#15803D',
                        }}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {u.status === 'active' ? (
                          <>
                            <button
                              onClick={() => setDeactivateUserModal({ id: u.id, name: u.name, action: 'suspend' })}
                              style={{ padding: '5px 10px', borderRadius: '4px', backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Suspend
                            </button>
                            <button
                              onClick={() => setDeactivateUserModal({ id: u.id, name: u.name, action: 'deactivate' })}
                              style={{ padding: '5px 10px', borderRadius: '4px', backgroundColor: '#FEE2E2', border: '1px solid #DC2626', color: '#DC2626', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Deactivate
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => updateUserStatus(u.id, 'active')}
                            style={{ padding: '5px 10px', borderRadius: '4px', backgroundColor: '#DCFCE7', border: '1px solid #16A34A', color: '#15803D', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* BRANCHES LIST */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {branches.map((b) => (
            <div
              key={b.id}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                padding: '24px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{b.name}</h3>
                <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--radius-full)', backgroundColor: b.isOpen ? '#DCFCE7' : '#FEE2E2', color: b.isOpen ? '#15803D' : '#B91C1C' }}>
                  {b.isOpen ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{b.address}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Hours: {b.openingHours} · Phone: {b.phone}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', marginTop: '4px' }}>
                Delivery Channel: {b.deliveryEnabled ? 'Enabled' : 'Disabled (v1.1)'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE STAFF MODAL */}
      {newStaffModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <form
            onSubmit={handleCreateStaff}
            style={{
              backgroundColor: 'var(--bg-card)',
              padding: '28px',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '460px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3 style={{ fontSize: '19px', fontWeight: 800, margin: 0 }}>Provision Staff Account</h3>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Staff Full Name *</label>
              <input
                type="text"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="e.g. Tariq Mehmood"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13.5px', color: 'var(--text-main)' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Phone Number *</label>
              <input
                type="tel"
                value={newStaffPhone}
                onChange={(e) => setNewStaffPhone(e.target.value)}
                placeholder="0300 1234567"
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13.5px', color: 'var(--text-main)' }}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Predefined System Role *</label>
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value as Role)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13.5px', color: 'var(--text-main)', outline: 'none' }}
              >
                {predefinedRoles.map((r) => (
                  <option key={r.role} value={r.role}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Assign Branch *</label>
              <select
                value={newStaffBranch}
                onChange={(e) => setNewStaffBranch(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13.5px', color: 'var(--text-main)', outline: 'none' }}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button type="button" onClick={() => setNewStaffModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-card-subtle)' }}>
                Cancel
              </button>
              <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#FFFFFF', fontWeight: 700 }}>
                Create Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Danger Confirmation Modal for Deactivating Account (PRD Section F16) */}
      {deactivateUserModal && (
        <ModalConfirmation
          isOpen={true}
          onClose={() => setDeactivateUserModal(null)}
          onConfirm={handleConfirmedDeactivate}
          title={deactivateUserModal.action === 'deactivate' ? 'Deactivate Staff Account?' : 'Suspend Account?'}
          message={`Are you sure you want to ${deactivateUserModal.action} ${deactivateUserModal.name}? This will revoke login and branch access immediately.`}
          confirmText={`Yes, ${deactivateUserModal.action}`}
          cancelText="No, go back"
          isDanger={true}
        />
      )}
    </div>
  );
};
