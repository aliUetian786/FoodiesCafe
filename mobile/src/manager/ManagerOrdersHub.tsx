import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { HistoricalLoadingModal } from '../components/HistoricalLoadingModal';
import { Order, OrderStatus } from '../types';
import { normalizeBranchId } from '../services/api';
import { Receipt, Search, Filter, Utensils, ShoppingBag, Bike, Check, X, Clock, DollarSign, CheckCircle, Megaphone } from 'lucide-react-native';

function getDisplayStatus(status: string, orderType: string = 'delivery') {
  const s = (status || '').toLowerCase();
  const t = (orderType || '').toLowerCase();
  if (s === 'cancelled') return { label: 'CANCELLED', color: Colors.danger, bg: Colors.dangerLight };
  if (s === 'placed' || s === 'accepted' || s === 'preparing') return { label: 'PLACED', color: '#D97706', bg: '#FEF3C7' };
  if (s === 'ready' || s === 'out_for_delivery') return { label: 'READY', color: '#16A34A', bg: '#DCFCE7' };
  if (t === 'dine_in') return { label: 'SERVED', color: '#4F46E5', bg: '#EEF2FF' };
  if (t === 'takeaway') return { label: 'TAKEN', color: '#334155', bg: '#F1F5F9' };
  return { label: 'DELIVERED', color: '#059669', bg: '#ECFDF5' };
}

interface ManagerOrdersHubProps {
  isFloorStaff?: boolean;
}

export function ManagerOrdersHub({ isFloorStaff = false }: ManagerOrdersHubProps = {}) {
  const {
    orders,
    currentBranch,
    role,
    updateOrderPayment,
    updateOrderStatus,
    markOrderDeliveredToTable,
    markOrderDoneAndCollected,
    showToast,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    fetchOlderOrders,
    filterOrdersToToday,
    openNotificationModal,
    setBottomSheetOpen,
  } = useApp();
  const isFloor = Boolean(isFloorStaff || role === 'floor_staff');

  const [filterType, setFilterType] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>(
    isFloor ? 'dine_in' : 'all'
  );
  const [filterStatus, setFilterStatus] = useState<'all' | 'placed' | 'ready' | 'completed'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [timeScope, setTimeScope] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');

  const handleTimeScopeChange = (scope: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    setTimeScope(scope);
    if (scope !== 'today') {
      fetchOlderOrders(currentBranch.id, scope);
    }
  };

  const isOrderInTimeScope = (val: any, scope: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    if (scope === 'all') return true;
    if (!val) return scope === 'today';

    let orderDate: Date | null = null;
    if (typeof val === 'number') {
      orderDate = new Date(val);
    } else if (typeof val === 'string') {
      const lower = val.toLowerCase();
      if (lower.includes('today') || lower.includes('just now') || lower.includes('min ago') || lower.includes('sec ago')) {
        return scope === 'today';
      }
      if (lower.includes('yesterday')) {
        return scope === 'yesterday';
      }
      let target = val;
      if (val.includes('•')) {
        const parts = val.split('•');
        target = parts[1]?.trim() || parts[0]?.trim();
      }
      const d = new Date(target);
      if (!isNaN(d.getTime())) {
        orderDate = d;
      } else {
        const dDirect = new Date(val);
        if (!isNaN(dDirect.getTime())) {
          orderDate = dDirect;
        }
      }
    }

    if (!orderDate || isNaN(orderDate.getTime())) return scope === 'today';

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const orderDayStart = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate()).getTime();
    const diffDays = Math.round((todayStart - orderDayStart) / (1000 * 60 * 60 * 24));

    if (scope === 'today') return diffDays === 0;
    if (scope === 'yesterday') return diffDays === 1;
    if (scope === 'week') return diffDays >= 0 && diffDays <= 7;
    if (scope === 'month') return diffDays >= 0 && diffDays <= 30;
    return true;
  };
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  React.useEffect(() => {
    if (!selectedOrder) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [selectedOrder, setBottomSheetOpen]);

  const normCurrentBranchId = normalizeBranchId(currentBranch.id);
  const branchOrders = orders.filter(
    (o) => !o.branchId || o.branchId === currentBranch.id || normalizeBranchId(o.branchId) === normCurrentBranchId
  );

  const isOrderPaid = (o: Order) => {
    if (o.paymentStatus === 'paid') return true;
    if ((o as any).paymentCollected === true) return true;
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
      return o.paymentStatus !== 'unpaid' || (o as any).paymentCollected === true;
    }
    return false;
  };

  const filteredOrders = branchOrders.filter((o) => {
    if (!isOrderInTimeScope(o.createdAt, timeScope)) return false;
    if (isFloor && o.type !== 'dine_in') return false;
    if (filterType !== 'all' && o.type !== filterType) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'placed' && o.status !== 'placed' && o.status !== 'accepted' && o.status !== 'preparing') return false;
      if (filterStatus === 'ready' && o.status !== 'ready' && o.status !== 'out_for_delivery') return false;
      if (filterStatus === 'completed' && o.status !== 'completed' && o.status !== 'delivered' && o.status !== 'served' && o.status !== 'taken') return false;
    }
    if (filterPayment !== 'all') {
      const paid = isOrderPaid(o);
      if (filterPayment === 'paid' && !paid) return false;
      if (filterPayment === 'unpaid' && paid) return false;
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.titleRow}>
          <Receipt size={20} color={Colors.primary} />
          <Text style={styles.titleText}>Orders</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{filteredOrders.length} Orders</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>{currentBranch.name} • Live order statuses monitoring (View Only)</Text>
        {/* Time Scope / Date Range Filter */}
        <View style={styles.timeFilterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timePillsScroll}>
            {[
              { id: 'today', label: '📅 Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Past 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' },
            ].map((t) => {
              const isActive = timeScope === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.timePill, isActive && styles.timePillActive]}
                  onPress={() => handleTimeScopeChange(t.id as any)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timePillText, isActive && styles.timePillTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Filter Pills */}
        {!isFloor && (
          <View style={styles.filterPillsRow}>
            {[
              { id: 'all', label: 'All Types' },
              { id: 'dine_in', label: 'Dine-In' },
              { id: 'takeaway', label: 'Takeaway' },
              { id: 'delivery', label: 'Delivery' },
            ].map((f) => {
              const isActive = filterType === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.pill, isActive && styles.pillActive]}
                  onPress={() => setFilterType(f.id as any)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Status Filter Pills */}
        <View style={[styles.filterPillsRow, { marginTop: isFloor ? 0 : 8 }]}>
          {[
            { id: 'all', label: 'ALL' },
            { id: 'placed', label: 'PLACED' },
            { id: 'ready', label: 'READY' },
            { id: 'completed', label: isFloor ? 'SERVED / DONE' : 'COMPLETED' },
          ].map((f) => {
            const isActive = filterStatus === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() => setFilterStatus(f.id as any)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <HistoricalLoadingModal visible={isFetchingOlderOrders} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Receipt size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptySub}>No orders matching the active filter criteria.</Text>
          </View>
        ) : (
          filteredOrders.map((ord) => {
            const isPaid = isOrderPaid(ord);
            const isCompleted = ord.status === 'completed';
            const isCancelled = ord.status === 'cancelled';

            return (
              <TouchableOpacity
                key={ord.id}
                style={[styles.orderCard, isCancelled && styles.orderCardCancelled]}
                onPress={() => setSelectedOrder(ord)}
                activeOpacity={0.85}
              >
                {/* Header Row */}
                <View style={styles.orderCardHeader}>
                  <View style={styles.orderTypeBox}>
                    {ord.type === 'dine_in' && <Utensils size={14} color={Colors.primary} />}
                    {ord.type === 'takeaway' && <ShoppingBag size={14} color={Colors.primary} />}
                    {ord.type === 'delivery' && <Bike size={14} color={Colors.primary} />}
                    <Text style={styles.orderTypeText}>
                      {ord.type === 'dine_in' ? `Table ${ord.tableNumber || 'Seated'}` : ord.type === 'takeaway' ? 'Takeaway' : 'Delivery'}
                    </Text>
                  </View>

                  <View style={styles.badgesRow}>
                    <View style={[styles.payBadge, { backgroundColor: isPaid ? Colors.successLight : Colors.warningLight }]}>
                      <Text style={[styles.payBadgeText, { color: isPaid ? Colors.success : Colors.warning }]}>
                        {isPaid ? 'PAID' : 'UNPAID'}
                      </Text>
                    </View>
                    {(() => {
                      const st = getDisplayStatus(ord.status, ord.type);
                      return (
                        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                          <Text style={[styles.statusBadgeText, { color: st.color }]}>
                            {st.label}
                          </Text>
                        </View>
                      );
                    })()}
                  </View>
                </View>

                {/* Meta */}
                <View style={styles.orderMetaRow}>
                  <View>
                    <Text style={styles.orderNum}>Order #{ord.orderNumber}</Text>
                    <Text style={styles.customerLine}>{ord.customerName} • {ord.customerPhone}</Text>
                  </View>
                  <Text style={styles.orderPrice}>Rs. {ord.total}</Text>
                </View>

                {/* Items Summary */}
                <Text style={styles.itemsSummary} numberOfLines={2}>
                  {ord.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                </Text>

                {/* View-Only Status Footer or Floor Staff Quick Actions */}
                <View style={styles.cardViewOnlyFooter}>
                  {isFloor && ord.type === 'dine_in' && ord.status !== 'completed' && ord.status !== 'cancelled' ? (
                    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {ord.status === 'ready' && (
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            backgroundColor: '#0284C7',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 8,
                          }}
                          onPress={(e) => {
                            e.stopPropagation();
                            markOrderDeliveredToTable(ord.id);
                          }}
                        >
                          <CheckCircle size={13} color="#FFFFFF" />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>Deliver 🍽️</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          backgroundColor: Colors.success,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                        }}
                        onPress={(e) => {
                          e.stopPropagation();
                          markOrderDoneAndCollected(ord.id, true);
                        }}
                      >
                        <CheckCircle size={13} color="#FFFFFF" />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>Done & Collected ✓</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={styles.viewDetailsHint}>Tap for breakdown ➔</Text>
                      {(role === 'platform_owner' || role === 'branch_manager' || role === 'cashier') && (
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: Colors.primaryLight,
                            borderWidth: 1,
                            borderColor: Colors.primaryBorder,
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                          }}
                          onPress={(e) => {
                            e.stopPropagation();
                            openNotificationModal('send', ord);
                          }}
                        >
                          <Megaphone size={12} color={Colors.primary} />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.primary }}>Notify</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Order Details Modal */}
      {selectedOrder && (
        <Modal visible={!!selectedOrder} transparent animationType="slide" statusBarTranslucent={true} onRequestClose={() => setSelectedOrder(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Order #{selectedOrder.orderNumber}</Text>
                  <Text style={styles.modalSub}>{selectedOrder.type.toUpperCase()} • {new Date(selectedOrder.createdAt).toLocaleTimeString()}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.closeBtn}>
                  <X size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Customer:</Text>
                  <Text style={styles.detailVal}>{selectedOrder.customerName} ({selectedOrder.customerPhone})</Text>
                </View>
                {selectedOrder.deliveryAddress && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Address:</Text>
                    <Text style={styles.detailVal}>{selectedOrder.deliveryAddress}</Text>
                  </View>
                )}
                {selectedOrder.tableNumber && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Table #:</Text>
                    <Text style={styles.detailVal}>{selectedOrder.tableNumber}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Payment:</Text>
                  <Text style={styles.detailVal}>{selectedOrder.paymentMethod} ({selectedOrder.paymentStatus.toUpperCase()})</Text>
                </View>

                <Text style={styles.itemsTitle}>Items Ordered:</Text>
                {selectedOrder.items.map((it, idx) => (
                  <View key={idx} style={styles.modalItemRow}>
                    <Text style={styles.modalItemName}>{it.name} x{it.quantity}</Text>
                    <Text style={styles.modalItemPrice}>Rs. {it.unitPrice * it.quantity}</Text>
                  </View>
                ))}

                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Payable:</Text>
                  <Text style={styles.totalVal}>Rs. {selectedOrder.total}</Text>
                </View>

                {selectedOrder.paymentStatus !== 'paid' && selectedOrder.status !== 'cancelled' && (
                  <TouchableOpacity
                    style={styles.markPaidBtn}
                    onPress={() => {
                      updateOrderPayment(selectedOrder.id, 'paid');
                      setSelectedOrder((prev) => prev ? { ...prev, paymentStatus: 'paid', paymentCollected: true } : null);
                    }}
                  >
                    <CheckCircle size={16} color="#FFFFFF" />
                    <Text style={styles.markPaidBtnText}>Mark Paid & Count in Collection</Text>
                  </TouchableOpacity>
                )}

                {/* Takeaway: Hand over order to customer when ready (Cashier / Support / Manager) */}
                {selectedOrder.type === 'takeaway' && selectedOrder.status === 'ready' && (
                  <TouchableOpacity
                    style={[styles.markPaidBtn, { backgroundColor: '#16A34A', marginTop: 10 }]}
                    onPress={() => {
                      updateOrderStatus(selectedOrder.id, 'completed' as OrderStatus);
                      setSelectedOrder((prev) => (prev ? { ...prev, status: 'completed' } : null));
                      showToast(`Order #${selectedOrder.orderNumber} handed over to customer ✓`, 'success');
                    }}
                  >
                    <CheckCircle size={16} color="#FFFFFF" />
                    <Text style={styles.markPaidBtnText}>Hand Over Takeaway ✓</Text>
                  </TouchableOpacity>
                )}

                {/* Dine-In: Mark served to table when ready (Floor Waiter / Manager) */}
                {selectedOrder.type === 'dine_in' && selectedOrder.status === 'ready' && (
                  <TouchableOpacity
                    style={[styles.markPaidBtn, { backgroundColor: '#0284C7', marginTop: 10 }]}
                    onPress={() => {
                      markOrderDeliveredToTable(selectedOrder.id);
                      setSelectedOrder((prev) => (prev ? { ...prev, status: 'served' } : null));
                    }}
                  >
                    <CheckCircle size={16} color="#FFFFFF" />
                    <Text style={styles.markPaidBtnText}>Deliver Food to Table 🍽️</Text>
                  </TouchableOpacity>
                )}

                {/* Dine-In: Done & Collected (Free Table) */}
                {selectedOrder.type === 'dine_in' &&
                  selectedOrder.status !== 'completed' &&
                  selectedOrder.status !== 'cancelled' && (
                    <TouchableOpacity
                      style={[styles.markPaidBtn, { backgroundColor: '#16A34A', marginTop: 10 }]}
                      onPress={() => {
                        markOrderDoneAndCollected(selectedOrder.id, true);
                        setSelectedOrder(null);
                      }}
                    >
                      <CheckCircle size={16} color="#FFFFFF" />
                      <Text style={styles.markPaidBtnText}>Done & Collected (Free Table) ✓</Text>
                    </TouchableOpacity>
                  )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  timeFilterRow: {
    marginTop: 10,
    marginBottom: 4,
  },
  timePillsScroll: {
    gap: 6,
    paddingRight: 10,
  },
  timePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  timePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  timePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  topHeader: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleText: { fontSize: 16, fontWeight: '800', color: Colors.textMain },
  countBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  subtitle: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 10 },
  filterPillsRow: { flexDirection: 'row', gap: 6 },
  pill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  pillTextActive: { color: Colors.textWhite },
  scrollList: { padding: 16, paddingBottom: 40 },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginTop: 20,
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textMain },
  emptySub: { fontSize: 12, color: Colors.textMuted },
  orderCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
  },
  orderCardCancelled: { opacity: 0.6 },
  orderCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderTypeBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderTypeText: { fontSize: 12, fontWeight: '700', color: Colors.textMain },
  badgesRow: { flexDirection: 'row', gap: 6 },
  payBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  payBadgeText: { fontSize: 9, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 9, fontWeight: '800' },
  orderMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  orderNum: { fontSize: 13, fontWeight: '800', color: Colors.textMain },
  customerLine: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  orderPrice: { fontSize: 14, fontWeight: '900', color: Colors.primary },
  itemsSummary: { fontSize: 11, color: Colors.textMuted, marginBottom: 10 },
  cardViewOnlyFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
    paddingTop: 8,
    marginTop: 4,
    alignItems: 'flex-end',
  },
  viewDetailsHint: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.primary,
  },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.textMain },
  modalSub: { fontSize: 11, color: Colors.textMuted },
  closeBtn: { padding: 4 },
  modalBody: { paddingBottom: 20 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: 12, color: Colors.textMuted },
  detailVal: { fontSize: 12, fontWeight: '700', color: Colors.textMain },
  itemsTitle: { fontSize: 13, fontWeight: '800', color: Colors.textMain, marginTop: 14, marginBottom: 8 },
  modalItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  modalItemName: { fontSize: 12, color: Colors.textMain },
  modalItemPrice: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  divider: { height: 1, backgroundColor: Colors.borderColor, marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, fontWeight: '800', color: Colors.textMain },
  totalVal: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  markPaidBtn: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  markPaidBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});

