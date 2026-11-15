import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Modal } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { normalizeBranchId } from '../services/api';
import {
  Building2,
  TrendingUp,
  Clock,
  Utensils,
  Bike,
  Flame,
  AlertCircle,
  Plus,
  Minus,
  Users,
  Banknote,
  Receipt,
  CreditCard,
  Smartphone,
  Building,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Sliders,
  X,
  CheckCircle,
  Megaphone,
} from 'lucide-react-native';

interface ManagerDashboardProps {
  onNavigateToKitchen?: () => void;
  onNavigateToOrders?: () => void;
  onNavigateToTables?: () => void;
  onNavigateToStaff?: () => void;
  onNavigateToFinancials?: () => void;
  onNavigateToMenu?: () => void;
}

export function ManagerDashboard({
  onNavigateToKitchen,
  onNavigateToOrders,
  onNavigateToTables,
  onNavigateToStaff,
  onNavigateToFinancials,
  onNavigateToMenu,
}: ManagerDashboardProps = {}) {
  const { currentBranch, updateBranchSettings, toggleBranchStatus, orders, tables, refunds, users, shifts, showToast, openNotificationModal, setBottomSheetOpen } = useApp();

  const normCurrentBranchId = normalizeBranchId(currentBranch.id);

  // Real-time today's date comparator with ISO, timestamp, and formatted date support
  const isToday = (val?: any) => {
    if (!val) return true;
    if (typeof val === 'number') {
      const d = new Date(val);
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (typeof val === 'string') {
      const lower = val.toLowerCase();
      if (lower.includes('today') || lower.includes('just now') || lower.includes('min ago') || lower.includes('sec ago')) return true;
      let target = val;
      if (val.includes('•')) {
        const parts = val.split('•');
        target = parts[1]?.trim() || parts[0]?.trim();
      }
      const d = new Date(target);
      if (!isNaN(d.getTime())) {
        const now = new Date();
        return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      const dDirect = new Date(val);
      if (!isNaN(dDirect.getTime())) {
        const now = new Date();
        return dDirect.getDate() === now.getDate() && dDirect.getMonth() === now.getMonth() && dDirect.getFullYear() === now.getFullYear();
      }
    }
    return false;
  };

  const isOrderPaid = (o: any) => {
    if (o.paymentStatus === 'paid') return true;
    if (o.paymentCollected === true) return true;
    if (o.status === 'completed') return true;
    if (o.status === 'delivered' && (o.paymentStatus === 'paid' || o.paymentCollected === true)) return true;
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

  const branchOrders = orders.filter(
    (o) => !o.branchId || o.branchId === currentBranch.id || normalizeBranchId(o.branchId) === normCurrentBranchId
  );

  // Real today's paid collections
  const todayBranchOrders = branchOrders.filter((o) => isToday(o.createdAt));
  const paidOrdersToday = todayBranchOrders.filter(isOrderPaid);
  const todayRevenue = paidOrdersToday.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const todayDineInCount = todayBranchOrders.filter((o) => o.type === 'dine_in').length;
  const todayTakeawayCount = todayBranchOrders.filter((o) => o.type === 'takeaway').length;
  const todayDeliveryCount = todayBranchOrders.filter((o) => o.type === 'delivery').length;

  // Real-time kitchen in-flight
  const activeKitchenOrders = branchOrders.filter((o) =>
    ['placed', 'accepted', 'preparing'].includes(o.status)
  );

  const activeDineInOrders = branchOrders.filter(
    (o) => o.type === 'dine_in' && o.tableNumber && o.status !== 'completed' && o.status !== 'cancelled'
  );
  const activeOccupiedTableNumbers = new Set(
    activeDineInOrders.map((o) => String(o.tableNumber).trim().toLowerCase())
  );

  // Live tables data from floor staff
  const branchTables = tables.filter((t) => {
    if (!t.branchId) return true;
    return normalizeBranchId(t.branchId) === normCurrentBranchId;
  });

  const isTableOccupied = (t: any) => {
    if (t.status === 'occupied') return true;
    const numStr = String(t.number).trim().toLowerCase();
    const idStr = String(t.id).trim().toLowerCase();
    return activeOccupiedTableNumbers.has(numStr) || activeOccupiedTableNumbers.has(idStr);
  };

  const occupiedTablesCount = branchTables.filter(isTableOccupied).length;
  const availableTables = branchTables.filter((t) => !isTableOccupied(t));
  const occupancyPercent = branchTables.length > 0 ? Math.round((occupiedTablesCount / branchTables.length) * 100) : 0;
  const activeDeliveries = branchOrders.filter(
    (o) => o.type === 'delivery' && o.status === 'out_for_delivery'
  ).length;

  const pendingRefunds = refunds.filter(
    (r) => (!r.branchId || r.branchId === currentBranch.id) && r.status === 'requested'
  );

  const branchStaff = users.filter((u) => !u.branchId || u.branchId === currentBranch.id);
  const activeStaffCount = branchStaff.filter((u) => u.status === 'active').length;
  const suspendedStaffCount = branchStaff.filter((u) => u.status === 'suspended').length;

  const branchRiders = branchStaff.filter((u) => u.role === 'delivery_staff');
  const onlineRiders = branchRiders.filter(
    (u) => u.riderAvailability === 'available' || (!u.riderAvailability && u.status === 'active')
  );
  const offlineRiders = branchRiders.filter(
    (u) => u.riderAvailability === 'offline' || (u.riderAvailability && u.riderAvailability !== 'available')
  );

  // Staff Collections Filter: 'all' | 'cashier' | 'rider' | 'waiter' | 'user:<id>'
  const [collectionsStaffFilter, setCollectionsStaffFilter] = useState<string>('all');
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [showStaffFilterModal, setShowStaffFilterModal] = useState<boolean>(false);

  const staffCollectionsData = React.useMemo(() => {
    const bCashiers = users.filter(
      (u) => u.role === 'cashier' && (!u.branchId || normalizeBranchId(u.branchId) === normCurrentBranchId)
    );
    const bRiders = users.filter(
      (u) => u.role === 'delivery_staff' && (!u.branchId || normalizeBranchId(u.branchId) === normCurrentBranchId)
    );
    const bWaiters = users.filter(
      (u) => (u.role === 'floor_staff' || (u.role as string) === 'waiter') && (!u.branchId || normalizeBranchId(u.branchId) === normCurrentBranchId)
    );

    const bPaidOrdersToday = orders.filter((o) => {
      const matchBranch = !o.branchId || o.branchId === currentBranch.id || normalizeBranchId(o.branchId) === normCurrentBranchId;
      if (!matchBranch) return false;
      if (o.status === 'cancelled') return false;
      return isToday(o.createdAt) && isOrderPaid(o);
    });

    const isOrderCash = (o: any) => {
      const method = (o.paymentMethod || '').toLowerCase();
      return method.includes('cash') || method.includes('cod');
    };

    const calculateForStaff = (user: typeof users[0], roleCategory: 'cashier' | 'rider' | 'waiter') => {
      let matchedOrders: any[] = [];

      if (roleCategory === 'cashier') {
        const cashierShifts = (shifts || []).filter(
          (s: any) => s.cashierId === user.id || (user.name && s.cashierName?.toLowerCase().includes(user.name.toLowerCase()))
        );
        const shiftIds = cashierShifts.map((s: any) => s.id);

        matchedOrders = bPaidOrdersToday.filter((o: any) => {
          if (o.cashierId === user.id) return true;
          if ((o as any).staffId === user.id) return true;
          if (o.shiftId && shiftIds.includes(o.shiftId)) return true;
          if (user.name && o.cashierName && o.cashierName.toLowerCase().includes(user.name.toLowerCase())) return true;
          if (!o.cashierId && !o.shiftId && bCashiers[0]?.id === user.id) {
            return o.isWalkIn || o.type === 'takeaway' || (!o.assignedRiderId && !o.assignedWaiterId);
          }
          return false;
        });
      } else if (roleCategory === 'rider') {
        matchedOrders = bPaidOrdersToday.filter((o: any) => {
          if (o.type !== 'delivery') return false;
          if (o.assignedRiderId === user.id) return true;
          if (user.name && o.assignedRiderName && o.assignedRiderName.toLowerCase().includes(user.name.toLowerCase())) return true;
          return false;
        });
      } else if (roleCategory === 'waiter') {
        matchedOrders = bPaidOrdersToday.filter((o: any) => {
          if (o.type !== 'dine_in') return false;
          if (o.assignedWaiterId === user.id) return true;
          if (user.name && o.assignedWaiterName && o.assignedWaiterName.toLowerCase().includes(user.name.toLowerCase())) return true;
          if (!o.assignedWaiterId && !o.assignedWaiterName && user.assignedTableNumbers && o.tableNumber && user.assignedTableNumbers.includes(String(o.tableNumber))) return true;
          return false;
        });
      }

      const uniqueOrders = Array.from(new Map(matchedOrders.map((o) => [o.id, o])).values());
      const rawCash = uniqueOrders.filter(isOrderCash).reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      let effectiveCash = rawCash;
      if (roleCategory === 'cashier') {
        const userShifts = (shifts || []).filter((s: any) => s.cashierId === user.id);
        const shiftCashTotal = userShifts.reduce((sum: number, s: any) => sum + (Number(s.cashCollected) || 0), 0);
        effectiveCash = Math.max(rawCash, shiftCashTotal);
      }

      const digitalCollected = uniqueOrders.filter((o) => !isOrderCash(o)).reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const totalCollected = effectiveCash + digitalCollected;

      return {
        user,
        roleCategory,
        orders: uniqueOrders,
        ordersCount: uniqueOrders.length,
        cashCollected: effectiveCash,
        digitalCollected,
        totalCollected,
      };
    };

    const cashiers = bCashiers.map((u) => calculateForStaff(u, 'cashier'));
    const riders = bRiders.map((u) => calculateForStaff(u, 'rider'));
    const waiters = bWaiters.map((u) => calculateForStaff(u, 'waiter'));
    const allStaff = [...cashiers, ...riders, ...waiters];

    const grandTotal = allStaff.reduce((sum, s) => sum + s.totalCollected, 0);
    const grandCash = allStaff.reduce((sum, s) => sum + s.cashCollected, 0);
    const grandDigital = allStaff.reduce((sum, s) => sum + s.digitalCollected, 0);
    const grandOrders = allStaff.reduce((sum, s) => sum + s.ordersCount, 0);

    return {
      allStaff,
      cashiers,
      riders,
      waiters,
      grandTotal,
      grandCash,
      grandDigital,
      grandOrders,
    };
  }, [users, orders, currentBranch.id, normCurrentBranchId, shifts]);

  const displayedStaffList = React.useMemo(() => {
    if (collectionsStaffFilter === 'all') return staffCollectionsData.allStaff;
    if (collectionsStaffFilter === 'cashier') return staffCollectionsData.cashiers;
    if (collectionsStaffFilter === 'rider') return staffCollectionsData.riders;
    if (collectionsStaffFilter === 'waiter') return staffCollectionsData.waiters;
    if (collectionsStaffFilter.startsWith('user:')) {
      const uId = collectionsStaffFilter.replace('user:', '');
      return staffCollectionsData.allStaff.filter((s) => s.user.id === uId);
    }
    return staffCollectionsData.allStaff;
  }, [collectionsStaffFilter, staffCollectionsData]);

  // Toggle Handlers
  const handleToggleOpen = () => {
    toggleBranchStatus(currentBranch.id);
  };

  const handleToggleBusy = () => {
    const nextBusy = !currentBranch.isBusy;
    updateBranchSettings(currentBranch.id, { isBusy: nextBusy });
    showToast(
      `Busy mode ${nextBusy ? 'ACTIVATED (customer prep warning displayed)' : 'DEACTIVATED'}`,
      nextBusy ? 'warning' : 'info'
    );
  };

  const handleAdjustPrepTime = (delta: number) => {
    const newTime = Math.max(10, Math.min(90, (currentBranch.prepTimeEstimateMin || 25) + delta));
    updateBranchSettings(currentBranch.id, { prepTimeEstimateMin: newTime });
    showToast(`Kitchen prep estimate updated to ${newTime} mins`, 'info');
  };

  const handleAdjustEditWindow = (delta: number) => {
    const newWindow = Math.max(1, Math.min(30, (currentBranch.fullEditWindowMin || 5) + delta));
    updateBranchSettings(currentBranch.id, { fullEditWindowMin: newWindow });
    showToast(`Full-edit window updated to ${newWindow} mins`, 'info');
  };

  const handleAdjustStopAddons = (delta: number) => {
    const newCutoff = Math.max(1, Math.min(30, (currentBranch.stopAddOnsMinBeforeReady || 5) + delta));
    updateBranchSettings(currentBranch.id, { stopAddOnsMinBeforeReady: newCutoff });
    showToast(`Add-on cutoff updated to ${newCutoff} mins before ready`, 'info');
  };

  const handleAdjustMaxDistance = (delta: number) => {
    const newDist = Math.max(5, Math.min(100, (currentBranch.maxOrderDistanceKm || 50) + delta));
    updateBranchSettings(currentBranch.id, { maxOrderDistanceKm: newDist });
    showToast(`Delivery boundary updated to ${newDist} km`, 'info');
  };

  const handleAdjustTableQrRadius = (delta: number) => {
    const newRadius = Math.max(50, Math.min(1000, (currentBranch.tableQrMaxDistanceMeters || 300) + delta));
    updateBranchSettings(currentBranch.id, { tableQrMaxDistanceMeters: newRadius });
    showToast(`Table QR geofence updated to ${newRadius}m`, 'info');
  };

  const handleAdjustMinDelivery = (delta: number) => {
    const newMin = Math.max(0, Math.min(10000, (currentBranch.minDeliveryAmount ?? 500) + delta));
    updateBranchSettings(currentBranch.id, { minDeliveryAmount: newMin });
    showToast(`Min delivery amount set to Rs. ${newMin}`, 'info');
  };

  const handleToggleDelivery = () => {
    const nextDelivery = !currentBranch.deliveryEnabled;
    updateBranchSettings(currentBranch.id, { deliveryEnabled: nextDelivery });
    showToast(`Doorstep delivery service ${nextDelivery ? 'ENABLED' : 'PAUSED'}`, 'info');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Branch Header Card */}
      <View style={styles.branchHeaderCard}>
        <View style={styles.branchInfoRow}>
          <View style={styles.branchIconWrap}>
            <Building2 size={22} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.branchTitle}>{currentBranch.name}</Text>
            <Text style={styles.branchSub}>
              {currentBranch.city} • {currentBranch.address}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: currentBranch.isOpen ? Colors.successLight : Colors.dangerLight },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                { color: currentBranch.isOpen ? Colors.success : Colors.danger },
              ]}
            >
              {currentBranch.isOpen ? 'ONLINE' : 'CLOSED'}
            </Text>
          </View>
        </View>
      </View>

      {/* KPI Stats Grid */}
      <View style={styles.kpiGrid}>
        {/* Revenue */}
        <TouchableOpacity
          style={styles.kpiCard}
          onPress={onNavigateToOrders}
          activeOpacity={onNavigateToOrders ? 0.75 : 1}
        >
          <View style={styles.kpiTop}>
            <Text style={styles.kpiLabel}>Total Collection Today</Text>
            <TrendingUp size={15} color={paidOrdersToday.length > 0 ? Colors.success : '#D97706'} />
          </View>
          <View style={styles.kpiValRow}>
            <Text style={styles.kpiVal}>Rs. {todayRevenue.toLocaleString()}</Text>
            <Text style={styles.kpiViewPill}>View ➔</Text>
          </View>
          <Text style={styles.kpiSub}>
            {paidOrdersToday.length > 0
              ? `✓ ${paidOrdersToday.length} Paid • ${todayBranchOrders.length} Orders`
              : `Payment: Awaiting Paid Orders • ${todayBranchOrders.length} Placed`}
          </Text>
        </TouchableOpacity>

        {/* Total Orders Today (Clickable -> Navigates to Orders) */}
        <TouchableOpacity
          style={styles.kpiCard}
          onPress={onNavigateToOrders}
          activeOpacity={onNavigateToOrders ? 0.75 : 1}
        >
          <View style={styles.kpiTop}>
            <Text style={styles.kpiLabel}>Total Orders Today</Text>
            <Receipt size={15} color={Colors.primary} />
          </View>
          <View style={styles.kpiValRow}>
            <Text style={styles.kpiVal}>{todayBranchOrders.length}</Text>
            <Text style={styles.kpiViewPill}>View ➔</Text>
          </View>
          <Text style={[styles.kpiSub, { color: Colors.primary, fontWeight: '700' }]}>
            Dine-In ({todayDineInCount}) • Takeaway ({todayTakeawayCount}) • Delivery ({todayDeliveryCount})
          </Text>
        </TouchableOpacity>

        {/* Table Occupancy */}
        <TouchableOpacity
          style={[styles.kpiCard, { borderColor: Colors.info, borderWidth: 1 }]}
          onPress={() => onNavigateToTables?.()}
          activeOpacity={0.7}
        >
          <View style={styles.kpiTop}>
            <Text style={styles.kpiLabel}>Table Occupancy</Text>
            <Utensils size={15} color={Colors.info} />
          </View>
          <Text style={styles.kpiVal}>{occupiedTablesCount} of {branchTables.length} Occupied</Text>
          <Text style={[styles.kpiSub, { color: Colors.primary, fontWeight: '700' }]}>
            🔍 View all floor tables →
          </Text>
        </TouchableOpacity>

        {/* Active Deliveries */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiTop}>
            <Text style={styles.kpiLabel}>Riders Fleet</Text>
            <Bike size={15} color={Colors.warning} />
          </View>
          <Text style={styles.kpiVal}>{onlineRiders.length} Online</Text>
          <Text style={styles.kpiSub}>
            {offlineRiders.length} Offline • {activeDeliveries} On Road
          </Text>
        </View>
      </View>

      {/* Staff Collections Breakdown (Cashier, Rider, Waiter) */}
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Banknote size={17} color={Colors.success} />
              <Text style={styles.cardTitle}>Staff Collections</Text>
            </View>
            <Text style={styles.cardSub}>Money collected by Cashiers, Riders & Waiters</Text>
          </View>

          {/* Dropdown Button */}
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setShowStaffFilterModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownBtnText} numberOfLines={1}>
              {collectionsStaffFilter === 'all'
                ? 'All Staff'
                : collectionsStaffFilter === 'cashier'
                  ? 'Cashiers'
                  : collectionsStaffFilter === 'rider'
                    ? 'Riders'
                    : collectionsStaffFilter === 'waiter'
                      ? 'Waiters'
                      : 'Specific'}
            </Text>
            <ChevronDown size={13} color="#1E40AF" />
          </TouchableOpacity>
        </View>

        {/* Quick Horizontal Selector Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
          <TouchableOpacity
            style={[styles.staffFilterPill, collectionsStaffFilter === 'all' && styles.staffFilterPillActive]}
            onPress={() => setCollectionsStaffFilter('all')}
          >
            <Text style={[styles.staffFilterPillText, collectionsStaffFilter === 'all' && styles.staffFilterPillTextActive]}>
              👥 All ({staffCollectionsData.allStaff.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.staffFilterPill, collectionsStaffFilter === 'cashier' && styles.staffFilterPillActive]}
            onPress={() => setCollectionsStaffFilter('cashier')}
          >
            <Text style={[styles.staffFilterPillText, collectionsStaffFilter === 'cashier' && styles.staffFilterPillTextActive]}>
              💵 Cashier ({staffCollectionsData.cashiers.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.staffFilterPill, collectionsStaffFilter === 'rider' && styles.staffFilterPillActive]}
            onPress={() => setCollectionsStaffFilter('rider')}
          >
            <Text style={[styles.staffFilterPillText, collectionsStaffFilter === 'rider' && styles.staffFilterPillTextActive]}>
              🛵 Rider ({staffCollectionsData.riders.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.staffFilterPill, collectionsStaffFilter === 'waiter' && styles.staffFilterPillActive]}
            onPress={() => setCollectionsStaffFilter('waiter')}
          >
            <Text style={[styles.staffFilterPillText, collectionsStaffFilter === 'waiter' && styles.staffFilterPillTextActive]}>
              🍽️ Waiter ({staffCollectionsData.waiters.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Aggregate KPI Banner */}
        <View style={styles.collectionKpiBanner}>
          <View style={styles.collectionKpiCol}>
            <Text style={styles.collectionKpiLabel}>TOTAL SETTLED</Text>
            <Text style={styles.collectionKpiVal}>
              Rs. {displayedStaffList.reduce((sum, s) => sum + s.totalCollected, 0).toLocaleString()}
            </Text>
            <Text style={styles.collectionKpiSub}>
              {displayedStaffList.reduce((sum, s) => sum + s.ordersCount, 0)} orders
            </Text>
          </View>
          <View style={styles.collectionKpiDivider} />
          <View style={styles.collectionKpiCol}>
            <Text style={styles.collectionKpiLabel}>CASH</Text>
            <Text style={[styles.collectionKpiVal, { color: '#C2410C' }]}>
              Rs. {displayedStaffList.reduce((sum, s) => sum + s.cashCollected, 0).toLocaleString()}
            </Text>
            <Text style={styles.collectionKpiSub}>Handed in cash</Text>
          </View>
          <View style={styles.collectionKpiDivider} />
          <View style={styles.collectionKpiCol}>
            <Text style={styles.collectionKpiLabel}>DIGITAL</Text>
            <Text style={[styles.collectionKpiVal, { color: Colors.primary }]}>
              Rs. {displayedStaffList.reduce((sum, s) => sum + s.digitalCollected, 0).toLocaleString()}
            </Text>
            <Text style={styles.collectionKpiSub}>Online / prepaid</Text>
          </View>
        </View>

        {/* Staff Members List */}
        <View style={{ gap: 10, marginTop: 12 }}>
          {displayedStaffList.length === 0 ? (
            <View style={styles.emptyStaffBox}>
              <Text style={styles.emptyStaffText}>No staff records found for this filter.</Text>
            </View>
          ) : (
            displayedStaffList.map((item) => {
              const isExpanded = expandedStaffId === item.user.id;
              const roleBadgeColor =
                item.roleCategory === 'cashier'
                  ? { bg: '#DCFCE7', text: '#15803D', label: '💵 CASHIER' }
                  : item.roleCategory === 'rider'
                    ? { bg: '#FFEDD5', text: '#C2410C', label: '🛵 RIDER' }
                    : { bg: '#F3E8FF', text: '#7E22CE', label: '🍽️ WAITER' };

              return (
                <View key={item.user.id} style={styles.staffCollectionCard}>
                  <View style={styles.staffCardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.staffCardName}>{item.user.name}</Text>
                        <View style={[styles.staffRolePill, { backgroundColor: roleBadgeColor.bg }]}>
                          <Text style={[styles.staffRolePillText, { color: roleBadgeColor.text }]}>
                            {roleBadgeColor.label}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.staffCardSub}>
                        {item.user.phone || item.user.email} • {item.ordersCount} Orders
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.staffCollectedVal}>
                        Rs. {item.totalCollected.toLocaleString()}
                      </Text>
                      <Text style={styles.staffCollectedBreakdown}>
                        Cash: Rs. {item.cashCollected.toLocaleString()} • Digital: Rs. {item.digitalCollected.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {/* Expand / Collapse Button */}
                  <TouchableOpacity
                    style={styles.expandOrderBtn}
                    onPress={() => setExpandedStaffId(isExpanded ? null : item.user.id)}
                    disabled={item.ordersCount === 0}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.expandOrderBtnText}>
                      {item.ordersCount > 0
                        ? isExpanded
                          ? 'Hide Orders ▲'
                          : `View ${item.ordersCount} Orders ▼`
                        : '0 Orders'}
                    </Text>
                    {isExpanded ? (
                      <ChevronUp size={13} color={Colors.primary} />
                    ) : (
                      <ChevronDown size={13} color={item.ordersCount > 0 ? Colors.primary : Colors.textMuted} />
                    )}
                  </TouchableOpacity>

                  {/* Expanded Itemized Orders List */}
                  {isExpanded && item.orders.length > 0 && (
                    <View style={styles.itemizedOrdersBox}>
                      {item.orders.map((ord: any) => {
                        const isCash =
                          (ord.paymentMethod || '').toLowerCase().includes('cash') ||
                          (ord.paymentMethod || '').toLowerCase().includes('cod');
                        return (
                          <View key={ord.id} style={styles.itemizedOrderRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.itemizedOrderNum}>
                                #{ord.orderNumber}{' '}
                                <Text style={styles.itemizedOrderType}>
                                  ({ord.type === 'delivery' ? 'Delivery 🛵' : ord.type === 'dine_in' ? `Table ${ord.tableNumber || '?'} 🍽️` : 'Takeaway 🛍️'})
                                </Text>
                              </Text>
                              <Text style={styles.itemizedOrderCustomer} numberOfLines={1}>
                                {ord.customerName}
                              </Text>
                            </View>

                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={styles.itemizedOrderAmt}>Rs. {Number(ord.total).toLocaleString()}</Text>
                              <Text style={[styles.itemizedOrderPay, { color: isCash ? '#C2410C' : Colors.success }]}>
                                {isCash ? 'Cash' : ord.paymentMethod || 'Online'}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* Dropdown Modal for Selecting Cashier, Rider, Waiter, or specific staff */}
      <Modal visible={showStaffFilterModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowStaffFilterModal(false)}
        >
          <View style={styles.filterModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Staff Role / Person</Text>
              <TouchableOpacity onPress={() => setShowStaffFilterModal(false)}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.modalOption, collectionsStaffFilter === 'all' && styles.modalOptionActive]}
                onPress={() => {
                  setCollectionsStaffFilter('all');
                  setShowStaffFilterModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, collectionsStaffFilter === 'all' && styles.modalOptionTextActive]}>
                  👥 All Staff (Cashier, Rider, Waiter)
                </Text>
              </TouchableOpacity>

              <Text style={styles.modalGroupTitle}>FILTER BY ROLE</Text>

              <TouchableOpacity
                style={[styles.modalOption, collectionsStaffFilter === 'cashier' && styles.modalOptionActive]}
                onPress={() => {
                  setCollectionsStaffFilter('cashier');
                  setShowStaffFilterModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, collectionsStaffFilter === 'cashier' && styles.modalOptionTextActive]}>
                  💵 All Cashiers ({staffCollectionsData.cashiers.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalOption, collectionsStaffFilter === 'rider' && styles.modalOptionActive]}
                onPress={() => {
                  setCollectionsStaffFilter('rider');
                  setShowStaffFilterModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, collectionsStaffFilter === 'rider' && styles.modalOptionTextActive]}>
                  🛵 All Riders ({staffCollectionsData.riders.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalOption, collectionsStaffFilter === 'waiter' && styles.modalOptionActive]}
                onPress={() => {
                  setCollectionsStaffFilter('waiter');
                  setShowStaffFilterModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, collectionsStaffFilter === 'waiter' && styles.modalOptionTextActive]}>
                  🍽️ All Waiters ({staffCollectionsData.waiters.length})
                </Text>
              </TouchableOpacity>

              {staffCollectionsData.cashiers.length > 0 && (
                <>
                  <Text style={styles.modalGroupTitle}>CASHIERS</Text>
                  {staffCollectionsData.cashiers.map((c) => (
                    <TouchableOpacity
                      key={c.user.id}
                      style={[styles.modalOption, collectionsStaffFilter === `user:${c.user.id}` && styles.modalOptionActive]}
                      onPress={() => {
                        setCollectionsStaffFilter(`user:${c.user.id}`);
                        setShowStaffFilterModal(false);
                      }}
                    >
                      <Text style={[styles.modalOptionText, collectionsStaffFilter === `user:${c.user.id}` && styles.modalOptionTextActive]}>
                        💵 {c.user.name} • Rs. {c.totalCollected.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {staffCollectionsData.riders.length > 0 && (
                <>
                  <Text style={styles.modalGroupTitle}>RIDERS</Text>
                  {staffCollectionsData.riders.map((r) => (
                    <TouchableOpacity
                      key={r.user.id}
                      style={[styles.modalOption, collectionsStaffFilter === `user:${r.user.id}` && styles.modalOptionActive]}
                      onPress={() => {
                        setCollectionsStaffFilter(`user:${r.user.id}`);
                        setShowStaffFilterModal(false);
                      }}
                    >
                      <Text style={[styles.modalOptionText, collectionsStaffFilter === `user:${r.user.id}` && styles.modalOptionTextActive]}>
                        🛵 {r.user.name} • Rs. {r.totalCollected.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {staffCollectionsData.waiters.length > 0 && (
                <>
                  <Text style={styles.modalGroupTitle}>WAITERS</Text>
                  {staffCollectionsData.waiters.map((w) => (
                    <TouchableOpacity
                      key={w.user.id}
                      style={[styles.modalOption, collectionsStaffFilter === `user:${w.user.id}` && styles.modalOptionActive]}
                      onPress={() => {
                        setCollectionsStaffFilter(`user:${w.user.id}`);
                        setShowStaffFilterModal(false);
                      }}
                    >
                      <Text style={[styles.modalOptionText, collectionsStaffFilter === `user:${w.user.id}` && styles.modalOptionTextActive]}>
                        🍽️ {w.user.name} • Rs. {w.totalCollected.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Quick Action Navigation Tiles */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manager Power Actions</Text>
        <Text style={styles.cardSub}>Quick workspace navigation across branch modules</Text>

        <View style={styles.quickGrid}>
          {onNavigateToStaff && (
            <TouchableOpacity style={styles.actionTile} onPress={onNavigateToStaff}>
              <View style={[styles.tileIcon, { backgroundColor: Colors.primaryLight }]}>
                <Users size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tileTitle}>Staff Team</Text>
                <Text style={styles.tileSub}>
                  {activeStaffCount} active{suspendedStaffCount > 0 ? ` • ${suspendedStaffCount} suspended` : ''}
                </Text>
              </View>
              <ChevronRight size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

          {onNavigateToFinancials && (
            <TouchableOpacity style={styles.actionTile} onPress={onNavigateToFinancials}>
              <View style={[styles.tileIcon, { backgroundColor: Colors.successLight }]}>
                <Banknote size={18} color={Colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tileTitle}>Cash Desk & Refunds</Text>
                <Text style={styles.tileSub}>
                  {pendingRefunds.length > 0 ? `${pendingRefunds.length} pending refunds!` : 'Shift drawer balance'}
                </Text>
              </View>
              {pendingRefunds.length > 0 && (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>{pendingRefunds.length}</Text>
                </View>
              )}
              <ChevronRight size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}

          {onNavigateToMenu && (
            <TouchableOpacity style={styles.actionTile} onPress={onNavigateToMenu}>
              <View style={[styles.tileIcon, { backgroundColor: Colors.infoLight }]}>
                <Utensils size={18} color={Colors.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tileTitle}>Menu & Branch Prices</Text>
                <Text style={styles.tileSub}>Stock toggles & branch price overrides</Text>
              </View>
              <ChevronRight size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Operational Controls Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Sliders size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>Live Operational Controls</Text>
        </View>

        {/* Branch Open/Close */}
        <View style={styles.controlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.controlTitle}>Branch Storefront Status</Text>
            <Text style={styles.controlSub}>Accept or pause customer orders across web and app</Text>
          </View>
          <Switch
            value={currentBranch.isOpen}
            onValueChange={handleToggleOpen}
            trackColor={{ false: Colors.borderColor, true: Colors.success }}
          />
        </View>

        {/* Rush Hour / Busy Mode */}
        <View style={styles.controlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.controlTitle}>Rush Hour / High Kitchen Load</Text>
            <Text style={styles.controlSub}>Displays warning banner to customers & extends prep time</Text>
          </View>
          <Switch
            value={currentBranch.isBusy}
            onValueChange={handleToggleBusy}
            trackColor={{ false: Colors.borderColor, true: Colors.primary }}
          />
        </View>

        {/* Delivery Service Enable/Disable */}
        <View style={styles.controlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.controlTitle}>Doorstep Delivery Service</Text>
            <Text style={styles.controlSub}>Allow riders to dispatch deliveries from this branch</Text>
          </View>
          <Switch
            value={currentBranch.deliveryEnabled}
            onValueChange={handleToggleDelivery}
            trackColor={{ false: Colors.borderColor, true: Colors.primary }}
          />
        </View>

        {/* Kitchen Prep Time Stepper */}
        <View style={styles.controlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.controlTitle}>Kitchen Prep Time Estimate</Text>
            <Text style={styles.controlSub}>Standard wait time displayed to customers</Text>
          </View>
          <View style={styles.stepperWrap}>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustPrepTime(-5)}>
              <Minus size={14} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.stepperVal}>{currentBranch.prepTimeEstimateMin || 25}m</Text>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustPrepTime(5)}>
              <Plus size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Two-Stage Rules: Stage 1 Edit Window */}
        <View style={styles.controlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.controlTitle}>Stage 1: Full-Edit Window</Text>
            <Text style={styles.controlSub}>Customer full edits allowed after placement</Text>
          </View>
          <View style={styles.stepperWrap}>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustEditWindow(-1)}>
              <Minus size={14} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.stepperVal}>{currentBranch.fullEditWindowMin || 5}m</Text>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustEditWindow(1)}>
              <Plus size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Two-Stage Rules: Stage 2 Stop Add-ons */}
        <View style={styles.controlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.controlTitle}>Stage 2 Cutoff: Stop Add-ons</Text>
            <Text style={styles.controlSub}>Lock customer add-ons before food is ready</Text>
          </View>
          <View style={styles.stepperWrap}>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustStopAddons(-1)}>
              <Minus size={14} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.stepperVal}>{currentBranch.stopAddOnsMinBeforeReady || 5}m</Text>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustStopAddons(1)}>
              <Plus size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Max Delivery Acceptance Distance */}
        <View style={styles.controlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.controlTitle}>Max Order Delivery Distance</Text>
            <Text style={styles.controlSub}>Maximum customer delivery radius from branch</Text>
          </View>
          <View style={styles.stepperWrap}>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustMaxDistance(-5)}>
              <Minus size={14} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.stepperVal}>{currentBranch.maxOrderDistanceKm || 50}km</Text>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustMaxDistance(5)}>
              <Plus size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Table QR Ordering Radius */}
        <View style={styles.controlRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.controlTitle}>Table QR Geofence Radius</Text>
            <Text style={styles.controlSub}>GPS check to prevent remote table ordering</Text>
          </View>
          <View style={styles.stepperWrap}>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustTableQrRadius(-50)}>
              <Minus size={14} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.stepperVal}>{currentBranch.tableQrMaxDistanceMeters || 300}m</Text>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustTableQrRadius(50)}>
              <Plus size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Minimum Delivery Order Amount */}
        <View style={[styles.controlRow, { borderBottomWidth: 0 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.controlTitle}>Minimum Delivery Amount</Text>
            <Text style={styles.controlSub}>Orders below this cannot checkout for delivery</Text>
          </View>
          <View style={styles.stepperWrap}>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustMinDelivery(-50)}>
              <Minus size={14} color={Colors.primary} />
            </TouchableOpacity>
            <Text style={styles.stepperVal}>Rs. {currentBranch.minDeliveryAmount ?? 500}</Text>
            <TouchableOpacity style={styles.stepperBtn} onPress={() => handleAdjustMinDelivery(50)}>
              <Plus size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
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
  branchHeaderCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  branchInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  branchIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  branchSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  kpiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
  },
  kpiSub: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  kpiValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  kpiViewPill: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    backgroundColor: Colors.primary + '14',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
  },
  cardSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  quickGrid: {
    gap: 8,
  },
  actionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  tileSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  actionBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  controlTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  controlSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    paddingRight: 12,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSubtle,
    borderRadius: 8,
    padding: 3,
    gap: 8,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    minWidth: 38,
    textAlign: 'center',
  },
  paymentTabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  paymentTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  paymentTabBtnActive: {
    backgroundColor: Colors.primary,
  },
  paymentTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  paymentTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  applyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  applyAllText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  paymentMethodsList: {
    gap: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  paymentRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  paymentMethodSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  orderTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNum: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  typeBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
  },
  orderCustomer: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  orderTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  orderStatus: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
  },
  payBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  payBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderColor,
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
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
  },
  modalSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 16,
  },
  modalEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  modalEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  modalEmptySub: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  availableTablesGrid: {
    gap: 10,
  },
  availTableCard: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  availTableTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  availTableNum: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  availBadge: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  availBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.success,
  },
  availTableMeta: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  modalFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    gap: 8,
  },
  modalActionBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  modalCloseDoneBtn: {
    backgroundColor: Colors.bgSubtle,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCloseDoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  dropdownBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E40AF',
  },
  staffFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  staffFilterPillActive: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  staffFilterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  staffFilterPillTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  collectionKpiBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgSubtle,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginTop: 2,
  },
  collectionKpiCol: {
    flex: 1,
    alignItems: 'center',
  },
  collectionKpiDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.borderColor,
  },
  collectionKpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  collectionKpiVal: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.success,
    marginTop: 1,
  },
  collectionKpiSub: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 1,
  },
  emptyStaffBox: {
    padding: 16,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: Colors.bgSubtle,
  },
  emptyStaffText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  staffCollectionCard: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 12,
  },
  staffCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  staffCardName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  staffRolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  staffRolePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  staffCardSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  staffCollectedVal: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.success,
  },
  staffCollectedBreakdown: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 1,
  },
  expandOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 5,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
  },
  expandOrderBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  itemizedOrdersBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    gap: 6,
  },
  itemizedOrderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  itemizedOrderNum: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMain,
  },
  itemizedOrderType: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  itemizedOrderCustomer: {
    fontSize: 9.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  itemizedOrderAmt: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.textMain,
  },
  itemizedOrderPay: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  filterModalCard: {
    width: '90%',
    maxWidth: 380,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    maxHeight: '80%',
  },
  modalGroupTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  modalOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.bgSubtle,
    marginBottom: 4,
  },
  modalOptionActive: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  modalOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  modalOptionTextActive: {
    color: '#1E40AF',
    fontWeight: '800',
  },
});
