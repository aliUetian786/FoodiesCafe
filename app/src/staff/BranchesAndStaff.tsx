'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Role, User, UserStatus, Branch } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  Building2,
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
  ShieldCheck,
  ShieldAlert,
  MapPin,
  CheckCircle2,
  Store,
  ChefHat,
  Receipt,
  Headphones,
  Bike,
  X,
} from 'lucide-react';

export const BranchesStaffScreen: React.FC = () => {
  const { branches, users, createUser, deleteUser, updateUser, updateUserStatus, updateBranchSettings, addToast } = useApp();

  // Branch Location Edit state (Owner & Manager)
  const [editingBranchLocation, setEditingBranchLocation] = useState<Branch | null>(null);
  const [branchEditForm, setBranchEditForm] = useState({
    name: '',
    city: '',
    address: '',
    phone: '',
    latitude: 31.5126,
    longitude: 74.3436,
    maxOrderDistanceKm: 50,
    tableQrMaxDistanceMeters: 300,
  });

  // Primary Tab: Staff vs Branch entities
  const [activeTab, setActiveTab] = useState<'staff' | 'branches'>('staff');

  // Branch separation: active branch filter tab (never dump all in one place)
  const [selectedBranchTab, setSelectedBranchTab] = useState<string>('all');
  const [staffRoleFilter, setStaffRoleFilter] = useState<'all' | Role>('all');
  const [staffStatusFilter, setStaffStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modals state
  const [createStaffModalOpen, setCreateStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffId, setNewStaffId] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<Role>('cashier');
  const [newStaffBranch, setNewStaffBranch] = useState(branches[0]?.id || 'gulberg-lahore');
  const [newStaffPhone, setNewStaffPhone] = useState('+92 300 ');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('password123');
  const [newStaffPin, setNewStaffPin] = useState('1234');

  const [editStaffModal, setEditStaffModal] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<Role>('cashier');
  const [editBranch, setEditBranch] = useState('gulberg-lahore');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('password123');

  const [deleteStaffModal, setDeleteStaffModal] = useState<User | null>(null);
  const [resetPinModal, setResetPinModal] = useState<{ user: User; newPin: string } | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);

  // STRICT REQUIREMENT: Owner CANNOT see customers and CANNOT see platform_owner
  const staffOnly = users.filter((u) => u.role !== 'customer' && u.role !== 'platform_owner');

  // Predefined Staff Roles for Owner creation (No Customer, No Platform Owner)
  const availableRoles: { role: Role; label: string; icon: any }[] = [
    { role: 'branch_manager', label: 'Branch Manager', icon: Store },
    { role: 'cashier', label: 'Cashier', icon: Receipt },
    { role: 'kitchen_staff', label: 'Kitchen Chef', icon: ChefHat },
    { role: 'floor_staff', label: 'Floor Waiter', icon: LayoutGrid },
    { role: 'branch_representative', label: 'Customer Services', icon: Headphones },
    { role: 'delivery_staff', label: 'Delivery Rider', icon: Bike },
  ];

  const getRoleBadgeStyle = (role: Role) => {
    switch (role) {
      case 'branch_manager':
        return { color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.12)', label: 'Branch Manager' };
      case 'cashier':
        return { color: '#16A34A', bg: '#DCFCE7', label: 'Cashier' };
      case 'kitchen_staff':
        return { color: '#EA580C', bg: 'rgba(234, 88, 12, 0.12)', label: 'Kitchen Chef' };
      case 'floor_staff':
        return { color: '#2563EB', bg: '#DBEAFE', label: 'Floor Waiter' };
      case 'branch_representative':
        return { color: '#9333EA', bg: '#F3E8FF', label: 'Customer Services' };
      case 'delivery_staff':
        return { color: '#0891B2', bg: '#CFFAFE', label: 'Delivery Rider' };
      default:
        return { color: 'var(--text-secondary)', bg: 'var(--bg-card-subtle)', label: role };
    }
  };

  // Create Staff Handlers
  const handleOpenCreateStaff = (targetBranchId?: string) => {
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const randPin = Math.floor(1000 + Math.random() * 9000).toString();
    const branchToUse = targetBranchId || (selectedBranchTab !== 'all' ? selectedBranchTab : branches[0]?.id || 'gulberg-lahore');

    setNewStaffId(`stf-${randCode}`);
    setNewStaffName('');
    setNewStaffPhone('+92 300 ');
    setNewStaffEmail('');
    setNewStaffPassword('password123');
    setNewStaffRole('cashier');
    setNewStaffBranch(branchToUse);
    setNewStaffPin(randPin);
    setCreateStaffModalOpen(true);
  };

  const handleCreateStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) {
      addToast({ type: 'warning', title: 'Name Required', message: 'Please enter staff member name.' });
      return;
    }
    const staffId = newStaffId.trim() || `stf-${Date.now().toString().slice(-5)}`;
    createUser({
      id: staffId,
      name: newStaffName.trim(),
      role: newStaffRole,
      branchId: newStaffBranch,
      phone: newStaffPhone.trim() || '+92 300 0000000',
      email: newStaffEmail.trim() || `${staffId}@foodiescafe.pk`,
      password: newStaffPassword.trim() || 'password123',
      pin: newStaffPin.trim() || '1234',
      status: 'active',
    });

    const bName = branches.find((b) => b.id === newStaffBranch)?.name || 'Branch';
    addToast({
      type: 'success',
      title: 'Staff Login Provisioned ✓',
      message: `Staff ID ${staffId} issued for ${newStaffName} (${newStaffRole.replace('_', ' ')}) at ${bName}.`,
    });
    setCreateStaffModalOpen(false);
  };

  // Edit Staff Handlers
  const handleOpenEditStaff = (user: User) => {
    setEditStaffModal(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditBranch(user.branchId || branches[0]?.id || 'gulberg-lahore');
    setEditPhone(user.phone);
    setEditEmail(user.email || '');
    setEditPassword(user.password || 'password123');
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
      branchId: editBranch,
      phone: editPhone.trim(),
      email: editEmail.trim(),
      password: editPassword.trim() || editStaffModal.password || 'password123',
    });
    addToast({
      type: 'success',
      title: 'Staff Account Updated',
      message: `Updated profile details for ${editName} (${editStaffModal.id}).`,
    });
    setEditStaffModal(null);
  };

  // Suspend/Reactivate Handler
  const handleToggleSuspendStaff = (user: User) => {
    const nextStatus = user.status === 'suspended' ? 'active' : 'suspended';
    updateUserStatus(user.id, nextStatus);
    addToast({
      type: nextStatus === 'suspended' ? 'warning' : 'success',
      title: nextStatus === 'suspended' ? 'Staff Login Suspended 🚫' : 'Staff Login Restored ✓',
      message: `${user.name} (${user.id}) is now ${nextStatus.toUpperCase()}. ${
        nextStatus === 'suspended' ? 'Branch login revoked immediately.' : 'Branch login access active.'
      }`,
    });
  };

  // Delete Staff Handler
  const handleConfirmDeleteStaff = () => {
    if (!deleteStaffModal) return;
    const targetId = deleteStaffModal.id;
    const targetName = deleteStaffModal.name;
    deleteUser(targetId);
    addToast({
      type: 'info',
      title: 'Staff Account Deleted 🗑️',
      message: `Permanently removed staff account ${targetId} (${targetName}).`,
    });
    setDeleteStaffModal(null);
  };

  // Reset PIN Handler
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
      addToast({ type: 'success', title: 'PIN Copied', message: `Copied access PIN ${pin} to clipboard.` });
    } catch (e) {}
  };

  // Filter staff based on selected branch tab, role, status, and search query
  const getBranchStaff = (branchId: string) => {
    return staffOnly.filter((u) => {
      const belongs = u.branchId === branchId;
      if (!belongs) return false;

      const q = searchQuery.toLowerCase().trim();
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
  };

  // Branch dropdown priority order: F-7 Markaz, Clifton Block 4, Gulberg Branch (Flagship)
  const branchOrderPriority = (nameOrId: string) => {
    const s = (nameOrId || '').toLowerCase();
    if (s.includes('f-7') || s.includes('f7')) return 1;
    if (s.includes('clifton')) return 2;
    if (s.includes('gulberg')) return 3;
    return 4;
  };

  const sortedBranchesForDropdown = [...branches].sort(
    (a, b) => branchOrderPriority(a.name || a.id) - branchOrderPriority(b.name || b.id)
  );

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
      {/* Top Header Card */}
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
            <Building2 size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Multi-Branch Staff & Access Administration
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-card-subtle)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setActiveTab('staff')}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                backgroundColor: activeTab === 'staff' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'staff' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: 750,
                fontSize: '12.5px',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Branch Staff ({staffOnly.length})
            </button>
            <button
              onClick={() => setActiveTab('branches')}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                backgroundColor: activeTab === 'branches' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'branches' ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: 750,
                fontSize: '12.5px',
                cursor: 'pointer',
                border: 'none',
              }}
            >
              Branch Entities ({branches.length})
            </button>
          </div>

          <button
            onClick={() => handleOpenCreateStaff()}
            style={{
              padding: '9px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              boxShadow: '0 2px 8px var(--primary-glow)',
            }}
          >
            <UserPlus size={16} />
            <span>+ Create Staff Member</span>
          </button>
        </div>
      </div>

      {activeTab === 'staff' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* BRANCH SELECTION DROPDOWN & VIEW MODE TOGGLE */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Select Branch:
              </span>

              <select
                id="branch-staff-select-branch"
                value={selectedBranchTab}
                onChange={(e) => setSelectedBranchTab(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  minWidth: '240px',
                  outline: 'none',
                }}
              >
                <option value="all">All Branches ({staffOnly.length})</option>
                {sortedBranchesForDropdown.map((b) => {
                  const bStaffCount = staffOnly.filter((u) => u.branchId === b.id).length;
                  return (
                    <option key={b.id} value={b.id}>
                      {b.name} {bStaffCount}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* View Mode Toggle: Cards | Table (In same line after dropdown) */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-card-subtle)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button
                id="branch-staff-view-cards"
                onClick={() => setViewMode('cards')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: viewMode === 'cards' ? 'var(--primary)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: viewMode === 'cards' ? '#FFFFFF' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  transition: 'all 0.18s ease',
                }}
              >
                <LayoutGrid size={14} />
                <span>Cards</span>
              </button>
              <button
                id="branch-staff-view-table"
                onClick={() => setViewMode('table')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  backgroundColor: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: viewMode === 'table' ? '#FFFFFF' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 750,
                  transition: 'all 0.18s ease',
                }}
              >
                <List size={14} />
                <span>Table</span>
              </button>
            </div>
          </div>

          {/* Search, Staff Roles & Statuses Bar (All 3 in one line) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '12px 18px',
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              boxShadow: 'var(--shadow-sm)',
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
                minWidth: 0,
              }}
            >
              <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <input
                id="branch-staff-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, ID, mobile, or role..."
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

            <select
              id="branch-staff-role-filter"
              value={staffRoleFilter}
              onChange={(e) => setStaffRoleFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 600,
                minWidth: '160px',
                flexShrink: 0,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">All Staff Roles</option>
              {availableRoles.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              id="branch-staff-status-filter"
              value={staffStatusFilter}
              onChange={(e) => setStaffStatusFilter(e.target.value as any)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 600,
                minWidth: '140px',
                flexShrink: 0,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>

          {/* BRANCH SECTIONS (Showing staff by their branch) */}
          {branches
            .filter((b) => selectedBranchTab === 'all' || selectedBranchTab === b.id)
            .map((branch) => {
              const branchStaff = getBranchStaff(branch.id);

              return (
                <div
                  key={branch.id}
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
                  {/* Branch Group Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid var(--border-color)',
                      paddingBottom: '12px',
                      flexWrap: 'wrap',
                      gap: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                          {branch.name}
                        </h3>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {branch.city} · {branch.address}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          backgroundColor: 'var(--bg-card-subtle)',
                          color: 'var(--text-main)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-full)',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        {branchStaff.length} Members
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenCreateStaff(branch.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--primary)',
                        fontWeight: 750,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <UserPlus size={14} />
                      <span>+ Add Staff to {branch.name.split(' ')[0]}</span>
                    </button>
                  </div>

                  {branchStaff.length === 0 ? (
                    <div
                      style={{
                        padding: '24px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '13px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      No staff members found for {branch.name} matching the selected filters.
                    </div>
                  ) : viewMode === 'cards' ? (
                    /* CARDS ROSTER VIEW */
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '14px',
                        maxHeight: '440px',
                        overflowY: 'auto',
                        paddingRight: '4px',
                      }}
                    >
                      {branchStaff.map((u) => {
                        const roleStyle = getRoleBadgeStyle(u.role);
                        const isSuspended = u.status === 'suspended';

                        return (
                          <div
                            key={u.id}
                            style={{
                              backgroundColor: isSuspended ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-card)',
                              border: `1px solid ${isSuspended ? '#DC2626' : 'var(--border-color)'}`,
                              borderRadius: 'var(--radius-md)',
                              padding: '16px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              position: 'relative',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                                  {u.name}
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                  ID: {u.id}
                                </span>
                              </div>

                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: 'var(--radius-full)',
                                  backgroundColor: roleStyle.bg,
                                  color: roleStyle.color,
                                  textTransform: 'uppercase',
                                }}
                              >
                                {roleStyle.label}
                              </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Phone size={13} color="var(--text-muted)" />
                                <span>{u.phone}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mail size={13} color="var(--text-muted)" />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {u.email || 'No email registered'}
                                </span>
                              </div>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderTop: '1px solid var(--border-color)',
                                paddingTop: '10px',
                                marginTop: 'auto',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: isSuspended ? '#FEE2E2' : '#DCFCE7',
                                  color: isSuspended ? '#B91C1C' : '#15803D',
                                }}
                              >
                                {isSuspended ? 'Suspended' : 'Active'}
                              </span>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  onClick={() => handleResetPinStaff(u)}
                                  title="Reset Login PIN"
                                  style={{
                                    padding: '5px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--bg-card-subtle)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  <Key size={12} color="var(--primary)" />
                                  <span>PIN</span>
                                </button>

                                <button
                                  onClick={() => handleOpenEditStaff(u)}
                                  title="Edit Profile"
                                  style={{
                                    padding: '5px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: 'var(--bg-card-subtle)',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  <Edit size={12} />
                                  <span>Edit</span>
                                </button>

                                <button
                                  onClick={() => handleToggleSuspendStaff(u)}
                                  title={isSuspended ? 'Reactivate Login' : 'Suspend Login'}
                                  style={{
                                    padding: '5px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: isSuspended ? '#DCFCE7' : '#FEF3C7',
                                    border: `1px solid ${isSuspended ? '#16A34A' : '#D97706'}`,
                                    color: isSuspended ? '#15803D' : '#B45309',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  {isSuspended ? 'Activate' : 'Suspend'}
                                </button>

                                <button
                                  onClick={() => setDeleteStaffModal(u)}
                                  title="Delete Staff Account"
                                  style={{
                                    padding: '5px 8px',
                                    borderRadius: '4px',
                                    backgroundColor: '#FEE2E2',
                                    border: '1px solid #DC2626',
                                    color: '#DC2626',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* TABLE ROSTER VIEW (Scrollable inside card) */
                    <div
                      style={{
                        overflowX: 'auto',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>
                            <th style={{ padding: '12px 16px' }}>Staff ID & Name</th>
                            <th style={{ padding: '12px 16px' }}>Assigned Role</th>
                            <th style={{ padding: '12px 16px' }}>Contact Phone</th>
                            <th style={{ padding: '12px 16px' }}>Email Address</th>
                            <th style={{ padding: '12px 16px' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Security Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branchStaff.map((u) => {
                            const roleStyle = getRoleBadgeStyle(u.role);
                            const isSuspended = u.status === 'suspended';

                            return (
                              <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px 16px' }}>
                                  <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{u.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                    {u.id}
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 800,
                                      padding: '3px 8px',
                                      borderRadius: 'var(--radius-full)',
                                      backgroundColor: roleStyle.bg,
                                      color: roleStyle.color,
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    {roleStyle.label}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                                  {u.phone}
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                                  {u.email || '—'}
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: 800,
                                      textTransform: 'uppercase',
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      backgroundColor: isSuspended ? '#FEE2E2' : '#DCFCE7',
                                      color: isSuspended ? '#B91C1C' : '#15803D',
                                    }}
                                  >
                                    {isSuspended ? 'Suspended' : 'Active'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                    <button
                                      onClick={() => handleResetPinStaff(u)}
                                      style={{
                                        padding: '5px 8px',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--bg-card-subtle)',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '11.5px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Reset PIN
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditStaff(u)}
                                      style={{
                                        padding: '5px 8px',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--bg-card-subtle)',
                                        border: '1px solid var(--border-color)',
                                        fontSize: '11.5px',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleToggleSuspendStaff(u)}
                                      style={{
                                        padding: '5px 8px',
                                        borderRadius: '4px',
                                        backgroundColor: isSuspended ? '#DCFCE7' : '#FEF3C7',
                                        border: `1px solid ${isSuspended ? '#16A34A' : '#D97706'}`,
                                        color: isSuspended ? '#15803D' : '#B45309',
                                        fontSize: '11.5px',
                                        fontWeight: 750,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {isSuspended ? 'Activate' : 'Suspend'}
                                    </button>
                                    <button
                                      onClick={() => setDeleteStaffModal(u)}
                                      style={{
                                        padding: '5px 8px',
                                        borderRadius: '4px',
                                        backgroundColor: '#FEE2E2',
                                        border: '1px solid #DC2626',
                                        color: '#DC2626',
                                        fontSize: '11.5px',
                                        fontWeight: 750,
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
              );
            })}
        </div>
      ) : (
        /* BRANCH ENTITIES CARDS */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {branches.map((b) => {
            const bStaffCount = staffOnly.filter((u) => u.branchId === b.id).length;

            return (
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
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: b.isOpen ? '#DCFCE7' : '#FEE2E2',
                      color: b.isOpen ? '#15803D' : '#B91C1C',
                    }}
                  >
                    {b.isOpen ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{b.address}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Hours: {b.openingHours} · Phone: {b.phone}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '12.5px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    Assigned Staff: {bStaffCount} Members
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Prep: {b.prepTimeEstimateMin}m · Cutoff: {b.stopAddOnsMinBeforeReady}m
                  </span>
                </div>

                {/* Branch Coordinates & Location Edit Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border-color)',
                    marginTop: '4px',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    📍 Lat: {b.latitude ?? (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126)}, Lng: {b.longitude ?? (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBranchLocation(b);
                      setBranchEditForm({
                        name: b.name,
                        city: b.city,
                        address: b.address,
                        phone: b.phone,
                        latitude: b.latitude ?? (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126),
                        longitude: b.longitude ?? (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436),
                        maxOrderDistanceKm: b.maxOrderDistanceKm ?? 50,
                        tableQrMaxDistanceMeters: b.tableQrMaxDistanceMeters ?? 300,
                      });
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'rgba(124, 58, 237, 0.08)',
                      color: '#7C3AED',
                      border: '1px solid rgba(124, 58, 237, 0.25)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Edit size={12} />
                    <span>Edit Location</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW STAFF MEMBER MODAL (Identical sleek UI to Manager profile) */}
      {createStaffModalOpen && (
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
              maxWidth: '520px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                New Staff
              </h3>
              <button
                type="button"
                onClick={() => setCreateStaffModalOpen(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateStaffSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Staff Full Name *
                  </label>
                  <input
                    type="text"
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="e.g. Asad Mehmood"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Staff System ID
                  </label>
                  <input
                    type="text"
                    value={newStaffId}
                    onChange={(e) => setNewStaffId(e.target.value)}
                    placeholder="stf-XXXX"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Predefined Staff Role *
                  </label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value as Role)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                    }}
                  >
                    {availableRoles.map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Assigned Branch *
                  </label>
                  <select
                    value={newStaffBranch}
                    onChange={(e) => setNewStaffBranch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                    }}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.city})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    placeholder="+92 300 1234567"
                    required
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    placeholder="name@foodiescafe.pk"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Create Password Option */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Create Password *
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 10px' }}>
                  <Lock size={15} color="var(--primary)" />
                  <input
                    type="text"
                    required
                    placeholder="Enter login password (e.g. password123)"
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

              {/* Temporary Login PIN */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card-subtle)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 750, color: 'var(--text-main)' }}>
                    Temporary 4-Digit Login PIN
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopyPin(newStaffPin)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Copy size={12} />
                    <span>{copiedPin ? 'Copied!' : 'Copy PIN'}</span>
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="text"
                    value={newStaffPin}
                    onChange={(e) => setNewStaffPin(e.target.value)}
                    maxLength={4}
                    style={{
                      width: '120px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      fontSize: '16px',
                      fontWeight: 800,
                      letterSpacing: '0.2em',
                      textAlign: 'center',
                      color: 'var(--primary)',
                    }}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    Staff member will input this PIN or password on terminal sign-in.
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setCreateStaffModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
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
                    flex: 1,
                    padding: '11px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px var(--primary-glow)',
                  }}
                >
                  Issue Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STAFF MODAL */}
      {editStaffModal && (
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
              maxWidth: '500px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0 }}>
                Edit Staff
              </h3>
              <button
                type="button"
                onClick={() => setEditStaffModal(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Full Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13px', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as Role)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    {availableRoles.map((r) => (
                      <option key={r.role} value={r.role}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Branch</label>
                  <select
                    value={editBranch}
                    onChange={(e) => setEditBranch(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13px', boxSizing: 'border-box' }}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Phone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    required
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '13px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Edit Password */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Edit Password / Login Access *</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0 10px' }}>
                  <Lock size={15} color="var(--primary)" />
                  <input
                    type="text"
                    required
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Enter account password"
                    style={{ width: '100%', padding: '9px 0', border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '13px', color: 'var(--text-main)', fontWeight: 650 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setEditStaffModal(null)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', fontWeight: 700 }}>
                  Cancel
                </button>
                <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#FFFFFF', border: 'none', fontWeight: 800 }}>
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PIN MODAL */}
      {resetPinModal && (
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
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '420px',
              width: '100%',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
            >
              <Key size={22} />
            </div>

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>
                Reset PIN
              </h3>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                fontSize: '28px',
                fontWeight: 900,
                color: 'var(--primary)',
                letterSpacing: '0.25em',
                fontFamily: 'monospace',
              }}
            >
              {resetPinModal.newPin}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleCopyPin(resetPinModal.newPin)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Copy size={15} />
                <span>{copiedPin ? 'Copied ✓' : 'Copy PIN'}</span>
              </button>
              <button
                onClick={() => setResetPinModal(null)}
                style={{
                  padding: '10px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT BRANCH LOCATION MODAL (OWNER / MANAGER) */}
      {editingBranchLocation && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.3)',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>
                Edit Location
              </h3>

              <button
                type="button"
                onClick={() => setEditingBranchLocation(null)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateBranchSettings(editingBranchLocation.id, {
                  name: branchEditForm.name.trim(),
                  city: branchEditForm.city.trim(),
                  address: branchEditForm.address.trim(),
                  phone: branchEditForm.phone.trim(),
                  latitude: Number(branchEditForm.latitude),
                  longitude: Number(branchEditForm.longitude),
                  maxOrderDistanceKm: Number(branchEditForm.maxOrderDistanceKm) || 50,
                  tableQrMaxDistanceMeters: Number(branchEditForm.tableQrMaxDistanceMeters) || 300,
                });
                addToast({
                  type: 'success',
                  title: 'Branch Location Updated 📍',
                  message: `${branchEditForm.name} location details saved successfully.`,
                });
                setEditingBranchLocation(null);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Branch Name
                </label>
                <input
                  type="text"
                  required
                  value={branchEditForm.name}
                  onChange={(e) => setBranchEditForm((f) => ({ ...f, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={branchEditForm.city}
                    onChange={(e) => setBranchEditForm((f) => ({ ...f, city: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={branchEditForm.phone}
                    onChange={(e) => setBranchEditForm((f) => ({ ...f, phone: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Address
                </label>
                <textarea
                  rows={2}
                  required
                  value={branchEditForm.address}
                  onChange={(e) => setBranchEditForm((f) => ({ ...f, address: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Latitude (e.g. 31.5126)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={branchEditForm.latitude}
                    onChange={(e) => setBranchEditForm((f) => ({ ...f, latitude: parseFloat(e.target.value) || 0 }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Longitude (e.g. 74.3436)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={branchEditForm.longitude}
                    onChange={(e) => setBranchEditForm((f) => ({ ...f, longitude: parseFloat(e.target.value) || 0 }))}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Max Order Distance (km)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  required
                  value={branchEditForm.maxOrderDistanceKm}
                  onChange={(e) => setBranchEditForm((f) => ({ ...f, maxOrderDistanceKm: parseFloat(e.target.value) || 50 }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                  Orders beyond this radius will be rejected and customers cannot select this branch.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '3px' }}>
                  Table QR Max Ordering Distance (Meters)
                </label>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  step="10"
                  required
                  value={branchEditForm.tableQrMaxDistanceMeters}
                  onChange={(e) => setBranchEditForm((f) => ({ ...f, tableQrMaxDistanceMeters: parseInt(e.target.value) || 300 }))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '3px' }}>
                  Allowed radius in meters for on-table physical QR orders (default 300m).
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEditingBranchLocation(null)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card-subtle)',
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
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#000000',
                    fontWeight: 850,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
