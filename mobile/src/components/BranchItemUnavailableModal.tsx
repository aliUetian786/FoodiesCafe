import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { AlertTriangle, MapPin, X, CheckCircle2 } from 'lucide-react-native';

export function BranchItemUnavailableModal() {
  const { branchUnavailableModal, closeBranchUnavailableModal, removeFromCart, cart, setBottomSheetOpen } = useApp();

  const isVisible = Boolean(branchUnavailableModal?.visible);

  useEffect(() => {
    if (!isVisible) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [isVisible, setBottomSheetOpen]);

  if (!branchUnavailableModal || !branchUnavailableModal.visible) {
    return null;
  }

  const { branchName, itemNames } = branchUnavailableModal;

  const handleRemoveUnavailableFromCart = () => {
    // Remove any items matching itemNames from cart
    itemNames.forEach((name) => {
      const found = cart.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (found) {
        removeFromCart(found.id);
      }
    });
    closeBranchUnavailableModal();
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Top Banner Icon */}
          <View style={styles.iconCircle}>
            <AlertTriangle size={28} color="#D97706" />
          </View>

          <Text style={styles.title}>Item Not Available at this Branch</Text>

          <View style={styles.branchRow}>
            <MapPin size={13} color={Colors.primary} />
            <Text style={styles.branchName}>{branchName}</Text>
          </View>

          <Text style={styles.desc}>
            The following dish is currently out of stock or not served at this branch:
          </Text>

          <View style={styles.itemsList}>
            {itemNames.map((name, idx) => (
              <View key={idx} style={styles.itemBadge}>
                <Text style={styles.itemBadgeText}>• {name}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 <Text style={{ fontWeight: '800' }}>Available elsewhere:</Text> This item is available at our other branches across Pakistan!
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {cart.some((c) => itemNames.some((n) => n.toLowerCase() === c.name.toLowerCase())) && (
              <TouchableOpacity
                style={styles.removeCartBtn}
                onPress={handleRemoveUnavailableFromCart}
                activeOpacity={0.8}
              >
                <Text style={styles.removeCartBtnText}>Remove from Cart</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.okBtn}
              onPress={closeBranchUnavailableModal}
              activeOpacity={0.8}
            >
              <Text style={styles.okBtnText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '900',
    color: Colors.textMain,
    textAlign: 'center',
    marginBottom: 6,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight + '35',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    marginBottom: 12,
  },
  branchName: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  desc: {
    fontSize: 12.5,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  itemsList: {
    width: '100%',
    gap: 6,
    marginBottom: 12,
  },
  itemBadge: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  itemBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#B91C1C',
  },
  infoBox: {
    width: '100%',
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    padding: 10,
    borderRadius: 8,
    marginBottom: 18,
  },
  infoText: {
    fontSize: 11.5,
    color: Colors.textMuted,
    lineHeight: 16,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  removeCartBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeCartBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  okBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

