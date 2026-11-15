import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { MobileUser, MobileRole } from '../types';
import {
  Users,
  UserPlus,
  Shield,
  Utensils,
  Bike,
  ChefHat,
  Building2,
  Lock,
  Phone,
  Mail,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertOctagon,
  X,
  CreditCard,
  Headphones,
} from 'lucide-react-native';

function getBranchEmailSlug(branchId?: string, branchName?: string, branchCity?: string): string {
  if (!branchId && !branchName && !branchCity) return 'branch';
  const id = (branchId || '').toLowerCase();
  if (id.includes('gulberg')) return 'gulberg';
  if (id.includes('islamabad') || id.includes('f7') || id.includes('f-7')) return 'islamabad';
  if (id.includes('karachi') || id.includes('clifton')) return 'karachi';
  
  if (branchCity) {
    const cleanCity = branchCity.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanCity) return cleanCity;
  }
  if (branchName) {
    const firstWord = branchName.toLowerCase().split(/[\s-_()]+/)[0].replace(/[^a-z0-9]/g, '');
    if (firstWord) return firstWord;
  }
  const cleanId = id.split(/[-_]+/)[0].replace(/[^a-z0-9]/g, '');
  return cleanId || 'branch';
}

const ROLE_OPTIONS: { role: MobileRole; label: string; icon: any }[] = [
  { role: 'branch_manager', label: 'Branch Manager', icon: Building2 },
  { role: 'kitchen_staff', label: 'Kitchen Chef', icon: ChefHat },
  { role: 'floor_staff', label: 'Floor Staff / Waiter', icon: Utensils },
  { role: 'delivery_staff', label: 'Delivery Rider', icon: Bike },
  { role: 'cashier' as any, label: 'Cashier Desk', icon: CreditCard },
];

export function ManagerStaffManagement({ allowAllBranches = false }: { allowAllBranches?: boolean }) {
  const { users, createUser, updateUser, deleteUser, currentBranch, branches, role: myRole, staffUser, showToast, setBottomSheetOpen } = useApp();

  const isOwner = myRole === 'platform_owner';
  const effectiveAllowAll = isOwner && allowAllBranches;

  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(effectiveAllowAll ? 'all' : currentBranch.id);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalUser, setEditModalUser] = useState<MobileUser | null>(null);

  useEffect(() => {
    if (!createModalOpen && !editModalUser) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [createModalOpen, editModalUser, setBottomSheetOpen]);

  // Create Form State
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newInitial, setNewInitial] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<MobileRole>('floor_staff');
  const [newPassword, setNewPassword] = useState('password123');
  const [newBranchId, setNewBranchId] = useState(currentBranch.id);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);

  const targetBranchForNewStaff = useMemo(() => {
    const bId = isOwner ? newBranchId : currentBranch.id;
    return branches.find((b) => b.id === bId) || currentBranch;
  }, [branches, isOwner, newBranchId, currentBranch]);

  const activeBranchSlug = useMemo(() => {
    return getBranchEmailSlug(targetBranchForNewStaff.id, targetBranchForNewStaff.name, targetBranchForNewStaff.city);
  }, [targetBranchForNewStaff]);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<MobileRole>('floor_staff');
  const [editPassword, setEditPassword] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended' | 'deactivated'>('active');
  const [editBranchId, setEditBranchId] = useState<string>(currentBranch.id);

  // Filter staff members
  const availableRoleOptions = useMemo(
    () => (isOwner ? ROLE_OPTIONS : ROLE_OPTIONS.filter((o) => o.role !== 'branch_manager')),
    [isOwner]
  );

  const branchStaff = useMemo(() => {
    return users.filter((u) => {
      // Exclude customers
      if (u.role === 'customer') return false;
      // Protect self from modifying own session from staff table
      if (staffUser?.id && u.id === staffUser.id) return false;

      if (!isOwner) {
        // MANAGER RULES:
        // Cannot manage other managers or owner
        if (u.role === 'branch_manager' || u.role === 'platform_owner') return false;
        // Strictly only staff assigned to this manager's branch
        if (u.branchId && u.branchId !== currentBranch.id) return false;
        // If user has no branchId, also exclude from manager view to prevent cross-branch leakage
        if (!u.branchId) return false;
      } else {
        // OWNER RULES:
        // Cannot manage or change other owners
        if (u.role === 'platform_owner') return false;
        // Branch filter for owner
        if (selectedBranchId !== 'all' && u.branchId !== selectedBranchId) return false;
      }

      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesPhone = u.phone.includes(q);
        const matchesEmail = u.email.toLowerCase().includes(q);
        if (!matchesName && !matchesPhone && !matchesEmail) return false;
      }
      return true;
    });
  }, [users, isOwner, selectedBranchId, currentBranch.id, roleFilter, searchQuery, staffUser?.id]);

  const activeCount = branchStaff.filter((u) => u.status === 'active').length;
  const suspendedCount = branchStaff.filter((u) => u.status === 'suspended').length;
  const deactivatedCount = branchStaff.filter((u) => u.status === 'deactivated').length;

  const handleOpenEdit = (user: MobileUser) => {
    setEditModalUser(user);
    setEditName(user.name);
    setEditPhone(user.phone);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPassword((user as any).password || '');
    setEditStatus(user.status || 'active');
    setEditBranchId(user.branchId || currentBranch.id);
  };

  const handleSaveEdit = async () => {
    if (!editModalUser) return;
    if (!editName.trim() || !editPhone.trim()) {
      showToast('Name and phone are required', 'warning');
      return;
    }

    const updates: Partial<MobileUser> = {
      name: editName.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim(),
      role: editRole,
      status: editStatus,
      branchId: isOwner ? editBranchId : editModalUser.branchId,
    };
    if (editPassword.trim()) {
      (updates as any).password = editPassword.trim();
    }

    const success = await updateUser(editModalUser.id, updates);
    if (success) {
      setEditModalUser(null);
    }
  };

  const handleQuickStatusToggle = async (user: MobileUser, nextStatus: 'active' | 'suspended' | 'deactivated') => {
    await updateUser(user.id, { status: nextStatus });
  };

  const handleCreateSubmit = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      showToast('Full name and mobile phone are required', 'warning');
      return;
    }

    const branchToAssign = isOwner ? newBranchId : currentBranch.id;
    const cleanInitial = newInitial.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') || newRole;
    const finalEmail = `${cleanInitial}.${activeBranchSlug}@foodiescafe.pk`;

    const created = await createUser({
      name: newName.trim(),
      phone: newPhone.trim(),
      email: finalEmail,
      role: newRole,
      branchId: branchToAssign,
      status: 'active',
      password: newPassword.trim() || 'password123',
    } as any);

    if (created) {
      setCreateModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewInitial('');
      setNewEmail('');
      setNewPassword('password123');
      showToast(`Staff ID created with reserved email ${finalEmail}`, 'success');
    }
  };

  const handleDeleteUserConfirm = (userId: string, userName: string) => {
    Alert.alert(
      'Remove Staff Account',
      `Are you sure you want to completely remove account for ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteUser(userId),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Info & Actions */}
      <View style={styles.topBar}>
        <View style={styles.headerInfo}>
          <View style={styles.titleRow}>
            <View style={styles.iconBox}>
              <Users size={20} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.mainTitle}>Staff Administration</Text>
              <Text style={styles.subTitle}>
                {allowAllBranches && selectedBranchId === 'all'
                  ? 'All Branches (Enterprise Governance)'
                  : `${currentBranch.name} • Live Accounts`}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setCreateModalOpen(true)}
          activeOpacity={0.8}
        >
          <UserPlus size={16} color="#FFFFFF" />
          <Text style={styles.createBtnText}>+ Create Staff ID</Text>
        </TouchableOpacity>
      </View>

      {/* Summary KPI Cards Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Staff</Text>
          <Text style={styles.kpiVal}>{branchStaff.length}</Text>
        </View>
        <View style={[styles.kpiCard, { borderColor: Colors.successBorder }]}>
          <Text style={[styles.kpiLabel, { color: Colors.success }]}>Active</Text>
          <Text style={[styles.kpiVal, { color: Colors.success }]}>{activeCount}</Text>
        </View>
        <View style={[styles.kpiCard, { borderColor: Colors.warningBorder }]}>
          <Text style={[styles.kpiLabel, { color: Colors.warning }]}>Suspended</Text>
          <Text style={[styles.kpiVal, { color: Colors.warning }]}>{suspendedCount}</Text>
        </View>
        <View style={[styles.kpiCard, { borderColor: Colors.dangerBorder }]}>
          <Text style={[styles.kpiLabel, { color: Colors.danger }]}>Deactivated</Text>
          <Text style={[styles.kpiVal, { color: Colors.danger }]}>{deactivatedCount}</Text>
        </View>
      </View>

      {/* Branch selector for Owner (Styled identically to role pills below search) */}
      {effectiveAllowAll && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleFilterRow}>
          <TouchableOpacity
            style={[styles.rolePill, selectedBranchId === 'all' && styles.rolePillActive]}
            onPress={() => setSelectedBranchId('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.rolePillText, selectedBranchId === 'all' && styles.rolePillTextActive]}>
              All Branches
            </Text>
          </TouchableOpacity>
          {branches.map((b) => {
            const isSelected = selectedBranchId === b.id;
            const shortName = b.city ? `${b.city} (${b.name.replace(' Branch', '').replace(' (Flagship)', '')})` : b.name;
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.rolePill, isSelected && styles.rolePillActive]}
                onPress={() => setSelectedBranchId(b.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.rolePillText, isSelected && styles.rolePillTextActive]}>
                  {shortName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Search Input */}
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search staff by name, phone, email..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Role Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleFilterRow}>
        {[
          { id: 'all', label: 'All Roles' },
          ...(isOwner ? [{ id: 'branch_manager', label: 'Managers' }] : []),
          { id: 'kitchen_staff', label: 'Kitchen' },
          { id: 'floor_staff', label: 'Waiters' },
          { id: 'cashier', label: 'Cashiers' },
          { id: 'delivery_staff', label: 'Riders' },
        ].map((pill) => {
          const isActive = roleFilter === pill.id;
          return (
            <TouchableOpacity
              key={pill.id}
              style={[styles.rolePill, isActive && styles.rolePillActive]}
              onPress={() => setRoleFilter(pill.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.rolePillText, isActive && styles.rolePillTextActive]}>
                {pill.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Staff Members List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.staffList}>
        {branchStaff.length === 0 ? (
          <View style={styles.emptyCard}>
            <Users size={36} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Staff Accounts Found</Text>
            <Text style={styles.emptySub}>
              Tap &quot;+ Create Staff ID&quot; to register authorized branch staff.
            </Text>
          </View>
        ) : (
          branchStaff.map((u) => {
            const isSuspended = u.status === 'suspended';
            const isDeactivated = u.status === 'deactivated';
            const isActive = !isSuspended && !isDeactivated;

            return (
              <View
                key={u.id}
                style={[
                  styles.staffCard,
                  isSuspended && styles.staffCardSuspended,
                  isDeactivated && styles.staffCardDeactivated,
                ]}
              >
                {/* Top Info */}
                <View style={styles.staffCardHeader}>
                  <View style={styles.staffAvatar}>
                    <Text style={styles.staffInitials}>
                      {u.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.staffName}>{u.name}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          isActive
                            ? styles.statusActive
                            : isSuspended
                            ? styles.statusSuspended
                            : styles.statusDeactivated,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isActive
                              ? { color: Colors.success }
                              : isSuspended
                              ? { color: Colors.warning }
                              : { color: Colors.danger },
                          ]}
                        >
                          {isActive ? 'ACTIVE' : isSuspended ? 'SUSPENDED' : 'DEACTIVATED'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={styles.roleTag}>
                        {u.role.replace(/_/g, ' ').toUpperCase()}
                      </Text>

                      {u.role === 'delivery_staff' && (
                        <View
                          style={[
                            styles.riderDutyBadge,
                            u.riderAvailability === 'available' || (!u.riderAvailability && isActive)
                              ? styles.riderDutyOnline
                              : styles.riderDutyOffline,
                          ]}
                        >
                          <View
                            style={[
                              styles.riderDutyDot,
                              {
                                backgroundColor:
                                  u.riderAvailability === 'available' || (!u.riderAvailability && isActive)
                                    ? Colors.success
                                    : Colors.textMuted,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.riderDutyText,
                              {
                                color:
                                  u.riderAvailability === 'available' || (!u.riderAvailability && isActive)
                                    ? Colors.success
                                    : Colors.textMuted,
                              },
                            ]}
                          >
                            {u.riderAvailability === 'available' || (!u.riderAvailability && isActive)
                              ? 'Online (Ready)'
                              : 'Offline (Off Duty)'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Contact & Meta */}
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Phone size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText}>{u.phone}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Mail size={12} color={Colors.textMuted} />
                    <Text style={styles.metaText} numberOfLines={1}>{u.email}</Text>
                  </View>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.cardActionsRow}>
                  {isActive && (
                    <>
                      <TouchableOpacity
                        style={styles.suspendBtn}
                        onPress={() => handleQuickStatusToggle(u, 'suspended')}
                        activeOpacity={0.8}
                      >
                        <AlertOctagon size={13} color={Colors.warning} />
                        <Text style={styles.suspendBtnText}>Suspend</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deactivateBtn}
                        onPress={() => handleQuickStatusToggle(u, 'deactivated')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.deactivateBtnText}>Deactivate</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {isSuspended && (
                    <>
                      <TouchableOpacity
                        style={styles.activateBtn}
                        onPress={() => handleQuickStatusToggle(u, 'active')}
                        activeOpacity={0.8}
                      >
                        <CheckCircle2 size={13} color={Colors.success} />
                        <Text style={styles.activateBtnText}>Reactivate</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deactivateBtn}
                        onPress={() => handleQuickStatusToggle(u, 'deactivated')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.deactivateBtnText}>Deactivate</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {isDeactivated && (
                    <TouchableOpacity
                      style={styles.activateBtn}
                      onPress={() => handleQuickStatusToggle(u, 'active')}
                      activeOpacity={0.8}
                    >
                      <CheckCircle2 size={13} color={Colors.success} />
                      <Text style={styles.activateBtnText}>Reactivate</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => handleOpenEdit(u)}
                    activeOpacity={0.8}
                  >
                    <Edit2 size={13} color={Colors.textMain} />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteUserConfirm(u.id, u.name)}
                    activeOpacity={0.8}
                  >
                    <Trash2 size={13} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* CREATE STAFF MODAL */}
      <Modal visible={createModalOpen} animationType="slide" transparent statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Staff ID</Text>
              <TouchableOpacity onPress={() => setCreateModalOpen(false)}>
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              {/* Role Selection & Branch Selection */}
              {isOwner ? (
                <View style={styles.dropdownRow}>
                  {/* Dropdown 1: Role Selection */}
                  <View style={styles.dropdownCol}>
                    <Text style={styles.inputLabel}>Role Selection *</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setRolePickerOpen(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                        {availableRoleOptions.find((opt) => opt.role === newRole)?.label || 'Select Role'}
                      </Text>
                      <Text style={styles.dropdownCaret}>▼</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Dropdown 2: Branch Selection (Owner Only) */}
                  <View style={styles.dropdownCol}>
                    <Text style={styles.inputLabel}>Branch Selection *</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setBranchPickerOpen(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                        {targetBranchForNewStaff.name.split(' ')[0]} ({targetBranchForNewStaff.city})
                      </Text>
                      <Text style={styles.dropdownCaret}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>Role Selection *</Text>
                  <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setRolePickerOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                      {availableRoleOptions.find((opt) => opt.role === newRole)?.label || 'Select Role'}
                    </Text>
                    <Text style={styles.dropdownCaret}>▼</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Reserved Email Input with Attached Suffix */}
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>Email *</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                    placeholder="e.g. asad, chef, cashier"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    value={newInitial}
                    onChangeText={(val) => setNewInitial(val.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                  />
                  <View
                    style={{
                      height: 40,
                      backgroundColor: Colors.bgSubtle,
                      borderWidth: 1,
                      borderLeftWidth: 0,
                      borderColor: Colors.borderColor,
                      borderTopRightRadius: 8,
                      borderBottomRightRadius: 8,
                      paddingHorizontal: 8,
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.primary }}>
                      .{activeBranchSlug}@foodiescafe.pk
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Asad Qureshi"
                placeholderTextColor={Colors.textMuted}
                value={newName}
                onChangeText={setNewName}
              />

              <Text style={styles.inputLabel}>Mobile Phone *</Text>
              <TextInput
                style={styles.input}
                placeholder="03001234567"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                value={newPhone}
                onChangeText={setNewPhone}
              />

              <Text style={styles.inputLabel}>Initial Password *</Text>
              <TextInput
                style={styles.input}
                placeholder="password123"
                placeholderTextColor={Colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
              />

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleCreateSubmit}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSubmitBtnText}>Create Account ✓</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* EDIT STAFF MODAL */}
      <Modal visible={!!editModalUser} animationType="slide" transparent statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Staff Account</Text>
              <TouchableOpacity onPress={() => setEditModalUser(null)}>
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
              />

              <Text style={styles.inputLabel}>Mobile Phone</Text>
              <TextInput
                style={styles.input}
                keyboardType="phone-pad"
                value={editPhone}
                onChangeText={setEditPhone}
              />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                value={editEmail}
                onChangeText={setEditEmail}
              />

              <Text style={styles.inputLabel}>Staff Status</Text>
              <View style={styles.statusSelectRow}>
                {(['active', 'suspended', 'deactivated'] as const).map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.statusSelectBtn,
                      editStatus === st && (st === 'active' ? styles.statusBtnActive : st === 'suspended' ? styles.statusBtnSuspended : styles.statusBtnDeactivated),
                    ]}
                    onPress={() => setEditStatus(st)}
                  >
                    <Text
                      style={[
                        styles.statusSelectText,
                        editStatus === st && { color: '#FFFFFF', fontWeight: '800' },
                      ]}
                    >
                      {st.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isOwner && (
                <>
                  <Text style={styles.inputLabel}>Assign Branch</Text>
                  <View style={styles.statusSelectRow}>
                    {branches.map((b) => (
                      <TouchableOpacity
                        key={b.id}
                        style={[
                          styles.statusSelectBtn,
                          editBranchId === b.id && styles.statusBtnActive,
                        ]}
                        onPress={() => setEditBranchId(b.id)}
                      >
                        <Text
                          style={[
                            styles.statusSelectText,
                            editBranchId === b.id && { color: '#FFFFFF', fontWeight: '800' },
                          ]}
                          numberOfLines={1}
                        >
                          {b.name.split(' ')[0]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.inputLabel}>Reset Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Leave blank to keep current"
                placeholderTextColor={Colors.textMuted}
                value={editPassword}
                onChangeText={setEditPassword}
              />

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSaveEdit}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSubmitBtnText}>Save Changes ✓</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* Role Picker Modal */}
      <Modal visible={rolePickerOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setRolePickerOpen(false)}
        >
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Staff Role</Text>
              <TouchableOpacity onPress={() => setRolePickerOpen(false)}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {availableRoleOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.role}
                  style={[
                    styles.pickerItem,
                    newRole === opt.role && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setNewRole(opt.role);
                    setRolePickerOpen(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, newRole === opt.role && styles.pickerItemTextActive]}>
                    {opt.label}
                  </Text>
                  {newRole === opt.role && <CheckCircle2 size={16} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Branch Picker Modal (For Owner) */}
      <Modal visible={branchPickerOpen} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setBranchPickerOpen(false)}
        >
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Branch</Text>
              <TouchableOpacity onPress={() => setBranchPickerOpen(false)}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {branches.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.pickerItem,
                    newBranchId === b.id && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setNewBranchId(b.id);
                    setBranchPickerOpen(false);
                  }}
                >
                  <View>
                    <Text style={[styles.pickerItemText, newBranchId === b.id && styles.pickerItemTextActive]}>
                      {b.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: Colors.textMuted }}>
                      {b.city} • Reserved: .{getBranchEmailSlug(b.id, b.name, b.city)}@foodiescafe.pk
                    </Text>
                  </View>
                  {newBranchId === b.id && <CheckCircle2 size={16} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  topBar: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  headerInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainTitle: { fontSize: 17, fontWeight: '800', color: Colors.textMain },
  subTitle: { fontSize: 11.5, color: Colors.textMuted, marginTop: 1 },
  createBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 6,
  },
  createBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  kpiLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  kpiVal: { fontSize: 18, fontWeight: '900', color: Colors.textMain, marginTop: 2 },
  branchTabs: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  branchTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  branchTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  branchTabText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  branchTabTextActive: { color: '#FFFFFF', fontWeight: '800' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  searchInput: { flex: 1, height: 38, fontSize: 12.5, color: Colors.textMain },
  roleFilterRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 6,
    height: 44,
    alignItems: 'center',
  },
  rolePill: {
    paddingHorizontal: 13,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rolePillText: { fontSize: 11.5, fontWeight: '700', color: Colors.textMuted },
  rolePillTextActive: { color: '#FFFFFF', fontWeight: '800' },
  staffList: { padding: 16, gap: 12, paddingBottom: 40 },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 36,
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textMain },
  emptySub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  staffCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 14,
    gap: 10,
  },
  staffCardSuspended: { borderColor: Colors.warningBorder, backgroundColor: Colors.warningLight + '20' },
  staffCardDeactivated: { borderColor: Colors.dangerBorder, backgroundColor: Colors.dangerLight + '20' },
  staffCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  staffAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffInitials: { fontSize: 13, fontWeight: '900', color: Colors.primary },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  staffName: { fontSize: 14, fontWeight: '800', color: Colors.textMain },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusActive: { backgroundColor: Colors.successLight },
  statusSuspended: { backgroundColor: Colors.warningLight },
  statusDeactivated: { backgroundColor: Colors.dangerLight },
  statusBadgeText: { fontSize: 9.5, fontWeight: '800' },
  roleTag: { fontSize: 11, fontWeight: '700', color: Colors.primary, marginTop: 1 },
  riderDutyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    borderWidth: 1,
  },
  riderDutyOnline: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.successBorder,
  },
  riderDutyOffline: {
    backgroundColor: Colors.bgSubtle,
    borderColor: Colors.borderColor,
  },
  riderDutyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  riderDutyText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  metaRow: { flexDirection: 'row', gap: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11.5, color: Colors.textMuted },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    paddingTop: 10,
  },
  suspendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  suspendBtnText: { fontSize: 11, fontWeight: '700', color: Colors.warning },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  activateBtnText: { fontSize: 11, fontWeight: '700', color: Colors.success },
  deactivateBtn: {
    backgroundColor: Colors.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deactivateBtnText: { fontSize: 11, fontWeight: '700', color: Colors.danger },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  editBtnText: { fontSize: 11, fontWeight: '700', color: Colors.textMain },
  deleteBtn: {
    backgroundColor: Colors.dangerLight,
    padding: 6,
    borderRadius: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.textMain },
  modalForm: { padding: 16, gap: 10 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMain, marginTop: 4 },
  input: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    color: Colors.textMain,
  },
  modalRolePills: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  roleSelectPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    backgroundColor: Colors.bgSubtle,
  },
  roleSelectPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleSelectPillText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  roleSelectPillTextActive: { color: '#FFFFFF', fontWeight: '800' },
  statusSelectRow: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  statusSelectBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
  },
  statusBtnActive: { backgroundColor: Colors.success, borderColor: Colors.success },
  statusBtnSuspended: { backgroundColor: Colors.warning, borderColor: Colors.warning },
  statusBtnDeactivated: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  statusSelectText: { fontSize: 10.5, fontWeight: '700', color: Colors.textMuted },
  modalSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  modalSubmitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  dropdownRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dropdownCol: {
    flex: 1,
  },
  dropdownTrigger: {
    height: 40,
    backgroundColor: Colors.bgSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerDisabled: {
    backgroundColor: Colors.bgCard,
    opacity: 0.85,
  },
  dropdownTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
    flex: 1,
  },
  dropdownCaret: {
    fontSize: 10,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  pickerItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  pickerItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMain,
  },
  pickerItemTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
});

