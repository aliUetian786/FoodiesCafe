import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { KeyboardSafeModal as Modal } from './KeyboardSafeModal';
import {
  Bell,
  X,
  Send,
  CheckCheck,
  Trash2,
  ShoppingBag,
  Utensils,
  Truck,
  ChefHat,
  Megaphone,
  Info,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Smartphone,
  Globe,
  Users,
  UserCheck,
  ShieldCheck,
  Save,
} from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import {
  AppNotification,
  MobileRole,
  NotificationCategory,
  NotificationTargetPlatform,
  NotificationEventKey,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_RECIPIENT_NOTIFICATION_RULES,
  RecipientNotificationRules,
  ReceiverNotificationPreferences,
  DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES,
  Order,
} from '../types';

type InboxFilter = 'all' | 'unread' | NotificationCategory;
type SenderTargetMode = 'everyone' | 'only_app' | 'only_web' | 'only_staff' | 'only_order_owner';

const ALL_STAFF_ROLES: Array<{ role: MobileRole; label: string }> = [
  { role: 'branch_manager', label: 'Branch Managers' },
  { role: 'cashier', label: 'Cashiers' },
  { role: 'kitchen_staff', label: 'Kitchen Staff' },
  { role: 'floor_staff', label: 'Floor Waiters' },
  { role: 'delivery_staff', label: 'Delivery Riders' },
];

const NOTIFICATION_EVENT_RULES: Array<{
  key: NotificationEventKey;
  label: string;
  description: string;
}> = [
    { key: 'orderPlaced', label: 'Order Placed / Confirmed', description: 'Sent immediately when a new order is placed.' },
    { key: 'sentToKitchen', label: 'Sent to Kitchen', description: 'Alerts kitchen & order owner when queued.' },
    { key: 'cooking', label: 'Cooking in Kitchen', description: 'Notifies guest & team when preparation starts.' },
    { key: 'orderReady', label: 'Order Ready', description: 'Ready for counter pickup, table serve, or dispatch.' },
    { key: 'outForDelivery', label: 'Out for Delivery', description: 'Alerts customer when rider is on the way.' },
    { key: 'orderServed', label: 'Order Served (Dine-In)', description: 'Confirms dine-in meal has reached table.' },
    { key: 'orderCompleted', label: 'Order Completed / Delivered', description: 'Final delivery or completion confirmation.' },
    { key: 'orderCancelled', label: 'Order Cancelled', description: 'Alerts customer and assigned rider/waiter.' },
    { key: 'waiterAssigned', label: 'Waiter Assigned (Dine-In)', description: 'Notifies concerned waiter & guest on table setup.' },
    { key: 'riderAssigned', label: 'Rider Assigned (Delivery)', description: 'Notifies concerned rider & customer on dispatch.' },
    { key: 'paymentReceived', label: 'Payment Received / Settled', description: 'Confirms cash or digital settlement.' },
  ];

const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; bg: string; border: string; text: string }
> = {
  order_placed: { label: 'Order Placed', bg: Colors.infoLight, border: Colors.infoBorder, text: Colors.info },
  takeaway: { label: 'Takeaway', bg: Colors.primaryLight, border: Colors.primaryBorder, text: Colors.primary },
  dine_in: { label: 'Dine-In', bg: Colors.successLight, border: Colors.successBorder, text: Colors.success },
  delivery: { label: 'Delivery', bg: Colors.infoLight, border: Colors.infoBorder, text: Colors.info },
  kitchen: { label: 'Kitchen', bg: Colors.warningLight, border: Colors.warningBorder, text: Colors.warning },
  staff_alert: { label: 'Staff Alert', bg: Colors.warningLight, border: Colors.warningBorder, text: Colors.warning },
  promo: { label: 'Promo', bg: Colors.primaryLight, border: Colors.primaryBorder, text: Colors.primary },
  system: { label: 'System', bg: Colors.bgSubtle, border: Colors.borderColor, text: Colors.textSecondary },
};

function formatNotifTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function NotificationCenterModal() {
  const {
    role,
    appMode,
    currentUser,
    customerUser,
    currentBranch,
    branches,
    orders,
    notifications,
    unreadNotificationsCount,
    notificationSettings,
    updateNotificationSettings,
    activeReceiverKey,
    myNotificationSettings,
    updateMyNotificationSettings,
    isNotificationModalOpen,
    setIsNotificationModalOpen,
    notificationModalDefaultTab,
    prefillNotificationOrder,
    sendNotification,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    setBottomSheetOpen,
    showToast,
  } = useApp();

  React.useEffect(() => {
    if (!isNotificationModalOpen) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [isNotificationModalOpen, setBottomSheetOpen]);

  const currentBranchId = currentBranch?.id || 'gulberg-lahore';

  const canSend =
    appMode === 'staff' &&
    (role === 'platform_owner' || role === 'branch_manager' || role === 'cashier');
  const canManageRules = canSend;
  const isOwner = appMode === 'staff' && role === 'platform_owner';

  const [activeTab, setActiveTab] = useState<'inbox' | 'send' | 'settings'>('inbox');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');

  // Compose form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<NotificationCategory>('takeaway');
  const [severity, setSeverity] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [targetBranchId, setTargetBranchId] = useState<string>(
    role === 'platform_owner' ? 'all' : currentBranchId
  );
  const [targetMode, setTargetMode] = useState<SenderTargetMode>('everyone');
  const [selectedStaffRoles, setSelectedStaffRoles] = useState<MobileRole[]>([
    'branch_manager',
    'cashier',
    'kitchen_staff',
    'floor_staff',
    'delivery_staff',
  ]);
  const [orderOwnerPlatform, setOrderOwnerPlatform] = useState<NotificationTargetPlatform>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [sending, setSending] = useState(false);

  // Manage rules state
  const [rulesScope, setRulesScope] = useState<'my' | 'global'>(canSend ? 'global' : 'my');
  const [rulesDraft, setRulesDraft] = useState<NotificationSettings>(
    notificationSettings || DEFAULT_NOTIFICATION_SETTINGS
  );
  const [myRulesDraft, setMyRulesDraft] = useState<ReceiverNotificationPreferences>(
    myNotificationSettings || DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES
  );
  const [savingRules, setSavingRules] = useState(false);
  const isEditingRulesRef = useRef<boolean>(false);
  const isEditingMyRulesRef = useRef<boolean>(false);

  const userReadKeys = useMemo(() => {
    const keys: string[] = [];
    if (appMode === 'customer' || role === 'customer') {
      keys.push(customerUser?.id || customerUser?.phone || 'customer-guest');
    } else {
      keys.push(currentUser?.id || `staff-${role}`);
    }
    if (currentUser?.id) keys.push(currentUser.id);
    if (customerUser?.phone) keys.push(customerUser.phone);
    return keys;
  }, [appMode, role, customerUser?.id, customerUser?.phone, currentUser?.id]);

  const isUnread = (n: AppNotification) => {
    const readBy = Array.isArray(n.readBy) ? n.readBy : [];
    return !userReadKeys.some((k) => readBy.includes(k));
  };

  const activeBranchOrders = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'delivered')
      .filter((o) => role === 'platform_owner' || !o.branchId || o.branchId === currentBranchId)
      .slice(0, 12);
  }, [orders, role, currentBranchId]);

  const selectedOrder: Order | undefined = useMemo(
    () => orders.find((o) => o.id === selectedOrderId),
    [orders, selectedOrderId]
  );

  const applyOrderContext = (ord: Order) => {
    setSelectedOrderId(ord.id);
    setTargetBranchId(ord.branchId || currentBranchId);
    setTargetMode('only_order_owner');
    if (ord.type === 'takeaway') {
      setCategory('takeaway');
      setSeverity('success');
      setTitle(`Takeaway Order #${ord.orderNumber} Update`);
      setMessage(
        `Hi ${ord.customerName || 'Guest'}, your Takeaway order #${ord.orderNumber} is ready at the counter for pickup!`
      );
    } else if (ord.type === 'dine_in') {
      setCategory('dine_in');
      setSeverity('info');
      setTitle(`Dine-In Table ${ord.tableNumber || '-'} • #${ord.orderNumber}`);
      setMessage(
        `Update for Table ${ord.tableNumber || '-'} (#${ord.orderNumber}): your order is being served shortly.`
      );
    } else {
      setCategory('delivery');
      setSeverity('info');
      setTitle(`Delivery Update • Order #${ord.orderNumber}`);
      setMessage(
        `Hi ${ord.customerName || 'Guest'}, your delivery order #${ord.orderNumber} is on the move!`
      );
    }
  };

  useEffect(() => {
    if (!isNotificationModalOpen) {
      isEditingRulesRef.current = false;
      return;
    }
    if (!isEditingRulesRef.current) {
      setRulesDraft({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...notificationSettings,
        events: {
          ...DEFAULT_NOTIFICATION_SETTINGS.events,
          ...(notificationSettings?.events || {}),
        },
        recipientRules: {
          customer: {
            ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.customer,
            ...(notificationSettings?.recipientRules?.customer || {}),
          },
          rider: {
            ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.rider,
            ...(notificationSettings?.recipientRules?.rider || {}),
          },
          waiter: {
            ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.waiter,
            ...(notificationSettings?.recipientRules?.waiter || {}),
          },
          kitchen: {
            ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.kitchen,
            ...(notificationSettings?.recipientRules?.kitchen || {}),
          },
          cashierAndManager: {
            ...DEFAULT_RECIPIENT_NOTIFICATION_RULES.cashierAndManager,
            ...(notificationSettings?.recipientRules?.cashierAndManager || {}),
          },
        },
      });
    }
  }, [notificationSettings, isNotificationModalOpen]);

  useEffect(() => {
    if (!isNotificationModalOpen) {
      isEditingMyRulesRef.current = false;
      return;
    }
    if (!isEditingMyRulesRef.current) {
      setMyRulesDraft({
        ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES,
        ...myNotificationSettings,
        events: {
          ...DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES.events,
          ...(myNotificationSettings?.events || {}),
        },
      });
    }
  }, [myNotificationSettings, isNotificationModalOpen]);

  useEffect(() => {
    if (!isNotificationModalOpen) return;
    if (notificationModalDefaultTab === 'settings') {
      setActiveTab('settings');
      if (!canSend) setRulesScope('my');
    } else {
      setActiveTab(canSend ? notificationModalDefaultTab : 'inbox');
    }
    setTargetBranchId(role === 'platform_owner' ? 'all' : currentBranchId);
    setOrderOwnerPlatform('all');
    if (prefillNotificationOrder && canSend) {
      applyOrderContext(prefillNotificationOrder);
    } else {
      setSelectedOrderId('');
      setTargetMode('everyone');
      setSelectedStaffRoles(['branch_manager', 'cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff']);
    }
  }, [isNotificationModalOpen, notificationModalDefaultTab, prefillNotificationOrder, canSend, role, currentBranchId]);

  const filteredInbox = useMemo(() => {
    return notifications.filter((n) => {
      if (inboxFilter === 'all') return true;
      if (inboxFilter === 'unread') return isUnread(n);
      return n.category === inboxFilter;
    });
  }, [notifications, inboxFilter, userReadKeys]);

  const toggleStaffRole = (val: MobileRole) => {
    setSelectedStaffRoles((prev) =>
      prev.includes(val) ? prev.filter((r) => r !== val) : [...prev, val]
    );
  };

  const applyTemplate = (tpl: 'takeaway' | 'placed' | 'dine_in' | 'delivery' | 'kitchen' | 'staff') => {
    const orderTag = selectedOrder ? ` #${selectedOrder.orderNumber}` : '';
    if (tpl === 'takeaway') {
      setCategory('takeaway');
      setSeverity('success');
      setTargetMode(selectedOrder ? 'only_order_owner' : 'everyone');
      setTitle(`Takeaway Ready${orderTag}`);
      setMessage(
        selectedOrder
          ? `Hi ${selectedOrder.customerName || 'Guest'}, your Takeaway parcel #${selectedOrder.orderNumber} is hot and ready at the counter.`
          : 'Your Takeaway order is freshly packed and ready for collection at the pickup counter!'
      );
    } else if (tpl === 'placed') {
      setCategory('order_placed');
      setSeverity('info');
      setTargetMode(selectedOrder ? 'only_order_owner' : 'everyone');
      setTitle(`Order Confirmed${orderTag}`);
      setMessage(
        selectedOrder
          ? `Order #${selectedOrder.orderNumber} has been confirmed and queued in the kitchen.`
          : 'Your order has been placed and is now being prepared by our kitchen team.'
      );
    } else if (tpl === 'dine_in') {
      setCategory('dine_in');
      setSeverity('success');
      if (selectedOrder) {
        setTargetMode('only_order_owner');
      } else {
        setTargetMode('only_staff');
        setSelectedStaffRoles(['floor_staff']);
      }
      setTitle(`Dine-In Ready${orderTag}`);
      setMessage(
        selectedOrder
          ? `Table ${selectedOrder.tableNumber || '-'} order #${selectedOrder.orderNumber} is ready to be served hot.`
          : 'Dine-In order is ready at the pass — Floor Waiters please serve immediately.'
      );
    } else if (tpl === 'delivery') {
      setCategory('delivery');
      setSeverity('info');
      setTargetMode(selectedOrder ? 'only_order_owner' : 'everyone');
      setTitle(`Delivery Dispatched${orderTag}`);
      setMessage(
        selectedOrder
          ? `Rider has departed with Delivery Order #${selectedOrder.orderNumber} for ${selectedOrder.customerName || 'customer'}.`
          : 'Your delivery rider is on the way with your fresh order!'
      );
    } else if (tpl === 'kitchen') {
      setCategory('kitchen');
      setSeverity('warning');
      setTargetMode('only_staff');
      setSelectedStaffRoles(['kitchen_staff']);
      setTitle('Kitchen Priority Alert');
      setMessage('Rush queue alert: Prioritize active Takeaway & Delivery parcels immediately.');
    } else {
      setCategory('staff_alert');
      setSeverity('warning');
      setTargetMode('only_staff');
      setSelectedStaffRoles(
        role === 'platform_owner'
          ? ['branch_manager', 'cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff']
          : ['cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff']
      );
      setTitle('Branch Staff Briefing');
      setMessage('Please review active counter, kitchen, and rider handoff queues.');
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim() || sending) return;
    if (targetMode === 'only_order_owner' && !selectedOrder) return;
    setSending(true);
    try {
      let effectiveRoles: Array<MobileRole | 'all'> = ['all'];
      let targetPlatform: NotificationTargetPlatform = 'all';
      let targetUserId: string | undefined;
      let targetCustomerPhone: string | undefined;
      let targetCustomerName: string | undefined;
      let targetWaiterId: string | undefined;
      let targetWaiterName: string | undefined;
      let targetRiderId: string | undefined;
      let targetRiderName: string | undefined;

      if (targetMode === 'everyone') {
        targetPlatform = 'all';
        effectiveRoles = ['all'];
      } else if (targetMode === 'only_app') {
        targetPlatform = 'app';
        effectiveRoles = ['customer'];
      } else if (targetMode === 'only_web') {
        targetPlatform = 'web';
        effectiveRoles = ['customer'];
      } else if (targetMode === 'only_staff') {
        targetPlatform = 'all';
        effectiveRoles =
          selectedStaffRoles.length > 0
            ? selectedStaffRoles
            : ['branch_manager', 'cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff'];
      } else if (targetMode === 'only_order_owner' && selectedOrder) {
        targetPlatform = orderOwnerPlatform;
        targetUserId = selectedOrder.customerId;
        targetCustomerPhone = selectedOrder.customerPhone;
        targetCustomerName = selectedOrder.customerName;

        if (selectedOrder.type === 'delivery') {
          effectiveRoles = ['customer', 'delivery_staff'];
          targetRiderId = selectedOrder.assignedRiderId;
          targetRiderName = selectedOrder.assignedRiderName;
        } else if (selectedOrder.type === 'dine_in') {
          effectiveRoles = ['customer', 'floor_staff'];
          targetWaiterId = selectedOrder.assignedWaiterId;
          targetWaiterName = selectedOrder.assignedWaiterName;
        } else {
          effectiveRoles = ['customer'];
        }
      }

      await sendNotification({
        title: title.trim(),
        message: message.trim(),
        type: severity,
        category,
        branchId: targetBranchId,
        orderId: selectedOrder?.id,
        orderNumber: selectedOrder?.orderNumber,
        orderType: selectedOrder?.type,
        targetRoles: effectiveRoles,
        targetPlatform,
        targetUserId,
        targetCustomerPhone,
        targetCustomerName,
        targetWaiterId,
        targetWaiterName,
        targetRiderId,
        targetRiderName,
      });
      setTitle('');
      setMessage('');
      setSelectedOrderId('');
      setActiveTab('inbox');
    } finally {
      setSending(false);
    }
  };

  const changeRulesDraft = (updater: React.SetStateAction<NotificationSettings>) => {
    isEditingRulesRef.current = true;
    setRulesDraft(updater);
  };

  const changeMyRulesDraft = (updater: React.SetStateAction<ReceiverNotificationPreferences>) => {
    isEditingMyRulesRef.current = true;
    setMyRulesDraft(updater);
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      if (rulesScope === 'my' || !canSend) {
        const ok = await updateMyNotificationSettings(myRulesDraft, activeReceiverKey);
        if (ok !== false) {
          isEditingMyRulesRef.current = false;
          showToast('Notification preferences saved successfully!', 'success');
        }
      } else {
        const ok = await updateNotificationSettings(rulesDraft);
        if (ok !== false) {
          isEditingRulesRef.current = false;
          showToast('Global notification rules updated!', 'success');
        }
      }
    } finally {
      setSavingRules(false);
    }
  };

  const setAllEventRules = (enabled: boolean) => {
    if (rulesScope === 'my' || !canSend) {
      isEditingMyRulesRef.current = true;
      changeMyRulesDraft((prev) => ({
        ...prev,
        events: Object.keys(prev.events).reduce((acc, k) => {
          acc[k as NotificationEventKey] = enabled;
          return acc;
        }, {} as Record<NotificationEventKey, boolean>),
      }));
      return;
    }
    isEditingRulesRef.current = true;
    const nextRecipientRules: RecipientNotificationRules = {
      customer: {
        orderPlaced: enabled,
        cooking: enabled,
        orderReady: enabled,
        outForDelivery: enabled,
        orderCompleted: enabled,
        orderCancelled: enabled,
      },
      rider: {
        orderAssigned: enabled,
        orderReady: enabled,
        orderCancelled: enabled,
      },
      waiter: {
        orderAssigned: enabled,
        orderReady: enabled,
        orderCancelled: enabled,
      },
      kitchen: {
        newOrderPlaced: enabled,
        orderCancelled: enabled,
      },
      cashierAndManager: {
        orderPlaced: enabled,
        orderCancelled: enabled,
        paymentReceived: enabled,
      },
    };
    changeRulesDraft((prev) => ({
      ...prev,
      notifyCustomer: enabled,
      notifyConcernedRider: enabled,
      notifyConcernedWaiter: enabled,
      notifyKitchen: enabled,
      notifyCashierAndManager: enabled,
      events: Object.keys(prev.events).reduce((acc, k) => {
        acc[k as NotificationEventKey] = enabled;
        return acc;
      }, {} as Record<NotificationEventKey, boolean>),
      recipientRules: nextRecipientRules,
    }));
  };

  const renderCategoryIcon = (cat: NotificationCategory, color: string) => {
    if (cat === 'takeaway') return <ShoppingBag size={13} color={color} />;
    if (cat === 'dine_in') return <Utensils size={13} color={color} />;
    if (cat === 'delivery') return <Truck size={13} color={color} />;
    if (cat === 'kitchen') return <ChefHat size={13} color={color} />;
    if (cat === 'staff_alert' || cat === 'promo') return <Megaphone size={13} color={color} />;
    if (cat === 'order_placed') return <CheckCircle2 size={13} color={color} />;
    return <Info size={13} color={color} />;
  };

  return (
    <Modal
      visible={isNotificationModalOpen}
      animationType="slide"
      transparent
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={() => setIsNotificationModalOpen(false)}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={() => setIsNotificationModalOpen(false)}
        />
        <View style={styles.sheet}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleGroup}>
              <View style={styles.bellCircle}>
                <Bell size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Notification Center</Text>
                <Text style={styles.modalSubtitle}>
                  {unreadNotificationsCount > 0
                    ? `${unreadNotificationsCount} unread alert${unreadNotificationsCount > 1 ? 's' : ''}`
                    : 'All caught up'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setIsNotificationModalOpen(false)}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tabs for all receivers (Inbox + Personal Rules; plus Send & Global Rules for Owner, Manager & Cashier) */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'inbox' && styles.tabBtnActive]}
              onPress={() => setActiveTab('inbox')}
            >
              <Bell size={13} color={activeTab === 'inbox' ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === 'inbox' && styles.tabTextActive]}>
                Inbox ({notifications.length})
              </Text>
            </TouchableOpacity>
            {canSend && (
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'send' && styles.tabBtnActive]}
                onPress={() => setActiveTab('send')}
              >
                <Megaphone size={13} color={activeTab === 'send' ? Colors.primary : Colors.textMuted} />
                <Text style={[styles.tabText, activeTab === 'send' && styles.tabTextActive]}>
                  Send
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'settings' && styles.tabBtnActive]}
              onPress={() => setActiveTab('settings')}
            >
              <Sliders size={13} color={activeTab === 'settings' ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
                {canSend ? 'Rules' : 'Preferences'}
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'inbox' ? (
            <View style={{ flex: 1 }}>
              {/* Category Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterStrip}
                contentContainerStyle={styles.filterContent}
              >
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'unread', label: `Unread (${unreadNotificationsCount})` },
                    { id: 'takeaway', label: 'Takeaway' },
                    { id: 'dine_in', label: 'Dine-In' },
                    { id: 'delivery', label: 'Delivery' },
                    { id: 'order_placed', label: 'Placed' },
                    { id: 'kitchen', label: 'Kitchen' },
                    { id: 'staff_alert', label: 'Staff Alerts' },
                  ] as Array<{ id: InboxFilter; label: string }>
                ).map((chip) => {
                  const active = inboxFilter === chip.id;
                  return (
                    <TouchableOpacity
                      key={chip.id}
                      onPress={() => setInboxFilter(chip.id)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Toolbar Actions with direct Preferences Option */}
              <View style={styles.inboxToolbar}>
                {notifications.length > 0 && (
                  <>
                    <TouchableOpacity onPress={markAllNotificationsRead} style={styles.toolbarBtn}>
                      <CheckCheck size={14} color={Colors.success} />
                      <Text style={[styles.toolbarText, { color: Colors.success }]}>Mark All Read</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clearNotifications} style={styles.toolbarBtn}>
                      <Trash2 size={14} color={Colors.danger} />
                      <Text style={[styles.toolbarText, { color: Colors.danger }]}>Clear Inbox</Text>
                    </TouchableOpacity>
                  </>
                )}
                <TouchableOpacity
                  onPress={() => setActiveTab('settings')}
                  style={[styles.toolbarBtn, { marginLeft: notifications.length > 0 ? 'auto' : 0 }]}
                >
                  <Sliders size={14} color={Colors.primary} />
                  <Text style={[styles.toolbarText, { color: Colors.primary, fontWeight: '800' }]}>Preferences</Text>
                </TouchableOpacity>
              </View>

              {/* Notifications List */}
              <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 24 }}>
                {filteredInbox.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Bell size={34} color={Colors.borderDark} />
                    <Text style={styles.emptyTitle}>No notifications here</Text>
                    <Text style={styles.emptySub}>
                      Order updates, Takeaway ready alerts, Dine-In status, and deals appear here live.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActiveTab('settings')}
                      style={{
                        marginTop: 14,
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        borderRadius: 8,
                        backgroundColor: Colors.primaryLight,
                        borderWidth: 1,
                        borderColor: Colors.primaryBorder,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Sliders size={14} color={Colors.primary} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: Colors.primary }}>
                        Manage Notification Preferences
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  filteredInbox.map((item) => {
                    const meta = CATEGORY_META[item.category] || CATEGORY_META.system;
                    const unread = isUnread(item);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        activeOpacity={0.85}
                        onPress={() => markNotificationRead(item.id)}
                        style={[styles.notifCard, unread && styles.notifCardUnread]}
                      >
                        <View style={styles.notifTopRow}>
                          <View style={[styles.catBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                            {renderCategoryIcon(item.category, meta.text)}
                            <Text style={[styles.catBadgeText, { color: meta.text }]}>{meta.label}</Text>
                          </View>
                          {!!item.orderNumber && (
                            <View style={styles.orderTag}>
                              <Text style={styles.orderTagText}>#{item.orderNumber}</Text>
                            </View>
                          )}
                          {!!item.targetPlatform && item.targetPlatform !== 'all' && (
                            <View
                              style={[
                                styles.platformBadge,
                                item.targetPlatform === 'app' ? styles.platformApp : styles.platformWeb,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.platformBadgeText,
                                  { color: item.targetPlatform === 'app' ? '#7E22CE' : '#0369A1' },
                                ]}
                              >
                                {item.targetPlatform === 'app' ? 'APP ONLY' : 'WEB ONLY'}
                              </Text>
                            </View>
                          )}
                          {!!item.targetRiderName && (
                            <View style={[styles.platformBadge, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
                              <Text style={[styles.platformBadgeText, { color: '#15803D' }]}>
                                Rider: {item.targetRiderName}
                              </Text>
                            </View>
                          )}
                          {!!item.targetWaiterName && (
                            <View style={[styles.platformBadge, { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' }]}>
                              <Text style={[styles.platformBadgeText, { color: '#1D4ED8' }]}>
                                Waiter: {item.targetWaiterName}
                              </Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }} />
                          <Text style={styles.timeText}>{formatNotifTime(item.createdAt)}</Text>
                          {unread && <View style={styles.unreadDot} />}
                        </View>

                        <Text style={styles.notifTitle}>{item.title}</Text>
                        <Text style={styles.notifMsg}>{item.message}</Text>

                        <View style={styles.notifFooter}>
                          <Text style={styles.senderText}>
                            From: {item.senderName || 'Foodies Cafe'}
                          </Text>
                          {unread && <Text style={styles.tapReadText}>Tap to mark read</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          ) : activeTab === 'send' ? (
            <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 28 }}>
              {/* Quick Scenario Templates */}
              <Text style={styles.fieldLabel}>Quick 1-Tap Scenarios</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 14 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {(
                  [
                    { id: 'takeaway', label: 'Takeaway Ready' },
                    { id: 'placed', label: 'Order Placed' },
                    { id: 'dine_in', label: 'Dine-In Ready' },
                    { id: 'delivery', label: 'Delivery En Route' },
                    { id: 'kitchen', label: 'Kitchen Rush' },
                    { id: 'staff', label: 'Staff Briefing' },
                  ] as const
                ).map((tpl) => (
                  <TouchableOpacity
                    key={tpl.id}
                    onPress={() => applyTemplate(tpl.id)}
                    style={styles.templateBtn}
                  >
                    <Text style={styles.templateBtnText}>{tpl.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Link Active Order */}
              {activeBranchOrders.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>
                    Target Specific Order {targetMode === 'only_order_owner' ? '(Required)' : '(Optional)'}
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 14 }}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    <TouchableOpacity
                      onPress={() => setSelectedOrderId('')}
                      style={[styles.chip, !selectedOrderId && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, !selectedOrderId && styles.chipTextActive]}>
                        General Broadcast
                      </Text>
                    </TouchableOpacity>
                    {activeBranchOrders.map((ord) => {
                      const active = selectedOrderId === ord.id;
                      return (
                        <TouchableOpacity
                          key={ord.id}
                          onPress={() => applyOrderContext(ord)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            #{ord.orderNumber} ({ord.type.replace('_', '-')})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {/* Owner Branch Target */}
              {role === 'platform_owner' ? (
                <>
                  <Text style={styles.fieldLabel}>Branch Scope (Owner Authority: All Branches)</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 14 }}
                    contentContainerStyle={{ gap: 8 }}
                  >
                    <TouchableOpacity
                      onPress={() => setTargetBranchId('all')}
                      style={[styles.chip, targetBranchId === 'all' && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, targetBranchId === 'all' && styles.chipTextActive]}>
                        🌐 All Branches
                      </Text>
                    </TouchableOpacity>
                    {branches.map((b) => {
                      const active = targetBranchId === b.id;
                      return (
                        <TouchableOpacity
                          key={b.id}
                          onPress={() => setTargetBranchId(b.id)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>📍 {b.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              ) : (
                <View
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: Colors.bgSubtle,
                    borderColor: Colors.borderColor,
                    borderWidth: 1,
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: Colors.textMuted, textTransform: 'uppercase' }}>
                    Branch Authority (Locked)
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.textMain, marginTop: 2 }}>
                    📍 {currentBranch?.name || 'Gulberg, Lahore'} ({currentBranch?.city || 'Lahore'})
                  </Text>
                  <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '600', marginTop: 2 }}>
                    Cashier and Manager can only send notifications strictly for their assigned branch.
                  </Text>
                </View>
              )}

              {/* Who Receives This Notification? */}
              <Text style={styles.fieldLabel}>Who Receives This Notification?</Text>
              <View style={styles.wrapChips}>
                {(
                  [
                    { id: 'everyone', label: 'Everyone (Web & App)' },
                    { id: 'only_app', label: 'Only App Users' },
                    { id: 'only_web', label: 'Only Web Users' },
                    { id: 'only_staff', label: 'Only Staff Users' },
                    { id: 'only_order_owner', label: 'Order Owner + Rider/Waiter' },
                  ] as Array<{ id: SenderTargetMode; label: string }>
                ).map((m) => {
                  const selected = targetMode === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setTargetMode(m.id)}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      {m.id === 'everyone' && <Users size={12} color={selected ? Colors.primary : Colors.textMuted} />}
                      {m.id === 'only_app' && <Smartphone size={12} color={selected ? Colors.primary : Colors.textMuted} />}
                      {m.id === 'only_web' && <Globe size={12} color={selected ? Colors.primary : Colors.textMuted} />}
                      {m.id === 'only_staff' && <ShieldCheck size={12} color={selected ? Colors.primary : Colors.textMuted} />}
                      {m.id === 'only_order_owner' && <UserCheck size={12} color={selected ? Colors.primary : Colors.textMuted} />}
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{m.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {targetMode === 'only_staff' && (
                <View style={styles.subCard}>
                  <Text style={styles.subCardTitle}>Select Staff Roles (Web & Mobile):</Text>
                  <View style={[styles.wrapChips, { marginBottom: 0 }]}>
                    {ALL_STAFF_ROLES.map((sr) => {
                      const selected = selectedStaffRoles.includes(sr.role);
                      return (
                        <TouchableOpacity
                          key={sr.role}
                          onPress={() => toggleStaffRole(sr.role)}
                          style={[styles.chip, selected && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                            {selected ? '✓ ' : ''}{sr.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {targetMode === 'only_order_owner' && (
                <View style={[styles.subCard, !selectedOrder && styles.subCardError]}>
                  {selectedOrder ? (
                    <>
                      <Text style={[styles.subCardTitle, { color: Colors.success }]}>
                        Concerned Recipients for #{selectedOrder.orderNumber} ({selectedOrder.type.replace('_', ' ').toUpperCase()})
                      </Text>
                      <Text style={styles.previewDetailText}>
                        • Customer: {selectedOrder.customerName || 'Guest'} ({selectedOrder.customerPhone || 'Registered'})
                      </Text>
                      {selectedOrder.type === 'delivery' && (
                        <Text style={styles.previewDetailText}>
                          • Concerned Rider: {selectedOrder.assignedRiderName || 'Active Delivery Rider'}
                        </Text>
                      )}
                      {selectedOrder.type === 'dine_in' && (
                        <Text style={styles.previewDetailText}>
                          • Concerned Waiter: {selectedOrder.assignedWaiterName || 'Table Service Waiter'}
                        </Text>
                      )}
                      <View style={[styles.wrapChips, { marginTop: 8, marginBottom: 0 }]}>
                        {(
                          [
                            { id: 'all', label: 'Web & App' },
                            { id: 'app', label: 'App Only' },
                            { id: 'web', label: 'Web Only' },
                          ] as Array<{ id: NotificationTargetPlatform; label: string }>
                        ).map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            onPress={() => setOrderOwnerPlatform(p.id)}
                            style={[styles.chip, orderOwnerPlatform === p.id && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, orderOwnerPlatform === p.id && styles.chipTextActive]}>
                              {p.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  ) : (
                    <Text style={[styles.subCardTitle, { color: Colors.danger, marginBottom: 0 }]}>
                      Select an order above to notify its owner and concerned rider or waiter.
                    </Text>
                  )}
                </View>
              )}

              {/* Category & Severity */}
              <Text style={styles.fieldLabel}>Notification Type</Text>
              <View style={styles.wrapChips}>
                {(
                  [
                    { id: 'takeaway', label: 'Takeaway' },
                    { id: 'order_placed', label: 'Order Placed' },
                    { id: 'dine_in', label: 'Dine-In' },
                    { id: 'delivery', label: 'Delivery' },
                    { id: 'kitchen', label: 'Kitchen' },
                    { id: 'staff_alert', label: 'Staff Alert' },
                  ] as Array<{ id: NotificationCategory; label: string }>
                ).map((cat) => {
                  const selected = category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setCategory(cat.id)}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{cat.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Urgency</Text>
              <View style={styles.wrapChips}>
                {(
                  [
                    { id: 'info', label: 'Info' },
                    { id: 'success', label: 'Ready / Success' },
                    { id: 'warning', label: 'Important' },
                    { id: 'error', label: 'Urgent' },
                  ] as const
                ).map((lvl) => {
                  const selected = severity === lvl.id;
                  return (
                    <TouchableOpacity
                      key={lvl.id}
                      onPress={() => setSeverity(lvl.id)}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      {lvl.id === 'warning' || lvl.id === 'error' ? (
                        <AlertTriangle size={12} color={selected ? Colors.primary : Colors.textMuted} />
                      ) : null}
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{lvl.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Title & Message */}
              <Text style={styles.fieldLabel}>Notification Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Takeaway Order #FC-102 Ready for Pickup"
                placeholderTextColor={Colors.textLight}
                style={styles.input}
              />

              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Write a clear message for the customer or staff team..."
                placeholderTextColor={Colors.textLight}
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <TouchableOpacity
                onPress={handleSend}
                disabled={sending || !title.trim() || !message.trim() || (targetMode === 'only_order_owner' && !selectedOrder)}
                style={[
                  styles.sendBtn,
                  (!title.trim() || !message.trim() || sending || (targetMode === 'only_order_owner' && !selectedOrder)) &&
                  styles.sendBtnDisabled,
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={Colors.textWhite} />
                ) : (
                  <Send size={16} color={Colors.textWhite} />
                )}
                <Text style={styles.sendBtnText}>
                  {sending ? 'Sending...' : 'Send Notification Now'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <ScrollView style={styles.scrollBody} contentContainerStyle={{ paddingBottom: 32 }}>
              {canSend && (
                <View style={[styles.tabRow, { marginHorizontal: 0, marginTop: 10, marginBottom: 4 }]}>
                  <TouchableOpacity
                    style={[styles.tabBtn, rulesScope === 'my' && styles.tabBtnActive]}
                    onPress={() => setRulesScope('my')}
                  >
                    <Text style={[styles.tabText, rulesScope === 'my' && styles.tabTextActive]}>
                      My Rules (Only Me)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tabBtn, rulesScope === 'global' && styles.tabBtnActive]}
                    onPress={() => setRulesScope('global')}
                  >
                    <Text style={[styles.tabText, rulesScope === 'global' && styles.tabTextActive]}>
                      Global Sender Rules
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View
                style={[
                  styles.rulesInfoBanner,
                  (rulesScope === 'my' || !canSend) && { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
                ]}
              >
                <Text
                  style={[
                    styles.rulesBannerTitle,
                    (rulesScope === 'my' || !canSend) && { color: '#1E3A8A' },
                  ]}
                >
                  {rulesScope === 'my' || !canSend
                    ? `Notification Preferences — ${currentUser?.name || customerUser?.name || (appMode === 'customer' ? 'Customer' : role.replace(/_/g, ' '))}`
                    : 'Automated Order Notification Rules'}
                </Text>
                <Text
                  style={[
                    styles.rulesBannerSub,
                    (rulesScope === 'my' || !canSend) && { color: '#1D4ED8' },
                  ]}
                >
                  {rulesScope === 'my' || !canSend
                    ? 'Choose which notifications and order updates to receive. Turn off any event to block it from your phone.'
                    : 'Managed by Platform Owner, Branch Manager & Cashier. Saved permanently across restarts until updated.'}
                </Text>
                {rulesScope === 'global' && canSend && !!notificationSettings?.updatedBy && (
                  <Text style={styles.rulesUpdatedText}>
                    Last saved by {notificationSettings.updatedBy} ({(notificationSettings.updatedByRole || '').replace(/_/g, ' ')})
                  </Text>
                )}
                <View style={styles.quickActionRow}>
                  <TouchableOpacity
                    onPress={() => setAllEventRules(true)}
                    style={[styles.quickRuleBtn, { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }]}
                  >
                    <Text style={[styles.quickRuleBtnText, { color: '#15803D' }]}>Enable All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAllEventRules(false)}
                    style={[styles.quickRuleBtn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                  >
                    <Text style={[styles.quickRuleBtnText, { color: '#DC2626' }]}>Stop All</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {(rulesScope === 'my' || !canSend) ? (
                <>
                  <Text style={styles.fieldLabel}>1. Personal Delivery Controls (Only Me)</Text>
                  <View style={styles.wrapChips}>
                    <TouchableOpacity
                      onPress={() =>
                        changeMyRulesDraft((prev) => ({
                          ...prev,
                          receiveNotifications: prev.receiveNotifications === false ? true : false,
                        }))
                      }
                      style={[
                        styles.chip,
                        myRulesDraft.receiveNotifications !== false
                          ? { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }
                          : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: myRulesDraft.receiveNotifications !== false ? '#15803D' : '#DC2626' },
                        ]}
                      >
                        Receive Notifications: {myRulesDraft.receiveNotifications !== false ? 'ON' : 'MUTED'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() =>
                        changeMyRulesDraft((prev) => ({
                          ...prev,
                          showLiveToast: prev.showLiveToast === false ? true : false,
                        }))
                      }
                      style={[
                        styles.chip,
                        myRulesDraft.showLiveToast !== false
                          ? { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }
                          : { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: myRulesDraft.showLiveToast !== false ? '#1D4ED8' : '#64748B' },
                        ]}
                      >
                        Pop-up Alerts: {myRulesDraft.showLiveToast !== false ? 'ON' : 'OFF'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>2. Categories I Receive</Text>
                  <View style={styles.wrapChips}>
                    {[
                      { id: 'takeaway', label: 'Takeaway' },
                      { id: 'delivery', label: 'Delivery' },
                      { id: 'dine_in', label: 'Dine-In' },
                      { id: 'kitchen', label: 'Kitchen' },
                      { id: 'payment', label: 'Payments' },
                      { id: 'staff_alert', label: 'Staff Alerts' },
                      { id: 'system', label: 'System' },
                    ].map((cat) => {
                      const isMuted = (myRulesDraft.mutedCategories || []).includes(cat.id);
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() =>
                            changeMyRulesDraft((prev) => {
                              const cur = Array.isArray(prev.mutedCategories) ? prev.mutedCategories : [];
                              return {
                                ...prev,
                                mutedCategories: cur.includes(cat.id)
                                  ? cur.filter((c) => c !== cat.id)
                                  : [...cur, cat.id],
                              };
                            })
                          }
                          style={[
                            styles.chip,
                            !isMuted
                              ? { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }
                              : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: !isMuted ? '#15803D' : '#DC2626' }]}>
                            {cat.label}: {!isMuted ? 'ON' : 'MUTED'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>3. Choose Events to Receive ({NOTIFICATION_EVENT_RULES.filter((r) => myRulesDraft.events[r.key] !== false).length}/{NOTIFICATION_EVENT_RULES.length})</Text>
                  {NOTIFICATION_EVENT_RULES.map((rule) => {
                    const isEnabled = myRulesDraft.events[rule.key] !== false;
                    return (
                      <View
                        key={rule.key}
                        style={[
                          styles.ruleRowCard,
                          { borderColor: isEnabled ? '#BBF7D0' : '#FECACA' },
                        ]}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={styles.ruleRowTitle}>{rule.label}</Text>
                          <Text style={styles.ruleRowSub}>{rule.description}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            changeMyRulesDraft((prev) => ({
                              ...prev,
                              events: {
                                ...prev.events,
                                [rule.key]: !isEnabled,
                              },
                            }))
                          }
                          style={[
                            styles.ruleStatusPill,
                            { backgroundColor: isEnabled ? '#16A34A' : '#DC2626' },
                          ]}
                        >
                          <Text style={styles.ruleStatusPillText}>
                            {isEnabled ? 'RECEIVING' : 'STOPPED'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              ) : (
                <>

                  <Text style={styles.fieldLabel}>1. Default Platform for Auto Messages</Text>
                  <View style={styles.wrapChips}>
                    {(
                      [
                        { id: 'all', label: 'Both Web & App' },
                        { id: 'app', label: 'Only App Users' },
                        { id: 'web', label: 'Only Web Users' },
                      ] as Array<{ id: NotificationTargetPlatform; label: string }>
                    ).map((p) => {
                      const active = rulesDraft.defaultPlatform === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          onPress={() => changeRulesDraft((prev) => ({ ...prev, defaultPlatform: p.id }))}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.fieldLabel}>2. Auto Recipient Groups</Text>
                  <View style={styles.wrapChips}>
                    {(
                      [
                        { key: 'notifyCustomer', label: 'Order Owner' },
                        { key: 'notifyConcernedRider', label: 'Concerned Rider' },
                        { key: 'notifyConcernedWaiter', label: 'Concerned Waiter' },
                        { key: 'notifyKitchen', label: 'Kitchen Staff' },
                        { key: 'notifyCashierAndManager', label: 'Cashier & Manager' },
                      ] as Array<{ key: keyof Pick<NotificationSettings, 'notifyCustomer' | 'notifyConcernedRider' | 'notifyConcernedWaiter' | 'notifyKitchen' | 'notifyCashierAndManager'>; label: string }>
                    ).map((g) => {
                      const enabled = Boolean(rulesDraft[g.key]);
                      return (
                        <TouchableOpacity
                          key={g.key}
                          onPress={() => changeRulesDraft((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
                          style={[
                            styles.chip,
                            enabled
                              ? { backgroundColor: '#F0FDF4', borderColor: '#16A34A' }
                              : { backgroundColor: Colors.bgSubtle, borderColor: Colors.borderColor },
                          ]}
                        >
                          <Text style={[styles.chipText, { color: enabled ? '#15803D' : Colors.textMuted }]}>
                            {g.label}: {enabled ? 'ON' : 'OFF'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Granular Recipient Rules Matrix (Who To Send What) */}
                  <Text style={styles.fieldLabel}>3. Dispatch Rules Matrix: Who to Send What</Text>
                  <View style={{ gap: 10, marginBottom: 14 }}>
                    {/* A: Customer / User */}
                    <View style={styles.ruleRowCard}>
                      <View style={{ marginBottom: 6 }}>
                        <Text style={[styles.ruleRowTitle, { color: '#0F172A' }]}>👤 Customer (App & Web User)</Text>
                        <Text style={[styles.ruleRowSub, { fontSize: 10.5 }]}>Also controllable in Customer Profile Settings</Text>
                      </View>
                      <View style={styles.wrapChips}>
                        {(
                          [
                            { key: 'orderPlaced', label: 'Order Placed' },
                            { key: 'cooking', label: 'Cooking' },
                            { key: 'orderReady', label: 'Ready' },
                            { key: 'outForDelivery', label: 'Out for Delivery' },
                            { key: 'orderCompleted', label: 'Delivered' },
                            { key: 'orderCancelled', label: 'Cancelled' },
                          ] as Array<{ key: keyof RecipientNotificationRules['customer']; label: string }>
                        ).map((item) => {
                          const enabled = rulesDraft.recipientRules?.customer?.[item.key] !== false;
                          return (
                            <TouchableOpacity
                              key={item.key}
                              onPress={() =>
                                changeRulesDraft((prev) => ({
                                  ...prev,
                                  recipientRules: {
                                    ...(prev.recipientRules || DEFAULT_RECIPIENT_NOTIFICATION_RULES),
                                    customer: {
                                      ...(prev.recipientRules?.customer || DEFAULT_RECIPIENT_NOTIFICATION_RULES.customer),
                                      [item.key]: !enabled,
                                    },
                                  },
                                }))
                              }
                              style={[styles.chip, enabled ? { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' } : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                            >
                              <Text style={[styles.chipText, { color: enabled ? '#15803D' : '#DC2626' }]}>
                                {item.label}: {enabled ? 'ALLOW' : 'BLOCK'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* B: Delivery Rider (Individual Only) */}
                    <View style={styles.ruleRowCard}>
                      <View style={{ marginBottom: 6 }}>
                        <Text style={[styles.ruleRowTitle, { color: '#0F172A' }]}>🛵 Assigned Delivery Rider (Strictly THAT Rider Only)</Text>
                        <Text style={[styles.ruleRowSub, { fontSize: 10.5 }]}>When assigned, alert goes strictly to that individual rider</Text>
                      </View>
                      <View style={styles.wrapChips}>
                        {(
                          [
                            { key: 'orderAssigned', label: 'Order Assigned (That Rider Only)' },
                            { key: 'orderReady', label: 'Ready for Dispatch' },
                            { key: 'orderCancelled', label: 'Order Cancelled' },
                          ] as Array<{ key: keyof RecipientNotificationRules['rider']; label: string }>
                        ).map((item) => {
                          const enabled = rulesDraft.recipientRules?.rider?.[item.key] !== false;
                          return (
                            <TouchableOpacity
                              key={item.key}
                              onPress={() =>
                                changeRulesDraft((prev) => ({
                                  ...prev,
                                  recipientRules: {
                                    ...(prev.recipientRules || DEFAULT_RECIPIENT_NOTIFICATION_RULES),
                                    rider: {
                                      ...(prev.recipientRules?.rider || DEFAULT_RECIPIENT_NOTIFICATION_RULES.rider),
                                      [item.key]: !enabled,
                                    },
                                  },
                                }))
                              }
                              style={[styles.chip, enabled ? { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' } : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                            >
                              <Text style={[styles.chipText, { color: enabled ? '#15803D' : '#DC2626' }]}>
                                {item.label}: {enabled ? 'ALLOW' : 'BLOCK'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* C: Floor Staff / Waiter (Individual Only) */}
                    <View style={styles.ruleRowCard}>
                      <View style={{ marginBottom: 6 }}>
                        <Text style={[styles.ruleRowTitle, { color: '#0F172A' }]}>🍽️ Assigned Floor Staff / Waiter (Strictly THAT Waiter Only)</Text>
                        <Text style={[styles.ruleRowSub, { fontSize: 10.5 }]}>When assigned, alert goes strictly to that individual waiter</Text>
                      </View>
                      <View style={styles.wrapChips}>
                        {(
                          [
                            { key: 'orderAssigned', label: 'Table / Order Assigned' },
                            { key: 'orderReady', label: 'Ready to Serve' },
                            { key: 'orderCancelled', label: 'Order Cancelled' },
                          ] as Array<{ key: keyof RecipientNotificationRules['waiter']; label: string }>
                        ).map((item) => {
                          const enabled = rulesDraft.recipientRules?.waiter?.[item.key] !== false;
                          return (
                            <TouchableOpacity
                              key={item.key}
                              onPress={() =>
                                changeRulesDraft((prev) => ({
                                  ...prev,
                                  recipientRules: {
                                    ...(prev.recipientRules || DEFAULT_RECIPIENT_NOTIFICATION_RULES),
                                    waiter: {
                                      ...(prev.recipientRules?.waiter || DEFAULT_RECIPIENT_NOTIFICATION_RULES.waiter),
                                      [item.key]: !enabled,
                                    },
                                  },
                                }))
                              }
                              style={[styles.chip, enabled ? { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' } : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                            >
                              <Text style={[styles.chipText, { color: enabled ? '#15803D' : '#DC2626' }]}>
                                {item.label}: {enabled ? 'ALLOW' : 'BLOCK'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* D: Kitchen Staff */}
                    <View style={styles.ruleRowCard}>
                      <View style={{ marginBottom: 6 }}>
                        <Text style={[styles.ruleRowTitle, { color: '#0F172A' }]}>👨‍🍳 Kitchen Staff (Chefs)</Text>
                        <Text style={[styles.ruleRowSub, { fontSize: 10.5 }]}>Alerts chefs to begin food preparation or stop cancelled meals</Text>
                      </View>
                      <View style={styles.wrapChips}>
                        {(
                          [
                            { key: 'newOrderPlaced', label: 'New Order Placed / Sent to Kitchen' },
                            { key: 'orderCancelled', label: 'Order Cancelled (Halt Cooking)' },
                          ] as Array<{ key: keyof RecipientNotificationRules['kitchen']; label: string }>
                        ).map((item) => {
                          const enabled = rulesDraft.recipientRules?.kitchen?.[item.key] !== false;
                          return (
                            <TouchableOpacity
                              key={item.key}
                              onPress={() =>
                                changeRulesDraft((prev) => ({
                                  ...prev,
                                  recipientRules: {
                                    ...(prev.recipientRules || DEFAULT_RECIPIENT_NOTIFICATION_RULES),
                                    kitchen: {
                                      ...(prev.recipientRules?.kitchen || DEFAULT_RECIPIENT_NOTIFICATION_RULES.kitchen),
                                      [item.key]: !enabled,
                                    },
                                  },
                                }))
                              }
                              style={[styles.chip, enabled ? { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' } : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                            >
                              <Text style={[styles.chipText, { color: enabled ? '#15803D' : '#DC2626' }]}>
                                {item.label}: {enabled ? 'ALLOW' : 'BLOCK'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* E: Cashier & Branch Manager */}
                    <View style={styles.ruleRowCard}>
                      <View style={{ marginBottom: 6 }}>
                        <Text style={[styles.ruleRowTitle, { color: '#0F172A' }]}>💼 Cashier Desk & Branch Manager</Text>
                      </View>
                      <View style={styles.wrapChips}>
                        {(
                          [
                            { key: 'orderPlaced', label: 'New Orders Placed at Branch' },
                            { key: 'orderCancelled', label: 'Order Cancellations' },
                            { key: 'paymentReceived', label: 'Payment Settlements & Cash' },
                          ] as Array<{ key: keyof RecipientNotificationRules['cashierAndManager']; label: string }>
                        ).map((item) => {
                          const enabled = rulesDraft.recipientRules?.cashierAndManager?.[item.key] !== false;
                          return (
                            <TouchableOpacity
                              key={item.key}
                              onPress={() =>
                                changeRulesDraft((prev) => ({
                                  ...prev,
                                  recipientRules: {
                                    ...(prev.recipientRules || DEFAULT_RECIPIENT_NOTIFICATION_RULES),
                                    cashierAndManager: {
                                      ...(prev.recipientRules?.cashierAndManager || DEFAULT_RECIPIENT_NOTIFICATION_RULES.cashierAndManager),
                                      [item.key]: !enabled,
                                    },
                                  },
                                }))
                              }
                              style={[styles.chip, enabled ? { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' } : { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                            >
                              <Text style={[styles.chipText, { color: enabled ? '#15803D' : '#DC2626' }]}>
                                {item.label}: {enabled ? 'ALLOW' : 'BLOCK'}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>4. Master Automated Order Notification Triggers</Text>
                  {NOTIFICATION_EVENT_RULES.map((rule) => {
                    const isEnabled = rulesDraft.events[rule.key] !== false;
                    return (
                      <View
                        key={rule.key}
                        style={[
                          styles.ruleRowCard,
                          !isEnabled && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
                        ]}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text style={styles.ruleRowTitle}>{rule.label}</Text>
                          <Text style={styles.ruleRowSub}>{rule.description}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() =>
                            changeRulesDraft((prev) => ({
                              ...prev,
                              events: {
                                ...prev.events,
                                [rule.key]: !isEnabled,
                              },
                            }))
                          }
                          style={[
                            styles.ruleStatusPill,
                            { backgroundColor: isEnabled ? '#16A34A' : '#DC2626' },
                          ]}
                        >
                          <Text style={styles.ruleStatusPillText}>
                            {isEnabled ? 'SENDING' : 'STOPPED'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              )}

              <TouchableOpacity
                onPress={handleSaveRules}
                disabled={savingRules}
                style={[styles.sendBtn, savingRules && styles.sendBtnDisabled]}
              >
                {savingRules ? (
                  <ActivityIndicator size="small" color={Colors.textWhite} />
                ) : (
                  <Save size={16} color={Colors.textWhite} />
                )}
                <Text style={styles.sendBtnText}>
                  {savingRules
                    ? 'Saving Permanently...'
                    : rulesScope === 'my' || !canSend
                      ? 'Save Notification Preferences'
                      : 'Save Global Rules Permanently'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
    width: '100%',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: '100%',
    height: '70%',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    borderColor: Colors.borderColor,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textMain,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: Colors.bgSubtle,
    padding: 4,
    borderRadius: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  filterStrip: {
    maxHeight: 46,
    marginTop: 10,
  },
  filterContent: {
    gap: 8,
    alignItems: 'center',
    paddingRight: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  chipActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.primary,
  },
  inboxToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSubtle,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  toolbarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollBody: {
    flex: 1,
    marginTop: 8,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 18,
  },
  notifCard: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },
  notifCardUnread: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryBorder,
  },
  notifTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 7,
  },
  platformBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  platformApp: {
    backgroundColor: '#F3E8FF',
    borderColor: '#D8B4FE',
  },
  platformWeb: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  platformBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  subCard: {
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 12,
    padding: 11,
    marginBottom: 14,
  },
  subCardError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  subCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 6,
  },
  previewDetailText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  rulesInfoBanner: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  rulesBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9A3412',
  },
  rulesBannerSub: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#C2410C',
    marginTop: 3,
    lineHeight: 16,
  },
  rulesUpdatedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C2D12',
    marginTop: 5,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  quickRuleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickRuleBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  ruleRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  ruleRowTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  ruleRowSub: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textMuted,
    marginTop: 2,
  },
  ruleStatusPill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 78,
    alignItems: 'center',
  },
  ruleStatusPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  orderTag: {
    backgroundColor: Colors.bgSubtle,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  orderTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMain,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 3,
  },
  notifMsg: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  notifFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  senderText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tapReadText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 7,
    marginTop: 4,
  },
  templateBtn: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  templateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  wrapChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  input: {
    backgroundColor: Colors.bgMain,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.textMain,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 92,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 4,
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textWhite,
  },
});
