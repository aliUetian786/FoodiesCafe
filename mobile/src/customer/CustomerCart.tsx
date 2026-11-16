import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { KeyboardSafeModal as Modal } from '../components/KeyboardSafeModal';
import { Colors } from '../theme/colors';
import { useApp } from '../context/AppContext';
import { OrderType, Branch } from '../types';
import { CustomerLoginModal } from './CustomerLoginModal';
import { BranchSelectionSheet } from '../components/BranchSelectionSheet';
import { DeliveryMapModal } from '../components/DeliveryMapModal';
import { DineInSeatingSheet } from '../components/DineInSeatingSheet';
import {
  Trash2,
  Plus,
  Minus,
  Utensils,
  ShoppingBag,
  Bike,
  CheckCircle,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  Sparkles,
  AlertTriangle,
  ArrowLeft,
  X,
  User,
  Phone,
} from 'lucide-react-native';

const { height } = Dimensions.get('window');

interface CustomerCartProps {
  visible: boolean;
  onClose: () => void;
  onOrderPlaced: (orderId: string) => void;
}

export function CustomerCart({ visible, onClose, onOrderPlaced }: CustomerCartProps) {
  const {
    cart,
    updateCartQty,
    removeFromCart,
    cartSubtotal,
    cartCount,
    currentBranch,
    setBranchId,
    menuItems,
    currentUser,
    placeOrder,
    orderType: globalOrderType,
    setOrderType: setGlobalOrderType,
    isCustomerLoggedIn,
    setBranchUnavailableModal,
    hasConfirmedOrderType,
    setHasConfirmedOrderType,
    customerCoordinates,
    selectedDeliveryAddress,
    setSelectedDeliveryAddress,
    showToast,
    refreshData,
    setBottomSheetOpen,
    updateCurrentUser,
  } = useApp();

  // Inform global state that bottom sheet / checkout page is open
  useEffect(() => {
    if (!visible) return;
    setBottomSheetOpen(true);
    return () => {
      setBottomSheetOpen(false);
    };
  }, [visible, setBottomSheetOpen]);

  // Multi-step checkout: 'review' -> 'payment'
  const [step, setStep] = useState<'review' | 'payment'>('review');

  // Customer Login Modal State
  const [loginModalVisible, setLoginModalVisible] = useState(false);

  // Branch Selection Sheet (60-70% height)
  const [branchSheetVisible, setBranchSheetVisible] = useState(false);
  const [sheetMode, setSheetMode] = useState<'dine_in' | 'takeaway'>('dine_in');

  // Delivery Map Modal
  const [deliveryMapVisible, setDeliveryMapVisible] = useState(false);

  // Dine-In Seating Sheet (half screen from bottom to middle of screen)
  const [seatingSheetVisible, setSeatingSheetVisible] = useState(false);
  const [selectedTableNumber, setSelectedTableNumber] = useState<string>('T-01');

  // Track order fulfillment mode
  const [orderType, setLocalOrderType] = useState<OrderType>(globalOrderType || 'delivery');
  const [showModeSwitcher, setShowModeSwitcher] = useState<boolean>(false);

  const isDelivery = orderType === 'delivery';
  const minDeliveryAmount = currentBranch?.minDeliveryAmount ?? 500;
  const isBelowMinDelivery = isDelivery && cartCount > 0 && cartSubtotal < minDeliveryAmount;
  const deliveryShortfall = Math.max(0, minDeliveryAmount - cartSubtotal);

  // Form Details
  const [notes, setNotes] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>(
    currentUser?.name && currentUser.name !== 'Guest Customer' ? currentUser.name : ''
  );
  const [customerPhone, setCustomerPhone] = useState<string>(
    currentUser?.phone ? currentUser.phone.replace(/^(\+92|0)/, '') : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash on Delivery (COD)');
  const [confirmModalVisible, setConfirmModalVisible] = useState<boolean>(false);

  useEffect(() => {
    AsyncStorage.multiGet(['foodies_saved_customer_name', 'foodies_saved_customer_phone'])
      .then((stores) => {
        const savedName = stores[0]?.[1];
        const savedPhone = stores[1]?.[1];
        if (savedName && !customerName) setCustomerName(savedName);
        if (savedPhone && !customerPhone) setCustomerPhone(savedPhone.replace(/^(\+92|0)/, ''));
      })
      .catch(() => { });

    if (currentUser?.name && currentUser.name !== 'Guest Customer' && !customerName) {
      setCustomerName(currentUser.name);
    }
    if (currentUser?.phone && !customerPhone) {
      setCustomerPhone(currentUser.phone.replace(/^(\+92|0)/, ''));
    }
  }, [currentUser]);

  // Dynamic Payment Settings from Branch Manager / Owner
  const defaultPaymentSettings = React.useMemo(
    () => ({
      COD: true,
      Wallet: true,
      Card: true,
      Bank: true,
      Installment: false,
    }),
    []
  );

  const rawPaymentSettings = currentBranch?.paymentSettings;
  const currentTabPaymentSettings = React.useMemo(() => {
    if (!rawPaymentSettings) return defaultPaymentSettings;
    let parsed = rawPaymentSettings;
    if (typeof rawPaymentSettings === 'string') {
      try {
        parsed = JSON.parse(rawPaymentSettings);
      } catch (e) {
        return defaultPaymentSettings;
      }
    }
    const modeSettings = parsed?.[orderType];
    if (!modeSettings || typeof modeSettings !== 'object') {
      return defaultPaymentSettings;
    }
    return {
      COD: modeSettings.COD ?? true,
      Wallet: modeSettings.Wallet ?? true,
      Card: modeSettings.Card ?? true,
      Bank: modeSettings.Bank ?? true,
      Installment: modeSettings.Installment ?? false,
    };
  }, [rawPaymentSettings, orderType, defaultPaymentSettings]);

  // Fast real-time sync while on payment screen to reflect branch manager actions in under 1.5s
  useEffect(() => {
    if (step === 'payment') {
      refreshData();
      const timer = setInterval(() => {
        refreshData();
      }, 1500);
      return () => clearInterval(timer);
    }
  }, [step, refreshData]);

  const allPaymentMethods = React.useMemo(() => {
    return [
      {
        id: 'Cash on Delivery (COD)',
        label: orderType === 'dine_in' ? 'Pay Cash at Table / Till' : 'Cash on Delivery (COD)',
        icon: Banknote,
        sub: orderType === 'dine_in' ? 'Settle bill directly with floor server' : 'Pay when food arrives at doorstep',
        enabled: true,
      },
    ];
  }, [orderType]);

  const availablePaymentMethods = React.useMemo(() => {
    return allPaymentMethods.filter((pm) => pm.enabled);
  }, [allPaymentMethods]);

  // Auto-switch paymentMethod if current method is disabled by branch manager
  useEffect(() => {
    if (availablePaymentMethods.length > 0) {
      const exists = availablePaymentMethods.some((pm) => pm.id === paymentMethod);
      if (!exists) {
        const nextMethod = availablePaymentMethods[0].id;
        const previousMethod = paymentMethod;
        setPaymentMethod(nextMethod);
        if (step === 'payment') {
          showToast(`${previousMethod} was disabled by the branch manager. Switched to ${availablePaymentMethods[0].label}.`, 'info');
        }
      }
    }
  }, [availablePaymentMethods, paymentMethod, step, showToast]);

  useEffect(() => {
    if (globalOrderType) {
      setLocalOrderType(globalOrderType);
    }
  }, [globalOrderType, visible]);

  // Reset step to review when modal opens
  useEffect(() => {
    if (visible) {
      setStep('review');
      setShowModeSwitcher(false);
      setSeatingSheetVisible(false);
    }
  }, [visible]);

  const tax = Math.round(cartSubtotal * 0.16 * 10) / 10;
  const grandTotal = cartSubtotal + tax;

  const handleModeChange = (newMode: OrderType) => {
    setLocalOrderType(newMode);
    setShowModeSwitcher(false);

    if (newMode === 'delivery') {
      setDeliveryMapVisible(true);
    } else {
      setSheetMode(newMode);
      setBranchSheetVisible(true);
    }
  };

  const handleBranchSelected = (branch: Branch) => {
    setBranchId(branch.id);
    setGlobalOrderType(sheetMode);
    setLocalOrderType(sheetMode);
    setHasConfirmedOrderType(true);
    setBranchSheetVisible(false);
    showToast(`${sheetMode === 'dine_in' ? 'Dine-In' : 'Takeaway'} at ${branch.name}`, 'success');

    // Smoothly advance to the next step with newly updated branch pricing
    if (sheetMode === 'dine_in') {
      setSeatingSheetVisible(true);
    } else {
      setStep('payment');
    }
  };

  const handleDeliveryConfirmed = (addr: string, branch: Branch) => {
    setSelectedDeliveryAddress(addr);
    setBranchId(branch.id);
    setGlobalOrderType('delivery');
    setLocalOrderType('delivery');
    setHasConfirmedOrderType(true);
    setDeliveryMapVisible(false);
    showToast(`Delivery set to ${addr}`, 'success');

    // Smoothly advance to payment step with newly updated branch pricing
    setStep('payment');
  };

  const handleProceedFromReview = () => {
    // 0. If current branch is closed / offline, block checkout and prompt open branch
    if (!currentBranch.isOpen) {
      showToast(
        `⛔ ${currentBranch.name} is currently Closed / Offline. You cannot proceed with this branch. Please choose an open branch.`,
        'danger'
      );
      setSheetMode(orderType === 'delivery' ? 'takeaway' : orderType);
      setBranchSheetVisible(true);
      return;
    }

    // 0b. If delivery and cart subtotal is less than minimum delivery amount
    if (orderType === 'delivery' && cartSubtotal < minDeliveryAmount) {
      showToast(
        `Min delivery order is Rs. ${minDeliveryAmount}. Please select Rs. ${deliveryShortfall} more items to proceed.`,
        'danger'
      );
      return;
    }

    // 1. If not logged in, prompt sign in first
    if (!isCustomerLoggedIn) {
      setLoginModalVisible(true);
      return;
    }

    // 1b. Validate Customer Name like in web
    if (!customerName.trim()) {
      showToast('Please enter your name to proceed with your order.', 'warning');
      return;
    }

    // 1c. Validate Mobile Number like in web
    const cleanDigits = customerPhone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 9) {
      showToast('Please enter a valid mobile number (min 9 digits)', 'warning');
      return;
    }

    // 2. If order type was not confirmed earlier, ask about order type
    if (!hasConfirmedOrderType) {
      if (orderType === 'delivery') {
        setDeliveryMapVisible(true);
      } else {
        setSheetMode(orderType === 'dine_in' ? 'dine_in' : 'takeaway');
        setBranchSheetVisible(true);
      }
      return;
    }

    // Ensure cart prices are updated to this branch
    setBranchId(currentBranch.id);

    // 3. If Dine-In: seating moves to page after checkout review as a half screen bottom sheet
    if (orderType === 'dine_in') {
      setSeatingSheetVisible(true);
      return;
    }

    // 4. Otherwise proceed straight to payment
    setStep('payment');
  };

  const handleConfirmOrder = () => {
    // 0. Block if branch is closed / offline
    if (!currentBranch.isOpen) {
      showToast(
        `⛔ ${currentBranch.name} is currently Closed / Offline. Orders cannot be placed at this branch right now.`,
        'danger'
      );
      return;
    }

    // 0b. Minimum delivery amount check
    if (orderType === 'delivery' && cartSubtotal < minDeliveryAmount) {
      showToast(
        `Min delivery order is Rs. ${minDeliveryAmount}. Please select Rs. ${deliveryShortfall} more items.`,
        'danger'
      );
      return;
    }

    // 0c. Validate Customer Name and Mobile Number like in web
    if (!customerName.trim()) {
      showToast('Please enter your name to proceed with your order.', 'warning');
      return;
    }
    const cleanDigits = customerPhone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 9) {
      showToast('Please enter a valid mobile number (min 9 digits)', 'warning');
      return;
    }

    // Block if all payment modes are disabled by branch manager
    if (availablePaymentMethods.length === 0) {
      showToast(
        `⛔ Payment modes are temporarily paused for ${orderType.replace('_', ' ')} at this branch.`,
        'danger'
      );
      return;
    }

    // Check if any items in cart are unavailable at the selected branch
    const unavailableInCart = cart.filter((cartItem) => {
      const dish = menuItems.find(
        (m) => m.id === cartItem.menuItemId || m.name.toLowerCase() === cartItem.name.toLowerCase()
      );
      if (!dish) return false;
      const isAvailAtBranch = dish.branchAvailability?.[currentBranch.id] !== false && dish.isAvailable !== false;
      return !isAvailAtBranch;
    });

    if (unavailableInCart.length > 0) {
      const names = Array.from(new Set(unavailableInCart.map((i) => i.name)));
      setBranchUnavailableModal({
        visible: true,
        branchName: currentBranch.name,
        itemNames: names,
      });
      return;
    }

    const isPaidOnline = paymentMethod !== 'Cash on Delivery (COD)' && !paymentMethod.toLowerCase().includes('cash');
    const cleanLast10 = cleanDigits.slice(-10);
    const formattedPhone = customerPhone.trim().startsWith('+92')
      ? customerPhone.trim()
      : `+92${customerPhone.trim().replace(/^0+/, '')}`;

    const effectiveCustId = currentUser?.id && currentUser.id !== 'user-guest' && currentUser.id !== 'cust-guest'
      ? currentUser.id
      : cleanLast10
        ? `cust-${cleanLast10}`
        : `cust-mobile-${Date.now()}`;

    // Update user profile and AsyncStorage with latest name & phone
    if (customerName.trim()) {
      AsyncStorage.setItem('foodies_saved_customer_name', customerName.trim()).catch(() => { });
    }
    if (formattedPhone) {
      AsyncStorage.setItem('foodies_saved_customer_phone', formattedPhone).catch(() => { });
    }
    if (updateCurrentUser) {
      updateCurrentUser({
        name: customerName.trim() || currentUser?.name,
        phone: formattedPhone || currentUser?.phone,
      });
    }

    const placed = placeOrder({
      branchId: currentBranch.id,
      type: orderType,
      tableNumber: orderType === 'dine_in' ? selectedTableNumber : undefined,
      deliveryAddress: orderType === 'delivery' ? (selectedDeliveryAddress || 'Main Boulevard, Gulberg III, Lahore') : undefined,
      customerCoordinates: orderType === 'delivery' ? customerCoordinates : undefined,
      customerId: effectiveCustId,
      customerName: customerName.trim() || currentUser.name || 'Customer',
      customerPhone: formattedPhone || currentUser.phone || '03001234567',
      customerEmail: currentUser.email || undefined,
      notes: notes.trim() || undefined,
      paymentMethod,
      paymentStatus: isPaidOnline ? 'paid' : 'unpaid',
      paymentCollected: isPaidOnline,
    });

    setStep('review');
    onClose();
    onOrderPlaced(placed.id);
  };

  const getProceedBtnText = () => {
    if (!currentBranch.isOpen) {
      return 'Branch is Currently Closed / Offline';
    }
    if (!isCustomerLoggedIn) {
      return `Sign In to Checkout (Rs. ${grandTotal}) ➔`;
    }
    if (!hasConfirmedOrderType) {
      if (orderType === 'delivery') return 'Select Delivery Location ➔';
      if (orderType === 'takeaway') return 'Select Branch for Pickup ➔';
      if (orderType === 'dine_in') return 'Select Branch ➔';
    }
    if (orderType === 'dine_in') {
      return `Select Seating Table ➔`;
    }
    return `Proceed to Payment (Rs. ${grandTotal}) ➔`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent={true} navigationBarTranslucent={true}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        {/* Bottom sheet covering ~74% from bottom to middle/upper screen */}
        <View style={styles.sheetContainer}>
          {/* Drag Handle */}
          <View style={styles.handleWrap}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                if (step === 'payment') setStep('review');
                else onClose();
              }}
              style={styles.backBtn}
            >
              {step === 'review' ? (
                <X size={20} color={Colors.textMain} />
              ) : (
                <ArrowLeft size={20} color={Colors.textMain} />
              )}
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>
                {step === 'review' ? 'Your Cart & Review' : 'Choose Payment Method'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {step === 'review'
                  ? `${cartCount} items selected`
                  : orderType === 'dine_in'
                    ? `Table ${selectedTableNumber} • Final Step`
                    : 'Final Step'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Closed / Offline Warning Banner */}
          {!currentBranch.isOpen && (
            <View style={styles.closedWarningBanner}>
              <AlertTriangle size={16} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.closedWarningTitle}>
                  {currentBranch.name} is Closed / Offline
                </Text>
                <Text style={styles.closedWarningSub}>
                  Orders cannot be placed at this branch. Please choose an open branch to proceed.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeBranchMiniBtn}
                onPress={() => {
                  setSheetMode(orderType === 'delivery' ? 'takeaway' : orderType);
                  setBranchSheetVisible(true);
                }}
              >
                <Text style={styles.changeBranchMiniText}>Change Branch</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ================= STEP 1: REVIEW ================= */}
          {step === 'review' && (
            <View style={styles.reviewMainContainer}>
              {cart.length === 0 ? (
                <View style={styles.emptyCartWrap}>
                  <ShoppingBag size={44} color={Colors.textMuted} />
                  <Text style={styles.emptyCartTitle}>Your Cart is Empty</Text>
                  <Text style={styles.emptyCartSub}>Add signature karahi, biryani, or burgers to order</Text>
                </View>
              ) : (
                <View style={styles.flexOneColumn}>
                  {/* Mode Banner with 'Select another mode' */}
                  <View style={styles.preSelectedContainer}>
                    <View style={styles.preSelectedBadgeBar}>
                      <View style={styles.preSelectedBadgeLeft}>
                        {orderType === 'delivery' && <Bike size={15} color={Colors.primary} />}
                        {orderType === 'takeaway' && <ShoppingBag size={15} color={Colors.primary} />}
                        {orderType === 'dine_in' && <Utensils size={15} color={Colors.primary} />}
                        <View style={{ flexShrink: 1 }}>
                          <Text style={styles.preSelectedBadgeText} numberOfLines={1}>
                            {orderType === 'delivery'
                              ? `Delivery: ${selectedDeliveryAddress ? selectedDeliveryAddress.slice(0, 22) + '...' : 'Doorstep'}`
                              : orderType === 'takeaway'
                                ? `Takeaway: ${currentBranch.name}`
                                : `Dine-In: ${currentBranch.name}`}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.changeModeLink}
                        onPress={() => setShowModeSwitcher((prev) => !prev)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.changeModeLinkText}>Select another mode</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Inline Mode Switcher */}
                    {showModeSwitcher && (
                      <View style={styles.inlineSwitcherRow}>
                        <TouchableOpacity
                          style={[styles.preSelectCard, orderType === 'dine_in' && styles.preSelectCardActive]}
                          onPress={() => handleModeChange('dine_in')}
                        >
                          <Utensils size={13} color={orderType === 'dine_in' ? Colors.primary : Colors.textMuted} />
                          <Text style={[styles.preSelectText, orderType === 'dine_in' && styles.preSelectTextActive]}>
                            Dine-In
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.preSelectCard, orderType === 'takeaway' && styles.preSelectCardActive]}
                          onPress={() => handleModeChange('takeaway')}
                        >
                          <ShoppingBag size={13} color={orderType === 'takeaway' ? Colors.primary : Colors.textMuted} />
                          <Text style={[styles.preSelectText, orderType === 'takeaway' && styles.preSelectTextActive]}>
                            Takeaway
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.preSelectCard, orderType === 'delivery' && styles.preSelectCardActive]}
                          onPress={() => handleModeChange('delivery')}
                        >
                          <Bike size={13} color={orderType === 'delivery' ? Colors.primary : Colors.textMuted} />
                          <Text style={[styles.preSelectText, orderType === 'delivery' && styles.preSelectTextActive]}>
                            Delivery
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* SCROLLABLE ORDER ITEMS LIST */}
                  <View style={styles.scrollableItemsWrapper}>
                    <ScrollView
                      showsVerticalScrollIndicator={true}
                      contentContainerStyle={styles.itemsScrollContent}
                    >
                      <View style={styles.itemsCard}>
                        <Text style={styles.itemsCardTitle}>Order Items ({cartCount})</Text>
                        {cart.map((item) => (
                          <View key={item.id} style={styles.itemRow}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={styles.itemName}>{item.name}</Text>
                              {item.size && <Text style={styles.itemMeta}>Portion: {item.size}</Text>}
                              {item.extras && item.extras.length > 0 && (
                                <Text style={styles.itemMeta}>Extras: {item.extras.join(', ')}</Text>
                              )}
                              <Text style={styles.itemPrice}>Rs. {item.unitPrice * item.quantity}</Text>
                            </View>

                            <View style={styles.qtyStepper}>
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => {
                                  if (item.quantity === 1) removeFromCart(item.id);
                                  else updateCartQty(item.id, -1);
                                }}
                              >
                                {item.quantity === 1 ? (
                                  <Trash2 size={13} color={Colors.danger} />
                                ) : (
                                  <Minus size={13} color={Colors.primary} />
                                )}
                              </TouchableOpacity>
                              <Text style={styles.stepperQty}>{item.quantity}</Text>
                              <TouchableOpacity
                                style={styles.stepperBtn}
                                onPress={() => updateCartQty(item.id, 1)}
                              >
                                <Plus size={13} color={Colors.primary} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                  </View>

                  {/* STATIC BILL BREAKDOWN */}
                  <View style={styles.staticBillCard}>
                    <Text style={styles.billTitle}>Bill Breakdown</Text>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Subtotal</Text>
                      <Text style={styles.billVal}>Rs. {cartSubtotal}</Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>GST (16%)</Text>
                      <Text style={styles.billVal}>Rs. {tax}</Text>
                    </View>
                    <View style={[styles.billRow, styles.billRowTotal]}>
                      <Text style={styles.billLabelTotal}>Payable Total</Text>
                      <Text style={styles.billValTotal}>Rs. {grandTotal}</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ================= STEP 2: PAYMENT ================= */}
          {step === 'payment' && (
            <View style={styles.paymentMainContainer}>
              <ScrollView
                style={styles.paymentScrollableList}
                contentContainerStyle={styles.paymentScrollableContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
              >
                {/* 1. Fulfillment Summary at Top */}
                <View style={[styles.preSelectedBadgeBar, { marginBottom: 10, paddingVertical: 10, paddingHorizontal: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        backgroundColor: Colors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {orderType === 'dine_in' ? (
                        <Utensils size={17} color="#FFFFFF" />
                      ) : orderType === 'takeaway' ? (
                        <ShoppingBag size={17} color="#FFFFFF" />
                      ) : (
                        <Bike size={17} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: Colors.primary, textTransform: 'capitalize' }}>
                        {orderType === 'dine_in' ? '🍽️ Dine-In' : orderType === 'takeaway' ? '🛍️ Takeaway' : '🛵 Delivery'}
                      </Text>
                      <Text style={{ fontSize: 11, color: Colors.textMuted, marginTop: 1 }} numberOfLines={2}>
                        {orderType === 'dine_in'
                          ? `Table #${selectedTableNumber} • ${currentBranch.name}`
                          : orderType === 'takeaway'
                            ? currentBranch.name
                            : (selectedDeliveryAddress || 'Main Boulevard, Gulberg III, Lahore')}
                      </Text>
                      {orderType === 'delivery' && customerCoordinates && (
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#1D4ED8', marginTop: 2 }}>
                          OpenStreetMap Pin: {customerCoordinates.lat.toFixed(4)}, {customerCoordinates.lng.toFixed(4)}
                        </Text>
                      )}
                    </View>
                    {orderType === 'delivery' && (
                      <TouchableOpacity
                        onPress={() => setDeliveryMapVisible(true)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: '#FFF7ED',
                          borderWidth: 1,
                          borderColor: '#FED7AA',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#EA580C' }}>Edit Pin</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* 2. Total Bill Breakdown Box */}
                <View style={styles.staticBillCard}>
                  <Text style={styles.billTitle}>Bill Summary</Text>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Items Subtotal</Text>
                    <Text style={styles.billVal}>Rs. {cartSubtotal}</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>GST (16%)</Text>
                    <Text style={styles.billVal}>Rs. {tax}</Text>
                  </View>
                  <View style={[styles.billRow, styles.billRowTotal]}>
                    <Text style={styles.billLabelTotal}>Total Payable (Cash)</Text>
                    <Text style={styles.billValTotal}>Rs. {grandTotal}</Text>
                  </View>
                </View>

                {/* 3. Special Cooking Instructions */}
                <View style={styles.notesCard}>
                  <Text style={styles.fieldLabel}>Special Cooking Instructions / Notes (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="e.g. less spice, extra napkins, contact-free handover"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                {/* 4. Customer Name (Required, like in web) */}
                <View style={styles.notesCard}>
                  <Text style={styles.fieldLabel}>
                    Customer Name <Text style={{ color: Colors.primary }}>*</Text>
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      borderWidth: 1,
                      borderColor: Colors.borderColor,
                      borderRadius: 8,
                      backgroundColor: Colors.bgMain,
                      paddingHorizontal: 12,
                      height: 42,
                    }}
                  >
                    <User size={15} color={Colors.primary} />
                    <TextInput
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: '700',
                        color: Colors.textMain,
                        paddingVertical: 0,
                      }}
                      value={customerName}
                      onChangeText={setCustomerName}
                      placeholder="e.g. Shahwaiz Akram"
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>

                {/* 5. Receiver Mobile Number (Required, like in web) */}
                <View style={styles.notesCard}>
                  <Text style={styles.fieldLabel}>
                    Receiver Mobile Number <Text style={{ color: Colors.primary }}>*</Text>
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: Colors.borderColor,
                      borderRadius: 8,
                      backgroundColor: Colors.bgMain,
                      overflow: 'hidden',
                      height: 42,
                    }}
                  >
                    <Text
                      style={{
                        paddingHorizontal: 10,
                        fontSize: 12,
                        fontWeight: '800',
                        color: Colors.textMuted,
                        borderRightWidth: 1,
                        borderRightColor: Colors.borderColor,
                        backgroundColor: Colors.bgSubtle,
                        paddingVertical: 10,
                      }}
                    >
                      🇵🇰 +92
                    </Text>
                    <TextInput
                      style={{
                        flex: 1,
                        paddingHorizontal: 10,
                        fontSize: 13,
                        fontWeight: '700',
                        color: Colors.textMain,
                        paddingVertical: 0,
                      }}
                      value={customerPhone}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^\d\s]/g, '').replace(/^(\+92|0)/, '');
                        setCustomerPhone(cleaned);
                      }}
                      placeholder="300 1234567"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </ScrollView>
            </View>
          )}

          {/* Footer Actions */}
          {cart.length > 0 && (
            <View style={styles.footer}>
              {step === 'review' && (
                <View style={{ gap: 8 }}>
                  {isBelowMinDelivery && (
                    <View style={styles.minDeliveryNoticeBox}>
                      <Text style={styles.minDeliveryNoticeText}>
                        🛵 Min delivery order is <Text style={{ fontWeight: '800' }}>Rs. {minDeliveryAmount}</Text>. Select{' '}
                        <Text style={{ fontWeight: '900', color: '#DC2626' }}>Rs. {deliveryShortfall}</Text> more to checkout.
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      (!currentBranch.isOpen || cart.length === 0 || isBelowMinDelivery) && styles.primaryBtnDisabled,
                    ]}
                    onPress={handleProceedFromReview}
                    disabled={!currentBranch.isOpen || cart.length === 0}
                    activeOpacity={0.88}
                  >
                    <Text style={[styles.primaryBtnText, isBelowMinDelivery && { color: '#6B7280' }]}>
                      {isBelowMinDelivery ? `Add Rs. ${deliveryShortfall} More for Delivery` : getProceedBtnText()}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {step === 'payment' && (
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    !currentBranch.isOpen && styles.primaryBtnDisabled,
                  ]}
                  onPress={() => setConfirmModalVisible(true)}
                  disabled={!currentBranch.isOpen}
                  activeOpacity={0.88}
                >
                  <Text style={styles.primaryBtnText}>
                    {!currentBranch.isOpen
                      ? 'Branch is Currently Closed / Offline'
                      : `Pay Cash (Rs. ${grandTotal})`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Customer Login Modal */}
          <CustomerLoginModal
            visible={loginModalVisible}
            onClose={() => setLoginModalVisible(false)}
            onSuccess={() => {
              if (currentUser?.name && currentUser.name !== 'Guest Customer' && !customerName) {
                setCustomerName(currentUser.name);
              }
              if (currentUser?.phone && !customerPhone) {
                setCustomerPhone(currentUser.phone.replace(/^(\+92|0)/, ''));
              }
              showToast('Signed in successfully! Please enter your name & mobile number below.', 'success');
            }}
          />

          {/* 60-70% Branch Selection Sheet */}
          <BranchSelectionSheet
            visible={branchSheetVisible}
            onClose={() => setBranchSheetVisible(false)}
            orderMode={sheetMode}
            onBranchSelected={handleBranchSelected}
          />

          {/* Delivery Map Modal */}
          <DeliveryMapModal
            visible={deliveryMapVisible}
            onClose={() => setDeliveryMapVisible(false)}
            onConfirmDelivery={handleDeliveryConfirmed}
          />

          {/* Dine-In Free Seating Sheet: Half screen from bottom to middle of screen */}
          <DineInSeatingSheet
            visible={seatingSheetVisible}
            onClose={() => setSeatingSheetVisible(false)}
            onConfirmTable={(tbl) => {
              setSelectedTableNumber(tbl);
              setSeatingSheetVisible(false);
              setStep('payment');
            }}
            initialTable={selectedTableNumber}
          />

          {/* Order Confirmation Pop-up Modal with Order Price */}
          <Modal
            visible={confirmModalVisible}
            transparent
            animationType="fade"
            statusBarTranslucent={true}
            onRequestClose={() => setConfirmModalVisible(false)}
          >
            <View
              style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.65)',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
              }}
            >
              <View
                style={{
                  width: '100%',
                  maxWidth: 380,
                  backgroundColor: Colors.bgCard,
                  borderRadius: 20,
                  padding: 22,
                  borderWidth: 1.5,
                  borderColor: Colors.borderColor,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.25,
                  shadowRadius: 20,
                  elevation: 10,
                }}
              >
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <View>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: Colors.textMain }}>
                      Confirm Your Order
                    </Text>
                    <Text style={{ fontSize: 11.5, color: Colors.textMuted, marginTop: 2 }}>
                      Verify details & price before placement
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setConfirmModalVisible(false)}
                    style={{ padding: 6, borderRadius: 16, backgroundColor: Colors.bgMain }}
                  >
                    <X size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Price Highlight */}
                <View
                  style={{
                    backgroundColor: 'rgba(217, 101, 40, 0.08)',
                    borderWidth: 1.5,
                    borderColor: 'rgba(217, 101, 40, 0.25)',
                    borderRadius: 14,
                    padding: 14,
                    alignItems: 'center',
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 }}>
                    TOTAL ORDER PRICE
                  </Text>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: Colors.primary, marginVertical: 3 }}>
                    Rs. {grandTotal}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Banknote size={14} color={Colors.primary} />
                    <Text style={{ fontSize: 11.5, fontWeight: '800', color: Colors.primary }}>
                      Pay Cash on Fulfillment
                    </Text>
                  </View>
                </View>

                {/* Details Summary */}
                <View
                  style={{
                    backgroundColor: Colors.bgSubtle,
                    borderRadius: 12,
                    padding: 12,
                    gap: 8,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>Fulfillment:</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: Colors.textMain }}>
                      {orderType === 'dine_in' ? '🍽️ Dine-In' : orderType === 'takeaway' ? '🛍️ Takeaway' : '🛵 Delivery'}
                    </Text>
                  </View>

                  {orderType === 'delivery' && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>Deliver To:</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: Colors.textMain, flex: 1, textAlign: 'right' }} numberOfLines={2}>
                        {selectedDeliveryAddress || 'Main Boulevard, Gulberg III, Lahore'}
                      </Text>
                    </View>
                  )}

                  {orderType === 'dine_in' && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, color: Colors.textMuted }}>Table:</Text>
                      <Text style={{ fontSize: 12.5, fontWeight: '800', color: Colors.textMain }}>
                        Table #{selectedTableNumber}
                      </Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>Customer:</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: Colors.textMain }}>
                      {customerName.trim() || currentUser.name || 'Customer'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>Contact No:</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: Colors.textMain }}>
                      {customerPhone.trim() ? `+92 ${customerPhone.replace(/^(\+92|0)/, '')}` : '-'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>Items Count:</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: Colors.textMain }}>
                      {cartCount} items
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: Colors.textMuted }}>Payment:</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: Colors.textMain }}>
                      Cash Payment
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: Colors.borderColor,
                      alignItems: 'center',
                    }}
                    onPress={() => setConfirmModalVisible(false)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textMuted }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 2,
                      paddingVertical: 12,
                      borderRadius: 12,
                      backgroundColor: Colors.primary,
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      setConfirmModalVisible(false);
                      handleConfirmOrder();
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>
                      Confirm Order (Rs. {grandTotal})
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheetContainer: {
    height: height * 0.75, // Covers ~75% from bottom to middle/upper screen
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    marginBottom: 6,
  },
  handleBar: {
    width: 44,
    height: 4,
    borderRadius: 3,
    backgroundColor: Colors.borderColor,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderColor,
  },
  backBtn: {
    padding: 6,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.bgMain,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textMain,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  reviewMainContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  flexOneColumn: {
    flex: 1,
  },
  emptyCartWrap: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 40,
  },
  emptyCartTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textMain,
  },
  emptyCartSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  preSelectedContainer: {
    marginBottom: 8,
  },
  preSelectedBadgeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  preSelectedBadgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  preSelectedBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  changeModeLink: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  changeModeLinkText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '800',
  },
  inlineSwitcherRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  preSelectCard: {
    flex: 1,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    backgroundColor: Colors.bgSubtle,
    gap: 5,
  },
  preSelectCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  preSelectText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
  },
  preSelectTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  scrollableItemsWrapper: {
    flex: 1,
    marginBottom: 8,
  },
  itemsScrollContent: {
    paddingBottom: 4,
  },
  itemsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  itemsCardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.bgSubtle,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  itemMeta: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  stepperBtn: {
    padding: 3,
  },
  stepperQty: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    minWidth: 14,
    textAlign: 'center',
  },
  staticBillCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  billTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 4,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  billRowTotal: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
  },
  billLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  billVal: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMain,
  },
  billLabelTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
  billValTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.primary,
  },
  paymentMainContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  paymentScrollableList: {
    flex: 1,
  },
  paymentScrollableContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  paymentStaticBottom: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
    flexShrink: 0,
  },
  sectionHeader: {
    fontSize: 13.5,
    fontWeight: '800',
    color: Colors.textMain,
    marginBottom: 8,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 10,
    marginBottom: 7,
    borderWidth: 1.2,
    borderColor: Colors.borderColor,
    gap: 10,
  },
  paymentCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  paymentIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMain,
  },
  paymentLabelActive: {
    color: Colors.primary,
    fontWeight: '800',
  },
  paymentSub: {
    fontSize: 9.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  paymentCheck: {
    padding: 2,
  },
  notesCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    padding: 7,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderColor,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 3,
  },
  textInput: {
    backgroundColor: Colors.bgSubtle,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    fontSize: 11,
    color: Colors.textMain,
    height: 36,
  },
  finalTotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: Colors.primaryBorder,
  },
  finalTotalLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.textMain,
  },
  finalTotalAmount: {
    fontSize: 15.5,
    fontWeight: '900',
    color: Colors.primary,
  },
  footer: {
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.borderColor,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.7,
  },
  minDeliveryNoticeBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  minDeliveryNoticeText: {
    fontSize: 11.5,
    color: '#991B1B',
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryBtnText: {
    color: Colors.textWhite,
    fontSize: 13,
    fontWeight: '800',
  },
  closedWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  closedWarningTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  closedWarningSub: {
    fontSize: 10.5,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 14,
  },
  changeBranchMiniBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  changeBranchMiniText: {
    color: Colors.textWhite,
    fontSize: 10.5,
    fontWeight: '800',
  },
  branchPricingBox: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderColor,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  branchPricingHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  branchPricingBranchTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  branchPricingUpdatedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  branchPricingUpdatedBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#16A34A',
  },
  branchPricingItemsList: {
    gap: 4,
  },
  branchPricingItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branchPricingItemName: {
    fontSize: 11,
    color: Colors.textMain,
    flex: 1,
    marginRight: 8,
  },
  branchPricingItemPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  branchPricingDivider: {
    height: 1,
    backgroundColor: Colors.borderColor,
    marginVertical: 6,
  },
  branchPricingTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  branchPricingTotalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  branchPricingTotalVal: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMain,
  },
});
