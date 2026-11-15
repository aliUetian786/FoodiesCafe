import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { HistoricalLoadingModal } from '../components/HistoricalLoadingModal';
import { normalizeBranchId } from '../services/api';
import {
  Banknote,
  Receipt,
  CreditCard,
  Smartphone,
  Building,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
  Users,
  Utensils,
  ShoppingBag,
  Bike,
  RotateCcw,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';

export function ManagerFinancials() {
  const {
    currentBranch,
    orders,
    refunds,
    shifts,
    users,
    updateShiftOpeningBalance,
    approveRefund,
    rejectRefund,
    isFetchingOlderOrders,
    fetchOlderOrders,
    setBottomSheetOpen,
  } = useApp();

  // Time scope selector: Today (default), Yesterday, Past 7 Days, This Month, All Time
  const [timeScope, setTimeScope] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');

  // Cashier desk filters
  const [selectedCashierId, setSelectedCashierId] = useState<string>('all');
  const [cashierSubTab, setCashierSubTab] = useState<'orders' | 'till_breakdown'>('orders');
  const [editingOpeningShiftId, setEditingOpeningShiftId] = useState<string | null>(null);
  const [openingBalanceDraft, setOpeningBalanceDraft] = useState<string>('');

  // Refund decision modal
  const [selectedRefundAction, setSelectedRefundAction] = useState<{
    id: string;
    orderNumber: string;
    amount: number;
    reason: string;
    type: 'approve' | 'reject';
  } | null>(null);

  React.useEffect(() => {
    if (!selectedRefundAction) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [selectedRefundAction, setBottomSheetOpen]);

  const normCurrentBranchId = normalizeBranchId(currentBranch.id);

  // Time scope fetch handler (only triggers fetch when non-today option is chosen)
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

  // Branch cashiers
  const branchCashiers = users.filter(
    (u) => (u as any).role === 'cashier' && (!u.branchId || u.branchId === currentBranch.id || normalizeBranchId(u.branchId) === normCurrentBranchId)
  );

  // Branch orders
  const branchOrders = orders.filter(
    (o) => !o.branchId || o.branchId === currentBranch.id || normalizeBranchId(o.branchId) === normCurrentBranchId
  );

  const timeFilteredOrders = branchOrders.filter((o) => isOrderInTimeScope(o.createdAt, timeScope));

  // Branch refunds
  const branchRefunds = refunds.filter(
    (r) => !r.branchId || r.branchId === currentBranch.id || normalizeBranchId(r.branchId) === normCurrentBranchId
  );
  const pendingRefunds = branchRefunds.filter((r) => r.status === 'requested');

  // Branch shifts
  const branchShifts = (shifts || []).filter(
    (s) => !s.branchId || s.branchId === currentBranch.id || normalizeBranchId(s.branchId) === normCurrentBranchId
  );
  const activeShift = branchShifts.find((s) => s.status === 'open') || branchShifts[0];
  const latestClosedShift = branchShifts.find((s) => s.status === 'closed') || null;

  // Helper: check if order is paid
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

  // -------------------------------------------------------------
  // CASHIER DESK COMPUTATIONS (Lively computed when Cashier Desk active)
  // -------------------------------------------------------------
  const cashierOrders = timeFilteredOrders.filter((o) => {
    const isCashierType =
      o.isWalkIn === true ||
      o.isTableQr === true ||
      !!(o as any).tableQrSessionId ||
      o.type === 'dine_in' ||
      (o.notes && o.notes.toLowerCase().includes('walk-in')) ||
      (o.notes && o.notes.toLowerCase().includes('counter'));

    if (selectedCashierId === 'all') return isCashierType;

    const targetUser = branchCashiers.find((c) => c.id === selectedCashierId);
    const cashierShifts = branchShifts.filter(
      (s) =>
        s.cashierId === selectedCashierId ||
        (targetUser && s.cashierName?.toLowerCase().includes(targetUser.name.toLowerCase()))
    );
    const cashierShiftIds = cashierShifts.map((s) => s.id);

    const matchExplicit =
      o.cashierId === selectedCashierId ||
      (o as any).staffId === selectedCashierId ||
      (targetUser && o.cashierName && o.cashierName.toLowerCase().includes(targetUser.name.toLowerCase())) ||
      (o.shiftId && cashierShiftIds.includes(o.shiftId));

    if (matchExplicit) return isCashierType;

    // Fallback: If order has no explicit cashier/shift ID, attribute to first branch cashier
    if (!o.cashierId && !o.shiftId && targetUser) {
      const isPrimary = branchCashiers[0]?.id === selectedCashierId;
      if (isPrimary) return isCashierType;
    }
    return false;
  });

  const targetCashierShifts = selectedCashierId === 'all'
    ? branchShifts
    : branchShifts.filter((s) => s.cashierId === selectedCashierId);
  const recordedShiftCash = targetCashierShifts.reduce((sum, s) => sum + (Number(s.cashCollected) || 0), 0);

  const cashierPaidOrders = cashierOrders.filter(isOrderPaid);
  const rawCashFromOrders = cashierPaidOrders
    .filter((o) => (o.paymentMethod || '').toLowerCase().includes('cash') || (o.paymentMethod || '').toLowerCase().includes('cod'))
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const cashierCashCollected = Math.max(rawCashFromOrders, recordedShiftCash);

  const cashierDigitalCollected = cashierPaidOrders
    .filter((o) => !(o.paymentMethod || '').toLowerCase().includes('cash') && !(o.paymentMethod || '').toLowerCase().includes('cod'))
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const rawTotalSettled = cashierPaidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const cashierTotalSettled = Math.max(rawTotalSettled, cashierCashCollected + cashierDigitalCollected);

  const effectiveOpeningFloat = activeShift ? Number(activeShift.openingFloat || 0) : 0;
  const cashierDrawerCash = effectiveOpeningFloat + cashierCashCollected;

  const handleConfirmDecision = () => {
    if (!selectedRefundAction) return;
    if (selectedRefundAction.type === 'approve') {
      approveRefund(selectedRefundAction.id);
    } else {
      rejectRefund(selectedRefundAction.id);
    }
    setSelectedRefundAction(null);
  };

  return (
    <View style={styles.container}>
      {/* Centered Modal for Older Data Loading */}
      <HistoricalLoadingModal visible={isFetchingOlderOrders} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Page Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>Cashier Desk & Financials</Text>
            <Text style={styles.pageSub}>
              {currentBranch.name} • Station Monitor & Live Orders
            </Text>
          </View>
        </View>

        {/* TIME SCOPE SELECTOR (Only loads from server when non-today picked) */}
        <View style={styles.timeFilterCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Clock size={13} color={Colors.primary} />
            <Text style={styles.timeFilterTitle}>Time Scope</Text>
            <Text style={{ fontSize: 11, color: Colors.textMuted }}>• Today fast cached, other dates live fetched</Text>
          </View>
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

        {/* ======================================================== */}
        {/* CASHIER DESK                                             */}
        {/* ======================================================== */}
        <View style={{ gap: 14 }}>
            {/* Cashier Selector */}
            <View style={styles.cashierSelectCard}>
              <Text style={styles.sectionLabel}>Select Cashier Till:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cashierPillsScroll}>
                <TouchableOpacity
                  style={[styles.cashierPill, selectedCashierId === 'all' && styles.cashierPillActive]}
                  onPress={() => setSelectedCashierId('all')}
                >
                  <Text style={[styles.cashierPillText, selectedCashierId === 'all' && styles.cashierPillTextActive]}>
                    All Cashiers ({branchCashiers.length > 0 ? branchCashiers.length : 1})
                  </Text>
                </TouchableOpacity>
                {branchCashiers.map((c) => {
                  const isActive = selectedCashierId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.cashierPill, isActive && styles.cashierPillActive]}
                      onPress={() => setSelectedCashierId(c.id)}
                    >
                      <Text style={[styles.cashierPillText, isActive && styles.cashierPillTextActive]}>
                        👤 {c.name || 'Cashier'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Cashier KPI Cards */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: Colors.successLight }]}>
                  <Banknote size={16} color={Colors.success} />
                </View>
                <Text style={styles.kpiVal}>Rs. {cashierDrawerCash.toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>
                  {activeShift?.status === 'open' ? 'Open Account Balance' : 'Till / Drawer Balance'}
                </Text>
                <Text style={styles.kpiSub}>
                  Opening: Rs. {effectiveOpeningFloat.toLocaleString()} • Closed: {latestClosedShift ? `Rs. ${Number(latestClosedShift.countedCash ?? latestClosedShift.expectedCash ?? 0).toLocaleString()}` : '—'}
                </Text>
                {activeShift && (
                  <TouchableOpacity
                    onPress={() => {
                      setEditingOpeningShiftId(activeShift.id);
                      setOpeningBalanceDraft(String(activeShift.openingFloat || 0));
                    }}
                    style={{ marginTop: 6, backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8, alignSelf: 'flex-start' }}
                  >
                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: Colors.primary }}>Edit Opening Balance</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: Colors.primaryLight }]}>
                  <Receipt size={16} color={Colors.primary} />
                </View>
                <Text style={styles.kpiVal}>Rs. {cashierCashCollected.toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Cash Collections</Text>
                <Text style={styles.kpiSub}>{cashierPaidOrders.length} Paid Orders</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: Colors.infoLight }]}>
                  <CreditCard size={16} color={Colors.info} />
                </View>
                <Text style={styles.kpiVal}>Rs. {cashierDigitalCollected.toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Digital / Online Collections</Text>
                <Text style={styles.kpiSub}>Card & Mobile Wallets</Text>
              </View>

              <View style={styles.kpiCard}>
                <View style={[styles.kpiIconWrap, { backgroundColor: '#F3E8FF' }]}>
                  <Sparkles size={16} color="#8B5CF6" />
                </View>
                <Text style={[styles.kpiVal, { color: '#8B5CF6' }]}>Rs. {cashierTotalSettled.toLocaleString()}</Text>
                <Text style={styles.kpiLabel}>Gross Cashier Sales</Text>
                <Text style={styles.kpiSub}>{cashierOrders.length} Total Receipts</Text>
              </View>
            </View>

            {/* Sub Tabs: Orders List vs Till Breakdown */}
            <View style={styles.subTabsRow}>
              <TouchableOpacity
                style={[styles.subTabBtn, cashierSubTab === 'orders' && styles.subTabBtnActive]}
                onPress={() => setCashierSubTab('orders')}
              >
                <Text style={[styles.subTabBtnText, cashierSubTab === 'orders' && styles.subTabBtnTextActive]}>
                  Cashier Orders ({cashierOrders.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTabBtn, cashierSubTab === 'till_breakdown' && styles.subTabBtnActive]}
                onPress={() => setCashierSubTab('till_breakdown')}
              >
                <Text style={[styles.subTabBtnText, cashierSubTab === 'till_breakdown' && styles.subTabBtnTextActive]}>
                  Shift Till Breakdown
                </Text>
              </TouchableOpacity>
            </View>

            {cashierSubTab === 'orders' ? (
              <View style={styles.ordersListCard}>
                <Text style={styles.sectionHeader}>Dine-In & Walk-In Cashier Receipts</Text>
                {cashierOrders.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Receipt size={32} color={Colors.textMuted} />
                    <Text style={styles.emptyTitle}>No Cashier Orders Found</Text>
                    <Text style={styles.emptySub}>No counter settlements in the selected time scope.</Text>
                  </View>
                ) : (
                  cashierOrders.map((o) => {
                    const isPaid = isOrderPaid(o);
                    return (
                      <View key={o.id} style={styles.orderItemRow}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.orderItemNum}>#{o.orderNumber}</Text>
                            <View style={[styles.payBadge, { backgroundColor: isPaid ? Colors.successLight : '#FEF3C7' }]}>
                              <Text style={[styles.payBadgeText, { color: isPaid ? Colors.success : '#D97706' }]}>
                                {isPaid ? 'PAID' : 'UNPAID'}
                              </Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: o.status === 'completed' ? Colors.successLight : Colors.primaryLight }]}>
                              <Text style={[styles.statusBadgeText, { color: o.status === 'completed' ? Colors.success : Colors.primary }]}>
                                {(o.status || 'placed').toUpperCase()}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.orderItemSub}>
                            {o.customerName} • {o.type === 'dine_in' ? `Table ${o.tableNumber || 'Seated'}` : 'Walk-In'} • {o.paymentMethod || 'Cash'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.orderItemTotal}>Rs. {Number(o.total || 0).toLocaleString()}</Text>
                          <Text style={styles.orderItemItems}>{o.items?.length || 0} item(s)</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            ) : (
              /* Till Breakdown Tab */
              <View style={styles.tillCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={[styles.sectionHeader, { marginBottom: 0 }]}>Cashier Shift Register Breakdown</Text>
                  {activeShift && (
                    <TouchableOpacity
                      onPress={() => {
                        setEditingOpeningShiftId(activeShift.id);
                        setOpeningBalanceDraft(String(activeShift.openingFloat || 0));
                      }}
                      style={{ backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.primary }}>Edit Opening Balance</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.tillRow}>
                  <Text style={styles.tillRowName}>Opening Account Balance</Text>
                  <Text style={styles.tillRowVal}>Rs. {effectiveOpeningFloat.toLocaleString()}</Text>
                </View>
                <View style={styles.tillRow}>
                  <Text style={styles.tillRowName}>Cash Collected at Counter</Text>
                  <Text style={[styles.tillRowVal, { color: Colors.success }]}>+ Rs. {cashierCashCollected.toLocaleString()}</Text>
                </View>
                <View style={styles.tillRow}>
                  <Text style={styles.tillRowName}>Digital Collections (Cards & Wallets)</Text>
                  <Text style={styles.tillRowVal}>Rs. {cashierDigitalCollected.toLocaleString()}</Text>
                </View>
                <View style={[styles.tillRow, { borderTopWidth: 1.5, borderColor: Colors.borderColor, marginTop: 6, paddingTop: 10 }]}>
                  <Text style={[styles.tillRowName, { fontWeight: '800', color: Colors.textMain }]}>Current / Expected Account Balance</Text>
                  <Text style={[styles.tillRowVal, { fontWeight: '900', color: Colors.primary, fontSize: 16 }]}>Rs. {cashierDrawerCash.toLocaleString()}</Text>
                </View>
                {latestClosedShift && (
                  <View style={[styles.tillRow, { backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 8, marginTop: 6 }]}>
                    <Text style={[styles.tillRowName, { fontWeight: '700', color: '#475569' }]}>
                      Last Closed Account ({latestClosedShift.cashierName || 'Cashier'})
                    </Text>
                    <Text style={[styles.tillRowVal, { fontWeight: '900', color: '#EA580C' }]}>
                      Rs. {Number(latestClosedShift.countedCash ?? latestClosedShift.expectedCash ?? 0).toLocaleString()}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
      </ScrollView>

      {/* Edit Cashier Opening Balance Modal (Manager Only) */}
      <Modal
        visible={!!editingOpeningShiftId}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setEditingOpeningShiftId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Cashier Opening Balance</Text>
            <Text style={[styles.modalMsg, { marginTop: 6 }]}>
              Update the opening float amount for this cashier shift. Expected account balance and closing difference recalculate automatically.
            </Text>
            <TextInput
              value={openingBalanceDraft}
              onChangeText={setOpeningBalanceDraft}
              keyboardType="numeric"
              placeholder="Enter opening balance (Rs.)"
              style={{
                borderWidth: 1,
                borderColor: Colors.borderColor,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 15,
                fontWeight: '700',
                color: Colors.textMain,
                backgroundColor: Colors.bgSubtle,
                marginBottom: 14,
              }}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setEditingOpeningShiftId(null)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (editingOpeningShiftId) {
                    updateShiftOpeningBalance(editingOpeningShiftId, parseFloat(openingBalanceDraft) || 0);
                  }
                  setEditingOpeningShiftId(null);
                }}
                style={[styles.modalConfirmBtn, { backgroundColor: Colors.primary }]}
              >
                <Text style={styles.modalConfirmText}>Save Balance</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal for Refund Decisions */}
      <Modal visible={!!selectedRefundAction} transparent animationType="fade" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View
                style={[
                  styles.modalIconWrap,
                  { backgroundColor: selectedRefundAction?.type === 'approve' ? Colors.successLight : '#FEE2E2' },
                ]}
              >
                {selectedRefundAction?.type === 'approve' ? (
                  <CheckCircle size={22} color={Colors.success} />
                ) : (
                  <XCircle size={22} color="#DC2626" />
                )}
              </View>
              <Text style={styles.modalTitle}>
                {selectedRefundAction?.type === 'approve' ? 'Authorize Refund' : 'Reject Refund'}
              </Text>
            </View>

            <Text style={styles.modalMsg}>
              {selectedRefundAction?.type === 'approve'
                ? `Confirm refund authorization for Order #${selectedRefundAction.orderNumber} for Rs. ${selectedRefundAction.amount.toLocaleString()}? Amount will be refunded to customer.`
                : `Are you sure you want to reject the refund request for Order #${selectedRefundAction?.orderNumber}?`}
            </Text>

            {selectedRefundAction?.reason ? (
              <View style={styles.modalDetailBox}>
                <Text style={styles.modalDetailLabel}>Reason on record:</Text>
                <Text style={styles.modalDetailText}>{selectedRefundAction.reason}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setSelectedRefundAction(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: selectedRefundAction?.type === 'approve' ? Colors.success : '#DC2626' },
                ]}
                onPress={handleConfirmDecision}
              >
                <Text style={styles.modalConfirmText}>
                  {selectedRefundAction?.type === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
    letterSpacing: -0.3,
  },
  pageSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  stationTabsWrap: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 4,
    gap: 6,
  },
  stationTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  stationTabActive: {
    backgroundColor: Colors.primary,
  },
  stationTabText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  stationTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  stationBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  stationBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  timeFilterCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 10,
  },
  timeFilterTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.textMain,
  },
  timePillsScroll: {
    gap: 6,
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
  cashierSelectCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 10,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.textMuted,
    marginBottom: 6,
  },
  cashierPillsScroll: {
    gap: 6,
  },
  cashierPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  cashierPillActive: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  cashierPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  cashierPillTextActive: {
    color: Colors.success,
    fontWeight: '800',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 14,
    justifyContent: 'space-between',
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiVal: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
    letterSpacing: -0.3,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 10.5,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  subTabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 3,
    gap: 4,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabBtnActive: {
    backgroundColor: Colors.primaryLight,
  },
  subTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  subTabBtnTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  ordersListCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 14,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 10,
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  orderItemNum: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  orderItemSub: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 3,
  },
  orderItemTotal: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.textMain,
  },
  orderItemItems: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  payBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  payBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  typeBadge: {
    backgroundColor: Colors.bgSubtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tillCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 16,
    gap: 8,
  },
  tillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  tillRowName: {
    fontSize: 12.5,
    color: Colors.textSecondary,
  },
  tillRowVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  channelPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  channelPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  channelPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  channelPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  channelPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  refundsAlertBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 14,
  },
  refundsAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B91C1C',
  },
  refundCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 12,
    marginBottom: 8,
  },
  refundCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  requestedBy: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  amountPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  amountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
  },
  reasonBox: {
    marginVertical: 8,
    backgroundColor: '#FFF7ED',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#F97316',
  },
  reasonLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#C2410C',
  },
  reasonText: {
    fontSize: 12,
    color: Colors.textMain,
    marginTop: 2,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: Colors.success,
    borderRadius: 6,
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  rejectBtn: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  rejectBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 12,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
  },
  emptySub: {
    fontSize: 11.5,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  modalMsg: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  modalDetailBox: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  modalDetailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  modalDetailText: {
    fontSize: 12.5,
    color: Colors.textMain,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  modalConfirmBtn: {
    flex: 2,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
