import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';

// Signed-in staff member's name card, shown at the top of each staff role's first tab
// (Overview / Cash Desk / Kitchen / Waiter Orders), like the rider console's profile card.

const ROLE_LABELS: Record<string, string> = {
  platform_owner: 'Owner',
  branch_manager: 'Branch Manager',
  cashier: 'Cashier',
  kitchen_staff: 'Kitchen Staff',
  floor_staff: 'Floor Staff',
  delivery_staff: 'Rider',
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';

export function StaffNameBanner() {
  const { staffUser, branches, currentBranch } = useApp();
  if (!staffUser) return null;
  const name = staffUser.name || 'Staff member';
  const roleLabel = ROLE_LABELS[staffUser.role] || 'Staff';
  const branchName =
    staffUser.role === 'platform_owner'
      ? 'All branches'
      : branches.find((b) => b.id === staffUser.branchId)?.name || currentBranch?.name || '';

  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialsOf(name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {[roleLabel, branchName].filter(Boolean).join(' • ')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15, fontWeight: '800', color: Colors.primaryDark },
  name: { fontSize: 16, fontWeight: '800', color: Colors.textMain },
  sub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
