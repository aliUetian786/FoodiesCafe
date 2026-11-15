'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { OrderType, Branch, Table, normalizeBranchId } from '@/types/cafe';
import { CustomerLoginModal } from './CustomerLoginModal';
import {
  Trash2,
  Plus,
  Minus,
  Utensils,
  ShoppingBag,
  Bike,
  CheckCircle2,
  Banknote,
  AlertTriangle,
  ArrowLeft,
  X,
  Users,
  MapPin,
  Sparkles,
  LocateFixed,
  Map as MapIcon,
  User,
} from 'lucide-react';
import { OpenStreetMapView } from '@/components/common/OpenStreetMapView';
import { DeliveryMapModal } from '@/components/common/DeliveryMapModal';

interface CustomerCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  initialStep?: 'order_review' | 'auth' | 'fulfillment' | 'details' | 'dine_in_seating' | 'branch_map' | 'payment';
}

export const CustomerCheckout: React.FC<CustomerCheckoutProps> = ({
  isOpen,
  onClose,
  onNavigate,
  initialStep = 'order_review',
}) => {
  const {
    cart,
    updateCartItemQty,
    removeFromCart,
    placeOrder,
    currentBranch,
    branches,
    menuItems,
    tables,
    currentUser,
    setCurrentUser,
    addToast,
    orderType: globalOrderType,
    setOrderType: setGlobalOrderType,
    hasConfirmedOrderType,
    setHasConfirmedOrderType,
    customerCoordinates,
    setCustomerCoordinates,
    selectedDeliveryAddress,
    setSelectedDeliveryAddress,
    savedAddresses,
    addSavedAddress,
    detectAndStoreCurrentLocation,
    calculateDistanceKm,
  } = useApp();

  const isCustomerLoggedIn = Boolean(
    currentUser &&
    currentUser.name &&
    currentUser.name !== 'Guest Customer' &&
    currentUser.role === 'customer'
  );

  // Multi-step checkout: 'review' -> 'payment' (strictly mobile app flow)
  const [step, setStep] = useState<'review' | 'payment'>('review');

  // Customer Login Modal State
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Order Type Modal State (if not confirmed)
  const [orderTypeModalOpen, setOrderTypeModalOpen] = useState(false);
  const [deliveryMapModalOpen, setDeliveryMapModalOpen] = useState(false);

  // Dine-In Seating Sheet (half screen sheet)
  const [seatingSheetOpen, setSeatingSheetOpen] = useState(false);
  const [selectedTableNumber, setSelectedTableNumber] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const val = p.get('tableQr') || p.get('table');
      if (val) return val.toUpperCase().startsWith('T-') ? val.toUpperCase() : `T-${val.padStart(2, '0')}`;
    }
    return 'T-01';
  });

  // Track fulfillment mode locally (defaults to dine_in if tableQr query param is present)
  const [orderType, setLocalOrderType] = useState<OrderType>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('tableQr') || p.get('table')) return 'dine_in';
    }
    return globalOrderType || 'delivery';
  });
  const [showModeSwitcher, setShowModeSwitcher] = useState<boolean>(false);
  const [showCheckoutOsmPicker, setShowCheckoutOsmPicker] = useState<boolean>(false);
  const [saveCheckoutPin, setSaveCheckoutPin] = useState<boolean>(false);

  // Form Details
  const [notes, setNotes] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const userKey = currentUser?.id && currentUser.id !== 'user-guest' ? currentUser.id : 'guest';
      const saved = localStorage.getItem(`foodies_saved_name_${userKey}`) || localStorage.getItem('foodies_saved_customer_name');
      if (saved) return saved;
    }
    return currentUser?.name && currentUser.name !== 'Guest Customer' ? currentUser.name : '';
  });
  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const userKey = currentUser?.id && currentUser.id !== 'user-guest' ? currentUser.id : 'guest';
      const saved = localStorage.getItem(`foodies_saved_phone_${userKey}`) || localStorage.getItem('foodies_saved_customer_phone');
      if (saved) return saved;
    }
    return currentUser?.phone || '';
  });
  const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userKey = currentUser?.id && currentUser.id !== 'user-guest' ? currentUser.id : 'guest';
      const savedName = localStorage.getItem(`foodies_saved_name_${userKey}`) || localStorage.getItem('foodies_saved_customer_name');
      const savedPhone = localStorage.getItem(`foodies_saved_phone_${userKey}`) || localStorage.getItem('foodies_saved_customer_phone');
      if (savedName && !customerName) setCustomerName(savedName);
      if (savedPhone && !customerPhone) setCustomerPhone(savedPhone);
    }
    if (currentUser?.name && currentUser.name !== 'Guest Customer' && !customerName) {
      setCustomerName(currentUser.name);
    }
    if (currentUser?.phone && !customerPhone) {
      setCustomerPhone(currentUser.phone);
    }
  }, [currentUser]);

  // Derived calculations
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + (item.quantity || 1), 0), [cart]);
  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + (Number(item.unitPrice) || 0) * (item.quantity || 1), 0),
    [cart]
  );
  const tax = Math.round(cartSubtotal * 0.16 * 10) / 10;
  const grandTotal = cartSubtotal + tax;

  const isDelivery = orderType === 'delivery';
  const minDeliveryAmount = (currentBranch as any)?.minDeliveryAmount ?? (currentBranch as any)?.minDeliveryOrderValue ?? 500;
  const isBelowMinDelivery = isDelivery && cartCount > 0 && cartSubtotal < minDeliveryAmount;
  const deliveryShortfall = Math.max(0, minDeliveryAmount - cartSubtotal);

  // Sync global order type
  useEffect(() => {
    if (globalOrderType) {
      setLocalOrderType(globalOrderType);
    }
  }, [globalOrderType, isOpen]);

  // Reset step to review when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(initialStep === 'payment' ? 'payment' : 'review');
      setShowModeSwitcher(false);
      setSeatingSheetOpen(false);
      setConfirmModalOpen(false);
    }
  }, [isOpen, initialStep]);

  // Desktop screen guard: If opened on laptop/desktop (> 860px), delegate immediately to desktop 2-column menu checkout
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.innerWidth > 860) {
      onClose();
      onNavigate('menu');
    }
  }, [isOpen, onClose, onNavigate]);

  // Table & Floor calculations for Dine-In Table Selection Page
  const normBranchId = normalizeBranchId(currentBranch.id);
  const branchTables = useMemo(() => {
    return (tables || []).filter(
      (t) => !t.branchId || t.branchId === currentBranch.id || normalizeBranchId(t.branchId) === normBranchId
    );
  }, [tables, currentBranch.id, normBranchId]);

  const floors = useMemo(() => {
    const set = new Set<string>();
    branchTables.forEach((t) => {
      if (t.floor) set.add(t.floor.trim());
    });
    const list = Array.from(set);
    return list.length > 0 ? list : ['Ground Floor', '1st Floor', 'Rooftop Terrace'];
  }, [branchTables]);

  const [activeFloor, setActiveFloor] = useState<string>(floors[0] || 'Ground Floor');

  // Available free tables for active floor
  const floorAvailableTables = useMemo(() => {
    return branchTables.filter(
      (t) => (t.floor || 'Ground Floor').trim() === activeFloor.trim() && t.status === 'available'
    );
  }, [branchTables, activeFloor]);

  const totalAvailableTables = useMemo(
    () => branchTables.filter((t) => t.status === 'available').length,
    [branchTables]
  );

  // Auto-select first available table on floor if current isn't in floor list
  useEffect(() => {
    if (floorAvailableTables.length > 0 && !floorAvailableTables.some((t) => t.number === selectedTableNumber)) {
      setSelectedTableNumber(floorAvailableTables[0].number);
    }
  }, [floorAvailableTables, selectedTableNumber]);

  if (!isOpen) return null;

  const handleDeliveryConfirmed = (addr: string, branch: Branch) => {
    setSelectedDeliveryAddress(addr);
    setLocalOrderType('delivery');
    setGlobalOrderType('delivery');
    setHasConfirmedOrderType(true);
    setDeliveryMapModalOpen(false);
    addToast({
      type: 'success',
      title: 'Delivery Address Confirmed',
      message: `Set to ${addr}`,
    });
  };

  const handleModeChange = (newMode: OrderType) => {
    if (!isCustomerLoggedIn) {
      setLoginModalOpen(true);
      return;
    }
    if (newMode === 'delivery') {
      setShowModeSwitcher(false);
      setDeliveryMapModalOpen(true);
      return;
    }
    setLocalOrderType(newMode);
    setGlobalOrderType(newMode);
    setHasConfirmedOrderType(true);
    setShowModeSwitcher(false);
    addToast({
      type: 'info',
      title: 'Order Mode Changed',
      message: `Switched to ${newMode === 'dine_in' ? 'Dine-In' : newMode === 'takeaway' ? 'Takeaway' : 'Delivery'}.`,
    });
  };

  const handleProceedFromReview = () => {
    // 0. If current branch is closed / offline, block checkout
    if (!currentBranch.isOpen) {
      addToast({
        type: 'error',
        title: 'Branch Closed / Offline',
        message: `⛔ ${currentBranch.name} is currently Closed / Offline. You cannot proceed with this branch.`,
      });
      return;
    }

    // 0b. Minimum delivery amount check
    if (orderType === 'delivery' && cartSubtotal < minDeliveryAmount) {
      addToast({
        type: 'warning',
        title: 'Minimum Delivery Order',
        message: `Min delivery order is Rs. ${minDeliveryAmount}. Please select Rs. ${deliveryShortfall} more items to proceed.`,
      });
      return;
    }

    // 1. If not logged in, prompt sign in first
    if (!isCustomerLoggedIn) {
      setLoginModalOpen(true);
      return;
    }

    // 2. If order type was not confirmed earlier, ask about order type
    if (!hasConfirmedOrderType) {
      setOrderTypeModalOpen(true);
      return;
    }

    // 3. If Dine-In: seating moves to page after checkout review as a half screen bottom sheet
    if (orderType === 'dine_in') {
      setSeatingSheetOpen(true);
      return;
    }

    // 4. Otherwise proceed straight to payment
    setStep('payment');
  };

  const handleConfirmTableSelection = () => {
    if (!isCustomerLoggedIn) {
      setLoginModalOpen(true);
      return;
    }
    if (!selectedTableNumber) {
      addToast({
        type: 'warning',
        title: 'Select a Table',
        message: 'Please choose a table to proceed.',
      });
      return;
    }
    setSeatingSheetOpen(false);
    setStep('payment');
    addToast({
      type: 'success',
      title: 'Table Reserved ✓',
      message: `Table ${selectedTableNumber} confirmed for Dine-In.`,
    });
  };

  const handleConfirmOrderFinal = () => {
    // 0. Block if not logged in
    if (!isCustomerLoggedIn) {
      setConfirmModalOpen(false);
      setLoginModalOpen(true);
      addToast({
        type: 'warning',
        title: 'Sign In Required ✉️',
        message: 'Please sign in to your customer account to place your order.',
      });
      return;
    }

    if (!customerName.trim()) {
      addToast({
        type: 'warning',
        title: 'Customer Name Required',
        message: 'Please enter your name for this order.',
      });
      return;
    }

    const cleanDigits = customerPhone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 9) {
      addToast({
        type: 'warning',
        title: 'Receiver Mobile Number Required 📱',
        message: 'Please provide a valid receiver mobile number for order delivery & rider updates.',
      });
      return;
    }

    // Block if branch closed
    if (!currentBranch.isOpen) {
      addToast({
        type: 'error',
        title: 'Branch Closed',
        message: `⛔ ${currentBranch.name} is currently Closed. Orders cannot be placed at this time.`,
      });
      return;
    }

    const clean10 = cleanDigits.slice(-10);
    const effectiveCustId =
      currentUser?.id && currentUser.id !== 'user-guest' && currentUser.id !== 'cust-guest'
        ? currentUser.id
        : clean10
        ? `cust-${clean10}`
        : `cust-web-${Date.now()}`;

    const effectivePaymentMethod =
      orderType === 'delivery'
        ? 'Cash on Delivery (COD)'
        : orderType === 'dine_in'
        ? 'Cash at Table'
        : 'Cash at Counter';

    const placed = placeOrder(
      orderType,
      orderType === 'dine_in' ? selectedTableNumber : undefined,
      undefined,
      orderType === 'takeaway' ? '15-25 mins' : undefined,
      orderType === 'delivery' ? (selectedDeliveryAddress || 'Main Boulevard, Gulberg III, Lahore') : undefined,
      effectivePaymentMethod,
      undefined,
      {
        customerId: effectiveCustId,
        customerName: customerName.trim() || 'Customer',
        customerPhone: customerPhone,
        customerEmail: currentUser?.email || undefined,
        notes: notes.trim() || undefined,
        paymentStatus: 'unpaid',
        paymentCollected: false,
        isTableQr: Boolean(orderType === 'dine_in' && selectedTableNumber),
        isWalkIn: false,
        customerCoordinates:
          orderType === 'delivery'
            ? customerCoordinates || { lat: 31.5204, lng: 74.3587 }
            : undefined,
      }
    );

    if (typeof window !== 'undefined') {
      const userKey = currentUser?.id && currentUser.id !== 'user-guest' ? currentUser.id : 'guest';
      if (customerName.trim()) {
        localStorage.setItem(`foodies_saved_name_${userKey}`, customerName.trim());
        localStorage.setItem('foodies_saved_customer_name', customerName.trim());
      }
      if (customerPhone.trim()) {
        localStorage.setItem(`foodies_saved_phone_${userKey}`, customerPhone.trim());
        localStorage.setItem('foodies_saved_customer_phone', customerPhone.trim());
      }
    }
    if (setCurrentUser && currentUser && (customerName.trim() || customerPhone.trim())) {
      setCurrentUser({
        ...currentUser,
        name: customerName.trim() || currentUser.name,
        phone: customerPhone.trim() || currentUser.phone,
      });
    }

    if (typeof window !== 'undefined' && placed) {
      try {
        const myIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
        if (!myIds.includes(placed.id)) myIds.unshift(placed.id);
        if (placed.orderNumber && !myIds.includes(placed.orderNumber)) myIds.unshift(placed.orderNumber);
        localStorage.setItem('foodies_customer_order_ids', JSON.stringify(myIds));

        const cache = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
        const updatedCache = [placed, ...cache.filter((o: any) => o.id !== placed.id && o.orderNumber !== placed.orderNumber)];
        localStorage.setItem('foodies_customer_history_cache', JSON.stringify(updatedCache));
      } catch (e) {}
    }

    setConfirmModalOpen(false);
    onClose();
    onNavigate('order-tracking');
    addToast({
      type: 'success',
      title: 'Order Placed Successfully! 🎉',
      message: `Your ${orderType.replace('_', ' ')} order of Rs. ${grandTotal.toLocaleString()} has been received.`,
    });
  };

  return (
    <>
      {/* Dark backdrop overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.62)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          backdropFilter: 'blur(3px)',
          animation: 'fadeInCheckout 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Mobile App imported Bottom Sheet Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: '520px',
            maxHeight: '86vh',
            backgroundColor: 'var(--bg-card, #FFFFFF)',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.22)',
            border: '1.5px solid var(--border-color, #E2E8F0)',
            animation: 'slideUpCheckout 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
            boxSizing: 'border-box',
          }}
        >
          {/* Drag Handle Bar (Exact Mobile UX) */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px', paddingBottom: '6px', flexShrink: 0 }}>
            <div style={{ width: '44px', height: '4px', borderRadius: '3px', backgroundColor: '#CBD5E1' }} />
          </div>

          {/* Header Bar */}
          <div
            style={{
              padding: '8px 18px 12px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (step === 'payment') setStep('review');
                else onClose();
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title={step === 'payment' ? 'Back to Review' : 'Close'}
            >
              {step === 'payment' ? <ArrowLeft size={18} /> : <X size={18} />}
            </button>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
                {step === 'review' ? 'Your Cart & Review' : 'Choose Payment Method'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                {step === 'review'
                  ? `${cartCount} ${cartCount === 1 ? 'item' : 'items'} selected`
                  : orderType === 'dine_in'
                  ? `Table ${selectedTableNumber} • Final Step`
                  : 'Final Step'}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Closed / Offline Warning Banner */}
          {!currentBranch.isOpen && (
            <div
              style={{
                margin: '12px 16px 0',
                padding: '10px 14px',
                borderRadius: '12px',
                backgroundColor: '#FEE2E2',
                border: '1px solid #FECACA',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={18} color="#DC2626" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#B91C1C' }}>
                  {currentBranch.name} is Closed / Offline
                </div>
                <div style={{ fontSize: '11.5px', color: '#7F1D1D' }}>
                  Orders cannot be placed at this branch right now.
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 1: REVIEW ================= */}
          {step === 'review' && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {cart.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', margin: 'auto 0' }}>
                  <ShoppingBag size={48} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>Your Cart is Empty</div>
                  <p style={{ fontSize: '13px', margin: '6px 0 0' }}>Add signature karahi, biryani, or burgers to order</p>
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {/* Fulfillment Mode Banner with "Select another mode" */}
                  <div style={{ padding: '12px 18px 6px', flexShrink: 0 }}>
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(217, 101, 40, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--primary)',
                            flexShrink: 0,
                          }}
                        >
                          {orderType === 'delivery' && <Bike size={15} />}
                          {orderType === 'takeaway' && <ShoppingBag size={15} />}
                          {orderType === 'dine_in' && <Utensils size={15} />}
                        </div>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 750,
                            color: 'var(--text-main)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {orderType === 'delivery'
                            ? `Delivery: ${selectedDeliveryAddress}`
                            : orderType === 'takeaway'
                            ? `Takeaway: ${currentBranch.name}`
                            : `Dine-In: ${currentBranch.name}`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowModeSwitcher((prev) => !prev)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '11.5px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          padding: '4px',
                        }}
                      >
                        Select another mode
                      </button>
                    </div>

                    {/* Inline Mode Switcher Cards */}
                    {showModeSwitcher && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '8px',
                          marginTop: '8px',
                          animation: 'fadeInCheckout 0.18s ease',
                        }}
                      >
                        {[
                          { id: 'dine_in', label: 'Dine-In', icon: Utensils },
                          { id: 'takeaway', label: 'Takeaway', icon: ShoppingBag },
                          { id: 'delivery', label: 'Delivery', icon: Bike },
                        ].map((m) => {
                          const IconComp = m.icon;
                          const isAct = orderType === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleModeChange(m.id as OrderType)}
                              style={{
                                padding: '8px 6px',
                                borderRadius: '10px',
                                border: isAct ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                                backgroundColor: isAct ? 'rgba(217, 101, 40, 0.08)' : 'var(--bg-card-subtle)',
                                color: isAct ? 'var(--primary)' : 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              <IconComp size={13} />
                              <span>{m.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SCROLLABLE ORDER ITEMS LIST */}
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      padding: '6px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '14px',
                        border: '1px solid var(--border-color)',
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Order Items ({cartCount})
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {cart.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingBottom: '8px',
                              borderBottom: '1px solid var(--border-color)',
                              gap: '10px',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                                {item.name}
                              </div>
                              {item.size && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Portion: {item.size}</div>
                              )}
                              {item.extras && item.extras.length > 0 && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Extras: {item.extras.join(', ')}
                                </div>
                              )}
                              <div style={{ fontSize: '12.5px', fontWeight: 850, color: 'var(--primary)', marginTop: '2px' }}>
                                Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                              </div>
                            </div>

                            {/* Quantity Steppers (Matching Mobile App) */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                backgroundColor: 'var(--bg-card-subtle)',
                                padding: '4px 8px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.quantity === 1) removeFromCart(item.id);
                                  else updateCartItemQty(item.id, -1);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: item.quantity === 1 ? '#DC2626' : 'var(--primary)',
                                  padding: '2px',
                                }}
                                aria-label="Decrease quantity"
                              >
                                {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                              </button>
                              <span style={{ fontSize: '13px', fontWeight: 850, minWidth: '18px', textAlign: 'center' }}>
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateCartItemQty(item.id, 1)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'var(--primary)',
                                  padding: '2px',
                                }}
                                aria-label="Increase quantity"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* STATIC BILL BREAKDOWN (Pinned above footer) */}
                  <div
                    style={{
                      margin: '6px 18px 10px',
                      backgroundColor: 'var(--bg-card-subtle)',
                      borderRadius: '14px',
                      border: '1px solid var(--border-color)',
                      padding: '12px 16px',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Bill Breakdown
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span>Subtotal</span>
                      <span>Rs. {cartSubtotal.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      <span>GST (16%)</span>
                      <span>Rs. {tax.toLocaleString()}</span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '15px',
                        fontWeight: 900,
                        color: 'var(--text-main)',
                        paddingTop: '6px',
                        borderTop: '1px dashed var(--border-color)',
                      }}
                    >
                      <span>Payable Total</span>
                      <span style={{ color: 'var(--primary)' }}>Rs. {grandTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Review Step Footer */}
              {cart.length > 0 && (
                <div style={{ padding: '10px 18px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', flexShrink: 0 }}>
                  {isBelowMinDelivery && (
                    <div
                      style={{
                        backgroundColor: '#FEF3C7',
                        border: '1px solid #FCD34D',
                        borderRadius: '8px',
                        padding: '6px 10px',
                        marginBottom: '8px',
                        fontSize: '11.5px',
                        color: '#92400E',
                        fontWeight: 700,
                      }}
                    >
                      🛵 Min delivery order is Rs. {minDeliveryAmount}. Select Rs. {deliveryShortfall} more to checkout.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleProceedFromReview}
                    disabled={!currentBranch.isOpen || isBelowMinDelivery}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: '12px',
                      backgroundColor: !currentBranch.isOpen || isBelowMinDelivery ? '#E2E8F0' : 'var(--primary)',
                      color: !currentBranch.isOpen || isBelowMinDelivery ? '#94A3B8' : '#FFFFFF',
                      border: 'none',
                      fontWeight: 850,
                      fontSize: '14px',
                      cursor: !currentBranch.isOpen || isBelowMinDelivery ? 'not-allowed' : 'pointer',
                      boxShadow: !currentBranch.isOpen || isBelowMinDelivery ? 'none' : '0 4px 14px var(--primary-glow)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {!currentBranch.isOpen
                      ? 'Branch is Currently Closed / Offline'
                      : isBelowMinDelivery
                      ? `Add Rs. ${deliveryShortfall} More for Delivery`
                      : orderType === 'dine_in'
                      ? 'Select Seating Table ➔'
                      : `Proceed to Payment (Rs. ${grandTotal.toLocaleString()}) ➔`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 2: PAYMENT ================= */}
          {step === 'payment' && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* 1. Fulfillment Summary & OpenStreetMap Delivery Pin Editor */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          backgroundColor: 'var(--primary)',
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {orderType === 'dine_in' ? <Utensils size={18} /> : orderType === 'takeaway' ? <ShoppingBag size={18} /> : <Bike size={18} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 850, color: 'var(--primary)' }}>
                          {orderType === 'dine_in' ? '🍽️ Dine-In' : orderType === 'takeaway' ? '🛍️ Takeaway' : '🛵 Delivery'}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                          {orderType === 'dine_in'
                            ? `Table #${selectedTableNumber} • ${currentBranch.name}`
                            : orderType === 'takeaway'
                            ? currentBranch.name
                            : selectedDeliveryAddress}
                        </div>
                        {orderType === 'delivery' && customerCoordinates && (
                          <div style={{ fontSize: '10.5px', color: '#1D4ED8', fontWeight: 700, marginTop: '2px' }}>
                            OpenStreetMap Pin: {customerCoordinates.lat.toFixed(4)}, {customerCoordinates.lng.toFixed(4)}
                          </div>
                        )}
                      </div>
                    </div>

                    {orderType === 'delivery' && (
                      <button
                        type="button"
                        onClick={() => setDeliveryMapModalOpen(true)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          color: '#EA580C',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <MapIcon size={13} />
                        <span>Confirm Pin on Map</span>
                      </button>
                    )}
                  </div>

                  {orderType === 'delivery' && showCheckoutOsmPicker && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '6px', borderTop: '1px dashed #CBD5E1' }}>
                      {/* Saved Address Quick Chips */}
                      {savedAddresses.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {savedAddresses.map((addr) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => {
                                setSelectedDeliveryAddress(addr.address);
                                if (addr.coordinates) setCustomerCoordinates(addr.coordinates);
                              }}
                              style={{
                                padding: '4px 9px',
                                borderRadius: '999px',
                                border: selectedDeliveryAddress === addr.address ? '1.5px solid #EA580C' : '1px solid #CBD5E1',
                                backgroundColor: selectedDeliveryAddress === addr.address ? '#FFF7ED' : '#FFFFFF',
                                color: selectedDeliveryAddress === addr.address ? '#EA580C' : '#334155',
                                fontSize: '11px',
                                fontWeight: 750,
                                cursor: 'pointer',
                              }}
                            >
                              📌 {addr.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={async () => {
                              await detectAndStoreCurrentLocation();
                            }}
                            style={{
                              padding: '4px 9px',
                              borderRadius: '999px',
                              border: '1px solid #BFDBFE',
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              fontSize: '11px',
                              fontWeight: 750,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <LocateFixed size={11} />
                            <span>Use My GPS</span>
                          </button>
                        </div>
                      )}

                      <OpenStreetMapView
                        center={customerCoordinates || { lat: 31.5204, lng: 74.3587 }}
                        zoom={14}
                        height={195}
                        interactivePin={customerCoordinates || { lat: 31.5204, lng: 74.3587 }}
                        onPinChange={(coords, geo) => {
                          setCustomerCoordinates(coords);
                          if (geo?.address) setSelectedDeliveryAddress(geo.address);
                        }}
                        onGpsLocated={(coords, geo) => {
                          setCustomerCoordinates(coords);
                          if (geo?.address) setSelectedDeliveryAddress(geo.address);
                        }}
                        markers={[
                          {
                            id: 'checkout-branch',
                            lat: Number(currentBranch.latitude) || 31.5126,
                            lng: Number(currentBranch.longitude) || 74.3436,
                            title: currentBranch.name,
                            kind: 'selected_branch',
                          },
                        ]}
                        routeLine={
                          customerCoordinates
                            ? {
                                from: {
                                  lat: Number(currentBranch.latitude) || 31.5126,
                                  lng: Number(currentBranch.longitude) || 74.3436,
                                },
                                to: customerCoordinates,
                                label: `${calculateDistanceKm(
                                  Number(currentBranch.latitude) || 31.5126,
                                  Number(currentBranch.longitude) || 74.3436,
                                  customerCoordinates.lat,
                                  customerCoordinates.lng
                                )} km`,
                              }
                            : null
                        }
                        showSearch={true}
                        showGpsButton={true}
                        modeLabel="OpenStreetMap • Checkout Delivery Pin"
                      />

                      <input
                        type="text"
                        value={selectedDeliveryAddress}
                        onChange={(e) => setSelectedDeliveryAddress(e.target.value)}
                        placeholder="Delivery street address..."
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          backgroundColor: '#FFFFFF',
                          fontSize: '12px',
                          fontWeight: 600,
                          boxSizing: 'border-box',
                        }}
                      />

                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={saveCheckoutPin}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSaveCheckoutPin(checked);
                            if (checked && selectedDeliveryAddress.trim()) {
                              addSavedAddress({
                                label: 'Other',
                                address: selectedDeliveryAddress.trim(),
                                city: 'Lahore',
                                coordinates: customerCoordinates || { lat: 31.5204, lng: 74.3587 },
                              });
                              addToast({
                                type: 'success',
                                title: 'Location Stored',
                                message: 'Delivery address & OpenStreetMap coordinates saved for future orders.',
                              });
                            }
                          }}
                        />
                        <span>Save this address & current coordinates to Saved Locations</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 2. Total Bill Breakdown Box */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    padding: '12px 16px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Bill Summary
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>Items Subtotal</span>
                    <span>Rs. {cartSubtotal.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <span>GST (16%)</span>
                    <span>Rs. {tax.toLocaleString()}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '15px',
                      fontWeight: 900,
                      color: 'var(--text-main)',
                      paddingTop: '6px',
                      borderTop: '1px dashed var(--border-color)',
                    }}
                  >
                    <span>Total Payable (Cash)</span>
                    <span style={{ color: 'var(--primary)' }}>Rs. {grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* 3. Special Cooking Instructions */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    padding: '12px 14px',
                  }}
                >
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Special Cooking Instructions / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. less spice, extra napkins, contact-free handover"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-main)',
                      fontSize: '12.5px',
                      color: 'var(--text-main)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* 4. Customer Name (Required) */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    padding: '12px 14px',
                  }}
                >
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Customer Name <span style={{ color: 'var(--primary)' }}>*</span>
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-main)',
                      padding: '0 12px',
                    }}
                  >
                    <User size={15} color="var(--primary)" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Shahwaiz Akram"
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        border: 'none',
                        backgroundColor: 'transparent',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* 5. Receiver Mobile Number (Required) */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    padding: '12px 14px',
                  }}
                >
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                    Receiver Mobile Number <span style={{ color: 'var(--primary)' }}>*</span>
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-main)',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        padding: '10px 12px',
                        fontSize: '12px',
                        fontWeight: 800,
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-card-subtle)',
                        borderRight: '1px solid var(--border-color)',
                      }}
                    >
                      🇵🇰 +92
                    </span>
                    <input
                      type="tel"
                      value={customerPhone.replace(/^(\+92|0)/, '')}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="300 1234567"
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        border: 'none',
                        backgroundColor: 'transparent',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Step Footer */}
              <div style={{ padding: '10px 18px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isCustomerLoggedIn) {
                      setLoginModalOpen(true);
                      addToast({
                        type: 'warning',
                        title: 'Sign In Required ✉️',
                        message: 'Please sign in to your customer account to place your order.',
                      });
                      return;
                    }
                    if (!customerName.trim()) {
                      addToast({
                        type: 'warning',
                        title: 'Customer Name Required',
                        message: 'Please enter your name for this order.',
                      });
                      return;
                    }
                    const cleanDigits = customerPhone.replace(/\D/g, '');
                    if (!cleanDigits || cleanDigits.length < 9) {
                      addToast({
                        type: 'warning',
                        title: 'Receiver Mobile Number Required 📱',
                        message: 'Please provide a valid receiver mobile number.',
                      });
                      return;
                    }
                    setConfirmModalOpen(true);
                  }}
                  disabled={!currentBranch.isOpen}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    backgroundColor: !currentBranch.isOpen ? '#E2E8F0' : 'var(--primary)',
                    color: !currentBranch.isOpen ? '#94A3B8' : '#FFFFFF',
                    border: 'none',
                    fontWeight: 850,
                    fontSize: '14px',
                    cursor: !currentBranch.isOpen ? 'not-allowed' : 'pointer',
                    boxShadow: !currentBranch.isOpen ? 'none' : '0 4px 14px var(--primary-glow)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {!currentBranch.isOpen
                    ? 'Branch is Currently Closed / Offline'
                    : `Pay Cash (Rs. ${grandTotal.toLocaleString()})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================= DINE-IN SEATING SHEET (Mobile App Imported) ================= */}
      {seatingSheetOpen && (
        <div
          onClick={() => setSeatingSheetOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 10005,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            backdropFilter: 'blur(3px)',
            animation: 'fadeInCheckout 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              height: '56vh',
              maxHeight: '520px',
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.25)',
              border: '1.5px solid var(--border-color, #E2E8F0)',
              animation: 'slideUpCheckout 0.26s cubic-bezier(0.16, 1, 0.3, 1)',
              boxSizing: 'border-box',
            }}
          >
            {/* Drag Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '10px', paddingBottom: '6px', flexShrink: 0 }}>
              <div style={{ width: '44px', height: '4px', borderRadius: '3px', backgroundColor: '#CBD5E1' }} />
            </div>

            {/* Header */}
            <div
              style={{
                padding: '8px 18px 12px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Utensils size={16} color="var(--primary)" />
                  <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
                    Select Table & Seating
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {totalAvailableTables} available tables at {currentBranch.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSeatingSheetOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Floor Selection Pills */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                padding: '10px 18px 6px',
                overflowX: 'auto',
                flexShrink: 0,
              }}
            >
              {floors.map((fl) => {
                const isAct = activeFloor.trim() === fl.trim();
                const freeCount = branchTables.filter(
                  (t) => (t.floor || 'Ground Floor').trim() === fl.trim() && t.status === 'available'
                ).length;

                return (
                  <button
                    key={fl}
                    type="button"
                    onClick={() => setActiveFloor(fl)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      border: isAct ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: isAct ? 'var(--primary)' : 'var(--bg-card-subtle)',
                      color: isAct ? '#FFFFFF' : 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: isAct ? 800 : 650,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {fl} ({freeCount} Available)
                  </button>
                );
              })}
            </div>

            {/* Tables Grid with EXPLICIT "Available" status displayed */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '8px 18px',
              }}
            >
              {floorAvailableTables.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No available tables on this floor right now.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px',
                  }}
                >
                  {floorAvailableTables.map((t) => {
                    const isSel = selectedTableNumber === t.number;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTableNumber(t.number)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '14px',
                          border: isSel ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: isSel ? 'rgba(217, 101, 40, 0.08)' : 'var(--bg-card)',
                          boxShadow: isSel ? '0 3px 12px var(--primary-glow)' : 'var(--shadow-sm)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '14px', fontWeight: 850, color: isSel ? 'var(--primary)' : 'var(--text-main)' }}>
                            Table {t.number}
                          </span>
                          {isSel && <CheckCircle2 size={16} color="var(--primary)" />}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          <Users size={12} color={isSel ? 'var(--primary)' : 'var(--text-muted)'} />
                          <span>{t.capacity || t.chairs || 4} Seats</span>
                        </div>

                        {/* EXPLICIT Available Badge on Table Selection Page */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: '#16A34A',
                              display: 'inline-block',
                            }}
                          />
                          <span style={{ fontSize: '11px', fontWeight: 750, color: '#16A34A' }}>
                            Available
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Seating Sheet Footer */}
            <div style={{ padding: '10px 18px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleConfirmTableSelection}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 850,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px var(--primary-glow)',
                  transition: 'all 0.15s ease',
                }}
              >
                Confirm Table {selectedTableNumber} & Proceed to Payment ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ORDER PRICE CONFIRMATION MODAL ================= */}
      {confirmModalOpen && (
        <div
          onClick={() => setConfirmModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 10010,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(4px)',
            animation: 'fadeInCheckout 0.18s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '20px',
              padding: '22px',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.28)',
              boxSizing: 'border-box',
              animation: 'popInCheckout 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Banknote size={18} color="var(--primary)" />
                <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
                  Order Confirmation
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Highlighted Price Card */}
            <div
              style={{
                backgroundColor: 'rgba(217, 101, 40, 0.08)',
                border: '1.5px solid var(--primary)',
                borderRadius: '14px',
                padding: '14px',
                textAlign: 'center',
                marginBottom: '14px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Total Order Price
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--primary)', marginTop: '2px', fontFamily: 'Outfit, sans-serif' }}>
                Rs. {grandTotal.toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#15803D',
                  backgroundColor: '#DCFCE7',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  display: 'inline-block',
                  marginTop: '4px',
                }}
              >
                CASH PAYMENT ON FULFILLMENT
              </div>
            </div>

            {/* Summary List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Customer Name:</span>
                <strong style={{ color: 'var(--text-main)' }}>{customerName.trim() || 'Customer'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Receiver Mobile:</span>
                <strong style={{ color: 'var(--text-main)' }}>🇵🇰 +92 {customerPhone.replace(/^(\+92|0)/, '')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Order Mode:</span>
                <strong style={{ color: 'var(--text-main)' }}>
                  {orderType === 'dine_in' ? '🍽️ Dine-In' : orderType === 'takeaway' ? '🛍️ Takeaway' : '🛵 Delivery'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>{orderType === 'dine_in' ? 'Table:' : orderType === 'takeaway' ? 'Branch:' : 'Destination:'}</span>
                <strong style={{ color: 'var(--text-main)', textAlign: 'right', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {orderType === 'dine_in'
                    ? `Table ${selectedTableNumber} (${currentBranch.name})`
                    : orderType === 'takeaway'
                    ? currentBranch.name
                    : selectedDeliveryAddress}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Items Ordered:</span>
                <strong style={{ color: 'var(--text-main)' }}>{cartCount} items</strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontWeight: 750,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isCustomerLoggedIn) {
                    setConfirmModalOpen(false);
                    setLoginModalOpen(true);
                    addToast({
                      type: 'warning',
                      title: 'Sign In Required ✉️',
                      message: 'Please sign in to your customer account to place your order.',
                    });
                    return;
                  }
                  handleConfirmOrderFinal();
                }}
                style={{
                  flex: 2,
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 850,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px var(--primary-glow)',
                }}
              >
                Confirm & Place Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ORDER TYPE MODAL (If Unconfirmed) ================= */}
      {orderTypeModalOpen && (
        <div
          onClick={() => setOrderTypeModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            zIndex: 10008,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '380px',
              backgroundColor: 'var(--bg-card, #FFFFFF)',
              borderRadius: '20px',
              padding: '24px',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.28)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>
                Select Order Type
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { id: 'dine_in', label: 'Dine-In' },
                { id: 'takeaway', label: 'Takeaway' },
                { id: 'delivery', label: 'Delivery' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id === 'delivery') {
                      setOrderTypeModalOpen(false);
                      setDeliveryMapModalOpen(true);
                      return;
                    }
                    setLocalOrderType(opt.id as OrderType);
                    setGlobalOrderType(opt.id as OrderType);
                    setHasConfirmedOrderType(true);
                    setOrderTypeModalOpen(false);
                    if (opt.id === 'dine_in') {
                      setSeatingSheetOpen(true);
                    }
                  }}
                  style={{
                    padding: '14px 8px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: 800,
                    color: 'var(--text-main)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customer Login Modal */}
      <CustomerLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={() => {
          setLoginModalOpen(false);
          if (!hasConfirmedOrderType) {
            setOrderTypeModalOpen(true);
          } else if (orderType === 'dine_in') {
            setSeatingSheetOpen(true);
          } else {
            setStep('payment');
          }
        }}
      />

      {/* Interactive OpenStreetMap Delivery Location Confirmation Modal */}
      <DeliveryMapModal
        isOpen={deliveryMapModalOpen}
        onClose={() => setDeliveryMapModalOpen(false)}
        onConfirmDelivery={handleDeliveryConfirmed}
      />
    </>
  );
};
