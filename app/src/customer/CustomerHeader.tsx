'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp, useAppSelector, selectCartCount } from '@/context/AppContext';
import {
  ShoppingBag,
  Bell,
  User,
  X,
  Mail,
  Phone,
  Lock,
  Menu,
  ShoppingCart,
  ClipboardList,
  History,
  MapPinned,
  HelpCircle,
  ChevronRight,
  LogOut,
  UserCircle,
  ArrowRight,
  Check,
  RefreshCw,
  MapPin,
  Edit,
  PhoneCall,
  AlertTriangle,
} from 'lucide-react';
import { StoreMapModal } from './StoreMapModal';
import { getCancellationAttribution } from '@/types/cafe';
import { CustomerLoginModal } from './CustomerLoginModal';
import { NotificationCenterModal } from '../components/common/NotificationCenterModal';

interface CustomerHeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenCart: () => void;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  currentView,
  onNavigate,
  onOpenCart,
}) => {
  const {
    branches,
    currentBranchId,
    setCurrentBranchId,
    cart,
    addToast,
    currentUser,
    setCurrentUser,
    users,
    orders,
    unreadNotificationsCount,
    openNotificationModal,
  } = useApp();

  // Customer Login Modal State (Email Verification Code)
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Store Maps Pop-up Modal State
  const [storeMapModalOpen, setStoreMapModalOpen] = useState(false);
  const [storeMapStartInEdit, setStoreMapStartInEdit] = useState(false);

  // Profile Popup Screen Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || '');
  const [editPhone, setEditPhone] = useState(currentUser?.phone || '');
  const [editEmail, setEditEmail] = useState(currentUser?.email || '');

  // Left Sidebar Drawer State
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const cleanPhone = currentUser?.phone ? currentUser.phone.replace(/\D/g, '').slice(-10) : '';
  const recentCancelledOrder = React.useMemo(() => {
    return orders.find((o) => {
      if (o.status !== 'cancelled') return false;
      if (currentUser?.id && currentUser.id !== 'user-guest' && o.customerId === currentUser.id) return true;
      if (currentUser?.email && o.customerEmail && o.customerEmail.toLowerCase() === currentUser.email.toLowerCase()) return true;
      if (cleanPhone && o.customerPhone && o.customerPhone.replace(/\D/g, '').slice(-10) === cleanPhone) return true;
      return false;
    });
  }, [orders, currentUser, cleanPhone]);

  // Cart Popup Notification State
  const [cartPopup, setCartPopup] = useState<{ show: boolean; itemName: string; count: number }>({
    show: false,
    itemName: '',
    count: 0,
  });
  const cartPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCartRef = useRef<number>(0);

  // Sync profile form fields with currentUser whenever opened
  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name || '');
      setEditPhone(currentUser.phone || '');
      setEditEmail(currentUser.email || '');
    }
  }, [currentUser, profileModalOpen]);

  // Prevent background scrolling when any modal is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (authModalOpen || sidebarOpen || profileModalOpen || contactModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [authModalOpen, sidebarOpen, profileModalOpen, contactModalOpen]);

  // Auto-detect branch based on customer location (with manual override remembered)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If user previously manually picked a branch, honor their explicit choice
    const savedBranch = localStorage.getItem('foodies_customer_selected_branch');
    if (savedBranch && branches.some((b) => b.id === savedBranch)) {
      if (savedBranch !== currentBranchId) {
        setCurrentBranchId(savedBranch, true);
      }
      return;
    }

    // Coordinates for branches
    const branchCoords: Record<string, { lat: number; lng: number }> = {
      'gulberg-lahore': { lat: 31.5204, lng: 74.3587 },
      'f7-islamabad': { lat: 33.6844, lng: 73.0479 },
      'clifton-karachi': { lat: 24.8607, lng: 67.0011 },
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          let nearestId = 'gulberg-lahore';
          let minDistance = Infinity;

          Object.entries(branchCoords).forEach(([bId, coords]) => {
            const dLat = coords.lat - latitude;
            const dLng = coords.lng - longitude;
            const dist = dLat * dLat + dLng * dLng;
            if (dist < minDistance) {
              minDistance = dist;
              nearestId = bId;
            }
          });

          if (nearestId !== currentBranchId) {
            const hasManual = localStorage.getItem('foodies_customer_selected_branch');
            if (!hasManual) {
              setCurrentBranchId(nearestId, false);
            }
          }
        },
        () => {
          // If permission denied or unavailable, defaults to Gulberg Lahore seamlessly
        },
        { timeout: 7000 }
      );
    }
  }, [branches, currentBranchId, setCurrentBranchId]);

  // Redux Toolkit memoized selector with direct React state fallback for zero-lag updates
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const reduxCartCount = useAppSelector(selectCartCount);
  const derivedCartCount = (cart || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
  const rawCartCount = reduxCartCount > 0 ? reduxCartCount : derivedCartCount;
  const cartCount = mounted ? rawCartCount : 0;

  useEffect(() => {
    if (cartCount > prevCartRef.current && cartCount > 0) {
      // Find the latest item name
      const latestItem = cart[cart.length - 1];
      setCartPopup({
        show: true,
        itemName: latestItem?.name || 'Item',
        count: cartCount,
      });

      // Clear any existing timer
      if (cartPopupTimer.current) {
        clearTimeout(cartPopupTimer.current);
      }

      // Auto-hide after 3 seconds
      cartPopupTimer.current = setTimeout(() => {
        setCartPopup((prev) => ({ ...prev, show: false }));
      }, 3000);
    }
    prevCartRef.current = cartCount;
  }, [cartCount, cart]);


  const handleLogout = () => {
    setCurrentUser({
      id: 'user-cust',
      name: 'Guest Customer',
      phone: '',
      email: '',
      role: 'customer',
      status: 'active',
    });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('foodies_customer_user');
      localStorage.removeItem('foodies_customer_login_time');
      localStorage.removeItem('foodies_customer_session');
      localStorage.removeItem('foodies_customer_order_ids');
      localStorage.removeItem('foodies_customer_history_cache');
    }
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'You have been signed out successfully.',
    });
    setSidebarOpen(false);
    setProfileModalOpen(false);
  };

  const isLoggedIn = Boolean(
    currentUser &&
    currentUser.name &&
    currentUser.name !== 'Guest Customer' &&
    currentUser.id !== 'user-guest' &&
    currentUser.id !== 'guest'
  );

  // Sidebar navigation handler
  const handleSidebarNav = (view: string) => {
    setSidebarOpen(false);
    onNavigate(view);
  };

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
          backdropFilter: 'blur(10px)',
          width: '100%',
          maxWidth: '100vw',
          height: '72px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          overflowX: 'hidden',
        }}
      >
        <div
          className="customer-header-inner"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxSizing: 'border-box',
          }}
        >
          {/* Left: Hamburger Menu + FoodiesCafe Brand (No pic, no subtitle) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
            {/* Hamburger Menu (3 Lines) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="header-menu-button"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
              aria-label="Open navigation menu"
            >
              <Menu size={22} strokeWidth={2.5} />
            </button>

            {/* Brand Title (Removed logo picture before name & removed 'Eat Fresh & Healthy' subtitle) */}
            <div
              onClick={() => onNavigate('home')}
              className="header-brand-title"
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontWeight: 900,
                  fontSize: '22px',
                  color: 'var(--text-main)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  display: 'inline-block',
                }}
              >
                Foodies<span style={{ color: 'var(--primary)' }}>Cafe</span>
              </span>
            </div>
          </div>

          {/* Right Section: Cart (Fixed Width) + Account */}
          <div className="header-right-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {/* 1. CART BUTTON (STABLE FIXED WIDTH — header will NEVER shift or increase length when items added) */}
            <div className="header-cart-button" style={{ position: 'relative', width: '92px', height: '42px', flexShrink: 0 }}>
              <button
                onClick={() => {
                  if (authModalOpen) setAuthModalOpen(false);
                  if (cartCount === 0) {
                    onNavigate('menu');
                  } else if (typeof window !== 'undefined' && window.innerWidth > 860) {
                    onNavigate('menu');
                  } else {
                    onOpenCart();
                  }
                }}
                style={{
                  width: '92px',
                  height: '42px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: cartCount > 0 ? 'var(--primary)' : 'var(--bg-card-subtle)',
                  color: cartCount > 0 ? '#FFFFFF' : 'var(--text-main)',
                  border: cartCount > 0 ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  fontWeight: 850,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  boxShadow: cartCount > 0 ? '0 4px 14px var(--primary-glow)' : 'var(--shadow-sm)',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxSizing: 'border-box',
                }}
              >
                <ShoppingBag size={17} style={{ flexShrink: 0 }} />
                <span>Cart</span>
              </button>

              {/* Absolute Badge: positioned on top corner so button width never expands */}
              {cartCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-4px',
                    minWidth: '20px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    color: 'var(--primary)',
                    fontSize: '11px',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 5px',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                    border: '2px solid var(--primary)',
                    pointerEvents: 'none',
                    zIndex: 2,
                    boxSizing: 'border-box',
                  }}
                >
                  {cartCount}
                </span>
              )}
            </div>

            {/* 4. Compact Account Icon */}
            <button
              className="header-profile-button"
              onClick={() => {
                if (isLoggedIn) {
                  setProfileModalOpen(true);
                } else {
                  setAuthModalOpen(true);
                }
              }}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: isLoggedIn ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: isLoggedIn ? 'var(--primary)' : 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              aria-label={isLoggedIn ? 'View profile details' : 'Sign in'}
            >
              <User size={19} />
            </button>
          </div>
        </div>
      </header>

      {/* ============ LEFT SIDEBAR DRAWER (UNSCROLLABLE) ============ */}
      {/* Backdrop: smooth fade in and out */}
      <div
        onClick={() => setSidebarOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          backgroundColor: 'rgba(15, 12, 10, 0.55)',
          backdropFilter: 'blur(4px)',
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? 'auto' : 'none',
          transition: 'opacity 0.28s cubic-bezier(0.2, 0.8, 0.25, 1)',
        }}
      />

      {/* Drawer Panel: smooth slide in from left and slide out to left */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '240px',
          maxWidth: '65vw',
          backgroundColor: 'var(--bg-card)',
          zIndex: 10001,
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.32s ease',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: sidebarOpen ? '6px 0 36px rgba(0, 0, 0, 0.22)' : 'none',
          overflow: 'hidden', // Unscrollable per user requirement!
        }}
      >
        {/* ---- Drawer Header: Avatar Pic IN LINE with Name, Phone/No BELOW Name, Click to open Profile Popup ---- */}
        <div
          onClick={() => {
            setSidebarOpen(false);
            if (isLoggedIn) {
              setProfileModalOpen(true);
            } else {
              setAuthModalOpen(true);
            }
          }}
          style={{
            height: '62px',
            boxSizing: 'border-box',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 12px',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
            color: '#FFFFFF',
            position: 'relative',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          {/* Avatar Picture (In line with Name) */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255, 255, 255, 0.5)',
              flexShrink: 0,
            }}
          >
            <UserCircle size={24} color="#FFFFFF" />
          </div>

          {/* Account Details: Name with Phone/Email below name */}
          <div style={{ flex: 1, minWidth: 0, paddingRight: '28px' }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: '13.5px',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {isLoggedIn ? currentUser.name : 'Guest Customer'}
            </div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                opacity: 0.9,
                marginTop: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {isLoggedIn
                ? (currentUser.phone || currentUser.email || 'Click to view profile')
                : 'Click to Sign In / Register'}
            </div>
          </div>

          {/* Close Button vertically centered matching header line */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(false);
            }}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Close menu"
          >
            <X size={15} />
          </button>
        </div>

        {/* ---- Drawer Body: Navigation Options ---- */}
        <div style={{ flex: 1, padding: '10px 0', display: 'flex', flexDirection: 'column' }}>
          {/* Section: Orders */}
          <div style={{ padding: '6px 18px 4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Orders & Menu
            </span>
          </div>

          {/* Order Now (Menu) */}
          <SidebarItem
            icon={<ShoppingCart size={19} />}
            label="Order Menu"
            isActive={currentView === 'menu'}
            onClick={() => handleSidebarNav('menu')}
          />

          {/* Active Orders / Tracking */}
          <SidebarItem
            icon={<ClipboardList size={19} />}
            label="Track My Order"
            isActive={currentView === 'order-tracking'}
            onClick={() => handleSidebarNav('order-tracking')}
          />

          {/* Order History */}
          <SidebarItem
            icon={<History size={19} />}
            label="Order History"
            isActive={currentView === 'order-history'}
            onClick={() => handleSidebarNav('order-history')}
          />

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 18px' }} />

          {/* Section: Account & Alerts */}
          <div style={{ padding: '6px 18px 4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Alerts & Info
            </span>
          </div>

          {/* Notifications: opens notification preferences page */}
          <SidebarItem
            icon={<Bell size={19} />}
            label="Notifications"
            badge={unreadNotificationsCount > 0 ? String(unreadNotificationsCount) : undefined}
            isActive={currentView === 'notifications' || currentView === 'profile'}
            onClick={() => handleSidebarNav('notifications')}
          />

          {/* Store Locator */}
          <SidebarItem
            icon={<MapPinned size={19} />}
            label="Store Locator"
            subtitle="View Map & Nearest Branch"
            onClick={() => {
              setSidebarOpen(false);
              setStoreMapModalOpen(true);
            }}
          />
        </div>

        {/* ---- Drawer Footer: Contact Us (Pinned at bottom, drawer is unscrollable) ---- */}
        <div
          style={{
            marginTop: 'auto',
            padding: '12px 14px 16px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card-subtle)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setContactModalOpen(true);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '13px',
              fontWeight: 850,
              cursor: 'pointer',
              boxShadow: '0 2px 10px var(--primary-glow)',
              transition: 'all 0.15s ease',
            }}
          >
            <PhoneCall size={15} />
            <span>Contact Us</span>
          </button>
        </div>

      </div>

      {/* ============ CONTACT US POPUP MODAL ============ */}
      {contactModalOpen && (
        <div
          onClick={() => setContactModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 12, 10, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeInOverlay 0.2s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '24px',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
              maxWidth: '460px',
              width: '100%',
              maxHeight: '90vh',
              padding: '22px 24px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(217, 101, 40, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                  }}
                >
                  <PhoneCall size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
                    Contact Us
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                    Cashier Desk Helpline & Official Branch Locations
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* 0. Recent Cancelled Order Alert */}
            {recentCancelledOrder && (() => {
              const cancelAttr = getCancellationAttribution(recentCancelledOrder);
              return (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '14px',
                    backgroundColor: '#FEF2F2',
                    border: '1.5px solid #FCA5A5',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 800, fontSize: '13px' }}>
                    <AlertTriangle size={15} />
                    <span>
                      Recent Order #{recentCancelledOrder.orderNumber}:{' '}
                      {cancelAttr.isCustomer
                        ? 'Cancelled by You'
                        : cancelAttr.badge === 'CANCELLED (BRANCH CLOSED)'
                          ? 'CANCELLED (Branch Closed Offline)'
                          : 'Cancelled by Staff'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#7F1D1D', lineHeight: 1.45 }}>
                    {cancelAttr.isCustomer
                      ? 'You cancelled this order. View your Order History for full receipts and records.'
                      : cancelAttr.badge === 'CANCELLED (BRANCH CLOSED)'
                        ? 'This order was cancelled prior to receipt because the branch closed offline. If paid, your refund is being processed. Contact the cashier desk below for instant assistance.'
                        : 'This order was cancelled prior to receipt by cafe staff. If paid, your refund is being processed. Contact the cashier desk below for instant assistance.'}
                  </div>
                </div>
              );
            })()}

            {/* 1. Cashier Desk Helpline Card */}
            <div
              style={{
                backgroundColor: 'rgba(217, 101, 40, 0.06)',
                border: '1.5px solid rgba(217, 101, 40, 0.25)',
                borderRadius: '16px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 850, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cashier Desk Helpline 📞
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'Outfit, sans-serif' }}>
                    +92 42 3575 8899
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    UAN Helpline: +92 42 111-FOODIES • Daily 11:00 AM – 1:00 AM
                  </div>
                </div>
                <a
                  href="tel:+924235758899"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    textDecoration: 'none',
                    boxShadow: '0 2px 8px var(--primary-glow)',
                  }}
                >
                  <Phone size={13} />
                  <span>Call Now</span>
                </a>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px dashed rgba(217, 101, 40, 0.25)', paddingTop: '6px', marginTop: '2px' }}>
                ✉️ Support Email: <strong style={{ color: 'var(--text-main)' }}>support@foodiescafe.pk</strong>
              </div>
            </div>

            {/* 2. Official Branches with City Names & Locations */}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Official Branches & Locations
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Lahore */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1.2px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} color="var(--primary)" />
                      <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>Gulberg Branch (Lahore)</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.3 }}>
                      Mian Mehmood Ali Kasoori Road, Gulberg III, Lahore
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📞 +92 42 3575 8899
                    </div>
                  </div>
                  <a
                    href="tel:+924235758899"
                    style={{
                      flexShrink: 0,
                      padding: '7px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1.2px solid var(--primary)',
                      color: 'var(--primary)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    Call
                  </a>
                </div>

                {/* Islamabad */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1.2px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} color="var(--primary)" />
                      <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>F-7 Branch (Islamabad)</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.3 }}>
                      College Road, F-7 Markaz, Jinnah Super, Islamabad
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📞 +92 51 265 4433
                    </div>
                  </div>
                  <a
                    href="tel:+92512654433"
                    style={{
                      flexShrink: 0,
                      padding: '7px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1.2px solid var(--primary)',
                      color: 'var(--primary)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    Call
                  </a>
                </div>

                {/* Karachi */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1.2px solid var(--border-color)',
                    borderRadius: '14px',
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={14} color="var(--primary)" />
                      <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>Clifton Branch (Karachi)</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.3 }}>
                      26th Street, Tauheed Commercial, Clifton Block 4, Karachi
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📞 +92 21 3583 2211
                    </div>
                  </div>
                  <a
                    href="tel:+922135832211"
                    style={{
                      flexShrink: 0,
                      padding: '7px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1.2px solid var(--primary)',
                      color: 'var(--primary)',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      textDecoration: 'none',
                    }}
                  >
                    Call
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ PROFILE POPUP SCREEN MODAL ============ */}
      {/* Appears when someone clicks on name/no in left slide (shows ONLY profile info, editable name & phone/email, sign out at last row) */}
      {profileModalOpen && (
        <div
          onClick={() => setProfileModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 12, 10, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            animation: 'fadeInOverlay 0.2s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '24px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
              maxWidth: '430px',
              width: '100%',
              maxHeight: 'min(520px, 94vh)',
              padding: 'clamp(14px, 3.5vw, 24px)',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 'clamp(8px, 1.8vw, 14px)',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, paddingBottom: '4px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                Profile
              </h3>

              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
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

            {/* Editable Profile Information Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const updated = {
                  ...currentUser,
                  name: editName.trim() || currentUser.name,
                  phone: editPhone.trim() || currentUser.phone,
                  email: editEmail.trim() || currentUser.email,
                };
                setCurrentUser(updated);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('foodies_customer_user', JSON.stringify(updated));
                }
                addToast({
                  type: 'success',
                  title: 'Profile Updated! ✓',
                  message: 'Your personal information has been saved successfully.',
                });
                setProfileModalOpen(false);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.8vw, 12px)', flex: 1, overflow: 'hidden' }}
            >
              {/* Full Name (Editable) */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                  Full Name
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <User size={15} color="var(--primary)" style={{ position: 'absolute', left: '10px' }} />
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Shahwaiz Akram"
                    style={{
                      width: '100%',
                      padding: 'clamp(7px, 1.5vw, 9px) 12px clamp(7px, 1.5vw, 9px) 32px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 'clamp(12px, 2.5vw, 13px)',
                      fontWeight: 650,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Phone Number (Editable) */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                  Phone Number
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Phone size={15} color="var(--primary)" style={{ position: 'absolute', left: '10px' }} />
                  <input
                    type="tel"
                    required
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="0300 1234567"
                    style={{
                      width: '100%',
                      padding: 'clamp(7px, 1.5vw, 9px) 12px clamp(7px, 1.5vw, 9px) 32px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 'clamp(12px, 2.5vw, 13px)',
                      fontWeight: 650,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Email Address (Editable) */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={15} color="var(--primary)" style={{ position: 'absolute', left: '10px' }} />
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="customer@foodiescafe.pk"
                    style={{
                      width: '100%',
                      padding: 'clamp(7px, 1.5vw, 9px) 12px clamp(7px, 1.5vw, 9px) 32px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-main)',
                      fontSize: 'clamp(12px, 2.5vw, 13px)',
                      fontWeight: 650,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Save Profile Button */}
              <button
                type="submit"
                style={{
                  marginTop: '2px',
                  padding: 'clamp(8px, 1.8vw, 11px)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 850,
                  fontSize: 'clamp(12px, 2.6vw, 13.5px)',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px var(--primary-glow)',
                  transition: 'transform 0.15s ease',
                  flexShrink: 0,
                }}
              >
                Save Changes
              </button>
            </form>

            {/* Manager & Owner Branch Location Quick Action inside Profile */}
            {(currentUser.role === 'platform_owner' || currentUser.role === 'branch_manager') && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(124, 58, 237, 0.06)',
                  border: '1px solid rgba(124, 58, 237, 0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  marginTop: '2px',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(124, 58, 237, 0.12)',
                      color: '#7C3AED',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MapPin size={15} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#7C3AED', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      Branch Location Access
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {currentUser.role === 'platform_owner' ? 'Edit GPS across all branches' : 'Edit branch GPS & address'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProfileModalOpen(false);
                    setStoreMapStartInEdit(true);
                    setStoreMapModalOpen(true);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#7C3AED',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 850,
                    fontSize: '11px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
                    flexShrink: 0,
                  }}
                >
                  <Edit size={11} />
                  <span>Edit Location 📍</span>
                </button>
              </div>
            )}

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '2px 0', flexShrink: 0 }} />

            {/* Sign Out at the LAST ROW of profile view modal per user requirement */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: 'clamp(8px, 1.8vw, 10px)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(197, 34, 31, 0.08)',
                border: '1px solid rgba(197, 34, 31, 0.25)',
                color: '#C5221F',
                fontWeight: 850,
                fontSize: 'clamp(12px, 2.5vw, 13px)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* ============ CUSTOMER LOGIN MODAL (Email Verification Code) ============ */}
      <CustomerLoginModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => onNavigate?.('home')}
      />

      {/* Store Map Modal Pop-up */}
      <StoreMapModal
        isOpen={storeMapModalOpen}
        onClose={() => {
          setStoreMapModalOpen(false);
          setStoreMapStartInEdit(false);
        }}
        startInEditMode={storeMapStartInEdit}
        initialEditingBranchId={currentBranchId}
      />

      {/* Real-Time Notification Center Modal */}
      <NotificationCenterModal />

      {/* Animation keyframes */}
      <style jsx>{`
        @keyframes cartPopupSlideIn {
          from {
            opacity: 0;
            transform: translateX(60px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cartBouncePulse {
          0% { transform: scale(1); }
          30% { transform: scale(1.18); }
          60% { transform: scale(0.94); }
          85% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        .cart-bounce-pulse {
          animation: cartBouncePulse 0.38s ease-out;
        }
      `}</style>
    </>
  );
};

/* ============ SIDEBAR ITEM COMPONENT ============ */
interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  badge?: string;
  isActive?: boolean;
  destructive?: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  subtitle,
  badge,
  isActive,
  destructive,
  onClick,
}) => (
  <button
    onClick={onClick}
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '9px 12px',
      backgroundColor: isActive ? 'var(--primary-light)' : 'transparent',
      border: 'none',
      color: destructive ? '#C5221F' : isActive ? 'var(--primary)' : 'var(--text-main)',
      cursor: 'pointer',
      transition: 'background-color 0.12s ease',
      textAlign: 'left',
    }}
  >
    <div
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        backgroundColor: destructive
          ? 'rgba(197,34,31,0.08)'
          : isActive
            ? 'var(--primary-light)'
            : 'var(--bg-card-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: destructive ? '#C5221F' : isActive ? 'var(--primary)' : 'var(--text-secondary)',
      }}
    >
      {icon}
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '13px', fontWeight: 750, lineHeight: 1.2 }}>{label}</div>
      {subtitle && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '1px' }}>
          {subtitle}
        </div>
      )}
    </div>

    {badge && (
      <span
        style={{
          minWidth: '22px',
          height: '22px',
          borderRadius: '11px',
          backgroundColor: 'var(--primary)',
          color: '#FFFFFF',
          fontSize: '11px',
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 6px',
        }}
      >
        {badge}
      </span>
    )}

    <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
  </button>
);
