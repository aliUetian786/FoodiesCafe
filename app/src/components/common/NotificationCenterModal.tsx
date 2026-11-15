'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  Send,
  ShoppingBag,
  Utensils,
  Bike,
  ChefHat,
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  Sparkles,
  Sliders,
  Smartphone,
  Globe,
  Users,
  UserCheck,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import {
  AppNotification,
  NotificationCategory,
  NotificationTargetPlatform,
  NotificationEventKey,
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_RECIPIENT_NOTIFICATION_RULES,
  RecipientNotificationRules,
  ReceiverNotificationPreferences,
  DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES,
  OrderType,
  Role,
  normalizeBranchId,
} from '@/types/cafe';

type InboxFilter =
  | 'all'
  | 'unread'
  | 'order_placed'
  | 'takeaway'
  | 'dine_in'
  | 'delivery'
  | 'kitchen'
  | 'staff_alert';

type SenderTargetMode =
  | 'everyone'
  | 'only_app'
  | 'only_web'
  | 'only_staff'
  | 'only_order_owner';

const CAN_SEND_ROLES: Role[] = ['platform_owner', 'branch_manager', 'cashier'];

const ALL_STAFF_ROLES: Array<{ role: Role; label: string }> = [
  { role: 'branch_manager', label: 'Branch Managers' },
  { role: 'cashier', label: 'Cashiers' },
  { role: 'kitchen_staff', label: 'Kitchen Chefs' },
  { role: 'floor_staff', label: 'Floor / Waiters' },
  { role: 'delivery_staff', label: 'Delivery Riders' },
];

const NOTIFICATION_EVENT_RULES: Array<{
  key: NotificationEventKey;
  label: string;
  description: string;
}> = [
    { key: 'orderPlaced', label: 'Order Placed / Confirmed', description: 'Sent immediately when a new customer or walk-in order is placed.' },
    { key: 'sentToKitchen', label: 'Sent to Kitchen', description: 'Alerts kitchen & order owner when forwarded to kitchen queue.' },
    { key: 'cooking', label: 'Cooking in Kitchen', description: 'Notifies customer & concerned staff when chefs start preparing.' },
    { key: 'orderReady', label: 'Order Ready', description: 'Ready for pickup at counter, table service, or rider dispatch.' },
    { key: 'outForDelivery', label: 'Out for Delivery', description: 'Alerts customer & tracking staff when rider is dispatched.' },
    { key: 'orderServed', label: 'Order Served (Dine-In)', description: 'Confirms dine-in meal has been served at the table.' },
    { key: 'orderCompleted', label: 'Order Completed / Delivered', description: 'Final completion confirmation across Web & Mobile.' },
    { key: 'orderCancelled', label: 'Order Cancelled', description: 'Alerts customer and assigned rider/waiter if an order is cancelled.' },
    { key: 'waiterAssigned', label: 'Waiter Assigned (Dine-In)', description: 'Notifies the concerned waiter & guest on table assignment.' },
    { key: 'riderAssigned', label: 'Rider Assigned (Delivery)', description: 'Notifies the concerned delivery rider & customer on dispatch assignment.' },
    { key: 'paymentReceived', label: 'Payment Received / Settled', description: 'Confirms cash or digital payment collection.' },
  ];

function formatRelativeTime(iso?: string): string {
  if (!iso) return 'Just now';
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return 'Just now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function getCategoryMeta(cat: NotificationCategory): { label: string; bg: string; color: string } {
  switch (cat) {
    case 'takeaway':
      return { label: 'TAKEAWAY', bg: '#FFF7ED', color: '#C2410C' };
    case 'dine_in':
      return { label: 'DINE-IN', bg: '#EFF6FF', color: '#1D4ED8' };
    case 'delivery':
      return { label: 'DELIVERY', bg: '#F0FDF4', color: '#15803D' };
    case 'order_placed':
      return { label: 'ORDER PLACED', bg: '#ECFDF5', color: '#047857' };
    case 'kitchen':
      return { label: 'KITCHEN', bg: '#FEF3C7', color: '#B45309' };
    case 'staff_alert':
      return { label: 'STAFF ALERT', bg: '#F3E8FF', color: '#7E22CE' };
    case 'promo':
      return { label: 'PROMO', bg: '#FDF2F8', color: '#BE185D' };
    default:
      return { label: 'SYSTEM', bg: '#F1F5F9', color: '#475569' };
  }
}

export const NotificationCenterModal: React.FC = () => {
  const {
    isNotificationModalOpen,
    setIsNotificationModalOpen,
    notificationModalDefaultTab,
    prefillNotificationOrder,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    sendNotification,
    notificationSettings,
    updateNotificationSettings,
    activeReceiverKey,
    myNotificationSettings,
    updateMyNotificationSettings,
    currentRole,
    currentUser,
    currentBranch,
    branches,
    orders,
  } = useApp();

  const canSend = CAN_SEND_ROLES.includes(currentRole);
  const canManageRules = CAN_SEND_ROLES.includes(currentRole);
  const isOwner = currentRole === 'platform_owner';
  const actorKey =
    currentUser?.id || (currentRole === 'customer' ? 'user-guest' : `role-${currentRole}`);

  const [activeTab, setActiveTab] = useState<'inbox' | 'send' | 'settings'>('inbox');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');

  // Compose state
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [targetBranchId, setTargetBranchId] = useState<string>(
    currentRole === 'platform_owner' ? 'all' : normalizeBranchId(currentBranch?.id)
  );
  const [targetMode, setTargetMode] = useState<SenderTargetMode>('everyone');
  const [selectedStaffRoles, setSelectedStaffRoles] = useState<Role[]>([
    'branch_manager',
    'cashier',
    'kitchen_staff',
    'floor_staff',
    'delivery_staff',
  ]);
  const [orderOwnerPlatform, setOrderOwnerPlatform] = useState<NotificationTargetPlatform>('all');
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [severity, setSeverity] = useState<'info' | 'success' | 'warning' | 'error'>('info');
  const [category, setCategory] = useState<NotificationCategory>('takeaway');
  const [isSending, setIsSending] = useState<boolean>(false);

  // Manage rules state
  const [rulesScope, setRulesScope] = useState<'my' | 'global'>(canSend ? 'global' : 'my');
  const [rulesDraft, setRulesDraft] = useState<NotificationSettings>(notificationSettings || DEFAULT_NOTIFICATION_SETTINGS);
  const [myRulesDraft, setMyRulesDraft] = useState<ReceiverNotificationPreferences>(
    myNotificationSettings || DEFAULT_RECEIVER_NOTIFICATION_PREFERENCES
  );
  const [isSavingRules, setIsSavingRules] = useState<boolean>(false);
  const isEditingRulesRef = useRef<boolean>(false);
  const isEditingMyRulesRef = useRef<boolean>(false);

  const activeOrders = useMemo(() => {
    const scopeBranch = currentRole === 'platform_owner' ? targetBranchId : normalizeBranchId(currentBranch?.id);
    return orders
      .filter((o) => {
        if (o.status === 'cancelled') return false;
        if (scopeBranch !== 'all' && normalizeBranchId(o.branchId) !== normalizeBranchId(scopeBranch)) {
          return false;
        }
        return true;
      })
      .slice(0, 25);
  }, [orders, currentRole, targetBranchId, currentBranch?.id]);

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
    setTargetBranchId(currentRole === 'platform_owner' ? 'all' : normalizeBranchId(currentBranch?.id));

    if (prefillNotificationOrder) {
      setSelectedOrderId(prefillNotificationOrder.id);
      setTargetMode('only_order_owner');
      const ordType = prefillNotificationOrder.type || 'takeaway';
      const ordCategory: NotificationCategory =
        ordType === 'takeaway' ? 'takeaway' : ordType === 'delivery' ? 'delivery' : 'dine_in';
      setCategory(ordCategory);
      setSeverity('success');
      if (ordType === 'takeaway') {
        setTitle(`Takeaway Order #${prefillNotificationOrder.orderNumber} Update`);
        setMessage(
          `Hello ${prefillNotificationOrder.customerName}, your Takeaway order #${prefillNotificationOrder.orderNumber} is packed and ready for counter pickup!`
        );
      } else if (ordType === 'delivery') {
        setTitle(`Delivery Order #${prefillNotificationOrder.orderNumber} Update`);
        setMessage(
          `Hello ${prefillNotificationOrder.customerName}, your Delivery order #${prefillNotificationOrder.orderNumber} is being prepared for rider dispatch.`
        );
      } else {
        setTitle(`Dine-In Order #${prefillNotificationOrder.orderNumber} Update`);
        setMessage(
          `Hello ${prefillNotificationOrder.customerName}, your Dine-In order #${prefillNotificationOrder.orderNumber}${prefillNotificationOrder.tableNumber ? ` (Table ${prefillNotificationOrder.tableNumber})` : ''} is freshly prepared!`
        );
      }
    } else {
      setSelectedOrderId('');
      setTargetMode('everyone');
      setSelectedStaffRoles(['branch_manager', 'cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff']);
      setOrderOwnerPlatform('all');
      setTitle('');
      setMessage('');
    }
  }, [isNotificationModalOpen, notificationModalDefaultTab, prefillNotificationOrder, canSend, currentRole, currentBranch?.id]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || prefillNotificationOrder || null,
    [orders, selectedOrderId, prefillNotificationOrder]
  );

  const toggleStaffRole = (role: Role) => {
    setSelectedStaffRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const applyTemplate = (preset: 'order_placed' | 'takeaway_ready' | 'dine_in_ready' | 'delivery_out' | 'kitchen_rush' | 'staff_notice') => {
    const ordRef = selectedOrder ? ` #${selectedOrder.orderNumber}` : '';
    const custName = selectedOrder?.customerName || 'Valued Guest';
    if (preset === 'order_placed') {
      setTitle(`Order${ordRef} Confirmed`);
      setMessage(`Hello ${custName}, your order${ordRef} has been confirmed and queued for preparation.`);
      setCategory('order_placed');
      setSeverity('success');
      setTargetMode(selectedOrder ? 'only_order_owner' : 'everyone');
    } else if (preset === 'takeaway_ready') {
      setTitle(`Takeaway Order${ordRef} Ready at Counter!`);
      setMessage(`Hello ${custName}, your Takeaway order${ordRef} is hot, packed, and ready for pickup at our counter.`);
      setCategory('takeaway');
      setSeverity('success');
      setTargetMode(selectedOrder ? 'only_order_owner' : 'everyone');
    } else if (preset === 'dine_in_ready') {
      setTitle(`Dine-In Order${ordRef} Ready to Serve`);
      setMessage(`Order${ordRef}${selectedOrder?.tableNumber ? ` for Table ${selectedOrder.tableNumber}` : ''} is ready at the pass. Please serve immediately.`);
      setCategory('dine_in');
      setSeverity('info');
      if (selectedOrder) {
        setTargetMode('only_order_owner');
      } else {
        setTargetMode('only_staff');
        setSelectedStaffRoles(['floor_staff']);
      }
    } else if (preset === 'delivery_out') {
      setTitle(`Delivery Order${ordRef} Out with Rider`);
      setMessage(`Hello ${custName}, your Delivery order${ordRef} is out with our rider and arriving shortly.`);
      setCategory('delivery');
      setSeverity('success');
      if (selectedOrder) {
        setTargetMode('only_order_owner');
      } else {
        setTargetMode('everyone');
      }
    } else if (preset === 'kitchen_rush') {
      setTitle(`Priority Kitchen Alert${ordRef}`);
      setMessage(`Please prioritize preparing Order${ordRef} (${selectedOrder?.type?.replace('_', ' ') || 'express order'}) immediately.`);
      setCategory('kitchen');
      setSeverity('warning');
      setTargetMode('only_staff');
      setSelectedStaffRoles(['kitchen_staff']);
    } else {
      setTitle(`Team Notice • ${currentBranch?.name || 'All Branches'}`);
      setMessage('Attention team: please check active Takeaway, Dine-In & Delivery queues and confirm ready orders promptly.');
      setCategory('staff_alert');
      setSeverity('info');
      setTargetMode('only_staff');
      setSelectedStaffRoles(['branch_manager', 'cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff']);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    if (targetMode === 'only_order_owner' && !selectedOrder) return;
    setIsSending(true);
    try {
      const ordBranch = selectedOrder?.branchId ? normalizeBranchId(selectedOrder.branchId) : targetBranchId;

      let effectiveRoles: Array<Role | 'all'> = ['all'];
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
        effectiveRoles = selectedStaffRoles.length > 0
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
        branchId: ordBranch,
        orderId: selectedOrder?.id,
        orderNumber: selectedOrder?.orderNumber,
        orderType: selectedOrder?.type as OrderType | undefined,
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
      setActiveTab('inbox');
    } finally {
      setIsSending(false);
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
    setIsSavingRules(true);
    try {
      if (rulesScope === 'my' || !canSend) {
        const ok = await updateMyNotificationSettings(myRulesDraft, activeReceiverKey);
        if (ok !== false) isEditingMyRulesRef.current = false;
      } else {
        const ok = await updateNotificationSettings(rulesDraft);
        if (ok !== false) isEditingRulesRef.current = false;
      }
    } finally {
      setIsSavingRules(false);
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

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const isUnread = !(n.readBy || []).includes(actorKey);
      if (inboxFilter === 'unread') return isUnread;
      if (inboxFilter === 'all') return true;
      return n.category === inboxFilter;
    });
  }, [notifications, inboxFilter, actorKey]);

  if (!isNotificationModalOpen) return null;

  return (
    <div
      onClick={() => setIsNotificationModalOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 11000,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '88vh',
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          border: '1px solid #E2E8F0',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#0F172A',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                backgroundColor: '#FFF7ED',
                border: '1px solid #FED7AA',
                color: '#EA580C',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bell size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '16.5px', fontWeight: 850, color: '#0F172A' }}>
                  Live Notifications & Alerts
                </h2>
                {unreadNotificationsCount > 0 && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: '#EA580C',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 800,
                    }}
                  >
                    {unreadNotificationsCount} Unread
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
                {canSend
                  ? `Signed in as ${currentRole.replace(/_/g, ' ')} • Real-time sync across Web & Mobile`
                  : 'Real-time order updates for Takeaway, Dine-In & Delivery'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsNotificationModalOpen(false)}
            aria-label="Close notifications"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: '1px solid #E2E8F0',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              style={{
                padding: '7px 14px',
                borderRadius: '10px',
                border: activeTab === 'inbox' ? '1px solid #EA580C' : '1px solid #E2E8F0',
                backgroundColor: activeTab === 'inbox' ? '#FFF7ED' : '#F8FAFC',
                color: activeTab === 'inbox' ? '#EA580C' : '#475569',
                fontSize: '12.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Bell size={14} />
              <span>Received ({notifications.length})</span>
            </button>

            {canSend && (
              <button
                type="button"
                onClick={() => setActiveTab('send')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: activeTab === 'send' ? '1px solid #EA580C' : '1px solid #E2E8F0',
                  backgroundColor: activeTab === 'send' ? '#EA580C' : '#F8FAFC',
                  color: activeTab === 'send' ? '#FFFFFF' : '#475569',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Megaphone size={14} />
                <span>Send Notification</span>
              </button>
            )}

            {canManageRules && (
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: activeTab === 'settings' ? '1px solid #EA580C' : '1px solid #E2E8F0',
                  backgroundColor: activeTab === 'settings' ? '#EA580C' : '#F8FAFC',
                  color: activeTab === 'settings' ? '#FFFFFF' : '#475569',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sliders size={14} />
                <span>{canSend ? 'Notification Rules' : 'My Notification Rules'}</span>
              </button>
            )}
          </div>

          {activeTab === 'inbox' && notifications.length > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => markAllNotificationsRead()}
                style={{
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  fontSize: '11.5px',
                  fontWeight: 750,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <CheckCheck size={13} color="#16A34A" />
                <span>Mark All Read</span>
              </button>
              <button
                type="button"
                onClick={() => clearNotifications()}
                style={{
                  padding: '6px 11px',
                  borderRadius: '8px',
                  border: '1px solid #FEE2E2',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  fontSize: '11.5px',
                  fontWeight: 750,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', backgroundColor: '#FFFFFF' }}>
          {activeTab === 'inbox' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Category Filter Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'unread', label: `Unread (${unreadNotificationsCount})` },
                    { id: 'takeaway', label: 'Takeaway' },
                    { id: 'dine_in', label: 'Dine-In' },
                    { id: 'delivery', label: 'Delivery' },
                    { id: 'order_placed', label: 'Order Placed' },
                    { id: 'kitchen', label: 'Kitchen' },
                    { id: 'staff_alert', label: 'Staff Alerts' },
                  ] as Array<{ id: InboxFilter; label: string }>
                ).map((chip) => {
                  const active = inboxFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setInboxFilter(chip.id)}
                      style={{
                        padding: '5px 11px',
                        borderRadius: '999px',
                        border: active ? '1px solid #EA580C' : '1px solid #E2E8F0',
                        backgroundColor: active ? '#EA580C' : '#F8FAFC',
                        color: active ? '#FFFFFF' : '#475569',
                        fontSize: '11.5px',
                        fontWeight: 750,
                        cursor: 'pointer',
                      }}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {/* Notification Feed */}
              {filteredNotifications.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '44px 20px',
                    borderRadius: '16px',
                    backgroundColor: '#F8FAFC',
                    border: '1px dashed #CBD5E1',
                  }}
                >
                  <Bell size={34} color="#94A3B8" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A' }}>
                    No matching notifications yet
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748B' }}>
                    Order placements, Takeaway counter readiness, Dine-In service & Delivery alerts appear here live.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filteredNotifications.map((n: AppNotification) => {
                    const isUnread = !(n.readBy || []).includes(actorKey);
                    const catMeta = getCategoryMeta(n.category);
                    return (
                      <div
                        key={n.id}
                        onClick={() => isUnread && markNotificationRead(n.id)}
                        style={{
                          padding: '13px 15px',
                          borderRadius: '14px',
                          backgroundColor: isUnread ? '#FFFBF7' : '#F8FAFC',
                          border: isUnread ? '1px solid #FDBA74' : '1px solid #E2E8F0',
                          cursor: isUnread ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                        }}
                      >
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            backgroundColor: catMeta.bg,
                            color: catMeta.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {n.category === 'takeaway' ? (
                            <ShoppingBag size={17} />
                          ) : n.category === 'dine_in' ? (
                            <Utensils size={17} />
                          ) : n.category === 'delivery' ? (
                            <Bike size={17} />
                          ) : n.category === 'kitchen' ? (
                            <ChefHat size={17} />
                          ) : n.type === 'warning' || n.type === 'error' ? (
                            <AlertTriangle size={17} />
                          ) : n.type === 'success' ? (
                            <CheckCircle2 size={17} />
                          ) : (
                            <Info size={17} />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 850,
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  backgroundColor: catMeta.bg,
                                  color: catMeta.color,
                                }}
                              >
                                {catMeta.label}
                              </span>
                              {n.orderNumber && (
                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: '#E2E8F0',
                                    color: '#0F172A',
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  #{n.orderNumber}
                                </span>
                              )}
                              {n.targetPlatform && n.targetPlatform !== 'all' && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: n.targetPlatform === 'app' ? '#F3E8FF' : '#E0F2FE',
                                    color: n.targetPlatform === 'app' ? '#7E22CE' : '#0369A1',
                                  }}
                                >
                                  {n.targetPlatform === 'app' ? 'APP ONLY' : 'WEB ONLY'}
                                </span>
                              )}
                              {n.targetRiderName && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: '#DCFCE7',
                                    color: '#15803D',
                                  }}
                                >
                                  Rider: {n.targetRiderName}
                                </span>
                              )}
                              {n.targetWaiterName && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: '6px',
                                    backgroundColor: '#DBEAFE',
                                    color: '#1D4ED8',
                                  }}
                                >
                                  Waiter: {n.targetWaiterName}
                                </span>
                              )}
                              {n.branchId && n.branchId !== 'all' && (
                                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B' }}>
                                  • {branches.find((b) => b.id === n.branchId)?.city || n.branchId}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <Clock size={11} />
                                {formatRelativeTime(n.createdAt)}
                              </span>
                              {isUnread && (
                                <span
                                  title="Unread"
                                  style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: '#EA580C',
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0F172A', marginTop: '5px' }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '3px', lineHeight: 1.45 }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', fontWeight: 600 }}>
                            From: {n.senderName || 'Foodies Cafe'} ({(n.senderRole || 'system').replace(/_/g, ' ')})
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'send' ? (
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Quick 1-Click Scenario Templates */}
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '7px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={13} color="#EA580C" />
                  <span>Quick Notification Templates</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    { id: 'order_placed', label: 'Order Placed' },
                    { id: 'takeaway_ready', label: 'Takeaway Ready' },
                    { id: 'dine_in_ready', label: 'Dine-In Ready' },
                    { id: 'delivery_out', label: 'Delivery Dispatched' },
                    { id: 'kitchen_rush', label: 'Kitchen Priority' },
                    { id: 'staff_notice', label: 'Staff Announcement' },
                  ].map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl.id as any)}
                      style={{
                        padding: '6px 11px',
                        borderRadius: '8px',
                        border: '1px solid #E2E8F0',
                        backgroundColor: '#F8FAFC',
                        color: '#0F172A',
                        fontSize: '11.5px',
                        fontWeight: 750,
                        cursor: 'pointer',
                      }}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Owner Branch Selector + Active Order Link */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {currentRole === 'platform_owner' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                      Branch Scope (Owner Authority: All Branches)
                    </label>
                    <select
                      value={targetBranchId}
                      onChange={(e) => setTargetBranchId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        backgroundColor: '#F8FAFC',
                        color: '#0F172A',
                        fontSize: '13px',
                        fontWeight: 700,
                      }}
                    >
                      <option value="all">🌐 All Branches (Global Broadcast)</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          📍 {b.name} ({b.city})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Branch Scope Authority (Locked)
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                      📍 {currentBranch?.name || 'Gulberg, Lahore'} ({currentBranch?.city || 'Lahore'})
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#EA580C', marginTop: '2px' }}>
                      Cashier and Manager can only send notifications strictly for their assigned branch.
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    Link Specific Order {targetMode === 'only_order_owner' ? '(Required)' : '(Optional)'}
                  </label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedOrderId(id);
                      const ord = orders.find((o) => o.id === id);
                      if (ord) {
                        setTargetMode('only_order_owner');
                        setCategory(
                          ord.type === 'takeaway'
                            ? 'takeaway'
                            : ord.type === 'delivery'
                              ? 'delivery'
                              : 'dine_in'
                        );
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: targetMode === 'only_order_owner' && !selectedOrder ? '1.5px solid #DC2626' : '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#0F172A',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    <option value="">-- Broadcast / No Specific Order --</option>
                    {activeOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.orderNumber} • {o.type.replace('_', ' ').toUpperCase()} • {o.customerName} ({o.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Audience & Platform Mode Selector */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '7px' }}>
                  Who Receives This Notification?
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: '8px' }}>
                  {(
                    [
                      {
                        id: 'everyone',
                        label: 'Everyone (Web & App)',
                        sub: 'All customers & staff',
                        icon: <Users size={15} />,
                      },
                      {
                        id: 'only_app',
                        label: 'Only App Users',
                        sub: 'Mobile App customers only',
                        icon: <Smartphone size={15} />,
                      },
                      {
                        id: 'only_web',
                        label: 'Only Web Users',
                        sub: 'Website customers only',
                        icon: <Globe size={15} />,
                      },
                      {
                        id: 'only_staff',
                        label: 'Only Staff Users',
                        sub: 'Internal team roles only',
                        icon: <ShieldCheck size={15} />,
                      },
                      {
                        id: 'only_order_owner',
                        label: 'Order Owner + Rider/Waiter',
                        sub: 'Order guest & concerned staff',
                        icon: <UserCheck size={15} />,
                      },
                    ] as Array<{ id: SenderTargetMode; label: string; sub: string; icon: React.ReactNode }>
                  ).map((m) => {
                    const active = targetMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setTargetMode(m.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '11px',
                          border: active ? '1.5px solid #EA580C' : '1px solid #E2E8F0',
                          backgroundColor: active ? '#FFF7ED' : '#F8FAFC',
                          color: active ? '#C2410C' : '#0F172A',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '9px',
                        }}
                      >
                        <div style={{ marginTop: '2px', color: active ? '#EA580C' : '#64748B' }}>
                          {m.icon}
                        </div>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 850 }}>{m.label}</div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginTop: '1px' }}>
                            {m.sub}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Staff Sub-role Picker when Only Staff Users is selected */}
                {targetMode === 'only_staff' && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '11px 12px',
                      borderRadius: '11px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#334155', marginBottom: '7px' }}>
                      Select Staff Roles (applies to Web & Mobile staff apps):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {ALL_STAFF_ROLES.map((sr) => {
                        const checked = selectedStaffRoles.includes(sr.role);
                        return (
                          <button
                            key={sr.role}
                            type="button"
                            onClick={() => toggleStaffRole(sr.role)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '8px',
                              border: checked ? '1.5px solid #EA580C' : '1px solid #CBD5E1',
                              backgroundColor: checked ? '#FFF7ED' : '#FFFFFF',
                              color: checked ? '#C2410C' : '#475569',
                              fontSize: '11.5px',
                              fontWeight: 750,
                              cursor: 'pointer',
                            }}
                          >
                            {checked ? '✓ ' : ''}{sr.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Order Owner + Concerned Rider / Waiter Preview */}
                {targetMode === 'only_order_owner' && (
                  <div
                    style={{
                      marginTop: '10px',
                      padding: '12px',
                      borderRadius: '11px',
                      backgroundColor: selectedOrder ? '#F0FDF4' : '#FEF2F2',
                      border: selectedOrder ? '1px solid #BBF7D0' : '1px solid #FECACA',
                    }}
                  >
                    {selectedOrder ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#166534' }}>
                          Concerned Recipients for Order #{selectedOrder.orderNumber} ({selectedOrder.type.replace('_', ' ').toUpperCase()}):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11.5px', fontWeight: 700, color: '#0F172A' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '7px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1' }}>
                            Customer: {selectedOrder.customerName} ({selectedOrder.customerPhone || 'Registered'})
                          </span>
                          {selectedOrder.type === 'delivery' && (
                            <span style={{ padding: '4px 8px', borderRadius: '7px', backgroundColor: '#FFFFFF', border: '1px solid #86EFAC', color: '#15803D' }}>
                              Concerned Rider: {selectedOrder.assignedRiderName || 'Active Delivery Rider'}
                            </span>
                          )}
                          {selectedOrder.type === 'dine_in' && (
                            <span style={{ padding: '4px 8px', borderRadius: '7px', backgroundColor: '#FFFFFF', border: '1px solid #93C5FD', color: '#1D4ED8' }}>
                              Concerned Waiter: {selectedOrder.assignedWaiterName || 'Table Service Waiter'}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: 750, color: '#334155' }}>Deliver on:</span>
                          {(
                            [
                              { id: 'all', label: 'Web & App' },
                              { id: 'app', label: 'App Only' },
                              { id: 'web', label: 'Web Only' },
                            ] as Array<{ id: NotificationTargetPlatform; label: string }>
                          ).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setOrderOwnerPlatform(p.id)}
                              style={{
                                padding: '4px 9px',
                                borderRadius: '7px',
                                border: orderOwnerPlatform === p.id ? '1.5px solid #EA580C' : '1px solid #CBD5E1',
                                backgroundColor: orderOwnerPlatform === p.id ? '#EA580C' : '#FFFFFF',
                                color: orderOwnerPlatform === p.id ? '#FFFFFF' : '#334155',
                                fontSize: '11px',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', fontWeight: 750, color: '#DC2626' }}>
                        Please select an order from "Link Specific Order" above to target its customer and concerned rider/waiter.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Category & Severity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    Order / Alert Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as NotificationCategory)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#0F172A',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    <option value="takeaway">Takeaway</option>
                    <option value="dine_in">Dine-In</option>
                    <option value="delivery">Delivery</option>
                    <option value="order_placed">Order Placed</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="staff_alert">Staff Alert</option>
                    <option value="promo">Promotion / Deal</option>
                    <option value="system">System Update</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                    Priority / Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#F8FAFC',
                      color: '#0F172A',
                      fontSize: '13px',
                      fontWeight: 700,
                    }}
                  >
                    <option value="success">Ready / Confirmed (Green)</option>
                    <option value="info">Information Update (Blue)</option>
                    <option value="warning">Urgent / Priority (Amber)</option>
                    <option value="error">Critical Alert (Red)</option>
                  </select>
                </div>
              </div>

              {/* Title & Message */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                  Notification Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Takeaway Order #FC-1024 Ready for Pickup!"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '5px' }}>
                  Message
                </label>
                <textarea
                  required
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write the alert message that will pop up on concerned users' Web and Mobile apps..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '13px',
                    fontWeight: 600,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSending || !title.trim() || !message.trim() || (targetMode === 'only_order_owner' && !selectedOrder)}
                style={{
                  padding: '12px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: isSending || (targetMode === 'only_order_owner' && !selectedOrder) ? '#FDBA74' : '#EA580C',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 850,
                  cursor: isSending ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(234, 88, 12, 0.3)',
                }}
              >
                <Send size={16} />
                <span>{isSending ? 'Delivering to Web & Mobile...' : 'Send Notification Now'}</span>
              </button>
            </form>
          ) : (
            /* Manage Notification Rules Tab (Global Sender Rules + Per-Receiver Independent Rules) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {canSend && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    padding: '6px',
                    borderRadius: '12px',
                    backgroundColor: '#F1F5F9',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setRulesScope('my')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '9px',
                      border: 'none',
                      backgroundColor: rulesScope === 'my' ? '#FFFFFF' : 'transparent',
                      color: rulesScope === 'my' ? '#EA580C' : '#475569',
                      fontSize: '12px',
                      fontWeight: 850,
                      cursor: 'pointer',
                      boxShadow: rulesScope === 'my' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    My Receiver Rules (Only Me)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRulesScope('global')}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '9px',
                      border: 'none',
                      backgroundColor: rulesScope === 'global' ? '#FFFFFF' : 'transparent',
                      color: rulesScope === 'global' ? '#0F172A' : '#475569',
                      fontSize: '12px',
                      fontWeight: 850,
                      cursor: 'pointer',
                      boxShadow: rulesScope === 'global' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    Global Sender Rules (All Users)
                  </button>
                </div>
              )}

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: rulesScope === 'my' || !canSend ? '#EFF6FF' : '#FFF7ED',
                  border: rulesScope === 'my' || !canSend ? '1px solid #BFDBFE' : '1px solid #FED7AA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 850, color: rulesScope === 'my' || !canSend ? '#1E3A8A' : '#9A3412' }}>
                    {rulesScope === 'my' || !canSend
                      ? `Independent Receiver Rules — ${currentUser?.name || currentRole.replace(/_/g, ' ')}`
                      : 'Automated Notification Rules & Delivery Controls'}
                  </div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: rulesScope === 'my' || !canSend ? '#1D4ED8' : '#C2410C', marginTop: '2px' }}>
                    {rulesScope === 'my' || !canSend
                      ? `Receiver ID: ${activeReceiverKey} • Any change here applies independently to YOUR notifications only and will NOT affect any other user or role.`
                      : 'Changes saved here remain active permanently across Web & Mobile restarts until updated by Platform Owner, Branch Manager, or Cashier.'}
                  </div>
                  {rulesScope === 'global' && canSend && notificationSettings?.updatedBy && (
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#7C2D12', marginTop: '4px' }}>
                      Last saved by {notificationSettings.updatedBy} ({(notificationSettings.updatedByRole || '').replace(/_/g, ' ')})
                      {notificationSettings.updatedAt ? ` • ${new Date(notificationSettings.updatedAt).toLocaleString()}` : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setAllEventRules(true)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #86EFAC',
                      backgroundColor: '#F0FDF4',
                      color: '#15803D',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllEventRules(false)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #FECACA',
                      backgroundColor: '#FEF2F2',
                      color: '#DC2626',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Stop All
                  </button>
                </div>
              </div>

              {(rulesScope === 'my' || !canSend) ? (
                <>
                  {/* Master Independent Receiver Controls */}
                  <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 850, color: '#0F172A' }}>
                      1. Personal Notification Delivery (Only Affects You)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() =>
                          changeMyRulesDraft((prev) => ({ ...prev, receiveNotifications: !prev.receiveNotifications }))
                        }
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: myRulesDraft.receiveNotifications !== false ? '1.5px solid #16A34A' : '1px solid #FECACA',
                          backgroundColor: myRulesDraft.receiveNotifications !== false ? '#F0FDF4' : '#FEF2F2',
                          color: myRulesDraft.receiveNotifications !== false ? '#15803D' : '#DC2626',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>Receive Notifications</span>
                        <span>{myRulesDraft.receiveNotifications !== false ? 'ON' : 'MUTED'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          changeMyRulesDraft((prev) => ({ ...prev, showLiveToast: !prev.showLiveToast }))
                        }
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          border: myRulesDraft.showLiveToast !== false ? '1.5px solid #2563EB' : '1px solid #E2E8F0',
                          backgroundColor: myRulesDraft.showLiveToast !== false ? '#EFF6FF' : '#FFFFFF',
                          color: myRulesDraft.showLiveToast !== false ? '#1D4ED8' : '#64748B',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>Live Pop-up & Desktop Alerts</span>
                        <span>{myRulesDraft.showLiveToast !== false ? 'ON' : 'OFF'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Category Filter Controls for this Receiver */}
                  <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 850, color: '#0F172A', marginBottom: '8px' }}>
                      2. Notification Categories I Receive
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(
                        [
                          { id: 'takeaway', label: 'Takeaway' },
                          { id: 'delivery', label: 'Delivery' },
                          { id: 'dine_in', label: 'Dine-In' },
                          { id: 'kitchen', label: 'Kitchen' },
                          { id: 'payment', label: 'Payments' },
                          { id: 'staff_alert', label: 'Staff Alerts' },
                          { id: 'system', label: 'System' },
                        ]
                      ).map((cat) => {
                        const isMuted = (myRulesDraft.mutedCategories || []).includes(cat.id);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() =>
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
                            style={{
                              padding: '6px 11px',
                              borderRadius: '999px',
                              border: !isMuted ? '1px solid #86EFAC' : '1px solid #FECACA',
                              backgroundColor: !isMuted ? '#F0FDF4' : '#FEF2F2',
                              color: !isMuted ? '#15803D' : '#DC2626',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            {cat.label}: {!isMuted ? 'Receive' : 'Stopped'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-Event Rules for this Receiver */}
                  <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 850, color: '#0F172A', marginBottom: '8px' }}>
                      3. Choose Which Events Notify You ({NOTIFICATION_EVENT_RULES.filter((r) => myRulesDraft.events[r.key] !== false).length}/{NOTIFICATION_EVENT_RULES.length} Active)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {NOTIFICATION_EVENT_RULES.map((rule) => {
                        const isEnabled = myRulesDraft.events[rule.key] !== false;
                        return (
                          <div
                            key={rule.key}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '10px',
                              backgroundColor: '#FFFFFF',
                              border: isEnabled ? '1px solid #BBF7D0' : '1px solid #FECACA',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0F172A' }}>{rule.label}</div>
                              <div style={{ fontSize: '11px', fontWeight: 500, color: '#64748B' }}>{rule.description}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                changeMyRulesDraft((prev) => ({
                                  ...prev,
                                  events: { ...prev.events, [rule.key]: !isEnabled },
                                }))
                              }
                              style={{
                                padding: '6px 12px',
                                borderRadius: '999px',
                                border: 'none',
                                backgroundColor: isEnabled ? '#16A34A' : '#EF4444',
                                color: '#FFFFFF',
                                fontSize: '11px',
                                fontWeight: 850,
                                cursor: 'pointer',
                                minWidth: '105px',
                                flexShrink: 0,
                              }}
                            >
                              {isEnabled ? 'RECEIVING' : 'STOPPED'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>

                  {/* Default Platform Selector */}
                  <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 850, color: '#0F172A', marginBottom: '8px' }}>
                      1. Default Platform for Automated Order Messages
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {(
                        [
                          { id: 'all', label: 'Both Web & App' },
                          { id: 'app', label: 'Only App Users' },
                          { id: 'web', label: 'Only Web Users' },
                        ] as Array<{ id: NotificationTargetPlatform; label: string }>
                      ).map((p) => {
                        const active = rulesDraft.defaultPlatform === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => changeRulesDraft((prev) => ({ ...prev, defaultPlatform: p.id }))}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '9px',
                              border: active ? '1.5px solid #EA580C' : '1px solid #CBD5E1',
                              backgroundColor: active ? '#EA580C' : '#FFFFFF',
                              color: active ? '#FFFFFF' : '#334155',
                              fontSize: '12px',
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Concerned Recipient Groups */}
                  <div style={{ padding: '12px 14px', borderRadius: '12px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 850, color: '#0F172A', marginBottom: '8px' }}>
                      2. Who Automatically Receives Order Alerts (Master Groups)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                      {(
                        [
                          { key: 'notifyCustomer', label: 'Order Owner (Customer)' },
                          { key: 'notifyConcernedRider', label: 'Concerned Delivery Rider' },
                          { key: 'notifyConcernedWaiter', label: 'Concerned Dine-In Waiter' },
                          { key: 'notifyKitchen', label: 'Kitchen Staff' },
                          { key: 'notifyCashierAndManager', label: 'Cashier & Branch Manager' },
                        ] as Array<{ key: keyof Pick<NotificationSettings, 'notifyCustomer' | 'notifyConcernedRider' | 'notifyConcernedWaiter' | 'notifyKitchen' | 'notifyCashierAndManager'>; label: string }>
                      ).map((g) => {
                        const enabled = Boolean(rulesDraft[g.key]);
                        return (
                          <button
                            key={g.key}
                            type="button"
                            onClick={() => changeRulesDraft((prev) => ({ ...prev, [g.key]: !prev[g.key] }))}
                            style={{
                              padding: '9px 11px',
                              borderRadius: '9px',
                              border: enabled ? '1.5px solid #16A34A' : '1px solid #CBD5E1',
                              backgroundColor: enabled ? '#F0FDF4' : '#FFFFFF',
                              color: enabled ? '#166534' : '#64748B',
                              fontSize: '12px',
                              fontWeight: 750,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>{g.label}</span>
                            <span style={{ fontSize: '10.5px', fontWeight: 850 }}>
                              {enabled ? 'ON' : 'OFF'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Granular Recipient Rules Matrix (Who To Send What) */}
                  <div style={{ padding: '14px', borderRadius: '14px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 850, color: '#0F172A' }}>
                        3. Dispatch Rules Matrix: Who to Send What (Granular Targeting)
                      </div>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748B', marginTop: '2px' }}>
                        Configure exact notification events for each receiver role. Assigned riders & waiters are delivered strictly to that specific individual staff member.
                      </div>
                    </div>

                    {/* Sub-card A: Customer / User */}
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '15px' }}>👤</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 850, color: '#0F172A' }}>Customer / App & Web User</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 650 }}>Controlled also in Customer Profile</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '6px' }}>
                        {(
                          [
                            { key: 'orderPlaced', label: 'Order Received / Placed' },
                            { key: 'cooking', label: 'Cooking / Preparing' },
                            { key: 'orderReady', label: 'Order Ready (Counter/Table/Rider)' },
                            { key: 'outForDelivery', label: 'Out for Delivery (Rider en route)' },
                            { key: 'orderCompleted', label: 'Order Delivered / Received' },
                            { key: 'orderCancelled', label: 'Order Cancelled' },
                          ] as Array<{ key: keyof RecipientNotificationRules['customer']; label: string }>
                        ).map((item) => {
                          const enabled = rulesDraft.recipientRules?.customer?.[item.key] !== false;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() =>
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
                              style={{
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: enabled ? '1.5px solid #86EFAC' : '1px solid #FECACA',
                                backgroundColor: enabled ? '#F0FDF4' : '#FEF2F2',
                                color: enabled ? '#15803D' : '#DC2626',
                                fontSize: '11.5px',
                                fontWeight: 750,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>{item.label}</span>
                              <span style={{ fontSize: '10px', fontWeight: 850 }}>{enabled ? 'ALLOW' : 'BLOCK'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sub-card B: Delivery Rider (Individual Only) */}
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '15px' }}>🛵</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 850, color: '#0F172A' }}>Assigned Delivery Rider</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', backgroundColor: '#DCFCE7', color: '#166534' }}>
                            Strictly THAT Rider Only
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '6px' }}>
                        {(
                          [
                            { key: 'orderAssigned', label: 'Order Assigned to Rider (Only That Rider)' },
                            { key: 'orderReady', label: 'Delivery Order Ready for Dispatch' },
                            { key: 'orderCancelled', label: 'Delivery Order Cancelled' },
                          ] as Array<{ key: keyof RecipientNotificationRules['rider']; label: string }>
                        ).map((item) => {
                          const enabled = rulesDraft.recipientRules?.rider?.[item.key] !== false;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() =>
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
                              style={{
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: enabled ? '1.5px solid #86EFAC' : '1px solid #FECACA',
                                backgroundColor: enabled ? '#F0FDF4' : '#FEF2F2',
                                color: enabled ? '#15803D' : '#DC2626',
                                fontSize: '11.5px',
                                fontWeight: 750,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>{item.label}</span>
                              <span style={{ fontSize: '10px', fontWeight: 850 }}>{enabled ? 'ALLOW' : 'BLOCK'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sub-card C: Floor Staff / Waiter (Individual Only) */}
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '15px' }}>🍽️</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 850, color: '#0F172A' }}>Assigned Floor Staff / Waiter</span>
                          <span style={{ fontSize: '10.5px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', backgroundColor: '#DBEAFE', color: '#1E40AF' }}>
                            Strictly THAT Waiter Only
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '6px' }}>
                        {(
                          [
                            { key: 'orderAssigned', label: 'Table / Order Assigned to Waiter' },
                            { key: 'orderReady', label: 'Dine-In Order Ready to Serve' },
                            { key: 'orderCancelled', label: 'Dine-In Order Cancelled' },
                          ] as Array<{ key: keyof RecipientNotificationRules['waiter']; label: string }>
                        ).map((item) => {
                          const enabled = rulesDraft.recipientRules?.waiter?.[item.key] !== false;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() =>
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
                              style={{
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: enabled ? '1.5px solid #86EFAC' : '1px solid #FECACA',
                                backgroundColor: enabled ? '#F0FDF4' : '#FEF2F2',
                                color: enabled ? '#15803D' : '#DC2626',
                                fontSize: '11.5px',
                                fontWeight: 750,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>{item.label}</span>
                              <span style={{ fontSize: '10px', fontWeight: 850 }}>{enabled ? 'ALLOW' : 'BLOCK'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sub-card D: Kitchen Staff */}
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '15px' }}>👨‍🍳</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 850, color: '#0F172A' }}>Kitchen Staff (Chefs)</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 650 }}>Ticket alerts to begin preparation</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '6px' }}>
                        {(
                          [
                            { key: 'newOrderPlaced', label: 'New Order Placed / Sent to Kitchen' },
                            { key: 'orderCancelled', label: 'Order Cancelled (Halt Cooking)' },
                          ] as Array<{ key: keyof RecipientNotificationRules['kitchen']; label: string }>
                        ).map((item) => {
                          const enabled = rulesDraft.recipientRules?.kitchen?.[item.key] !== false;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() =>
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
                              style={{
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: enabled ? '1.5px solid #86EFAC' : '1px solid #FECACA',
                                backgroundColor: enabled ? '#F0FDF4' : '#FEF2F2',
                                color: enabled ? '#15803D' : '#DC2626',
                                fontSize: '11.5px',
                                fontWeight: 750,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>{item.label}</span>
                              <span style={{ fontSize: '10px', fontWeight: 850 }}>{enabled ? 'ALLOW' : 'BLOCK'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sub-card E: Cashier & Branch Manager */}
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '15px' }}>💼</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 850, color: '#0F172A' }}>Cashier & Branch Manager</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '6px' }}>
                        {(
                          [
                            { key: 'orderPlaced', label: 'New Orders Placed at Branch' },
                            { key: 'orderCancelled', label: 'Order Cancellations' },
                            { key: 'paymentReceived', label: 'Payment Settlements & Cash' },
                          ] as Array<{ key: keyof RecipientNotificationRules['cashierAndManager']; label: string }>
                        ).map((item) => {
                          const enabled = rulesDraft.recipientRules?.cashierAndManager?.[item.key] !== false;
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() =>
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
                              style={{
                                padding: '7px 10px',
                                borderRadius: '8px',
                                border: enabled ? '1.5px solid #86EFAC' : '1px solid #FECACA',
                                backgroundColor: enabled ? '#F0FDF4' : '#FEF2F2',
                                color: enabled ? '#15803D' : '#DC2626',
                                fontSize: '11.5px',
                                fontWeight: 750,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <span>{item.label}</span>
                              <span style={{ fontSize: '10px', fontWeight: 850 }}>{enabled ? 'ALLOW' : 'BLOCK'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Per-Event Send vs Stop Switches */}
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 850, color: '#0F172A', marginBottom: '8px' }}>
                      4. Master Automated Order Notification Triggers (Send vs Stop)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {NOTIFICATION_EVENT_RULES.map((rule) => {
                        const isEnabled = rulesDraft.events[rule.key] !== false;
                        return (
                          <div
                            key={rule.key}
                            style={{
                              padding: '10px 12px',
                              borderRadius: '11px',
                              backgroundColor: isEnabled ? '#FFFFFF' : '#FEF2F2',
                              border: isEnabled ? '1px solid #E2E8F0' : '1px solid #FECACA',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px',
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '12.5px', fontWeight: 800, color: '#0F172A' }}>
                                {rule.label}
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginTop: '2px' }}>
                                {rule.description}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                changeRulesDraft((prev) => ({
                                  ...prev,
                                  events: {
                                    ...prev.events,
                                    [rule.key]: !isEnabled,
                                  },
                                }))
                              }
                              style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: isEnabled ? '#16A34A' : '#DC2626',
                                color: '#FFFFFF',
                                fontSize: '11px',
                                fontWeight: 850,
                                cursor: 'pointer',
                                flexShrink: 0,
                                minWidth: '84px',
                              }}
                            >
                              {isEnabled ? 'SENDING' : 'STOPPED'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <button
                type="button"
                disabled={isSavingRules}
                onClick={handleSaveRules}
                style={{
                  padding: '12px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: isSavingRules ? '#FDBA74' : '#EA580C',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  fontWeight: 850,
                  cursor: isSavingRules ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(234, 88, 12, 0.3)',
                }}
              >
                <Save size={16} />
                <span>
                  {isSavingRules
                    ? 'Saving Rules Permanently...'
                    : rulesScope === 'my' || !canSend
                      ? 'Save My Independent Receiver Rules'
                      : 'Save Global Notification Rules Permanently'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
