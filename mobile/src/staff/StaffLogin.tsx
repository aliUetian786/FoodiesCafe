import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { SEED_USERS, normalizeBranchId } from '../services/api';
import { Shield, Utensils, Bike, Mail, Lock, ArrowRight, ArrowLeft, Building2, CheckCircle2, ChefHat, Wallet } from 'lucide-react-native';

export function StaffLogin() {
  const { loginStaff, setAppMode, showToast, users, currentBranch } = useApp();

  const [selectedRole, setSelectedRole] = useState<'platform_owner' | 'branch_manager' | 'cashier' | 'kitchen_staff' | 'floor_staff' | 'delivery_staff'>('branch_manager');
  const [email, setEmail] = useState('manager.gulberg@foodiescafe.pk');
  const [password, setPassword] = useState('••••••••');

  const staffProfiles = [
    {
      role: 'platform_owner' as const,
      title: 'Platform Owner',
      desc: 'Multi-branch governance, financial KPIs & price controls',
      user: users.find((u) => u.role === 'platform_owner') || SEED_USERS.find((u) => u.role === 'platform_owner') || SEED_USERS[0],
      icon: Shield,
      color: Colors.primary,
    },
    {
      role: 'branch_manager' as const,
      title: 'Branch Manager',
      desc: 'Branch live monitors, kitchen load, table occupancy & operational settings',
      user:
        users.find((u) => u.role === 'branch_manager' && normalizeBranchId(u.branchId) === normalizeBranchId(currentBranch.id)) ||
        SEED_USERS.find((u) => u.role === 'branch_manager' && normalizeBranchId(u.branchId) === normalizeBranchId(currentBranch.id)) ||
        users.find((u) => u.role === 'branch_manager') ||
        SEED_USERS[1],
      icon: Building2,
      color: '#8B5CF6',
    },
    {
      role: 'cashier' as const,
      title: 'Cashier',
      desc: 'Cash desk, online & walk-in orders hub, payments and settlements',
      user:
        users.find((u) => u.role === 'cashier' && normalizeBranchId(u.branchId) === normalizeBranchId(currentBranch.id)) ||
        users.find((u) => u.role === 'cashier') ||
        (() => {
          const b = normalizeBranchId(currentBranch.id);
          const byBranch: Record<string, { id: string; name: string; email: string }> = {
            'gulberg-lahore': { id: 'user-cashier', name: 'Bilal Farooq (Cashier)', email: 'cashier.gulberg@foodiescafe.pk' },
            'f7-islamabad': { id: 'user-cashier-isb', name: 'Hamza Tariq (Cashier)', email: 'cashier.islamabad@foodiescafe.pk' },
            'clifton-karachi': { id: 'user-cashier-khi', name: 'Saad Ali (Cashier)', email: 'cashier.karachi@foodiescafe.pk' },
          };
          const c = byBranch[b] || byBranch['gulberg-lahore'];
          return { ...c, phone: '', role: 'cashier' as const, branchId: b in byBranch ? b : 'gulberg-lahore', status: 'active' as const };
        })(),
      icon: Wallet,
      color: '#16A34A',
    },
    {
      role: 'kitchen_staff' as const,
      title: 'Kitchen Staff',
      desc: 'Live kitchen orders: Order Arrived & Order Ready to Serve',
      user:
        users.find((u) => u.role === 'kitchen_staff' && normalizeBranchId(u.branchId) === normalizeBranchId(currentBranch.id)) ||
        SEED_USERS.find((u) => u.role === 'kitchen_staff' && normalizeBranchId(u.branchId) === normalizeBranchId(currentBranch.id)) ||
        users.find((u) => u.role === 'kitchen_staff') ||
        SEED_USERS.find((u) => u.role === 'kitchen_staff') || {
          id: 'user-kitchen',
          name: 'Chef Ustaad Aslam (Kitchen)',
          phone: '03006667788',
          email: 'kitchen.gulberg@foodiescafe.pk',
          role: 'kitchen_staff' as const,
          branchId: 'gulberg-lahore',
          status: 'active' as const,
        },
      icon: ChefHat,
      color: '#EA580C',
    },
    {
      role: 'floor_staff' as const,
      title: 'Floor Staff / Waiter',
      desc: 'Floor table map, 4-digit PINs & hot food service queue',
      user: users.find((u) => u.role === 'floor_staff') || SEED_USERS.find((u) => u.role === 'floor_staff') || SEED_USERS[2],
      icon: Utensils,
      color: Colors.info,
    },
    {
      role: 'delivery_staff' as const,
      title: 'Delivery Rider (Usman Ghani)',
      desc: 'Active orders queue, GPS directions & COD settlements',
      user:
        users.find((u) => u.id === 'user-rider-2') ||
        SEED_USERS.find((u) => u.id === 'user-rider-2') ||
        users.find((u) => u.role === 'delivery_staff') ||
        SEED_USERS[3],
      icon: Bike,
      color: Colors.success,
    },
  ];

  const handleSelectStaffRole = (prof: (typeof staffProfiles)[0]) => {
    setSelectedRole(prof.role);
    const liveMatch = users.find((u) => u.id === prof.user.id || u.email.toLowerCase() === prof.user.email.toLowerCase()) || prof.user;
    setEmail(liveMatch.email);
    setPassword((liveMatch as any).password || 'password123');
  };

  const handleSignIn = () => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Look up user in live database users first, then fallback to SEED_USERS
    let matchedUser = users.find(
      (u) => u.email.toLowerCase() === cleanEmail && u.role !== 'customer'
    );

    if (!matchedUser) {
      matchedUser = SEED_USERS.find(
        (u) => u.email.toLowerCase() === cleanEmail && u.role !== 'customer'
      );
    }

    // 2. Typed email not known locally (e.g. cashiers — the staff list is only sent after login):
    //    let the server identify the account instead of silently signing in as the selected role card.
    if (!matchedUser && cleanEmail.includes('@')) {
      matchedUser = {
        id: cleanEmail,
        name: cleanEmail,
        email: cleanEmail,
        phone: '',
        role: selectedRole,
        branchId: currentBranch.id,
        status: 'active',
        requiresServerAuth: true,
      } as any;
    }

    // 3. Fall back to selected role profile (empty email field)
    if (!matchedUser) {
      const prof = staffProfiles.find((p) => p.role === selectedRole);
      matchedUser = prof ? (users.find((u) => u.id === prof.user.id || u.email.toLowerCase() === prof.user.email.toLowerCase()) || prof.user) : undefined;
    }

    if (!matchedUser) {
      showToast('Invalid staff credentials. Please select an authorized staff role.', 'danger');
      return;
    }

    // 3. Strict Status Check (suspended, deactivated, blocked)
    if (matchedUser.status && matchedUser.status !== 'active') {
      showToast(`Account Access Prohibited: Staff account for ${matchedUser.name} is ${matchedUser.status.toUpperCase()}.`, 'danger');
      return;
    }

    const effectivePassword = password === '••••••••' || !password ? ((matchedUser as any).password || 'password123') : password;
    loginStaff(matchedUser, effectivePassword);
  };

  const handleQuickLogin = (prof: (typeof staffProfiles)[0]) => {
    const liveMatch = users.find((u) => u.id === prof.user.id || u.email.toLowerCase() === prof.user.email.toLowerCase()) || prof.user;
    if (liveMatch.status && liveMatch.status !== 'active') {
      showToast(`Account Access Prohibited: Account for ${liveMatch.name} is ${liveMatch.status.toUpperCase()}.`, 'danger');
      return;
    }
    const pwd = (liveMatch as any).password || 'password123';
    loginStaff(liveMatch, pwd);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Brand Header */}
      <View style={styles.header}>
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>STAFF OPERATIONS PORTAL</Text>
        </View>
        <Text style={styles.title}>Foodies<Text style={styles.titleHighlight}>Cafe</Text></Text>
        <Text style={styles.subtitle}>Select your staff account or enter credentials to sign in</Text>
      </View>

      {/* Role Selection Cards */}
      <Text style={styles.sectionLabel}>Select Staff Account Role (1-Tap Fast Sign In)</Text>
      <View style={styles.profilesGrid}>
        {staffProfiles.map((p) => {
          const isSelected = selectedRole === p.role;
          const IconComp = p.icon;
          const liveUser = users.find((u) => u.id === p.user.id || u.email.toLowerCase() === p.user.email.toLowerCase()) || p.user;
          const isBlocked = Boolean(liveUser.status && liveUser.status !== 'active');
          const isSuspended = liveUser.status === 'suspended';
          const isDeactivated = liveUser.status === 'deactivated';

          return (
            <TouchableOpacity
              key={p.role}
              style={[
                styles.profileCard,
                isSelected && { borderColor: p.color, backgroundColor: Colors.primaryLight },
                isBlocked && { borderColor: Colors.dangerBorder, backgroundColor: Colors.dangerLight + '30' },
              ]}
              onPress={() => handleSelectStaffRole(p)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconWrap, { backgroundColor: isBlocked ? Colors.dangerLight : p.color + '20' }]}>
                <IconComp size={18} color={isBlocked ? Colors.danger : p.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.profileHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.profileTitle, isSelected && { color: p.color }, isBlocked && { color: Colors.danger }]}>
                      {p.title}
                    </Text>
                    {isBlocked && (
                      <View style={{ backgroundColor: isSuspended ? Colors.warningLight : Colors.dangerLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: isSuspended ? Colors.warning : Colors.danger }}>
                          {liveUser.status?.toUpperCase() || 'LOCKED'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.quickEnterBtn,
                      { backgroundColor: isBlocked ? Colors.borderDark : p.color },
                    ]}
                    onPress={() => handleQuickLogin(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.quickEnterBtnText}>{isBlocked ? 'Blocked ✕' : 'Sign In ➔'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.profileEmail}>{liveUser.email}</Text>
                <Text style={styles.profileDesc}>{p.desc}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Credentials Inputs */}
      <View style={styles.credentialsCard}>
        <Text style={styles.inputLabel}>Staff Email</Text>
        <View style={styles.inputBox}>
          <Mail size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <Text style={styles.inputLabel}>Staff Password / PIN</Text>
        <View style={styles.inputBox}>
          <Lock size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.loginBtn} onPress={handleSignIn} activeOpacity={0.85}>
          <Text style={styles.loginBtnText}>Sign In to Staff Console</Text>
          <ArrowRight size={16} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Return to Customer App */}
      <TouchableOpacity
        style={styles.returnCustomerBtn}
        onPress={() => setAppMode('customer')}
        activeOpacity={0.8}
      >
        <ArrowLeft size={15} color={Colors.textMuted} />
        <Text style={styles.returnCustomerText}>Return to Customer App</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  badgeWrap: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.textMain,
    letterSpacing: -0.5,
  },
  titleHighlight: {
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 10,
  },
  profilesGrid: {
    gap: 10,
    marginBottom: 20,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    gap: 12,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickEnterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  quickEnterBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  profileEmail: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  profileDesc: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 13,
  },
  credentialsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingHorizontal: 12,
    height: 42,
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMain,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 44,
    marginTop: 16,
  },
  loginBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  returnCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  returnCustomerText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
});
