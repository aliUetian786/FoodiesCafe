'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Sun,
  Moon,
  ShoppingBag,
  Bell,
  MapPin,
  ChevronDown,
  User as UserIcon,
  LogIn,
  UserPlus,
  ShieldAlert,
  Menu as MenuIcon,
  X,
} from 'lucide-react';

interface CustomerHeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenCart?: () => void;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  currentView,
  onNavigate,
  onOpenCart,
}) => {
  const {
    theme,
    toggleTheme,
    branches,
    currentBranchId,
    setCurrentBranchId,
    cart,
    currentRole,
    setCurrentRole,
    currentUser,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);
  const activeBranch = branches.find((b) => b.id === currentBranchId) || branches[0];

  const handleAuthClick = (mode: 'login' | 'register') => {
    onNavigate(`auth-${mode}`);
  };

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        {/* Left: Brand Logo & Title */}
        <div
          onClick={() => onNavigate('home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
              padding: '2px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <img
              src="/logo.png"
              alt="Foodies Cafe Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontWeight: 800,
                  fontSize: '20px',
                  color: 'var(--text-main)',
                  letterSpacing: '-0.02em',
                }}
              >
                Foodies<span style={{ color: 'var(--primary)' }}>Cafe</span>
              </span>
            </div>
            <div
              style={{
                fontSize: '10.5px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Eat Fresh & Healthy
            </div>
          </div>
        </div>

        {/* Center: Branch Selector & Marketing Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Branch Selector Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 12px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <MapPin size={15} color="var(--primary)" />
              <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeBranch.city}: {activeBranch.name.split(' ')[0]}
              </span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>

            {branchDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  left: 0,
                  width: '260px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '8px',
                  zIndex: 2000,
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 8px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Select Cafe Branch
                </div>
                {branches.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      setCurrentBranchId(b.id);
                      setBranchDropdownOpen(false);
                    }}
                    style={{
                      padding: '10px',
                      borderRadius: '8px',
                      backgroundColor: b.id === currentBranchId ? 'var(--primary-light)' : 'transparent',
                      color: b.id === currentBranchId ? 'var(--primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      marginBottom: '4px',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{b.name}</span>
                      {b.isBusy && (
                        <span style={{ fontSize: '10px', color: '#D97706', fontWeight: 800 }}>BUSY</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{b.city} · {b.openingHours}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desktop Nav Links */}
          <nav
            style={{
              display: 'none',
              gap: '18px',
              fontSize: '13.5px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
            className="desktop-nav"
          >
            <span
              onClick={() => onNavigate('home')}
              style={{
                cursor: 'pointer',
                color: currentView === 'home' ? 'var(--primary)' : 'inherit',
              }}
            >
              Home
            </span>
            <span
              onClick={() => onNavigate('menu')}
              style={{
                cursor: 'pointer',
                color: currentView === 'menu' ? 'var(--primary)' : 'inherit',
              }}
            >
              Order Menu
            </span>
            <span
              onClick={() => onNavigate('table-qr')}
              style={{
                cursor: 'pointer',
                color: currentView === 'table-qr' ? 'var(--primary)' : 'inherit',
              }}
            >
              Scan Table QR
            </span>
            <span
              onClick={() => onNavigate('branches')}
              style={{
                cursor: 'pointer',
                color: currentView === 'branches' ? 'var(--primary)' : 'inherit',
              }}
            >
              Branches
            </span>
            <span
              onClick={() => onNavigate('about')}
              style={{
                cursor: 'pointer',
                color: currentView === 'about' ? 'var(--primary)' : 'inherit',
              }}
            >
              About Cafe
            </span>
            <span
              onClick={() => onNavigate('support')}
              style={{
                cursor: 'pointer',
                color: currentView === 'support' ? 'var(--primary)' : 'inherit',
              }}
            >
              Help & Support
            </span>
          </nav>
        </div>

        {/* Right Action Icons & Auth Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} theme`}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} color="#FBBF24" />}
          </button>

          {/* Notifications Bell */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Bell size={18} />
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontSize: '10px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                2
              </span>
            </button>

            {notificationsOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: '300px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-xl)',
                  padding: '12px',
                  zIndex: 2000,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '8px', color: 'var(--text-main)' }}>
                  Active Order Notifications
                </div>
                <div
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                    fontSize: '12px',
                    marginBottom: '6px',
                    lineHeight: 1.4,
                  }}
                >
                  ✨ <strong>Welcome to Foodies Cafe:</strong> Explore chef specials and enjoy express dine-in, takeaway, and doorstep delivery!
                </div>
                <div
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    lineHeight: 1.4,
                  }}
                >
                  ✅ <strong>Support Ticket:</strong> Rep Zara Noor answered your inquiry regarding Table T-03.
                </div>
              </div>
            )}
          </div>

          {/* Cart Icon */}
          <button
            onClick={onOpenCart}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: cartCount > 0 ? 'var(--primary)' : 'var(--bg-card-subtle)',
              color: cartCount > 0 ? '#FFFFFF' : 'var(--text-main)',
              border: '1px solid var(--border-color)',
              fontWeight: 700,
              fontSize: '13px',
              boxShadow: cartCount > 0 ? '0 4px 14px var(--primary-glow)' : 'none',
            }}
          >
            <ShoppingBag size={17} />
            <span>Cart</span>
            {cartCount > 0 && (
              <span
                style={{
                  backgroundColor: '#FFFFFF',
                  color: 'var(--primary)',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '1px 7px',
                  borderRadius: '10px',
                  marginLeft: '2px',
                }}
              >
                {cartCount}
              </span>
            )}
          </button>

          {/* Top Bar Auth Buttons: Sign Up & Login */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handleAuthClick('login')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 13px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <LogIn size={15} />
              <span>Login</span>
            </button>
            <button
              onClick={() => handleAuthClick('register')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 700,
                boxShadow: '0 3px 10px var(--primary-glow)',
              }}
            >
              <UserPlus size={15} />
              <span>Sign Up</span>
            </button>
          </div>

          {/* Quick Role & Portal Switcher (for testing all 22 screens easily) */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              style={{
                padding: '7px 10px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--status-accepted-bg)',
                color: 'var(--status-accepted-text)',
                border: '1px solid var(--status-accepted-text)',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Switch role / View dashboard"
            >
              <ShieldAlert size={14} />
              <span style={{ textTransform: 'capitalize' }}>
                Role: {currentRole.replace('_', ' ')}
              </span>
              <ChevronDown size={12} />
            </button>

            {roleDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: '240px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-xl)',
                  padding: '8px',
                  zIndex: 2500,
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '6px 8px', fontWeight: 700, textTransform: 'uppercase' }}>
                  Select View Role
                </div>
                {[
                  { role: 'customer', label: 'Customer (11 Pages)', view: 'home' },
                  { role: 'kitchen_staff', label: 'Kitchen Queue', view: 'staff-kitchen' },
                  { role: 'cashier', label: 'Cashier / Order Desk', view: 'staff-cashier' },
                  { role: 'floor_staff', label: 'Floor / Tables Grid', view: 'staff-floor' },
                  { role: 'branch_representative', label: 'Complaints & Support', view: 'staff-rep' },
                  { role: 'branch_manager', label: 'Branch Manager', view: 'staff-manager' },
                  { role: 'platform_owner', label: 'Management / Owner', view: 'mgmt-overview' },
                ].map((item) => (
                  <div
                    key={item.role}
                    onClick={() => {
                      setCurrentRole(item.role as any);
                      onNavigate(item.view);
                      setRoleDropdownOpen(false);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: currentRole === item.role ? 'var(--primary-light)' : 'transparent',
                      color: currentRole === item.role ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '2px',
                    }}
                  >
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (min-width: 900px) {
          .desktop-nav {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
};
