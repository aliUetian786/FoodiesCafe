import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { FileClock, Shield, Clock, MapPin } from 'lucide-react-native';
import { apiFetch } from '../services/api';
import { AuditLog } from '../types';

type RoleFilter = 'all' | 'branch_manager' | 'cashier';
type ActionFilter = 'all' | 'orders' | 'menu' | 'branch' | 'shifts' | 'refunds';

// Logins and new-account registrations are not operational changes.
const HIDDEN_ACTIONS = new Set(['staff_login', 'staff_created']);

const ROLE_LABEL: Record<string, string> = {
  branch_manager: 'Manager',
  cashier: 'Cashier',
};

function actionCategory(action: string): { label: string; color: string; bg: string } {
  if (action.startsWith('order_payment')) return { label: 'Payment', color: '#15803D', bg: '#DCFCE7' };
  if (action === 'order_cancelled') return { label: 'Cancelled', color: '#B91C1C', bg: '#FEE2E2' };
  if (action.startsWith('order_')) return { label: 'Order', color: '#C2410C', bg: '#FFEDD5' };
  if (action.startsWith('menu_')) return { label: 'Menu', color: '#B45309', bg: '#FEF3C7' };
  if (action.startsWith('branch_')) return { label: 'Branch', color: '#1D4ED8', bg: '#DBEAFE' };
  if (action.includes('shift')) return { label: 'Shift', color: '#0E7490', bg: '#CFFAFE' };
  if (action.includes('refund')) return { label: 'Refund', color: '#B91C1C', bg: '#FEE2E2' };
  if (action.includes('table')) return { label: 'Table', color: '#0F766E', bg: '#CCFBF1' };
  return { label: 'Change', color: Colors.primary, bg: Colors.primaryLight };
}

function matchesAction(action: string, f: ActionFilter): boolean {
  if (f === 'all') return true;
  if (f === 'orders') return action.startsWith('order_');
  if (f === 'menu') return action.startsWith('menu_');
  if (f === 'branch') return action.startsWith('branch_');
  if (f === 'shifts') return action.includes('shift');
  return action.includes('refund');
}

function formatWhen(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return sameDay ? time : `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })} ${time}`;
}

export function OwnerAudit() {
  const { branches, currentUser, role } = useApp();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');

  const load = useCallback(async () => {
    const res = await apiFetch<{ logs?: AuditLog[] }>('/api/audit-logs?limit=200', {
      headers: {
        'x-foodies-staff-role': role || 'platform_owner',
        ...(currentUser?.id ? { 'x-foodies-user-id': currentUser.id } : {}),
      },
    });
    if (res.ok && Array.isArray(res.data?.logs)) {
      setLogs(res.data!.logs!);
      setError(null);
    } else if (!res.ok) {
      setError('Could not load the audit log. Pull down to retry.');
    }
    setLoading(false);
  }, [role, currentUser?.id]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30000);
    return () => clearInterval(t);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const branchName = useCallback(
    (id?: string | null) => (id ? branches.find((b) => b.id === id)?.name || id : 'All branches'),
    [branches]
  );

  const visible = useMemo(
    () =>
      logs.filter((log) => {
        if (HIDDEN_ACTIONS.has(log.action)) return false;
        if (log.actorRole !== 'branch_manager' && log.actorRole !== 'cashier') return false;
        if (roleFilter !== 'all' && log.actorRole !== roleFilter) return false;
        return matchesAction(log.action, actionFilter);
      }),
    [logs, roleFilter, actionFilter]
  );

  const roleChips: { key: RoleFilter; label: string }[] = [
    { key: 'all', label: 'Managers & Cashiers' },
    { key: 'branch_manager', label: 'Managers' },
    { key: 'cashier', label: 'Cashiers' },
  ];
  const actionChips: { key: ActionFilter; label: string }[] = [
    { key: 'all', label: 'All changes' },
    { key: 'orders', label: 'Orders & payments' },
    { key: 'menu', label: 'Menu & prices' },
    { key: 'branch', label: 'Branch' },
    { key: 'shifts', label: 'Shifts' },
    { key: 'refunds', label: 'Refunds' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
    >
      <Text style={styles.pageTitle}>Audit Log</Text>
      <Text style={styles.pageSub}>Every change made by branch managers and cashiers</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {roleChips.map((c) => (
          <TouchableOpacity
            key={c.key}
            onPress={() => setRoleFilter(c.key)}
            style={[styles.chip, roleFilter === c.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, roleFilter === c.key && styles.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { marginBottom: 14 }]}>
        {actionChips.map((c) => (
          <TouchableOpacity
            key={c.key}
            onPress={() => setActionFilter(c.key)}
            style={[styles.chip, actionFilter === c.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, actionFilter === c.key && styles.chipTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <FileClock size={16} color={Colors.primary} />
        <Text style={styles.sectionTitle}>Recent changes ({visible.length})</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
      ) : error && logs.length === 0 ? (
        <Text style={styles.empty}>{error}</Text>
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>No manager or cashier changes recorded for this filter yet.</Text>
      ) : (
        <View style={styles.logsList}>
          {visible.map((log) => {
            const cat = actionCategory(log.action);
            return (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logTop}>
                  <View style={styles.actorBadge}>
                    <Shield size={11} color={Colors.primary} />
                    <Text style={styles.actorName}>
                      {log.actorName} · {ROLE_LABEL[log.actorRole] || log.actorRole}
                    </Text>
                  </View>
                  <View style={styles.timeRow}>
                    <Clock size={10} color={Colors.textMuted} />
                    <Text style={styles.logTime}>{formatWhen(log.timestamp)}</Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <View style={[styles.catTag, { backgroundColor: cat.bg }]}>
                    <Text style={[styles.catTagText, { color: cat.color }]}>{cat.label}</Text>
                  </View>
                  <MapPin size={10} color={Colors.textMuted} />
                  <Text style={styles.branchText}>{branchName(log.branchId)}</Text>
                </View>
                <Text style={styles.logDetails}>{log.details}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  pageSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  chipRow: {
    gap: 6,
    paddingBottom: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    backgroundColor: Colors.bgCard,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  empty: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  logsList: {
    gap: 10,
  },
  logCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  logTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
    flexShrink: 1,
  },
  actorName: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  logTime: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  catTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
  },
  catTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
  branchText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  logDetails: {
    fontSize: 11,
    color: Colors.textMain,
    marginTop: 2,
    lineHeight: 15,
  },
});
