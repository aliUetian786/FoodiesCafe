'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { Complaint, Order } from '@/types/cafe';
import {
  MessageSquare,
  Send,
  User,
  Phone,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  CornerUpRight,
  ShieldAlert,
  ArrowRight,
  ShoppingBag,
  Bike,
  MapPin,
  Clock,
  Sparkles,
  Search,
  Receipt,
  Utensils,
  ChevronRight,
  ExternalLink,
  DollarSign,
  Package,
  X,
  Filter,
  Lock,
  Headphones,
  ChefHat,
  Timer,
} from 'lucide-react';

const parseTimestampMs = (ts?: string): number => {
  if (!ts) return 0;
  const t = new Date(ts).getTime();
  return isNaN(t) ? 0 : t;
};

const formatMessageTime = (timestamp?: string): string => {
  if (!timestamp) return 'Just now';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return timestamp;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const getNormalizedDate = (timestamp?: string): Date => {
  if (!timestamp) return new Date();
  const d = new Date(timestamp);
  if (!isNaN(d.getTime())) return d;
  if (timestamp.toLowerCase().includes('yesterday')) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  return new Date();
};

const getDayKey = (timestamp?: string): string => {
  const d = getNormalizedDate(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const getDayDividerLabel = (timestamp?: string): string => {
  const d = getNormalizedDate(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfTarget) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const LiveOrderCountdown: React.FC<{ forwardToKitchenAt?: string }> = ({ forwardToKitchenAt }) => {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    if (!forwardToKitchenAt) return null;
    const diff = Math.floor((new Date(forwardToKitchenAt).getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    if (!forwardToKitchenAt) {
      setSecondsLeft(null);
      return;
    }
    const update = () => {
      const diff = Math.floor((new Date(forwardToKitchenAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(diff > 0 ? diff : 0);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [forwardToKitchenAt]);

  if (secondsLeft === null) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <span
      style={{
        fontSize: '11px',
        color: secondsLeft <= 30 ? '#DC2626' : '#D97706',
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {timeStr}
    </span>
  );
};

interface RepresentativeScreenProps {
  initialTab?: 'support' | 'takeaway' | 'delivery' | 'dine_in';
}

export const RepresentativeScreen: React.FC<RepresentativeScreenProps> = ({
  initialTab = 'support',
}) => {
  const {
    complaints,
    sendComplaintReply,
    updateComplaintStatus,
    submitComplaint,
    orders,
    updateOrderStatus,
    cancelOrder,
    currentBranch,
    requestRefund,
    addToast,
    allowRepresentativeMenuEdit,
    users,
    currentRole,
    decideRefund,
    refundRequests,
    sendOrderToKitchen,
    setOrderKitchenForwardTime,
    footerSettings,
    updateFooterSettings,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    fetchOlderOrders,
    filterOrdersToToday,
    assignRiderToOrder,
    unassignRiderFromOrder,
  } = useApp();

  const isManager = currentRole === 'branch_manager';

  const branchRiders = useMemo(() => {
    return users.filter(
      (u) => u.role === 'delivery_staff' && (!u.branchId || u.branchId === currentBranch.id)
    );
  }, [users, currentBranch.id]);

  const [activeTab, setActiveTab] = useState<'support' | 'takeaway' | 'delivery' | 'dine_in'>(initialTab);
  const [customTimeModalOrderId, setCustomTimeModalOrderId] = useState<string | null>(null);
  const [customMinutesInput, setCustomMinutesInput] = useState<number>(3);
  const [timerScope, setTimerScope] = useState<'specific' | 'whole'>('specific');
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('Customer requested order cancellation');
  const [selectedOrderForMenu, setSelectedOrderForMenu] = useState<Order | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<Order | null>(null);
  const [orderHistoryFilter, setOrderHistoryFilter] = useState<'all' | 'active' | 'completed'>('all');

  const handleConfirmCancelOrder = () => {
    if (!cancelModalOrder) return;
    cancelOrder(cancelModalOrder.id, cancelReasonInput || 'Cancelled by Customer Support prior to kitchen dispatch');
    addToast({
      type: 'warning',
      title: 'Order Cancelled',
      message: `Order #${cancelModalOrder.orderNumber} cancelled and removed from support table.`,
    });
    setCancelModalOrder(null);
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Branch filtered orders
  const branchOrders = useMemo(() => {
    return orders.filter((o) => !o.branchId || o.branchId === currentBranch.id);
  }, [orders, currentBranch.id]);

  // Orders routed directly to Customer Services awaiting kitchen dispatch (excluding cancelled)
  const ordersAwaitingKitchen = useMemo(() => {
    return branchOrders.filter((o) => o.status === 'placed' && !o.sentToKitchen);
  }, [branchOrders]);

  // ==========================================
  // TAKEAWAY ORDERS LIFECYCLE FOR BRANCH
  // ==========================================
  const allTakeawayOrders = useMemo(() => {
    return branchOrders.filter((o) => o.type === 'takeaway');
  }, [branchOrders]);

  const arrivedTakeawayOrders = useMemo(() => {
    return allTakeawayOrders.filter((o) => o.status === 'placed' || o.status === 'accepted');
  }, [allTakeawayOrders]);

  const preparingTakeawayOrders = useMemo(() => {
    return allTakeawayOrders.filter((o) => o.status === 'preparing');
  }, [allTakeawayOrders]);

  const readyTakeawayOrders = useMemo(() => {
    return allTakeawayOrders.filter((o) => o.status === 'ready');
  }, [allTakeawayOrders]);

  const completedTakeawayOrders = useMemo(() => {
    return allTakeawayOrders.filter((o) => o.status === 'completed');
  }, [allTakeawayOrders]);

  // ==========================================
  // DELIVERY ORDERS LIFECYCLE FOR BRANCH
  // ==========================================
  const allDeliveryOrders = useMemo(() => {
    return branchOrders.filter((o) => o.type === 'delivery');
  }, [branchOrders]);

  const arrivedDeliveryOrders = useMemo(() => {
    return allDeliveryOrders.filter((o) => o.status === 'placed' || o.status === 'accepted');
  }, [allDeliveryOrders]);

  const preparingDeliveryOrders = useMemo(() => {
    return allDeliveryOrders.filter((o) => o.status === 'preparing');
  }, [allDeliveryOrders]);

  const readyDeliveryOrders = useMemo(() => {
    return allDeliveryOrders.filter((o) => o.status === 'ready');
  }, [allDeliveryOrders]);

  const outDeliveryOrders = useMemo(() => {
    return allDeliveryOrders.filter((o) => o.status === 'out_for_delivery');
  }, [allDeliveryOrders]);

  const completedDeliveryOrders = useMemo(() => {
    return allDeliveryOrders.filter((o) => o.status === 'completed');
  }, [allDeliveryOrders]);

  // ==========================================
  // DINE-IN ORDERS LIFECYCLE FOR BRANCH
  // ==========================================
  const allDineInOrders = useMemo(() => {
    return branchOrders.filter((o) => o.type === 'dine_in');
  }, [branchOrders]);

  const arrivedDineInOrders = useMemo(() => {
    return allDineInOrders.filter((o) => o.status === 'placed' || o.status === 'accepted');
  }, [allDineInOrders]);

  const preparingDineInOrders = useMemo(() => {
    return allDineInOrders.filter((o) => o.status === 'preparing');
  }, [allDineInOrders]);

  const readyDineInOrders = useMemo(() => {
    return allDineInOrders.filter((o) => o.status === 'ready' || o.status === 'served');
  }, [allDineInOrders]);

  const completedDineInOrders = useMemo(() => {
    return allDineInOrders.filter((o) => o.status === 'completed');
  }, [allDineInOrders]);

  // ==========================================
  // ORDER LOOKUP & FILTER SEARCH STATES
  // ==========================================
  const [takeawayStatusTab, setTakeawayStatusTab] = useState<'all' | 'arrived' | 'preparing' | 'ready' | 'completed'>('all');
  const [takeawaySearch, setTakeawaySearch] = useState('');
  const [deliveryStatusTab, setDeliveryStatusTab] = useState<'all' | 'arrived' | 'preparing' | 'ready' | 'out' | 'completed'>('all');
  const [deliverySearch, setDeliverySearch] = useState('');
  const [dineInStatusTab, setDineInStatusTab] = useState<'all' | 'arrived' | 'preparing' | 'ready' | 'completed'>('all');
  const [dineInSearch, setDineInSearch] = useState('');

  const getOrderStatusBadge = (status: string, type: string) => {
    switch (status) {
      case 'placed':
      case 'accepted':
        return { label: 'ORDER ARRIVED', bg: '#FEF3C7', color: '#92400E' };
      case 'preparing':
        return { label: 'COOKING IN KITCHEN', bg: '#DBEAFE', color: '#1E40AF' };
      case 'ready':
        if (type === 'takeaway') return { label: 'READY TO TAKE', bg: '#DCFCE7', color: '#166534' };
        if (type === 'delivery') return { label: 'READY TO SHIP', bg: '#DCFCE7', color: '#166534' };
        return { label: 'READY FOR SERVICE', bg: '#DCFCE7', color: '#166534' };
      case 'out_for_delivery':
        return { label: 'OUT FOR DELIVERY', bg: '#F3E8FF', color: '#6B21A8' };
      case 'served':
        return { label: 'SERVED TO TABLE', bg: '#E0E7FF', color: '#3730A3' };
      case 'completed':
        return { label: 'COMPLETED', bg: '#F1F5F9', color: '#334155' };
      case 'cancelled':
        return { label: 'CANCELLED', bg: '#FEE2E2', color: '#991B1B' };
      default:
        return { label: status.toUpperCase(), bg: '#F1F5F9', color: '#475569' };
    }
  };

  // -------------------------------------------------------------
  // SUPPORT & QUERIES: 3-CATEGORY STATE & CUSTOMER AGGREGATION
  // -------------------------------------------------------------
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'inquiries' | 'orders'>('all');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [readCustomerKeys, setReadCustomerKeys] = useState<Set<string>>(new Set());
  const [readCustomerTimestamps, setReadCustomerTimestamps] = useState<Record<string, number>>({});
  const [targetScrollMessageId, setTargetScrollMessageId] = useState<string | null>(null);

  // Build a distinct, unified customer list from complaints, orders, and registered customers
  interface UnifiedCustomer {
    key: string;
    id: string;
    name: string;
    phone: string;
    email?: string;
    deliveryAddress?: string;
    hasActiveInquiry: boolean;
    hasNewComplaint: boolean;
    unreadCount: number;
    activeTicket?: Complaint;
    orderCount: number;
    lastOrder?: Order;
    latestInteractionTime: string;
    latestTimestampMs: number;
  }

  const unifiedCustomers: UnifiedCustomer[] = useMemo(() => {
    const map = new Map<string, UnifiedCustomer>();

    // 1. Add all customers from complaints
    complaints.forEach((cmp) => {
      const phoneClean = cmp.customerPhone?.replace(/\s+/g, '') || cmp.customerId;
      const key = phoneClean || cmp.id;
      const latestMsgMs = cmp.messages && cmp.messages.length > 0
        ? Math.max(...cmp.messages.map((m) => parseTimestampMs(m.timestamp)))
        : parseTimestampMs(cmp.createdAt);

      // Trailing unread messages from customer (messages sent by customer since last reply)
      let cmpUnread = 0;
      if (cmp.messages && cmp.messages.length > 0) {
        for (let i = cmp.messages.length - 1; i >= 0; i--) {
          if (cmp.messages[i].sender === 'customer') {
            cmpUnread++;
          } else {
            break;
          }
        }
      }
      if (cmpUnread === 0 && cmp.status === 'new') {
        cmpUnread = 1;
      }

      const isNewComplaint = (cmp.status === 'new') || (cmp.status === 'in_progress' && cmpUnread > 0);

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          id: cmp.customerId,
          name: cmp.customerName,
          phone: cmp.customerPhone,
          hasActiveInquiry: cmp.status === 'new' || cmp.status === 'in_progress',
          hasNewComplaint: isNewComplaint,
          unreadCount: isNewComplaint ? cmpUnread : 0,
          activeTicket: cmp,
          orderCount: 0,
          latestInteractionTime: cmp.createdAt || 'Recent',
          latestTimestampMs: latestMsgMs,
        });
      } else {
        if (!existing.activeTicket || cmp.status === 'new' || (cmp.status === 'in_progress' && cmpUnread > 0)) {
          existing.activeTicket = cmp;
          existing.hasActiveInquiry = cmp.status === 'new' || cmp.status === 'in_progress';
        }
        if (isNewComplaint) {
          existing.hasNewComplaint = true;
          existing.unreadCount = (existing.unreadCount || 0) + cmpUnread;
        }
        existing.latestTimestampMs = Math.max(existing.latestTimestampMs, latestMsgMs);
      }
    });

    // 2. Add or enrich with customers from orders
    orders.forEach((ord) => {
      if (!ord.customerPhone && !ord.customerName) return;
      const phoneClean = ord.customerPhone?.replace(/\s+/g, '') || ord.customerId;
      const key = phoneClean || ord.customerName;
      const ordMs = parseTimestampMs(ord.createdAt);
      const existing = map.get(key);
      if (existing) {
        existing.orderCount += 1;
        if (!existing.lastOrder) existing.lastOrder = ord;
        if (!existing.deliveryAddress && ord.deliveryAddress) existing.deliveryAddress = ord.deliveryAddress;
        existing.latestTimestampMs = Math.max(existing.latestTimestampMs, ordMs);
      } else {
        map.set(key, {
          key,
          id: ord.customerId || `cust-${ord.id}`,
          name: ord.customerName,
          phone: ord.customerPhone,
          deliveryAddress: ord.deliveryAddress,
          hasActiveInquiry: false,
          hasNewComplaint: false,
          unreadCount: 0,
          orderCount: 1,
          lastOrder: ord,
          latestInteractionTime: ord.createdAt || 'Recent',
          latestTimestampMs: ordMs,
        });
      }
    });

    // 3. Include registered customer users if not already present
    users
      .filter((u) => u.role === 'customer')
      .forEach((u) => {
        const phoneClean = u.phone?.replace(/\s+/g, '') || u.id;
        const key = phoneClean || u.id;
        if (!map.has(key)) {
          map.set(key, {
            key,
            id: u.id,
            name: u.name,
            phone: u.phone,
            email: u.email,
            deliveryAddress: u.address,
            hasActiveInquiry: false,
            hasNewComplaint: false,
            unreadCount: 0,
            orderCount: 0,
            latestInteractionTime: 'Active User',
            latestTimestampMs: 0,
          });
        }
      });

    return Array.from(map.values());
  }, [complaints, orders, users]);

  // Filtered customer list (sorted so incoming complaint senders appear on TOP, followed by latest message time)
  const filteredCustomers = useMemo(() => {
    const list = unifiedCustomers.filter((c) => {
      // Filter by type
      if (customerFilter === 'inquiries' && !c.hasActiveInquiry) return false;
      if (customerFilter === 'orders' && c.orderCount === 0) return false;

      // Filter by search
      if (customerSearch.trim()) {
        const q = customerSearch.toLowerCase().replace(/^#/, '');
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q);
        const matchesTicket = c.activeTicket?.ticketNumber?.toLowerCase().includes(q);
        const matchesOrder = orders.some((o) => {
          const isThisCust =
            (c.id && o.customerId === c.id) ||
            (c.phone && o.customerPhone?.replace(/\s+/g, '') === c.phone?.replace(/\s+/g, '')) ||
            (c.name && o.customerName?.toLowerCase().trim() === c.name?.toLowerCase().trim());
          return isThisCust && (o.orderNumber?.toLowerCase().includes(q) || o.id.toLowerCase().includes(q));
        });
        return matchesName || matchesPhone || matchesTicket || matchesOrder;
      }
      return true;
    });

    // Dynamically sort:
    // 1. Senders with unread incoming complaints appear at the absolute TOP of sender list!
    // 2. Secondary sort: newest incoming / latest message sender first
    return list.sort((a, b) => {
      const aIsRead = readCustomerKeys.has(a.key) || (readCustomerTimestamps[a.key] && readCustomerTimestamps[a.key] >= a.latestTimestampMs);
      const bIsRead = readCustomerKeys.has(b.key) || (readCustomerTimestamps[b.key] && readCustomerTimestamps[b.key] >= b.latestTimestampMs);
      const aUnread = a.hasNewComplaint && !aIsRead;
      const bUnread = b.hasNewComplaint && !bIsRead;

      if (aUnread !== bUnread) {
        return aUnread ? -1 : 1;
      }
      return b.latestTimestampMs - a.latestTimestampMs;
    });
  }, [unifiedCustomers, customerFilter, customerSearch, orders, readCustomerKeys, readCustomerTimestamps]);

  // Ensure active selected customer
  const activeCustomer = useMemo(() => {
    if (selectedCustomerKey) {
      const found = unifiedCustomers.find((c) => c.key === selectedCustomerKey);
      if (found) return found;
    }
    return filteredCustomers[0] || unifiedCustomers[0] || null;
  }, [selectedCustomerKey, unifiedCustomers, filteredCustomers]);

  // Automatically update selected key if empty
  useEffect(() => {
    if (!selectedCustomerKey && activeCustomer) {
      setSelectedCustomerKey(activeCustomer.key);
    }
  }, [selectedCustomerKey, activeCustomer]);

  // Direct orders fetched for the active customer
  const customerOrders = useMemo(() => {
    if (!activeCustomer) return [];
    const activePhoneClean = activeCustomer.phone?.replace(/\s+/g, '');
    const activeName = activeCustomer.name?.toLowerCase().trim();

    return orders.filter((o) => {
      if (activeCustomer.id && o.customerId === activeCustomer.id) return true;
      if (activePhoneClean && o.customerPhone?.replace(/\s+/g, '') === activePhoneClean) return true;
      if (activeName && o.customerName?.toLowerCase().trim() === activeName) return true;
      return false;
    });
  }, [orders, activeCustomer]);

  // Active customer orders (placed, preparing, ready, out_for_delivery)
  const activeCustomerLiveOrders = useMemo(() => {
    return customerOrders.filter(
      (o) => o.status === 'placed' || o.status === 'preparing' || o.status === 'ready' || o.status === 'out_for_delivery'
    );
  }, [customerOrders]);

  // Past orders for customer
  const pastCustomerOrders = useMemo(() => {
    return customerOrders.filter(
      (o) => o.status === 'completed' || o.status === 'cancelled' || o.status === 'served'
    );
  }, [customerOrders]);

  // Filtered orders list for Card 3 scrollable view
  const filteredCustomerOrders = useMemo(() => {
    if (orderHistoryFilter === 'active') return activeCustomerLiveOrders;
    if (orderHistoryFilter === 'completed') return pastCustomerOrders;
    return customerOrders;
  }, [customerOrders, activeCustomerLiveOrders, pastCustomerOrders, orderHistoryFilter]);

  // Total customer spend
  const customerTotalSpend = useMemo(() => {
    return customerOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  }, [customerOrders]);

  // Find active ticket / complaint for selected customer
  const activeTicket = useMemo(() => {
    if (!activeCustomer) return null;
    const phoneClean = activeCustomer.phone?.replace(/\s+/g, '');
    return (
      complaints.find(
        (c) =>
          c.customerId === activeCustomer.id ||
          (phoneClean && c.customerPhone?.replace(/\s+/g, '') === phoneClean)
      ) || activeCustomer.activeTicket || null
    );
  }, [activeCustomer, complaints]);

  // Find all tickets for selected customer (sorted chronologically)
  const activeCustomerTickets = useMemo(() => {
    if (!activeCustomer) return [];
    const phoneClean = activeCustomer.phone?.replace(/\s+/g, '');
    const list = complaints.filter(
      (c) =>
        c.customerId === activeCustomer.id ||
        (phoneClean && c.customerPhone?.replace(/\s+/g, '') === phoneClean)
    );
    if (list.length === 0 && activeCustomer.activeTicket) {
      list.push(activeCustomer.activeTicket);
    }
    return [...list].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activeCustomer, complaints]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Helper to find the first unseen message from this customer
  const findFirstUnreadCustomerMsgId = (cust: UnifiedCustomer): string | null => {
    const ticket = cust.activeTicket;
    if (!ticket || !ticket.messages || ticket.messages.length === 0) return null;

    let lastRepIdx = -1;
    for (let i = ticket.messages.length - 1; i >= 0; i--) {
      if (ticket.messages[i].sender !== 'customer') {
        lastRepIdx = i;
        break;
      }
    }
    const firstUnreadIdx = lastRepIdx + 1;
    if (firstUnreadIdx < ticket.messages.length && ticket.messages[firstUnreadIdx].sender === 'customer') {
      return ticket.messages[firstUnreadIdx].id;
    }
    if (ticket.messages.length > 0 && ticket.messages[0].sender === 'customer') {
      return ticket.messages[0].id;
    }
    return null;
  };

  // Handle clicking customer from list
  const handleSelectCustomer = (cust: UnifiedCustomer) => {
    setSelectedCustomerKey(cust.key);

    const isMarkedRead =
      readCustomerKeys.has(cust.key) ||
      (readCustomerTimestamps[cust.key] && readCustomerTimestamps[cust.key] >= cust.latestTimestampMs);
    const hasUnread = cust.hasNewComplaint && !isMarkedRead;

    // Direct scroll to unseen message if customer has unread message
    const unreadMsgId = hasUnread ? findFirstUnreadCustomerMsgId(cust) : null;

    // Mark customer chat as opened and read
    setReadCustomerKeys((prev) => {
      const next = new Set(prev);
      next.add(cust.key);
      return next;
    });
    setReadCustomerTimestamps((prev) => ({
      ...prev,
      [cust.key]: Date.now(),
    }));

    // If ticket is new, advance status to in_progress
    if (cust.activeTicket && cust.activeTicket.status === 'new') {
      updateComplaintStatus(cust.activeTicket.id, 'in_progress');
    }

    if (unreadMsgId) {
      setTargetScrollMessageId(unreadMsgId);
      setTimeout(() => {
        const el = document.getElementById(`rep-msg-${unreadMsgId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 80);
    } else {
      setTargetScrollMessageId(null);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  };

  // Auto-scroll chat: directly to unseen message if pending, or to bottom
  useEffect(() => {
    if (targetScrollMessageId) {
      const el = document.getElementById(`rep-msg-${targetScrollMessageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeCustomerTickets, targetScrollMessageId]);

  // Handle send reply in chat
  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isManager) return; // Manager cannot answer customer queries
    if (!chatInput.trim() || !activeCustomer) return;

    setTargetScrollMessageId(null);

    if (activeTicket) {
      sendComplaintReply(activeTicket.id, chatInput.trim());
    } else {
      // Create new complaint thread directly with this customer
      submitComplaint('Direct Support Inquiry', chatInput.trim(), activeCustomer.lastOrder?.id);
    }

    setChatInput('');
  };

  // Escalate
  const handleEscalate = () => {
    addToast({
      type: 'warning',
      title: 'Ticket Escalated',
      message: `Ticket #${activeTicket?.ticketNumber || 'TKT-LIVE'} escalated to Branch Manager Rashid Mehmood.`,
    });
  };

  // Close / Resolve ticket (throws away in-progress tag completely)
  const handleCloseTicket = () => {
    if (!activeTicket) return;
    updateComplaintStatus(activeTicket.id, 'closed');
    if (activeCustomer) {
      setReadCustomerKeys((prev) => {
        const next = new Set(prev);
        next.add(activeCustomer.key);
        return next;
      });
    }
    setTargetScrollMessageId(null);
    addToast({
      type: 'success',
      title: 'Ticket Resolved',
      message: `Inquiry #${activeTicket.ticketNumber} marked resolved and matter completed.`,
    });
  };

  const renderOrderCard = (ord: Order) => {
    const statusInfo = getOrderStatusBadge(ord.status, ord.type);
    const isAwaitingKitchen = !ord.sentToKitchen && (ord.status === 'placed' || ord.status === 'accepted');

    return (
      <div
        key={ord.id}
        onClick={() => setSelectedOrderDetail(ord)}
        style={{
          width: '340px',
          minWidth: '340px',
          maxWidth: '340px',
          minHeight: '175px',
          maxHeight: '205px',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-md)',
          border:
            ord.status === 'placed' || ord.status === 'accepted'
              ? '2px solid #F59E0B'
              : ord.status === 'ready' || ord.status === 'served'
              ? '2px solid #16A34A'
              : ord.status === 'out_for_delivery'
              ? '2px solid #2563EB'
              : '1px solid var(--border-color)',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxSizing: 'border-box',
        }}
      >
        {/* Top: Order #, Status, Time/Table */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 850, fontSize: '15px', color: 'var(--text-main)' }}>
              #{ord.orderNumber}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 800,
                backgroundColor: statusInfo.bg,
                color: statusInfo.color,
                padding: '2px 7px',
                borderRadius: '4px',
                textTransform: 'uppercase',
              }}
            >
              {statusInfo.label}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {ord.type === 'dine_in' && ord.tableNumber
              ? `Table ${ord.tableNumber}`
              : ord.pickupTime || (ord.createdAt ? formatMessageTime(ord.createdAt) : 'Recent')}
          </span>
        </div>

        {/* Customer & Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 0' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {ord.customerName}
            </div>
            {ord.customerPhone && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                📞 {ord.customerPhone}
              </span>
            )}
          </div>
          <span style={{ fontWeight: 900, color: 'var(--text-main)', fontSize: '14px', flexShrink: 0 }}>
            Rs. {Number(ord.total).toLocaleString()}
          </span>
        </div>

        {/* Sub info & items count hint (no item detail text) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
            {ord.type === 'dine_in' ? (
              <span>{ord.tableNumber ? `Dine-In • Table ${ord.tableNumber}` : 'Dine-In Table'}</span>
            ) : ord.type === 'delivery' ? (
              <>
                <MapPin size={11} color="var(--primary)" style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ord.deliveryAddress || 'Customer Address'}
                </span>
              </>
            ) : (
              <span>Counter Handover</span>
            )}
          </div>
          <span style={{ color: 'var(--primary)', fontWeight: 750, flexShrink: 0 }}>
            📦 {ord.items.length} Items (View)
          </span>
        </div>

        {/* Bottom Actions Bar */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '6px',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-color)',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: ord.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
              color: ord.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
              whiteSpace: 'nowrap',
            }}
          >
            {ord.paymentStatus === 'paid' ? 'PAID' : 'CASH'}
          </span>

          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            {isAwaitingKitchen ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCancelModalOrder(ord);
                    setCancelReasonInput('Cancelled by Customer Support prior to kitchen dispatch');
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #FCA5A5',
                    color: '#DC2626',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomTimeModalOrderId(ord.id);
                    setCustomMinutesInput(ord.autoForwardCustomMin || footerSettings?.autoForwardKitchenMin || 3);
                    setTimerScope('specific');
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: ord.forwardToKitchenAt ? '#FEF3C7' : 'var(--bg-card-subtle)',
                    border: ord.forwardToKitchenAt ? '1px solid #FDE68A' : '1px solid var(--border-color)',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    color: ord.forwardToKitchenAt ? '#B45309' : 'var(--text-secondary)',
                  }}
                  title="Click to set timer for this order or whole orders"
                >
                  <Clock size={11} />
                  {ord.forwardToKitchenAt ? (
                    <LiveOrderCountdown forwardToKitchenAt={ord.forwardToKitchenAt} />
                  ) : (
                    <span>Set Timer</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => sendOrderToKitchen(ord.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '11px',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <Utensils size={11} />
                  <span>Mark Kitchen Ready</span>
                </button>
              </>
            ) : (
              <>
                {ord.status !== 'completed' && ord.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelModalOrder(ord);
                      setCancelReasonInput('Customer requested order cancellation');
                    }}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #FCA5A5',
                      color: '#DC2626',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}

                {ord.sentToKitchen && (ord.status === 'placed' || ord.status === 'accepted') && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', padding: '3px 6px', borderRadius: '4px', backgroundColor: '#FEF3C7' }}>
                    🍳 In Queue
                  </span>
                )}

                {ord.status === 'preparing' && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563EB', padding: '3px 6px', borderRadius: '4px', backgroundColor: '#EFF6FF' }}>
                    👨‍🍳 Cooking
                  </span>
                )}

                {ord.type === 'takeaway' && ord.status === 'ready' && (
                  <button
                    type="button"
                    onClick={() => {
                      updateOrderStatus(ord.id, 'completed');
                      addToast({
                        type: 'success',
                        title: 'Takeaway Handed Over',
                        message: `Order #${ord.orderNumber} handed to ${ord.customerName}.`,
                      });
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Hand Over ✓
                  </button>
                )}

                {ord.type === 'delivery' && ord.status !== 'completed' && ord.status !== 'cancelled' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                      <select
                        value={ord.assignedRiderId || ''}
                        onChange={(e) => {
                          const rId = e.target.value;
                          if (rId) {
                            assignRiderToOrder(ord.id, rId);
                          } else {
                            unassignRiderFromOrder(ord.id);
                          }
                        }}
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px 3px 24px',
                          borderRadius: '8px',
                          backgroundColor: ord.assignedRiderId ? '#FFF7ED' : '#EFF6FF',
                          color: ord.assignedRiderId ? '#C2410C' : '#1D4ED8',
                          border: `1px solid ${ord.assignedRiderId ? '#FFEDD5' : '#BFDBFE'}`,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="">
                          {ord.assignedRiderId ? 'Unassign Rider' : '+ Assign Rider'}
                        </option>
                        {(() => {
                          const options = [...branchRiders];
                          if (ord.assignedRiderId && !options.some((r) => r.id === ord.assignedRiderId)) {
                            const ex = users.find((u) => u.id === ord.assignedRiderId);
                            if (ex) options.push(ex);
                            else if (ord.assignedRiderName) {
                              options.push({ id: ord.assignedRiderId, name: ord.assignedRiderName } as any);
                            }
                          }
                          return options.map((r) => {
                            const isAvail = r.riderAvailability !== 'busy' && r.riderAvailability !== 'offline';
                            const isCurrent = r.id === ord.assignedRiderId;
                            const statusLabel = isCurrent
                              ? 'Assigned'
                              : r.riderAvailability === 'busy'
                              ? 'Busy'
                              : r.riderAvailability === 'offline'
                              ? 'Offline'
                              : 'Ready';
                            return (
                              <option key={r.id} value={r.id}>
                                {r.name} ({statusLabel})
                              </option>
                            );
                          });
                        })()}
                      </select>
                      <Bike
                        size={12}
                        color={ord.assignedRiderId ? '#EA580C' : '#2563EB'}
                        style={{ position: 'absolute', left: '7px', pointerEvents: 'none' }}
                      />
                    </div>
                  </div>
                )}

                {ord.type === 'delivery' && ord.status === 'ready' && (
                  <button
                    type="button"
                    onClick={() => {
                      updateOrderStatus(ord.id, 'out_for_delivery');
                      addToast({
                        type: 'info',
                        title: 'Order Dispatched',
                        message: `Order #${ord.orderNumber} is now out for delivery with rider.`,
                      });
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#EA580C',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Send size={11} />
                    <span>Dispatch Rider →</span>
                  </button>
                )}

                {ord.type === 'delivery' && ord.status === 'out_for_delivery' && (
                  <button
                    type="button"
                    onClick={() => {
                      updateOrderStatus(ord.id, 'completed');
                      addToast({
                        type: 'success',
                        title: 'Delivered',
                        message: `Order #${ord.orderNumber} marked as delivered.`,
                      });
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Delivered ✓
                  </button>
                )}

                {ord.type === 'dine_in' && (ord.status === 'ready' || ord.status === 'served') && (
                  <button
                    type="button"
                    onClick={() => {
                      updateOrderStatus(ord.id, 'completed');
                      addToast({
                        type: 'success',
                        title: 'Table Completed',
                        message: `Table ${ord.tableNumber || ''} Order #${ord.orderNumber} marked completed.`,
                      });
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#16A34A',
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '11px',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Complete Table ✓
                  </button>
                )}

                {ord.status === 'completed' && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A' }}>
                    ✓ Closed
                  </span>
                )}

                {ord.status === 'cancelled' && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626' }}>
                    ✕ Cancelled
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '100%',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* ========================================================================= */}
      {/* TAB 1: CUSTOMER SERVICES (STATIC 3-CARD WORKSPACE WITH HAIR-THIN GAP)     */}
      {/* ========================================================================= */}
      {activeTab === 'support' && (
        <div
          style={{
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '320px 1fr 380px',
            gap: '1px', // Hair-thin gap separation between cards
            backgroundColor: 'var(--border-color)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
            overscrollBehavior: 'none',
          }}
        >
          {/* ===================================================================== */}
          {/* CARD 1 (LEFT): CUSTOMERS LIST                                         */}
          {/* ===================================================================== */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              height: '100%',
              maxHeight: '100%',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Header & Search (Static Top of Card 1) */}
            <div style={{ flexShrink: 0, padding: '14px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Customers List ({filteredCustomers.length})
                  </span>
                  {unifiedCustomers.some((c) => {
                    const isRead = readCustomerKeys.has(c.key) || (readCustomerTimestamps[c.key] && readCustomerTimestamps[c.key] >= c.latestTimestampMs);
                    return c.hasNewComplaint && !isRead;
                  }) && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        backgroundColor: '#DC2626',
                        color: '#FFFFFF',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      ● {unifiedCustomers.filter((c) => {
                        const isRead = readCustomerKeys.has(c.key) || (readCustomerTimestamps[c.key] && readCustomerTimestamps[c.key] >= c.latestTimestampMs);
                        return c.hasNewComplaint && !isRead;
                      }).length} Urgent
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Active Sync</span>
              </div>

              {/* Search Box */}
              <div style={{ position: 'relative' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Search customer or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 30px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['all', 'inquiries', 'orders'] as const).map((mode) => {
                  const urgentCount = mode === 'inquiries' ? unifiedCustomers.filter((c) => {
                    const isRead = readCustomerKeys.has(c.key) || (readCustomerTimestamps[c.key] && readCustomerTimestamps[c.key] >= c.latestTimestampMs);
                    return c.hasNewComplaint && !isRead;
                  }).length : 0;
                  return (
                    <button
                      key={mode}
                      onClick={() => setCustomerFilter(mode)}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: '1px solid var(--border-color)',
                        backgroundColor: customerFilter === mode ? 'var(--primary)' : 'var(--bg-card-subtle)',
                        color: customerFilter === mode ? '#FFFFFF' : 'var(--text-secondary)',
                        textTransform: 'capitalize',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>{mode === 'all' ? 'All' : mode === 'inquiries' ? 'Inquiries' : 'Orders'}</span>
                      {urgentCount > 0 && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 800,
                            backgroundColor: customerFilter === mode ? '#FFFFFF' : '#DC2626',
                            color: customerFilter === mode ? '#DC2626' : '#FFFFFF',
                            padding: '0 5px',
                            borderRadius: '8px',
                          }}
                        >
                          {urgentCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customers Scrollable List (Only customer list scrolls inside Card 1) */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain' }}>
              {filteredCustomers.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No customer matches found.
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const isSelected = activeCustomer?.key === cust.key;
                  const isMarkedRead =
                    readCustomerKeys.has(cust.key) ||
                    (readCustomerTimestamps[cust.key] && readCustomerTimestamps[cust.key] >= cust.latestTimestampMs);
                  const hasUnread = cust.hasNewComplaint && !isMarkedRead;
                  const isResolved = cust.activeTicket
                    ? cust.activeTicket.status === 'resolved' || cust.activeTicket.status === 'closed'
                    : false;
                  const hasTicket = !!cust.activeTicket;

                  const initials = cust.name
                    ? cust.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()
                    : 'CU';

                  return (
                    <div
                      key={cust.key}
                      onClick={() => handleSelectCustomer(cust)}
                      style={{
                        padding: '12px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isSelected
                          ? 'var(--primary-light)'
                          : hasUnread
                          ? '#FEF2F2'
                          : '#FFFFFF',
                        borderLeft: isSelected
                          ? '4px solid var(--primary)'
                          : hasUnread
                          ? '4px solid #DC2626'
                          : !isResolved && hasTicket
                          ? '4px solid #D97706'
                          : '4px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Avatar */}
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: hasUnread
                            ? '#FEE2E2'
                            : isSelected
                            ? 'var(--primary)'
                            : 'var(--bg-card-subtle)',
                          color: hasUnread
                            ? '#DC2626'
                            : isSelected
                            ? '#FFFFFF'
                            : 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '13px',
                          flexShrink: 0,
                          position: 'relative',
                        }}
                      >
                        {initials}
                        {hasUnread ? (
                          <span
                            title="New Unread Message"
                            style={{
                              position: 'absolute',
                              top: '-2px',
                              right: '-2px',
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: '#DC2626',
                              border: '2px solid #FFFFFF',
                              boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.4)',
                            }}
                          />
                        ) : !isResolved && hasTicket ? (
                          <span
                            title="Chat Opened · In Progress (Unresolved)"
                            style={{
                              position: 'absolute',
                              top: '-2px',
                              right: '-2px',
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: '#D97706',
                              border: '2px solid #FFFFFF',
                            }}
                          />
                        ) : null}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontWeight: hasUnread ? 900 : 800,
                              fontSize: '13.5px',
                              color: hasUnread
                                ? '#DC2626'
                                : isSelected
                                ? 'var(--primary)'
                                : 'var(--text-main)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {cust.name}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                            {hasUnread && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 800,
                                  backgroundColor: '#DC2626',
                                  color: '#FFFFFF',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  boxShadow: '0 1px 3px rgba(220, 38, 38, 0.25)',
                                }}
                              >
                                ● {cust.unreadCount || 1} New
                              </span>
                            )}
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {cust.latestInteractionTime}
                            </span>
                          </div>
                        </div>

                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', margin: '2px 0' }}>
                          <Phone size={11} color={hasUnread ? '#DC2626' : 'var(--primary)'} />
                          <span>{cust.phone}</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          {cust.activeTicket ? (
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor:
                                  hasUnread
                                    ? '#FEE2E2'
                                    : isResolved
                                    ? '#DCFCE7'
                                    : '#FEF3C7',
                                color:
                                  hasUnread
                                    ? '#DC2626'
                                    : isResolved
                                    ? '#166534'
                                    : '#92400E',
                                border:
                                  hasUnread
                                    ? '1px solid #FCA5A5'
                                    : isResolved
                                    ? '1px solid #BBF7D0'
                                    : '1px solid #FDE68A',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              #{cust.activeTicket.ticketNumber}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {cust.lastOrder ? `Last: #${cust.lastOrder.orderNumber}` : 'Customer Contact'}
                            </span>
                          )}

                          {cust.orderCount > 0 && (
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                color: 'var(--text-secondary)',
                                backgroundColor: 'var(--bg-card-subtle)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              {cust.orderCount} Orders
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ===================================================================== */}
          {/* CATEGORY 2 (CENTER): DIRECT 1-ON-1 LIVE CHAT                           */}
          {/* ===================================================================== */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              maxHeight: '100%',
              backgroundColor: '#FAFAFA',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {activeCustomer ? (
              <>
                {/* Chat Top Header: Static at the top of Card 2 */}
                <div
                  style={{
                    flexShrink: 0,
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: '#FFFFFF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '13px',
                      }}
                    >
                      <User size={18} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {activeCustomer.name}
                        </span>
                        <a
                          href={`tel:${activeCustomer.phone}`}
                          style={{
                            fontSize: '12px',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <Phone size={11} />
                          {activeCustomer.phone}
                        </a>
                      </div>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {activeTicket
                          ? `Inquiry #${activeTicket.ticketNumber} · ${activeTicket.subject}`
                          : 'Direct Customer Channel · Ready for inquiries'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeTicket && (
                      <>
                        <button
                          type="button"
                          onClick={handleEscalate}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-color)',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#EA580C',
                          }}
                        >
                          <ShieldAlert size={13} />
                          <span>Escalate</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleCloseTicket}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: '#16A34A',
                            border: 'none',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>Resolve</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Messages Feed (Scrolls internally; minHeight: 0 prevents card expansion) */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    padding: '20px',
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {(() => {
                    let lastDayKey = '';
                    if (!activeCustomerTickets.some((t) => t.messages && t.messages.length > 0)) {
                      return (
                        <div
                          style={{
                            margin: 'auto',
                            textAlign: 'center',
                            maxWidth: '340px',
                            padding: '24px',
                            backgroundColor: '#FFFFFF',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px dashed var(--border-color)',
                          }}
                        >
                          <MessageSquare size={28} color="var(--primary)" style={{ margin: '0 auto 8px', display: 'block' }} />
                          <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                            Start Live Chat with {activeCustomer.name}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                            Send an instant direct update or reply. Messages synchronize to customer app in 0ms.
                          </p>
                        </div>
                      );
                    }

                    return activeCustomerTickets.map((ticket) => {
                      const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
                      const firstMsg = ticket.messages[0];
                      const ticketTimestamp = firstMsg?.timestamp || ticket.createdAt;
                      const ticketDayKey = getDayKey(ticketTimestamp);
                      const showDateDividerBeforeTopic = ticketDayKey !== lastDayKey;
                      if (showDateDividerBeforeTopic) {
                        lastDayKey = ticketDayKey;
                      }

                      return (
                        <React.Fragment key={ticket.id}>
                          {/* Date divider (e.g. Today) is written ABOVE the inquiry line */}
                          {showDateDividerBeforeTopic && (
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: '#E2E8F0',
                                  color: '#475569',
                                  padding: '3px 12px',
                                  borderRadius: '12px',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                  letterSpacing: '0.02em',
                                }}
                              >
                                {getDayDividerLabel(ticketTimestamp)}
                              </span>
                            </div>
                          )}

                          {/* Render inquiry topic banner */}
                          {ticket.ticketNumber && (
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0 2px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: '#FEF3C7',
                                  color: '#92400E',
                                  padding: '3px 14px',
                                  borderRadius: '12px',
                                  border: '1px solid #FDE68A',
                                }}
                              >
                                Inquiry #{ticket.ticketNumber} · {ticket.subject}
                              </span>
                            </div>
                          )}

                          {ticket.messages.map((m) => {
                            const isRep = m.sender !== 'customer';
                            const mDayKey = getDayKey(m.timestamp);
                            const showDateDivider = mDayKey !== lastDayKey;
                            if (showDateDivider) lastDayKey = mDayKey;
                            const isTargetUnseen = m.id === targetScrollMessageId;

                            return (
                              <React.Fragment key={m.id}>
                                {showDateDivider && (
                                  <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        backgroundColor: '#E2E8F0',
                                        color: '#475569',
                                        padding: '3px 12px',
                                        borderRadius: '12px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                        letterSpacing: '0.02em',
                                      }}
                                    >
                                      {getDayDividerLabel(m.timestamp)}
                                    </span>
                                  </div>
                                )}

                                {isTargetUnseen && (
                                  <div
                                    id="rep-unseen-divider"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '10px',
                                      margin: '12px 0 6px',
                                    }}
                                  >
                                    <div style={{ height: '1px', flex: 1, backgroundColor: '#DC2626', opacity: 0.35 }} />
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        backgroundColor: '#FEE2E2',
                                        color: '#DC2626',
                                        padding: '3px 12px',
                                        borderRadius: '12px',
                                        border: '1px solid #FCA5A5',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        boxShadow: '0 1px 4px rgba(220, 38, 38, 0.15)',
                                        letterSpacing: '0.02em',
                                      }}
                                    >
                                      ● Unread Message Below
                                    </span>
                                    <div style={{ height: '1px', flex: 1, backgroundColor: '#DC2626', opacity: 0.35 }} />
                                  </div>
                                )}

                                <div
                                  id={`rep-msg-${m.id}`}
                                  style={{
                                    alignSelf: isRep ? 'flex-end' : 'flex-start',
                                    maxWidth: '78%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    transition: 'all 0.3s ease',
                                  }}
                                >
                                  {/* Name removed above message bubble as requested */}
                                  <div
                                    style={{
                                      position: 'relative',
                                      padding: '10px 14px 22px 14px',
                                      borderRadius: isRep ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                                      backgroundColor: isRep ? 'var(--primary)' : '#FFFFFF',
                                      color: isRep ? '#FFFFFF' : 'var(--text-main)',
                                      border: isTargetUnseen
                                        ? '2px solid #DC2626'
                                        : isRep
                                        ? 'none'
                                        : '1px solid var(--border-color)',
                                      boxShadow: isTargetUnseen
                                        ? '0 0 0 3px rgba(220, 38, 38, 0.25), 0 2px 8px rgba(0,0,0,0.08)'
                                        : '0 1px 3px rgba(0,0,0,0.06)',
                                      fontSize: '13.5px',
                                      lineHeight: 1.45,
                                      minWidth: '85px',
                                    }}
                                  >
                                    <div style={{ wordBreak: 'break-word', paddingRight: '22px' }}>
                                      {m.text}
                                    </div>
                                    <div
                                      style={{
                                        position: 'absolute',
                                        bottom: '4px',
                                        right: '8px',
                                        fontSize: '10px',
                                        color: isRep ? 'rgba(255, 255, 255, 0.75)' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        userSelect: 'none',
                                      }}
                                    >
                                      {formatMessageTime(m.timestamp)}
                                      {isRep && <CheckCircle size={10} style={{ opacity: 0.85 }} />}
                                    </div>
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          })}

                          {/* When complaint is solved, display resolution message banner after last message */}
                          {isResolved && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '14px 0', gap: '8px' }}>
                              <div style={{ height: '1px', flex: 1, backgroundColor: '#86EFAC' }} />
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  backgroundColor: '#DCFCE7',
                                  color: '#15803D',
                                  padding: '4px 14px',
                                  borderRadius: '16px',
                                  border: '1px solid #BBF7D0',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  letterSpacing: '0.02em',
                                }}
                              >
                                <CheckCircle2 size={12} color="#16A34A" />
                                Matter has been resolved
                              </span>
                              <div style={{ height: '1px', flex: 1, backgroundColor: '#86EFAC' }} />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                  <div ref={messagesEndRef} />
                </div>

                {/* Bottom Input & Quick Chips: Static at bottom of Card 2 in line with card bottom */}
                <div style={{ flexShrink: 0, marginTop: 'auto' }}>
                  {isManager ? (
                    <div
                      style={{
                        padding: '16px 20px',
                        backgroundColor: '#FFFBEB',
                        borderTop: '1px solid #FDE68A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Lock size={16} color="#D97706" />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 800, color: '#92400E' }}>
                            Manager Oversight Mode: Query Answering Disabled
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#B45309' }}>
                            Customer inquiries are answered directly by Support Representatives. Managers review escalations and authorize refund actions.
                          </div>
                        </div>
                      </div>

                      {activeTicket && (activeTicket.status === 'new' || activeTicket.assignedTo === 'manager') && (
                        <button
                          type="button"
                          onClick={() => {
                            updateComplaintStatus(activeTicket.id, 'resolved');
                            addToast({
                              type: 'success',
                              title: 'Escalation Resolved',
                              message: `Ticket #${activeTicket.ticketNumber} marked resolved by Branch Manager.`,
                            });
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            backgroundColor: '#16A34A',
                            color: '#FFFFFF',
                            fontWeight: 750,
                            fontSize: '12px',
                            cursor: 'pointer',
                            border: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Approve & Resolve Escalation ✓
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Quick Canned Chips */}
                      <div
                        style={{
                          padding: '8px 16px 0',
                          display: 'flex',
                          gap: '6px',
                          overflowX: 'auto',
                          backgroundColor: '#FFFFFF',
                          borderTop: '1px solid var(--border-color)',
                        }}
                      >
                        {[
                          'Your order is ready at the counter!',
                          'Rider has picked up and is en route.',
                          'Checking with kitchen ustaad now...',
                          'We have credited Rs. 250 as courtesy.',
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setChatInput(chip)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              backgroundColor: 'var(--bg-card-subtle)',
                              border: '1px solid var(--border-color)',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                            }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>

                      {/* Chat Composer */}
                      <form
                        onSubmit={handleSendChat}
                        style={{
                          padding: '12px 16px',
                          backgroundColor: '#FFFFFF',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                        }}
                      >
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder={`Reply directly to ${activeCustomer.name}...`}
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            fontSize: '13px',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="submit"
                          style={{
                            padding: '10px 18px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--primary)',
                            color: '#FFFFFF',
                            fontWeight: 700,
                            fontSize: '13px',
                            cursor: 'pointer',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Send size={14} />
                          <span>Send</span>
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '13.5px' }}>
                Select a customer from the left list to open direct chat.
              </div>
            )}
          </div>

          {/* ===================================================================== */}
          {/* CATEGORY 3 (RIGHT): DIRECT ORDER HISTORY OF THIS SPECIFIC USER         */}
          {/* ===================================================================== */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              height: '100%',
              maxHeight: '100%',
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Header & Quick Stats (Static Top of Card 3) */}
            <div
              style={{
                flexShrink: 0,
                padding: '12px 14px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Customer Order History
                </span>
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {customerOrders.length} Records
                </span>
              </div>

              {activeCustomer && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                      Customer: <strong>{activeCustomer.name}</strong>
                    </p>
                    {activeCustomer.phone && (
                      <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>
                        {activeCustomer.phone}
                      </span>
                    )}
                  </div>

                  {/* Customer Quick Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', textAlign: 'center' }}>
                    <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL ORDERS</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {customerOrders.length}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700 }}>SPENT</div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--primary)' }}>
                        Rs. {customerTotalSpend.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '5px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700 }}>ACTIVE</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#16A34A' }}>
                        {activeCustomerLiveOrders.length}
                      </div>
                    </div>
                  </div>

                  {/* Filter Pills for Orders List */}
                  <div style={{ display: 'flex', gap: '6px', paddingTop: '2px' }}>
                    {(['all', 'active', 'completed'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setOrderHistoryFilter(mode)}
                        style={{
                          flex: 1,
                          padding: '4px 6px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: '1px solid var(--border-color)',
                          backgroundColor: orderHistoryFilter === mode ? 'var(--primary)' : 'var(--bg-card-subtle)',
                          color: orderHistoryFilter === mode ? '#FFFFFF' : 'var(--text-secondary)',
                          textTransform: 'capitalize',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {mode === 'all'
                          ? `All (${customerOrders.length})`
                          : mode === 'active'
                          ? `Active (${activeCustomerLiveOrders.length})`
                          : `Past (${pastCustomerOrders.length})`}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Scrollable Order List Inside Card 3 (Only Orders Scroll!) */}
            <div
              id="rep-customer-orders-scroll-container"
              style={{
                flex: 1,
                minHeight: 0,
                padding: '10px 12px',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {filteredCustomerOrders.length === 0 ? (
                <div
                  style={{
                    padding: '28px 12px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-card-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    margin: 'auto 0',
                  }}
                >
                  No orders found in this category.
                </div>
              ) : (
                filteredCustomerOrders.map((ord) => {
                  const isActive = ord.status !== 'completed' && ord.status !== 'cancelled' && ord.status !== 'served';
                  const statusInfo = getOrderStatusBadge(ord.status, ord.type);
                  const itemCount = ord.items.reduce((sum, item) => sum + (item.quantity || 1), 0);

                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrderForMenu(ord)}
                      title="Click to view full ordered menu and details"
                      style={{
                        height: '76px',
                        minHeight: '76px',
                        maxHeight: '76px',
                        width: '100%',
                        boxSizing: 'border-box',
                        backgroundColor: isActive ? '#FFFBEB' : '#FFFFFF',
                        borderRadius: 'var(--radius-md)',
                        border: isActive ? '1px solid #FCD34D' : '1px solid var(--border-color)',
                        borderLeft: isActive ? '4px solid #F59E0B' : '4px solid #CBD5E1',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)';
                        e.currentTarget.style.backgroundColor = isActive ? '#FEF3C7' : 'var(--bg-card-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isActive ? '#FCD34D' : 'var(--border-color)';
                        e.currentTarget.style.borderLeftColor = isActive ? '#F59E0B' : '#CBD5E1';
                        e.currentTarget.style.backgroundColor = isActive ? '#FFFBEB' : '#FFFFFF';
                      }}
                    >
                      {/* Row 1: Order #, Status badge, Timestamp */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                            #{ord.orderNumber}
                          </span>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              padding: '1.5px 6px',
                              borderRadius: '4px',
                              backgroundColor: statusInfo.bg,
                              color: statusInfo.color,
                            }}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          {ord.createdAt || 'Recent'}
                        </span>
                      </div>

                      {/* Row 2: Type, Item count, Price, and View Menu badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                        <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 600 }}>
                          {ord.type.replace('_', ' ')} {ord.tableNumber ? `· T${ord.tableNumber}` : ''} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '12.5px' }}>
                            Rs. {Number(ord.total).toLocaleString()}
                          </span>
                          <span
                            title="Click to view full ordered items details"
                            style={{
                              fontSize: '11px',
                              fontWeight: 800,
                              color: 'var(--primary)',
                              backgroundColor: 'var(--primary-light)',
                              padding: '3px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '2px',
                            }}
                          >
                            <ExternalLink size={12} />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* SHARED ORDER CARD RENDERER (FIXED LENGTH/WIDTH, NO INLINE ITEM DETAILS)    */}
      {/* ========================================================================= */}
      {(() => {
        return null;
      })()}

      {/* ========================================================================= */}
      {/* TAB 2: TAKEAWAY ORDERS LIFECYCLE HUB (STATIC MAIN CARD)                   */}
      {/* ========================================================================= */}
      {activeTab === 'takeaway' && (
        <div
          style={{
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          {/* Static Top Header & Filters */}
          <div
            style={{
              flexShrink: 0,
              padding: '16px 20px 12px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Takeaway Orders — Counter Handover Hub
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Incoming takeaway requests: click order to view details or dispatch to kitchen
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: readyTakeawayOrders.length > 0 ? '#16A34A' : 'var(--bg-card-subtle)',
                    color: readyTakeawayOrders.length > 0 ? '#FFFFFF' : 'var(--text-muted)',
                  }}
                >
                  {readyTakeawayOrders.length} Ready for Pickup
                </span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: arrivedTakeawayOrders.length > 0 ? '#FEF3C7' : 'var(--bg-card-subtle)',
                    color: arrivedTakeawayOrders.length > 0 ? '#92400E' : 'var(--text-muted)',
                  }}
                >
                  {arrivedTakeawayOrders.length} Arrived
                </span>
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All (${allTakeawayOrders.length})` },
                  { id: 'arrived', label: `Arrived (${arrivedTakeawayOrders.length})` },
                  { id: 'preparing', label: `In Kitchen (${preparingTakeawayOrders.length})` },
                  { id: 'ready', label: `Ready (${readyTakeawayOrders.length})` },
                  { id: 'completed', label: `Completed (${completedTakeawayOrders.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTakeawayStatusTab(tab.id as any)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: takeawayStatusTab === tab.id ? 'var(--primary)' : 'var(--bg-card-subtle)',
                      color: takeawayStatusTab === tab.id ? '#FFFFFF' : 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                <input
                  type="text"
                  value={takeawaySearch}
                  onChange={(e) => setTakeawaySearch(e.target.value)}
                  placeholder="Search order #, customer..."
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 30px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Scrollable Orders Workspace (Internal Scroll only) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px 20px',
              backgroundColor: '#F8FAFC',
            }}
          >
            {takeawayStatusTab === 'completed' && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: hasLoadedOlderOrders ? 'rgba(37, 99, 235, 0.08)' : '#FFFBEB',
                  border: hasLoadedOlderOrders ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid #FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '12px', color: hasLoadedOlderOrders ? '#1E40AF' : '#92400E', fontWeight: 650 }}>
                  {hasLoadedOlderOrders
                    ? `📂 Full archive loaded (${completedTakeawayOrders.length} completed orders).`
                    : `⚡ Fast Mode: Showing today's completed orders (${completedTakeawayOrders.length}).`}
                </span>
                {!hasLoadedOlderOrders ? (
                  <button
                    type="button"
                    onClick={() => fetchOlderOrders()}
                    disabled={isFetchingOlderOrders}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#EA580C',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 750,
                      border: 'none',
                      cursor: isFetchingOlderOrders ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isFetchingOlderOrders ? 'Loading...' : 'Fetch Older Records ⬇'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => filterOrdersToToday()}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #93C5FD',
                      color: '#2563EB',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Show Today Only ⚡
                  </button>
                )}
              </div>
            )}
            {(() => {
              const list = allTakeawayOrders.filter((ord) => {
                if (takeawayStatusTab === 'arrived' && ord.status !== 'placed' && ord.status !== 'accepted') return false;
                if (takeawayStatusTab === 'preparing' && ord.status !== 'preparing') return false;
                if (takeawayStatusTab === 'ready' && ord.status !== 'ready') return false;
                if (takeawayStatusTab === 'completed' && ord.status !== 'completed') return false;
                if (takeawaySearch.trim()) {
                  const q = takeawaySearch.toLowerCase().replace(/^#/, '');
                  const num = ord.orderNumber?.toLowerCase() || '';
                  const name = ord.customerName?.toLowerCase() || '';
                  const phone = ord.customerPhone?.replace(/\s+/g, '') || '';
                  return num.includes(q) || name.includes(q) || phone.includes(q);
                }
                return true;
              });

              if (list.length === 0) {
                return (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-muted)',
                      maxWidth: '420px',
                      margin: '40px auto',
                    }}
                  >
                    <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>
                      No Takeaway Orders In This View
                    </div>
                    <p style={{ fontSize: '12.5px', margin: '4px 0 0' }}>
                      All orders have progressed or switch filter tabs.
                    </p>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, 340px)',
                    gap: '14px',
                    alignItems: 'start',
                  }}
                >
                  {list.map((ord) => renderOrderCard(ord))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DELIVERY ORDERS LIFECYCLE HUB                                      */}
      {/* ========================================================================= */}
      {activeTab === 'delivery' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: '100%',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px 14px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#FFEDD5',
                    color: '#EA580C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Bike size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Delivery Orders — Rider Shipping & Dispatch
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Incoming delivery requests: click order to view details or dispatch to kitchen / rider
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: readyDeliveryOrders.length > 0 ? '#16A34A' : 'var(--bg-card-subtle)',
                    color: readyDeliveryOrders.length > 0 ? '#FFFFFF' : 'var(--text-muted)',
                  }}
                >
                  {readyDeliveryOrders.length} Ready to Ship
                </span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: arrivedDeliveryOrders.length > 0 ? '#FEF3C7' : 'var(--bg-card-subtle)',
                    color: arrivedDeliveryOrders.length > 0 ? '#92400E' : 'var(--text-muted)',
                  }}
                >
                  {arrivedDeliveryOrders.length} Arrived
                </span>
              </div>
            </div>

            {/* AVAILABLE DELIVERY RIDERS FLEET OVERVIEW */}
            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bike size={15} color="#EA580C" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Available Delivery Fleet ({branchRiders.length} Riders):
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {branchRiders.map((r) => {
                  const isAvailable = r.riderAvailability !== 'busy' && r.riderAvailability !== 'offline';
                  return (
                    <span
                      key={r.id}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '16px',
                        fontSize: '11px',
                        fontWeight: 750,
                        backgroundColor: isAvailable ? '#DCFCE7' : r.riderAvailability === 'busy' ? '#FEF3C7' : '#F1F5F9',
                        color: isAvailable ? '#15803D' : r.riderAvailability === 'busy' ? '#B45309' : '#64748B',
                        border: `1px solid ${isAvailable ? '#BBF7D0' : r.riderAvailability === 'busy' ? '#FDE68A' : '#CBD5E1'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: isAvailable ? '#16A34A' : r.riderAvailability === 'busy' ? '#D97706' : '#94A3B8',
                        }}
                      />
                      {r.name} ({isAvailable ? 'Ready' : r.riderAvailability === 'busy' ? 'On Delivery' : 'Offline'})
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All (${allDeliveryOrders.length})` },
                  { id: 'arrived', label: `Arrived (${arrivedDeliveryOrders.length})` },
                  { id: 'preparing', label: `In Kitchen (${preparingDeliveryOrders.length})` },
                  { id: 'ready', label: `Ready (${readyDeliveryOrders.length})` },
                  { id: 'out', label: `Out with Rider (${outDeliveryOrders.length})` },
                  { id: 'completed', label: `Delivered (${completedDeliveryOrders.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDeliveryStatusTab(tab.id as any)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: deliveryStatusTab === tab.id ? 'var(--primary)' : 'var(--bg-card-subtle)',
                      color: deliveryStatusTab === tab.id ? '#FFFFFF' : 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                <input
                  type="text"
                  value={deliverySearch}
                  onChange={(e) => setDeliverySearch(e.target.value)}
                  placeholder="Search order #, address, name..."
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 30px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Scrollable Orders Workspace (Internal Scroll only) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px 20px',
              backgroundColor: '#F8FAFC',
            }}
          >
            {deliveryStatusTab === 'completed' && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: hasLoadedOlderOrders ? 'rgba(37, 99, 235, 0.08)' : '#FFFBEB',
                  border: hasLoadedOlderOrders ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid #FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '12px', color: hasLoadedOlderOrders ? '#1E40AF' : '#92400E', fontWeight: 650 }}>
                  {hasLoadedOlderOrders
                    ? `📂 Full archive loaded (${completedDeliveryOrders.length} completed orders).`
                    : `⚡ Fast Mode: Showing today's completed orders (${completedDeliveryOrders.length}).`}
                </span>
                {!hasLoadedOlderOrders ? (
                  <button
                    type="button"
                    onClick={() => fetchOlderOrders()}
                    disabled={isFetchingOlderOrders}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#EA580C',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 750,
                      border: 'none',
                      cursor: isFetchingOlderOrders ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isFetchingOlderOrders ? 'Loading...' : 'Fetch Older Records ⬇'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => filterOrdersToToday()}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #93C5FD',
                      color: '#2563EB',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Show Today Only ⚡
                  </button>
                )}
              </div>
            )}
            {(() => {
              const list = allDeliveryOrders.filter((ord) => {
                if (deliveryStatusTab === 'arrived' && ord.status !== 'placed' && ord.status !== 'accepted') return false;
                if (deliveryStatusTab === 'preparing' && ord.status !== 'preparing') return false;
                if (deliveryStatusTab === 'ready' && ord.status !== 'ready') return false;
                if (deliveryStatusTab === 'out' && ord.status !== 'out_for_delivery') return false;
                if (deliveryStatusTab === 'completed' && ord.status !== 'completed') return false;
                if (deliverySearch.trim()) {
                  const q = deliverySearch.toLowerCase().replace(/^#/, '');
                  const num = ord.orderNumber?.toLowerCase() || '';
                  const name = ord.customerName?.toLowerCase() || '';
                  const phone = ord.customerPhone?.replace(/\s+/g, '') || '';
                  const addr = ord.deliveryAddress?.toLowerCase() || '';
                  return num.includes(q) || name.includes(q) || phone.includes(q) || addr.includes(q);
                }
                return true;
              });

              if (list.length === 0) {
                return (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-muted)',
                      maxWidth: '420px',
                      margin: '40px auto',
                    }}
                  >
                    <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>
                      No Delivery Orders In This View
                    </div>
                    <p style={{ fontSize: '12.5px', margin: '4px 0 0' }}>
                      All delivery shipments have progressed or check other status filter tabs.
                    </p>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, 340px)',
                    gap: '14px',
                    alignItems: 'start',
                  }}
                >
                  {list.map((ord) => renderOrderCard(ord))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DINE-IN ORDERS LIFECYCLE HUB                                       */}
      {/* ========================================================================= */}
      {activeTab === 'dine_in' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: '100%',
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px 14px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Utensils size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                    Dine-In Orders — Table Service & Seating
                  </h2>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Incoming table orders: click order to view details or dispatch to kitchen / table
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: readyDineInOrders.length > 0 ? '#16A34A' : 'var(--bg-card-subtle)',
                    color: readyDineInOrders.length > 0 ? '#FFFFFF' : 'var(--text-muted)',
                  }}
                >
                  {readyDineInOrders.length} Ready / Served
                </span>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: arrivedDineInOrders.length > 0 ? '#FEF3C7' : 'var(--bg-card-subtle)',
                    color: arrivedDineInOrders.length > 0 ? '#92400E' : 'var(--text-muted)',
                  }}
                >
                  {arrivedDineInOrders.length} Arrived
                </span>
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `All (${allDineInOrders.length})` },
                  { id: 'arrived', label: `Arrived (${arrivedDineInOrders.length})` },
                  { id: 'preparing', label: `In Kitchen (${preparingDineInOrders.length})` },
                  { id: 'ready', label: `Ready (${readyDineInOrders.length})` },
                  { id: 'completed', label: `Completed (${completedDineInOrders.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDineInStatusTab(tab.id as any)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: dineInStatusTab === tab.id ? 'var(--primary)' : 'var(--bg-card-subtle)',
                      color: dineInStatusTab === tab.id ? '#FFFFFF' : 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '9px' }} />
                <input
                  type="text"
                  value={dineInSearch}
                  onChange={(e) => setDineInSearch(e.target.value)}
                  placeholder="Search order #, table, customer..."
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 30px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-main)',
                    fontSize: '12px',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Scrollable Orders Workspace (Internal Scroll only) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: '16px 20px',
              backgroundColor: '#F8FAFC',
            }}
          >
            {dineInStatusTab === 'completed' && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: hasLoadedOlderOrders ? 'rgba(37, 99, 235, 0.08)' : '#FFFBEB',
                  border: hasLoadedOlderOrders ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid #FDE68A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '12px', color: hasLoadedOlderOrders ? '#1E40AF' : '#92400E', fontWeight: 650 }}>
                  {hasLoadedOlderOrders
                    ? `📂 Full archive loaded (${completedDineInOrders.length} completed orders).`
                    : `⚡ Fast Mode: Showing today's completed orders (${completedDineInOrders.length}).`}
                </span>
                {!hasLoadedOlderOrders ? (
                  <button
                    type="button"
                    onClick={() => fetchOlderOrders()}
                    disabled={isFetchingOlderOrders}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      backgroundColor: '#EA580C',
                      color: '#FFFFFF',
                      fontSize: '11px',
                      fontWeight: 750,
                      border: 'none',
                      cursor: isFetchingOlderOrders ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isFetchingOlderOrders ? 'Loading...' : 'Fetch Older Records ⬇'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => filterOrdersToToday()}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '5px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #93C5FD',
                      color: '#2563EB',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Show Today Only ⚡
                  </button>
                )}
              </div>
            )}
            {(() => {
              const list = allDineInOrders.filter((ord) => {
                if (dineInStatusTab === 'arrived' && ord.status !== 'placed' && ord.status !== 'accepted') return false;
                if (dineInStatusTab === 'preparing' && ord.status !== 'preparing') return false;
                if (dineInStatusTab === 'ready' && ord.status !== 'ready' && ord.status !== 'served') return false;
                if (dineInStatusTab === 'completed' && ord.status !== 'completed') return false;
                if (dineInSearch.trim()) {
                  const q = dineInSearch.toLowerCase().replace(/^#/, '');
                  const num = ord.orderNumber?.toLowerCase() || '';
                  const name = ord.customerName?.toLowerCase() || '';
                  const table = ord.tableNumber ? String(ord.tableNumber).toLowerCase() : '';
                  return num.includes(q) || name.includes(q) || table.includes(q);
                }
                return true;
              });

              if (list.length === 0) {
                return (
                  <div
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      backgroundColor: '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-muted)',
                      maxWidth: '420px',
                      margin: '40px auto',
                    }}
                  >
                    <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>
                      No Dine-In Orders In This View
                    </div>
                    <p style={{ fontSize: '12.5px', margin: '4px 0 0' }}>
                      All dine-in tables are clear or check other status filter tabs.
                    </p>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, 340px)',
                    gap: '14px',
                    alignItems: 'start',
                  }}
                >
                  {list.map((ord) => renderOrderCard(ord))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* CUSTOM KITCHEN DISPATCH TIME MODAL (2 OPTIONS: SPECIFIC ORDER OR WHOLE ORDERS) */}
      {customTimeModalOrderId && (() => {
        const targetOrder = orders.find((o) => o.id === customTimeModalOrderId);
        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(3px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setCustomTimeModalOrderId(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                maxWidth: '460px',
                width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} color="var(--primary)" />
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 850, color: 'var(--text-main)' }}>
                    Set Kitchen Dispatch Timer
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomTimeModalOrderId(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* 2 Selectable Options: Specific Order vs Whole Orders */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Apply Timer To:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                  <div
                    onClick={() => setTimerScope('specific')}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: timerScope === 'specific' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: timerScope === 'specific' ? 'var(--primary-light)' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="radio"
                        name="timerScope"
                        checked={timerScope === 'specific'}
                        onChange={() => setTimerScope('specific')}
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                        This Order
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '20px' }}>
                      Order #{targetOrder?.orderNumber || 'Selected'}
                    </span>
                  </div>

                  <div
                    onClick={() => setTimerScope('whole')}
                    style={{
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: timerScope === 'whole' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: timerScope === 'whole' ? 'var(--primary-light)' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="radio"
                        name="timerScope"
                        checked={timerScope === 'whole'}
                        onChange={() => setTimerScope('whole')}
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                        Whole Orders
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '20px' }}>
                      All incoming & future
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Duration:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[1, 2, 3, 5, 10, 15].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setCustomMinutesInput(mins)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: customMinutesInput === mins ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: customMinutesInput === mins ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                        color: customMinutesInput === mins ? 'var(--primary)' : 'var(--text-main)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {mins} min{mins > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>Custom:</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{
                    width: '80px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>minutes from now</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setCustomTimeModalOrderId(null)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#F1F5F9',
                    color: 'var(--text-secondary)',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (timerScope === 'specific') {
                      setOrderKitchenForwardTime(customTimeModalOrderId, customMinutesInput);
                      addToast({
                        type: 'success',
                        title: 'Timer Set',
                        message: `Timer set to ${customMinutesInput}m for Order #${targetOrder?.orderNumber}.`,
                      });
                    } else {
                      ordersAwaitingKitchen.forEach((o) => {
                        setOrderKitchenForwardTime(o.id, customMinutesInput);
                      });
                      updateFooterSettings({ autoForwardKitchenMin: customMinutesInput });
                      addToast({
                        type: 'success',
                        title: 'Whole Orders Timer Set',
                        message: `Timer set to ${customMinutesInput}m for all incoming & future orders.`,
                      });
                    }
                    setCustomTimeModalOrderId(null);
                  }}
                  style={{
                    flex: 2,
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  {timerScope === 'specific'
                    ? `Set Timer for #${targetOrder?.orderNumber || 'Order'} (${customMinutesInput}m)`
                    : `Set Timer for Whole Orders (${customMinutesInput}m)`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* POP-UP ORDER DETAIL SCREEN */}
      {selectedOrderDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedOrderDetail(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 850, color: 'var(--text-main)' }}>
                      Order #{selectedOrderDetail.orderNumber}
                    </h3>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                      }}
                    >
                      {selectedOrderDetail.type === 'dine_in'
                        ? `Dine-In • Table ${selectedOrderDetail.tableNumber || '-'}`
                        : selectedOrderDetail.type === 'takeaway'
                        ? 'Takeaway'
                        : 'Delivery'}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Placed: {selectedOrderDetail.createdAt ? formatMessageTime(selectedOrderDetail.createdAt) : 'Recent'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Scrollable */}
            <div
              style={{
                padding: '20px 24px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Customer & Status Summary Card */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  backgroundColor: '#F8FAFC',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer</span>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)', marginTop: '2px' }}>
                    {selectedOrderDetail.customerName}
                  </div>
                  {selectedOrderDetail.customerPhone && (
                    <a
                      href={`tel:${selectedOrderDetail.customerPhone}`}
                      style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}
                    >
                      📞 {selectedOrderDetail.customerPhone}
                    </a>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Payment & Status</span>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: selectedOrderDetail.paymentStatus === 'paid' ? 'var(--pay-paid-bg)' : 'var(--pay-unpaid-bg)',
                        color: selectedOrderDetail.paymentStatus === 'paid' ? 'var(--pay-paid-text)' : 'var(--pay-unpaid-text)',
                      }}
                    >
                      {selectedOrderDetail.paymentStatus === 'paid' ? 'PAID' : 'CASH ON HAND / UNPAID'}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#E0E7FF',
                        color: '#3730A3',
                        textTransform: 'uppercase',
                      }}
                    >
                      {selectedOrderDetail.status}
                    </span>
                  </div>
                </div>

                {selectedOrderDetail.deliveryAddress && (
                  <div style={{ gridColumn: 'span 2', paddingTop: '4px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delivery Destination</span>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-main)', marginTop: '2px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                      <MapPin size={13} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{selectedOrderDetail.deliveryAddress}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Itemized Breakdown Table */}
              <div>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Itemized Order ({selectedOrderDetail.items.length} items)
                </h4>
                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Item</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'center', width: '60px' }}>Qty</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'right', width: '90px' }}>Price</th>
                        <th style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-secondary)', textAlign: 'right', width: '90px' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrderDetail.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < selectedOrderDetail.items.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 750, color: 'var(--text-main)' }}>{item.name}</div>
                            {item.size && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Size: {item.size}
                              </div>
                            )}
                            {item.extras && item.extras.length > 0 && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Extras: {item.extras.join(', ')}
                              </div>
                            )}
                            {item.instructions && (
                              <div style={{ fontSize: '11px', color: '#D97706', fontStyle: 'italic', marginTop: '2px' }}>
                                Note: {item.instructions}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: 'var(--text-main)' }}>
                            {item.quantity}x
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                            Rs. {Number(item.unitPrice || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: 'var(--text-main)' }}>
                            Rs. {Number((item.unitPrice || 0) * item.quantity).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pricing Totals */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '12px 16px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '12.5px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>Rs. {Number(selectedOrderDetail.originalSubtotal || selectedOrderDetail.items.reduce((acc, i) => acc + (i.unitPrice || 0) * i.quantity, 0)).toLocaleString()}</span>
                </div>
                {selectedOrderDetail.addOnSubtotal ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Add-ons Subtotal</span>
                    <span>Rs. {Number(selectedOrderDetail.addOnSubtotal).toLocaleString()}</span>
                  </div>
                ) : null}
                {selectedOrderDetail.tax ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Tax</span>
                    <span>Rs. {Number(selectedOrderDetail.tax).toLocaleString()}</span>
                  </div>
                ) : null}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 900,
                    fontSize: '15px',
                    color: 'var(--text-main)',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ color: 'var(--primary)' }}>Rs. {Number(selectedOrderDetail.total).toLocaleString()}</span>
                </div>
              </div>

              {selectedOrderDetail.notes && (
                <div style={{ backgroundColor: '#FEF3C7', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid #FDE68A', fontSize: '12px', color: '#92400E' }}>
                  <strong>Order Notes:</strong> {selectedOrderDetail.notes}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#F1F5F9',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                {!selectedOrderDetail.sentToKitchen && (selectedOrderDetail.status === 'placed' || selectedOrderDetail.status === 'accepted') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomTimeModalOrderId(selectedOrderDetail.id);
                        setCustomMinutesInput(selectedOrderDetail.autoForwardCustomMin || footerSettings?.autoForwardKitchenMin || 3);
                        setTimerScope('specific');
                        setSelectedOrderDetail(null);
                      }}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#FEF3C7',
                        border: '1px solid #FDE68A',
                        color: '#B45309',
                        fontWeight: 800,
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Clock size={13} />
                      <span>Set Timer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        sendOrderToKitchen(selectedOrderDetail.id);
                        setSelectedOrderDetail(null);
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#16A34A',
                        border: 'none',
                        color: '#FFFFFF',
                        fontWeight: 800,
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Utensils size={13} />
                      <span>Mark Kitchen Ready</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL ORDER CONFIRMATION MODAL */}
      {cancelModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setCancelModalOrder(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#FEE2E2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#DC2626',
                  }}
                >
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#111827' }}>
                    Cancel Order #{cancelModalOrder.orderNumber}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Customer: {cancelModalOrder.customerName} ({cancelModalOrder.type.toUpperCase()})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '18px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#FFFBEB',
                border: '1px solid #FDE68A',
                fontSize: '12.5px',
                color: '#92400E',
                lineHeight: 1.5,
              }}
            >
              <strong>Notice:</strong> Cancelling this order before it is forwarded to the kitchen immediately removes it from the customer support queue and prevents kitchen preparation.
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                Reason for Cancellation
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {[
                  'Customer requested order cancellation',
                  'Item out of stock',
                  'Customer changed mind',
                  'Duplicate order placed',
                  'Incorrect address or contact',
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCancelReasonInput(reason)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '4px',
                      border: cancelReasonInput === reason ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: cancelReasonInput === reason ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                      color: cancelReasonInput === reason ? 'var(--primary)' : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: cancelReasonInput === reason ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder="Enter cancellation reason..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                }}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelOrder}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                Confirm Cancel Order ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Menu & Details Pop-up Modal */}
      {selectedOrderForMenu && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedOrderForMenu(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>📋</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-main)' }}>
                      Order #{selectedOrderForMenu.orderNumber}
                    </span>
                    {(() => {
                      const badge = getOrderStatusBadge(selectedOrderForMenu.status, selectedOrderForMenu.type);
                      return (
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Ordered by {selectedOrderForMenu.customerName} · {selectedOrderForMenu.createdAt || 'Recent'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForMenu(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  lineHeight: '1',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Scrollable if tall) */}
            <div
              style={{
                padding: '16px 18px',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Customer & Fulfillment Info */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: '12px',
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>CHANNEL</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', textTransform: 'capitalize' }}>
                    {selectedOrderForMenu.type.replace('_', ' ')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {selectedOrderForMenu.type === 'dine_in'
                      ? 'TABLE'
                      : selectedOrderForMenu.type === 'delivery'
                      ? 'DELIVERY TO'
                      : 'PICKUP'}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                    {selectedOrderForMenu.type === 'dine_in'
                      ? `Table #${selectedOrderForMenu.tableNumber || 'N/A'}`
                      : selectedOrderForMenu.type === 'delivery'
                      ? (selectedOrderForMenu as any).deliveryAddress || 'Gulberg Area'
                      : selectedOrderForMenu.pickupTime || 'Standard'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 }}>PAYMENT</div>
                  <div style={{ fontWeight: 700, color: selectedOrderForMenu.paymentStatus === 'paid' ? '#16A34A' : '#D97706', textTransform: 'capitalize' }}>
                    {selectedOrderForMenu.paymentStatus}
                  </div>
                </div>
              </div>

              {/* Ordered Menu Items */}
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    color: 'var(--text-muted)',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>What Customer Ordered</span>
                  <span>{selectedOrderForMenu.items.reduce((s, i) => s + (i.quantity || 1), 0)} items</span>
                </div>

                <div
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}
                >
                  {selectedOrderForMenu.items.map((item, idx) => {
                    const lineTotal = (item.unitPrice || 0) * (item.quantity || 1);
                    return (
                      <div
                        key={item.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderBottom: idx === selectedOrderForMenu.items.length - 1 ? 'none' : '1px solid var(--border-color)',
                          backgroundColor: idx % 2 === 0 ? '#FFFFFF' : 'var(--bg-card-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <span
                            style={{
                              backgroundColor: 'var(--primary-light)',
                              color: 'var(--primary)',
                              fontWeight: 800,
                              fontSize: '11.5px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              marginTop: '1px',
                            }}
                          >
                            {item.quantity || 1}x
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                              {item.name}
                            </div>
                            {item.size && (
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                Size: {item.size}
                              </div>
                            )}
                            {item.extras && item.extras.length > 0 && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Extras: {item.extras.join(', ')}
                              </div>
                            )}
                            {item.instructions && (
                              <div style={{ fontSize: '11px', color: '#D97706', fontStyle: 'italic', marginTop: '2px' }}>
                                Note: &quot;{item.instructions}&quot;
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '8px' }}>
                          <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text-main)' }}>
                            Rs. {lineTotal.toLocaleString()}
                          </div>
                          {(item.quantity || 1) > 1 && (
                            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                              @ Rs. {(item.unitPrice || 0).toLocaleString()} each
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Bill Summary */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Original Subtotal</span>
                  <span>Rs. {(selectedOrderForMenu.originalSubtotal || selectedOrderForMenu.total).toLocaleString()}</span>
                </div>
                {selectedOrderForMenu.addOnSubtotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Add-ons Subtotal</span>
                    <span>Rs. {selectedOrderForMenu.addOnSubtotal.toLocaleString()}</span>
                  </div>
                )}
                {selectedOrderForMenu.tax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Tax (GST)</span>
                    <span>Rs. {selectedOrderForMenu.tax.toLocaleString()}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 800,
                    fontSize: '14px',
                    color: 'var(--text-main)',
                    borderTop: '1px dashed var(--border-color)',
                    paddingTop: '6px',
                    marginTop: '2px',
                  }}
                >
                  <span>Grand Total</span>
                  <span style={{ color: 'var(--primary)' }}>Rs. {Number(selectedOrderForMenu.total).toLocaleString()}</span>
                </div>
              </div>

              {/* Notice if cancelled */}
              {selectedOrderForMenu.status === 'cancelled' && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#FEE2E2',
                    border: '1px solid #FCA5A5',
                    fontSize: '12px',
                    color: '#991B1B',
                  }}
                >
                  <strong>Cancelled:</strong> {(selectedOrderForMenu as any).cancelReason || 'This order was cancelled.'}
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div
              style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card-subtle)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              {selectedOrderForMenu.status !== 'cancelled' &&
                selectedOrderForMenu.status !== 'completed' &&
                selectedOrderForMenu.status !== 'served' && (
                  <button
                    type="button"
                    onClick={() => {
                      const ord = selectedOrderForMenu;
                      setSelectedOrderForMenu(null);
                      setCancelModalOrder(ord);
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: '#FEE2E2',
                      color: '#DC2626',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      border: '1px solid #FCA5A5',
                    }}
                  >
                    Cancel Order ✕
                  </button>
                )}

              {selectedOrderForMenu.status === 'placed' && (
                <button
                  type="button"
                  onClick={() => {
                    sendOrderToKitchen(selectedOrderForMenu.id);
                    addToast({
                      type: 'success',
                      title: 'Sent to Kitchen',
                      message: `Order #${selectedOrderForMenu.orderNumber} sent directly to kitchen!`,
                    });
                    setSelectedOrderForMenu(null);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  Send to Kitchen Now 🍳
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedOrderForMenu(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-main)',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
