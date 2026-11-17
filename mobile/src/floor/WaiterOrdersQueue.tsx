import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { StaffNameBanner } from '../components/StaffNameBanner';
import { HistoricalLoadingModal } from '../components/HistoricalLoadingModal';
import { Order } from '../types';
import {
  Utensils,
  CheckCircle,
  Clock,
  ChefHat,
  Banknote,
  CreditCard,
  DollarSign,
  Calendar,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  ShoppingBag,
  X,
  Plus,
  LayoutGrid,
} from 'lucide-react-native';

interface WaiterOrdersQueueProps {
  onOpenWalkIn?: () => void;
  onNavigateToTables?: () => void;
}

const formatDateYYYYMMDD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDisplayDate = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function WaiterOrdersQueue({ onOpenWalkIn, onNavigateToTables }: WaiterOrdersQueueProps = {}) {
  const {
    orders,
    currentUser,
    currentBranch,
    markOrderDeliveredToTable,
    markOrderDoneAndCollected,
    showToast,
    fetchOlderOrders,
    isFetchingOlderOrders,
    filterOrdersToToday,
    setBottomSheetOpen,
  } = useApp();
  const { width: screenWidth } = useWindowDimensions();

  // Screen responsiveness for 1-line date selector
  const isUltraSmall = screenWidth < 360;
  const isSmall = screenWidth < 410;

  // Date constants
  const todayStr = useMemo(() => formatDateYYYYMMDD(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    return formatDateYYYYMMDD(yest);
  }, []);

  const [dateScope, setDateScope] = useState<'today' | 'yesterday' | 'week' | 'date' | 'all'>('today');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false);

  useEffect(() => {
    if (!isDatePickerModalOpen) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [isDatePickerModalOpen, setBottomSheetOpen]);

  // On-demand historical data fetching when user selects older days
  useEffect(() => {
    if (dateScope === 'today') {
      filterOrdersToToday();
    } else if (dateScope === 'yesterday') {
      fetchOlderOrders(currentBranch?.id, 'yesterday', yesterdayStr, yesterdayStr);
    } else if (dateScope === 'week') {
      fetchOlderOrders(currentBranch?.id, 'week');
    } else if (dateScope === 'all') {
      fetchOlderOrders(currentBranch?.id, 'all');
    } else if (dateScope === 'date') {
      fetchOlderOrders(currentBranch?.id, 'date', selectedDate, selectedDate);
    }
  }, [dateScope, selectedDate, currentBranch?.id]);

  // Station info
  const assignedTableNums = useMemo(() => currentUser?.assignedTableNumbers || [], [currentUser?.assignedTableNumbers]);
  const hasAssignedStation = assignedTableNums.length > 0;
  const [queueScope, setQueueScope] = useState<'station' | 'all'>(hasAssignedStation ? 'station' : 'all');

  // Quick 7-day selector array
  const recentDays = useMemo(() => {
    const days: { dateStr: string; label: string; weekday: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = formatDateYYYYMMDD(d);
      let label = `${d.getDate()} ${d.toLocaleDateString('en-US', { month: 'short' })}`;
      if (i === 0) label = 'Today';
      else if (i === 1) label = 'Yesterday';
      days.push({
        dateStr: str,
        label,
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }
    return days;
  }, []);

  const getOrderDateStr = (o: Order): string => {
    const ts = o.completedAt || o.deliveredAt || o.createdAt;
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return formatDateYYYYMMDD(d);
  };

  // 1. All served / completed / settled dine-in orders
  const servedDineInOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.type === 'dine_in' &&
        (o.status === 'served' || o.status === 'completed' || o.status === 'taken' || o.paymentStatus === 'paid' || o.paymentCollected)
    );
  }, [orders]);

  // 2. Filter served dine-in orders by chosen date scope
  const filteredServedOrders = useMemo(() => {
    const now = new Date();
    const weekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    return servedDineInOrders.filter((o) => {
      const orderDateStr = getOrderDateStr(o);
      const orderTimeMs = new Date(o.completedAt || o.deliveredAt || o.createdAt).getTime();

      if (dateScope === 'today') {
        return orderDateStr === todayStr;
      }
      if (dateScope === 'yesterday') {
        return orderDateStr === yesterdayStr;
      }
      if (dateScope === 'date') {
        return orderDateStr === selectedDate;
      }
      if (dateScope === 'week') {
        return orderTimeMs >= weekAgoMs;
      }
      if (dateScope === 'all') {
        return true;
      }
      return true;
    });
  }, [servedDineInOrders, dateScope, selectedDate, todayStr, yesterdayStr]);

  // 3. Waiter Money Record Calculations
  const totalOrdersCount = filteredServedOrders.length;

  const totalCashCollected = useMemo(() => {
    return filteredServedOrders
      .filter((o) => o.paymentMethod.includes('Cash') || o.paymentMethod.includes('COD'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredServedOrders]);

  const totalOnlinePaid = useMemo(() => {
    return filteredServedOrders
      .filter((o) => !o.paymentMethod.includes('Cash') && !o.paymentMethod.includes('COD'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredServedOrders]);

  const totalSettledValue = useMemo(() => {
    return filteredServedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredServedOrders]);

  // Handlers for Day navigation
  const handleStepDay = (delta: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() + delta);

    const today = new Date();
    if (curr > today) {
      showToast('Cannot select future dates', 'warning');
      return;
    }

    const nextStr = formatDateYYYYMMDD(curr);
    setSelectedDate(nextStr);
    setDateScope('date');
  };

  const handleSelectRecentDay = (str: string) => {
    setSelectedDate(str);
    if (str === todayStr) {
      setDateScope('today');
    } else if (str === yesterdayStr) {
      setDateScope('yesterday');
    } else {
      setDateScope('date');
    }
  };

  // Scope label for banner
  const activeScopeLabel = useMemo(() => {
    if (dateScope === 'today') return `Today (${formatDisplayDate(todayStr)})`;
    if (dateScope === 'yesterday') return `Yesterday (${formatDisplayDate(yesterdayStr)})`;
    if (dateScope === 'date') return `${formatDisplayDate(selectedDate)}`;
    if (dateScope === 'week') return 'Past 7 Days';
    return 'All Time History';
  }, [dateScope, selectedDate, todayStr, yesterdayStr]);

  const [stageFilter, setStageFilter] = useState<'all' | 'ready' | 'cooking' | 'served'>('all');

  // 4. Incoming active orders queue (ready, preparing, accepted, placed, served) - strictly unsettled
  const allActiveDineIn = useMemo(() => {
    return orders.filter(
      (o) =>
        o.type === 'dine_in' &&
        o.status !== 'completed' &&
        o.status !== 'cancelled' &&
        o.paymentStatus !== 'paid' &&
        !o.paymentCollected &&
        (o.status === 'ready' || o.status === 'accepted' || o.status === 'preparing' || o.status === 'placed' || o.status === 'served')
    );
  }, [orders]);

  // Filter orders matching assigned station
  const stationActiveOrders = useMemo(() => {
    if (!hasAssignedStation) return allActiveDineIn;
    return allActiveDineIn.filter(
      (o) =>
        (o.tableNumber && assignedTableNums.includes(o.tableNumber)) ||
        o.assignedWaiterId === currentUser?.id
    );
  }, [allActiveDineIn, hasAssignedStation, assignedTableNums, currentUser?.id]);

  const baseOrders = queueScope === 'station' ? stationActiveOrders : allActiveDineIn;

  const readyCount = useMemo(() => baseOrders.filter((o) => o.status === 'ready').length, [baseOrders]);
  const cookingCount = useMemo(() => baseOrders.filter((o) => o.status === 'preparing' || o.status === 'accepted' || o.status === 'placed').length, [baseOrders]);
  const servedCount = useMemo(() => baseOrders.filter((o) => o.status === 'served').length, [baseOrders]);

  const displayedOrders = useMemo(() => {
    return baseOrders.filter((o) => {
      if (stageFilter === 'ready') return o.status === 'ready';
      if (stageFilter === 'cooking') return o.status === 'preparing' || o.status === 'accepted' || o.status === 'placed';
      if (stageFilter === 'served') return o.status === 'served';
      return true;
    });
  }, [baseOrders, stageFilter]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StaffNameBanner />
      {/* Workstation Header */}
      <View style={styles.topHeaderActionRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Waiter Service Workstation</Text>
          <Text style={styles.pageSub}>
            Floor orders & table service • Real-time money records & settlements
          </Text>
        </View>
        <View style={styles.headerBtnsRow}>
          {onOpenWalkIn && (
            <TouchableOpacity style={styles.headerWalkInBtn} onPress={onOpenWalkIn} activeOpacity={0.8}>
              <Plus size={14} color="#FFFFFF" />
              <Text style={styles.headerWalkInBtnText}>+ Walk-in Order</Text>
            </TouchableOpacity>
          )}
          {onNavigateToTables && (
            <TouchableOpacity style={styles.headerTablesBtn} onPress={onNavigateToTables} activeOpacity={0.8}>
              <LayoutGrid size={14} color={Colors.primary} />
              <Text style={styles.headerTablesBtnText}>Floor Tables Grid →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ========================================================================= */}
      {/* WAITER MONEY RECORDS: ORDERS DELIVERED, CASH IN HAND, ONLINE, TOTAL SETTLED */}
      {/* ========================================================================= */}
      <View style={styles.moneyRecordsSection}>
        {/* Date Scope Main Filter Tabs: Strictly 1 Line Responsive */}
        <View style={[styles.scopeRow, { gap: isUltraSmall ? 3 : isSmall ? 4 : 6 }]}>
          {([
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: isUltraSmall ? '7 Days' : isSmall ? 'Past 7D' : 'Past 7 Days' },
            { id: 'date', label: isUltraSmall ? 'Pick Date' : 'Pick Date 📅' },
            { id: 'all', label: 'All Time' },
          ] as const).map((sc) => {
            const isActive = dateScope === sc.id;
            return (
              <TouchableOpacity
                key={sc.id}
                style={[
                  styles.scopePill,
                  {
                    paddingVertical: isUltraSmall ? 5 : 7,
                    paddingHorizontal: isUltraSmall ? 1 : isSmall ? 2 : 4,
                  },
                  isActive && styles.scopePillActive,
                ]}
                onPress={() => {
                  if (sc.id === 'date') {
                    setIsDatePickerModalOpen(true);
                  } else {
                    setDateScope(sc.id);
                    if (sc.id === 'today') setSelectedDate(todayStr);
                    if (sc.id === 'yesterday') setSelectedDate(yesterdayStr);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.scopePillText,
                    { fontSize: isUltraSmall ? 9 : isSmall ? 9.8 : 11 },
                    isActive && styles.scopePillTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.7}
                >
                  {sc.id === 'date' && dateScope === 'date'
                    ? (isUltraSmall ? 'Date' : `${formatDisplayDate(selectedDate).split(',')[0]}`)
                    : sc.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Record Period Summary Banner */}
        <View style={styles.activeBanner}>
          <View style={styles.activeBannerRow}>
            <Text style={styles.activeBannerLabel}>RECORD PERIOD:</Text>
            <Text style={styles.activeBannerVal}>{activeScopeLabel}</Text>
          </View>
        </View>

        <HistoricalLoadingModal visible={isFetchingOlderOrders} />

        {/* 4 Metric KPI Cards for Waiter Money Records */}
        <View style={styles.metricsGrid}>
          {/* Card 1: Orders Delivered / Served */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.infoLight }]}>
              <CheckCircle size={15} color={Colors.info} />
            </View>
            <Text style={styles.metricValue}>{totalOrdersCount}</Text>
            <Text style={styles.metricLabel}>Orders Served</Text>
          </View>

          {/* Card 2: Cash Received (Table Cash / COD) */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.warningLight }]}>
              <Banknote size={15} color={Colors.warning} />
            </View>
            <Text style={[styles.metricValue, { color: Colors.warning }]}>
              Rs. {totalCashCollected.toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Cash in Hand (Table Cash)</Text>
          </View>

          {/* Card 3: Online Paid */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.successLight }]}>
              <CreditCard size={15} color={Colors.success} />
            </View>
            <Text style={[styles.metricValue, { color: Colors.success }]}>
              Rs. {totalOnlinePaid.toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Prepaid / Online</Text>
          </View>

          {/* Card 4: Total Settled Payments */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.primaryLight }]}>
              <DollarSign size={15} color={Colors.primary} />
            </View>
            <Text style={[styles.metricValue, { color: Colors.primary }]}>
              Rs. {totalSettledValue.toLocaleString()}
            </Text>
            <Text style={styles.metricLabel}>Total Settled Value</Text>
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* INCOMING ACTIVE DINE-IN ORDERS QUEUE (FILTERED BY ASSIGNED STATION) */}
      {/* ========================================================================= */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Incoming Food Trays to Deliver</Text>
        <View style={styles.activeCountPill}>
          <Text style={styles.activeCountText}>{displayedOrders.length} Pending</Text>
        </View>
      </View>

      {/* Station Queue Scope Selector */}
      <View style={styles.stationFilterRow}>
        <TouchableOpacity
          style={[styles.stationPill, queueScope === 'station' && styles.stationPillActive]}
          onPress={() => setQueueScope('station')}
          activeOpacity={0.8}
        >
          <UserCheck
            size={12}
            color={queueScope === 'station' ? Colors.textWhite : Colors.textMuted}
          />
          <Text
            style={[styles.stationPillText, queueScope === 'station' && styles.stationPillTextActive]}
          >
            My Station Orders ({stationActiveOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.stationPill, queueScope === 'all' && styles.stationPillActive]}
          onPress={() => setQueueScope('all')}
          activeOpacity={0.8}
        >
          <ShoppingBag
            size={12}
            color={queueScope === 'all' ? Colors.textWhite : Colors.textMuted}
          />
          <Text
            style={[styles.stationPillText, queueScope === 'all' && styles.stationPillTextActive]}
          >
            All Dine-In Orders ({allActiveDineIn.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stage Filter Row */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stageFilterRow}>
          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'all' && styles.stagePillActive]}
            onPress={() => setStageFilter('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.stagePillText, stageFilter === 'all' && styles.stagePillTextActive]}>
              All Active ({baseOrders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'ready' && styles.stagePillActiveReady]}
            onPress={() => setStageFilter('ready')}
            activeOpacity={0.8}
          >
            <Text style={[styles.stagePillText, stageFilter === 'ready' && styles.stagePillTextActiveReady]}>
              🔥 Hot Food Ready ({readyCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'cooking' && styles.stagePillActiveCooking]}
            onPress={() => setStageFilter('cooking')}
            activeOpacity={0.8}
          >
            <Text style={[styles.stagePillText, stageFilter === 'cooking' && styles.stagePillTextActiveCooking]}>
              🍳 Cooking ({cookingCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stagePill, stageFilter === 'served' && styles.stagePillActiveServed]}
            onPress={() => setStageFilter('served')}
            activeOpacity={0.8}
          >
            <Text style={[styles.stagePillText, stageFilter === 'served' && styles.stagePillTextActiveServed]}>
              🍽️ Seated & Dining ({servedCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {displayedOrders.length === 0 ? (
        <View style={styles.emptyCard}>
          <ChefHat size={40} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>No Orders Pending Delivery</Text>
          <Text style={styles.emptySub}>
            {queueScope === 'station' && hasAssignedStation
              ? `No active cooking or ready orders for your assigned station (${assignedTableNums.join(', ')}). Switch to "All Dine-In Orders" to inspect cafe-wide orders.`
              : 'Hot food ready from kitchen line will appear here for serving to seated guests.'}
          </Text>
        </View>
      ) : (
        <View style={styles.ordersList}>
          {displayedOrders.map((ord) => {
            const isKitchenReady = ord.status === 'ready';
            const isFoodServed = ord.status === 'served';
            const isAssignedToMe =
              (ord.tableNumber && assignedTableNums.includes(ord.tableNumber)) ||
              ord.assignedWaiterId === currentUser?.id;

            return (
              <View
                key={ord.id}
                style={[
                  styles.orderCard,
                  isKitchenReady && styles.orderCardReady,
                  isFoodServed && styles.orderCardServed,
                  isAssignedToMe && styles.orderCardAssigned,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={styles.tableBadge}>
                      <Utensils size={14} color={Colors.textWhite} />
                      <Text style={styles.tableBadgeText}>Table {ord.tableNumber || 'Seated'}</Text>
                    </View>
                    {isAssignedToMe && (
                      <View style={styles.stationAssignedPill}>
                        <Text style={styles.stationAssignedText}>★ Your Station</Text>
                      </View>
                    )}
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isKitchenReady
                          ? Colors.successLight
                          : isFoodServed
                          ? '#EDE9FE'
                          : Colors.warningLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: isKitchenReady
                            ? Colors.success
                            : isFoodServed
                            ? '#7C3AED'
                            : Colors.warning,
                        },
                      ]}
                    >
                      {isKitchenReady
                        ? 'HOT FOOD READY'
                        : isFoodServed
                        ? 'SEATED & DINING'
                        : 'COOKING IN KITCHEN'}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderMeta}>
                  <Text style={styles.orderNum}>Order #{ord.orderNumber}</Text>
                  <Text style={styles.guestName}>
                    Guest: {ord.customerName} • {ord.paymentMethod} •{' '}
                    <Text style={{ fontWeight: '800', color: ord.paymentStatus === 'paid' ? Colors.success : Colors.warning }}>
                      {ord.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                    </Text>
                  </Text>
                </View>

                {/* Items */}
                <View style={styles.itemsBox}>
                  {ord.items.map((it, idx) => (
                    <Text key={idx} style={styles.itemLine}>
                      • {it.quantity}x {it.name} {it.size ? `(${it.size})` : ''}
                    </Text>
                  ))}
                  {ord.notes && <Text style={styles.notesText}>Note: {ord.notes}</Text>}
                </View>

                {/* Bill total & Action */}
                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.totalPrice}>Rs. {ord.total}</Text>
                    <Text style={{ fontSize: 9.5, color: Colors.textMuted, fontWeight: '700' }}>
                      {ord.paymentMethod}
                    </Text>
                  </View>

                  {isKitchenReady ? (
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.deliverBtn}
                        onPress={() => {
                          markOrderDeliveredToTable(ord.id);
                        }}
                        activeOpacity={0.8}
                      >
                        <CheckCircle size={14} color={Colors.textWhite} />
                        <Text style={styles.deliverBtnText}>Deliver 🍽️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.doneCollectBtn}
                        onPress={() => {
                          markOrderDoneAndCollected(ord.id, true);
                        }}
                        activeOpacity={0.8}
                      >
                        <CheckCircle size={14} color={Colors.textWhite} />
                        <Text style={styles.doneCollectBtnText}>Payment Received ✓</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isFoodServed ? (
                    <TouchableOpacity
                      style={styles.doneCollectBtn}
                      onPress={() => {
                        markOrderDoneAndCollected(ord.id, true);
                      }}
                      activeOpacity={0.8}
                    >
                      <CheckCircle size={14} color={Colors.textWhite} />
                      <Text style={styles.doneCollectBtnText}>Payment Received (Free Table) ✓</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.cardActionsRow}>
                      <View style={styles.waitingBadge}>
                        <Clock size={12} color={Colors.warning} />
                        <Text style={styles.waitingText}>Cooking</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.doneCollectBtn}
                        onPress={() => {
                          markOrderDoneAndCollected(ord.id, true);
                        }}
                        activeOpacity={0.8}
                      >
                        <CheckCircle size={14} color={Colors.textWhite} />
                        <Text style={styles.doneCollectBtnText}>Done & Collected ✓</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Date Picker Modal */}
      <Modal
        visible={isDatePickerModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setIsDatePickerModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerModalContent}>
            {/* Modal Header */}
            <View style={styles.datePickerModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Calendar size={18} color={Colors.primary} />
                <Text style={styles.datePickerModalTitle}>Pick Record Date</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsDatePickerModalOpen(false)}
                style={styles.datePickerModalClose}
                activeOpacity={0.7}
              >
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Day Step Navigator */}
            <View style={styles.dayNavRow}>
              <TouchableOpacity
                style={styles.dayNavBtn}
                onPress={() => handleStepDay(-1)}
                activeOpacity={0.7}
              >
                <ChevronLeft size={16} color={Colors.textMain} />
                <Text style={styles.dayNavBtnText}>Prev Day</Text>
              </TouchableOpacity>

              <View style={styles.dayNavCenter}>
                <Text style={styles.dayNavCenterText}>{formatDisplayDate(selectedDate)}</Text>
              </View>

              <TouchableOpacity
                style={[styles.dayNavBtn, selectedDate === todayStr && styles.dayNavBtnDisabled]}
                onPress={() => handleStepDay(1)}
                disabled={selectedDate === todayStr}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayNavBtnText,
                    selectedDate === todayStr && styles.dayNavBtnTextDisabled,
                  ]}
                >
                  Next Day
                </Text>
                <ChevronRight
                  size={16}
                  color={selectedDate === todayStr ? Colors.textMuted : Colors.textMain}
                />
              </TouchableOpacity>
            </View>

            {/* Quick Days Strip */}
            <Text style={styles.datePickerQuickLabel}>Recent Days Quick Pick:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickDaysScroll}
            >
              {recentDays.map((d) => {
                const isSelected = selectedDate === d.dateStr;
                return (
                  <TouchableOpacity
                    key={d.dateStr}
                    style={[styles.quickDayPill, isSelected && styles.quickDayPillSelected]}
                    onPress={() => handleSelectRecentDay(d.dateStr)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.quickDayWeekday,
                        isSelected && styles.quickDayWeekdaySelected,
                      ]}
                    >
                      {d.weekday}
                    </Text>
                    <Text
                      style={[styles.quickDayLabel, isSelected && styles.quickDayLabelSelected]}
                    >
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Apply Button */}
            <TouchableOpacity
              style={styles.datePickerApplyBtn}
              onPress={() => {
                setDateScope('date');
                setIsDatePickerModalOpen(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.datePickerApplyBtnText}>Apply & View Records ({formatDisplayDate(selectedDate)})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  topHeaderActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  headerBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerWalkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  headerWalkInBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerTablesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  headerTablesBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  stageFilterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  stagePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stagePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stagePillActiveReady: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  stagePillActiveCooking: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  stagePillActiveServed: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  stagePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  stagePillTextActive: {
    color: Colors.textWhite,
  },
  stagePillTextActiveReady: {
    color: '#15803D',
    fontWeight: '800',
  },
  stagePillTextActiveCooking: {
    color: '#B45309',
    fontWeight: '800',
  },
  stagePillTextActiveServed: {
    color: '#6D28D9',
    fontWeight: '800',
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
    marginBottom: 14,
  },
  moneyRecordsSection: {
    marginBottom: 18,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  scopePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  scopePillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  scopePillTextActive: {
    color: Colors.textWhite,
  },
  dayNavigatorCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: 8,
    gap: 8,
  },
  dayNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  dayNavBtnDisabled: {
    opacity: 0.4,
  },
  dayNavBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
  },
  dayNavBtnTextDisabled: {
    color: Colors.textMuted,
  },
  dayNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayNavCenterText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
  quickDaysScroll: {
    gap: 6,
    paddingVertical: 2,
  },
  quickDayPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
    minWidth: 54,
  },
  quickDayPillSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  quickDayWeekday: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  quickDayWeekdaySelected: {
    color: Colors.primary,
  },
  quickDayLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 1,
  },
  quickDayLabelSelected: {
    color: Colors.primary,
  },
  activeBanner: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  activeBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeBannerLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  activeBannerVal: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.3%',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textMain,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  activeCountPill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  activeCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  stationFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  stationPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    gap: 6,
  },
  stationPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stationPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  stationPillTextActive: {
    color: Colors.textWhite,
  },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginVertical: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
  ordersList: {
    gap: 12,
  },
  orderCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
  },
  orderCardReady: {
    borderColor: Colors.successBorder,
    backgroundColor: '#FAFAF9',
  },
  orderCardServed: {
    borderColor: '#DDD6FE',
    backgroundColor: '#FAF5FF',
  },
  orderCardAssigned: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  tableBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  stationAssignedPill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  stationAssignedText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  orderMeta: {
    marginBottom: 6,
  },
  orderNum: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textMain,
  },
  guestName: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  itemsBox: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    gap: 3,
  },
  itemLine: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMain,
  },
  notesText: {
    fontSize: 10,
    color: Colors.warning,
    fontStyle: 'italic',
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  totalPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.primary,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  deliverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  deliverBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  doneCollectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  doneCollectBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  waitingText: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  datePickerModalContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 18,
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  datePickerModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  datePickerModalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerQuickLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 14,
    marginBottom: 8,
  },
  datePickerApplyBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  datePickerApplyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },
});
