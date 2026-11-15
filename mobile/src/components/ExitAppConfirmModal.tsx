import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, BackHandler } from 'react-native';
import { Colors } from '../theme/colors';
import { AlertTriangle, LogOut, X } from 'lucide-react-native';

interface ExitAppConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmExit?: () => void;
}

export function ExitAppConfirmModal({
  visible,
  onClose,
  onConfirmExit,
}: ExitAppConfirmModalProps) {
  const handleExit = () => {
    onClose();
    if (onConfirmExit) {
      onConfirmExit();
    } else {
      BackHandler.exitApp();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Top Warning Icon */}
          <View style={styles.iconCircle}>
            <AlertTriangle size={28} color={Colors.primary} />
          </View>

          <Text style={styles.title}>Close Foodies Cafe?</Text>
          <Text style={styles.message}>
            Are you sure you want to close the app? Any unsaved orders or drafts may be lost.
          </Text>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelText}>No, Stay</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.exitBtn} onPress={handleExit} activeOpacity={0.8}>
              <LogOut size={15} color={Colors.textWhite} />
              <Text style={styles.exitText}>Yes, Close App</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    backgroundColor: Colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  exitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.danger,
    elevation: 2,
  },
  exitText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },
});

