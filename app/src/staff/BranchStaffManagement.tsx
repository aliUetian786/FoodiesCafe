'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import { Role, User, UserStatus } from '@/types/cafe';
import { getBranchEmailSlug } from './BranchesAndStaff';
import {
  Users,
  UserPlus,
  Trash2,
  Edit,
  PauseCircle,
  PlayCircle,
  Key,
  Search,
  Filter,
  UserCheck,
  UserX,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Lock,
  Copy,
  ShieldAlert,
  XCircle,
  CheckCircle2,
} from 'lucide-react';

export const BranchStaffManagementScreen: React.FC = () => {
  const {
    currentBranch,
    users,
    createUser,
    deleteUser,
    updateUser,
    updateUserStatus,
    managerAccessRequests,
    respondManagerAccess,
    revokeManagerAccess,
    addToast,
  } = useApp();

  // Search & Filter state
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<'all' | Role>('all');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [staffViewMode, setStaffViewMode] = useState<'cards' | 'table'>('cards');

  // Modals state
  const [createStaffModalOpen, setCreateStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffId, setNewStaffId] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<Role>('cashier');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffInitial, setNewStaffInitial] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('password123');
  const [newStaffPin, setNewStaffPin] = useState('1234');

  const [editStaffModal, setEditStaffModal] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Role>('cashier');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('password123');
  const [editStatus, setEditStatus] = useState<UserStatus>('active');

  const [deleteStaffModal, setDeleteStaffModal] = useState<User | null>(null);
  const [resetPinModal, setResetPinModal] = useState<{ user: User; newPin: string } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // STRICT REQUIREMENT: Only subordinate staff who work in this branch UNDER the manager
  // Cannot see/edit other managers, owner, or own account
  const subordinateRoles: Role[] = [
    'cashier',
    'kitchen_staff',
    'floor_staff',
    'delivery_staff',
  ];

  const subordinates = users.filter(
    (u) =>
      u.branchId === currentBranch.id &&
      subordinateRoles.includes(u.role)
  );

  const activeStaffCount = subordinates.filter((u) => u.status === 'active').length;
  const suspendedStaffCount = subordinates.filter((u) => u.status === 'suspended').length;
  const cashierCount = subordinates.filter((u) => u.role === 'cashier').length;
  const kitchenCount = subordinates.filter((u) => u.role === 'kitchen_staff').length;
  const floorCount = subordinates.filter((u) => u.role === 'floor_staff').length;
  const deliveryCount = subordinates.filter((u) => u.role === 'delivery_staff').length;

  const filteredStaff = subordinates.filter((u) => {
    const q = staffSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q) ||
      u.phone.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q);

    const matchesRole = staffRoleFilter === 'all' || u.role === staffRoleFilter;
    const matchesStatus = staffStatusFilter === 'all' || u.status === staffStatusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Action Handlers
  const managerBranchSlug = getBranchEmailSlug(currentBranch.id, currentBranch.name, currentBranch.city);

  const handleOpenCreateStaff = () => {
    const randCode = Math.floor(1000 + Math.random() * 9000);
    setNewStaffId(`stf-${randCode}`);
    setNewStaffName('');
    setNewStaffPhone('+92 300 ');
    setNewStaffInitial('');
    setNewStaffEmail('');
    setNewStaffPassword('password123');
    setNewStaffRole('cashier');
    setNewStaffPin(Math.floor(1000 + Math.random() * 9000).toString());
    setCreateStaffModalOpen(true);
  };

  const handleCreateStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) {
      addToast({ type: 'warning', title: 'Name Required', message: 'Please enter staff member name.' });
      return;
    }
    const staffId = newStaffId.trim() || `stf-${Date.now().toString().slice(-5)}`;
    const cleanInitial = newStaffInitial.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') || newStaffRole;
    const finalEmail = `${cleanInitial}.${managerBranchSlug}@foodiescafe.pk`;

    createUser({
      id: staffId,
      name: newStaffName.trim(),
      role: newStaffRole,
      phone: newStaffPhone.trim() || '+92 300 0000000',
      email: finalEmail,
      password: newStaffPassword.trim() || 'password123',
      pin: newStaffPin.trim() || '1234',
      branchId: currentBranch.id,
      status: 'active',
    });
    addToast({
      type: 'success',
      title: 'Staff ID & Account Issued',
      message: `Staff ID ${staffId} created for ${newStaffName} (${newStaffRole.replace('_', ' ')}) with reserved email ${finalEmail}.`,
    });
    setCreateStaffModalOpen(false);
  };

  const handleOpenEditStaff = (user: User) => {
    setEditStaffModal(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditPhone(user.phone);
    setEditEmail(user.email || '');
    setEditPassword(user.password || 'password123');
    setEditStatus(user.status || 'active');
  };

  const handleSaveEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaffModal) return;
    if (!editName.trim()) {
      addToast({ type: 'warning', title: 'Name Required', message: 'Staff name cannot be empty.' });
      return;
    }
    updateUser(editStaffModal.id, {
      name: editName.trim(),
      role: editRole,
      phone: editPhone.trim(),
      email: editEmail.trim(),
      status: editStatus,
      password: editPassword.trim() || editStaffModal.password || 'password123',
    });
    addToast({
      type: 'success',
      title: 'Staff ID Details Updated',
      message: `Staff ID ${editStaffModal.id} (${editName}) updated successfully — Status: ${editStatus.toUpperCase()}.`,
    });
    setEditStaffModal(null);
  };

  const handleToggleSuspendStaff = (user: User) => {
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
    updateUserStatus(user.id, nextStatus);
    addToast({
      type: nextStatus === 'suspended' ? 'warning' : 'success',
      title: nextStatus === 'suspended' ? 'Staff ID Suspended 🚫' : 'Staff ID Reactivated ✓',
      message: `${user.name}'s account (${user.id}) is now ${nextStatus.toUpperCase()}. ${nextStatus === 'suspended' ? 'Login is now blocked.' : 'Login access restored.'
        }`,
    });
  };

  const handleConfirmDeleteStaff = () => {
    if (!deleteStaffModal) return;
    const targetId = deleteStaffModal.id;
    const targetName = deleteStaffModal.name;
    deleteUser(targetId);
    addToast({
      type: 'info',
      title: 'Staff ID Deleted 🗑️',
      message: `Staff ID ${targetId} (${targetName}) permanently deleted. Station login revoked.`,
    });
    setDeleteStaffModal(null);
  };

  const handleResetPinStaff = (user: User) => {
    const freshPin = Math.floor(1000 + Math.random() * 9000).toString();
    setResetPinModal({ user, newPin: freshPin });
    setCopiedPin(false);
  };

  const handleCopyPin = (pin: string) => {
    try {
      navigator.clipboard.writeText(pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
      addToast({ type: 'success', title: 'PIN Copied', message: `Copied PIN ${pin} to clipboard.` });
    } catch (e) { }
  };

  const getRoleBadgeStyle = (role: Role) => {
    switch (role) {
      case 'cashier':
        return { color: '#16A34A', bg: '#DCFCE7', label: 'Cashier' };
      case 'kitchen_staff':
        return { color: '#EA580C', bg: 'rgba(234, 88, 12, 0.12)', label: 'Kitchen Chef' };
      case 'floor_staff':
        return { color: '#2563EB', bg: '#DBEAFE', label: 'Floor Waiter' };
      case 'delivery_staff':
        return { color: '#0891B2', bg: '#CFFAFE', label: 'Delivery Rider' };
      default:
        return { color: 'var(--text-secondary)', bg: 'var(--bg-card-subtle)', label: role };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner / Breadcrumb (Desktop Only) */}
      <div
        className="bm-staff-header-desktop"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flex: 1 }}>
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
              <Users size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Branch Staff & Accounts Administration
              </h1>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '3px 0 0' }}>
                Branch: <strong>{currentBranch.name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateStaff}
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 750,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.25)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <UserPlus size={16} />
            <span>+ Create Staff ID / Account</span>
          </button>
        </div>
      </div>

      {/* Mobile Single Card (Small Screen Only) */}
      <div
        className="bm-staff-card-mobile"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Top Row: Branch Team xyz IDs (left) & + Create Staff ID (top right) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
            Branch Team {subordinates.length} IDs
          </div>
          <button
            onClick={handleOpenCreateStaff}
            style={{
              padding: '7px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 750,
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            <UserPlus size={14} />
            <span>+ Create Staff ID</span>
          </button>
        </div>

        {/* Below that line: Active xyz */}
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803D', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A', display: 'inline-block' }} />
          <span>Active {activeStaffCount}</span>
        </div>

        {/* Below that line: Suspended xyz */}
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#B45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706', display: 'inline-block' }} />
          <span>Suspended {suspendedStaffCount}</span>
        </div>

        {/* Below that: all staff members who work under him in one row, and below each word the number of people */}
        <div
          style={{
            marginTop: '2px',
            backgroundColor: 'var(--bg-card-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            padding: '10px 6px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '4px',
            textAlign: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>Cashiers</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>{cashierCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>Kitchen</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>{kitchenCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>Waiters</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>{floorCount}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: 0 }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>Riders</span>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>{deliveryCount}</span>
          </div>
        </div>
      </div>


      {/* Platform Owner Manager-Mode Access Delegation Request Card */}
      {(() => {
        const req = managerAccessRequests[currentBranch.id];
        if (!req || req.status === 'none') return null;

        const isPending = req.status === 'pending';
        const isApproved = req.status === 'approved';
        const isRejected = req.status === 'rejected';

        return (
          <div
            style={{
              backgroundColor: isPending ? 'rgba(234, 88, 12, 0.08)' : isApproved ? 'rgba(22, 163, 74, 0.08)' : 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: `1.5px solid ${isPending ? '#EA580C' : isApproved ? '#16A34A' : 'var(--border-color)'}`,
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: isPending ? '#EA580C' : isApproved ? '#16A34A' : 'var(--bg-card-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isPending || isApproved ? '#FFFFFF' : 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert size={20} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Platform Owner Manager-Mode Access Request</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isPending ? '#FEF3C7' : isApproved ? '#DCFCE7' : '#FEE2E2',
                      color: isPending ? '#B45309' : isApproved ? '#15803D' : '#B91C1C',
                      textTransform: 'uppercase',
                    }}
                  >
                    {req.status}
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {isPending && (
                    <span>
                      Platform Owner (<strong>{req.requestedBy || 'Malik Jahangir'}</strong>) has requested temporary authorization to switch into Manager Mode for <strong>{currentBranch.name}</strong>. Both parties must agree.
                    </span>
                  )}
                  {isApproved && (
                    <span>
                      Platform Owner (<strong>{req.requestedBy || 'Malik Jahangir'}</strong>) is currently authorized to act as Branch Manager for this branch.
                    </span>
                  )}
                  {isRejected && (
                    <span>
                      Platform Owner request for Manager Mode access was declined.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {isPending && (
                <>
                  <button
                    onClick={() => respondManagerAccess(currentBranch.id, true)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 750,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)',
                    }}
                  >
                    <CheckCircle2 size={15} />
                    <span>Accept & Allow Manager Mode</span>
                  </button>
                  <button
                    onClick={() => respondManagerAccess(currentBranch.id, false)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      color: '#DC2626',
                      fontWeight: 700,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <XCircle size={15} />
                    <span>Decline</span>
                  </button>
                </>
              )}
              {isApproved && (
                <button
                  onClick={() => revokeManagerAccess(currentBranch.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #DC2626',
                    color: '#DC2626',
                    fontWeight: 750,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Revoke Owner Access
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Main Container */}
      <div
        className="bm-staff-main-container"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Quick KPI Badges (Desktop Only) */}
        <div className="bm-staff-desktop-kpis" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', paddingRight: '12px', borderRight: '1px solid var(--border-color)' }}>
            <span>Branch Team Under Manager:</span>
            <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', fontWeight: 800 }}>
              {subordinates.length} IDs
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#15803D', paddingRight: '12px', borderRight: '1px solid var(--border-color)' }}>
            <span>Active on Duty:</span>
            <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: '#DCFCE7', color: '#15803D', fontWeight: 800 }}>
              {activeStaffCount}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#B45309', paddingRight: '12px', borderRight: '1px solid var(--border-color)' }}>
            <span>Suspended (Login Blocked):</span>
            <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: 800 }}>
              {suspendedStaffCount}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
            <span>Cashiers: <strong>{cashierCount}</strong></span>
            <span>·</span>
            <span>Kitchen: <strong>{kitchenCount}</strong></span>
            <span>·</span>
            <span>Waiters: <strong>{floorCount}</strong></span>
            <span>·</span>
            <span>Riders: <strong>{deliveryCount}</strong></span>
          </div>
        </div>

        {/* Search, Filter & View Controls (Desktop Only) */}
        <div className="bm-staff-controls-desktop" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '380px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by Name, Staff ID, Phone, Role..."
              value={staffSearchQuery}
              onChange={(e) => setStaffSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                fontSize: '13px',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
          </div>

          {/* Role Filters */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {(['all', 'cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff'] as const).map((r) => {
              const label =
                r === 'all'
                  ? 'All Roles'
                  : r === 'kitchen_staff'
                    ? 'Kitchen'
                    : r === 'floor_staff'
                      ? 'Waiters'
                      : r === 'delivery_staff'
                        ? 'Riders'
                        : 'Cashiers';
              const active = staffRoleFilter === r;
              return (
                <button
                  key={r}
                  onClick={() => setStaffRoleFilter(r)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    border: active ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: active ? 'var(--primary)' : 'var(--bg-card-subtle)',
                    color: active ? '#FFFFFF' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Status Filter & View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={staffStatusFilter}
              onChange={(e) => setStaffStatusFilter(e.target.value as any)}
              style={{
                padding: '7px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                fontSize: '12px',
                fontWeight: 650,
                color: 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>

            <div style={{ display: 'flex', backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-md)', padding: '2px', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setStaffViewMode('cards')}
                title="ID Cards Badge View"
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: staffViewMode === 'cards' ? 'var(--primary)' : 'transparent',
                  color: staffViewMode === 'cards' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setStaffViewMode('table')}
                title="Table View"
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: staffViewMode === 'table' ? 'var(--primary)' : 'transparent',
                  color: staffViewMode === 'table' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Controls (Small Screen Only: Horizontally Scrollable Roles + Search & Grid/Row in One Row) */}
        <div className="bm-staff-controls-mobile" style={{ flexDirection: 'column', gap: '12px' }}>
          {/* Horizontally Scrollable Row of Roles */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '4px',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {[
              { id: 'all', label: 'All Roles' },
              { id: 'cashier', label: 'Cashiers' },
              { id: 'kitchen_staff', label: 'Kitchen' },
              { id: 'floor_staff', label: 'Waiters' },
              { id: 'delivery_staff', label: 'Riders' },
            ].map(({ id, label }) => {
              const active = staffRoleFilter === id;
              return (
                <button
                  key={id}
                  onClick={() => setStaffRoleFilter(id as any)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-full)',
                    border: active ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    backgroundColor: active ? 'var(--primary)' : 'var(--bg-card-subtle)',
                    color: active ? '#FFFFFF' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? '0 2px 6px rgba(234, 88, 12, 0.2)' : 'none',
                    flexShrink: 0,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Search + Grid Style + Row Style All In One Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
            }}
          >
            {/* Search Bar */}
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Search
                size={14}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Search staff by name, ID, phone..."
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  fontSize: '12px',
                  color: 'var(--text-main)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Grid & Row Style Toggle Buttons */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '2px',
                border: '1px solid var(--border-color)',
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => setStaffViewMode('cards')}
                title="Grid Style"
                aria-label="Grid Style"
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: staffViewMode === 'cards' ? 'var(--primary)' : 'transparent',
                  color: staffViewMode === 'cards' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                onClick={() => setStaffViewMode('table')}
                title="Row Style (Table View)"
                aria-label="Row Style (Table View)"
                style={{
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: staffViewMode === 'table' ? 'var(--primary)' : 'transparent',
                  color: staffViewMode === 'table' ? '#FFFFFF' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Staff Members List: Card View or Table View */}
        {filteredStaff.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-card-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-color)',
              color: 'var(--text-muted)',
              fontSize: '13px',
            }}
          >
            No staff IDs found matching your filters for this branch. Click <strong>"+ Create Staff ID / Account"</strong> to issue an employee account.
          </div>
        ) : staffViewMode === 'cards' ? (
          /* ID CARDS BADGES GRID: Static width locked so single cards never blow up across screen */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 340px))', gap: '16px', justifyContent: 'flex-start' }}>
            {filteredStaff.map((s) => {
              const roleBadge = getRoleBadgeStyle(s.role);
              const isSuspended = s.status === 'suspended';
              const isDeactivated = s.status === 'deactivated';

              return (
                <div
                  key={s.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    border: `1.5px solid ${isSuspended ? '#FDE68A' : isDeactivated ? '#FCA5A5' : 'var(--border-color)'}`,
                    padding: '16px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    position: 'relative',
                    maxWidth: '340px',
                    width: '100%',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Card Top Header: ID Code + Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-card-subtle)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        ID: {s.id}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 850,
                        textTransform: 'uppercase',
                        padding: '3px 9px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: isDeactivated ? '#FEE2E2' : isSuspended ? '#FEF3C7' : '#DCFCE7',
                        color: isDeactivated ? '#B91C1C' : isSuspended ? '#B45309' : '#15803D',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isDeactivated ? '#DC2626' : isSuspended ? '#D97706' : '#16A34A' }} />
                      {s.status}
                    </span>
                  </div>

                  {/* Employee Details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        backgroundColor: roleBadge.bg,
                        color: roleBadge.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {s.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '14.5px', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.name}
                      </div>
                      <div style={{ marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: roleBadge.bg,
                            color: roleBadge.color,
                          }}
                        >
                          {roleBadge.label}
                        </span>

                        {s.role === 'delivery_staff' && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: s.riderAvailability === 'offline' ? '#F1F5F9' : '#DCFCE7',
                              color: s.riderAvailability === 'offline' ? '#475569' : '#15803D',
                              border: `1px solid ${s.riderAvailability === 'offline' ? '#CBD5E1' : '#86EFAC'}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: s.riderAvailability === 'offline' ? '#64748B' : '#16A34A',
                              }}
                            />
                            {s.riderAvailability === 'offline' ? 'Offline' : 'Online (Ready)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)', padding: '8px 10px', backgroundColor: 'var(--bg-card-subtle)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={12} color="var(--primary)" />
                      <span>{s.phone}</span>
                    </div>
                    {s.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Mail size={12} color="var(--text-muted)" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Login Credentials & Station Access */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: '#F0FDF4', borderRadius: '6px', border: '1px solid #DCFCE7', fontSize: '11px', color: '#166534' }}>
                    <span>🔑 Password: <strong>password123</strong></span>
                    <span>•</span>
                    <span>PIN: <strong>1234</strong></span>
                  </div>

                  {/* Actions Toolbar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                    {/* Suspend / Reactivate Action */}
                    <button
                      onClick={() => handleToggleSuspendStaff(s)}
                      title={isSuspended ? 'Reactivate Staff Access' : 'Suspend Staff Access (Blocks Login)'}
                      style={{
                        padding: '6px 4px',
                        borderRadius: '6px',
                        border: `1px solid ${isSuspended ? '#16A34A' : '#D97706'}`,
                        backgroundColor: isSuspended ? '#DCFCE7' : '#FEF3C7',
                        color: isSuspended ? '#15803D' : '#B45309',
                        fontSize: '11px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      {isSuspended ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                      <span>{isSuspended ? 'Unsuspend' : 'Suspend'}</span>
                    </button>

                    {/* Edit Details Action */}
                    <button
                      onClick={() => handleOpenEditStaff(s)}
                      title="Edit Staff ID & Role"
                      style={{
                        padding: '6px 4px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-main)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Edit size={13} color="var(--text-secondary)" />
                      <span>Edit</span>
                    </button>

                    {/* Reset PIN Action */}
                    <button
                      onClick={() => handleResetPinStaff(s)}
                      title="Generate New Access PIN"
                      style={{
                        padding: '6px 4px',
                        borderRadius: '6px',
                        border: '1px solid rgba(147, 51, 234, 0.3)',
                        backgroundColor: '#F3E8FF',
                        color: '#7E22CE',
                        fontSize: '11px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Key size={13} />
                      <span>PIN</span>
                    </button>

                    {/* Delete Action */}
                    <button
                      onClick={() => setDeleteStaffModal(s)}
                      title="Delete Staff ID"
                      style={{
                        padding: '6px 4px',
                        borderRadius: '6px',
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        backgroundColor: '#FEE2E2',
                        color: '#DC2626',
                        fontSize: '11px',
                        fontWeight: 750,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TABLE VIEW (Row Style - Horizontally Scrollable) */
          <div
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              width: '100%',
            }}
          >
            <table style={{ width: '100%', minWidth: '720px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 14px' }}>Staff ID</th>
                  <th style={{ padding: '12px 14px' }}>Staff Name</th>
                  <th style={{ padding: '12px 14px' }}>Role</th>
                  <th style={{ padding: '12px 14px' }}>Phone</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s) => {
                  const roleBadge = getRoleBadgeStyle(s.role);
                  const isSuspended = s.status === 'suspended';
                  const isDeactivated = s.status === 'deactivated';

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 800 }}>
                        {s.id}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 750, color: 'var(--text-main)' }}>
                        {s.name}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: roleBadge.bg,
                              color: roleBadge.color,
                            }}
                          >
                            {roleBadge.label}
                          </span>
                          {s.role === 'delivery_staff' && (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: 'var(--radius-full)',
                                backgroundColor: s.riderAvailability === 'offline' ? '#F1F5F9' : '#DCFCE7',
                                color: s.riderAvailability === 'offline' ? '#475569' : '#15803D',
                                border: `1px solid ${s.riderAvailability === 'offline' ? '#CBD5E1' : '#86EFAC'}`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <span
                                style={{
                                  width: '5px',
                                  height: '5px',
                                  borderRadius: '50%',
                                  backgroundColor: s.riderAvailability === 'offline' ? '#64748B' : '#16A34A',
                                }}
                              />
                              {s.riderAvailability === 'offline' ? 'Offline' : 'Online'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        {s.phone}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
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
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleToggleSuspendStaff(s)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '4px',
                              border: `1px solid ${isSuspended ? '#16A34A' : '#D97706'}`,
                              backgroundColor: isSuspended ? '#DCFCE7' : '#FEF3C7',
                              color: isSuspended ? '#15803D' : '#B45309',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {isSuspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                          <button
                            onClick={() => handleOpenEditStaff(s)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-card)',
                              fontSize: '11.5px',
                              fontWeight: 650,
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleResetPinStaff(s)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '4px',
                              border: '1px solid rgba(147, 51, 234, 0.3)',
                              backgroundColor: '#F3E8FF',
                              color: '#7E22CE',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            PIN
                          </button>
                          <button
                            onClick={() => setDeleteStaffModal(s)}
                            style={{
                              padding: '5px 9px',
                              borderRadius: '4px',
                              border: '1px solid rgba(220, 38, 38, 0.3)',
                              backgroundColor: '#FEE2E2',
                              color: '#DC2626',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: Create Staff ID / Account */}
      {createStaffModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                New Staff
              </h3>
              <button
                onClick={() => setCreateStaffModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateStaffSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Role Selection */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Role Selection (Under Manager) *
                </label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as Role)}
                  style={{
                    width: '100%',
                    padding: '9px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13px',
                    color: 'var(--text-main)',
                    fontWeight: 650,
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="cashier">Cashier</option>
                  <option value="kitchen_staff">Kitchen Chef</option>
                  <option value="floor_staff">Floor Waiter</option>
                  <option value="delivery_staff">Delivery Rider</option>
                </select>
              </div>

              {/* Reserved Branch Email Generation */}
              {(() => {
                return (
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                      Email *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                      <input
                        type="text"
                        value={newStaffInitial}
                        onChange={(e) => setNewStaffInitial(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                        placeholder="Enter email (e.g. asad, chef, cashier)"
                        required
                        style={{
                          flex: 1,
                          padding: '9px 12px',
                          borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          borderRight: 'none',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-main)',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 12px',
                          backgroundColor: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '0 var(--radius-md) var(--radius-md) 0',
                          fontSize: '13px',
                          fontWeight: 750,
                          color: 'var(--primary)',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                        }}
                      >
                        .{managerBranchSlug}@foodiescafe.pk
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tariq Jamil"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '13.5px',
                      color: 'var(--text-main)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Staff ID Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={newStaffId}
                    onChange={(e) => setNewStaffId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      fontWeight: 750,
                      color: 'var(--text-main)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Mobile Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+92 300 1234567"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '13.5px',
                      color: 'var(--text-main)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Create Password *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0 10px' }}>
                    <Lock size={15} color="var(--primary)" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. password123"
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 0',
                        border: 'none',
                        outline: 'none',
                        backgroundColor: 'transparent',
                        fontSize: '13px',
                        color: 'var(--text-main)',
                        fontWeight: 650,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Assigned Branch
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentBranch.name}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      fontSize: '12.5px',
                      color: 'var(--text-muted)',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Default Access PIN
                  </label>
                  <input
                    type="text"
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      fontWeight: 750,
                      color: 'var(--primary)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setCreateStaffModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 750,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Create & Issue Staff ID
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Staff Details */}
      {editStaffModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Edit Staff
              </h3>
              <button
                onClick={() => setEditStaffModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13.5px',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Role (Under Manager) *
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  style={{
                    width: '100%',
                    padding: '9px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13px',
                    color: 'var(--text-main)',
                    fontWeight: 650,
                  }}
                >
                  <option value="cashier">Cashier</option>
                  <option value="kitchen_staff">Kitchen Chef</option>
                  <option value="floor_staff">Floor Waiter</option>
                  <option value="delivery_staff">Delivery Rider</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13.5px',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13.5px',
                    color: 'var(--text-main)',
                  }}
                />
              </div>

              {/* Edit Password */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Edit Password / Login Access *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '0 10px' }}>
                  <Lock size={15} color="var(--primary)" />
                  <input
                    type="text"
                    required
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter account password"
                    style={{
                      width: '100%',
                      padding: '9px 0',
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '13.5px',
                      color: 'var(--text-main)',
                      fontWeight: 650,
                    }}
                  />
                </div>
              </div>

              {/* Account Status */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Account Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as UserStatus)}
                  style={{
                    width: '100%',
                    padding: '9px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13px',
                    color: 'var(--text-main)',
                    fontWeight: 700,
                  }}
                >
                  <option value="active">Active (Login Allowed)</option>
                  <option value="suspended">Suspended (Access Temporarily Blocked)</option>
                  <option value="deactivated">Deactivated (Account Closed)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditStaffModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2,
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 750,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Reset PIN / Credentials Dialog */}
      {resetPinModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '420px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: '#F3E8FF',
                color: '#7E22CE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <Key size={26} />
            </div>

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Reset PIN
              </h3>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                border: '2px dashed #9333EA',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
              }}
            >
              <span style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '4px', fontFamily: 'monospace', color: '#7E22CE' }}>
                {resetPinModal.newPin}
              </span>
              <button
                onClick={() => handleCopyPin(resetPinModal.newPin)}
                title="Copy PIN"
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(147, 51, 234, 0.3)',
                  backgroundColor: '#FFFFFF',
                  color: '#7E22CE',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Copy size={13} />
                <span>{copiedPin ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Staff member can use this PIN along with their phone number to log into their portal station.
            </p>

            <button
              onClick={() => setResetPinModal(null)}
              style={{
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 750,
                fontSize: '13px',
                cursor: 'pointer',
                marginTop: '6px',
              }}
            >
              Done & Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: Delete Staff ID Confirmation */}
      {deleteStaffModal && (
        <ModalConfirmation
          isOpen={true}
          onClose={() => setDeleteStaffModal(null)}
          onConfirm={handleConfirmDeleteStaff}
          title={`Permanently Delete Staff ID ${deleteStaffModal.id}?`}
          message={`Are you sure you want to permanently delete the staff account for ${deleteStaffModal.name}? This will immediately revoke their station access and remove their credentials.`}
          details={`Staff ID: ${deleteStaffModal.id} · Role: ${deleteStaffModal.role} · Phone: ${deleteStaffModal.phone}`}
          confirmText="Yes, delete staff ID"
          cancelText="No, cancel"
          isDanger={true}
        />
      )}
    </div>
  );
};
