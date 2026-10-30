'use client';

import React, { useState, useEffect } from 'react';
import { useApp, useAppSelector, selectCartCount, selectCartSubtotal, selectBranches } from '@/context/AppContext';
import { CustomerFloorSeatingModal } from './CustomerFloorSeatingModal';
import {
  X,
  Plus,
  Minus,
  Trash2,
  KeyRound,
  Check,
  Utensils,
  ShoppingBag,
  Truck,
  Phone,
  User,
  Mail,
  Banknote,
  Smartphone,
  CreditCard,
  Building,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Armchair,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  RefreshCw,
} from 'lucide-react';

interface CustomerCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  initialStep?: 'order_review' | 'auth' | 'fulfillment' | 'details' | 'branch_map' | 'payment';
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
    placeOrder,
    orders,
    branches,
    currentBranch,
    tables,
    floors,
    currentBranchId,
    setCurrentBranchId,
    currentUser,
    setCurrentUser,
    addToast,
    users,
    customerCoordinates,
    setCustomerCoordinates,
  } = useApp();

  // Redux Toolkit memoized selectors with direct React state fallback for zero-lag calculations
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const reduxSubtotal = useAppSelector(selectCartSubtotal);
  const reduxCartCount = useAppSelector(selectCartCount);
  const reduxBranches = useAppSelector(selectBranches);
  const derivedCartCount = (cart || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
  const derivedSubtotal = (cart || []).reduce((sum, i) => sum + (Number(i.unitPrice) || 0) * (i.quantity || 1), 0);

  const rawCartCount = reduxCartCount > 0 ? reduxCartCount : derivedCartCount;
  const rawSubtotal = reduxSubtotal > 0 ? reduxSubtotal : derivedSubtotal;
  const cartCount = mounted ? rawCartCount : 0;
  const subtotal = mounted ? rawSubtotal : 0;
  const total = subtotal;

  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_customer_coordinates');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return customerCoordinates || { lat: 31.5204, lng: 74.3587 };
  });
  const [hasManuallyMovedPin, setHasManuallyMovedPin] = useState(false);

  // Haversine distance calculator in kilometers
  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  // Pakistani Locality Identifier for delivery pins
  const getLocationLabel = (lat: number, lng: number): string => {
    const lahoreDist = calculateDistanceKm(lat, lng, 31.5204, 74.3587);
    const islamabadDist = calculateDistanceKm(lat, lng, 33.6844, 73.0479);
    const karachiDist = calculateDistanceKm(lat, lng, 24.8607, 67.0011);

    if (lahoreDist < 25) {
      if (lat > 31.53) return 'Gulberg / Cantt, Lahore';
      if (lat < 31.48) return 'DHA / Model Town, Lahore';
      return 'Central Lahore Area';
    }
    if (islamabadDist < 25) {
      if (lat > 33.71) return 'Sector F-7 / Blue Area, Islamabad';
      if (lat < 33.65) return 'Rawalpindi / Islamabad Express';
      return 'Islamabad Metropolitan Area';
    }
    if (karachiDist < 30) {
      if (lat < 24.84) return 'Clifton / DHA Phase 5, Karachi';
      if (lat > 24.9) return 'Gulshan-e-Iqbal / PECHS, Karachi';
      return 'Karachi South Coast';
    }
    return `Custom Location (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLiveCoords(coords);
          if (!hasManuallyMovedPin) {
            setDeliveryCoords(coords);
            if (setCustomerCoordinates) setCustomerCoordinates(coords);
          }
        },
        () => {},
        { timeout: 6000 }
      );
    }
  }, [hasManuallyMovedPin, setCustomerCoordinates]);

  // Handler when user sets or changes delivery location on the map
  const handleUpdateDeliveryLocation = (coords: { lat: number; lng: number }, userAction = true) => {
    setDeliveryCoords(coords);
    setLiveCoords(coords);
    setHasManuallyMovedPin(true);
    if (setCustomerCoordinates) setCustomerCoordinates(coords);
    if (typeof window !== 'undefined') {
      localStorage.setItem('foodies_customer_coordinates', JSON.stringify(coords));
    }

    // Auto-select nearest branch based on the new location
    let nearest = branches[0];
    let minD = Infinity;
    branches.forEach((b) => {
      const bLat = b.latitude ?? (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126);
      const bLng = b.longitude ?? (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436);
      const d = calculateDistanceKm(coords.lat, coords.lng, bLat, bLng);
      if (d < minD) {
        minD = d;
        nearest = b;
      }
    });

    if (nearest) {
      setCurrentBranchId(nearest.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('foodies_customer_branch', nearest.id);
        localStorage.setItem('foodies_customer_selected_branch', nearest.id);
      }
    }

    const areaName = getLocationLabel(coords.lat, coords.lng);
    if (orderType === 'delivery') {
      setDeliveryAddress(`${areaName} (Pin: ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`);
    }

    if (userAction && nearest) {
      addToast({
        type: 'info',
        title: 'Delivery Location Set 📍',
        message: `${areaName}. Nearest branch (${nearest.name}) auto-selected. You can also pick any branch to order from.`,
      });
    }
  };

  // User auth state with React state + localStorage fallback
  const isUserLoggedIn = Boolean(
    (currentUser && currentUser.name && currentUser.name !== 'Guest Customer') ||
    (typeof window !== 'undefined' && (() => {
      try {
        const saved = localStorage.getItem('foodies_customer_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed && parsed.name && parsed.name !== 'Guest Customer';
        }
      } catch (e) {}
      return false;
    })())
  );

  // Checkout Stage Flow: 'order_review' -> 'fulfillment' -> 'details' -> 'branch_map' (Route & nearest branch) -> 'payment'
  const [checkoutStep, setCheckoutStep] = useState<'order_review' | 'auth' | 'fulfillment' | 'details' | 'branch_map' | 'payment'>('fulfillment');
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeaway' | 'delivery'>('dine_in');

  const goToStep = (step: 'order_review' | 'auth' | 'fulfillment' | 'details' | 'branch_map' | 'payment', direction: 'forward' | 'backward' = 'forward') => {
    setStepDirection(direction);
    setCheckoutStep(step);
  };

  // Guest auth fields if not logged in (Email Verification Code with 30s resend timer)
  const [guestName, setGuestName] = useState(currentUser?.name || '');
  const [guestEmail, setGuestEmail] = useState(currentUser?.email || '');
  const [guestPhone, setGuestPhone] = useState(currentUser?.phone || '');
  const [authOtpStep, setAuthOtpStep] = useState<'email' | 'otp'>('email');
  const [authOtpCode, setAuthOtpCode] = useState('');
  const [authSentOtp, setAuthSentOtp] = useState('');
  const [authEmailToken, setAuthEmailToken] = useState('');
  const [authIsDevMode, setAuthIsDevMode] = useState(false);
  const [checkoutResendCountdown, setCheckoutResendCountdown] = useState(0);
  const [authLoading, setAuthLoading] = useState(false);

  // 30-Second countdown timer for resending Email OTP
  useEffect(() => {
    if (checkoutResendCountdown <= 0) return;
    const timer = setTimeout(() => {
      setCheckoutResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [checkoutResendCountdown]);

  // Auto-detect saved profile whenever an email is typed
  const handleGuestEmailChange = (val: string) => {
    setGuestEmail(val);
    const cleanEmail = val.trim().toLowerCase();
    if (cleanEmail.includes('@') && cleanEmail.includes('.') && typeof window !== 'undefined') {
      try {
        const registry = JSON.parse(localStorage.getItem('foodies_customer_registry') || '{}');
        const matched = Object.values(registry).find(
          (u: any) => u.email && u.email.toLowerCase() === cleanEmail
        ) as any;
        if (matched?.name) {
          setGuestName(matched.name);
          if (matched.phone) setGuestPhone(matched.phone);
          return;
        }
      } catch (e) {}

      if (users) {
        const found = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
        if (found?.name) {
          setGuestName(found.name);
          if (found.phone) setGuestPhone(found.phone);
        }
      }
    }
  };

  // Auto-detect saved profile whenever a 10-digit Pakistani number is typed
  const handleGuestPhoneChange = (val: string) => {
    setGuestPhone(val);
    const cleanDigits = val.replace(/\D/g, '').slice(-10);
    if (cleanDigits.length === 10 && typeof window !== 'undefined') {
      try {
        const registry = JSON.parse(localStorage.getItem('foodies_customer_registry') || '{}');
        if (registry[cleanDigits]?.name) {
          setGuestName(registry[cleanDigits].name);
          if (registry[cleanDigits]?.email) setGuestEmail(registry[cleanDigits].email);
          return;
        }
      } catch (e) {}

      if (users) {
        const found = users.find((u) => u.phone && u.phone.replace(/\D/g, '').slice(-10) === cleanDigits);
        if (found?.name) {
          setGuestName(found.name);
          if (found.email) setGuestEmail(found.email);
        }
      }
    }
  };

  // Step 2 Details (Equal Card Size states)
  const [selectedFloor, setSelectedFloor] = useState<string>(floors && floors[0] ? floors[0] : 'Ground Floor (Main Dining)');
  const [selectedTable, setSelectedTable] = useState('T-01');
  const [pickupTimeOption, setPickupTimeOption] = useState<'asap' | 'scheduled'>('asap');
  const [scheduledTime, setScheduledTime] = useState('30 mins from now');
  const [takeawayInstructions, setTakeawayInstructions] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(currentUser?.address || 'House 14, Street 9, Model Town, Lahore');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState(currentUser?.phone || '');
  const [floorModalOpen, setFloorModalOpen] = useState(false);

  // Step 3 Payment Mode
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('COD');
  const [selectedInstallmentPlan, setSelectedInstallmentPlan] = useState<'3_months'>('3_months');

  // Tables for active branch
  const branchTables = tables.filter((t) => t.branchId === currentBranchId);

  // Dynamic live branch reference reacting instantly to cross-tab BroadcastChannel & Redux updates
  const liveBranch = React.useMemo(() => {
    return (
      (branches || []).find((b) => b.id === currentBranchId) ||
      (reduxBranches || []).find((b) => b.id === currentBranchId) ||
      currentBranch
    );
  }, [branches, reduxBranches, currentBranchId, currentBranch]);

  // Active payment settings from branch manager with robust JSON parsing
  const rawBranchPaymentSettings = liveBranch?.paymentSettings || currentBranch?.paymentSettings;
  const branchPaymentSettings = React.useMemo(() => {
    if (!rawBranchPaymentSettings) {
      return {
        dine_in: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
        takeaway: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
        delivery: { COD: true, Wallet: true, Card: true, Bank: true, Installment: true },
      };
    }
    if (typeof rawBranchPaymentSettings === 'string') {
      try {
        return JSON.parse(rawBranchPaymentSettings);
      } catch (e) {
        return {
          dine_in: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
          takeaway: { COD: true, Wallet: true, Card: true, Bank: true, Installment: false },
          delivery: { COD: true, Wallet: true, Card: true, Bank: true, Installment: true },
        };
      }
    }
    return rawBranchPaymentSettings;
  }, [rawBranchPaymentSettings]);

  const activePaymentOptions = React.useMemo(() => {
    const opts = (branchPaymentSettings && branchPaymentSettings[orderType]) || {
      COD: true,
      Wallet: true,
      Card: true,
      Bank: true,
      Installment: false,
    };
    return opts;
  }, [branchPaymentSettings, orderType]);

  // If currently selected payment mode is disabled by branch manager, auto-switch to first available
  useEffect(() => {
    if (!activePaymentOptions[selectedPaymentMode as keyof typeof activePaymentOptions]) {
      const allowed = (['COD', 'Card', 'Bank', 'Wallet', 'Installment'] as const).find(
        (m) => activePaymentOptions[m]
      );
      if (allowed) {
        setSelectedPaymentMode(allowed);
        if (checkoutStep === 'payment') {
          addToast({
            type: 'info',
            title: 'Payment Mode Updated',
            message: `${selectedPaymentMode} is disabled at this branch. Switched to ${allowed}.`,
          });
        }
      }
    }
  }, [activePaymentOptions, selectedPaymentMode, checkoutStep, addToast]);

  // Reset steps and sync values when modal opens
  useEffect(() => {
    if (isOpen) {
      const isAlreadyLoggedIn = Boolean(
        (currentUser && currentUser.name && currentUser.name !== 'Guest Customer') ||
        (typeof window !== 'undefined' && (() => {
          try {
            const saved = localStorage.getItem('foodies_customer_user');
            if (saved) {
              const parsed = JSON.parse(saved);
              return parsed && parsed.name && parsed.name !== 'Guest Customer';
            }
          } catch (e) {}
          return false;
        })())
      );
      if (initialStep === 'auth') {
        if (isAlreadyLoggedIn) {
          setCheckoutStep('fulfillment');
        } else {
          setCheckoutStep('auth');
        }
      } else {
        setCheckoutStep(initialStep || 'order_review');
      }
      if (currentUser && currentUser.name && currentUser.name !== 'Guest Customer') {
        setGuestName(currentUser.name || '');
        setGuestPhone(currentUser.phone || '');
        if (currentUser.address) setDeliveryAddress(currentUser.address);
        if (currentUser.phone) setDeliveryPhone(currentUser.phone);
      }
    }
  }, [isOpen, initialStep]);

  // Automatically advance to fulfillment if user becomes authenticated while on auth step
  useEffect(() => {
    if (checkoutStep === 'auth' && isUserLoggedIn) {
      setCheckoutStep('fulfillment');
    }
  }, [checkoutStep, isUserLoggedIn]);

  // Check for existing active orders from this customer for the current fulfillment type
  const cleanPhone = currentUser?.phone?.replace(/\s+/g, '');
  const activeExistingOrder = orders.find((o) => {
    if (o.type !== orderType) return false;
    if (o.status === 'completed' || o.status === 'cancelled') return false;
    if (o.branchId !== currentBranchId) return false;
    const oPhone = o.customerPhone?.replace(/\s+/g, '');
    if (cleanPhone && oPhone && oPhone === cleanPhone) return true;
    if (currentUser?.id && o.customerId && o.customerId === currentUser.id) return true;
    return false;
  });

  // Keep table selection synced to either the active order's table or a free table on the selected floor
  useEffect(() => {
    if (orderType === 'dine_in') {
      if (activeExistingOrder?.tableNumber) {
        setSelectedTable(activeExistingOrder.tableNumber);
      } else {
        const availableTables = branchTables.filter(
          (t) => (t.floor || 'Ground Floor (Main Dining)') === selectedFloor && t.status === 'available'
        );
        if (availableTables.length > 0 && !availableTables.some((t) => t.number === selectedTable)) {
          setSelectedTable(availableTables[0].number);
        }
      }
    }
  }, [orderType, selectedFloor, branchTables, activeExistingOrder, selectedTable]);

  if (!isOpen) return null;

  const handleGuestSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = guestEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      addToast({
        type: 'warning',
        title: 'Valid Email Required',
        message: 'Please enter a valid email address to receive your verification code.',
      });
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          email: cleanEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code.');

      setAuthSentOtp(data.devCode || '');
      if (data.emailToken) setAuthEmailToken(data.emailToken);
      setAuthIsDevMode(!!data.isDevMode);
      setCheckoutResendCountdown(30);
      setAuthOtpStep('otp');
      setAuthOtpCode('');

      if (data.isRealEmailSent) {
        addToast({
          type: 'success',
          title: 'Verification Code Sent! ✉️',
          message: 'A 4-digit code was sent. Check your inbox or spam.',
        });
      } else if (data.mailError) {
        addToast({
          type: 'warning',
          title: 'Email Delivery Notice ⚠️',
          message: data.mailError,
        });
      } else {
        addToast({
          type: 'info',
          title: 'Verification Code Generated ✉️',
          message: `Code is ${data.devCode}.`,
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Delivery Failed',
        message: err.message || 'Could not send verification code.',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = guestEmail.trim().toLowerCase();

    if (!authOtpCode.trim()) {
      addToast({
        type: 'warning',
        title: 'Code Required',
        message: 'Please enter the 4-digit verification code sent to your email.',
      });
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          email: cleanEmail,
          code: authOtpCode.trim(),
          emailToken: authEmailToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid verification code.');

      // PROFILE RETRIEVAL STRICTLY BY EMAIL OR PHONE
      let existingProfile: any = null;
      if (typeof window !== 'undefined') {
        try {
          const registry = JSON.parse(localStorage.getItem('foodies_customer_registry') || '{}');
          existingProfile = Object.values(registry).find(
            (u: any) => u.email && u.email.toLowerCase() === cleanEmail
          );
        } catch (e) {}
      }
      if (!existingProfile && users) {
        existingProfile = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
      }

      const cleanDigits = guestPhone.replace(/\D/g, '').slice(-10);
      const formattedPhone = cleanDigits.length >= 9
        ? `+92 ${cleanDigits.slice(0, 3)} ${cleanDigits.slice(3)}`
        : existingProfile?.phone || '+92 300 1234567';

      let customerName = guestName.trim() || existingProfile?.name || cleanEmail.split('@')[0];
      if (!customerName || customerName.toLowerCase() === 'guest customer') {
        customerName = cleanEmail.split('@')[0] || 'Valued Customer';
      }

      const loggedUser = {
        id: existingProfile?.id || `cust-${Date.now().toString().slice(-6)}`,
        name: customerName,
        phone: formattedPhone,
        email: cleanEmail,
        role: existingProfile?.role || ('customer' as const),
        status: existingProfile?.status || ('active' as const),
        noShowCount: existingProfile?.noShowCount || 0,
        address: existingProfile?.address || deliveryAddress,
      };

      if (typeof window !== 'undefined') {
        try {
          const registry = JSON.parse(localStorage.getItem('foodies_customer_registry') || '{}');
          registry[cleanEmail] = loggedUser;
          if (cleanDigits) registry[cleanDigits] = loggedUser;
          localStorage.setItem('foodies_customer_registry', JSON.stringify(registry));
          localStorage.setItem('foodies_customer_user', JSON.stringify(loggedUser));
        } catch (e) {}
      }

      setCurrentUser(loggedUser);
      addToast({
        type: 'success',
        title: 'Signed In Successfully! ✉️',
        message: existingProfile ? `Welcome back, ${customerName}!` : `Welcome to FoodiesCafe, ${customerName}!`,
      });
      setAuthOtpStep('email');
      setAuthOtpCode('');
      setCheckoutStep('fulfillment');
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Verification Failed',
        message: err.message || 'Incorrect verification code.',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFinalOrderSubmit = () => {
    if (cart.length === 0) return;

    const tablePin = branchTables.find((t) => t.number === selectedTable)?.pin;
    const pickupTimeStr =
      pickupTimeOption === 'asap'
        ? `ASAP (~${currentBranch.prepTimeEstimateMin}m)${takeawayInstructions.trim() ? ' - ' + takeawayInstructions.trim() : ''}`
        : `${takeawayInstructions.trim() || scheduledTime}`;

    const deliveryAddressStr = deliveryInstructions.trim()
      ? `${deliveryAddress.trim()} (Notes: ${deliveryInstructions.trim()})`
      : deliveryAddress.trim();

    const finalCoords = deliveryCoords || liveCoords || customerCoordinates || undefined;

    // Branch order placement allowed from ANY branch chosen by customer
    if (finalCoords) {
      const bLat = currentBranch.latitude ?? (currentBranch.city === 'Islamabad' ? 33.7215 : currentBranch.city === 'Karachi' ? 24.8252 : 31.5126);
      const bLng = currentBranch.longitude ?? (currentBranch.city === 'Islamabad' ? 73.0552 : currentBranch.city === 'Karachi' ? 67.0305 : 74.3436);
      const dist = calculateDistanceKm(finalCoords.lat, finalCoords.lng, bLat, bLng);
      const maxAllowedDist = currentBranch.maxOrderDistanceKm ?? 50;
      if (dist > maxAllowedDist) {
        // Log custom branch order; customer has full freedom to order from any branch
        console.log(`[Order] Custom branch delivery: ${currentBranch.name} (${dist} km). Order accepted.`);
      }
    }

    // Enforce branch payment options: prevent submitting with disabled payment mode
    if (!activePaymentOptions[selectedPaymentMode as keyof typeof activePaymentOptions]) {
      addToast({
        type: 'error',
        title: 'Payment Method Unavailable',
        message: `${selectedPaymentMode} payment is currently disabled by ${currentBranch.name}. Please select an active payment option.`,
      });
      const allowed = (['COD', 'Card', 'Bank', 'Wallet', 'Installment'] as const).find(
        (m) => activePaymentOptions[m]
      );
      if (allowed) setSelectedPaymentMode(allowed);
      return;
    }

    let activeCustomer = currentUser;
    if ((!activeCustomer || !activeCustomer.name || activeCustomer.name === 'Guest Customer') && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_customer_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.name && parsed.name !== 'Guest Customer') {
            activeCustomer = parsed;
          }
        }
      } catch (e) {}
    }

    const createdOrder = placeOrder(
      orderType,
      orderType === 'dine_in' ? selectedTable : undefined,
      orderType === 'dine_in' ? tablePin : undefined,
      orderType === 'takeaway' ? pickupTimeStr : undefined,
      orderType === 'delivery' ? deliveryAddressStr : undefined,
      selectedPaymentMode,
      undefined,
      {
        customerId: activeCustomer?.id,
        customerName: activeCustomer?.name,
        customerPhone: activeCustomer?.phone,
        customerEmail: activeCustomer?.email || guestEmail,
        customerCoordinates: finalCoords,
      }
    );

    // Save to dedicated customer order IDs and history cache
    if (typeof window !== 'undefined' && createdOrder) {
      try {
        const myIds = JSON.parse(localStorage.getItem('foodies_customer_order_ids') || '[]');
        if (!myIds.includes(createdOrder.id)) {
          myIds.unshift(createdOrder.id);
          localStorage.setItem('foodies_customer_order_ids', JSON.stringify(myIds));
        }
        const cache = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
        const updatedCache = [createdOrder, ...cache.filter((o: any) => o.id !== createdOrder.id)];
        localStorage.setItem('foodies_customer_history_cache', JSON.stringify(updatedCache));
      } catch (e) {}
    }

    onClose();
    onNavigate('order-tracking');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="foodies-modal-overlay"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9500,
          backgroundColor: 'rgba(20, 16, 14, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Modal Card */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="foodies-modal-card"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '24px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
            maxWidth: '540px',
            width: '100%',
            height: 'auto',
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            boxSizing: 'border-box',
            transition: 'all 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Step Transition Animation Styles */}
          <style>{`
            @keyframes checkoutSlideInRight {
              0% {
                opacity: 0;
                transform: translateX(18px);
              }
              100% {
                opacity: 1;
                transform: translateX(0);
              }
            }
            @keyframes checkoutSlideInLeft {
              0% {
                opacity: 0;
                transform: translateX(-18px);
              }
              100% {
                opacity: 1;
                transform: translateX(0);
              }
            }
            .checkout-step-anim {
              animation-duration: 0.26s;
              animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
              animation-fill-mode: both;
            }
            .checkout-step-anim.forward {
              animation-name: checkoutSlideInRight;
            }
            .checkout-step-anim.backward {
              animation-name: checkoutSlideInLeft;
            }
          `}</style>

          {/* Cafe Logo adjusted to card size on Login step */}
          {checkoutStep === 'auth' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              <div
                style={{
                  width: '85%',
                  height: '85%',
                  backgroundImage: "url('/logo.png')",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  backgroundSize: 'contain',
                  opacity: 0.22,
                }}
              />
            </div>
          )}

          {/* Modal Header — Clean 1-word intro without extra text or stepper lines */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-card-subtle)',
              flexShrink: 0,
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.01em' }}>
              Checkout
            </h3>

            <button
              onClick={onClose}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* Modal Body - Strictly unscrollable, fluid typography and spacing */}
          <div style={{ padding: 'clamp(10px, 2.2vw, 16px) clamp(12px, 2.5vw, 20px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.8vw, 12px)', boxSizing: 'border-box' }}>

            {/* STAGE: ORDER REVIEW / SUMMARY (Appears when checkout clicked on small screens - Equal Card Size to Subsequent Steps) */}
            {checkoutStep === 'order_review' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.8vw, 12px)', boxSizing: 'border-box' }}>
                <div
                  style={{
                    height: 'clamp(250px, 48vh, 310px)',
                    minHeight: 0,
                    maxHeight: 'clamp(250px, 48vh, 310px)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    padding: 'clamp(10px, 2.2vw, 14px) clamp(10px, 2.5vw, 16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexShrink: 0 }}>
                    <div>
                      <div style={{ fontWeight: 850, fontSize: 'clamp(13px, 2.8vw, 14.5px)', color: 'var(--text-main)', lineHeight: 1.2 }}>
                        Items in Your Order
                      </div>
                      <div style={{ fontSize: 'clamp(10px, 2vw, 11px)', color: 'var(--text-muted)' }}>
                        Review quantities and line totals
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 'clamp(10px, 2vw, 11px)',
                        fontWeight: 800,
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      {cartCount} {cartCount === 1 ? 'Item' : 'Items'}
                    </span>
                  </div>

                  {/* List of cart items - vertically scrollable if items count does not fit the equal card container */}
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'clamp(5px, 1.3vw, 7px)',
                      paddingRight: '4px',
                      boxSizing: 'border-box',
                    }}
                  >
                    {cart.length === 0 ? (
                      <div style={{ textAlign: 'center', margin: 'auto', padding: '20px 10px', color: 'var(--text-muted)' }}>
                        <ShoppingBag size={28} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
                        <div style={{ fontSize: 'clamp(12px, 2.5vw, 13.5px)', fontWeight: 700 }}>Your order is empty</div>
                        <div style={{ fontSize: '11px', marginTop: '2px' }}>Add dishes from the menu to start ordering</div>
                      </div>
                    ) : (
                      cart.map((cartItem) => (
                        <div
                          key={cartItem.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 'clamp(6px, 1.4vw, 8px) clamp(8px, 1.8vw, 10px)',
                            backgroundColor: 'var(--bg-card)',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            gap: '6px',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 'clamp(12px, 2.6vw, 13px)', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {cartItem.name}
                            </div>
                            <div style={{ fontSize: 'clamp(10px, 2.2vw, 11px)', color: 'var(--text-muted)', marginTop: '1px' }}>
                              Rs. {cartItem.unitPrice.toLocaleString()} × {cartItem.quantity}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{ fontSize: 'clamp(12px, 2.6vw, 13px)', fontWeight: 850, color: 'var(--primary)' }}>
                              Rs. {(cartItem.unitPrice * cartItem.quantity).toLocaleString()}
                            </span>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                backgroundColor: 'var(--bg-card-subtle)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '5px',
                                padding: '1px 3px',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => updateCartItemQty(cartItem.id, -1)}
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '4px',
                                  backgroundColor: cartItem.quantity === 1 ? '#FEF2F2' : 'var(--bg-card)',
                                  border: cartItem.quantity === 1 ? '1px solid #FCA5A5' : '1px solid var(--border-color)',
                                  color: cartItem.quantity === 1 ? '#DC2626' : 'var(--primary)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                                aria-label={cartItem.quantity === 1 ? 'Remove item' : 'Decrease quantity'}
                              >
                                {cartItem.quantity === 1 ? <Trash2 size={11} /> : <Minus size={11} />}
                              </button>

                              <span style={{ fontSize: 'clamp(11px, 2.4vw, 12px)', fontWeight: 850, color: 'var(--primary)', minWidth: '14px', textAlign: 'center' }}>
                                {cartItem.quantity}
                              </span>

                              <button
                                type="button"
                                onClick={() => updateCartItemQty(cartItem.id, 1)}
                                style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '4px',
                                  backgroundColor: 'var(--primary)',
                                  color: '#FFFFFF',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
                                aria-label="Increase quantity"
                              >
                                <Plus size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Total Summary */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 'clamp(6px, 1.4vw, 8px) clamp(10px, 2vw, 12px)',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1.5px dashed var(--border-color)',
                      marginTop: '6px',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 'clamp(11.5px, 2.4vw, 12.5px)', fontWeight: 750, color: 'var(--text-secondary)' }}>Total Payable</span>
                    <span style={{ fontSize: 'clamp(14px, 3.2vw, 16px)', fontWeight: 900, color: 'var(--primary)' }}>Rs. {total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Bottom Navigation Buttons */}
                <div style={{ display: 'flex', gap: 'clamp(6px, 1.8vw, 10px)', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigate('menu');
                    }}
                    style={{
                      flex: 1,
                      padding: 'clamp(8px, 1.8vw, 11px)',
                      borderRadius: 'var(--radius-full)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      fontWeight: 750,
                      fontSize: 'clamp(11.5px, 2.5vw, 12.5px)',
                      cursor: 'pointer',
                    }}
                  >
                    Add More Items
                  </button>

                  <button
                    type="button"
                    disabled={cart.length === 0}
                    onClick={() => {
                      if (!isUserLoggedIn) {
                        goToStep('auth', 'forward');
                      } else {
                        goToStep('fulfillment', 'forward');
                      }
                    }}
                    style={{
                      flex: 1.6,
                      padding: 'clamp(8px, 1.8vw, 11px)',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: cart.length > 0 ? 'var(--primary)' : 'var(--bg-card-subtle)',
                      color: cart.length > 0 ? '#FFFFFF' : 'var(--text-muted)',
                      border: 'none',
                      fontWeight: 850,
                      fontSize: 'clamp(12px, 2.6vw, 13px)',
                      cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: cart.length > 0 ? '0 4px 14px var(--primary-glow)' : 'none',
                    }}
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 0: GUEST AUTH PROMPT (Exact Customer Sign In Modal Design) */}
            {checkoutStep === 'auth' && (
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 2vw, 16px)' }}>
                {/* Cafe Logo and Sign In Header */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <div
                    style={{
                      width: 'clamp(42px, 8vw, 50px)',
                      height: 'clamp(42px, 8vw, 50px)',
                      margin: '0 auto 8px',
                      borderRadius: '12px',
                      backgroundColor: '#FFFFFF',
                      padding: '5px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <img src="/logo.png" alt="Foodies Cafe" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                  <h2 style={{ fontSize: 'clamp(16px, 3.5vw, 19px)', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                    Sign In with Email
                  </h2>
                  <p style={{ fontSize: 'clamp(11px, 2.2vw, 12px)', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    {authOtpStep === 'email'
                      ? 'Receive an instant 4-digit verification code to your email'
                      : 'Enter the 4-digit verification code'}
                  </p>
                </div>

                {authOtpStep === 'email' ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleGuestSubmit(e);
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
                  >
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Full Name <span style={{ color: 'var(--primary)' }}>*</span>
                      </label>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 14px',
                        }}
                      >
                        <User size={16} color="var(--primary)" />
                        <input
                          type="text"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="e.g. Shahwaiz Akram"
                          required
                          autoFocus
                          style={{
                            border: 'none',
                            outline: 'none',
                            backgroundColor: 'transparent',
                            fontSize: '13.5px',
                            fontWeight: 650,
                            color: 'var(--text-main)',
                            width: '100%',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Email Address <span style={{ color: 'var(--primary)' }}>*</span>
                      </label>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          backgroundColor: 'var(--bg-input)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 14px',
                        }}
                      >
                        <Mail size={16} color="var(--primary)" />
                        <input
                          type="email"
                          value={guestEmail}
                          onChange={(e) => handleGuestEmailChange(e.target.value)}
                          placeholder="e.g. yourname@gmail.com"
                          required
                          style={{
                            border: 'none',
                            outline: 'none',
                            backgroundColor: 'transparent',
                            fontSize: '13.5px',
                            fontWeight: 650,
                            color: 'var(--text-main)',
                            width: '100%',
                          }}
                        />
                      </div>
                    </div>

                    {/* Submit Action: Send Email Code */}
                    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        type="submit"
                        disabled={authLoading}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--primary)',
                          color: '#FFFFFF',
                          fontSize: '13.5px',
                          fontWeight: 800,
                          border: 'none',
                          boxShadow: 'var(--shadow-md)',
                          cursor: authLoading ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          opacity: authLoading ? 0.75 : 1,
                        }}
                      >
                        <Mail size={16} />
                        <span>{authLoading ? 'Sending Verification Code...' : 'Send Email Verification Code'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleGuestVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {authIsDevMode && authSentOtp ? (
                      <div
                        style={{
                          backgroundColor: '#FFF7ED',
                          border: '1.5px dashed #F97316',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px 14px',
                          textAlign: 'center',
                          fontSize: '13px',
                          color: '#9A3412',
                          fontWeight: 750,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <span>✉️ Demo Verification Code:</span>
                          <span style={{ fontSize: '18px', letterSpacing: '4px', fontWeight: 900, color: '#EA580C' }}>{authSentOtp}</span>
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Enter 4-Digit Verification Code
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={authOtpCode}
                        onChange={(e) => setAuthOtpCode(e.target.value)}
                        placeholder="e.g. 5829"
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: '1.5px solid var(--primary)',
                          backgroundColor: 'var(--bg-input)',
                          color: 'var(--text-main)',
                          fontSize: '22px',
                          textAlign: 'center',
                          fontWeight: 900,
                          letterSpacing: '6px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      style={{
                        marginTop: '4px',
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        fontWeight: 900,
                        fontSize: '14px',
                        border: 'none',
                        boxShadow: 'var(--shadow-md)',
                        cursor: authLoading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        opacity: authLoading ? 0.75 : 1,
                      }}
                    >
                      <Check size={16} />
                      <span>{authLoading ? 'Verifying Code...' : 'Confirm Code & Continue to Order'}</span>
                    </button>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      {checkoutResendCountdown > 0 ? (
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            fontSize: '11.5px',
                            fontWeight: 750,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <RefreshCw size={12} className="spin-slow" />
                          <span>Resend Code in {checkoutResendCountdown}s</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleGuestSubmit()}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '11.5px',
                            cursor: 'pointer',
                            fontWeight: 750,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <RefreshCw size={12} />
                          <span>Resend Email Code ✉️</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setAuthOtpStep('email')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        Change Email
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* STAGE 1: 3 POP-UP CARDS FOR ORDER OPTION (Dine-In, Takeaway, Delivery) - EQUAL CARD SIZE */}
            {checkoutStep === 'fulfillment' && (
              <div className={`checkout-step-anim ${stepDirection}`} style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.8vw, 12px)', boxSizing: 'border-box' }}>
                <div
                  style={{
                    height: 'clamp(250px, 48vh, 310px)',
                    minHeight: 0,
                    maxHeight: 'clamp(250px, 48vh, 310px)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    padding: 'clamp(10px, 2.2vw, 14px) clamp(10px, 2.5vw, 16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontWeight: 850, fontSize: 'clamp(13px, 2.8vw, 14.5px)', color: 'var(--text-main)', marginBottom: '2px' }}>
                      Choose Order Option
                    </div>
                    <div style={{ fontSize: 'clamp(10px, 2vw, 11px)', color: 'var(--text-muted)' }}>
                      Select how you would like to enjoy your order
                    </div>
                  </div>

                  {/* 3 Pop-up Cards for Order Option */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'clamp(6px, 1.5vw, 8px)' }}>
                    {/* Card 1: Dine-In */}
                    <div
                      onClick={() => setOrderType('dine_in')}
                      style={{
                        padding: 'clamp(8px, 1.8vw, 14px) clamp(4px, 1vw, 8px)',
                        borderRadius: '12px',
                        border: orderType === 'dine_in' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: orderType === 'dine_in' ? 'var(--primary-light)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: 'clamp(4px, 1.2vw, 7px)',
                        boxShadow: orderType === 'dine_in' ? '0 4px 14px var(--primary-glow)' : 'var(--shadow-sm)',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <div style={{ width: 'clamp(34px, 6.5vw, 40px)', height: 'clamp(34px, 6.5vw, 40px)', borderRadius: '10px', backgroundColor: 'var(--primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px var(--primary-glow)' }}>
                        <Utensils size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 850, fontSize: 'clamp(12px, 2.6vw, 13.5px)', color: 'var(--text-main)' }}>Dine-In</div>
                        <div style={{ fontSize: 'clamp(9.5px, 2vw, 10.5px)', color: 'var(--text-muted)', marginTop: '1px' }}>
                          Table service
                        </div>
                      </div>
                      <span style={{ fontSize: 'clamp(8.5px, 1.8vw, 9.5px)', fontWeight: 850, padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(217, 101, 40, 0.15)', color: 'var(--primary)' }}>
                        Select Table
                      </span>
                    </div>

                    {/* Card 2: Takeaway */}
                    <div
                      onClick={() => setOrderType('takeaway')}
                      style={{
                        padding: 'clamp(8px, 1.8vw, 14px) clamp(4px, 1vw, 8px)',
                        borderRadius: '12px',
                        border: orderType === 'takeaway' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: orderType === 'takeaway' ? 'var(--primary-light)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: 'clamp(4px, 1.2vw, 7px)',
                        boxShadow: orderType === 'takeaway' ? '0 4px 14px var(--primary-glow)' : 'var(--shadow-sm)',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <div style={{ width: 'clamp(34px, 6.5vw, 40px)', height: 'clamp(34px, 6.5vw, 40px)', borderRadius: '10px', backgroundColor: 'var(--primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px var(--primary-glow)' }}>
                        <ShoppingBag size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 850, fontSize: 'clamp(12px, 2.6vw, 13.5px)', color: 'var(--text-main)' }}>Takeaway</div>
                        <div style={{ fontSize: 'clamp(9.5px, 2vw, 10.5px)', color: 'var(--text-muted)', marginTop: '1px' }}>
                          Counter pickup
                        </div>
                      </div>
                      <span style={{ fontSize: 'clamp(8.5px, 1.8vw, 9.5px)', fontWeight: 850, padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(217, 101, 40, 0.15)', color: 'var(--primary)' }}>
                        Fast Prep
                      </span>
                    </div>

                    {/* Card 3: Delivery */}
                    <div
                      onClick={() => setOrderType('delivery')}
                      style={{
                        padding: 'clamp(8px, 1.8vw, 14px) clamp(4px, 1vw, 8px)',
                        borderRadius: '12px',
                        border: orderType === 'delivery' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: orderType === 'delivery' ? 'var(--primary-light)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        gap: 'clamp(4px, 1.2vw, 7px)',
                        boxShadow: orderType === 'delivery' ? '0 4px 14px var(--primary-glow)' : 'var(--shadow-sm)',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                      }}
                    >
                      <div style={{ width: 'clamp(34px, 6.5vw, 40px)', height: 'clamp(34px, 6.5vw, 40px)', borderRadius: '10px', backgroundColor: 'var(--primary)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px var(--primary-glow)' }}>
                        <Truck size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 850, fontSize: 'clamp(12px, 2.6vw, 13.5px)', color: 'var(--text-main)' }}>Delivery</div>
                        <div style={{ fontSize: 'clamp(9.5px, 2vw, 10.5px)', color: 'var(--text-muted)', marginTop: '1px' }}>
                          At doorstep
                        </div>
                      </div>
                      <span style={{ fontSize: 'clamp(8.5px, 1.8vw, 9.5px)', fontWeight: 850, padding: '2px 6px', borderRadius: '8px', backgroundColor: 'rgba(217, 101, 40, 0.15)', color: 'var(--primary)' }}>
                        Live Tracking
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
                    <span style={{ fontSize: 'clamp(11px, 2.2vw, 12px)', color: 'var(--text-secondary)', fontWeight: 650 }}>
                      Selected Option:
                    </span>
                    <span style={{ fontSize: 'clamp(12.5px, 2.8vw, 13.5px)', fontWeight: 900, color: 'var(--primary)', textTransform: 'capitalize' }}>
                      {orderType === 'dine_in' ? 'Dine-In Service' : orderType === 'takeaway' ? 'Takeaway Pickup' : 'Home Delivery'}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', gap: 'clamp(6px, 1.8vw, 10px)', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const isSmall = typeof window !== 'undefined' && window.innerWidth <= 860;
                      if (isSmall) {
                        goToStep('order_review', 'backward');
                      } else {
                        onClose();
                      }
                    }}
                    style={{
                      padding: 'clamp(8px, 1.8vw, 11px) clamp(12px, 2.5vw, 18px)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-color)',
                      fontWeight: 700,
                      fontSize: 'clamp(11.5px, 2.5vw, 12.5px)',
                      cursor: 'pointer',
                    }}
                  >
                    ← Back to Order
                  </button>

                  <button
                    type="button"
                    onClick={() => goToStep('details', 'forward')}
                    style={{
                      padding: 'clamp(8px, 1.8vw, 11px) clamp(14px, 3vw, 22px)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 850,
                      fontSize: 'clamp(12px, 2.6vw, 13px)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px var(--primary-glow)',
                    }}
                  >
                    <span>Proceed with {orderType === 'dine_in' ? 'Dine-In' : orderType === 'takeaway' ? 'Takeaway' : 'Delivery'}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 2: DETAILS (EQUAL SIZE FOR ALL 3 OPTIONS) */}
            {checkoutStep === 'details' && (
              <div className={`checkout-step-anim ${stepDirection}`} style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.8vw, 12px)', boxSizing: 'border-box' }}>
                {/* 2A: Dine-In -> Table Selection (Equal Card Size, Only Free Tables at Each Floor, Table cards shrink to fit floor) */}
                {orderType === 'dine_in' && (
                  <div
                    style={{
                      height: 'clamp(250px, 48vh, 310px)',
                      minHeight: 0,
                      maxHeight: 'clamp(250px, 48vh, 310px)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      padding: 'clamp(10px, 2.2vw, 14px) clamp(10px, 2.5vw, 16px)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div>
                          <div style={{ fontWeight: 850, fontSize: 'clamp(13px, 2.8vw, 14.5px)', color: 'var(--text-main)' }}>
                            Select Free Table to Dine
                          </div>
                          <div style={{ fontSize: 'clamp(10px, 2vw, 11px)', color: 'var(--text-muted)' }}>
                            Choose floor and select an available table
                          </div>
                        </div>
                      </div>

                      {activeExistingOrder && (
                        <div
                          style={{
                            backgroundColor: 'var(--primary-light)',
                            border: '1px solid var(--primary)',
                            borderRadius: '10px',
                            padding: '6px 10px',
                            marginBottom: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Sparkles size={14} color="var(--primary)" />
                          <span style={{ fontSize: 'clamp(10.5px, 2.2vw, 11.5px)', fontWeight: 800, color: 'var(--primary)' }}>
                            Active Dine-In Order Detected (Table {activeExistingOrder.tableNumber || selectedTable}) — Items will be added to Order #{activeExistingOrder.orderNumber}!
                          </span>
                        </div>
                      )}

                      {/* Floor Selection Tabs */}
                      <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
                        {(floors && floors.length > 0 ? floors : ['Ground Floor', 'First Floor', 'Rooftop']).map((fl) => (
                          <button
                            key={fl}
                            type="button"
                            onClick={() => setSelectedFloor(fl)}
                            style={{
                              padding: '4px clamp(8px, 2vw, 11px)',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: selectedFloor === fl ? 'var(--primary)' : 'var(--bg-card)',
                              color: selectedFloor === fl ? '#FFFFFF' : 'var(--text-main)',
                              border: selectedFloor === fl ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                              fontSize: 'clamp(10.5px, 2.2vw, 11.5px)',
                              fontWeight: 800,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {fl.split('(')[0].trim()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Available Tables Grid (ONLY Free Tables, table cards shrink to fit, scrolls ONLY if available tables exceed capacity) */}
                    <div
                      style={{
                        flex: 1,
                        overflowY: branchTables.filter((t) => (t.floor || 'Ground Floor (Main Dining)') === selectedFloor && t.status === 'available').length > 16 ? 'auto' : 'hidden',
                        margin: '6px 0',
                        padding: '2px 0',
                      }}
                    >
                      {branchTables.filter(
                        (t) => (t.floor || 'Ground Floor (Main Dining)') === selectedFloor && t.status === 'available'
                      ).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)', fontSize: 'clamp(11.5px, 2.5vw, 12.5px)' }}>
                          No free tables available on this floor right now.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(44px, 11vw, 58px), 1fr))', gap: 'clamp(4px, 1.2vw, 6px)' }}>
                          {branchTables
                            .filter((t) => (t.floor || 'Ground Floor (Main Dining)') === selectedFloor && t.status === 'available')
                            .map((t) => {
                              const isSelected = selectedTable === t.number;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => setSelectedTable(t.number)}
                                  style={{
                                    height: 'clamp(32px, 7vw, 38px)',
                                    borderRadius: '8px',
                                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                    backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                                    color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                                    fontWeight: 900,
                                    fontSize: 'clamp(11.5px, 2.5vw, 13px)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: isSelected ? '0 4px 12px var(--primary-glow)' : 'var(--shadow-sm)',
                                    transition: 'all 0.15s ease',
                                    padding: '0 2px',
                                  }}
                                >
                                  {t.number}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {/* Dine-In Card Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
                      <span style={{ fontSize: 'clamp(11px, 2.2vw, 12px)', color: 'var(--text-secondary)', fontWeight: 650 }}>
                        Chosen Free Table:
                      </span>
                      <span style={{ fontSize: 'clamp(12.5px, 2.8vw, 13.5px)', fontWeight: 900, color: 'var(--primary)' }}>
                        Table {selectedTable} ({selectedFloor.split('(')[0].trim()})
                      </span>
                    </div>
                  </div>
                )}

                {/* 2B: Takeaway -> Pickup Details (Equal Card Size, Schedule Later becomes input instruction box) */}
                {orderType === 'takeaway' && (
                  <div
                    style={{
                      height: 'clamp(250px, 48vh, 310px)',
                      minHeight: 0,
                      maxHeight: 'clamp(250px, 48vh, 310px)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      padding: 'clamp(10px, 2.2vw, 14px) clamp(10px, 2.5vw, 16px)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ fontWeight: 850, fontSize: 'clamp(13px, 2.8vw, 14.5px)', color: 'var(--text-main)', marginBottom: '2px' }}>
                        Pickup & Counter Preparation
                      </div>
                      <div style={{ fontSize: 'clamp(10px, 2vw, 11px)', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Ready in approx. {currentBranch.prepTimeEstimateMin} minutes at cafe counter
                      </div>

                      {activeExistingOrder && (
                        <div
                          style={{
                            backgroundColor: 'var(--primary-light)',
                            border: '1px solid var(--primary)',
                            borderRadius: '10px',
                            padding: '6px 10px',
                            marginBottom: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Sparkles size={14} color="var(--primary)" />
                          <span style={{ fontSize: 'clamp(10.5px, 2.2vw, 11.5px)', fontWeight: 800, color: 'var(--primary)' }}>
                            Active Takeaway Order Detected — Items will be added to Order #{activeExistingOrder.orderNumber}!
                          </span>
                        </div>
                      )}

                      {/* Pickup Option Selector */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setPickupTimeOption('asap')}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: pickupTimeOption === 'asap' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: pickupTimeOption === 'asap' ? 'var(--primary-light)' : 'var(--bg-card)',
                            color: pickupTimeOption === 'asap' ? 'var(--primary)' : 'var(--text-main)',
                            fontWeight: 800,
                            fontSize: 'clamp(11px, 2.4vw, 12px)',
                            cursor: 'pointer',
                          }}
                        >
                          ⚡ ASAP Counter Pickup
                        </button>
                        <button
                          type="button"
                          onClick={() => setPickupTimeOption('scheduled')}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '8px',
                            border: pickupTimeOption === 'scheduled' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: pickupTimeOption === 'scheduled' ? 'var(--primary-light)' : 'var(--bg-card)',
                            color: pickupTimeOption === 'scheduled' ? 'var(--primary)' : 'var(--text-main)',
                            fontWeight: 800,
                            fontSize: 'clamp(11px, 2.4vw, 12px)',
                            cursor: 'pointer',
                          }}
                        >
                          🕒 Schedule Later / Notes
                        </button>
                      </div>
                    </div>

                    {/* Middle Area: If Schedule Later selected, becomes input instruction box */}
                    <div style={{ flex: 1, margin: '6px 0', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                      {pickupTimeOption === 'scheduled' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '3px' }}>
                          <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                            Special Instructions & Schedule Time Box
                          </label>
                          <textarea
                            value={takeawayInstructions}
                            onChange={(e) => setTakeawayInstructions(e.target.value)}
                            placeholder="Enter instructions here (e.g. Pickup at 8:30 PM, pack extra raita, less spicy)..."
                            style={{
                              width: '100%',
                              flex: 1,
                              padding: '6px 8px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-input)',
                              color: 'var(--text-main)',
                              fontSize: 'clamp(11.5px, 2.4vw, 12px)',
                              resize: 'none',
                              boxSizing: 'border-box',
                              fontFamily: 'inherit',
                            }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '6px', justifyContent: 'center' }}>
                          <div style={{ padding: '8px 10px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={15} color="var(--primary)" />
                            <span style={{ fontSize: 'clamp(11px, 2.2vw, 11.5px)', color: 'var(--text-secondary)' }}>
                              Kitchen starts immediately upon order confirmation (~{currentBranch.prepTimeEstimateMin}m).
                            </span>
                          </div>
                          <input
                            type="text"
                            value={takeawayInstructions}
                            onChange={(e) => setTakeawayInstructions(e.target.value)}
                            placeholder="Kitchen notes (e.g. Extra napkins, no cutlery)..."
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-input)',
                              color: 'var(--text-main)',
                              fontSize: 'clamp(11.5px, 2.4vw, 12px)',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Takeaway Card Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
                      <span style={{ fontSize: 'clamp(11px, 2.2vw, 12px)', color: 'var(--text-secondary)', fontWeight: 650 }}>
                        Fulfillment:
                      </span>
                      <span style={{ fontSize: 'clamp(12px, 2.6vw, 13px)', fontWeight: 900, color: 'var(--primary)' }}>
                        {pickupTimeOption === 'asap' ? 'Express Counter Pickup' : 'Custom Schedule & Notes'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 2C: Delivery -> Address Input (Equal Card Size) */}
                {orderType === 'delivery' && (
                  <div
                    style={{
                      height: 'clamp(250px, 48vh, 310px)',
                      minHeight: 0,
                      maxHeight: 'clamp(250px, 48vh, 310px)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      padding: 'clamp(10px, 2.2vw, 14px) clamp(10px, 2.5vw, 16px)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ fontWeight: 850, fontSize: 'clamp(13px, 2.8vw, 14.5px)', color: 'var(--text-main)', marginBottom: '2px' }}>
                        Delivery Address & Details
                      </div>
                      <div style={{ fontSize: 'clamp(10px, 2vw, 11px)', color: 'var(--text-muted)' }}>
                        Delivered safely to your location from {currentBranch.name}
                      </div>

                      {activeExistingOrder && (
                        <div
                          style={{
                            backgroundColor: 'var(--primary-light)',
                            border: '1px solid var(--primary)',
                            borderRadius: '10px',
                            padding: '6px 10px',
                            marginBottom: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Sparkles size={14} color="var(--primary)" />
                          <span style={{ fontSize: 'clamp(10.5px, 2.2vw, 11.5px)', fontWeight: 800, color: 'var(--primary)' }}>
                            Active Delivery Order Detected — Items will be added to Order #{activeExistingOrder.orderNumber}!
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Address & Phone Inputs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '2px 0', flex: 1, justifyContent: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                            Complete Street Address *
                          </label>
                          <button
                            type="button"
                            onClick={() => goToStep('branch_map', 'forward')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontSize: '11px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 7px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(217, 101, 40, 0.08)',
                            }}
                          >
                            <MapPin size={12} />
                            <span>Select / Pin on Map 📍</span>
                          </button>
                        </div>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <MapPin size={14} color="var(--primary)" style={{ position: 'absolute', left: '8px' }} />
                          <input
                            type="text"
                            required
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            placeholder="House / Flat No, Street, Colony, City"
                            style={{
                              width: '100%',
                              padding: '6px 8px 6px 28px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-input)',
                              color: 'var(--text-main)',
                              fontSize: 'clamp(11px, 2.4vw, 12px)',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Delivery Landmark / Gate Notes
                        </label>
                        <input
                          type="text"
                          value={deliveryInstructions}
                          onChange={(e) => setDeliveryInstructions(e.target.value)}
                          placeholder="e.g. Near Masjid, ring blue bell, gate code #44"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            fontSize: 'clamp(11px, 2.4vw, 12px)',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>
                          Rider Contact Number *
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <Phone size={14} color="var(--primary)" style={{ position: 'absolute', left: '8px' }} />
                          <input
                            type="tel"
                            required
                            value={deliveryPhone || guestPhone}
                            onChange={(e) => setDeliveryPhone(e.target.value)}
                            placeholder="0300 1234567"
                            style={{
                              width: '100%',
                              padding: '6px 8px 6px 28px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-input)',
                              color: 'var(--text-main)',
                              fontSize: 'clamp(11px, 2.4vw, 12px)',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Delivery Card Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
                      <span style={{ fontSize: 'clamp(11px, 2.2vw, 12px)', color: 'var(--text-secondary)', fontWeight: 650 }}>
                        Tracking:
                      </span>
                      <span style={{ fontSize: 'clamp(12px, 2.6vw, 13px)', fontWeight: 900, color: 'var(--primary)' }}>
                        Live Rider GPS & Doorstep Handover
                      </span>
                    </div>
                  </div>
                )}

                {/* Buttons: Back / Proceed to Payment */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: 'clamp(6px, 1.8vw, 10px)', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => goToStep('fulfillment', 'backward')}
                    style={{
                      padding: 'clamp(8px, 1.8vw, 10px) clamp(12px, 2.5vw, 16px)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: 'clamp(11.5px, 2.5vw, 12.5px)',
                      fontWeight: 750,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Change Option</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => goToStep('branch_map', 'forward')}
                    style={{
                      padding: 'clamp(8px, 1.8vw, 10px) clamp(14px, 3vw, 20px)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 850,
                      fontSize: 'clamp(12px, 2.6vw, 13px)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px var(--primary-glow)',
                    }}
                  >
                    <span>{orderType === 'delivery' ? 'Select Location & Store on Map' : 'Review Store Map & Route'}</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 2.5: BRANCH LOCATOR & ROUTE DIRECTION REVIEW (Shows Before Payment Step) */}
            {checkoutStep === 'branch_map' && (() => {
              // Geolocation & branch calculations
              const activeCoords = deliveryCoords || liveCoords || customerCoordinates || { lat: 31.5204, lng: 74.3587 };
              const branchesWithDist = branches.map((b) => {
                const bLat = b.latitude ?? (b.city === 'Islamabad' ? 33.7215 : b.city === 'Karachi' ? 24.8252 : 31.5126);
                const bLng = b.longitude ?? (b.city === 'Islamabad' ? 73.0552 : b.city === 'Karachi' ? 67.0305 : 74.3436);
                const dist = calculateDistanceKm(activeCoords.lat, activeCoords.lng, bLat, bLng);
                return { ...b, resolvedLat: bLat, resolvedLng: bLng, distanceKm: dist };
              });
              const nearestB = [...branchesWithDist].sort((a, b) => a.distanceKm - b.distanceKm)[0];
              const activeB = branchesWithDist.find((b) => b.id === currentBranchId) || nearestB || branchesWithDist[0];

              // Coordinate Projection (500x260)
              const mW = 500;
              const mH = 260;
              const minLat = 24.0; const maxLat = 34.5;
              const minLng = 66.5; const maxLng = 75.2;
              const pad = 35;
              const proj = (lat: number, lng: number) => {
                const x = pad + ((lng - minLng) / (maxLng - minLng)) * (mW - pad * 2);
                const y = mH - (pad + ((lat - minLat) / (maxLat - minLat)) * (mH - pad * 2));
                return { x, y };
              };
              const uPt = proj(activeCoords.lat, activeCoords.lng);
              const bPt = activeB ? proj(activeB.resolvedLat, activeB.resolvedLng) : null;

              // DIRECTION LINE REQUIREMENT:
              // - Delivery: Line from Branch TO You (Branch ➔ You)
              // - Takeaway/Dine-In: Line from You TO Branch (You ➔ Branch)
              const isDeliv = orderType === 'delivery';
              const lStart = isDeliv ? bPt : uPt;
              const lEnd = isDeliv ? uPt : bPt;

              return (
                <div
                  className={`checkout-step-anim ${stepDirection}`}
                  style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.8vw, 12px)', boxSizing: 'border-box' }}
                >
                  {/* Harmonized Inner Card Container */}
                  <div
                    style={{
                      height: 'clamp(250px, 48vh, 310px)',
                      minHeight: 0,
                      maxHeight: 'clamp(250px, 48vh, 310px)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Left 1 Quarter (~28%): Scrollable Branch List */}
                    <div
                      style={{
                        width: 'clamp(140px, 28%, 180px)',
                        borderRight: '1px solid var(--border-color)',
                        backgroundColor: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                        padding: '6px',
                        gap: '6px',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-secondary)', padding: '2px 4px' }}>
                        Order from Store:
                      </div>
                      {branchesWithDist.map((b) => {
                        const isCur = b.id === currentBranchId;
                        const isNear = nearestB?.id === b.id;
                        return (
                          <div
                            key={b.id}
                            onClick={() => {
                              // Customer has full freedom to order food from ANY branch
                              setCurrentBranchId(b.id);
                              if (typeof window !== 'undefined') {
                                localStorage.setItem('foodies_customer_branch', b.id);
                                localStorage.setItem('foodies_customer_manual_branch', b.id);
                                localStorage.setItem('foodies_customer_selected_branch', b.id);
                              }
                              addToast({
                                type: 'success',
                                title: 'Store Selected! 🍽️',
                                message: `Now ordering food from ${b.name}.`,
                              });
                            }}
                            style={{
                              padding: '8px',
                              borderRadius: '8px',
                              border: isCur ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                              backgroundColor: isCur ? 'rgba(217, 101, 40, 0.08)' : 'var(--bg-card-subtle)',
                              cursor: 'pointer',
                              opacity: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)' }}>{b.city}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                {isNear && (
                                  <span style={{ fontSize: '8px', fontWeight: 900, backgroundColor: '#DCFCE7', color: '#15803D', padding: '1px 4px', borderRadius: '4px' }}>
                                    ⚡ Nearest
                                  </span>
                                )}
                                {isCur && (
                                  <span style={{ fontSize: '8px', fontWeight: 900, backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '1px 4px', borderRadius: '4px' }}>
                                    ✓ Selected
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Branch Name in BOLD */}
                            <div style={{ fontSize: '11px', fontWeight: 850, color: 'var(--text-main)', lineHeight: 1.2 }}>
                              {b.name}
                            </div>
                            {/* Location Address below in LESS BOLD words */}
                            <div style={{ fontSize: '9.5px', fontWeight: 450, color: 'var(--text-muted)', lineHeight: 1.3 }}>
                              {b.address}
                            </div>
                            <div style={{ fontSize: '9.5px', color: 'var(--primary)', fontWeight: 800, marginTop: '2px' }}>
                              📍 {b.distanceKm} km {isCur && '• Active Store'}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right 3 Quarters (~72%): Compact Interactive Map with Direction Line */}
                    <div
                      style={{
                        flex: 1,
                        backgroundColor: '#F7F6F1',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Interactive Top Toolbar: Quick Location Jump & Hint */}
                      <div
                        style={{
                          padding: '4px 8px',
                          backgroundColor: '#FFFFFF',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '4px',
                          overflowX: 'auto',
                          flexShrink: 0,
                          zIndex: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window !== 'undefined' && 'geolocation' in navigator) {
                                navigator.geolocation.getCurrentPosition(
                                  (pos) => handleUpdateDeliveryLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                                  () => addToast({ type: 'warning', title: 'GPS Unavailable', message: 'Could not access GPS. Please click on the map.' }),
                                  { timeout: 6000 }
                                );
                              }
                            }}
                            title="Take me to my current GPS location"
                            style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(37, 99, 235, 0.1)',
                              border: '1px solid rgba(37, 99, 235, 0.25)',
                              color: '#2563EB',
                              fontSize: '9.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <span>🎯 My Current GPS</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateDeliveryLocation({ lat: 31.5204, lng: 74.3587 })}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '10px',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-main)',
                              fontSize: '9.5px',
                              fontWeight: 750,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            📍 Lahore
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateDeliveryLocation({ lat: 33.6844, lng: 73.0479 })}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '10px',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-main)',
                              fontSize: '9.5px',
                              fontWeight: 750,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            📍 Islamabad
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateDeliveryLocation({ lat: 24.8607, lng: 67.0011 })}
                            style={{
                              padding: '2px 7px',
                              borderRadius: '10px',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-main)',
                              fontSize: '9.5px',
                              fontWeight: 750,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            📍 Karachi
                          </button>
                        </div>
                        <span style={{ fontSize: '8.5px', color: 'var(--primary)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          💡 Click map to set pin
                        </span>
                      </div>

                      {/* SVG Interactive Canvas */}
                      <div
                        style={{
                          flex: 1,
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        <svg
                          viewBox={`0 0 ${mW} ${mH}`}
                          style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
                          onClick={(e) => {
                            const svg = e.currentTarget;
                            const rect = svg.getBoundingClientRect();
                            const clickX = ((e.clientX - rect.left) / rect.width) * mW;
                            const clickY = ((e.clientY - rect.top) / rect.height) * mH;
                            
                            const xRatio = Math.max(0, Math.min(1, (clickX - pad) / (mW - pad * 2)));
                            const yRatio = Math.max(0, Math.min(1, (mH - pad - clickY) / (mH - pad * 2)));
                            const newLat = Number((minLat + yRatio * (maxLat - minLat)).toFixed(4));
                            const newLng = Number((minLng + xRatio * (maxLng - minLng)).toFixed(4));
                            
                            handleUpdateDeliveryLocation({ lat: newLat, lng: newLng });
                          }}
                        >
                          <defs>
                            <pattern id="ckGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#EBE8DE" strokeWidth="0.8" />
                            </pattern>
                            <linearGradient id="ckRouteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor={isDeliv ? 'var(--primary)' : '#2563EB'} />
                              <stop offset="100%" stopColor={isDeliv ? '#2563EB' : 'var(--primary)'} />
                            </linearGradient>
                            <marker id="arrowDeliveryCheckout" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                              <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563EB" />
                            </marker>
                            <marker id="arrowToBranchCheckout" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                              <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--primary)" />
                            </marker>
                          </defs>

                          <rect width={mW} height={mH} fill="#F7F6F1" />
                          <rect width={mW} height={mH} fill="url(#ckGrid)" />

                          {/* Background Road veins */}
                          <path d="M 60 220 Q 140 180 230 140 T 360 80" fill="none" stroke="#E3DFD5" strokeWidth="6" strokeLinecap="round" />
                          <text x="90" y="210" fill="#BFBBAE" fontSize="9" fontWeight="800">KARACHI</text>
                          <text x="250" y="130" fill="#BFBBAE" fontSize="9" fontWeight="800">LAHORE</text>
                          <text x="360" y="60" fill="#BFBBAE" fontSize="9" fontWeight="800">ISLAMABAD</text>

                          {/* DIRECTIONAL ROUTE LINE */}
                          {lStart && lEnd && (
                            <g>
                              <line
                                x1={lStart.x}
                                y1={lStart.y}
                                x2={lEnd.x}
                                y2={lEnd.y}
                                stroke="rgba(0,0,0,0.06)"
                                strokeWidth="5"
                                strokeLinecap="round"
                              />
                              <line
                                x1={lStart.x}
                                y1={lStart.y}
                                x2={lEnd.x}
                                y2={lEnd.y}
                                stroke="url(#ckRouteGrad)"
                                strokeWidth="3"
                                strokeDasharray="6 4"
                                strokeLinecap="round"
                                markerEnd={isDeliv ? 'url(#arrowDeliveryCheckout)' : 'url(#arrowToBranchCheckout)'}
                              >
                                <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1.2s" repeatCount="indefinite" />
                              </line>

                              {/* Midpoint Directional Badge */}
                              <g transform={`translate(${(lStart.x + lEnd.x) / 2}, ${(lStart.y + lEnd.y) / 2 - 8})`}>
                                <rect x="-65" y="-10" width="130" height="20" rx="10" fill="#FFFFFF" stroke="var(--border-color)" strokeWidth="1" />
                                <text x="0" y="4" textAnchor="middle" fill="var(--text-main)" fontSize="9" fontWeight="900">
                                  {isDeliv ? `Branch ➔ You (${activeB?.distanceKm} km)` : `You ➔ Branch (${activeB?.distanceKm} km)`}
                                </text>
                              </g>
                            </g>
                          )}

                          {/* Other Branch Pins (Clickable to switch store) */}
                          {branchesWithDist.map((b) => {
                            if (b.id === currentBranchId) return null;
                            const pt = proj(b.resolvedLat, b.resolvedLng);
                            return (
                              <g
                                key={`branch-pin-${b.id}`}
                                transform={`translate(${pt.x}, ${pt.y})`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentBranchId(b.id);
                                  if (typeof window !== 'undefined') {
                                    localStorage.setItem('foodies_customer_branch', b.id);
                                    localStorage.setItem('foodies_customer_selected_branch', b.id);
                                  }
                                  addToast({
                                    type: 'success',
                                    title: 'Store Selected! 🍽️',
                                    message: `Now ordering food from ${b.name}.`,
                                  });
                                }}
                                style={{ cursor: 'pointer' }}
                              >
                                <circle r="9" fill="#FFFFFF" stroke="var(--border-color)" strokeWidth="1.5" />
                                <circle r="4" fill="var(--text-muted)" />
                                <text x="0" y="16" textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="800">
                                  {b.city}
                                </text>
                              </g>
                            );
                          })}

                          {/* Customer Destination Pin (Blue Radar) */}
                          <g transform={`translate(${uPt.x}, ${uPt.y})`}>
                            <circle r="14" fill="rgba(37, 99, 235, 0.2)">
                              <animate attributeName="r" from="8" to="18" dur="2s" repeatCount="indefinite" />
                              <animate attributeName="opacity" from="0.7" to="0" dur="2s" repeatCount="indefinite" />
                            </circle>
                            <circle r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.5" />
                            <g transform="translate(0, -12)">
                              <rect x="-35" y="-8" width="70" height="15" rx="7" fill="#2563EB" />
                              <text x="0" y="2.5" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="900">
                                {isDeliv ? 'DELIVER HERE' : 'YOU (DEST)'}
                              </text>
                            </g>
                          </g>

                          {/* Selected Branch Pin (Orange) */}
                          {bPt && activeB && (
                            <g transform={`translate(${bPt.x}, ${bPt.y})`}>
                              <path d="M 0 0 C -8 -10 -9 -20 0 -28 C 9 -20 8 -10 0 0 Z" fill="var(--primary)" stroke="#FFFFFF" strokeWidth="1.5" />
                              <circle cx="0" cy="-18" r="5" fill="#FFFFFF" />
                              <text x="0" y="-15" textAnchor="middle" fontSize="7">☕</text>
                              <g transform="translate(0, 10)">
                                <rect x="-42" y="0" width="84" height="16" rx="5" fill="#FFFFFF" stroke="var(--primary)" strokeWidth="1" />
                                <text x="0" y="10.5" textAnchor="middle" fill="var(--text-main)" fontSize="8" fontWeight="900">
                                  {activeB.city} Branch
                                </text>
                              </g>
                            </g>
                          )}
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Navigation Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => goToStep('details', 'backward')}
                      style={{
                        padding: 'clamp(8px, 1.8vw, 10px) clamp(12px, 2.5vw, 16px)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        fontSize: 'clamp(11.5px, 2.5vw, 12.5px)',
                        fontWeight: 750,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <ArrowLeft size={14} />
                      <span>Back to Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        // Customer has freedom to order from ANY branch without distance blocking
                        goToStep('payment', 'forward');
                      }}
                      style={{
                        padding: 'clamp(8px, 1.8vw, 10px) clamp(14px, 3vw, 20px)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        border: 'none',
                        fontWeight: 850,
                        fontSize: 'clamp(12px, 2.6vw, 13px)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px var(--primary-glow)',
                      }}
                    >
                      <span>Proceed to Payment Options</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* STAGE 4: PAYMENT OPTIONS (Harmonized Equal Size & Layout - No Layout Shift or Size Jump) */}
            {checkoutStep === 'payment' && (
              <div
                className={`checkout-step-anim ${stepDirection}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.8vw, 12px)', boxSizing: 'border-box' }}
              >
                {/* Inner Card Container - Exactly Identical Height & Background to Stage 1 & Stage 2 */}
                <div
                  style={{
                    height: 'clamp(250px, 48vh, 310px)',
                    minHeight: 0,
                    maxHeight: 'clamp(250px, 48vh, 310px)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    padding: 'clamp(10px, 2.2vw, 14px) clamp(10px, 2.5vw, 16px)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  {/* Top Pinned: Order & Payable Summary */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 850, fontSize: 'clamp(13px, 2.8vw, 14.5px)', color: 'var(--text-main)', marginBottom: '1px' }}>
                          Choose Payment Method
                        </div>
                        <div style={{ fontSize: 'clamp(10px, 2vw, 11px)', color: 'var(--text-muted)' }}>
                          {orderType === 'dine_in'
                            ? `Dine-In • Table ${selectedTable}`
                            : orderType === 'takeaway'
                            ? 'Takeaway • Counter Pickup'
                            : `Home Delivery • ${currentBranch.name.split(' ')[0]}`}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Payable</span>
                        <div style={{ fontWeight: 900, fontSize: 'clamp(14px, 3vw, 16px)', color: 'var(--primary)' }}>
                          Rs. {total.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle Scrollable: Payment Methods List */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      margin: '6px 0',
                      paddingRight: '3px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'clamp(5px, 1.2vw, 7px)',
                    }}
                  >
                    {/* 1. Cash / COD */}
                    {activePaymentOptions.COD && (
                      <div
                        onClick={() => setSelectedPaymentMode('COD')}
                        style={{
                          padding: 'clamp(6px, 1.3vw, 8px) clamp(8px, 1.8vw, 12px)',
                          borderRadius: '10px',
                          border: selectedPaymentMode === 'COD' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: selectedPaymentMode === 'COD' ? 'var(--primary-light)' : 'var(--bg-card)',
                          boxShadow: selectedPaymentMode === 'COD' ? '0 3px 10px var(--primary-glow)' : '0 1px 2px rgba(0,0,0,0.03)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 'clamp(28px, 5vw, 32px)', height: 'clamp(28px, 5vw, 32px)', borderRadius: '7px', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Banknote size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 'clamp(11.5px, 2.4vw, 12.5px)', color: 'var(--text-main)', lineHeight: 1.2 }}>
                              Cash / Pay on Counter
                            </div>
                            <div style={{ fontSize: 'clamp(9.5px, 1.8vw, 10.5px)', color: 'var(--text-muted)' }}>
                              Pay with cash upon delivery or table service
                            </div>
                          </div>
                        </div>
                        {selectedPaymentMode === 'COD' && <CheckCircle2 size={16} color="var(--primary)" />}
                      </div>
                    )}

                    {/* 2. Wallet */}
                    {activePaymentOptions.Wallet ? (
                      <div
                        onClick={() => setSelectedPaymentMode('Wallet')}
                        style={{
                          padding: 'clamp(6px, 1.3vw, 8px) clamp(8px, 1.8vw, 12px)',
                          borderRadius: '10px',
                          border: selectedPaymentMode === 'Wallet' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: selectedPaymentMode === 'Wallet' ? 'var(--primary-light)' : 'var(--bg-card)',
                          boxShadow: selectedPaymentMode === 'Wallet' ? '0 3px 10px var(--primary-glow)' : '0 1px 2px rgba(0,0,0,0.03)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 'clamp(28px, 5vw, 32px)', height: 'clamp(28px, 5vw, 32px)', borderRadius: '7px', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Smartphone size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 'clamp(11.5px, 2.4vw, 12.5px)', color: 'var(--text-main)', lineHeight: 1.2 }}>
                              Mobile Wallet (JazzCash / Easypaisa)
                            </div>
                            <div style={{ fontSize: 'clamp(9.5px, 1.8vw, 10.5px)', color: 'var(--text-muted)' }}>
                              Instant mobile wallet transfer
                            </div>
                          </div>
                        </div>
                        {selectedPaymentMode === 'Wallet' && <CheckCircle2 size={16} color="var(--primary)" />}
                      </div>
                    ) : (
                      <div
                        style={{
                          padding: 'clamp(6px, 1.3vw, 8px) clamp(8px, 1.8vw, 12px)',
                          borderRadius: '10px',
                          border: '1px dashed var(--border-color)',
                          backgroundColor: 'var(--bg-card-subtle)',
                          opacity: 0.6,
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                        title="Wallet payment is disabled by branch manager"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 'clamp(28px, 5vw, 32px)', height: 'clamp(28px, 5vw, 32px)', borderRadius: '7px', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Smartphone size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 'clamp(11.5px, 2.4vw, 12.5px)', color: 'var(--text-muted)', lineHeight: 1.2 }}>
                              Mobile Wallet (JazzCash / Easypaisa)
                            </div>
                            <div style={{ fontSize: 'clamp(9.5px, 1.8vw, 10.5px)', color: '#DC2626', fontWeight: 750 }}>
                              Disabled by Branch Manager
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                          OFF
                        </span>
                      </div>
                    )}

                    {/* 3. Card */}
                    {activePaymentOptions.Card && (
                      <div
                        onClick={() => setSelectedPaymentMode('Card')}
                        style={{
                          padding: 'clamp(6px, 1.3vw, 8px) clamp(8px, 1.8vw, 12px)',
                          borderRadius: '10px',
                          border: selectedPaymentMode === 'Card' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: selectedPaymentMode === 'Card' ? 'var(--primary-light)' : 'var(--bg-card)',
                          boxShadow: selectedPaymentMode === 'Card' ? '0 3px 10px var(--primary-glow)' : '0 1px 2px rgba(0,0,0,0.03)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 'clamp(28px, 5vw, 32px)', height: 'clamp(28px, 5vw, 32px)', borderRadius: '7px', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CreditCard size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 'clamp(11.5px, 2.4vw, 12.5px)', color: 'var(--text-main)', lineHeight: 1.2 }}>
                              Debit / Credit Card
                            </div>
                            <div style={{ fontSize: 'clamp(9.5px, 1.8vw, 10.5px)', color: 'var(--text-muted)' }}>
                              Visa, Mastercard, PayPak
                            </div>
                          </div>
                        </div>
                        {selectedPaymentMode === 'Card' && <CheckCircle2 size={16} color="var(--primary)" />}
                      </div>
                    )}

                    {/* 4. Bank Transfer */}
                    {activePaymentOptions.Bank && (
                      <div
                        onClick={() => setSelectedPaymentMode('Bank')}
                        style={{
                          padding: 'clamp(6px, 1.3vw, 8px) clamp(8px, 1.8vw, 12px)',
                          borderRadius: '10px',
                          border: selectedPaymentMode === 'Bank' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                          backgroundColor: selectedPaymentMode === 'Bank' ? 'var(--primary-light)' : 'var(--bg-card)',
                          boxShadow: selectedPaymentMode === 'Bank' ? '0 3px 10px var(--primary-glow)' : '0 1px 2px rgba(0,0,0,0.03)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 'clamp(28px, 5vw, 32px)', height: 'clamp(28px, 5vw, 32px)', borderRadius: '7px', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 'clamp(11.5px, 2.4vw, 12.5px)', color: 'var(--text-main)', lineHeight: 1.2 }}>
                              Bank Transfer (Raast / IBAN)
                            </div>
                            <div style={{ fontSize: 'clamp(9.5px, 1.8vw, 10.5px)', color: 'var(--text-muted)' }}>
                              Direct bank account transfer
                            </div>
                          </div>
                        </div>
                        {selectedPaymentMode === 'Bank' && <CheckCircle2 size={16} color="var(--primary)" />}
                      </div>
                    )}

                    {/* 5. Installments (BNPL) */}
                    {activePaymentOptions.Installment && (
                      <div
                        onClick={() => setSelectedPaymentMode('Installment')}
                        style={{
                          padding: 'clamp(6px, 1.3vw, 8px) clamp(8px, 1.8vw, 12px)',
                          borderRadius: '10px',
                          border: selectedPaymentMode === 'Installment' ? '2px solid #8B5CF6' : '1px solid var(--border-color)',
                          backgroundColor: selectedPaymentMode === 'Installment' ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-card)',
                          boxShadow: selectedPaymentMode === 'Installment' ? '0 3px 12px rgba(139, 92, 246, 0.25)' : '0 1px 2px rgba(0,0,0,0.03)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          transition: 'all 0.18s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: 'clamp(28px, 5vw, 32px)', height: 'clamp(28px, 5vw, 32px)', borderRadius: '7px', backgroundColor: 'rgba(139, 92, 246, 0.18)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Sparkles size={16} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <span style={{ fontWeight: 800, fontSize: 'clamp(11.5px, 2.4vw, 12.5px)', color: 'var(--text-main)', lineHeight: 1.2 }}>
                                  Pay in 3 Installments (BNPL)
                                </span>
                                <span style={{ fontSize: '8.5px', fontWeight: 850, backgroundColor: '#8B5CF6', color: '#FFFFFF', padding: '1px 4px', borderRadius: '3px' }}>
                                  0% MARKUP
                                </span>
                              </div>
                              <div style={{ fontSize: 'clamp(9.5px, 1.8vw, 10.5px)', color: 'var(--text-muted)' }}>
                                3 monthly payments of Rs. {Math.round(total / 3).toLocaleString()} / month
                              </div>
                            </div>
                          </div>
                          {selectedPaymentMode === 'Installment' && <CheckCircle2 size={16} color="#8B5CF6" />}
                        </div>

                        {selectedPaymentMode === 'Installment' && (
                          <div style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid rgba(139, 92, 246, 0.35)', fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                            ✨ 1st payment today: Rs. {Math.round(total / 3).toLocaleString()} · Next 2 payments billed monthly.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payment Card Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
                    <span style={{ fontSize: 'clamp(11px, 2.2vw, 12px)', color: 'var(--text-secondary)', fontWeight: 650 }}>
                      Selected Mode:
                    </span>
                    <span style={{ fontSize: 'clamp(12px, 2.6vw, 13px)', fontWeight: 900, color: 'var(--primary)' }}>
                      {selectedPaymentMode === 'COD'
                        ? 'Cash / Pay on Counter'
                        : selectedPaymentMode === 'Wallet'
                        ? 'JazzCash / Easypaisa'
                        : selectedPaymentMode === 'Card'
                        ? 'Debit / Credit Card'
                        : selectedPaymentMode === 'Bank'
                        ? 'Bank Transfer (Raast)'
                        : '3-Month Installments (BNPL)'}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Buttons Outside Container */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', gap: 'clamp(6px, 1.8vw, 10px)', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => goToStep('branch_map', 'backward')}
                    style={{
                      padding: 'clamp(8px, 1.8vw, 10px) clamp(12px, 2.5vw, 16px)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: 'clamp(11.5px, 2.5vw, 12.5px)',
                      fontWeight: 750,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Back to Store Map</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleFinalOrderSubmit}
                    style={{
                      padding: 'clamp(8px, 1.8vw, 10px) clamp(14px, 3vw, 22px)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 850,
                      fontSize: 'clamp(12px, 2.6vw, 13.5px)',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px var(--primary-glow)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>
                      {activeExistingOrder
                        ? `Add to Order #${activeExistingOrder.orderNumber} • Rs. ${total.toLocaleString()}`
                        : `Confirm Order • Rs. ${total.toLocaleString()}`}
                    </span>
                    <CheckCircle2 size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seating Map Modal */}
      {floorModalOpen && (
        <CustomerFloorSeatingModal
          isOpen={floorModalOpen}
          onClose={() => setFloorModalOpen(false)}
          selectedTableNumber={selectedTable}
          onSelectTable={(tableNum) => {
            setSelectedTable(tableNum);
            setFloorModalOpen(false);
          }}
        />
      )}
    </>
  );
};
