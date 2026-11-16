import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Modal,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { Order, OrderStatus } from '../types';
import {
  Bike,
  Navigation,
  Phone,
  MapPin,
  CheckCircle,
  Clock,
  Package,
  X,
  Banknote,
  Receipt,
  ChevronRight,
  Compass,
  ArrowRight,
  RotateCcw,
} from 'lucide-react-native';
import { OpenStreetMapView } from '../components/OpenStreetMapView';
import {
  OsmMarkerItem,
  getOsmDirectionsUrl,
  getOsmMultiStopRouteUrl,
  getOsmSearchUrl,
} from '../utils/openStreetMap';

export interface RiderConsoleProps {
  onNavigateToHistory?: () => void;
}

const POINT_LABELS = ['Point X', 'Point Y', 'Point Z', 'Point A', 'Point B', 'Point C', 'Point D', 'Point E', 'Point F'];

// Haversine formula to compute distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

// Pseudo-coords fallback deterministic offset from branch coordinates
function getOrderCoords(order: Order, branchLat: number, branchLng: number): { lat: number; lng: number } {
  if (order.customerCoordinates && order.customerCoordinates.lat && order.customerCoordinates.lng) {
    return { lat: order.customerCoordinates.lat, lng: order.customerCoordinates.lng };
  }
  let hash = 0;
  const str = order.orderNumber || order.id || '1';
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = (((Math.abs(hash) % 70) - 35) / 1000);
  const lngOffset = ((((Math.abs(hash) >> 3) % 70) - 35) / 1000);
  return { lat: branchLat + latOffset, lng: branchLng + lngOffset };
}

export function RiderConsole({ onNavigateToHistory }: RiderConsoleProps = {}) {
  const {
    orders,
    riderAvailability,
    updateRiderAvailability,
    departRider,
    acceptRiderOrder,
    markDeliveryCompleted,
    updateOrderStatus,
    currentUser,
    currentBranch,
    showToast,
    users,
    loginStaff,
    setBottomSheetOpen,
  } = useApp();

  const deliveryStaffUsers = useMemo(() => {
    const branchRiders = users.filter(
      (u) =>
        u.role === 'delivery_staff' &&
        (!currentBranch?.id || !u.branchId || u.branchId === currentBranch.id)
    );
    return branchRiders.length > 0 ? branchRiders : users.filter((u) => u.role === 'delivery_staff');
  }, [users, currentBranch?.id]);

  // Filter tabs for Active Orders: 'all' | 'cod' | 'paid'
  const [activeFilter, setActiveFilter] = useState<'all' | 'cod' | 'paid'>('all');
  const [selectedOrderToDeliverId, setSelectedOrderToDeliverId] = useState<string>('all');

  // Modal dialog states
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
  const [deliveryConfirmOrder, setDeliveryConfirmOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!selectedOrderForModal && !deliveryConfirmOrder) return;
    setBottomSheetOpen(true);
    return () => setBottomSheetOpen(false);
  }, [selectedOrderForModal, deliveryConfirmOrder, setBottomSheetOpen]);

  const isBusy = riderAvailability === 'busy';

  // Active Deliveries Queue: Excludes completed, delivered, and cancelled orders, and strictly isolates assigned orders to this rider
  const activeDeliveryOrders = useMemo(() => {
    return orders.filter((o) => {
      if (o.type !== 'delivery') return false;
      if (o.status === 'delivered' || o.status === 'completed' || o.status === 'cancelled') return false;
      // A rider only sees orders the cashier assigned to them (no unassigned pool).
      // If they go busy before accepting, the order is released back to the cashier.
      return Boolean(currentUser?.id) && o.assignedRiderId === currentUser?.id;
    });
  }, [orders, currentUser?.id]);

  // Branch coordinates
  const bLat = currentBranch?.latitude || 31.5204;
  const bLng = currentBranch?.longitude || 74.3587;

  // Orders to deliver sorted by distance from branch (nearest first, farthest last)
  const sortedOrdersToDeliver = useMemo(() => {
    const bCoords = {
      lat: Number(currentBranch?.latitude) || currentBranch?.coordinates?.lat || 31.5204,
      lng: Number(currentBranch?.longitude) || currentBranch?.coordinates?.lng || 74.3587,
    };

    return [...activeDeliveryOrders].map((ord) => {
      const oCoords = ord.customerCoordinates || { lat: 31.5204, lng: 74.3587 };
      const dist = calculateDistanceKm(bCoords.lat, bCoords.lng, oCoords.lat, oCoords.lng);
      return {
        order: ord,
        distanceKm: dist,
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [activeDeliveryOrders, currentBranch, calculateDistanceKm]);

  const filteredOrders = useMemo(() => {
    let list = sortedOrdersToDeliver.map((s) => s.order);
    if (selectedOrderToDeliverId !== 'all') {
      list = list.filter((o) => o.id === selectedOrderToDeliverId);
    }
    return list.filter((o) => {
      const isCOD = o.paymentMethod.includes('COD') || o.paymentMethod.includes('Cash');
      if (activeFilter === 'cod') return isCOD;
      if (activeFilter === 'paid') return o.paymentStatus === 'paid' && !isCOD;
      return true; // 'all'
    });
  }, [sortedOrdersToDeliver, selectedOrderToDeliverId, activeFilter]);

  // NEAREST-ORDER-FIRST SEQUENCING ALGORITHM (Greedy Nearest Neighbor starting from Base)
  const routeStops = useMemo(() => {
    if (activeDeliveryOrders.length === 0) return [];

    const unvisited = [...activeDeliveryOrders];
    const ordered: Order[] = [];

    let curLat = bLat;
    let curLng = bLng;

    // Greedy pick: nearest remaining stop to the previous stop
    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const coords = getOrderCoords(unvisited[i], bLat, bLng);
        const dist = calculateDistanceKm(curLat, curLng, coords.lat, coords.lng);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      const nextOrder = unvisited.splice(nearestIdx, 1)[0];
      ordered.push(nextOrder);
      const nextCoords = getOrderCoords(nextOrder, bLat, bLng);
      curLat = nextCoords.lat;
      curLng = nextCoords.lng;
    }

    // Now build stops with distance metrics
    let prevLat = bLat;
    let prevLng = bLng;
    let prevName = `${currentBranch?.name || 'Base Branch'} (Base)`;
    let cumulative = 0;

    return ordered.map((ord, idx) => {
      const coords = getOrderCoords(ord, bLat, bLng);
      const distFromPrev = calculateDistanceKm(prevLat, prevLng, coords.lat, coords.lng);
      cumulative += distFromPrev;
      const pointLabel = POINT_LABELS[idx] || `Point ${String.fromCharCode(65 + idx)}`;
      const isNearestFirst = idx === 0;

      const stop = {
        order: ord,
        stopNumber: idx + 1,
        pointLabel: isNearestFirst ? `${pointLabel} (Nearest)` : pointLabel,
        rawPointLabel: pointLabel,
        coords,
        distFromPrev,
        cumulativeDist: Math.round(cumulative * 10) / 10,
        prevLocationName: prevName,
        isDelivered: ord.status === 'delivered' || ord.status === 'completed',
      };

      prevLat = coords.lat;
      prevLng = coords.lng;
      prevName = pointLabel;
      return stop;
    });
  }, [activeDeliveryOrders, bLat, bLng, currentBranch]);

  // Route metrics calculation
  const routeMetrics = useMemo(() => {
    const totalStops = routeStops.length;
    let totalDist = 0;
    let returnToBaseDist = 0;

    if (routeStops.length > 0) {
      const lastStop = routeStops[routeStops.length - 1];
      returnToBaseDist = calculateDistanceKm(lastStop.coords.lat, lastStop.coords.lng, bLat, bLng);
      totalDist = Math.round((lastStop.cumulativeDist + returnToBaseDist) * 10) / 10;
    }

    return { totalStops, totalDist, returnToBaseDist };
  }, [routeStops, bLat, bLng]);

  // Handle Mark Ready to Dispatch / Depart for Delivery
  const handleDepartForDelivery = () => {
    departRider();
    showToast('🚀 Ready to Dispatch! Status set to Busy (No new orders will be assigned)', 'success');
  };

  // Open multi-stop route in OpenStreetMap
  const handleOpenMultiStopGoogleMaps = () => {
    if (routeStops.length === 0) return;
    const origin = { lat: bLat, lng: bLng };
    const url = getOsmMultiStopRouteUrl(
      origin,
      routeStops.map((s) => s.coords)
    );
    Linking.openURL(url).catch(() => {
      showToast('Opening OpenStreetMap route navigation...', 'info');
    });
  };

  // Direct single stop navigation in Google Maps
  const handleOpenGoogleMaps = (ord: Order) => {
    const origin = { lat: bLat, lng: bLng };
    let url = '';
    if (ord.customerCoordinates && ord.customerCoordinates.lat && ord.customerCoordinates.lng) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${ord.customerCoordinates.lat},${ord.customerCoordinates.lng}`;
    } else if (ord.deliveryAddress) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ord.deliveryAddress)}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${origin.lat},${origin.lng}`;
    }
    Linking.openURL(url).catch(() => {
      showToast('Opening Google Maps navigation...', 'info');
    });
  };

  const handleCallCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      showToast(`Calling customer: ${phone}`, 'info');
    });
  };

  const handleStartTrip = (ord: Order) => {
    updateOrderStatus(ord.id, 'out_for_delivery' as OrderStatus, {
      assignedRiderId: currentUser?.id,
      assignedRiderName: currentUser?.name,
      riderStatus: 'on_trip',
    });
    updateRiderAvailability('busy', currentUser?.id);
    showToast(`Order #${ord.orderNumber} picked up! Starting delivery trip 🛵`, 'info');
  };

  const handleFinishDelivery = (ord: Order) => {
    setDeliveryConfirmOrder(ord);
  };

  const handleConfirmFinish = (collectedCash: boolean) => {
    if (!deliveryConfirmOrder) return;
    const orderNum = deliveryConfirmOrder.orderNumber;
    markDeliveryCompleted(deliveryConfirmOrder.id, collectedCash);
    showToast(`Order #${orderNum} delivered & moved to History! 📦✓`, 'success');
    setDeliveryConfirmOrder(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Rider Console</Text>
      <Text style={styles.pageSub}>Express delivery dispatch • GPS turn-by-turn navigation</Text>

      {/* ========================================================
          ACTIVE RIDER PROFILE & QUICK SWITCHER (Mobile Exclusive)
          ======================================================== */}
      <View style={styles.riderProfileCard}>
        <View style={styles.riderProfileRow}>
          <View style={styles.riderAvatar}>
            <Bike size={20} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={styles.riderProfileName}>{currentUser?.name || 'Usman Ghani'}</Text>
              <View style={styles.mobileExclusiveBadge}>
                <Text style={styles.mobileExclusiveText}>Mobile App Exclusive 📱</Text>
              </View>
            </View>
            <Text style={styles.riderProfileSub}>
              {currentUser?.phone || '+92 302 8882233'} • {currentBranch?.name || 'Gulberg Branch'}
            </Text>
          </View>
        </View>

        {deliveryStaffUsers.length > 1 && (
          <View style={styles.riderSwitcherContainer}>
            <Text style={styles.switcherLabel}>Switch Rider Profile:</Text>
            <View style={styles.switcherPillsRow}>
              {deliveryStaffUsers.map((u) => {
                const isSelected = u.id === currentUser?.id;
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.switcherPill, isSelected && styles.switcherPillActive]}
                    onPress={() => {
                      if (!isSelected) {
                        loginStaff(u);
                        showToast(`Switched active rider to ${u.name} 🛵`, 'info');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.switcherPillText, isSelected && styles.switcherPillTextActive]}>
                      {u.name} {isSelected ? '✓' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* ========================================================
          DUTY STATUS SEGMENTED SELECTOR (Imported from Web)
          ======================================================== */}
      <View style={styles.dutyCard}>
        <View style={styles.dutyHeader}>
          <View style={styles.dutyTitleRow}>
            <Bike size={16} color={Colors.primary} />
            <Text style={styles.dutyLabel}>Rider Shift Duty Status:</Text>
          </View>
          <View
            style={[
              styles.dutyPillBadge,
              {
                backgroundColor:
                  riderAvailability === 'busy'
                    ? '#FEF3C7'
                    : riderAvailability === 'available'
                    ? Colors.successLight
                    : Colors.bgSubtle,
              },
            ]}
          >
            <View
              style={[
                styles.dutyDot,
                {
                  backgroundColor:
                    riderAvailability === 'busy'
                      ? '#D97706'
                      : riderAvailability === 'available'
                      ? Colors.success
                      : Colors.textMuted,
                },
              ]}
            />
            <Text
              style={[
                styles.dutyPillText,
                {
                  color:
                    riderAvailability === 'busy'
                      ? '#B45309'
                      : riderAvailability === 'available'
                      ? Colors.success
                      : Colors.textMuted,
                },
              ]}
            >
              {riderAvailability === 'busy'
                ? 'GOING FOR DELIVERY (BUSY)'
                : riderAvailability === 'available'
                ? 'ONLINE (READY)'
                : 'OFFLINE (OFF DUTY)'}
            </Text>
          </View>
        </View>

        {/* 3 Duty State Buttons: Available, Busy (Going for Delivery), Offline */}
        <View style={styles.dutyButtonsRow}>
          <TouchableOpacity
            style={[
              styles.dutyBtn,
              riderAvailability === 'available' && styles.dutyBtnOnlineActive,
            ]}
            onPress={() => updateRiderAvailability('available')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.dutyBtnText,
                riderAvailability === 'available' && styles.dutyBtnTextOnlineActive,
              ]}
            >
              🟢 Ready
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dutyBtn,
              riderAvailability === 'busy' && styles.dutyBtnBusyActive,
            ]}
            onPress={() => updateRiderAvailability('busy')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.dutyBtnText,
                riderAvailability === 'busy' && styles.dutyBtnTextBusyActive,
              ]}
            >
              🟠 Going for Delivery
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dutyBtn,
              riderAvailability === 'offline' && styles.dutyBtnOfflineActive,
            ]}
            onPress={() => updateRiderAvailability('offline')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.dutyBtnText,
                riderAvailability === 'offline' && styles.dutyBtnTextOfflineActive,
              ]}
            >
              ⚫ Offline
            </Text>
          </TouchableOpacity>
        </View>

        {/* Helper Explanation Note */}
        <View style={styles.dutyNoticeBox}>
          <Text style={styles.dutyNoticeText}>
            {riderAvailability === 'busy'
              ? '🔒 Status set to Going for Delivery (Busy): Customer Support CANNOT assign new orders to you while you are en route.'
              : riderAvailability === 'available'
              ? '🔓 Status set to Ready: You are at the branch and available to receive new delivery orders.'
              : '⚫ Status set to Offline: Off shift or on break.'}
          </Text>
        </View>
      </View>

      {/* ========================================================
          DEPARTURE / READY TO DISPATCH ACTION BANNERS
          ======================================================== */}
      {/* 1. When Not Busy and Has Orders: Show "Ready for Departure" Banner */}
      {!isBusy && activeDeliveryOrders.length > 0 && (
        <View style={styles.departCard}>
          <View style={styles.departHeader}>
            <View style={styles.departIconBox}>
              <Bike size={22} color={Colors.textWhite} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.departTitleRow}>
                <Text style={styles.departTitle}>
                  Ready for Departure ({activeDeliveryOrders.length} Orders Assigned)
                </Text>
                <View style={styles.departBadge}>
                  <Text style={styles.departBadgeText}>Ready at Base</Text>
                </View>
              </View>
              <Text style={styles.departDesc}>
                Customer Support can still assign orders while you are at the branch. Before departing, tap Ready to Dispatch so you won&apos;t receive new orders.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.departCtaBtn}
            onPress={handleDepartForDelivery}
            activeOpacity={0.85}
          >
            <Bike size={16} color={Colors.textWhite} />
            <Text style={styles.departCtaText}>
              🚀 Ready to Dispatch / Depart (Mark Busy)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. When Busy and En Route: Show Active En Route Banner */}
      {isBusy && activeDeliveryOrders.length > 0 && (
        <View style={styles.enRouteCard}>
          <View style={styles.enRouteHeader}>
            <View style={styles.enRouteIconBox}>
              <Navigation size={22} color={Colors.textWhite} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.departTitleRow}>
                <Text style={styles.enRouteTitle}>En Route on Delivery Trip</Text>
                <View style={styles.busyPillBadge}>
                  <Text style={styles.busyPillText}>Status: Busy ({activeDeliveryOrders.length} Left)</Text>
                </View>
              </View>
              <Text style={styles.enRouteDesc}>
                Customer Support cannot assign new orders. Tap below to view your multi-stop directions sequenced nearest-first!
              </Text>
            </View>
          </View>

          <View style={styles.enRouteActionsRow}>
            <TouchableOpacity
              style={styles.returnBaseBtn}
              onPress={() => {
                updateRiderAvailability('available');
                showToast('Returned to base! Status set to Ready 🟢', 'success');
              }}
              activeOpacity={0.85}
            >
              <RotateCcw size={13} color="#1E40AF" />
              <Text style={styles.returnBaseBtnText}>↩️ Return to Base (Mark Ready)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick History Navigation Link */}
      {onNavigateToHistory && (
        <TouchableOpacity
          style={styles.historyBanner}
          onPress={onNavigateToHistory}
          activeOpacity={0.8}
        >
          <View style={styles.historyBannerLeft}>
            <Receipt size={16} color={Colors.primary} />
            <Text style={styles.historyBannerText}>
              View Delivered Orders & Cash Collections →
            </Text>
          </View>
          <ChevronRight size={16} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* ========================================================
          HORIZONTAL SCROLLABLE ROW: ORDERS TO DELIVER (NEAREST FIRST)
          ======================================================== */}
      {sortedOrdersToDeliver.length > 0 && (
        <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: Colors.textMain }}>
              🛵 Orders to Deliver ({sortedOrdersToDeliver.length})
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: '600', color: Colors.textMuted }}>
              Nearest to branch ➔ Farthest
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
          >
            <TouchableOpacity
              style={[
                styles.filterPill,
                selectedOrderToDeliverId === 'all' && styles.filterPillActive,
              ]}
              onPress={() => setSelectedOrderToDeliverId('all')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedOrderToDeliverId === 'all' && styles.filterPillTextActive,
                ]}
              >
                All Orders ({sortedOrdersToDeliver.length})
              </Text>
            </TouchableOpacity>

            {sortedOrdersToDeliver.map(({ order, distanceKm }) => {
              const isSelected = selectedOrderToDeliverId === order.id;
              return (
                <TouchableOpacity
                  key={order.id}
                  style={[
                    styles.filterPill,
                    isSelected && styles.filterPillActive,
                  ]}
                  onPress={() => setSelectedOrderToDeliverId(isSelected ? 'all' : order.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isSelected && styles.filterPillTextActive,
                    ]}
                  >
                    #{order.orderNumber} ({distanceKm} km)
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Active Orders Queue */}
      <View>
        {/* Secondary Filter Tabs */}
        <View style={styles.filterRow}>
            {([
              { id: 'all', label: `All Active (${activeDeliveryOrders.length})` },
              { id: 'cod', label: 'Cash on Delivery (COD)' },
              { id: 'paid', label: 'Paid Online' },
            ] as const).map(({ id, label }) => {
              const isActive = activeFilter === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setActiveFilter(id as any)}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Active Deliveries List */}
          <View style={styles.ordersList}>
            {filteredOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <Package size={40} color={Colors.textLight} />
                <Text style={styles.emptyTitle}>No Active Deliveries in Queue</Text>
                <Text style={styles.emptySub}>
                  All active doorstep orders are completed or none assigned. Delivered orders are moved to History.
                </Text>
                {onNavigateToHistory && (
                  <TouchableOpacity
                    style={styles.viewHistoryBtn}
                    onPress={onNavigateToHistory}
                    activeOpacity={0.8}
                  >
                    <Receipt size={14} color={Colors.textWhite} />
                    <Text style={styles.viewHistoryBtnText}>View Delivered Orders in History</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              filteredOrders.map((ord) => {
                const isCompleted = ord.status === 'completed' || ord.status === 'delivered';
                const isCOD = ord.paymentMethod.includes('COD') || ord.paymentMethod.includes('Cash');

                return (
                  <View key={ord.id} style={[styles.orderCard, isCompleted && styles.orderCardCompleted]}>
                    <View style={styles.cardTop}>
                      <View>
                        <Text style={styles.orderNum}>Order #{ord.orderNumber}</Text>
                        <Text style={styles.customerName}>{ord.customerName}</Text>
                      </View>
                      <View style={[styles.paymentBadge, isCOD ? styles.codBadge : styles.paidBadge]}>
                        <Text style={[styles.paymentBadgeText, isCOD ? styles.codBadgeText : styles.paidBadgeText]}>
                          {isCOD ? 'COLLECT COD: Rs. ' + ord.total : 'PAID ONLINE'}
                        </Text>
                      </View>
                    </View>

                    {/* Delivery Address */}
                    <View style={styles.addressBox}>
                      <MapPin size={14} color={Colors.primary} style={{ marginTop: 2 }} />
                      <Text style={styles.addressText}>
                        {ord.deliveryAddress || 'Gulberg III, Lahore'}
                      </Text>
                    </View>

                    {/* Contact phone link */}
                    <TouchableOpacity
                      style={styles.phoneLinkRow}
                      onPress={() => handleCallCustomer(ord.customerPhone)}
                    >
                      <Phone size={13} color={Colors.info} />
                      <Text style={styles.phoneLinkText}>Call Customer: {ord.customerPhone}</Text>
                    </TouchableOpacity>

                    {/* Action Row */}
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={styles.detailsBtn}
                        onPress={() => setSelectedOrderForModal(ord)}
                      >
                        <Package size={13} color={Colors.textMuted} />
                        <Text style={styles.detailsBtnText}>View Items ({ord.items.length})</Text>
                      </TouchableOpacity>

                      {/* Get Direction 🗺️ (Located in bottom right corner per highlight.md) */}
                      <TouchableOpacity
                        style={styles.getDirectionBtn}
                        onPress={() => handleOpenGoogleMaps(ord)}
                      >
                        <Navigation size={13} color={Colors.textWhite} />
                        <Text style={styles.getDirectionText}>Google Maps 🗺️</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Rider Trip Controls */}
                    {!isCompleted && (!ord.riderStatus || ord.riderStatus === 'assigned') && (
                      <TouchableOpacity
                        style={[styles.finishBtn, { backgroundColor: '#2563EB', marginBottom: 8 }]}
                        onPress={() => acceptRiderOrder(ord.id)}
                        activeOpacity={0.8}
                      >
                        <CheckCircle size={15} color={Colors.textWhite} />
                        <Text style={styles.finishBtnText}>Accept Order ✓</Text>
                      </TouchableOpacity>
                    )}

                    {!isCompleted && ord.status !== 'out_for_delivery' && ord.riderStatus === 'accepted' && (
                      <TouchableOpacity
                        style={[styles.finishBtn, { backgroundColor: '#F59E0B' }]}
                        onPress={() => handleStartTrip(ord)}
                        activeOpacity={0.8}
                      >
                        <Bike size={15} color={Colors.textWhite} />
                        <Text style={styles.finishBtnText}>Pick Up & Start Trip 🛵</Text>
                      </TouchableOpacity>
                    )}

                    {!isCompleted && (ord.status === 'out_for_delivery' || ord.riderStatus === 'on_trip') && (
                      <TouchableOpacity
                        style={[styles.finishBtn, { backgroundColor: '#10B981' }]}
                        onPress={() => handleFinishDelivery(ord)}
                        activeOpacity={0.8}
                      >
                        <CheckCircle size={15} color={Colors.textWhite} />
                        <Text style={styles.finishBtnText}>Mark Paid & Delivered ✓</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </View>
        </View>










      {/* ========================================================
          ITEMS POPUP MODAL
          ======================================================== */}
      <Modal visible={!!selectedOrderForModal} transparent animationType="slide" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Order #{selectedOrderForModal?.orderNumber}</Text>
                <Text style={styles.modalSub}>{selectedOrderForModal?.customerName}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedOrderForModal(null)}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 220, marginVertical: 8 }}>
              {selectedOrderForModal?.items.map((it, idx) => (
                <View key={idx} style={styles.modalItemRow}>
                  <Text style={styles.modalItemName}>
                    {it.quantity}x {it.name} {it.size ? `(${it.size})` : ''}
                  </Text>
                  <Text style={styles.modalItemPrice}>Rs. {it.unitPrice * it.quantity}</Text>
                </View>
              ))}
              {selectedOrderForModal?.notes && (
                <View style={styles.modalNotesBox}>
                  <Text style={styles.modalNotesText}>Note: {selectedOrderForModal.notes}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotalLabel}>Total Amount</Text>
              <Text style={styles.modalTotalVal}>Rs. {selectedOrderForModal?.total}</Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          DELIVERY CONFIRMATION MODAL
          ======================================================== */}
      <Modal visible={!!deliveryConfirmOrder} transparent animationType="fade" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <CheckCircle size={36} color={Colors.success} style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={styles.confirmTitle}>Confirm Doorstep Delivery & Payment</Text>
            <Text style={styles.confirmSub}>
              Order #{deliveryConfirmOrder?.orderNumber} for {deliveryConfirmOrder?.customerName}
            </Text>

            <View style={styles.codAlert}>
              <Banknote size={16} color={Colors.warning} />
              <Text style={styles.codAlertText}>
                {deliveryConfirmOrder?.paymentMethod.includes('COD') || deliveryConfirmOrder?.paymentMethod.includes('Cash')
                  ? `Confirm cash collection of Rs. ${deliveryConfirmOrder.total} from customer. This will settle in Cashier Till.`
                  : `Online prepaid order (Rs. ${deliveryConfirmOrder?.total || 0}) — handover order to customer.`}
              </Text>
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelConfirmBtn}
                onPress={() => setDeliveryConfirmOrder(null)}
              >
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptConfirmBtn}
                onPress={() => handleConfirmFinish(true)}
              >
                <Text style={styles.acceptConfirmText}>Yes, Mark Paid & Delivered ✓</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textMain,
  },
  pageSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  // Duty Card Styles
  dutyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: 14,
  },
  dutyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 6,
  },
  dutyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dutyLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
  dutyPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  dutyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dutyPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  dutyButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dutyBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
  },
  dutyBtnOnlineActive: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.success,
  },
  dutyBtnBusyActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
  },
  dutyBtnOfflineActive: {
    backgroundColor: Colors.bgSubtle,
    borderColor: Colors.textMuted,
  },
  dutyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  dutyBtnTextOnlineActive: {
    color: Colors.success,
    fontWeight: '800',
  },
  dutyBtnTextBusyActive: {
    color: '#B45309',
    fontWeight: '800',
  },
  dutyBtnTextOfflineActive: {
    color: Colors.textMain,
    fontWeight: '800',
  },
  dutyNoticeBox: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  dutyNoticeText: {
    fontSize: 10.5,
    color: Colors.textMuted,
    lineHeight: 14,
    fontWeight: '600',
  },
  // Depart Card (Ready for Departure)
  departCard: {
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
  },
  departHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  departIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  departTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  departTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#9A3412',
  },
  departBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  departBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#166534',
  },
  departDesc: {
    fontSize: 11,
    color: '#C2410C',
    marginTop: 4,
    lineHeight: 15,
  },
  departCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
    gap: 6,
    elevation: 3,
  },
  departCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  // En Route Card
  enRouteCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#2563EB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    elevation: 2,
  },
  enRouteHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  enRouteIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enRouteTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#1E40AF',
  },
  busyPillBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  busyPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#B45309',
  },
  enRouteDesc: {
    fontSize: 11,
    color: '#1D4ED8',
    marginTop: 4,
    lineHeight: 15,
  },
  enRouteActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  viewRouteBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 9,
    gap: 6,
  },
  viewRouteBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  returnBaseBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 9,
    gap: 5,
  },
  returnBaseBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E40AF',
  },
  // Main Tabs Row (Active Orders vs Multi-Stop Route)
  mainTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  mainTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    gap: 6,
  },
  mainTabBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  mainTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  mainTabTextActive: {
    color: Colors.textWhite,
  },
  // History Banner
  historyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  historyBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  historyBannerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.primary,
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  filterPillTextActive: {
    color: Colors.textWhite,
  },
  ordersList: {
    gap: 12,
  },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  viewHistoryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  orderCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    elevation: 2,
  },
  orderCardCompleted: {
    opacity: 0.75,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  orderNum: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textMain,
  },
  customerName: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  codBadge: {
    backgroundColor: Colors.warningLight,
  },
  codBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.warning,
  },
  paidBadge: {
    backgroundColor: Colors.successLight,
  },
  paidBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.success,
  },
  addressBox: {
    flexDirection: 'row',
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginVertical: 6,
  },
  addressText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMain,
    flex: 1,
    lineHeight: 16,
  },
  phoneLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  phoneLinkText: {
    fontSize: 11,
    color: Colors.info,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  getDirectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  getDirectionText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
    gap: 6,
  },
  finishBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  // Route View Styles
  routeContainer: {
    gap: 14,
  },
  routeHeaderCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    gap: 12,
  },
  routeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeHeaderTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textMain,
  },
  routeHeaderSub: {
    fontSize: 10.5,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 14,
  },
  openAllMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 7,
    elevation: 2,
  },
  openAllMapsBtnDisabled: {
    opacity: 0.5,
  },
  openAllMapsBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.textMain,
    marginTop: 3,
  },
  metricSub: {
    fontSize: 9.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  // Pipeline Stepper
  pipelineScroll: {
    marginVertical: 4,
  },
  pipelineContent: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  pipelineBaseBadge: {
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pipelineBaseText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMain,
  },
  pipelineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pipelineStopBadge: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  pipelineStopNearestBadge: {
    backgroundColor: '#FFF7ED',
    borderColor: Colors.primary,
  },
  pipelineStopFocusedBadge: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  pipelineStopText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: Colors.textMain,
  },
  pipelineStopNearestText: {
    color: Colors.primary,
  },
  pipelineFinishBadge: {
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pipelineFinishText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.success,
  },
  // Stop Cards
  stopsList: {
    gap: 12,
  },
  collapsedStopCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    opacity: 0.8,
  },
  collapsedStopTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
  collapsedStopSub: {
    fontSize: 10.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  expandText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  stopCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    elevation: 2,
    gap: 10,
  },
  stopCardNearest: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  stopCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  stopBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopPointPill: {
    backgroundColor: Colors.bgSubtle,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  stopPointNearestPill: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stopPointPillText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: Colors.textMain,
  },
  stopPointNearestPillText: {
    color: Colors.textWhite,
  },
  stopOrderNum: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.primary,
  },
  stopDistancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  stopDistanceText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  nearestBanner: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 6,
    borderRadius: 8,
  },
  nearestBannerText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#9A3412',
  },
  stopDetailsBox: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  stopCustHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopCustName: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textMain,
  },
  stopPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stopPhoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.info,
  },
  stopAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  stopAddressText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: Colors.textMain,
    flex: 1,
    lineHeight: 15,
  },
  stopItemsBox: {
    paddingHorizontal: 2,
  },
  stopItemsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  stopItemsText: {
    fontSize: 11,
    color: Colors.textMain,
    lineHeight: 15,
    marginTop: 2,
  },
  stopActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
    gap: 8,
  },
  stopNavBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 9,
    paddingVertical: 8,
    gap: 5,
  },
  stopNavBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  stopFinishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    borderRadius: 9,
    paddingVertical: 8,
    gap: 5,
  },
  stopFinishBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  modalSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  modalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modalItemName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMain,
  },
  modalItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  modalNotesBox: {
    backgroundColor: Colors.warningLight,
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  modalNotesText: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '600',
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    paddingTop: 10,
    marginTop: 6,
  },
  modalTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  modalTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
  },
  confirmCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 3,
  },
  codAlert: {
    flexDirection: 'row',
    backgroundColor: Colors.warningLight,
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  codAlertText: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: '700',
    flex: 1,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelConfirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
  },
  cancelConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  acceptConfirmBtn: {
    flex: 1.6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.success,
    alignItems: 'center',
  },
  acceptConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  riderProfileCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  riderProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight || '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderProfileName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
  },
  mobileExclusiveBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  mobileExclusiveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  riderProfileSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  riderSwitcherContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
  },
  switcherLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  switcherPillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  switcherPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  switcherPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  switcherPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMain,
  },
  switcherPillTextActive: {
    color: Colors.textWhite,
    fontWeight: '800',
  },
});
