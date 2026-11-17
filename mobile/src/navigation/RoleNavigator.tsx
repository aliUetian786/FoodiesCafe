import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, BackHandler } from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { ExitAppConfirmModal } from '../components/ExitAppConfirmModal';
import { BranchShutdownModal } from '../components/BranchShutdownModal';
import { useKeyboardVisible } from '../components/KeyboardSafeModal';
import {
  Home,
  Utensils,
  Clock,
  Receipt,
  User,
  Shield,
  Building2,
  FileClock,
  ListOrdered,
  Bike,
  ChefHat,
  Users,
  Banknote,
  Megaphone,
} from 'lucide-react-native';

import { CustomerHome } from '../customer/CustomerHome';
import { CustomerMenu } from '../customer/CustomerMenu';
import { CustomerCart } from '../customer/CustomerCart';
import { CustomerTracking } from '../customer/CustomerTracking';
import { CustomerHistory } from '../customer/CustomerHistory';
import { CustomerProfile } from '../customer/CustomerProfile';

import { StaffLogin } from '../staff/StaffLogin';
import { ManagerDashboard } from '../manager/ManagerDashboard';
import { ManagerKitchenQueue } from '../manager/ManagerKitchenQueue';
import { ManagerOrdersHub } from '../manager/ManagerOrdersHub';
import { ManagerStaffManagement } from '../manager/ManagerStaffManagement';
import { ManagerFinancials } from '../manager/ManagerFinancials';
import { OwnerDashboard } from '../owner/OwnerDashboard';
import { OwnerBranches } from '../owner/OwnerBranches';
import { OwnerMenu } from '../owner/OwnerMenu';
import { OwnerAudit } from '../owner/OwnerAudit';
import { AnnouncementsBoard } from '../components/AnnouncementsBoard';
import { OwnerOrdersHistory } from '../owner/OwnerOrdersHistory';

import { FloorTablesGrid } from '../floor/FloorTablesGrid';
import { WaiterOrdersQueue } from '../floor/WaiterOrdersQueue';
import { FloorWalkInOrder } from '../floor/FloorWalkInOrder';

import { RiderConsole } from '../rider/RiderConsole';
import { RiderHistory } from '../rider/RiderHistory';

interface RoleNavigatorProps {
  onOpenCart?: () => void;
  navigateHomeTrigger?: number;
  navigateTrackingTrigger?: number;
  isCartOpen?: boolean;
  onCloseCart?: () => void;
}

export function RoleNavigator({
  onOpenCart,
  navigateHomeTrigger,
  navigateTrackingTrigger,
  isCartOpen,
  onCloseCart,
}: RoleNavigatorProps) {
  const {
    role,
    appMode,
    staffUser,
    customerUser,
    setAppMode,
    staffLoginCounter,
    customerLoginCounter,
    isBottomSheetOpen,
    isNotificationModalOpen,
    shutdownModalState,
    closeShutdownModal,
    confirmShutdownKeepProcessing,
    confirmShutdownCancelOrders,
  } = useApp();

  const [customerTab, setCustomerTab] = useState<'home' | 'menu' | 'tracking' | 'history' | 'profile'>('home');
  const [ownerTab, setOwnerTab] = useState<'dashboard' | 'branches' | 'menu' | 'staff' | 'audit' | 'orders' | 'announcements'>('dashboard');
  const [ownerOrdersFilter, setOwnerOrdersFilter] = useState<'all' | 'pending'>('all');
  const [managerTab, setManagerTab] = useState<'dashboard' | 'kitchen' | 'orders' | 'staff' | 'financials' | 'tables' | 'menu' | 'announcements'>('dashboard');
  const [cashierTab, setCashierTab] = useState<'financials' | 'orders' | 'walkin' | 'menu'>('orders');
  const [floorTab, setFloorTab] = useState<'waiter' | 'tables' | 'orders' | 'walkin'>('waiter');
  const [riderTab, setRiderTab] = useState<'console' | 'history'>('console');
  const [exitModalVisible, setExitModalVisible] = useState(false);
  // Hide the bottom tab bar while typing so the lifted input has the room above the keyboard.
  const keyboardVisible = useKeyboardVisible();

  // Always reset all staff role tabs to their initial first option (Home/Overview type)
  const resetAllStaffRoleTabs = () => {
    setOwnerTab('dashboard');
    setManagerTab('dashboard');
    setCashierTab('orders');
    setFloorTab('waiter');
    setRiderTab('console');
  };

  // Whenever any staff member logs in to any staff ID, logs out, or switches profile:
  // strictly enforce opening the first option for each profile rather than the last previous option
  useEffect(() => {
    resetAllStaffRoleTabs();
  }, [staffLoginCounter, staffUser?.id, staffUser?.role]);

  // Whenever any customer logs in or signs up:
  // strictly enforce opening 'home' (the first option of the customer profile), never the last open option
  useEffect(() => {
    setCustomerTab('home');
    if (onCloseCart) {
      onCloseCart();
    }
  }, [customerLoginCounter]);

  // When switching app modes (customer vs staff):
  // always open the first option for that profile
  useEffect(() => {
    if (appMode === 'customer') {
      setCustomerTab('home');
    } else {
      resetAllStaffRoleTabs();
    }
  }, [appMode]);

  // Hardware Back Button Step-by-Step Navigation & Exit Confirmation
  useEffect(() => {
    const onBackPress = () => {
      // 1. If cart modal is open, close it first
      if (isCartOpen && onCloseCart) {
        onCloseCart();
        return true;
      }

      // 2. Customer App navigation: step back to 'home' first, then prompt exit
      if (appMode === 'customer') {
        if (customerTab !== 'home') {
          setCustomerTab('home');
          return true;
        } else {
          setExitModalVisible(true);
          return true;
        }
      }

      // 3. Staff App navigation: step back to role main dashboard first, then prompt exit
      if (appMode === 'staff') {
        if (!staffUser) {
          // Unauthenticated staff login screen: go back to customer mode or exit
          setAppMode('customer');
          return true;
        }

        if (role === 'platform_owner') {
          if (ownerTab !== 'dashboard') {
            setOwnerTab('dashboard');
            return true;
          } else {
            setExitModalVisible(true);
            return true;
          }
        }

        if (role === 'branch_manager') {
          if (managerTab !== 'dashboard') {
            setManagerTab('dashboard');
            return true;
          } else {
            setExitModalVisible(true);
            return true;
          }
        }

        if (role === 'floor_staff') {
          if (floorTab === 'walkin' || floorTab === 'tables' || floorTab === 'orders') {
            setFloorTab('waiter');
            return true;
          } else {
            setExitModalVisible(true);
            return true;
          }
        }

        if (role === 'delivery_staff') {
          if (riderTab === 'history') {
            setRiderTab('console');
            return true;
          } else {
            setExitModalVisible(true);
            return true;
          }
        }

        if (role === 'kitchen_staff') {
          setExitModalVisible(true);
          return true;
        }
      }

      setExitModalVisible(true);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [
    isCartOpen,
    onCloseCart,
    appMode,
    customerTab,
    staffUser,
    role,
    ownerTab,
    managerTab,
    floorTab,
    riderTab,
    setAppMode,
  ]);

  // Navigate back to Home screen whenever user presses the FoodiesCafe header brand title
  useEffect(() => {
    if (navigateHomeTrigger && navigateHomeTrigger > 0) {
      setCustomerTab('home');
      setOwnerTab('dashboard');
      setManagerTab('dashboard');
      setFloorTab('waiter');
      setRiderTab('console');
    }
  }, [navigateHomeTrigger]);

  // Navigate to Tracking screen whenever an order is placed from CustomerCart
  useEffect(() => {
    if (navigateTrackingTrigger && navigateTrackingTrigger > 0) {
      setCustomerTab('tracking');
    }
  }, [navigateTrackingTrigger]);

  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [walkInTableNumber, setWalkInTableNumber] = useState<string | undefined>('T-01');

  const openCart = onOpenCart || (() => setCartModalVisible(true));
  const isAnyModalOpen = Boolean(
    isCartOpen ||
      cartModalVisible ||
      isBottomSheetOpen ||
      isNotificationModalOpen ||
      shutdownModalState.visible ||
      exitModalVisible
  );

  // Customer Navigation Tabs
  const customerTabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'menu', label: 'Menu', icon: Utensils },
    { id: 'tracking', label: 'Tracking', icon: Clock },
    { id: 'history', label: 'History', icon: Receipt },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  // Owner Navigation Tabs
  const ownerTabs = [
    { id: 'dashboard', label: 'Overview', icon: Shield },
    { id: 'branches', label: 'Branches', icon: Building2 },
    { id: 'menu', label: 'Menu & Prices', icon: Utensils },
    { id: 'staff', label: 'Staff Team', icon: Users },
    { id: 'audit', label: 'Audit Log', icon: FileClock },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
  ];

  // Manager Navigation Tabs
  const managerTabs = [
    { id: 'dashboard', label: 'Overview', icon: Building2 },
    { id: 'orders', label: 'Orders', icon: Receipt },
    { id: 'staff', label: 'Staff Team', icon: Users },
    { id: 'financials', label: 'Cash Desk', icon: Banknote },
    { id: 'menu', label: 'Menu Stock', icon: ListOrdered },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
  ];

  // Cashier Navigation Tabs
  const cashierTabs = [
    { id: 'orders', label: 'Orders Hub', icon: Receipt },
    { id: 'financials', label: 'Cash Desk', icon: Banknote },
    { id: 'walkin', label: 'Walk-In Order', icon: Utensils },
    { id: 'menu', label: 'Menu Stock', icon: ListOrdered },
  ];

  // Kitchen Staff Navigation Tabs
  const kitchenTabs = [
    { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
  ];

  // Floor Staff Navigation Tabs (Waiter Orders 1st, Floor Tables 2nd, Orders Hub 3rd, Walk-in Order 4th)
  const floorTabs = [
    { id: 'waiter', label: 'Waiter Orders', icon: ListOrdered },
    { id: 'tables', label: 'Floor Tables', icon: Utensils },
    { id: 'orders', label: 'Orders Hub', icon: Receipt },
    { id: 'walkin', label: 'Walk-in Order', icon: Home },
  ];

  // Rider Navigation Tabs
  const riderTabs = [
    { id: 'console', label: 'Deliveries', icon: Bike },
    { id: 'history', label: 'History', icon: Receipt },
  ];

  // If in Staff App and not signed in: show Staff Login directly
  if (appMode === 'staff' && !staffUser) {
    return (
      <View style={styles.container}>
        <StaffLogin />
        <ExitAppConfirmModal
          visible={exitModalVisible}
          onClose={() => setExitModalVisible(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.screenContent}>
        {/* ================= CUSTOMER APP ================= */}
        {appMode === 'customer' && (
          <>
            {customerTab === 'home' && (
              <CustomerHome onNavigateToMenu={() => setCustomerTab('menu')} />
            )}
            {customerTab === 'menu' && (
              <CustomerMenu onOpenCheckout={openCart} />
            )}
            {customerTab === 'tracking' && (
              <CustomerTracking
                onBackToMenu={() => setCustomerTab('menu')}
                onViewHistory={() => setCustomerTab('history')}
              />
            )}
            {customerTab === 'history' && (
              <CustomerHistory
                onReorder={() => setCustomerTab('menu')}
                onViewTracking={() => setCustomerTab('tracking')}
              />
            )}
            {customerTab === 'profile' && <CustomerProfile />}
          </>
        )}

        {/* ================= STAFF APP ================= */}
        {appMode === 'staff' && (
          <>
            {/* PLATFORM OWNER */}
            {role === 'platform_owner' && (
              <>
                {ownerTab === 'dashboard' && (
                  <OwnerDashboard
                    onNavigateToBranches={() => setOwnerTab('branches')}
                    onNavigateToMenu={() => setOwnerTab('menu')}
                    onNavigateToStaff={() => setOwnerTab('staff')}
                    onNavigateToAudit={() => setOwnerTab('audit')}
                    onNavigateToOrders={(filter) => {
                      setOwnerOrdersFilter(filter || 'all');
                      setOwnerTab('orders');
                    }}
                  />
                )}
                {ownerTab === 'branches' && <OwnerBranches />}
                {ownerTab === 'menu' && <OwnerMenu />}
                {ownerTab === 'staff' && <ManagerStaffManagement allowAllBranches={true} />}
                {ownerTab === 'audit' && <OwnerAudit />}
                {ownerTab === 'announcements' && <AnnouncementsBoard />}
                {ownerTab === 'orders' && (
                  <OwnerOrdersHistory
                    onBack={() => setOwnerTab('dashboard')}
                    initialFilter={ownerOrdersFilter}
                  />
                )}
              </>
            )}

            {/* BRANCH MANAGER */}
            {role === 'branch_manager' && (
              <>
                {managerTab === 'dashboard' && (
                  <ManagerDashboard
                    onNavigateToKitchen={() => setManagerTab('kitchen')}
                    onNavigateToOrders={() => setManagerTab('orders')}
                    onNavigateToTables={() => setManagerTab('tables')}
                    onNavigateToStaff={() => setManagerTab('staff')}
                    onNavigateToFinancials={() => setManagerTab('financials')}
                    onNavigateToMenu={() => setManagerTab('menu')}
                  />
                )}
                {managerTab === 'kitchen' && <ManagerKitchenQueue />}
                {managerTab === 'orders' && <ManagerOrdersHub />}
                {managerTab === 'staff' && <ManagerStaffManagement />}
                {managerTab === 'financials' && <ManagerFinancials />}
                {managerTab === 'tables' && (
                  <FloorTablesGrid
                    onBack={() => setManagerTab('dashboard')}
                    onOpenWalkIn={(tbl) => {
                      setWalkInTableNumber(tbl);
                    }}
                  />
                )}
                {managerTab === 'menu' && <OwnerMenu />}
                {managerTab === 'announcements' && <AnnouncementsBoard />}
              </>
            )}

            {/* CASHIER */}
            {role === 'cashier' && (
              <>
                {cashierTab === 'financials' && <ManagerFinancials />}
                {cashierTab === 'orders' && <ManagerOrdersHub />}
                {cashierTab === 'walkin' && (
                  <FloorWalkInOrder
                    initialTableNumber={walkInTableNumber}
                    onOrderDispatched={() => setCashierTab('orders')}
                    onBack={() => setCashierTab('orders')}
                  />
                )}
                {cashierTab === 'menu' && <OwnerMenu />}
              </>
            )}

            {/* FLOOR STAFF */}
            {role === 'floor_staff' && (
              <>
                {floorTab === 'waiter' && (
                  <WaiterOrdersQueue
                    onOpenWalkIn={() => {
                      setWalkInTableNumber(undefined);
                      setFloorTab('walkin');
                    }}
                    onNavigateToTables={() => setFloorTab('tables')}
                  />
                )}
                {floorTab === 'tables' && (
                  <FloorTablesGrid
                    onOpenWalkIn={(tbl) => {
                      setWalkInTableNumber(tbl);
                      setFloorTab('walkin');
                    }}
                    onNavigateToQueue={() => setFloorTab('waiter')}
                  />
                )}
                {floorTab === 'orders' && <ManagerOrdersHub isFloorStaff={true} />}
                {floorTab === 'walkin' && (
                  <FloorWalkInOrder
                    initialTableNumber={walkInTableNumber}
                    onOrderDispatched={() => setFloorTab('waiter')}
                    onBack={() => setFloorTab('waiter')}
                  />
                )}
              </>
            )}

            {/* KITCHEN STAFF */}
            {role === 'kitchen_staff' && (
              <ManagerKitchenQueue />
            )}

            {/* DELIVERY RIDER */}
            {role === 'delivery_staff' && (
              <>
                {riderTab === 'console' && (
                  <RiderConsole onNavigateToHistory={() => setRiderTab('history')} />
                )}
                {riderTab === 'history' && <RiderHistory />}
              </>
            )}
          </>
        )}
      </View>

      {/* Dynamic Role Bottom Navigation Bar (Hidden when any modal/bottom sheet is active) */}
      {!isAnyModalOpen && !keyboardVisible && (
        <View style={styles.bottomNavContainer}>
          {appMode === 'customer' && (
            <View style={styles.bottomNav}>
              {customerTabs.map((tab) => {
                const isActive = customerTab === tab.id;
                const IconComp = tab.icon;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={styles.navTab}
                    onPress={() => setCustomerTab(tab.id as any)}
                  >
                    <IconComp size={18} color={isActive ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {appMode === 'staff' && role === 'platform_owner' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bottomNavScroll}
            >
              {ownerTabs.map((tab) => {
                const isActive = ownerTab === tab.id;
                const IconComp = tab.icon;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={styles.navTabScrollable}
                    onPress={() => setOwnerTab(tab.id as any)}
                  >
                    <IconComp size={18} color={isActive ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {appMode === 'staff' && role === 'branch_manager' && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.bottomNavScroll}
            >
              {managerTabs.map((tab) => {
                const isActive = managerTab === tab.id;
                const IconComp = tab.icon;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={styles.navTabScrollable}
                    onPress={() => setManagerTab(tab.id as any)}
                  >
                    <IconComp size={18} color={isActive ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {appMode === 'staff' && role === 'cashier' && (
            <View style={styles.bottomNav}>
              {cashierTabs.map((tab) => {
                const isActive = cashierTab === tab.id;
                const IconComp = tab.icon;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={styles.navTab}
                    onPress={() => setCashierTab(tab.id as any)}
                  >
                    <IconComp size={18} color={isActive ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {appMode === 'staff' && role === 'kitchen_staff' && (
            <View style={styles.bottomNav}>
              {kitchenTabs.map((tab) => {
                const IconComp = tab.icon;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={styles.navTab}
                    activeOpacity={0.8}
                  >
                    <IconComp size={18} color={Colors.primary} />
                    <Text style={[styles.navLabel, styles.navLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {appMode === 'staff' && role === 'floor_staff' && (
            <View style={styles.bottomNav}>
              {floorTabs.map((tab) => {
                const isActive = floorTab === tab.id;
                const IconComp = tab.icon;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={styles.navTab}
                    onPress={() => setFloorTab(tab.id as any)}
                  >
                    <IconComp size={18} color={isActive ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {appMode === 'staff' && role === 'delivery_staff' && (
            <View style={styles.bottomNav}>
              {riderTabs.map((tab) => {
                const isActive = riderTab === tab.id;
                const IconComp = tab.icon;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={styles.navTab}
                    onPress={() => setRiderTab(tab.id as any)}
                  >
                    <IconComp size={18} color={isActive ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Cart Modal Fallback */}
      {!onOpenCart && (
        <CustomerCart
          visible={cartModalVisible}
          onClose={() => setCartModalVisible(false)}
          onOrderPlaced={() => setCustomerTab('tracking')}
        />
      )}

      {/* Exit App Confirmation Modal */}
      <ExitAppConfirmModal
        visible={exitModalVisible}
        onClose={() => setExitModalVisible(false)}
      />

      {/* Branch Shutdown Confirmation Modal (Manager/Owner) */}
      <BranchShutdownModal
        visible={shutdownModalState.visible}
        branch={shutdownModalState.branch}
        pendingOrders={shutdownModalState.pendingOrders}
        onCancelAction={closeShutdownModal}
        onContinueProcessing={confirmShutdownKeepProcessing}
        onCancelOrdersAndShut={confirmShutdownCancelOrders}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgMain },
  screenContent: { flex: 1 },
  bottomNavContainer: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    elevation: 8,
  },
  bottomNav: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  bottomNavScroll: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  navTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  navTabScrollable: {
    minWidth: 64,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  navLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  navLabelActive: { color: Colors.primary },
});
