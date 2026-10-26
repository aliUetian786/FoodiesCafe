'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { ToastContainer } from '@/components/common/ToastContainer';
import { Flame } from 'lucide-react';

// Customer Frontend Components (Strictly isolated in src/customer/)
import { CustomerHeader } from '@/customer/CustomerHeader';
import { CustomerCheckout } from '@/customer/CustomerCheckout';
import { MarketingHome } from '@/customer/MarketingHome';
import { CustomerMenu } from '@/customer/CustomerMenu';
import { TableSelectionScreen as CustomerTableQR } from '@/customer/CustomerTableQR';
import { OrderTrackingScreen as CustomerTracking } from '@/customer/CustomerTracking';
import { EditOrderScreen as CustomerOrderEdit } from '@/customer/CustomerOrderEdit';
import { OrderHistoryScreen as CustomerHistory } from '@/customer/CustomerHistory';
import { SupportScreen as CustomerSupport } from '@/customer/CustomerSupport';
import { ProfileScreen as CustomerProfile } from '@/customer/CustomerProfile';

export default function CustomerMainPage() {
  const { currentUser } = useApp();

  // Customer web defaults to home page on refresh, or directly to table-qr when table QR code is scanned
  const [currentView, setCurrentView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tableQr') || params.get('table')) {
        return 'table-qr';
      }
    }
    return 'home';
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutInitialStep, setCheckoutInitialStep] = useState<'order_review' | 'auth' | 'fulfillment'>('order_review');
  const [orderNowHover, setOrderNowHover] = useState(false);

  // When clicking Cart in header: review order items first
  const handleOpenCart = () => {
    setCheckoutInitialStep('order_review');
    setCartOpen(true);
  };

  // When clicking Proceed to Checkout from menu card: show login if guest, otherwise delivery options
  const handleProceedToCheckout = () => {
    let isLoggedIn = Boolean(
      currentUser &&
      currentUser.name &&
      currentUser.name !== 'Guest Customer' &&
      currentUser.role === 'customer'
    );
    if (!isLoggedIn && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('foodies_customer_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.name && parsed.name !== 'Guest Customer' && parsed.role === 'customer') {
            isLoggedIn = true;
          }
        }
      } catch (e) {}
    }
    setCheckoutInitialStep(isLoggedIn ? 'fulfillment' : 'auth');
    setCartOpen(true);
  };

  // Auto-route to table-qr if tableQr or table query param is present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tableQr') || params.get('table')) {
        setCurrentView('table-qr');
      }
    }
  }, []);

  // Scroll to top on navigation and remove stale view persistence
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('foodies_customer_view');
      window.scrollTo(0, 0);
    }
  }, [currentView]);

  // Customer screens router
  const renderCustomerContent = () => {
    switch (currentView) {
      case 'home':
        return <MarketingHome onNavigate={setCurrentView} onOpenItemModal={() => setCurrentView('menu')} />;
      case 'menu':
        return (
          <CustomerMenu
            onNavigate={setCurrentView}
            onOpenCart={handleOpenCart}
            onProceedToCheckout={handleProceedToCheckout}
          />
        );
      case 'table-qr':
        return <CustomerTableQR onNavigate={setCurrentView} />;
      case 'order-tracking':
        return <CustomerTracking onNavigate={setCurrentView} />;
      case 'order-edit':
        return <CustomerOrderEdit onNavigate={setCurrentView} />;
      case 'order-history':
        return <CustomerHistory onNavigate={setCurrentView} />;
      case 'support':
        return <CustomerSupport onNavigate={setCurrentView} />;
      case 'notifications':
      case 'profile':
        return <CustomerProfile onNavigate={setCurrentView} />;
      default:
        return <MarketingHome onNavigate={setCurrentView} />;
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        height: currentView === 'support' ? '100vh' : undefined,
        maxHeight: currentView === 'support' ? '100vh' : undefined,
        overflow: currentView === 'support' ? 'hidden' : undefined,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-main)',
        overflowX: 'clip',
        width: '100%',
        maxWidth: '100vw',
      }}
    >
      {/* Customer Header: Hamburger + Branch + Cart (cleaned up) */}
      <CustomerHeader
        currentView={currentView}
        onNavigate={setCurrentView}
        onOpenCart={handleOpenCart}
      />

      {/* Main Customer View with Page Transition */}
      <main
        key={currentView}
        className="foodies-customer-page-view"
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '100vw',
          overflowX: 'clip',
          paddingTop: '72px',
          height: currentView === 'support' ? 'calc(100vh - 72px)' : undefined,
          maxHeight: currentView === 'support' ? 'calc(100vh - 72px)' : undefined,
          overflowY: currentView === 'support' ? 'hidden' : undefined,
          display: currentView === 'support' ? 'flex' : undefined,
          flexDirection: currentView === 'support' ? 'column' : undefined,
          boxSizing: 'border-box',
          animation: 'customerPageTransition 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {renderCustomerContent()}
      </main>

      {/* Floating "Order Now" Button — ONLY on Home Page (like Cheezious) */}
      {currentView === 'home' && (
        <button
          onClick={() => setCurrentView('menu')}
          onMouseEnter={() => setOrderNowHover(true)}
          onMouseLeave={() => setOrderNowHover(false)}
          className="floating-order-now-btn"
          style={{
            position: 'fixed',
            bottom: '28px',
            right: '28px',
            zIndex: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '16px 28px',
            borderRadius: '9999px',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            border: 'none',
            fontWeight: 900,
            fontSize: '16px',
            fontFamily: 'Outfit, sans-serif',
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            boxShadow: orderNowHover
              ? '0 10px 32px rgba(224, 122, 95, 0.45), 0 0 0 4px rgba(224, 122, 95, 0.15)'
              : '0 8px 28px rgba(224, 122, 95, 0.35)',
            transform: orderNowHover ? 'scale(1.06)' : 'scale(1)',
            transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
            animation: 'floatOrderBtn 3s ease-in-out infinite',
          }}
        >
          <Flame size={22} />
          <span>Order Now</span>
        </button>
      )}

      {/* Customer Checkout Drawer (With phone number recording & recommended add-ons) */}
      <CustomerCheckout
        isOpen={cartOpen}
        initialStep={checkoutInitialStep}
        onClose={() => setCartOpen(false)}
        onNavigate={setCurrentView}
      />

      {/* Global Toast Alerts */}
      <ToastContainer />

      {/* Floating button animation and responsive styling */}
      <style jsx>{`
        @keyframes customerPageTransition {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes floatOrderBtn {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }

        @media (max-width: 600px) {
          .floating-order-now-btn {
            bottom: 20px !important;
            right: 16px !important;
            padding: 12px 20px !important;
            font-size: 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
