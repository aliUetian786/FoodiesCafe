import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { FileClock, UserCheck, Shield, Clock } from 'lucide-react-native';
import { SEED_USERS } from '../services/api';

export function OwnerAudit() {
  const { auditLogs } = useApp();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>System Audit Ledger</Text>
      <Text style={styles.pageSub}>Immutable trail of administrative updates & governance logs</Text>

      {/* Audit Log Entries */}
      <View style={styles.sectionHeader}>
        <FileClock size={16} color={Colors.primary} />
        <Text style={styles.sectionTitle}>Recent Administrative Actions</Text>
      </View>

      <View style={styles.logsList}>
        {auditLogs.map((log) => (
          <View key={log.id} style={styles.logCard}>
            <View style={styles.logTop}>
              <View style={styles.actorBadge}>
                <Shield size={11} color={Colors.primary} />
                <Text style={styles.actorName}>{log.actorName} ({log.actorRole})</Text>
              </View>
              <View style={styles.timeRow}>
                <Clock size={10} color={Colors.textMuted} />
                <Text style={styles.logTime}>
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
            <Text style={styles.logAction}>Action: {log.action.toUpperCase().replace('_', ' ')}</Text>
            <Text style={styles.logDetails}>{log.details}</Text>
          </View>
        ))}
      </View>

      {/* Staff Roster Overview */}
      <View style={[styles.sectionHeader, { marginTop: 20 }]}>
        <UserCheck size={16} color={Colors.primary} />
        <Text style={styles.sectionTitle}>Registered Operational Staff</Text>
      </View>

      <View style={styles.staffList}>
        {SEED_USERS.map((usr) => (
          <View key={usr.id} style={styles.staffCard}>
            <View style={styles.staffAvatar}>
              <Text style={styles.staffInit}>{usr.name.charAt(0)}</Text>
            </View>
            <View style={styles.staffInfo}>
              <Text style={styles.staffName}>{usr.name}</Text>
              <Text style={styles.staffRole}>{usr.role.replace('_', ' ').toUpperCase()}</Text>
              <Text style={styles.staffPhone}>{usr.phone} • {usr.email}</Text>
            </View>
            <View style={[styles.statusTag, { backgroundColor: Colors.successLight }]}>
              <Text style={[styles.statusTagText, { color: Colors.success }]}>ACTIVE</Text>
            </View>
          </View>
        ))}
      </View>
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
    marginBottom: 16,
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
  logAction: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 2,
  },
  logDetails: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 15,
  },
  staffList: {
    gap: 10,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    gap: 12,
  },
  staffAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffInit: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  staffRole: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 1,
  },
  staffPhone: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: '800',
  },
});

