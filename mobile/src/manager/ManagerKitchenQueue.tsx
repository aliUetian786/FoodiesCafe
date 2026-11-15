import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { Order, OrderStatus } from '../types';
import { normalizeBranchId } from '../services/api';
import { ChefHat, Utensils, ShoppingBag, Bike, CheckCircle, AlertCircle, Eye, Globe, Building2 } from 'lucide-react-native';

export function ManagerKitchenQueue() {
  const { orders, currentBranch, branches, updateOrderStatus, showToast, role, staffUser } = useApp();

  const isManager =
    role === 'branch_manager' ||
    staffUser?.role === 'branch_manager' ||
    role === 'platform_owner' ||
    staffUser?.role === 'platform_owner';

  const [activeTab, setActiveTab] = useState<'arrived' | 'ready'>('arrived');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const parseOrderTimeMs = (createdAt?: string) => {
    if (!createdAt) return 0;
    const direct = new Date(createdAt).getTime();
    if (!isNaN(direct) && direct > 0) return direct;
    return 0;
  };

  // Filter orders for this branch and categorize strictly into Arrived & Ready to Serve
  const branchOrders = useMemo(
    () =>
      orders.filter((o) => {
        const matchesBranch =
          selectedBranch === 'all' ||
          !o.branchId ||
          normalizeBranchId(o.branchId) === selectedBranch;

        const isLive =
          o.status !== 'cancelled' &&
          o.status !== 'completed' &&
          o.status !== 'delivered' &&
          o.status !== 'served' &&
          o.status !== 'taken';

        return matchesBranch && isLive;
      }),
    [orders, selectedBranch]
  );

  const arrivedOrders = useMemo(
    () =>
      branchOrders
        .filter((o) => o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing')
        .sort((a, b) => parseOrderTimeMs(b.createdAt) - parseOrderTimeMs(a.createdAt)),
    [branchOrders]
  );

  const readyOrders = useMemo(
    () =>
      branchOrders
        .filter((o) => o.status === 'ready')
        .sort((a, b) => parseOrderTimeMs(b.createdAt) - parseOrderTimeMs(a.createdAt)),
    [branchOrders]
  );

  const handleMarkOrderReceived = (orderId: string, orderNumber: string) => {
    if (isManager) {
      showToast('Branch Managers have view-only access in Kitchen queue.', 'warning');
      return;
    }
    updateOrderStatus(orderId, 'preparing' as OrderStatus, {
      sentToKitchen: true,
      sentToKitchenAt: new Date().toISOString(),
    });
    showToast(`Order #${orderNumber} acknowledged & cooking in kitchen ✓`, 'info');
  };

  const handleMarkOrderReady = (orderId: string, orderNumber: string) => {
    if (isManager) {
      showToast('Branch Managers have view-only access in Kitchen queue.', 'warning');
      return;
    }
    updateOrderStatus(orderId, 'ready' as OrderStatus);
    showToast(`Order #${orderNumber} marked as Ready to Serve 🍽️`, 'success');
  };

  const displayOrders = activeTab === 'arrived' ? arrivedOrders : readyOrders;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleRow}>
          <View style={styles.iconBox}>
            <ChefHat size={22} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>{isManager ? 'Kitchen Monitor' : 'Kitchen'}</Text>
            <Text style={styles.headerSubtitle}>
              {currentBranch.name} • {isManager ? 'Live Order Preparation (View Only)' : 'Live Orders'}
            </Text>
          </View>
        </View>

        {/* Branch Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.branchFilterScroll}
        >
          <TouchableOpacity
            style={[styles.branchFilterChip, selectedBranch === 'all' && styles.branchFilterChipActive]}
            onPress={() => setSelectedBranch('all')}
            activeOpacity={0.8}
          >
            <Text style={[styles.branchFilterText, selectedBranch === 'all' && styles.branchFilterTextActive]}>
              All Branches
            </Text>
          </TouchableOpacity>
          {(branches || []).map((b) => {
            const normB = normalizeBranchId(b.id);
            const isBSelected = selectedBranch === normB;
            return (
              <TouchableOpacity
                key={b.id}
                style={[styles.branchFilterChip, isBSelected && styles.branchFilterChipActive]}
                onPress={() => setSelectedBranch(normB)}
                activeOpacity={0.8}
              >
                <Text style={[styles.branchFilterText, isBSelected && styles.branchFilterTextActive]}>
                  {b.name.replace(/foodies cafe\s*/i, '').trim()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 2-Option Segmented Selector: Order Preparation & Order Ready to Serve */}
        <View style={styles.segmentedRow}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'arrived' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('arrived')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentBtnText, activeTab === 'arrived' && styles.segmentBtnTextActive]}>
              {isManager ? 'Order Preparation' : 'Order Arrived'} ({arrivedOrders.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'ready' && styles.segmentBtnActiveReady]}
            onPress={() => setActiveTab('ready')}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentBtnText, activeTab === 'ready' && styles.segmentBtnTextActive]}>
              {isManager ? 'Ready to Serve' : 'Marked Ready'} ({readyOrders.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Orders List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
        {displayOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <ChefHat size={44} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {activeTab === 'arrived'
                ? (isManager ? 'No Orders in Preparation' : 'No Orders Arrived')
                : 'No Orders Ready to Serve'}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === 'arrived'
                ? (isManager
                    ? 'Orders currently being prepared in the kitchen will appear here.'
                    : 'Incoming orders from customers and counter will appear here.')
                : 'Orders marked ready in kitchen will be displayed here for service.'}
            </Text>
          </View>
        ) : (
          displayOrders.map((ord) => {
            const isReceived = ord.status === 'preparing';
            const isReadyToServe = ord.status === 'ready' || ord.status === 'served';
            const orderBranch = branches.find((b) => normalizeBranchId(b.id) === normalizeBranchId(ord.branchId));

            return (
              <View key={ord.id} style={styles.ticketCard}>
                {/* Ticket Header */}
                <View style={styles.ticketHeader}>
                  <View style={styles.ticketHeaderLeft}>
                    <View style={styles.typeIconBox}>
                      {ord.type === 'dine_in' && <Utensils size={15} color={Colors.primary} />}
                      {ord.type === 'takeaway' && <ShoppingBag size={15} color={Colors.primary} />}
                      {ord.type === 'delivery' && <Bike size={15} color={Colors.primary} />}
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.ticketOrderNum}>#{ord.orderNumber}</Text>
                        <View style={styles.branchTag}>
                          <Building2 size={10} color={Colors.primary} />
                          <Text style={styles.branchTagText}>
                            {orderBranch ? orderBranch.name.replace(/foodies cafe\s*/i, '').trim() : 'Branch'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.ticketTypeLabel}>
                        {ord.type === 'dine_in'
                          ? `Dine-In • Table ${ord.tableNumber || 'Seated'}`
                          : ord.type === 'takeaway'
                          ? 'Takeaway Counter'
                          : 'Home Delivery'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.ticketTime}>{ord.createdAt}</Text>
                </View>

                {/* Order Origin & Type Bar */}
                <View style={styles.originRow}>
                  {ord.isWalkIn ? (
                    <View style={styles.sourceBadgeWalkIn}>
                      <Text style={styles.sourceBadgeWalkInText}>Counter Walk-in</Text>
                    </View>
                  ) : ord.isTableQr ? (
                    <View style={styles.sourceBadgeQr}>
                      <Text style={styles.sourceBadgeQrText}>Table QR Order</Text>
                    </View>
                  ) : (
                    <View style={styles.sourceBadgeWeb}>
                      <Globe size={11} color="#0D9488" />
                      <Text style={styles.sourceBadgeWebText}>Web / Online Order</Text>
                    </View>
                  )}
                  {ord.paymentStatus === 'paid' ? (
                    <View style={styles.paidPill}>
                      <Text style={styles.paidPillText}>PAID</Text>
                    </View>
                  ) : (
                    <View style={styles.unpaidPill}>
                      <Text style={styles.unpaidPillText}>UNPAID ({ord.paymentMethod || 'COD'})</Text>
                    </View>
                  )}
                </View>

                {/* Customer Meta */}
                {(ord.customerName || ord.customerPhone) && (
                  <View style={styles.customerMetaRow}>
                    <Text style={styles.customerName}>
                      {ord.customerName} {ord.customerPhone ? `• ${ord.customerPhone}` : ''}
                    </Text>
                  </View>
                )}

                {/* Delivery Address */}
                {ord.deliveryAddress && (
                  <Text style={styles.addressLine} numberOfLines={2}>
                    📍 {ord.deliveryAddress}
                  </Text>
                )}

                {/* Dish Items Breakdown */}
                <View style={styles.itemsBox}>
                  {ord.items.map((it, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <View style={styles.itemQtyBadge}>
                        <Text style={styles.itemQtyText}>{it.quantity}x</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemNameText}>{it.name}</Text>
                        {it.size && <Text style={styles.itemOptionText}>Portion: {it.size}</Text>}
                        {it.extras && it.extras.length > 0 && (
                          <Text style={styles.itemOptionText}>Extras: {it.extras.join(', ')}</Text>
                        )}
                        {it.instructions && (
                          <Text style={styles.itemInstructionText}>Note: &ldquo;{it.instructions}&rdquo;</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>

                {/* Special Order Notes */}
                {ord.notes && (
                  <View style={styles.notesBox}>
                    <AlertCircle size={13} color={Colors.warning} />
                    <Text style={styles.notesText}>{ord.notes}</Text>
                  </View>
                )}

                {/* Action Buttons Row */}
                <View style={styles.actionRow}>
                  {!isReadyToServe ? (
                    !isReceived ? (
                      <View style={{ width: '100%', gap: 8 }}>
                        <View style={styles.statusPillArrived}>
                          <Text style={styles.statusPillArrivedText}>
                            {isManager ? 'ORDER ARRIVED • QUEUED FOR PREPARATION' : 'ORDER ARRIVED'}
                          </Text>
                        </View>
                        {isManager ? (
                          <View style={styles.managerNoticeBox}>
                            <Eye size={14} color={Colors.textMuted} />
                            <Text style={styles.managerNoticeText}>
                              View Only • Kitchen Chef acknowledges & cooks
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.markReceivedBtn}
                            onPress={() => handleMarkOrderReceived(ord.id, ord.orderNumber)}
                            activeOpacity={0.8}
                          >
                            <CheckCircle size={16} color="#FFFFFF" />
                            <Text style={styles.actionBtnText}>
                              Mark Order Received
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <View style={{ width: '100%', gap: 8 }}>
                        <View style={styles.statusPillReceived}>
                          <Text style={styles.statusPillReceivedText}>
                            🍳 IN PREPARATION • COOKING
                          </Text>
                        </View>
                        {isManager ? (
                          <View style={styles.managerNoticeBox}>
                            <Eye size={14} color={Colors.textMuted} />
                            <Text style={styles.managerNoticeText}>
                              View Only • Kitchen Chef will mark ready to serve
                            </Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.markReadyBtn}
                            onPress={() => handleMarkOrderReady(ord.id, ord.orderNumber)}
                            activeOpacity={0.8}
                          >
                            <CheckCircle size={16} color="#FFFFFF" />
                            <Text style={styles.actionBtnText}>
                              Mark Order Ready
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )
                  ) : (
                    <View style={styles.readyToServeBox}>
                      <View style={styles.readyHeader}>
                        <CheckCircle size={16} color={Colors.success} />
                        <Text style={styles.readyTitle}>Order Ready to Serve</Text>
                      </View>
                      <Text style={styles.readySub}>
                        {ord.type === 'dine_in'
                          ? 'Ready for server to deliver to table'
                          : ord.type === 'takeaway'
                          ? 'Ready at counter for customer pickup'
                          : 'Ready for delivery rider pickup'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  topHeader: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    gap: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  branchFilterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  branchFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  branchFilterChipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  branchFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  branchFilterTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  branchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  branchTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.primary,
  },
  segmentBtnActiveReady: {
    backgroundColor: Colors.success,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  scrollList: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  ticketCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ticketHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketOrderNum: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  ticketTypeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  ticketTime: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  customerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  addressLine: {
    fontSize: 11.5,
    color: Colors.textMuted,
    backgroundColor: Colors.bgSubtle,
    padding: 6,
    borderRadius: 6,
  },
  itemsBox: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    borderStyle: 'dashed',
    paddingTop: 8,
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemQtyBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemQtyText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  itemOptionText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  itemInstructionText: {
    fontSize: 11,
    color: Colors.primary,
    fontStyle: 'italic',
    marginTop: 1,
  },
  notesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  notesText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
  },
  actionRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    paddingTop: 10,
  },
  statusPillArrived: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillArrivedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  statusPillReceived: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillReceivedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  markReceivedBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  markReadyBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.success,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  readyToServeBox: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  readyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#166534',
  },
  readySub: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
  },
  managerNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  managerNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  sourceBadgeWeb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  sourceBadgeWebText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  sourceBadgeWalkIn: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  sourceBadgeWalkInText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E22CE',
  },
  sourceBadgeQr: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  sourceBadgeQrText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  paidPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  paidPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  unpaidPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  unpaidPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B91C1C',
  },
});
