import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { StaffNameBanner } from '../components/StaffNameBanner';
import { AnnouncementsBoard } from '../components/AnnouncementsBoard';
import { normalizeBranchId } from '../services/api';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Building2,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Shield,
  FileClock,
  ChevronRight,
  Sparkles,
  CheckCircle,
  Clock,
  Utensils,
  Bike,
  Megaphone,
} from 'lucide-react-native';

interface OwnerDashboardProps {
  onNavigateToBranches: () => void;
  onNavigateToMenu: () => void;
  onNavigateToStaff?: () => void;
  onNavigateToAudit?: () => void;
  onNavigateToOrders?: (filter?: 'all' | 'pending') => void;
}

export function OwnerDashboard({
  onNavigateToBranches,
  onNavigateToMenu,
  onNavigateToStaff,
  onNavigateToAudit,
  onNavigateToOrders,
}: OwnerDashboardProps) {
  const { branches, orders, menuItems, users, openNotificationModal } = useApp();

  const isToday = (dateStr?: string) => {
    if (!dateStr) return true;
    if (typeof dateStr === 'string' && (dateStr.includes('ago') || dateStr.includes('Just now') || dateStr.includes('Today') || dateStr.includes('min') || dateStr.includes('sec'))) {
      return true;
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const isOrderPaid = (o: any) => {
    if (o.paymentStatus === 'paid') return true;
    if (o.paymentCollected === true) return true;
    if (o.status === 'completed' || o.status === 'delivered') return true;
    const method = (o.paymentMethod || '').toLowerCase();
    if (
      method.includes('jazzcash') ||
      method.includes('easypaisa') ||
      method.includes('card') ||
      method.includes('bank') ||
      method.includes('online') ||
      method.includes('raast') ||
      method.includes('stripe') ||
      method.includes('wallet')
    ) {
      return o.paymentStatus !== 'unpaid' || o.paymentCollected === true;
    }
    return false;
  };

  const isPendingOrder = (o: any) =>
    o.status === 'placed' ||
    o.status === 'accepted' ||
    o.status === 'preparing' ||
    o.status === 'ready' ||
    o.status === 'out_for_delivery';

  const todayOrders = orders.filter((o) => isToday(o.createdAt) || (o.status !== 'completed' && o.status !== 'cancelled'));
  const paidOrdersToday = todayOrders.filter(isOrderPaid);
  const totalRevenue = paidOrdersToday.reduce(
    (sum, o) => sum + Number(o.total || 0),
    0
  );
  const paidOrdersCount = paidOrdersToday.length;
  const pendingOrdersCount = todayOrders.filter(isPendingOrder).length;
  const activeBranchesCount = branches.filter((b) => b.isOpen).length;

  const staffCount = users.filter((u) => u.role !== 'customer').length;
  const suspendedStaff = users.filter((u) => u.status === 'suspended').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <StaffNameBanner />
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.pageTitle}>Owner Console</Text>
          <Text style={styles.pageSub}>
            Central Enterprise Governance • Multi-Branch Operations
          </Text>
        </View>
        <View style={styles.ownerBadge}>
          <Shield size={13} color={Colors.primary} />
          <Text style={styles.ownerBadgeText}>OWNER</Text>
        </View>
      </View>

      {/* 4 Primary Financial KPI Cards (Strictly Today's Counts) */}
      <View style={styles.kpiGrid}>
        {/* Card 1: Paid Revenue Today */}
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: paidOrdersCount > 0 ? Colors.successLight : '#FEF3C7' }]}>
            <DollarSign size={18} color={paidOrdersCount > 0 ? Colors.success : '#D97706'} />
          </View>
          <Text style={styles.kpiValue}>Rs. {totalRevenue.toLocaleString()}</Text>
          <Text style={styles.kpiLabel}>
            {paidOrdersCount > 0 ? `Paid Revenue (${paidOrdersCount} Paid)` : 'Payment: Awaiting Paid Orders'}
          </Text>
        </View>

        {/* Card 2: Total Orders Today (Tap to View All History) */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardClickable]}
          activeOpacity={0.8}
          onPress={() => onNavigateToOrders?.('all')}
        >
          <View style={styles.kpiCardHeaderRow}>
            <View style={[styles.kpiIconWrap, { backgroundColor: Colors.primaryLight }]}>
              <ShoppingBag size={18} color={Colors.primary} />
            </View>
            <View style={styles.clickableArrowPill}>
              <Text style={styles.clickableArrowText}>View ➔</Text>
            </View>
          </View>
          <Text style={styles.kpiValue}>{todayOrders.length}</Text>
          <Text style={styles.kpiLabel}>Total Orders Today</Text>
        </TouchableOpacity>

        {/* Card 3: Pending Orders Today (Tap to View Pending Orders - Replaced Avg Paid Order) */}
        <TouchableOpacity
          style={[styles.kpiCard, styles.kpiCardClickable]}
          activeOpacity={0.8}
          onPress={() => onNavigateToOrders?.('pending')}
        >
          <View style={styles.kpiCardHeaderRow}>
            <View style={[styles.kpiIconWrap, { backgroundColor: '#FEF3C7' }]}>
              <Clock size={18} color="#D97706" />
            </View>
            <View style={[styles.clickableArrowPill, { backgroundColor: '#FEF3C7' }]}>
              <Text style={[styles.clickableArrowText, { color: '#D97706' }]}>View ➔</Text>
            </View>
          </View>
          <Text style={[styles.kpiValue, { color: pendingOrdersCount > 0 ? '#D97706' : Colors.textMain }]}>
            {pendingOrdersCount}
          </Text>
          <Text style={styles.kpiLabel}>Pending Orders (Today)</Text>
        </TouchableOpacity>

        {/* Card 4: Active Open Branches */}
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIconWrap, { backgroundColor: Colors.warningLight }]}>
            <Building2 size={18} color={Colors.warning} />
          </View>
          <Text style={styles.kpiValue}>
            {activeBranchesCount} / {branches.length}
          </Text>
          <Text style={styles.kpiLabel}>Active Open Branches</Text>
        </View>
      </View>

      {/* Central Staff Administration Quick Tile */}
      {onNavigateToStaff && (
        <View style={styles.quickActionCard}>
          <View style={styles.actionLeft}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Users size={16} color={Colors.primary} />
              <Text style={styles.actionCardTitle}>Enterprise Staff ({staffCount} members)</Text>
            </View>
            <Text style={styles.actionCardSub}>
              Manage managers, chefs, cashiers, waiters & riders across all branches
              {suspendedStaff > 0 ? ` • ${suspendedStaff} accounts suspended` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.actionBtn} onPress={onNavigateToStaff}>
            <Text style={styles.actionBtnText}>Manage Staff ➔</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Comparative Branch Performance Cards (Strictly Today's Data) */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Branch Performance Today ({branches.length} Cities)</Text>
        <TouchableOpacity onPress={onNavigateToBranches}>
          <Text style={styles.linkText}>Manage Branches →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.branchList}>
        {branches.map((b) => {
          const normBId = normalizeBranchId(b.id);
          const branchOrders = todayOrders.filter(
            (o) => !o.branchId || normalizeBranchId(o.branchId) === normBId
          );
          const branchPaid = branchOrders.filter(isOrderPaid);
          const branchRev = branchPaid.reduce(
            (sum, o) => sum + Number(o.total || 0),
            0
          );

          return (
            <View key={b.id} style={styles.branchCard}>
              <View style={styles.branchCardTop}>
                <View>
                  <Text style={styles.branchName}>{b.name}</Text>
                  <Text style={styles.branchCity}>
                    {b.city} • {b.address}
                  </Text>
                </View>
                <View
                  style={[
                    styles.openBadge,
                    { backgroundColor: b.isOpen ? Colors.successLight : Colors.dangerLight },
                  ]}
                >
                  <Text
                    style={[
                      styles.openBadgeText,
                      { color: b.isOpen ? Colors.success : Colors.danger },
                    ]}
                  >
                    {b.isOpen ? 'ACTIVE OPEN' : 'CLOSED'}
                  </Text>
                </View>
              </View>

              <View style={styles.branchMetricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>Rs. {branchRev.toLocaleString()}</Text>
                  <Text style={styles.metricLbl}>
                    {branchPaid.length > 0 ? `✓ ${branchPaid.length} Paid` : 'Awaiting Paid'}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>{branchOrders.length}</Text>
                  <Text style={styles.metricLbl}>Orders Today</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>{b.maxOrderDistanceKm || 50} km</Text>
                  <Text style={styles.metricLbl}>Delivery Radius</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>{b.tableQrMaxDistanceMeters || 300}m</Text>
                  <Text style={styles.metricLbl}>Table QR Radius</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Announcements board inside Overview (also available as its own tab) */}
      <AnnouncementsBoard embedded />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    gap: 4,
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    elevation: 2,
  },
  kpiCardClickable: {
    borderColor: 'rgba(217, 101, 40, 0.3)',
  },
  kpiCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clickableArrowPill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  clickableArrowText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textMain,
  },
  kpiLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  linkText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  branchList: {
    gap: 12,
    marginBottom: 16,
  },
  branchCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  branchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  branchName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  branchCity: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  openBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  openBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  branchMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
    paddingTop: 8,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMain,
  },
  metricLbl: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 1,
  },
  quickActionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  actionLeft: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  actionCardSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  liveSyncStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  liveOrdersList: {
    gap: 8,
    marginBottom: 16,
  },
  emptyOrderCard: {
    backgroundColor: Colors.bgCard,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  emptyOrderText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  liveOrderRow: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  liveOrderLeft: {
    flex: 1,
    marginRight: 10,
  },
  liveOrderNum: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
  livePayBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  livePayBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  liveStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  liveOrderCustomer: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 3,
  },
  liveOrderTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
});
