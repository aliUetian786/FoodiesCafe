import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Modal,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { CartItem, Order, getCancellationAttribution } from '../types';
import {
  Navigation,
  CheckCircle2,
  Receipt,
  Plus,
  Minus,
  Trash2,
  X,
  AlertTriangle,
  Printer,
  ShoppingBag,
  Map as MapIcon,
} from 'lucide-react-native';
import { CustomerLoginModal } from './CustomerLoginModal';
import { OpenStreetMapView } from '../components/OpenStreetMapView';
import { calculateHaversineKm, getOsmDirectionsUrl } from '../utils/openStreetMap';

const { height } = Dimensions.get('window');

interface CustomerTrackingProps {
  onBackToMenu: () => void;
  onViewHistory?: () => void;
}

function parseDateSafe(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;
  const spaceReplaced = new Date(dateStr.replace(' ', 'T'));
  if (!isNaN(spaceReplaced.getTime())) return spaceReplaced;
  return null;
}

function parseOrderTimeMs(dateStr?: string): number {
  if (!dateStr) return 0;
  const d = parseDateSafe(dateStr);
  return d ? d.getTime() : 0;
}

function formatPlacedTime(dateStr?: string): string {
  if (!dateStr) return 'Just now';
  const d = parseDateSafe(dateStr);
  if (!d) {
    const match = dateStr.match(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b/);
    if (match) return match[0];
    const parts = dateStr.split(',');
    return parts.length > 1 ? parts[1].trim() : dateStr;
  }
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const minutePadded = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hour12 < 10 ? '0' : ''}${hour12}:${minutePadded} ${ampm}`;
}

export function CustomerTracking({ onBackToMenu, onViewHistory }: CustomerTrackingProps) {
  const {
    orders,
    cancelOrder,
    editOrderStage1,
    menuItems,
    showToast,
    branches,
    currentBranch,
    setBottomSheetOpen,
    currentUser,
    customerUser,
    isCustomerLoggedIn,
    customerCoordinates,
  } = useApp();

  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [expandedMapOrderId, setExpandedMapOrderId] = useState<string | null>(null);

  const normalizePhone = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
  const cleanPhone = normalizePhone(customerUser?.phone || currentUser?.phone);

  // All active in-progress orders remain in tracking until confirmed received/completed
  // List new orders in tracking at the very top (sorted strictly by createdAt descending)
  // If not logged in, show ZERO orders
  const activeOrders = useMemo(() => {
    if (!isCustomerLoggedIn) {
      return [];
    }

    const filtered = orders.filter((o) => {
      if (
        o.status === 'completed' ||
        o.status === 'delivered' ||
        o.status === 'served' ||
        o.status === 'taken' ||
        o.status === 'cancelled'
      ) {
        return false;
      }
      // Strictly link to authenticated customer account
      const matchesId = (customerUser?.id && o.customerId === customerUser.id) || (currentUser?.id && currentUser.id !== 'guest' && o.customerId === currentUser.id);
      const matchesPhone = cleanPhone && normalizePhone(o.customerPhone) === cleanPhone;
      const matchesEmail = (customerUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === customerUser.email.toLowerCase()) ||
                           (currentUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === currentUser.email.toLowerCase());
      const matchesName = (customerUser?.name && o.customerName === customerUser.name) ||
                          (currentUser?.name && currentUser.name !== 'Guest Customer' && o.customerName === currentUser.name);
      return matchesId || matchesPhone || matchesEmail || matchesName;
    });

    return filtered.sort((a, b) => parseOrderTimeMs(b.createdAt) - parseOrderTimeMs(a.createdAt));
  }, [orders, currentUser, customerUser, isCustomerLoggedIn, cleanPhone]);

  const cancelledOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (o.status !== 'cancelled') return false;
        const matchesId = (customerUser?.id && o.customerId === customerUser.id) || (currentUser?.id && currentUser.id !== 'guest' && o.customerId === currentUser.id);
        const matchesPhone = cleanPhone && normalizePhone(o.customerPhone) === cleanPhone;
        const matchesEmail = (customerUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === customerUser.email.toLowerCase()) ||
                             (currentUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === currentUser.email.toLowerCase());
        const matchesName = (customerUser?.name && o.customerName === customerUser.name) ||
                            (currentUser?.name && currentUser.name !== 'Guest Customer' && o.customerName === currentUser.name);
        return matchesId || matchesPhone || matchesEmail || matchesName;
      })
      .sort((a, b) => parseOrderTimeMs(b.createdAt) - parseOrderTimeMs(a.createdAt));
  }, [orders, currentUser, customerUser, isCustomerLoggedIn, cleanPhone]);

  // Edit / Add Items Modal State (tracks the specific order being edited)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [currentDishes, setCurrentDishes] = useState<CartItem[]>([]);
  const [addedMoreCounts, setAddedMoreCounts] = useState<Record<string, number>>({});

  // Cancel Confirmation Modal State (tracks the specific order being cancelled)
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  // Thermal Receipt / Bill Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<Order | null>(null);

  useEffect(() => {
    const isAnyModalActive = Boolean(editingOrder || cancellingOrder || selectedReceipt);
    if (!isAnyModalActive) return;
    setBottomSheetOpen(true);
    return () => {
      setBottomSheetOpen(false);
    };
  }, [editingOrder, cancellingOrder, selectedReceipt, setBottomSheetOpen]);

  // Format branch name strictly into 2 words e.g. "Gulberg Branch"
  const getBranchTwoWords = (name: string): string => {
    const clean = name.replace(/\s*\(.*?\)/g, '').trim();
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      if (words[1].toLowerCase() === 'branch') {
        return `${words[0]} ${words[1]}`;
      }
      const branchIdx = words.findIndex((w) => w.toLowerCase() === 'branch');
      if (branchIdx !== -1) {
        return `${words[0]} Branch`;
      }
      return `${words[0]} ${words[1]}`;
    }
    return `${clean} Branch`;
  };

  // Dishes available to add in "Add More": exclude items that are already in editingOrder.items
  const addMoreDishes = useMemo(() => {
    if (!editingOrder) return menuItems;
    return menuItems.filter(
      (dish) =>
        !editingOrder.items.some(
          (orig) =>
            orig.menuItemId === dish.id ||
            orig.name.toLowerCase() === dish.name.toLowerCase()
        )
    );
  }, [menuItems, editingOrder]);

  // Unauthenticated State: show zero orders and prompt to log in with email
  if (!isCustomerLoggedIn) {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: 'rgba(217, 101, 40, 0.12)' }]}>
          <ShoppingBag size={42} color={Colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>Sign In to Track Orders</Text>
        <Text style={styles.emptySubtitle}>
          Please sign in with your email to view your active orders and track live preparation status.
        </Text>
        <View style={styles.emptyBtnRow}>
          <TouchableOpacity
            style={styles.browseBtn}
            onPress={() => setLoginModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.browseBtnText}>Sign In with Email</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.historyBtn}
            onPress={onBackToMenu}
            activeOpacity={0.8}
          >
            <Text style={styles.historyBtnText}>Browse Menu →</Text>
          </TouchableOpacity>
        </View>

        <CustomerLoginModal
          visible={loginModalVisible}
          onClose={() => setLoginModalVisible(false)}
          onSuccess={() => setLoginModalVisible(false)}
        />
      </View>
    );
  }

  // If all orders are delivered/served/taken or cancelled:
  if (activeOrders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        {cancelledOrders.length > 0 && (() => {
          const mostRecent = cancelledOrders[0];
          const attr = getCancellationAttribution(mostRecent);
          return (
            <View
              style={{
                width: '100%',
                maxWidth: 380,
                padding: 14,
                borderRadius: 14,
                backgroundColor: '#FEF2F2',
                borderWidth: 1,
                borderColor: '#FCA5A5',
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} color="#DC2626" />
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#DC2626' }}>
                  Order #{mostRecent.orderNumber}{' '}
                  {attr.isCustomer
                    ? 'Cancelled by You'
                    : attr.badge === 'CANCELLED (BRANCH CLOSED)'
                      ? 'Cancelled (Branch Closed)'
                      : 'Cancelled by Staff'}
                </Text>
              </View>
              <Text style={{ fontSize: 11.5, color: '#7F1D1D', marginTop: 4, lineHeight: 16 }}>
                {attr.isCustomer
                  ? 'You cancelled this order. All records are saved in Order History.'
                  : attr.badge === 'CANCELLED (BRANCH CLOSED)'
                    ? 'This order was cancelled from tracking because the branch went offline before receipt. All records are saved in Order History.'
                    : 'This order was cancelled by cafe staff prior to receipt. All records are saved in Order History.'}
              </Text>
            </View>
          );
        })()}

        <View style={styles.emptyIconCircle}>
          <CheckCircle2 size={44} color={Colors.success} />
        </View>
        <Text style={styles.emptyTitle}>All Orders Received!</Text>
        <Text style={styles.emptySubtitle}>
          You have no pending in-progress orders. All past orders and receipts are saved permanently in your Order History.
        </Text>
        <View style={styles.emptyBtnRow}>
          {onViewHistory && (
            <TouchableOpacity style={styles.historyBtn} onPress={onViewHistory} activeOpacity={0.8}>
              <Receipt size={14} color={Colors.primary} />
              <Text style={styles.historyBtnText}>View Order History →</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.browseBtn} onPress={onBackToMenu} activeOpacity={0.8}>
            <Text style={styles.browseBtnText}>Browse Menu & Order →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleOpenDirections = (ord: Order, locationDisplay: string) => {
    const orderBranch = branches.find((b) => b.id === ord.branchId) || currentBranch;
    const branchCoords = {
      lat: Number(orderBranch.latitude) || 31.5204,
      lng: Number(orderBranch.longitude) || 74.3587,
    };

    if (ord.type !== 'delivery') {
      const gUrl = `https://www.google.com/maps/search/?api=1&query=${branchCoords.lat},${branchCoords.lng}`;
      Linking.openURL(gUrl).catch(() => {
        showToast(`Google Maps: ${orderBranch.name}`, 'info');
      });
      return;
    }

    const destCoords =
      ord.type === 'delivery' && ord.customerCoordinates
        ? ord.customerCoordinates
        : branchCoords;
    const originCoords =
      ord.type === 'delivery'
        ? branchCoords
        : customerCoordinates;

    const url = getOsmDirectionsUrl(originCoords, destCoords);
    Linking.openURL(url).catch(() => {
      showToast(`OpenStreetMap Location: ${locationDisplay}`, 'info');
    });
  };



  // Open Edit / Add Items Modal for a specific order
  const handleOpenEditItems = (ord: Order) => {
    setEditingOrder(ord);
    setCurrentDishes(
      ord.items.map((i) => ({
        ...i,
        quantity: i.quantity || 1,
        unitPrice: Number(i.unitPrice) || 0,
      }))
    );
    setAddedMoreCounts({});
  };

  // Stepper for Current Dishes (already selected items)
  const handleEditCurrentQty = (itemId: string, delta: number) => {
    const isPrepOrReady = editingOrder?.status === 'preparing' || editingOrder?.status === 'ready';
    if (isPrepOrReady && delta < 0) {
      showToast('Items already preparing in kitchen cannot be removed or reduced.', 'warning');
      return;
    }
    setCurrentDishes((prev) =>
      prev
        .map((it) => (it.id === itemId ? { ...it, quantity: it.quantity + delta } : it))
        .filter((it) => it.quantity > 0)
    );
  };

  // Stepper for Add More (newly added items stay right in Add More)
  const handleStepAddMore = (dishId: string, delta: number) => {
    setAddedMoreCounts((prev) => {
      const curr = prev[dishId] || 0;
      const next = Math.max(0, curr + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[dishId];
        return copy;
      }
      return { ...prev, [dishId]: next };
    });
  };

  // Confirm changes from Edit Modal
  const handleSaveEditItems = () => {
    if (!editingOrder) return;
    const activeCurrent = currentDishes.filter((i) => i.quantity > 0);
    const fromAddMore: CartItem[] = Object.entries(addedMoreCounts)
      .filter(([_, qty]) => qty > 0)
      .map(([dishId, qty], idx) => {
        const dish = menuItems.find((m) => m.id === dishId);
        return {
          id: `add-${dishId}-${Date.now()}-${idx}`,
          menuItemId: dishId,
          name: dish ? dish.name : 'Foodies Special Dish',
          unitPrice: dish ? Number(dish.basePrice) : 0,
          quantity: qty,
          isAddOn: true,
        };
      });

    const combined = [...activeCurrent, ...fromAddMore];

    if (combined.length === 0) {
      cancelOrder(editingOrder.id, 'All items deselected from order by customer');
      showToast(`Order #${editingOrder.orderNumber} cancelled and moved to Order History`, 'info');
      setEditingOrder(null);
      return;
    }

    editOrderStage1(editingOrder.id, combined);
    setEditingOrder(null);
  };

  // Confirm order cancellation: moves order to History
  const handleConfirmCancelOrder = () => {
    if (!cancellingOrder) return;
    cancelOrder(cancellingOrder.id, 'Cancelled by customer');
    showToast(`Order #${cancellingOrder.orderNumber} cancelled and moved to Order History`, 'info');
    setCancellingOrder(null);
  };

  // Calculate live total for edit items
  const currentSubtotal = currentDishes.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  const addMoreSubtotal = Object.entries(addedMoreCounts).reduce((acc, [dishId, qty]) => {
    const dish = menuItems.find((m) => m.id === dishId);
    return acc + (dish ? Number(dish.basePrice) * qty : 0);
  }, 0);
  const editSubtotal = currentSubtotal + addMoreSubtotal;
  const editTax = Math.round(editSubtotal * 0.16 * 10) / 10;
  const editGrandTotal = editSubtotal + editTax;

  const totalSelectedCount =
    currentDishes.filter((i) => i.quantity > 0).length + Object.keys(addedMoreCounts).length;

  const readyCount = activeOrders.filter(
    (o) => o.status === 'ready' || o.status === 'out_for_delivery'
  ).length;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Summary Header when tracking orders */}
        <View style={styles.trackingTopRow}>
          <View>
            <Text style={styles.trackingTopTitle}>Live Order Tracking</Text>
            <Text style={styles.trackingTopSub}>
              {activeOrders.length} active {activeOrders.length === 1 ? 'order' : 'orders'} in progress
            </Text>
          </View>
          {readyCount > 0 && (
            <View style={styles.readySummaryPill}>
              <Text style={styles.readySummaryPillText}>
                {readyCount} {readyCount === 1 ? 'ORDER READY' : 'ORDERS READY'}
              </Text>
            </View>
          )}
        </View>

        {activeOrders.map((ord) => {
          const isOutForDelivery = ord.type === 'delivery' && ord.status === 'out_for_delivery';
          const isReady = ord.status === 'ready';
          const isPreparing = ord.status === 'preparing';
          const displayStatus = isOutForDelivery
            ? 'ON THE WAY'
            : isReady
            ? 'READY'
            : isPreparing
            ? 'PREPARING'
            : 'PLACED';

          const canCancel =
            ord.status === 'placed' &&
            !ord.sentToKitchen &&
            !(ord.type === 'delivery' && Boolean(ord.assignedRiderId));
          // When food is in preparing state: order can also add more items.
          // For delivery: when rider takes delivery (out_for_delivery) or ready, order cannot be added.
          const canAddItems =
            ['placed', 'accepted', 'preparing'].includes(ord.status) &&
            !isOutForDelivery &&
            !isReady;

          const placedTime = formatPlacedTime(ord.createdAt);
          const orderTypeDisplay = ord.type.toUpperCase().replace('_', ' ');
          const tableNumberText = ord.tableNumber
            ? ord.tableNumber.toLowerCase().startsWith('table')
              ? ord.tableNumber
              : `Table ${ord.tableNumber}`
            : 'Table T-01';

          const orderBranch = branches.find((b) => b.id === ord.branchId) || currentBranch;
          const locationDisplay =
            ord.type === 'delivery'
              ? ord.deliveryAddress || 'Doorstep Delivery Address'
              : getBranchTwoWords(orderBranch.name);

          const finalStageLabel =
            ord.type === 'dine_in'
              ? 'Served'
              : ord.type === 'takeaway'
              ? 'Taken'
              : 'Delivered';

          return (
            <View
              key={ord.id}
              style={[
                styles.orderCard,
                (isReady || isOutForDelivery) && styles.orderCardReady,
              ]}
            >
              {/* Line 1: Order #FC-1106 on the left, status badge on the right */}
              <View style={styles.cardHeader}>
                <Text style={styles.orderNum}>Order #{ord.orderNumber}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    isPreparing && styles.statusBadgePreparing,
                    isReady && styles.statusBadgeReady,
                    isOutForDelivery && styles.statusBadgeOnTheWay,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isPreparing && styles.statusBadgePreparingText,
                      isReady && styles.statusBadgeReadyText,
                      isOutForDelivery && styles.statusBadgeOnTheWayText,
                    ]}
                  >
                    {isOutForDelivery ? '🛵 ON THE WAY' : displayStatus}
                  </Text>
                </View>
              </View>

              {/* Line 2: Placed at 01:36 AM • DINE IN • Table T-01 */}
              <Text style={styles.orderTime}>
                {ord.type === 'dine_in'
                  ? `Placed at ${placedTime} • DINE IN • ${tableNumberText}`
                  : `Placed at ${placedTime} • ${orderTypeDisplay}`}
              </Text>



              {/* Ready Process Callout Banner (Read-only operational status) */}
              {isReady && (
                <View style={styles.readyCalloutBox}>
                  <CheckCircle2 size={15} color={Colors.success} />
                  <Text style={styles.readyCalloutText}>
                    {ord.type === 'dine_in'
                      ? `Dishes are READY! Floor waiter is serving to ${tableNumberText}.`
                      : ord.type === 'takeaway'
                      ? `Order is READY! Please show Order #${ord.orderNumber} to counter cashier to collect.`
                      : `Order is READY! Assigned rider will hand over at your doorstep.`}
                  </Text>
                </View>
              )}

              {/* Line 3+: Bulleted items */}
              <View style={styles.itemsBox}>
                {ord.items.map((i, idx) => (
                  <Text key={idx} style={styles.itemBulletText}>
                    • {i.quantity}x {i.name}
                  </Text>
                ))}
              </View>

              {/* Line 4: Location / Address, Add Item, Cancel, and Direction Sign */}
              <View style={styles.cardFooterRow}>
                <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                  📍 {locationDisplay}
                </Text>

                <View style={styles.footerActions}>
                  {/* Bill / Printable Receipt button */}
                  <TouchableOpacity
                    style={styles.billBtn}
                    onPress={() => setSelectedReceipt(ord)}
                    activeOpacity={0.7}
                  >
                    <Receipt size={12} color={Colors.primary} />
                    <Text style={styles.billBtnText}>Bill</Text>
                  </TouchableOpacity>

                  {canAddItems && (
                    <TouchableOpacity
                      style={styles.addItemBtn}
                      onPress={() => handleOpenEditItems(ord)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addItemBtnText}>+ Add Item</Text>
                    </TouchableOpacity>
                  )}

                  {isOutForDelivery && (
                    <View style={styles.onTheWayPill}>
                      <Text style={styles.onTheWayPillText}>Rider on route 🛵</Text>
                    </View>
                  )}

                  {/* Cancel Button: Available only before kitchen preparation starts */}
                  {canCancel && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setCancellingOrder(ord)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  )}

                  {/* Embedded OpenStreetMap View + External OpenStreetMap Link */}
                  <TouchableOpacity
                    style={[styles.billBtn, { borderColor: '#CBD5E1', backgroundColor: expandedMapOrderId === ord.id ? '#FFF7ED' : '#F8FAFC' }]}
                    onPress={() =>
                      setExpandedMapOrderId((prev) => (prev === ord.id ? null : ord.id))
                    }
                    activeOpacity={0.7}
                  >
                    <MapIcon size={12} color="#EA580C" />
                    <Text style={styles.billBtnText}>
                      {expandedMapOrderId === ord.id ? 'Hide Map' : ord.type === 'delivery' ? 'OpenStreetMap' : 'Google Maps'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.directionSignBtn}
                    onPress={() => handleOpenDirections(ord, locationDisplay)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Navigation size={15} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {expandedMapOrderId === ord.id && (
                <View style={{ marginTop: 10 }}>
                  <OpenStreetMapView
                    center={
                      ord.type === 'delivery' && (ord.customerCoordinates || customerCoordinates)
                        ? (ord.customerCoordinates || customerCoordinates)
                        : {
                            lat: Number(orderBranch.latitude) || 31.5126,
                            lng: Number(orderBranch.longitude) || 74.3436,
                          }
                    }
                    zoom={13}
                    height={195}
                    markers={[
                      {
                        id: `mob-track-branch-${ord.id}`,
                        lat: Number(orderBranch.latitude) || 31.5126,
                        lng: Number(orderBranch.longitude) || 74.3436,
                        title: orderBranch.name,
                        kind: 'selected_branch',
                      },
                      ...(ord.type === 'delivery' && (ord.customerCoordinates || customerCoordinates)
                        ? [
                            {
                              id: `mob-track-cust-${ord.id}`,
                              lat: (ord.customerCoordinates || customerCoordinates).lat,
                              lng: (ord.customerCoordinates || customerCoordinates).lng,
                              title: 'Delivery Pin',
                              kind: 'customer' as const,
                            },
                          ]
                        : []),
                    ]}
                    routeLine={
                      ord.type === 'delivery' && (ord.customerCoordinates || customerCoordinates)
                        ? {
                            from: {
                              lat: Number(orderBranch.latitude) || 31.5126,
                              lng: Number(orderBranch.longitude) || 74.3436,
                            },
                            to: ord.customerCoordinates || customerCoordinates,
                            label: `${calculateHaversineKm(
                              Number(orderBranch.latitude) || 31.5126,
                              Number(orderBranch.longitude) || 74.3436,
                              (ord.customerCoordinates || customerCoordinates).lat,
                              (ord.customerCoordinates || customerCoordinates).lng
                            )} km`,
                          }
                        : null
                    }
                    showSearch={false}
                    showGpsButton={false}
                    modeLabel={
                      ord.type === 'delivery'
                        ? 'OpenStreetMap • Delivery Route'
                        : 'Google Maps • Branch Location'
                    }
                    externalDirectionsOrigin={
                      ord.type === 'delivery'
                        ? {
                            lat: Number(orderBranch.latitude) || 31.5126,
                            lng: Number(orderBranch.longitude) || 74.3436,
                          }
                        : customerCoordinates
                    }
                  />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* ================= EDIT / ADD ITEMS MODAL ================= */}
      <Modal visible={Boolean(editingOrder)} transparent animationType="slide" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.editModalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalHeading}>
                  Add Items to Order #{editingOrder?.orderNumber}
                </Text>
                <Text style={styles.modalSub}>
                  Adjust quantities or add signature dishes before kitchen cooking
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditingOrder(null)} style={styles.modalCloseBtn}>
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} style={styles.editModalScroll}>
              {/* SECTION 1: Current Order Items */}
              <Text style={styles.sectionTitle}>Current Dishes ({currentDishes.length})</Text>

              {editingOrder?.status === 'preparing' && (
                <View style={styles.prepNoticeBanner}>
                  <Text style={styles.prepNoticeText}>
                    👨‍🍳 Cooking in Kitchen! Current dishes cannot be deselected. You can add more dishes below.
                  </Text>
                </View>
              )}

              {currentDishes.length === 0 ? (
                <View style={styles.emptyDishesBox}>
                  <Text style={styles.emptyDishesText}>
                    All current dishes deselected. Select dishes below or cancel order.
                  </Text>
                </View>
              ) : (
                currentDishes.map((item) => {
                  const isPrepOrReady = editingOrder?.status === 'preparing' || editingOrder?.status === 'ready';

                  return (
                    <View key={item.id} style={styles.editItemRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.editItemName}>{item.name}</Text>
                        <Text style={styles.editItemPrice}>Rs. {item.unitPrice * item.quantity}</Text>
                      </View>

                      {isPrepOrReady ? (
                        <View style={styles.lockedItemBadge}>
                          <Text style={styles.lockedItemBadgeText}>Cooking (Locked) 🔒</Text>
                        </View>
                      ) : (
                        <View style={styles.stepperWrap}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => handleEditCurrentQty(item.id, -1)}
                          >
                            {item.quantity === 1 ? (
                              <Trash2 size={13} color={Colors.danger} />
                            ) : (
                              <Minus size={13} color={Colors.primary} />
                            )}
                          </TouchableOpacity>
                          <Text style={styles.stepperQtyText}>{item.quantity}</Text>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => handleEditCurrentQty(item.id, 1)}
                          >
                            <Plus size={13} color={Colors.primary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}

              {/* SECTION 2: Add More */}
              <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Add More</Text>
              <View style={styles.menuDishesList}>
                {addMoreDishes.map((dish) => {
                  const addedQty = addedMoreCounts[dish.id] || 0;

                  return (
                    <View key={dish.id} style={styles.menuDishRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.menuDishName}>{dish.name}</Text>
                        <Text style={styles.menuDishPrice}>Rs. {dish.basePrice}</Text>
                      </View>

                      {addedQty > 0 ? (
                        <View style={styles.stepperWrap}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => handleStepAddMore(dish.id, -1)}
                          >
                            {addedQty === 1 ? (
                              <Trash2 size={13} color={Colors.danger} />
                            ) : (
                              <Minus size={13} color={Colors.primary} />
                            )}
                          </TouchableOpacity>
                          <Text style={styles.stepperQtyText}>{addedQty}</Text>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => handleStepAddMore(dish.id, 1)}
                          >
                            <Plus size={13} color={Colors.primary} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.addDishBtn}
                          onPress={() => handleStepAddMore(dish.id, 1)}
                          activeOpacity={0.8}
                        >
                          <Plus size={12} color={Colors.textWhite} />
                          <Text style={styles.addDishBtnText}>Add</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Bottom Actions */}
            <View style={styles.editModalFooter}>
              {totalSelectedCount > 0 ? (
                <TouchableOpacity
                  style={styles.saveEditBtn}
                  onPress={handleSaveEditItems}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveEditBtnText}>
                    Save Changes & Update Order (Rs. {editGrandTotal}) ✓
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.cancelFromEditBtn}
                  onPress={handleSaveEditItems}
                  activeOpacity={0.85}
                >
                  <AlertTriangle size={15} color={Colors.textWhite} />
                  <Text style={styles.cancelFromEditText}>
                    All Items Deselected — Cancel Order
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= CANCEL CONFIRMATION MODAL ================= */}
      <Modal visible={Boolean(cancellingOrder)} transparent animationType="fade" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <AlertTriangle size={28} color={Colors.danger} />
            </View>
            <Text style={styles.confirmTitle}>
              Cancel Order #{cancellingOrder?.orderNumber}?
            </Text>
            <Text style={styles.confirmSub}>
              Are you sure you want to cancel this order? Once confirmed, this order will be cancelled and moved to Order History.
            </Text>

            <View style={styles.confirmActionsRow}>
              <TouchableOpacity
                style={styles.keepOrderBtn}
                onPress={() => setCancellingOrder(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.keepOrderBtnText}>Keep Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={handleConfirmCancelOrder}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelBtnText}>Confirm Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= 80MM THERMAL RECEIPT / BILL MODAL ================= */}
      <Modal visible={Boolean(selectedReceipt)} transparent animationType="fade" statusBarTranslucent={true}>
        <View style={styles.modalBackdrop}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptBrand}>FoodiesCafe</Text>
              <Text style={styles.receiptSub}>Official 80mm POS Thermal Receipt</Text>
              <Text style={styles.receiptSub}>GST Registered • NTN: 8492019-3</Text>
              <TouchableOpacity
                style={styles.closeReceipt}
                onPress={() => setSelectedReceipt(null)}
              >
                <X size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaText}>Order: #{selectedReceipt?.orderNumber}</Text>
              <Text style={styles.receiptMetaText}>
                Date: {selectedReceipt && (parseDateSafe(selectedReceipt.createdAt)?.toLocaleDateString() || new Date().toLocaleDateString())}
              </Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaText}>Placed At:</Text>
              <Text style={[styles.receiptMetaText, { fontWeight: '700', color: Colors.textMain }]}>
                {selectedReceipt ? formatPlacedTime(selectedReceipt.createdAt) : 'Just now'}
              </Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaText}>Type: {selectedReceipt?.type.toUpperCase()}</Text>
              <Text style={styles.receiptMetaText}>
                Status: {selectedReceipt?.status.toUpperCase()}
              </Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMetaText}>Printed At:</Text>
              <Text style={[styles.receiptMetaText, { fontWeight: '800', color: Colors.primary }]}>
                {new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </Text>
            </View>

            <View style={styles.receiptDivider} />

            {/* Items table */}
            <ScrollView style={{ maxHeight: 180 }}>
              {selectedReceipt?.items.map((it, idx) => (
                <View key={idx} style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName}>
                    {it.quantity}x {it.name}
                  </Text>
                  <Text style={styles.receiptItemPrice}>Rs. {Number(it.unitPrice) * Number(it.quantity)}</Text>
                </View>
              ))}
            </ScrollView>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>Subtotal</Text>
              <Text style={styles.receiptTotalVal}>Rs. {selectedReceipt?.originalSubtotal || selectedReceipt?.total}</Text>
            </View>
            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>GST (16%)</Text>
              <Text style={styles.receiptTotalVal}>Rs. {selectedReceipt?.tax || 0}</Text>
            </View>
            <View style={[styles.receiptTotalRow, { marginTop: 4 }]}>
              <Text style={styles.receiptGrandLabel}>GRAND TOTAL</Text>
              <Text style={styles.receiptGrandVal}>Rs. {selectedReceipt?.total}</Text>
            </View>

            <View style={styles.receiptFooter}>
              <Text style={styles.thankYouText}>Thank you for dining with FoodiesCafe!</Text>
              <Text style={styles.helplineText}>Printed live at that exact moment</Text>
            </View>

            <TouchableOpacity
              style={styles.printBtn}
              onPress={() => {
                showToast(`Receipt printed at ${new Date().toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })} ✓`, 'success');
                setSelectedReceipt(null);
              }}
            >
              <Printer size={15} color={Colors.textWhite} />
              <Text style={styles.printBtnText}>Print 80mm Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  trackingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  trackingTopTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
  },
  trackingTopSub: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 1,
  },
  readySummaryPill: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  readySummaryPillText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: Colors.success,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textMain,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  historyBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  browseBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseBtnText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '800',
  },
  orderCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardReady: {
    borderColor: '#22C55E',
    borderWidth: 1.8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderNum: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusBadgePreparing: {
    backgroundColor: '#FFEDD5',
    borderColor: '#FDBA74',
  },
  statusBadgeReady: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  statusBadgeOnTheWay: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  statusBadgePreparingText: {
    color: '#EA580C',
  },
  statusBadgeReadyText: {
    color: Colors.success,
  },
  statusBadgeOnTheWayText: {
    color: '#1D4ED8',
  },
  orderTime: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 10,
  },
  stepperBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgSubtle,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  stepperStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderColor,
  },
  stepDotDone: {
    backgroundColor: Colors.primary,
  },
  stepDotPreparing: {
    backgroundColor: '#EA580C',
  },
  stepDotReady: {
    backgroundColor: Colors.success,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.borderColor,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: Colors.success,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  stepLabelActive: {
    color: Colors.textMain,
    fontWeight: '800',
  },
  stepLabelReady: {
    color: Colors.success,
    fontWeight: '900',
  },
  readyCalloutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  readyCalloutText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  itemsBox: {
    paddingVertical: 2,
    gap: 6,
    marginBottom: 14,
  },
  itemBulletText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMain,
    lineHeight: 18,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMain,
    flex: 1,
    marginRight: 8,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  receivedBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.success,
  },
  receivedBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  addItemBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  addItemBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  cancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.danger,
  },
  directionSignBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editModalSheet: {
    height: height * 0.72,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  modalHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
  },
  modalSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgMain,
  },
  editModalScroll: {
    flex: 1,
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSubtle,
  },
  editItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  editItemPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  stepperBtn: {
    padding: 4,
  },
  stepperQtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    minWidth: 16,
    textAlign: 'center',
  },
  menuDishesList: {
    gap: 8,
  },
  menuDishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: Colors.bgSubtle,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  menuDishName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  menuDishPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 1,
  },
  emptyDishesBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginVertical: 6,
  },
  emptyDishesText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.danger,
    textAlign: 'center',
  },
  addDishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addDishBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  editModalFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
  },
  saveEditBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveEditBtnText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '800',
  },
  cancelFromEditBtn: {
    backgroundColor: Colors.danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelFromEditText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '800',
  },

  // Confirm Cancellation Dialog
  confirmCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    padding: 22,
    marginHorizontal: 24,
    marginBottom: height * 0.25,
    borderWidth: 1.5,
    borderColor: Colors.borderColor,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  confirmIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
    textAlign: 'center',
  },
  confirmSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  keepOrderBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.bgMain,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    alignItems: 'center',
  },
  keepOrderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMain,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: Colors.danger,
    alignItems: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textWhite,
  },
  billBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  billBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  onTheWayPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  onTheWayPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  acceptedBySupportPill: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  acceptedBySupportPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15803D',
  },
  prepNoticeBanner: {
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 10,
  },
  prepNoticeText: {
    fontSize: 11.5,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 16,
  },
  lockedItemBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  lockedItemBadgeText: {
    fontSize: 10.5,
    color: '#15803D',
    fontWeight: '800',
  },
  receiptCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  receiptHeader: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  receiptBrand: {
    fontSize: 18,
    fontWeight: '900',
    color: Colors.textMain,
    letterSpacing: -0.5,
  },
  receiptSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  closeReceipt: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 4,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: Colors.borderColor,
    marginVertical: 8,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  receiptMetaText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  receiptItemName: {
    fontSize: 12,
    color: Colors.textMain,
  },
  receiptItemPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  receiptTotalLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  receiptTotalVal: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
  },
  receiptGrandLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.textMain,
  },
  receiptGrandVal: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.primary,
  },
  receiptFooter: {
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.bgSubtle,
  },
  thankYouText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
  },
  helplineText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  printBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 12,
  },
  printBtnText: {
    color: Colors.textWhite,
    fontSize: 12,
    fontWeight: '800',
  },
});
