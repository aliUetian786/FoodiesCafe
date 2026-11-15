import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { AlertTriangle, X, ShoppingBag, Clock } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Branch, Order } from '../types';

interface BranchShutdownModalProps {
  visible: boolean;
  branch: Branch | null;
  pendingOrders: Order[];
  onCancelAction: () => void;
  onContinueProcessing: () => void;
  onCancelOrdersAndShut: () => void;
}

export function BranchShutdownModal({
  visible,
  branch,
  pendingOrders,
  onCancelAction,
  onContinueProcessing,
  onCancelOrdersAndShut,
}: BranchShutdownModalProps) {
  if (!visible || !branch) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={onCancelAction}
    >
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.alertIconWrap}>
                <AlertTriangle size={20} color="#DC2626" strokeWidth={2.4} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>
                  Pending Orders Detected
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {branch.name} has {pendingOrders.length} active order{pendingOrders.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onCancelAction}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              You are about to mark this branch <Text style={{ fontWeight: '800' }}>OFFLINE</Text>. Choose how to handle pending orders:
            </Text>
          </View>

          {/* Pending Orders Section */}
          <Text style={styles.sectionHeading}>
            PENDING ORDERS AWAITING FULFILLMENT ({pendingOrders.length})
          </Text>

          <ScrollView style={styles.ordersScroll} showsVerticalScrollIndicator={true}>
            {pendingOrders.map((ord) => {
              const statusBg =
                ord.status === 'preparing'
                  ? '#FEF3C7'
                  : ord.status === 'ready'
                  ? '#DCFCE7'
                  : '#DBEAFE';
              const statusColor =
                ord.status === 'preparing'
                  ? '#92400E'
                  : ord.status === 'ready'
                  ? '#166534'
                  : '#1E40AF';

              return (
                <View key={ord.id} style={styles.orderRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.orderNumberRow}>
                      <Text style={styles.orderNumberText}>#{ord.orderNumber}</Text>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>
                          {ord.type.toUpperCase().replace('_', ' ')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {ord.customerName} {ord.customerPhone ? `(${ord.customerPhone})` : ''}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                        {ord.status.toUpperCase().replace('_', ' ')}
                      </Text>
                    </View>
                    <Text style={styles.orderTotalText}>Rs. {ord.total.toLocaleString()}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Footer: 3 Options strictly in ONE SINGLE HORIZONTAL LINE */}
          <View style={styles.actionRowHorizontal}>
            {/* Option 1: Cancel */}
            <TouchableOpacity
              style={[styles.btnBase, styles.cancelBtn]}
              onPress={onCancelAction}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText} numberOfLines={1}>
                Cancel
              </Text>
            </TouchableOpacity>

            {/* Option 2: Continue with Orders to Continue Processing */}
            <TouchableOpacity
              style={[styles.btnBase, styles.continueBtn]}
              onPress={onContinueProcessing}
              activeOpacity={0.8}
            >
              <Text style={styles.continueBtnText} numberOfLines={2}>
                Continue with Orders to Process
              </Text>
            </TouchableOpacity>

            {/* Option 3: Cancel Orders & Shut Branch */}
            <TouchableOpacity
              style={[styles.btnBase, styles.shutBtn]}
              onPress={onCancelOrdersAndShut}
              activeOpacity={0.8}
            >
              <Text style={styles.shutBtnText} numberOfLines={2}>
                Cancel Orders & Shut Branch
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 12, 10, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBox: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    padding: 16,
    maxHeight: '88%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  alertIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
  },
  subtitle: {
    fontSize: 11.5,
    color: '#7F1D1D',
    marginTop: 2,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: Colors.bgSubtle,
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginVertical: 12,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  ordersScroll: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 12,
    backgroundColor: Colors.bgSubtle,
    marginBottom: 14,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    backgroundColor: Colors.bgCard,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderNumberText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.textMain,
    fontFamily: 'monospace',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    backgroundColor: '#F3F4F6',
  },
  typeBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#4B5563',
  },
  customerName: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  orderTotalText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
  actionRowHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    width: '100%',
  },
  btnBase: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cancelBtn: {
    flex: 0.8,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  cancelBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textMain,
    textAlign: 'center',
  },
  continueBtn: {
    flex: 1.5,
    backgroundColor: '#F59E0B',
  },
  continueBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 13,
  },
  shutBtn: {
    flex: 1.5,
    backgroundColor: '#DC2626',
  },
  shutBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 13,
  },
});
