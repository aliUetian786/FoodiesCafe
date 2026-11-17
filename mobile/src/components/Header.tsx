import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar as RNStatusBar } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { ShoppingBag, Utensils, Shield, Bike, User, LogOut, Building2, Bell, Wallet, ChefHat } from 'lucide-react-native';
import { MobileRole } from '../types';
import { AllBranchesClosedModal } from './AllBranchesClosedModal';
import { NotificationCenterModal } from './NotificationCenterModal';

interface HeaderProps {
  onOpenCart?: () => void;
  onNavigateHome?: () => void;
  activeScreenTitle?: string;
}

export function Header({ onOpenCart, onNavigateHome, activeScreenTitle }: HeaderProps) {
  const { role, appMode, setAppMode, logoutStaff, cartCount, setHeaderHeight, branches, unreadNotificationsCount, openNotificationModal, currentUser } = useApp();
  const [closedCartBlockedVisible, setClosedCartBlockedVisible] = useState(false);
  const allBranchesClosed = branches.length > 0 && branches.every((b) => !b.isOpen);

  const getRoleBadge = (r: MobileRole) => {
    switch (r) {
      case 'platform_owner':
        return { label: 'Owner', color: Colors.primary, icon: Shield };
      case 'branch_manager':
        return { label: 'Manager', color: '#8B5CF6', icon: Building2 };
      case 'floor_staff':
        return { label: 'Floor Staff', color: Colors.info, icon: Utensils };
      case 'delivery_staff':
        return { label: 'Rider', color: Colors.success, icon: Bike };
      case 'cashier':
        return { label: 'Cashier', color: '#16A34A', icon: Wallet };
      case 'kitchen_staff':
        return { label: 'Kitchen', color: '#EA580C', icon: ChefHat };
      case 'customer':
      default:
        return { label: 'Customer', color: Colors.warning, icon: User };
    }
  };

  const badge = getRoleBadge(role);
  // Header pill shows only the role; the person's name is shown on the first tab (StaffNameBanner).

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const measuredHeight = e.nativeEvent.layout.height;
        if (measuredHeight > 0) {
          setHeaderHeight(measuredHeight);
        }
      }}
    >
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.brandContainer}
          onPress={onNavigateHome}
          activeOpacity={0.8}
        >
          <View style={styles.brandTitleRow}>
            <Text style={styles.brandTitle}>Foodies<Text style={styles.brandHighlight}>Cafe</Text></Text>
            {appMode === 'staff' && (
              <View style={styles.staffTag}>
                <Text style={styles.staffTagText}>{badge.label.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.actionsRight}>
          {/* Customer Notification Bell */}
          {appMode === 'customer' && (
            <TouchableOpacity
              onPress={() => openNotificationModal('inbox')}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: Colors.bgSubtle,
                borderWidth: 1,
                borderColor: unreadNotificationsCount > 0 ? Colors.primaryBorder : Colors.borderColor,
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
              activeOpacity={0.75}
            >
              <Bell size={17} color={unreadNotificationsCount > 0 ? Colors.primary : Colors.textMain} />
              {unreadNotificationsCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    minWidth: 17,
                    height: 17,
                    borderRadius: 9,
                    backgroundColor: Colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                    borderWidth: 1.5,
                    borderColor: Colors.bgCard,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: Colors.textWhite }}>
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {/* Customer App: Only Cart Button (no role pill) */}
          {appMode === 'customer' && onOpenCart && (
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => {
                if (allBranchesClosed) {
                  setClosedCartBlockedVisible(true);
                  return;
                }
                onOpenCart();
              }}
              activeOpacity={0.85}
            >
              <ShoppingBag size={18} color={Colors.primary} />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Staff App: Logged In Staff Badge + Exit/Logout Button */}
          {appMode === 'staff' && (
            <View style={styles.staffHeaderActions}>
              <TouchableOpacity
                onPress={() => openNotificationModal('inbox')}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  backgroundColor: Colors.bgSubtle,
                  borderWidth: 1,
                  borderColor: unreadNotificationsCount > 0 ? Colors.primaryBorder : Colors.borderColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
                activeOpacity={0.75}
              >
                <Bell size={16} color={unreadNotificationsCount > 0 ? Colors.primary : Colors.textMain} />
                {unreadNotificationsCount > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: Colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 3,
                      borderWidth: 1.5,
                      borderColor: Colors.bgCard,
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '800', color: Colors.textWhite }}>
                      {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.staffLogoutBtn}
                onPress={() => {
                  logoutStaff();
                  setAppMode('customer');
                }}
                activeOpacity={0.8}
              >
                <LogOut size={15} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {activeScreenTitle && (
        <View style={styles.screenTitleRow}>
          <Text style={styles.screenTitle}>{activeScreenTitle}</Text>
        </View>
      )}

      <AllBranchesClosedModal
        visible={closedCartBlockedVisible}
        onClose={() => setClosedCartBlockedVisible(false)}
        branches={branches}
        context="checkout_blocked"
      />
      <NotificationCenterModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight || 0, 30) + 14 : 14,
    paddingBottom: 12,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandContainer: {
    flexDirection: 'column',
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.textMain,
    letterSpacing: -0.7,
  },
  brandHighlight: {
    color: Colors.primary,
  },
  staffTag: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  staffTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartButton: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: Colors.textWhite,
    fontSize: 10,
    fontWeight: '800',
  },
  staffHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  staticRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: Colors.bgMain,
    gap: 4,
  },
  staticRoleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  staffLogoutBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  screenTitleRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
  },
  screenTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textMain,
  },
});
