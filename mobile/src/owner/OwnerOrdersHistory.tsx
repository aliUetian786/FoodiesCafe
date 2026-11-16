import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { KeyboardSafeModal as Modal } from '../components/KeyboardSafeModal';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { Order } from '../types';
import { normalizeBranchId } from '../services/api';
import { HistoricalLoadingModal } from '../components/HistoricalLoadingModal';
import {
  ArrowLeft,
  Search,
  Filter,
  Calendar,
  Building2,
  Receipt,
  X,
  CreditCard,
  Banknote,
  Clock,
  Utensils,
  ShoppingBag,
  Bike,
  CheckCircle2,
  ChevronDown,
  Printer,
  ChevronRight,
} from 'lucide-react-native';

interface OwnerOrdersHistoryProps {
  onBack: () => void;
  initialFilter?: 'all' | 'pending';
}

export function OwnerOrdersHistory({ onBack, initialFilter = 'all' }: OwnerOrdersHistoryProps) {
  const {
    orders,
    branches,
    fetchOlderOrders,
    filterOrdersToToday,
    hasLoadedOlderOrders,
    isFetchingOlderOrders,
    setBottomSheetOpen,
  } = useApp();

  // Filters
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [dateScope, setDateScope] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'paid_cash' | 'paid_online' | 'refunded'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'cancelled'>(
    initialFilter === 'pending' ? 'pending' : 'all'
  );

  // Filter Dropdown Modals
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [collectionDropdownOpen, setCollectionDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  // Selected Order for Full Modal Inspector
  const [selectedOrder, setSelectedOrder] = useState<Order | any | null>(null);

  React.useEffect(() => {
    const isAnyOpen = Boolean(
      branchDropdownOpen ||
        dateDropdownOpen ||
        collectionDropdownOpen ||
        typeDropdownOpen ||
        selectedOrder
    );
    if (!isAnyOpen) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [branchDropdownOpen, dateDropdownOpen, collectionDropdownOpen, typeDropdownOpen, selectedOrder, setBottomSheetOpen]);

  // Pop-up Loading Sign visibility
  const [isLoadingPopup, setIsLoadingPopup] = useState(false);

  // Helper date matchers
  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const isYesterday = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    );
  };

  const isWithinDays = (dateStr?: string, days: number = 7) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return d.getTime() >= cutoff;
  };

  const isWithinMonth = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };

  const isOrderPaid = (o: any) => {
    if (o.paymentStatus === 'paid') return true;
    if (o.paymentCollected === true) return true;
    if (o.status === 'completed' || o.status === 'delivered') return true;
    const method = (o.paymentMethod || '').toLowerCase();
    if (
      method.includes('jazzcash') ||
      method.includes('easypaisa') ||
      method.includes('card') ||
      method.includes('bank') ||
      method.includes('online') ||
      method.includes('raast') ||
      method.includes('wallet')
    ) {
      return o.paymentStatus !== 'unpaid' || o.paymentCollected === true;
    }
    return false;
  };

  const isCashPayment = (o: any) => {
    const m = (o.paymentMethod || '').toLowerCase();
    return m.includes('cash') || m.includes('cod') || !m;
  };

  // On-demand loader when date scope changes
  const handleSelectDateScope = async (scope: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
    setDateScope(scope);
    setDateDropdownOpen(false);

    if (scope === 'today') {
      filterOrdersToToday();
    } else {
      setIsLoadingPopup(true);
      try {
        await fetchOlderOrders(selectedBranch === 'all' ? undefined : selectedBranch, scope);
      } finally {
        setIsLoadingPopup(false);
      }
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesNum = (ord.orderNumber || '').toLowerCase().includes(q);
        const matchesName = (ord.customerName || '').toLowerCase().includes(q);
        const matchesPhone = (ord.customerPhone || '').includes(q);
        const matchesTable = ord.tableNumber && ord.tableNumber.toLowerCase().includes(q);
        const matchesItem = ord.items && ord.items.some((it) => it.name.toLowerCase().includes(q));
        if (!matchesNum && !matchesName && !matchesPhone && !matchesTable && !matchesItem) return false;
      }

      // 2. Branch Filter
      if (selectedBranch !== 'all') {
        const normSelected = normalizeBranchId(selectedBranch);
        const normOrdBranch = normalizeBranchId(ord.branchId || '');
        if (normOrdBranch !== normSelected) return false;
      }

      // 3. Order Type Filter
      if (typeFilter !== 'all' && ord.type !== typeFilter) return false;

      // 4. Status Filter
      if (statusFilter === 'pending') {
        const isPending =
          ord.status === 'placed' ||
          ord.status === 'accepted' ||
          ord.status === 'preparing' ||
          ord.status === 'ready' ||
          ord.status === 'out_for_delivery';
        if (!isPending) return false;
      } else if (statusFilter === 'completed') {
        if (ord.status !== 'completed' && ord.status !== 'delivered' && ord.status !== 'served' && ord.status !== 'taken') {
          return false;
        }
      } else if (statusFilter === 'cancelled') {
        if (ord.status !== 'cancelled') return false;
      }

      // 5. Strictly ONLY paid orders appear in history
      const isPaid = isOrderPaid(ord);
      if (!isPaid) return false;

      const isCash = isCashPayment(ord);
      if (collectionFilter === 'paid_cash' && !isCash) return false;
      if (collectionFilter === 'paid_online' && isCash) return false;
      if (collectionFilter === 'refunded' && ord.paymentStatus !== 'refunded') return false;

      // 6. Date Scope Filter
      if (dateScope === 'today') {
        if (!isToday(ord.createdAt) && ord.status === 'completed') return false;
      } else if (dateScope === 'yesterday') {
        if (!isYesterday(ord.createdAt)) return false;
      } else if (dateScope === 'week') {
        if (!isWithinDays(ord.createdAt, 7)) return false;
      } else if (dateScope === 'month') {
        if (!isWithinMonth(ord.createdAt)) return false;
      }

      return true;
    });
  }, [orders, search, selectedBranch, typeFilter, statusFilter, collectionFilter, dateScope]);

  // Dynamic summary stats for current view
  const summaryStats = useMemo(() => {
    const totalCount = filteredOrders.length;
    const paidCount = filteredOrders.filter(isOrderPaid).length;
    const totalRevenue = filteredOrders
      .filter(isOrderPaid)
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
    const pendingCount = filteredOrders.filter(
      (o) =>
        o.status === 'placed' ||
        o.status === 'accepted' ||
        o.status === 'preparing' ||
        o.status === 'ready' ||
        o.status === 'out_for_delivery'
    ).length;

    return { totalCount, paidCount, totalRevenue, pendingCount };
  }, [filteredOrders]);

  const getBranchLabel = (id?: string) => {
    if (!id || id === 'all') return 'All Branches';
    const b = branches.find((item) => normalizeBranchId(item.id) === normalizeBranchId(id));
    return b ? `${b.name} (${b.city})` : id;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
      case 'served':
      case 'taken':
        return { bg: Colors.successLight, text: Colors.success, label: 'COMPLETED' };
      case 'preparing':
        return { bg: '#FEF3C7', text: '#D97706', label: 'PREPARING' };
      case 'ready':
        return { bg: Colors.infoLight, text: Colors.info, label: 'READY' };
      case 'out_for_delivery':
        return { bg: '#E0F2FE', text: '#0284C7', label: 'ON ROUTE' };
      case 'placed':
      case 'accepted':
        return { bg: '#EFF6FF', text: '#2563EB', label: 'NEW ORDER' };
      case 'cancelled':
        return { bg: Colors.dangerLight, text: Colors.danger, label: 'CANCELLED' };
      default:
        return { bg: Colors.bgSubtle, text: Colors.textMuted, label: status.toUpperCase() };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Prominent Loading Pop-up Modal */}
      <HistoricalLoadingModal visible={isLoadingPopup || isFetchingOlderOrders} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <ArrowLeft size={20} color={Colors.textMain} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>All Branches Orders History</Text>
          <Text style={styles.headerSub}>
            Enterprise Governance • {summaryStats.totalCount} Orders Found
          </Text>
        </View>
        <View style={styles.enterpriseBadge}>
          <Building2 size={12} color={Colors.primary} />
          <Text style={styles.enterpriseBadgeText}>ALL CITIES</Text>
        </View>
      </View>

      {/* Quick Status Tabs (All vs Pending vs Completed vs Cancelled) */}
      <View style={styles.statusSegmentRow}>
        {[
          { id: 'all', label: `All (${summaryStats.totalCount})` },
          { id: 'pending', label: `Pending (${summaryStats.pendingCount})` },
          { id: 'completed', label: `Completed (${summaryStats.paidCount})` },
          { id: 'cancelled', label: 'Cancelled' },
        ].map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.statusSegmentBtn, isActive && styles.statusSegmentBtnActive]}
              onPress={() => setStatusFilter(tab.id as any)}
            >
              <Text style={[styles.statusSegmentText, isActive && styles.statusSegmentTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Dropdown Filters Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsRow}>
        {/* 1. Branch Dropdown Button */}
        <TouchableOpacity style={styles.filterDropdownBtn} onPress={() => setBranchDropdownOpen(true)}>
          <Building2 size={13} color={selectedBranch !== 'all' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.filterDropdownText, selectedBranch !== 'all' && styles.filterDropdownTextActive]}>
            {selectedBranch === 'all' ? 'Branch: All' : getBranchLabel(selectedBranch).split('(')[0].trim()}
          </Text>
          <ChevronDown size={13} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* 2. Date Scope Dropdown Button */}
        <TouchableOpacity style={styles.filterDropdownBtn} onPress={() => setDateDropdownOpen(true)}>
          <Calendar size={13} color={dateScope !== 'today' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.filterDropdownText, dateScope !== 'today' && styles.filterDropdownTextActive]}>
            Date: {dateScope === 'today' ? 'Today' : dateScope === 'yesterday' ? 'Yesterday' : dateScope === 'week' ? 'Past 7 Days' : dateScope === 'month' ? 'This Month' : 'All Time'}
          </Text>
          <ChevronDown size={13} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* 3. Collection / Payment Dropdown Button */}
        <TouchableOpacity style={styles.filterDropdownBtn} onPress={() => setCollectionDropdownOpen(true)}>
          <Banknote size={13} color={collectionFilter !== 'all' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.filterDropdownText, collectionFilter !== 'all' && styles.filterDropdownTextActive]}>
            {collectionFilter === 'all' ? 'All Paid' : collectionFilter === 'paid_cash' ? 'Cash' : collectionFilter === 'paid_online' ? 'Online' : 'Refunded'}
          </Text>
          <ChevronDown size={13} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* 4. Order Type Dropdown Button */}
        <TouchableOpacity style={styles.filterDropdownBtn} onPress={() => setTypeDropdownOpen(true)}>
          <ShoppingBag size={13} color={typeFilter !== 'all' ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.filterDropdownText, typeFilter !== 'all' && styles.filterDropdownTextActive]}>
            Type: {typeFilter === 'all' ? 'All' : typeFilter === 'dine_in' ? 'Dine-In' : typeFilter === 'takeaway' ? 'Takeaway' : 'Delivery'}
          </Text>
          <ChevronDown size={13} color={Colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>

      {/* Search Input */}
      <View style={styles.searchBox}>
        <Search size={15} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Order #, Customer, Phone, Dish, Table..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={15} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Metric Cards Row */}
      <View style={styles.kpiRow}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Total Orders</Text>
          <Text style={styles.kpiVal}>{summaryStats.totalCount}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Verified Paid</Text>
          <Text style={[styles.kpiVal, { color: Colors.success }]}>{summaryStats.paidCount}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>Settled Collections</Text>
          <Text style={[styles.kpiVal, { color: Colors.primary }]}>Rs. {summaryStats.totalRevenue.toLocaleString()}</Text>
        </View>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>In Progress</Text>
          <Text style={[styles.kpiVal, { color: '#D97706' }]}>{summaryStats.pendingCount}</Text>
        </View>
      </View>

      {/* Orders List */}
      <ScrollView contentContainerStyle={styles.ordersList} showsVerticalScrollIndicator={false}>
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyCard}>
            <Receipt size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptySub}>
              Try adjusting your branch, date, or collection filters.
            </Text>
          </View>
        ) : (
          filteredOrders.map((ord) => {
            const st = getStatusColor(ord.status);
            const isPaid = isOrderPaid(ord);
            const branchName = getBranchLabel(ord.branchId);

            return (
              <TouchableOpacity
                key={ord.id}
                style={styles.orderCard}
                activeOpacity={0.85}
                onPress={() => setSelectedOrder(ord)}
              >
                {/* Card Top: Order Number + Status + Time */}
                <View style={styles.cardHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.orderNumber}>#{ord.orderNumber}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: st.text }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.orderTime}>
                    {ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                  </Text>
                </View>

                {/* Branch Location & Fulfillment Line */}
                <View style={styles.branchLine}>
                  <Building2 size={12} color={Colors.primary} />
                  <Text style={styles.branchLineText} numberOfLines={1}>
                    {branchName} • {ord.type === 'dine_in' ? `Table ${ord.tableNumber || 'Seated'}` : ord.type === 'takeaway' ? 'Takeaway Counter' : `Delivery to ${ord.deliveryAddress || 'Address'}`}
                  </Text>
                </View>

                {/* Customer Info */}
                <Text style={styles.customerName}>
                  {ord.customerName} {ord.customerPhone ? `• ${ord.customerPhone}` : ''}
                </Text>

                {/* Items Summary */}
                <Text style={styles.itemsSummary} numberOfLines={2}>
                  {ord.items && ord.items.length > 0
                    ? ord.items.map((i) => `${i.name} x${i.quantity}`).join(', ')
                    : 'Dishes in order'}
                </Text>

                {/* Bottom Row: Total Bill & Collection Pill */}
                <View style={styles.cardBottomRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View
                      style={[
                        styles.payBadge,
                        { backgroundColor: isPaid ? Colors.successLight : '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.payBadgeText,
                          { color: isPaid ? Colors.success : '#D97706' },
                        ]}
                      >
                        {isPaid ? (isCashPayment(ord) ? '💵 PAID (CASH)' : '💳 PAID (ONLINE)') : '⏳ PAYMENT PENDING'}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.orderTotal}>Rs. {Number(ord.total || 0).toLocaleString()}</Text>
                    <ChevronRight size={14} color={Colors.textMuted} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ================= MODALS ================= */}

      {/* Branch Dropdown Modal */}
      <Modal visible={branchDropdownOpen} transparent={true} animationType="fade" statusBarTranslucent={true}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setBranchDropdownOpen(false)}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>Filter by Branch</Text>
            <TouchableOpacity
              style={[styles.dropdownItem, selectedBranch === 'all' && styles.dropdownItemActive]}
              onPress={() => {
                setSelectedBranch('all');
                setBranchDropdownOpen(false);
              }}
            >
              <Text style={[styles.dropdownItemText, selectedBranch === 'all' && styles.dropdownItemTextActive]}>
                All Branches (All Cities)
              </Text>
            </TouchableOpacity>
            {branches.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[styles.dropdownItem, selectedBranch === b.id && styles.dropdownItemActive]}
                onPress={() => {
                  setSelectedBranch(b.id);
                  setBranchDropdownOpen(false);
                }}
              >
                <Text style={[styles.dropdownItemText, selectedBranch === b.id && styles.dropdownItemTextActive]}>
                  {b.name} ({b.city})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date Scope Dropdown Modal */}
      <Modal visible={dateDropdownOpen} transparent={true} animationType="fade" statusBarTranslucent={true}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setDateDropdownOpen(false)}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>Select Date Range</Text>
            {[
              { id: 'today', label: 'Today (Default • Fast)' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Past 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time History (Complete Records)' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.dropdownItem, dateScope === opt.id && styles.dropdownItemActive]}
                onPress={() => handleSelectDateScope(opt.id as any)}
              >
                <Text style={[styles.dropdownItemText, dateScope === opt.id && styles.dropdownItemTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Collection Dropdown Modal */}
      <Modal visible={collectionDropdownOpen} transparent={true} animationType="fade" statusBarTranslucent={true}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setCollectionDropdownOpen(false)}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>Filter by Collection / Payment</Text>
            {[
              { id: 'all', label: 'All Paid Orders' },
              { id: 'paid_cash', label: 'Paid Cash (Till / COD)' },
              { id: 'paid_online', label: 'Paid Online (Cards / Wallets)' },
              { id: 'refunded', label: 'Refunded Orders' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.dropdownItem, collectionFilter === opt.id && styles.dropdownItemActive]}
                onPress={() => {
                  setCollectionFilter(opt.id as any);
                  setCollectionDropdownOpen(false);
                }}
              >
                <Text style={[styles.dropdownItemText, collectionFilter === opt.id && styles.dropdownItemTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Order Type Dropdown Modal */}
      <Modal visible={typeDropdownOpen} transparent={true} animationType="fade" statusBarTranslucent={true}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setTypeDropdownOpen(false)}>
          <View style={styles.dropdownModalCard}>
            <Text style={styles.dropdownModalTitle}>Filter by Order Type</Text>
            {[
              { id: 'all', label: 'All Fulfillment Types' },
              { id: 'dine_in', label: 'Dine-In (Table Seated)' },
              { id: 'takeaway', label: 'Takeaway (Counter Handover)' },
              { id: 'delivery', label: 'Doorstep Delivery' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[styles.dropdownItem, typeFilter === opt.id && styles.dropdownItemActive]}
                onPress={() => {
                  setTypeFilter(opt.id as any);
                  setTypeDropdownOpen(false);
                }}
              >
                <Text style={[styles.dropdownItemText, typeFilter === opt.id && styles.dropdownItemTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <Modal visible={true} transparent={true} animationType="slide" statusBarTranslucent={true}>
          <View style={styles.modalBackdrop}>
            <View style={styles.detailModalCard}>
              <View style={styles.detailHeader}>
                <View>
                  <Text style={styles.detailOrderNum}>Order #{selectedOrder.orderNumber}</Text>
                  <Text style={styles.detailBranch}>{getBranchLabel(selectedOrder.branchId)}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedOrder(null)}>
                  <X size={20} color={Colors.textMain} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {/* Customer Details */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Customer & Fulfillment</Text>
                  <Text style={styles.detailInfoText}>Name: {selectedOrder.customerName}</Text>
                  <Text style={styles.detailInfoText}>Phone: {selectedOrder.customerPhone || 'Not provided'}</Text>
                  <Text style={styles.detailInfoText}>
                    Type: {selectedOrder.type.toUpperCase()} • {selectedOrder.type === 'dine_in' ? `Table ${selectedOrder.tableNumber}` : selectedOrder.type === 'takeaway' ? 'Counter Pickup' : selectedOrder.deliveryAddress}
                  </Text>
                </View>

                {/* Itemized Dishes */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Itemized Dishes</Text>
                  {selectedOrder.items && selectedOrder.items.map((it: any, idx: number) => (
                    <View key={idx} style={styles.dishRow}>
                      <Text style={styles.dishName}>{it.name} x{it.quantity}</Text>
                      <Text style={styles.dishPrice}>Rs. {Number(((it.unitPrice ?? it.price ?? 0) * (it.quantity || 1))).toLocaleString()}</Text>
                    </View>
                  ))}
                </View>

                {/* Payment Breakdown */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Financial Breakdown</Text>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Subtotal</Text>
                    <Text style={styles.billVal}>Rs. {Number(selectedOrder.subtotal || selectedOrder.total || 0).toLocaleString()}</Text>
                  </View>
                  {Boolean(selectedOrder.tax) && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>GST Tax</Text>
                      <Text style={styles.billVal}>Rs. {Number(selectedOrder.tax).toLocaleString()}</Text>
                    </View>
                  )}
                  <View style={[styles.billRow, { borderTopWidth: 1, borderTopColor: Colors.borderColor, paddingTop: 6 }]}>
                    <Text style={[styles.billLabel, { fontWeight: '800', color: Colors.textMain }]}>Grand Total</Text>
                    <Text style={[styles.billVal, { fontWeight: '900', color: Colors.primary }]}>Rs. {Number(selectedOrder.total || 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Payment Method</Text>
                    <Text style={styles.billVal}>{selectedOrder.paymentMethod || 'Cash'} ({isOrderPaid(selectedOrder) ? 'Paid' : 'Pending'})</Text>
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setSelectedOrder(null)}
              >
                <Text style={styles.closeModalBtnText}>Close Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  enterpriseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  enterpriseBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.primary,
  },
  statusSegmentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  statusSegmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSegmentBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusSegmentText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  statusSegmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterPillsRow: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  filterDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  filterDropdownText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  filterDropdownTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgCard,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 12.5,
    color: Colors.textMain,
  },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  kpiVal: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.textMain,
    marginTop: 2,
  },
  ordersList: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  orderCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderNumber: {
    fontSize: 14.5,
    fontWeight: '900',
    color: Colors.textMain,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  orderTime: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  branchLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  branchLineText: {
    fontSize: 11.5,
    color: Colors.primary,
    fontWeight: '700',
    flex: 1,
  },
  customerName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
    marginBottom: 4,
  },
  itemsSummary: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: 10,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    paddingTop: 8,
  },
  payBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  payBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  orderTotal: {
    fontSize: 14.5,
    fontWeight: '900',
    color: Colors.textMain,
  },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dropdownModalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    elevation: 8,
  },
  dropdownModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 12,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  dropdownItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMain,
  },
  dropdownItemTextActive: {
    fontWeight: '800',
    color: Colors.primary,
  },
  detailModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 10,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    paddingBottom: 12,
    marginBottom: 12,
  },
  detailOrderNum: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textMain,
  },
  detailBranch: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  detailSection: {
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
    paddingBottom: 10,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  detailInfoText: {
    fontSize: 12.5,
    color: Colors.textMain,
    lineHeight: 18,
  },
  dishRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  dishName: {
    fontSize: 12.5,
    color: Colors.textMain,
    fontWeight: '600',
  },
  dishPrice: {
    fontSize: 12.5,
    color: Colors.textMain,
    fontWeight: '700',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  billLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  billVal: {
    fontSize: 12,
    color: Colors.textMain,
    fontWeight: '700',
  },
  closeModalBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  closeModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
