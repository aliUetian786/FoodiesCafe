import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { Order, getCancellationAttribution } from '../types';
import { Receipt, RotateCcw, X, Printer, Calendar, Clock, MapPin, RefreshCw, ShoppingBag } from 'lucide-react-native';
import { HistoricalLoadingModal } from '../components/HistoricalLoadingModal';
import { CustomerLoginModal } from './CustomerLoginModal';

interface CustomerHistoryProps {
  onReorder: () => void;
  onViewTracking?: () => void;
}

function getDisplayStatus(status: string, orderType: string = 'delivery', ord?: Order) {
  const s = (status || '').toLowerCase();
  const t = (orderType || '').toLowerCase();

  if (s === 'cancelled') {
    const attr = ord ? getCancellationAttribution(ord) : null;
    const label = attr?.isCustomer ? 'CANCELLED (BY YOU)' : (attr?.badge || 'CANCELLED');
    return { label, color: '#DC2626', bg: '#FEE2E2' };
  }
  // Received / Completed statuses only (since in-tracking orders are excluded)
  if (t === 'dine_in' || s === 'served') {
    return { label: 'SERVED', color: '#4F46E5', bg: '#EEF2FF' };
  }
  if (t === 'takeaway' || s === 'taken') {
    return { label: 'TAKEN', color: '#334155', bg: '#F1F5F9' };
  }
  return { label: 'DELIVERED', color: '#059669', bg: '#ECFDF5' };
}

export function CustomerHistory({ onReorder, onViewTracking }: CustomerHistoryProps) {
  const {
    orders,
    addToCart,
    menuItems,
    showToast,
    currentUser,
    customerUser,
    isCustomerLoggedIn,
    fetchOlderOrders,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    setBottomSheetOpen,
  } = useApp();
  const [selectedReceipt, setSelectedReceipt] = useState<Order | null>(null);
  const [loginModalVisible, setLoginModalVisible] = useState(false);

  useEffect(() => {
    if (!selectedReceipt) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [selectedReceipt, setBottomSheetOpen]);

  // Exception handler: load data of older days properly on-demand from database (only when logged in)
  useEffect(() => {
    if (isCustomerLoggedIn && !hasLoadedOlderOrders && !isFetchingOlderOrders) {
      fetchOlderOrders();
    }
  }, [isCustomerLoggedIn, hasLoadedOlderOrders, isFetchingOlderOrders]);

  const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
  const cleanPhone = normalizePhone(customerUser?.phone || currentUser?.phone);

  // Link strictly to logged-in customer account
  // If not logged in, show ZERO orders
  const customerOrders = useMemo(() => {
    if (!isCustomerLoggedIn) {
      return [];
    }

    return orders.filter((o) => {
      const matchesId = (customerUser?.id && o.customerId === customerUser.id) || (currentUser?.id && currentUser.id !== 'guest' && o.customerId === currentUser.id);
      const matchesPhone = cleanPhone && normalizePhone(o.customerPhone) === cleanPhone;
      const matchesEmail = (customerUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === customerUser.email.toLowerCase()) ||
                           (currentUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === currentUser.email.toLowerCase());
      const matchesName = (customerUser?.name && o.customerName === customerUser.name) ||
                          (currentUser?.name && currentUser.name !== 'Guest Customer' && o.customerName === currentUser.name);
      return matchesId || matchesPhone || matchesEmail || matchesName;
    });
  }, [orders, currentUser, customerUser, isCustomerLoggedIn, cleanPhone]);

  // Exclude in-tracking orders: only completed, delivered, served, taken, or cancelled appear in history
  // Strict paid-only filter: unpaid orders remain in tracking / active and do not appear in history
  // List new orders in history at top (sorted by createdAt descending)
  const historyOrders = useMemo(() => {
    return customerOrders
      .filter((o) => {
        const isPaid = o.paymentStatus === 'paid' || o.paymentCollected === true;
        if (!isPaid) return false;
        return (
          o.status === 'completed' ||
          o.status === 'delivered' ||
          o.status === 'served' ||
          o.status === 'taken' ||
          o.status === 'cancelled'
        );
      })
      .sort((a, b) => {
        const tA = new Date(a.createdAt).getTime() || 0;
        const tB = new Date(b.createdAt).getTime() || 0;
        return tB - tA;
      });
  }, [customerOrders]);

  const hasActiveOrders = useMemo(() => {
    return customerOrders.some(
      (o) =>
        o.status !== 'completed' &&
        o.status !== 'delivered' &&
        o.status !== 'served' &&
        o.status !== 'taken' &&
        o.status !== 'cancelled'
    );
  }, [customerOrders]);

  const handleReorder = (order: Order) => {
    order.items.forEach((item) => {
      const match = menuItems.find((m) => m.id === item.menuItemId);
      if (match) {
        addToCart(match, item.size, item.extras, item.instructions);
      }
    });
    showToast(`Items from Order #${order.orderNumber} added to cart!`, 'success');
    onReorder();
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={{ marginBottom: 2 }}>
          <Text style={styles.pageTitle}>Order History & Receipts</Text>
          <Text style={styles.pageSub}>Permanent record of all your delicious cafe orders</Text>
        </View>

        {/* Pop-up Circle Loading Sign when fetching order records from database */}
        <HistoricalLoadingModal visible={isFetchingOlderOrders && isCustomerLoggedIn} />

        {hasActiveOrders && onViewTracking && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={onViewTracking}
            activeOpacity={0.8}
          >
            <View style={styles.activeBannerLeft}>
              <Text style={styles.activeBannerIcon}>🛵</Text>
              <View>
                <Text style={styles.activeBannerTitle}>Active Order In Progress</Text>
                <Text style={styles.activeBannerSub}>Tap to view live tracking & status</Text>
              </View>
            </View>
            <Text style={styles.activeBannerArrow}>Track &rarr;</Text>
          </TouchableOpacity>
        )}

        {!isCustomerLoggedIn ? (
          <View style={styles.emptyCard}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(217, 101, 40, 0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Receipt size={36} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Sign In to View History</Text>
            <Text style={styles.emptySub}>
              Please sign in with your email to view your past orders, receipts, and easily reorder your favorites.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.reorderBtn, { paddingHorizontal: 20, paddingVertical: 12 }]}
                onPress={() => setLoginModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.reorderBtnText, { fontSize: 13.5 }]}>Sign In with Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.receiptBtn, { paddingHorizontal: 16, paddingVertical: 12 }]}
                onPress={onReorder}
                activeOpacity={0.8}
              >
                <Text style={[styles.receiptBtnText, { fontSize: 13.5 }]}>Browse Menu →</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : historyOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Receipt size={40} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>
              {hasActiveOrders ? 'Order Currently In Progress!' : 'No Previous Orders'}
            </Text>
            <Text style={styles.emptySub}>
              {hasActiveOrders
                ? 'Your active order is being prepared and tracked live. Receipts will appear here once received!'
                : 'Your past order receipts will appear here.'}
            </Text>
            {hasActiveOrders && onViewTracking && (
              <TouchableOpacity
                style={[styles.reorderBtn, { marginTop: 14, paddingHorizontal: 16 }]}
                onPress={onViewTracking}
              >
                <Text style={styles.reorderBtnText}>Track Active Order →</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.ordersList}>
            {historyOrders.map((ord) => (
              <View key={ord.id} style={styles.orderCard}>
                <View style={styles.orderTop}>
                  <View>
                    <Text style={styles.orderNum}>Order #{ord.orderNumber}</Text>
                    <View style={styles.dateRow}>
                      <Calendar size={11} color={Colors.textMuted} />
                      <Text style={styles.dateText}>
                        {new Date(ord.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    {ord.status === 'cancelled' && (
                      <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700', marginTop: 2 }}>
                        {getCancellationAttribution(ord).isCustomer
                          ? 'Cancelled by you'
                          : (getCancellationAttribution(ord).badge === 'CANCELLED (BRANCH CLOSED)'
                              ? 'Cancelled: Branch closed offline by staff'
                              : 'Cancelled by cafe staff')}
                      </Text>
                    )}
                  </View>
                  {(() => {
                    const st = getDisplayStatus(ord.status, ord.type, ord);
                    return (
                      <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: st.color }]}>
                          {st.label}
                        </Text>
                      </View>
                    );
                  })()}
                </View>

                {/* Items breakdown */}
                <View style={styles.dishesSummary}>
                  {ord.items.map((it, idx) => (
                    <Text key={idx} style={styles.dishLine}>
                      • {it.quantity}x {it.name} {it.size ? `(${it.size})` : ''}
                    </Text>
                  ))}
                </View>

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.priceTotal}>Rs. {ord.total}</Text>
                    <Text style={styles.paymentMethodText}>{ord.paymentMethod}</Text>
                  </View>
                  <View style={styles.footerActions}>
                    <TouchableOpacity
                      style={styles.receiptBtn}
                      onPress={() => setSelectedReceipt(ord)}
                    >
                      <Receipt size={13} color={Colors.primary} />
                      <Text style={styles.receiptBtnText}>Receipt</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.reorderBtn}
                      onPress={() => handleReorder(ord)}
                    >
                      <RotateCcw size={13} color={Colors.textWhite} />
                      <Text style={styles.reorderBtnText}>Reorder</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 80mm Thermal Receipt Pop-up Modal with 135° Watermark styling */}
      <Modal visible={!!selectedReceipt} transparent animationType="fade" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptBrand}>FoodiesCafe</Text>
              <Text style={styles.receiptSub}>Official 80mm POS Thermal Receipt</Text>
              <Text style={styles.receiptSub}>GST Registered • NTN: 8492019-3</Text>
              <TouchableOpacity
                style={styles.closeReceipt}
                onPress={() => setSelectedReceipt(null)}
              >
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaText}>Order: #{selectedReceipt?.orderNumber}</Text>
              <Text style={styles.receiptMetaText}>
                Date: {selectedReceipt && new Date(selectedReceipt.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaText}>Type: {selectedReceipt?.type.toUpperCase()}</Text>
              <Text style={styles.receiptMetaText}>
                Status: {selectedReceipt ? getDisplayStatus(selectedReceipt.status, selectedReceipt.type).label : ''}
              </Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaText}>Printed:</Text>
              <Text style={[styles.receiptMetaText, { fontWeight: '800', color: Colors.primary }]}>
                {new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </Text>
            </View>

            <View style={styles.receiptDivider} />

            {/* Items table */}
            <ScrollView style={{ maxHeight: 180 }}>
              {selectedReceipt?.items.map((it, idx) => (
                <View key={idx} style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName}>
                    {it.quantity}x {it.name}
                  </Text>
                  <Text style={styles.receiptItemPrice}>Rs. {it.unitPrice * it.quantity}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Subtotal</Text>
              <Text style={styles.receiptTotalVal}>Rs. {selectedReceipt?.originalSubtotal}</Text>
            </View>
            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>GST (16%)</Text>
              <Text style={styles.receiptTotalVal}>Rs. {selectedReceipt?.tax}</Text>
            </View>
            <View style={[styles.receiptTotalRow, { marginTop: 4 }]}>
              <Text style={styles.receiptGrandLabel}>GRAND TOTAL</Text>
              <Text style={styles.receiptGrandVal}>Rs. {selectedReceipt?.total}</Text>
            </View>

            <View style={styles.receiptFooter}>
              <Text style={styles.thankYouText}>Thank you for dining with FoodiesCafe!</Text>
              <Text style={styles.helplineText}>UAN Helpline: +92 42 3575 8899</Text>
            </View>

            <TouchableOpacity
              style={styles.printBtn}
              onPress={() => {
                showToast('Receipt sent to thermal printer ✓', 'success');
                setSelectedReceipt(null);
              }}
            >
              <Printer size={15} color={Colors.textWhite} />
              <Text style={styles.printBtnText}>Print 80mm Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CustomerLoginModal
        visible={loginModalVisible}
        onClose={() => setLoginModalVisible(false)}
        onSuccess={() => setLoginModalVisible(false)}
      />
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
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  pageSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  activeBanner: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activeBannerIcon: {
    fontSize: 20,
  },
  activeBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C2410C',
  },
  activeBannerSub: {
    fontSize: 11,
    color: '#9A3412',
    marginTop: 1,
  },
  activeBannerArrow: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EA580C',
    marginLeft: 8,
  },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textMain,
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  ordersList: {
    gap: 12,
  },
  orderCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderNum: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  dateText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.primaryLight,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
  },
  statusCompleted: {
    backgroundColor: Colors.successLight,
  },
  statusCompletedText: {
    color: Colors.success,
  },
  dishesSummary: {
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSubtle,
    marginVertical: 6,
    gap: 2,
  },
  dishLine: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  priceTotal: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textMain,
  },
  paymentMethodText: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    gap: 4,
  },
  receiptBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  reorderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textWhite,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  receiptCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  receiptHeader: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  receiptBrand: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
    letterSpacing: -0.5,
  },
  receiptSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  closeReceipt: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: Colors.borderColor,
    marginVertical: 8,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  receiptMetaText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  receiptItemName: {
    fontSize: 12,
    color: Colors.textMain,
  },
  receiptItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  receiptTotalLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  receiptTotalVal: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
  },
  receiptGrandLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.textMain,
  },
  receiptGrandVal: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.primary,
  },
  receiptFooter: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
  },
  thankYouText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
  },
  helplineText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  printBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 6,
  },
  printBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textWhite,
  },
});

