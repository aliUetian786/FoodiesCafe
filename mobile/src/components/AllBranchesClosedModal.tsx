import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Branch } from '../types';
import { Clock, AlertTriangle, Utensils, X, MapPin } from 'lucide-react-native';

interface AllBranchesClosedModalProps {
  visible: boolean;
  onClose: () => void;
  onBrowseMenu?: () => void;
  branches?: Branch[];
  context?: 'home' | 'checkout_blocked';
}

export function AllBranchesClosedModal({
  visible,
  onClose,
  onBrowseMenu,
  branches = [],
  context = 'home',
}: AllBranchesClosedModalProps) {
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
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerBanner}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Clock size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>
                    {context === 'checkout_blocked' ? 'CHECKOUT UNAVAILABLE' : 'LATE NIGHT / CLOSED NOTICE'}
                  </Text>
                </View>
                <Text style={styles.titleText}>All Branches Are Closed</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.bodyWrap}>
            <Text style={styles.descText}>
              {context === 'checkout_blocked'
                ? 'All Foodies Cafe branches are currently marked closed for the day or due to late-night closing hours. You cannot proceed after the menu page with checkout right now.'
                : 'All Foodies Cafe branches are currently closed for the day or due to late-night timing. You can still browse the menu, but you cannot proceed after the menu page with checkout until branches reopen.'}
            </Text>

            <View style={styles.warningBox}>
              <AlertTriangle size={16} color="#D97706" />
              <Text style={styles.warningText}>
                Menu browsing is open, but proceeding after the menu page to checkout is disabled while all branches are closed.
              </Text>
            </View>

            {branches.length > 0 && (
              <View style={styles.branchListBox}>
                <Text style={styles.branchListHeading}>BRANCH STATUS & HOURS</Text>
                {branches.map((b) => (
                  <View key={b.id} style={styles.branchRow}>
                    <View style={styles.branchNameWrap}>
                      <MapPin size={12} color={Colors.primary} />
                      <Text style={styles.branchName}>{b.name}</Text>
                    </View>
                    <Text style={styles.branchHours}>
                      Closed ({b.openingHours || '11:00 AM - 1:00 AM'})
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Footer Buttons */}
          <View style={styles.footerRow}>
            {context === 'home' && onBrowseMenu && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  onClose();
                  onBrowseMenu();
                }}
                activeOpacity={0.85}
              >
                <Utensils size={15} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Browse Menu Only</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                (context === 'checkout_blocked' || !onBrowseMenu) && styles.primaryBtn,
              ]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.secondaryBtnText,
                  (context === 'checkout_blocked' || !onBrowseMenu) && styles.primaryBtnText,
                ]}
              >
                {context === 'checkout_blocked' ? 'Understood, Back to Menu' : 'Close'}
              </Text>
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
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    overflow: 'hidden',
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 3,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.4,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.textMain,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  bodyWrap: {
    padding: 18,
    gap: 12,
  },
  descText: {
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
    lineHeight: 16,
  },
  branchListBox: {
    padding: 11,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    gap: 6,
  },
  branchListHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  branchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  branchNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  branchName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  branchHours: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    borderWidth: 0,
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
  },
});
