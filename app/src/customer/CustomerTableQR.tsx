'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Table, TableStatus, OrderItem, MenuItem, Order, OrderStatus, normalizeBranchId } from '@/types/cafe';
import {
  QrCode,
  CheckCircle,
  AlertOctagon,
  Users,
  KeyRound,
  ArrowRight,
  Clock,
  Sparkles,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  X,
  Phone,
  User,
  ChefHat,
  RotateCcw,
  AlertTriangle,
  Utensils,
  ShieldCheck,
  Check,
  CreditCard,
  Banknote,
  Smartphone,
  MapPin,
  Navigation,
  Compass,
  Lock,
  LocateFixed,
} from 'lucide-react';

// Haversine formula to compute distance in meters between user GPS and branch GPS
const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth radius in meters
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

type TableQrLocationStatus = 'idle' | 'requesting' | 'verified' | 'outside_radius' | 'denied' | 'unsupported';

interface TableSelectionScreenProps {
  onNavigate: (view: string) => void;
}

export const TableSelectionScreen: React.FC<TableSelectionScreenProps> = ({ onNavigate }) => {
  const {
    currentBranch,
    tables,
    currentBranchId,
    setCurrentBranchId,
    updateTableStatus,
    markTableFree,
    recordCashPayment,
    addToast,
    menuItems,
    placeOrder,
    currentUser,
    users,
    orders,
    cancelDineInOrder,
    addItemsToExistingOrder,
    activeTableSession,
    setActiveTableSession,
  } = useApp();

  const branchTables = useMemo(() => {
    const normId = normalizeBranchId(currentBranchId);
    return tables.filter(
      (t) => !t.branchId || t.branchId === currentBranchId || normalizeBranchId(t.branchId) === normId
    );
  }, [tables, currentBranchId]);

  // Read URL query params on mount for direct table QR link
  const [selectedTableId, setSelectedTableId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTableNum = params.get('tableQr') || params.get('table');
      const urlBranch = params.get('branch');
      if (urlTableNum) {
        const candidateTables = urlBranch
          ? tables.filter((t) => !t.branchId || t.branchId === urlBranch)
          : branchTables;
        const match = candidateTables.find(
          (t) =>
            t.number.toLowerCase() === urlTableNum.toLowerCase() ||
            t.number.replace(/\D/g, '') === urlTableNum.replace(/\D/g, '')
        );
        if (match) return match.id;
      }
    }
    return branchTables[0]?.id || 't1';
  });

  const currentTable = useMemo(() => {
    return branchTables.find((t) => t.id === selectedTableId) || branchTables[0];
  }, [branchTables, selectedTableId]);

  // Sync if URL params change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTableNum = params.get('tableQr') || params.get('table');
      const urlBranch = params.get('branch');

      if (urlBranch && urlBranch !== currentBranchId && setCurrentBranchId) {
        setCurrentBranchId(urlBranch);
      }

      if (urlTableNum) {
        const candidateTables = urlBranch
          ? tables.filter((t) => !t.branchId || t.branchId === urlBranch)
          : branchTables;
        const match = candidateTables.find(
          (t) =>
            t.number.toLowerCase() === urlTableNum.toLowerCase() ||
            t.number.replace(/\D/g, '') === urlTableNum.replace(/\D/g, '')
        );
        if (match && match.id !== selectedTableId) {
          setSelectedTableId(match.id);
        }
      }
    }
  }, [tables, branchTables, selectedTableId, currentBranchId, setCurrentBranchId]);

  // Check if customer already has an active order on this table
  const activeOrderOnThisTable = useMemo(() => {
    if (!currentTable) return null;
    return orders.find(
      (o) =>
        o.type === 'dine_in' &&
        o.tableNumber === currentTable.number &&
        (!o.branchId || o.branchId === currentBranch.id) &&
        o.status !== 'completed' &&
        o.status !== 'cancelled'
    );
  }, [orders, currentTable, currentBranch.id]);

  // Modes: 'landing' (visual grid / scan check) | 'menu' (ordering) | 'card' (temporary dining card)
  const [viewMode, setViewMode] = useState<'landing' | 'menu' | 'card'>(() => {
    if (activeOrderOnThisTable) return 'card';
    return 'landing';
  });

  // If active order status changes, sync view mode
  useEffect(() => {
    if (activeOrderOnThisTable && viewMode === 'landing') {
      setViewMode('card');
    }
  }, [activeOrderOnThisTable, viewMode]);

  // Reserved pop-up modal state
  const [showReservedModal, setShowReservedModal] = useState(false);

  // When currentTable changes to reserved, pop up the card
  useEffect(() => {
    if (currentTable?.status === 'reserved' && viewMode === 'landing') {
      setShowReservedModal(true);
    } else {
      setShowReservedModal(false);
    }
  }, [currentTable?.status, currentTable?.id, viewMode]);

  // Dine-in table cart
  const [tableCart, setTableCart] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mobile Checkout Modal States (2-step: items review -> phone input with no OTP)
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'items_review' | 'phone_input'>('items_review');

  // Branch location coordinates & customized Table QR max distance
  const branchCoords = useMemo(() => {
    const lat =
      currentBranch.latitude ??
      (currentBranch.city === 'Islamabad' ? 33.7215 : currentBranch.city === 'Karachi' ? 24.8252 : 31.5126);
    const lng =
      currentBranch.longitude ??
      (currentBranch.city === 'Islamabad' ? 73.0552 : currentBranch.city === 'Karachi' ? 67.0305 : 74.3436);
    return { lat, lng };
  }, [currentBranch]);

  const tableQrMaxDistance = currentBranch.tableQrMaxDistanceMeters ?? 300;

  // Geolocation & Distance Verification state
  const [locationStatus, setLocationStatus] = useState<TableQrLocationStatus>('idle');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);

  const isLocationVerified = locationStatus === 'verified';

  // Request user location access via browser Geolocation API
  const requestLocationAccess = (showToastNotice = true) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('unsupported');
      setLocationError('Geolocation is not supported by your browser or device.');
      if (showToastNotice) {
        addToast({
          type: 'error',
          title: 'Location Unsupported',
          message: 'Your browser or device does not support GPS location checking.',
        });
      }
      return;
    }

    setLocationStatus('requesting');
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        setUserCoords({ lat: userLat, lng: userLng });

        const dist = calculateDistanceMeters(userLat, userLng, branchCoords.lat, branchCoords.lng);
        setDistanceMeters(dist);

        if (dist <= tableQrMaxDistance) {
          setLocationStatus('verified');
          setShowLocationModal(false);
          if (showToastNotice) {
            addToast({
              type: 'success',
              title: 'Location Verified! 📍',
              message: `You are inside ${currentBranch.name} (~${dist}m away). Dine-in table ordering enabled!`,
            });
          }
        } else {
          setLocationStatus('outside_radius');
          setShowLocationModal(true);
          if (showToastNotice) {
            const distDisplay = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} meters`;
            addToast({
              type: 'error',
              title: 'Outside Cafe Dining Zone 🚫',
              message: `You are ${distDisplay} from ${currentBranch.name}. Max allowed for Table QR is ${tableQrMaxDistance}m.`,
            });
          }
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocationStatus('denied');
        let msg = 'Location permission is required to order from on-table QR code.';
        if (err.code === 1) {
          msg = 'Location permission was denied. Please allow location access in your browser settings to verify table presence.';
        } else if (err.code === 2) {
          msg = 'Unable to determine your GPS position. Please check your device location services.';
        } else if (err.code === 3) {
          msg = 'Location request timed out. Please try again.';
        }
        setLocationError(msg);
        setShowLocationModal(true);
        if (showToastNotice) {
          addToast({
            type: 'warning',
            title: 'Location Access Needed 📍',
            message: msg,
          });
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    );
  };

  // Automatically trigger location check when customer scans table QR / visits page
  useEffect(() => {
    requestLocationAccess(false);
  }, [branchCoords.lat, branchCoords.lng, tableQrMaxDistance]);

  // Customer contact details
  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    if (currentUser?.phone) return currentUser.phone;
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_customer_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.phone || '';
        }
      } catch (e) {}
    }
    return '';
  });
  const [customerName, setCustomerName] = useState<string>(() => {
    if (currentUser?.name && currentUser.name !== 'Guest Customer') return currentUser.name;
    return 'Table Guest';
  });
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Cancel countdown timer for active order (5 minutes cancel window)
  const [cancelRemainingSec, setCancelRemainingSec] = useState<number>(300);

  useEffect(() => {
    if (!activeOrderOnThisTable) return;
    const createdAtTime = new Date(activeOrderOnThisTable.createdAt).getTime();
    const updateCountdown = () => {
      const now = Date.now();
      const elapsedSec = Math.floor((now - createdAtTime) / 1000);
      const remaining = Math.max(0, 300 - elapsedSec);
      setCancelRemainingSec(remaining);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeOrderOnThisTable]);

  // Pay after eating & free table checkout states
  const [showPaymentCheckoutModal, setShowPaymentCheckoutModal] = useState(false);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'cash' | 'card' | 'wallet'>('cash');
  const [paymentCompletedSuccess, setPaymentCompletedSuccess] = useState(false);

  const handleCompletePaymentAndFreeTable = () => {
    if (!activeOrderOnThisTable) return;
    recordCashPayment(activeOrderOnThisTable.id, activeOrderOnThisTable.total);
    setPaymentCompletedSuccess(true);
    setShowPaymentCheckoutModal(false);
  };

  // Filter available menu items
  const availableMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      const isAvail = item.branchAvailability[currentBranch.id] ?? item.isAvailable;
      if (!isAvail) return false;
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [menuItems, currentBranch.id, selectedCategory, searchQuery]);

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((i) => set.add(i.category));
    return ['All', ...Array.from(set)];
  }, [menuItems]);

  // Add item to table cart
  const handleAddToCart = (dish: MenuItem) => {
    if (!isLocationVerified) {
      setShowLocationModal(true);
      requestLocationAccess(true);
      addToast({
        type: 'error',
        title: locationStatus === 'outside_radius' ? 'Cannot Order Remotely 🚫' : 'Location Required 📍',
        message: locationStatus === 'outside_radius'
          ? `You are ${distanceMeters && distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${distanceMeters}m`} away. Table QR orders are limited to within ${tableQrMaxDistance}m of ${currentBranch.name}.`
          : 'Please allow device location access to verify you are seated at this table.',
      });
      return;
    }

    setTableCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === dish.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItemId === dish.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          menuItemId: dish.id,
          name: dish.name,
          unitPrice: dish.basePrice,
          quantity: 1,
        },
      ];
    });
    addToast({
      type: 'success',
      title: 'Added to Table Order',
      message: `${dish.name} added to your table bill.`,
    });
  };

  const handleUpdateCartQty = (itemId: string, delta: number) => {
    setTableCart((prev) =>
      prev
        .map((i) => {
          if (i.id === itemId) {
            const nextQty = i.quantity + delta;
            return nextQty > 0 ? { ...i, quantity: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as OrderItem[]
    );
  };

  const tableSubtotal = useMemo(() => {
    return tableCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [tableCart]);

  const taxAmount = Math.round(tableSubtotal * 0.16);
  const tableTotal = tableSubtotal + taxAmount;

  // Handle Seating Confirmation (Starts ordering)
  const handleStartOrdering = () => {
    if (!currentTable) return;

    if (!isLocationVerified) {
      setShowLocationModal(true);
      requestLocationAccess(true);
      addToast({
        type: 'error',
        title: locationStatus === 'outside_radius' ? 'Outside Cafe Dining Zone 🚫' : 'Location Required 📍',
        message: locationStatus === 'outside_radius'
          ? `You are ${distanceMeters && distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${distanceMeters}m`} away from ${currentBranch.name}. Max allowed for Table QR is ${tableQrMaxDistance}m.`
          : 'Please allow location access to verify you are physically seated at this table.',
      });
      return;
    }

    // Mark table occupied for this dining session
    updateTableStatus(currentTable.id, 'occupied', customerName || 'Dine-In Customer');
    setActiveTableSession({
      tableId: currentTable.id,
      tableNumber: currentTable.number,
      branchId: currentBranch.id,
      seatedAt: new Date().toISOString(),
    });

    addToast({
      type: 'success',
      title: `Checked In at Table ${currentTable.number}`,
      message: 'Table dining session initiated. Ready to order!',
    });
    setViewMode('menu');
  };

  // Handle Ignore & Continue Ordering on Reserved Table (Cashier feature enabled)
  const handleIgnoreReservationAndContinue = () => {
    if (!currentTable) return;

    if (!isLocationVerified) {
      setShowLocationModal(true);
      requestLocationAccess(true);
      addToast({
        type: 'error',
        title: locationStatus === 'outside_radius' ? 'Outside Cafe Dining Zone 🚫' : 'Location Required 📍',
        message: locationStatus === 'outside_radius'
          ? `Table ordering is only permitted within ${tableQrMaxDistance}m of ${currentBranch.name}.`
          : 'Please allow location access to continue ordering.',
      });
      return;
    }

    setShowReservedModal(false);

    // Override reservation with physical in-store dining
    updateTableStatus(currentTable.id, 'occupied', customerName || 'Dine-In Customer');
    setActiveTableSession({
      tableId: currentTable.id,
      tableNumber: currentTable.number,
      branchId: currentBranch.id,
      seatedAt: new Date().toISOString(),
    });

    addToast({
      type: 'info',
      title: 'Reservation Overridden',
      message: `Table ${currentTable.number} claimed for in-store physical dining.`,
    });
    setViewMode('menu');
  };

  // Submit Final Table Order (No OTP Confirmation!)
  const handleSubmitTableOrder = async () => {
    if (!isLocationVerified) {
      setShowLocationModal(true);
      requestLocationAccess(true);
      addToast({
        type: 'error',
        title: 'Table Order Blocked 🚫',
        message: locationStatus === 'outside_radius'
          ? `You cannot order: Your distance is beyond the allowed ${tableQrMaxDistance}m radius of ${currentBranch.name}.`
          : 'Location access must be granted to submit table orders.',
      });
      return;
    }

    if (tableCart.length === 0) {
      addToast({ type: 'warning', title: 'Empty Cart', message: 'Please select dishes before ordering.' });
      return;
    }
    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      addToast({
        type: 'warning',
        title: 'Phone Number Required',
        message: 'Please enter a valid Pakistani contact phone number (e.g. 0301 2345678).',
      });
      return;
    }

    // Find assigned waiter of that floor / row
    const branchWaiters = users.filter(
      (u) => (!u.branchId || u.branchId === currentBranch.id) && u.role === 'floor_staff'
    );
    const assignedWaiter = branchWaiters[0] || {
      id: 'user-floor',
      name: 'Kashif Ali (Floor Staff)',
    };

    // If customer is adding extra items to an existing active table bill
    if (activeOrderOnThisTable) {
      await addItemsToExistingOrder(activeOrderOnThisTable.id, tableCart);
      setTableCart([]);
      setCheckoutModalOpen(false);
      setViewMode('card');
      return;
    }

    // Place new Dine-In order
    const placed = placeOrder(
      'dine_in',
      currentTable.number,
      currentTable.pin || '4921',
      undefined,
      undefined,
      'Cash',
      tableCart,
      {
        customerId: currentUser?.id || `cust-${Date.now()}`,
        customerName: customerName || `Table ${currentTable.number} Guest`,
        customerPhone: customerPhone.startsWith('+92') ? customerPhone : `+92 ${cleanPhone.slice(-10)}`,
        notes: orderNotes ? `Table QR Order: ${orderNotes}` : 'Table QR Order',
      }
    );

    // Save active table session
    setActiveTableSession({
      tableId: currentTable.id,
      tableNumber: currentTable.number,
      branchId: currentBranch.id,
      seatedAt: new Date().toISOString(),
      orderId: placed?.id,
    });

    // Update table with current order ID
    updateTableStatus(currentTable.id, 'occupied');

    setTableCart([]);
    setCheckoutModalOpen(false);
    setViewMode('card');

    addToast({
      type: 'success',
      title: 'Order Sent to Kitchen 🚀',
      message: `Table ${currentTable.number} order dispatched to Kitchen Line! Waiter ${assignedWaiter.name} notified.`,
    });
  };

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return { bg: 'var(--table-available-bg)', text: 'var(--table-available-text)' };
      case 'reserved':
        return { bg: 'var(--table-reserved-bg)', text: 'var(--table-reserved-text)' };
      case 'occupied':
        return { bg: 'var(--table-occupied-bg)', text: 'var(--table-occupied-text)' };
      case 'cleaning':
        return { bg: 'var(--table-cleaning-bg)', text: 'var(--table-cleaning-text)' };
      default:
        return { bg: 'var(--table-unavailable-bg)', text: 'var(--table-unavailable-text)' };
    }
  };

  // Render Persistent Location Verification Banner (Appears at top of Menu and Landing views)
  const renderLocationBanner = () => {
    if (isLocationVerified) {
      return (
        <div
          style={{
            backgroundColor: '#DCFCE7',
            border: '1.5px solid #86EFAC',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 800, fontSize: '13px' }}>
            <CheckCircle size={18} color="#16A34A" />
            <span>Location Verified: Seated at {currentBranch.name} ({distanceMeters !== null ? `${distanceMeters}m away` : 'Inside Cafe'})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11.5px', color: '#15803D', fontWeight: 700 }}>
            <span>Radius Limit: {tableQrMaxDistance}m</span>
            <button
              type="button"
              onClick={() => requestLocationAccess(true)}
              title="Refresh GPS location"
              style={{
                backgroundColor: 'rgba(22, 101, 52, 0.1)',
                border: '1px solid rgba(22, 101, 52, 0.25)',
                color: '#166534',
                borderRadius: '6px',
                padding: '3px 8px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 750,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={11} />
              <span>Re-check GPS</span>
            </button>
          </div>
        </div>
      );
    }

    if (locationStatus === 'outside_radius') {
      const distDisplay = distanceMeters && distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(2)} km` : `${distanceMeters ?? 'Unknown'} meters`;
      return (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1.5px solid #FCA5A5',
            borderRadius: '14px',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertOctagon size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: '15px', color: '#991B1B' }}>
                🚫 Outside Cafe Dining Zone — Table Ordering Locked
              </div>
              <div style={{ fontSize: '13px', color: '#B91C1C', marginTop: '4px', lineHeight: 1.45 }}>
                You are currently <strong>{distDisplay}</strong> away from <strong>{currentBranch.name}</strong>.
                Table QR ordering is customized to within <strong>{tableQrMaxDistance} meters</strong> to ensure customers are physically seated at their table.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', paddingLeft: '50px' }}>
            <button
              type="button"
              onClick={() => requestLocationAccess(true)}
              style={{
                padding: '9px 15px',
                borderRadius: '8px',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '12.5px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)',
              }}
            >
              <RotateCcw size={14} />
              <span>Re-check My Location 📍</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              style={{
                padding: '9px 15px',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                color: '#991B1B',
                border: '1.5px solid #FCA5A5',
                fontWeight: 800,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Order Delivery / Takeaway Instead 🛵</span>
            </button>
          </div>
        </div>
      );
    }

    // Default / Requesting / Denied state banner
    return (
      <div
        style={{
          backgroundColor: '#FFFBEB',
          border: '1.5px solid #FCD34D',
          borderRadius: '14px',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '240px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Navigation size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 850, fontSize: '14px', color: '#92400E' }}>
              {locationStatus === 'requesting'
                ? '📍 Detecting Your Location...'
                : locationStatus === 'denied'
                ? '📍 Location Permission Needed for Table QR'
                : '📍 Table QR Location Check Required'}
            </div>
            <div style={{ fontSize: '12px', color: '#B45309', marginTop: '2px', lineHeight: 1.4 }}>
              {locationStatus === 'requesting'
                ? 'Please approve the browser prompt to verify your table presence.'
                : locationStatus === 'denied'
                ? (locationError || 'Browser location permission was not granted. Please allow location to enable ordering.')
                : `We must verify you are inside ${currentBranch.name} (within ${tableQrMaxDistance}m) to unlock table ordering.`}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => requestLocationAccess(true)}
          disabled={locationStatus === 'requesting'}
          style={{
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#D97706',
            color: '#FFFFFF',
            fontWeight: 850,
            fontSize: '13px',
            border: 'none',
            cursor: locationStatus === 'requesting' ? 'wait' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 10px rgba(217, 119, 6, 0.3)',
          }}
        >
          <Navigation size={15} />
          <span>{locationStatus === 'requesting' ? 'Requesting GPS...' : 'Allow Location Access 📍'}</span>
        </button>
      </div>
    );
  };

  // Render Interactive Geolocation Modal
  const renderLocationModal = () => {
    if (!showLocationModal) return null;

    const isOutside = locationStatus === 'outside_radius';
    const distDisplay = distanceMeters && distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(2)} km` : `${distanceMeters ?? 'Unknown'} meters`;

    return (
      <div
        onClick={() => setShowLocationModal(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 11000,
          backgroundColor: 'rgba(15, 12, 10, 0.65)',
          backdropFilter: 'blur(5px)',
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
            maxWidth: '500px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '24px',
            border: isOutside ? '2px solid #FCA5A5' : '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-xl)',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            textAlign: 'center',
            animation: 'scaleInModal 0.2s ease',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: isOutside ? '#FEE2E2' : '#FEF3C7',
              color: isOutside ? '#DC2626' : '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            {isOutside ? <AlertOctagon size={32} /> : <Navigation size={32} />}
          </div>

          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main)', margin: '0 0 8px' }}>
              {isOutside
                ? 'Outside Cafe Dining Zone'
                : 'In-Store Location Access Required'}
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {isOutside ? (
                <>
                  You are currently <strong>{distDisplay}</strong> away from <strong>{currentBranch.name}</strong>.
                  Table QR ordering is restricted to physical in-store guests within <strong>{tableQrMaxDistance} meters</strong> of the cafe.
                </>
              ) : (
                <>
                  To place orders directly to Table #{currentTable?.number}, we need your device location to confirm you are physically seated at <strong>{currentBranch.name}</strong> (within {tableQrMaxDistance}m).
                </>
              )}
            </p>
          </div>

          {locationError && (
            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: 'var(--text-muted)',
                textAlign: 'left',
                border: '1px solid var(--border-color)',
              }}
            >
              ⚠️ {locationError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={() => {
                requestLocationAccess(true);
              }}
              disabled={locationStatus === 'requesting'}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isOutside ? '#DC2626' : 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 850,
                border: 'none',
                cursor: locationStatus === 'requesting' ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: isOutside ? '0 4px 14px rgba(220, 38, 38, 0.3)' : '0 4px 14px var(--primary-glow)',
              }}
            >
              {isOutside ? <RotateCcw size={16} /> : <Navigation size={16} />}
              <span>{locationStatus === 'requesting' ? 'Checking Location...' : isOutside ? 'Re-check My GPS Location' : 'Allow Location Access 📍'}</span>
            </button>

            {isOutside && (
              <button
                type="button"
                onClick={() => {
                  setShowLocationModal(false);
                  onNavigate('home');
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  border: '1.5px solid var(--border-color)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>Switch to Delivery / Takeaway 🛵</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowLocationModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '12.5px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // VIEW: PAYMENT COMPLETED & TABLE FREED CONFIRMATION
  // =========================================================================
  if (paymentCompletedSuccess) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto 100px', padding: '0 16px', textAlign: 'center' }}>
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '24px',
            border: '2px solid #86EFAC',
            padding: '36px 24px',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '18px',
          }}
        >
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: '#DCFCE7',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle size={44} />
          </div>

          <div>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Dining Finished & Table Released
            </span>
            <h1 style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-main)', margin: '6px 0 8px' }}>
              Bill Settled & Table #{currentTable?.number} Freed! 🎉
            </h1>
            <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '460px', margin: '0 auto' }}>
              Thank you for dining at Foodies Cafe ({currentBranch.name})! Your payment has been received and your table is now free for incoming customers.
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '14px 20px',
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13.5px',
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Total Bill Settled:</span>
            <span style={{ fontWeight: 900, fontSize: '18px', color: 'var(--primary)' }}>
              Rs. {activeOrderOnThisTable ? activeOrderOnThisTable.total.toLocaleString() : '0'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setPaymentCompletedSuccess(false);
              setViewMode('landing');
              onNavigate('home');
            }}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 850,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px var(--primary-glow)',
              marginTop: '8px',
            }}
          >
            <span>Browse Storefront & New Order ☕</span>
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: TEMPORARY DINING CARD (While customer is seated and eating)
  // =========================================================================
  if (viewMode === 'card' && activeOrderOnThisTable) {
    const isCancelAllowed =
      cancelRemainingSec > 0 &&
      (activeOrderOnThisTable.status === 'placed' || activeOrderOnThisTable.status === 'accepted');

    const formatCountdown = (sec: number) => {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
      <div style={{ maxWidth: '800px', margin: '24px auto 90px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Top Active Session Banner */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl)',
            border: '2px solid var(--primary)',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <Utensils size={16} />
                <span>Active Table Dining Session</span>
              </div>
              <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-main)', margin: '4px 0 2px' }}>
                Table #{currentTable?.number}
              </h1>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {currentTable?.floor || 'Ground Floor'} · {currentBranch.name} · Seated: {new Date(activeOrderOnThisTable.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 900,
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor:
                    activeOrderOnThisTable.status === 'ready' || activeOrderOnThisTable.status === 'served'
                      ? '#DCFCE7'
                      : activeOrderOnThisTable.status === 'preparing'
                      ? '#FEF3C7'
                      : 'rgba(234, 88, 12, 0.12)',
                  color:
                    activeOrderOnThisTable.status === 'ready' || activeOrderOnThisTable.status === 'served'
                      ? '#166534'
                      : activeOrderOnThisTable.status === 'preparing'
                      ? '#B45309'
                      : '#EA580C',
                  border: '1px solid currentColor',
                  display: 'inline-block',
                }}
              >
                {activeOrderOnThisTable.status === 'placed' && '⏱️ SENT TO KITCHEN'}
                {activeOrderOnThisTable.status === 'accepted' && '✓ ACCEPTED BY CHEF'}
                {activeOrderOnThisTable.status === 'preparing' && '👨‍🍳 PREPARING ON STOVE'}
                {activeOrderOnThisTable.status === 'ready' && '🍽️ FOOD READY FOR WAITER'}
                {activeOrderOnThisTable.status === 'served' && '✓ SERVED TO TABLE'}
              </span>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '4px' }}>
                Order #{activeOrderOnThisTable.orderNumber}
              </div>
            </div>
          </div>

          {/* Assigned Waiter Banner */}
          <div
            style={{
              backgroundColor: 'var(--bg-card-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} color="var(--primary)" />
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 750, textTransform: 'uppercase' }}>
                  Assigned Floor Waiter:
                </span>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-main)' }}>
                  {activeOrderOnThisTable.assignedWaiterName || 'Kashif Ali (Floor Staff)'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              📞 Waiter notified & serving this table row
            </div>
          </div>

          {/* Itemized Dishes on Table Bill */}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 10px', color: 'var(--text-main)' }}>
              Ordered Items & Bill Summary
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeOrderOnThisTable.items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 850, color: 'var(--primary)', fontSize: '13.5px' }}>
                      {item.quantity}×
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>
                        {item.name}
                        {item.isAddOn && (
                          <span style={{ marginLeft: '6px', fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#B45309', fontWeight: 800 }}>
                            ADD-ON
                          </span>
                        )}
                      </div>
                      {item.size && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Size: {item.size}</span>}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-main)' }}>
                    Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>

            {/* Bill Subtotal & Total */}
            <div style={{ marginTop: '14px', padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Subtotal: Rs. {activeOrderOnThisTable.originalSubtotal.toLocaleString()}</span>
                {activeOrderOnThisTable.addOnSubtotal > 0 && (
                  <span style={{ fontSize: '12px', color: 'var(--primary)', marginLeft: '10px' }}>
                    + Extra Add-ons: Rs. {activeOrderOnThisTable.addOnSubtotal.toLocaleString()}
                  </span>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>GST Tax (16%) included · Settle in cash at table or cashier desk</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Total Bill:</span>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)' }}>
                  Rs. {activeOrderOnThisTable.total.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Actions: Add Extra Items While Eating, Settle Bill & Free Table, OR Cancel within 5 Mins */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
            {/* 1. Add Extra Dishes / Drinks to Table Bill */}
            <button
              type="button"
              onClick={() => setViewMode('menu')}
              style={{
                flex: 2,
                minWidth: '180px',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px var(--primary-glow)',
              }}
            >
              <Plus size={18} />
              <span>Add Extra Items 🍽️</span>
            </button>

            {/* 2. Settle Bill & Free Table (Pay After Eating) */}
            <button
              type="button"
              onClick={() => setShowPaymentCheckoutModal(true)}
              style={{
                flex: 2,
                minWidth: '200px',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#16A34A',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 850,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
              }}
            >
              <CreditCard size={18} />
              <span>Pay After Eating & Free Table 💳</span>
            </button>

            {/* 3. Cancel Order Before Fixed Time */}
            {isCancelAllowed && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Are you sure you want to cancel order #${activeOrderOnThisTable.orderNumber}?`)) {
                    cancelDineInOrder(activeOrderOnThisTable.id, 'Customer cancelled at table within 5 mins');
                    setViewMode('landing');
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: '150px',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#FEF2F2',
                  border: '1.5px solid #FCA5A5',
                  color: '#DC2626',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <X size={15} />
                <span>Cancel ({formatCountdown(cancelRemainingSec)})</span>
              </button>
            )}
          </div>
        </div>

        {/* CHECKOUT & SETTLE BILL MODAL (Pay After Eating & Free Table) */}
        {showPaymentCheckoutModal && (
          <div
            onClick={() => setShowPaymentCheckoutModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              backgroundColor: 'rgba(15, 12, 10, 0.65)',
              backdropFilter: 'blur(5px)',
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
                maxWidth: '500px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '20px',
                border: '1px solid var(--border-color)',
                padding: '24px',
                boxShadow: 'var(--shadow-xl)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 850, color: 'var(--text-main)' }}>
                      Settle Bill & Free Table
                    </h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Table #{currentTable?.number} · {currentBranch.name}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaymentCheckoutModal(false)}
                  style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Bill Details */}
              <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Original Dishes Subtotal:</span>
                  <span>Rs. {activeOrderOnThisTable.originalSubtotal.toLocaleString()}</span>
                </div>
                {activeOrderOnThisTable.addOnSubtotal > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--primary)' }}>
                    <span>Extra Add-on Dishes (While Eating):</span>
                    <span>+ Rs. {activeOrderOnThisTable.addOnSubtotal.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>GST Sales Tax (16%):</span>
                  <span>Rs. {activeOrderOnThisTable.tax.toLocaleString()}</span>
                </div>
                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 900, color: 'var(--text-main)' }}>
                  <span>Total Due:</span>
                  <span style={{ color: 'var(--primary)' }}>Rs. {activeOrderOnThisTable.total.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  Select Payment Method:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { id: 'cash', label: 'Cash to Waiter / Cashier Desk', sub: 'Pay in cash to your waiter or at the front counter', icon: Banknote },
                    { id: 'card', label: 'Credit / Debit Card', sub: 'Visa, Mastercard, PayPak on-table terminal', icon: CreditCard },
                    { id: 'wallet', label: 'JazzCash / EasyPaisa / Wallet', sub: 'Instant mobile account QR or transfer', icon: Smartphone },
                  ].map((mode) => {
                    const isSelected = selectedPaymentMode === mode.id;
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setSelectedPaymentMode(mode.id as any)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #16A34A' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? '#F0FDF4' : 'var(--bg-card-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isSelected ? '#DCFCE7' : 'var(--bg-card)', color: isSelected ? '#16A34A' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={16} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                            {mode.label}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {mode.sub}
                          </div>
                        </div>
                        {isSelected && <Check size={18} color="#16A34A" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Settle & Free Table Action */}
              <button
                type="button"
                onClick={handleCompletePaymentAndFreeTable}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: 850,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                  marginTop: '4px',
                }}
              >
                <CheckCircle size={18} />
                <span>Confirm Payment & Free Table 🪑</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: DINE-IN MENU (Strictly for Dine-In at this table)
  // =========================================================================
  if (viewMode === 'menu') {
    return (
      <div style={{ maxWidth: '1000px', margin: '16px auto 100px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Top Sticky Table Header */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '14px 18px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(234, 88, 12, 0.1)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Utensils size={18} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)', lineHeight: 1.2 }}>
                Dine-in Menu · Table #{currentTable?.number}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                {currentTable?.floor || 'Ground Floor'} · {currentBranch.name} · Orders delivered directly to this seat
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeOrderOnThisTable && (
              <button
                type="button"
                onClick={() => setViewMode('card')}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontWeight: 750,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                ← Back to Active Bill
              </button>
            )}

            <button
              type="button"
              onClick={() => setViewMode('landing')}
              style={{
                padding: '7px 12px',
                borderRadius: '6px',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Change Table
            </button>
          </div>
        </div>

        {/* Location Verification & Radius Banner in Menu Mode */}
        {renderLocationBanner()}

        {/* Categories Bar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                border: selectedCategory === cat ? 'none' : '1px solid var(--border-color)',
                backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-card)',
                color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                fontWeight: 800,
                fontSize: '12.5px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Dish Items Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {availableMenuItems.map((dish) => {
            const inCart = tableCart.find((i) => i.menuItemId === dish.id);
            return (
              <div
                key={dish.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: inCart ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                  padding: '16px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                      {dish.name}
                    </h3>
                    <span style={{ fontSize: '14.5px', fontWeight: 900, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
                      Rs. {dish.basePrice.toLocaleString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0', lineHeight: 1.4 }}>
                    {dish.description}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {dish.category}
                  </span>

                  {inCart ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-card-subtle)', borderRadius: '6px', padding: '3px 6px' }}>
                      <button
                        onClick={() => handleUpdateCartQty(inCart.id, -1)}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontWeight: 800, fontSize: '13px', minWidth: '16px', textAlign: 'center' }}>
                        {inCart.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateCartQty(inCart.id, 1)}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddToCart(dish)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: !isLocationVerified && locationStatus === 'outside_radius' ? '#DC2626' : 'var(--primary)',
                        color: '#FFFFFF',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {!isLocationVerified ? <Lock size={12} /> : <Plus size={14} />}
                      <span>{!isLocationVerified ? 'Verify & Add' : 'Add to Table'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Bottom Table Cart Bar (Mobile-friendly pop-up trigger) */}
        {tableCart.length > 0 && (
          <div
            style={{
              position: 'fixed',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 'calc(100% - 32px)',
              maxWidth: '680px',
              zIndex: 9000,
              backgroundColor: '#0F0C0A',
              color: '#FFFFFF',
              borderRadius: 'var(--radius-xl)',
              padding: '12px 20px',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              animation: 'slideUpBar 0.25s ease',
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 700 }}>
                Table #{currentTable?.number} · {tableCart.reduce((s, i) => s + i.quantity, 0)} Items Selected
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#FFFFFF' }}>
                Rs. {tableTotal.toLocaleString()} <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>(incl. GST)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!isLocationVerified) {
                  setShowLocationModal(true);
                  requestLocationAccess(true);
                  return;
                }
                setCheckoutStep('items_review');
                setCheckoutModalOpen(true);
              }}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: !isLocationVerified && locationStatus === 'outside_radius' ? '#DC2626' : 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 850,
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: !isLocationVerified && locationStatus === 'outside_radius' ? '0 4px 14px rgba(220, 38, 38, 0.4)' : '0 4px 14px var(--primary-glow)',
              }}
            >
              {!isLocationVerified ? <Lock size={15} /> : null}
              <span>{!isLocationVerified ? 'Verify Location to Checkout' : 'View Table Order'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* =========================================================================
            MOBILE POP-UP 2-STEP CHECKOUT MODAL (No OTP confirmation)
           ========================================================================= */}
        {checkoutModalOpen && (
          <div
            onClick={() => setCheckoutModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 10000,
              backgroundColor: 'rgba(15, 12, 10, 0.65)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: '0',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '560px',
                maxHeight: '90vh',
                backgroundColor: 'var(--bg-card)',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'slideUpDrawer 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 850, color: 'var(--text-main)' }}>
                    {checkoutStep === 'items_review' ? `Table #${currentTable?.number} Order Summary` : 'Customer Contact Details'}
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {checkoutStep === 'items_review' ? 'Step 1 of 2: Review Selected Items' : 'Step 2 of 2: Instant Order without OTP'}
                  </span>
                </div>

                <button
                  onClick={() => setCheckoutModalOpen(false)}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* STEP 1: POP-UP SELECTED ITEMS CARD */}
                {checkoutStep === 'items_review' && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {tableCart.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-card-subtle)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Rs. {item.unitPrice} each
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', padding: '2px 4px', border: '1px solid var(--border-color)' }}>
                              <button
                                onClick={() => handleUpdateCartQty(item.id, -1)}
                                style={{ width: '22px', height: '22px', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
                              >
                                <Minus size={11} />
                              </button>
                              <span style={{ fontWeight: 800, fontSize: '12px', minWidth: '16px', textAlign: 'center' }}>
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleUpdateCartQty(item.id, 1)}
                                style={{ width: '22px', height: '22px', borderRadius: '4px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
                              >
                                <Plus size={11} />
                              </button>
                            </div>

                            <span style={{ fontWeight: 850, fontSize: '13.5px', color: 'var(--text-main)', minWidth: '65px', textAlign: 'right' }}>
                              Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Subtotal & Tax */}
                    <div style={{ padding: '12px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        <span>Subtotal:</span>
                        <span>Rs. {tableSubtotal.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                        <span>GST Tax (16%):</span>
                        <span>Rs. {taxAmount.toLocaleString()}</span>
                      </div>
                      <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 900, color: 'var(--text-main)' }}>
                        <span>Total Bill:</span>
                        <span style={{ color: 'var(--primary)' }}>Rs. {tableTotal.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Forward to Step 2 */}
                    <button
                      type="button"
                      onClick={() => setCheckoutStep('phone_input')}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        fontSize: '14.5px',
                        fontWeight: 850,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px var(--primary-glow)',
                        marginTop: '6px',
                      }}
                    >
                      <span>Proceed: Enter Contact Number</span>
                      <ArrowRight size={17} />
                    </button>
                  </>
                )}

                {/* STEP 2: PHONE NUMBER INPUT (NO OTP CONFIRMATION REQUIRED) */}
                {checkoutStep === 'phone_input' && (
                  <>
                    <div style={{ backgroundColor: 'rgba(234, 88, 12, 0.08)', borderRadius: '8px', padding: '10px 14px', border: '1px solid rgba(234, 88, 12, 0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={16} color="var(--primary)" />
                      <span style={{ fontSize: '11.5px', fontWeight: 750, color: 'var(--primary)' }}>
                        Instant Dine-In Order: No OTP confirmation needed. Order is forwarded immediately to kitchen!
                      </span>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Mobile Phone Number * (Orders linked to your number):
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Phone size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                          type="tel"
                          placeholder="0301 2345678"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '11px 12px 11px 36px',
                            borderRadius: '8px',
                            border: '1.5px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)',
                            fontSize: '14px',
                            fontWeight: 700,
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Customer / Guest Name (Optional):
                      </label>
                      <div style={{ position: 'relative' }}>
                        <User size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                          type="text"
                          placeholder="Your Name (e.g. Zeeshan)"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '11px 12px 11px 36px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-main)',
                            fontSize: '13.5px',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Special Cooking Instructions (Optional):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Less oil, spicy, extra napkins"
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-main)',
                          fontSize: '13px',
                          outline: 'none',
                        }}
                      />
                    </div>

                    {/* Navigation Buttons */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setCheckoutStep('items_review')}
                        style={{
                          flex: 1,
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card-subtle)',
                          color: 'var(--text-secondary)',
                          fontSize: '13px',
                          fontWeight: 750,
                          cursor: 'pointer',
                        }}
                      >
                        ← Back to Items
                      </button>

                      <button
                        type="button"
                        onClick={handleSubmitTableOrder}
                        style={{
                          flex: 2,
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: 'var(--primary)',
                          color: '#FFFFFF',
                          fontSize: '14px',
                          fontWeight: 850,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px var(--primary-glow)',
                        }}
                      >
                        <ChefHat size={16} />
                        <span>Confirm & Send to Kitchen 🚀</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Location Modal in Menu View */}
        {renderLocationModal()}
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: TABLE QR LANDING & VISUAL GRID
  // =========================================================================
  return (
    <div style={{ maxWidth: '1000px', margin: '24px auto 80px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Banner */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <QrCode size={16} />
          <span>Table QR Landing & Visual Grid</span>
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px', margin: 0 }}>
          Dine-in at {currentBranch.name}
        </h1>
        <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          Scan physical on-table QR code or select your seat below to order food directly to your table!
        </p>
      </div>

      {/* Persistent Location Status Banner in Landing View */}
      {renderLocationBanner()}

      {/* Visual Table Grid */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
            Live Branch Table Grid
          </h3>

          {/* Color-coded Legend */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11.5px', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#16A34A' }} /> Available
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#9333EA' }} /> Reserved
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#DC2626' }} /> Occupied
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#CA8A04' }} /> Cleaning
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px' }}>
          {branchTables.map((t) => {
            const isSelected = t.id === currentTable?.id;
            const style = getStatusColor(t.status);
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTableId(t.id)}
                style={{
                  backgroundColor: isSelected ? 'var(--bg-card-hover)' : 'var(--bg-card-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  padding: '14px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transform: isSelected ? 'scale(1.04)' : 'none',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 14px var(--primary-glow)' : 'none',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)' }}>
                  {t.number}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {t.capacity} Seats
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: style.bg,
                    color: style.text,
                    marginTop: '4px',
                  }}
                >
                  {t.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Table Landing State Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          padding: '36px 28px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          Scan View for: {currentTable?.number} ({currentBranch.name})
        </div>

        {/* STATE (A): TABLE AVAILABLE */}
        {currentTable?.status === 'available' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '440px', margin: '0 auto' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--table-available-bg)',
                color: 'var(--table-available-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle size={36} />
            </div>

            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Table {currentTable.number} is Available!
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                You are checked in for Dine-in service at {currentBranch.name}.
              </p>
            </div>

            <button
              onClick={handleStartOrdering}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: !isLocationVerified && locationStatus === 'outside_radius' ? '#DC2626' : 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 800,
                boxShadow: !isLocationVerified && locationStatus === 'outside_radius' ? '0 4px 16px rgba(220, 38, 38, 0.3)' : '0 4px 16px var(--primary-glow)',
                cursor: 'pointer',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {!isLocationVerified ? <Lock size={18} /> : null}
              <span>
                {!isLocationVerified
                  ? locationStatus === 'outside_radius'
                    ? 'Outside Cafe Radius — Locked 🚫'
                    : 'Verify Location & Start Ordering 📍'
                  : 'Start Ordering Now 🍽️'}
              </span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* STATE (B): TABLE RESERVED (Cashier Ignore Option Feature) */}
        {currentTable?.status === 'reserved' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '480px', margin: '0 auto' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--table-reserved-bg)',
                color: 'var(--table-reserved-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={36} />
            </div>

            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Table {currentTable.number} is Reserved
              </h2>
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                This table is held by an online reservation.
              </p>
            </div>

            {/* Cashier Feature Status Banner */}
            {currentTable.allowQrOrderOnReserved ? (
              <div
                style={{
                  backgroundColor: '#DCFCE7',
                  border: '1.5px solid #86EFAC',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  textAlign: 'left',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                }}
              >
                <ShieldCheck size={20} color="#166534" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 850, fontSize: '13px', color: '#166534' }}>
                    Cashier In-Store Ordering Permitted
                  </div>
                  <div style={{ fontSize: '12px', color: '#166534', marginTop: '2px', lineHeight: 1.4 }}>
                    The cashier has enabled in-store dining on this seat. You can ignore this online reservation and proceed with ordering.
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '12.5px',
                  color: 'var(--text-muted)',
                }}
              >
                🔒 In-store ordering is restricted for this reservation. Please pick another available table.
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '6px' }}>
              {currentTable.allowQrOrderOnReserved && (
                <button
                  type="button"
                  onClick={handleIgnoreReservationAndContinue}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px var(--primary-glow)',
                  }}
                >
                  <Utensils size={15} />
                  <span>Ignore & Continue Ordering 🍽️</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const firstAvail = branchTables.find((t) => t.status === 'available');
                  if (firstAvail) setSelectedTableId(firstAvail.id);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: currentTable.allowQrOrderOnReserved ? 'var(--bg-card-subtle)' : 'var(--primary)',
                  border: currentTable.allowQrOrderOnReserved ? '1px solid var(--border-color)' : 'none',
                  color: currentTable.allowQrOrderOnReserved ? 'var(--text-main)' : '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                }}
              >
                Select Available Table
              </button>
            </div>
          </div>
        )}

        {/* STATE (C): TABLE OCCUPIED */}
        {currentTable?.status === 'occupied' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '440px', margin: '0 auto' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--table-occupied-bg)',
                color: 'var(--table-occupied-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertOctagon size={36} />
            </div>

            <div>
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Table {currentTable.number} is Occupied
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.5 }}>
                An active dining session is currently in progress at this table.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '420px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={handleStartOrdering}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: '0 4px 14px var(--primary-glow)',
                }}
              >
                I'm Seated Here (Order Now)
              </button>
              <button
                type="button"
                onClick={() => {
                  const firstAvail = branchTables.find((t) => t.status === 'available');
                  if (firstAvail) setSelectedTableId(firstAvail.id);
                }}
                style={{
                  flex: 1,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Pick Another Table
              </button>
            </div>
          </div>
        )}
      </div>

      {/* POP-UP CARD: TABLE RESERVED NOTICE (Ignorable if cashier enabled feature) */}
      {showReservedModal && currentTable?.status === 'reserved' && (
        <div
          onClick={() => setShowReservedModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(15, 12, 10, 0.65)',
            backdropFilter: 'blur(5px)',
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
              maxWidth: '460px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#F3E8FF', color: '#6B21A8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 850, color: 'var(--text-main)' }}>
                  Table Reserved
                </h3>
              </div>
              <button
                onClick={() => setShowReservedModal(false)}
                style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Table <strong>#{currentTable.number}</strong> ({currentTable.floor || 'Ground Floor'}) is marked as <strong>Reserved</strong> by an online booking.
            </p>

            {/* Check Cashier Permission */}
            {currentTable.allowQrOrderOnReserved ? (
              <div
                style={{
                  backgroundColor: '#DCFCE7',
                  border: '1.5px solid #86EFAC',
                  borderRadius: '12px',
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#166534', fontWeight: 850, fontSize: '13px' }}>
                  <ShieldCheck size={16} />
                  <span>Cashier Permission: Ignorable</span>
                </div>
                <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px', lineHeight: 1.45 }}>
                  The branch cashier has enabled physical in-store dining for this table. You can ignore this online reservation and proceed to order.
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1.5px solid #FECACA',
                  borderRadius: '12px',
                  padding: '12px 14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#991B1B', fontWeight: 850, fontSize: '13px' }}>
                  <AlertTriangle size={16} />
                  <span>Reservation Active</span>
                </div>
                <div style={{ fontSize: '12px', color: '#991B1B', marginTop: '4px', lineHeight: 1.45 }}>
                  Please choose another available table from the floor grid or ask our staff for assistance.
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              {currentTable.allowQrOrderOnReserved && (
                <button
                  type="button"
                  onClick={handleIgnoreReservationAndContinue}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 850,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px var(--primary-glow)',
                  }}
                >
                  <Utensils size={15} />
                  <span>Ignore & Continue Ordering 🍽️</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowReservedModal(false);
                  const firstAvail = branchTables.find((t) => t.status === 'available');
                  if (firstAvail) setSelectedTableId(firstAvail.id);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: currentTable.allowQrOrderOnReserved ? 'var(--bg-card-subtle)' : 'var(--primary)',
                  border: currentTable.allowQrOrderOnReserved ? '1px solid var(--border-color)' : 'none',
                  color: currentTable.allowQrOrderOnReserved ? 'var(--text-main)' : '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Pick Available Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location Modal in Landing View */}
      {renderLocationModal()}
    </div>
  );
};
