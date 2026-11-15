import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { HistoricalLoadingModal } from '../components/HistoricalLoadingModal';
import { Order } from '../types';
import {
  CheckCircle,
  DollarSign,
  Calendar,
  MapPin,
  Package,
  CreditCard,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Phone,
  Clock,
  X,
} from 'lucide-react-native';

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

const formatTimeOnly = (iso?: string): string => {
  if (!iso) return 'Recent';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Recent';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export function RiderHistory() {
  const {
    orders,
    currentBranch,
    showToast,
    fetchOlderOrders,
    isFetchingOlderOrders,
    filterOrdersToToday,
    currentUser,
    setBottomSheetOpen,
  } = useApp();
  const { width: screenWidth } = useWindowDimensions();

  // Screen responsiveness for 1-line date selector
  const isUltraSmall = screenWidth < 360;
  const isSmall = screenWidth < 410;

  const todayStr = useMemo(() => formatDateYYYYMMDD(new Date()), []);
  const yesterdayStr = useMemo(() => {
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    return formatDateYYYYMMDD(yest);
  }, []);

  const [dateScope, setDateScope] = useState<'today' | 'yesterday' | 'date' | 'week' | 'all'>('today');
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

  // Helper to extract an order's date in YYYY-MM-DD
  const getOrderDateStr = (o: Order): string => {
    const ts = o.deliveredAt || o.completedAt || o.createdAt;
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return formatDateYYYYMMDD(d);
  };

  // 1. All completed or delivered orders assigned strictly to this rider
  const completedDeliveries = useMemo(() => {
    return orders.filter(
      (o) =>
        o.type === 'delivery' &&
        (o.status === 'completed' || o.status === 'delivered' || o.riderStatus === 'delivered') &&
        (!o.assignedRiderId || o.assignedRiderId === currentUser?.id)
    );
  }, [orders, currentUser?.id]);

  // 2. Filter completed orders strictly by the chosen day/date/range
  const filteredDeliveries = useMemo(() => {
    const now = new Date();
    const weekAgoMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    return completedDeliveries.filter((o) => {
      const orderDateStr = getOrderDateStr(o);
      const orderTimeMs = new Date(o.deliveredAt || o.completedAt || o.createdAt).getTime();

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
  }, [completedDeliveries, dateScope, selectedDate, todayStr, yesterdayStr]);

  // 3. Dynamic KPI calculations for the selected day/date
  const totalOrdersCount = filteredDeliveries.length;

  const totalValueDelivered = useMemo(() => {
    return filteredDeliveries.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredDeliveries]);

  const totalCashCollected = useMemo(() => {
    return filteredDeliveries
      .filter((o) => o.paymentMethod.includes('COD') || o.paymentMethod.includes('Cash'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredDeliveries]);

  const totalOnlinePaid = useMemo(() => {
    return filteredDeliveries
      .filter((o) => !o.paymentMethod.includes('COD') && !o.paymentMethod.includes('Cash'))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [filteredDeliveries]);

  // Handlers for Day navigation
  const handleStepDay = (delta: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() + delta);

    // Prevent stepping into the future
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

  const handleCallCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      showToast(`Calling customer: ${phone}`, 'info');
    });
  };

  // Scope label text for header
  const activeScopeLabel = useMemo(() => {
    if (dateScope === 'today') return `Today (${formatDisplayDate(todayStr)})`;
    if (dateScope === 'yesterday') return `Yesterday (${formatDisplayDate(yesterdayStr)})`;
    if (dateScope === 'date') return `${formatDisplayDate(selectedDate)}`;
    if (dateScope === 'week') return 'Past 7 Days';
    return 'All Time History';
  }, [dateScope, selectedDate, todayStr, yesterdayStr]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Delivery History & Settlements</Text>
      <Text style={styles.pageSub}>
        Filter by day or date to inspect completed deliveries and cash payments collected.
      </Text>

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

      {/* Active Scope Summary Banner */}
      <View style={styles.activeBanner}>
        <View style={styles.activeBannerRow}>
          <Text style={styles.activeBannerLabel}>RECORD PERIOD:</Text>
          <Text style={styles.activeBannerVal}>{activeScopeLabel}</Text>
        </View>
      </View>

      <HistoricalLoadingModal visible={isFetchingOlderOrders} />

      {/* 4 Metric Cards Calculated for Selected Day/Date */}
      <View style={styles.metricsGrid}>
        {/* Card 1: Deliveries Done */}
        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: Colors.infoLight }]}>
            <CheckCircle size={15} color={Colors.info} />
          </View>
          <Text style={styles.metricValue}>{totalOrdersCount}</Text>
          <Text style={styles.metricLabel}>Orders Delivered</Text>
        </View>

        {/* Card 2: Cash Received (COD) */}
        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: Colors.warningLight }]}>
            <Banknote size={15} color={Colors.warning} />
          </View>
          <Text style={[styles.metricValue, { color: Colors.warning }]}>
            Rs. {totalCashCollected.toLocaleString()}
          </Text>
          <Text style={styles.metricLabel}>Cash in Hand (COD)</Text>
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

        {/* Card 4: Total Value */}
        <View style={styles.metricCard}>
          <View style={[styles.metricIconWrap, { backgroundColor: Colors.primaryLight }]}>
            <DollarSign size={15} color={Colors.primary} />
          </View>
          <Text style={[styles.metricValue, { color: Colors.primary }]}>
            Rs. {totalValueDelivered.toLocaleString()}
          </Text>
          <Text style={styles.metricLabel}>Total Payments</Text>
        </View>
      </View>

      {/* Deliveries List Header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          Completed Delivery Logs ({filteredDeliveries.length})
        </Text>
      </View>

      {filteredDeliveries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Package size={42} color={Colors.textLight} />
          <Text style={styles.emptyTitle}>No Deliveries on this Day</Text>
          <Text style={styles.emptySub}>
            No completed doorstep deliveries were recorded for {activeScopeLabel}. Switch to another day or select &quot;Today&quot; to review current shift logs.
          </Text>
          <TouchableOpacity
            style={styles.resetTodayBtn}
            onPress={() => {
              setDateScope('today');
              setSelectedDate(todayStr);
            }}
            activeOpacity={0.8}
          >
            <Calendar size={13} color={Colors.textWhite} />
            <Text style={styles.resetTodayBtnText}>View Today&apos;s Deliveries</Text>
          </TouchableOpacity>
        </View>
      ) : (
        filteredDeliveries.map((ord) => {
          const isCOD = ord.paymentMethod.includes('COD') || ord.paymentMethod.includes('Cash');
          const timeText = formatTimeOnly(ord.deliveredAt || ord.completedAt || ord.createdAt);

          return (
            <View key={ord.id} style={styles.historyCard}>
              {/* Card Header: Order Number, Delivered Time & Total */}
              <View style={styles.cardTop}>
                <View style={styles.orderNumberWrap}>
                  <Text style={styles.orderNum}>Order #{ord.orderNumber}</Text>
                  <View style={styles.timeBadge}>
                    <Clock size={11} color={Colors.textMuted} />
                    <Text style={styles.timeText}>{timeText}</Text>
                  </View>
                </View>
                <Text style={styles.totalText}>Rs. {Number(ord.total).toLocaleString()}</Text>
              </View>

              {/* Customer Name & Phone Link */}
              <View style={styles.customerRow}>
                <Text style={styles.customerName}>{ord.customerName}</Text>
                {ord.customerPhone ? (
                  <TouchableOpacity
                    style={styles.phonePill}
                    onPress={() => handleCallCustomer(ord.customerPhone)}
                  >
                    <Phone size={11} color={Colors.info} />
                    <Text style={styles.phoneText}>{ord.customerPhone}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Delivery Address */}
              <View style={styles.addressRow}>
                <MapPin size={12} color={Colors.primary} style={{ marginTop: 2 }} />
                <Text style={styles.addressText}>
                  {ord.deliveryAddress || 'Gulberg III, Lahore'}
                </Text>
              </View>

              {/* Ordered Dishes Summary */}
              {ord.items && ord.items.length > 0 && (
                <View style={styles.dishesBox}>
                  <Text style={styles.dishesText} numberOfLines={2}>
                    {ord.items.map((it) => `${it.quantity}x ${it.name}`).join(' • ')}
                  </Text>
                </View>
              )}

              {/* Bottom Payment Breakdown & Status Badge */}
              <View style={styles.cardBottomRow}>
                <View
                  style={[
                    styles.paymentBadge,
                    isCOD ? styles.paymentBadgeCOD : styles.paymentBadgeOnline,
                  ]}
                >
                  {isCOD ? (
                    <Banknote size={12} color={Colors.warning} />
                  ) : (
                    <CreditCard size={12} color={Colors.success} />
                  )}
                  <Text
                    style={[
                      styles.paymentBadgeText,
                      isCOD ? styles.paymentTextCOD : styles.paymentTextOnline,
                    ]}
                  >
                    {isCOD
                      ? `COD Cash Collected: Rs. ${Number(ord.total).toLocaleString()}`
                      : `Paid Online: Rs. ${Number(ord.total).toLocaleString()}`}
                  </Text>
                </View>

                <View style={styles.deliveredPill}>
                  <CheckCircle size={11} color={Colors.success} />
                  <Text style={styles.deliveredPillText}>DELIVERED</Text>
                </View>
              </View>
            </View>
          );
        })
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
                <Text style={styles.datePickerModalTitle}>Pick Delivery Date</Text>
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
                <Text style={styles.dayNavDateText}>
                  {formatDisplayDate(selectedDate)}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.dayNavBtn,
                  selectedDate >= todayStr && styles.dayNavBtnDisabled,
                ]}
                onPress={() => handleStepDay(1)}
                disabled={selectedDate >= todayStr}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayNavBtnText,
                    selectedDate >= todayStr && styles.dayNavBtnTextDisabled,
                  ]}
                >
                  Next Day
                </Text>
                <ChevronRight
                  size={16}
                  color={selectedDate >= todayStr ? Colors.textLight : Colors.textMain}
                />
              </TouchableOpacity>
            </View>

            {/* Quick 7-Day Tap Strip */}
            <Text style={styles.datePickerQuickLabel}>Recent Days Quick Pick:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickDaysStrip}
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
                      style={[styles.quickDayWeekday, isSelected && styles.quickDayWeekdaySelected]}
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
              <Text style={styles.datePickerApplyBtnText}>Apply & View Deliveries ({formatDisplayDate(selectedDate)})</Text>
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
    lineHeight: 16,
  },
  scopeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 12,
    width: '100%',
  },
  scopePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
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
    textAlign: 'center',
  },
  scopePillTextActive: {
    color: Colors.textWhite,
  },
  dayNavigatorCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: 12,
  },
  dayNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
    color: Colors.textLight,
  },
  dayNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayNavDateText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.textMain,
  },
  quickDaysStrip: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2,
  },
  quickDayPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
    minWidth: 64,
  },
  quickDayPillSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  quickDayWeekday: {
    fontSize: 9.5,
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
    marginTop: 2,
  },
  quickDayLabelSelected: {
    color: Colors.primary,
  },
  activeBanner: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: 14,
  },
  activeBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  activeBannerVal: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textMain,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.textMain,
  },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 15,
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
  resetTodayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 16,
  },
  resetTodayBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  historyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: 10,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderNumberWrap: {
    gap: 3,
  },
  orderNum: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 10.5,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  totalText: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.primary,
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  customerName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  phoneText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.info,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 15,
  },
  dishesBox: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  dishesText: {
    fontSize: 11,
    color: Colors.textMain,
    fontWeight: '600',
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    paddingTop: 8,
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paymentBadgeCOD: {
    backgroundColor: Colors.warningLight,
  },
  paymentBadgeOnline: {
    backgroundColor: Colors.successLight,
  },
  paymentBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  paymentTextCOD: {
    color: Colors.warning,
  },
  paymentTextOnline: {
    color: Colors.success,
  },
  deliveredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deliveredPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.success,
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
