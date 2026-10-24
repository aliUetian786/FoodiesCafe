'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  Banknote,
  LayoutGrid,
  MessageSquare,
  BarChart3,
  Building2,
  Users,
  UtensilsCrossed,
  FileSpreadsheet,
  FileClock,
  UserCheck,
  LogOut,
  MapPin,
  ExternalLink,
} from 'lucide-react';

interface StaffLayoutProps {
  currentView: string;
  onNavigate: (view: string) => void;
  children: React.ReactNode;
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({
  currentView,
  onNavigate,
  children,
}) => {
  const {
    theme,
    toggleTheme,
    currentRole,
    setCurrentRole,
    currentUser,
    currentBranch,
  } = useApp();

  const [collapsed, setCollapsed] = useState(false);

  // Define sidebar menu items based on current role
  const getNavItems = () => {
    if (currentRole === 'platform_owner') {
      return [
        { id: 'mgmt-overview', label: 'Owner Overview', icon: BarChart3 },
        { id: 'mgmt-branches', label: 'Branches & Staff', icon: Building2 },
        { id: 'mgmt-menu', label: 'Menu & Prices', icon: UtensilsCrossed },
        { id: 'mgmt-reports', label: 'Financial & Cash Reports', icon: FileSpreadsheet },
        { id: 'mgmt-audit', label: 'Audit Log', icon: FileClock },
        { id: 'mgmt-customers', label: 'Customers & Orders', icon: UserCheck },
      ];
    }

    if (currentRole === 'branch_manager') {
      return [
        { id: 'staff-manager', label: 'Manager Overview', icon: BarChart3 },
        { id: 'staff-kitchen', label: 'Kitchen Monitor', icon: ChefHat },
        { id: 'staff-cashier', label: 'Cash Desk Monitor', icon: Banknote },
        { id: 'staff-floor', label: 'Floor & Table Grid', icon: LayoutGrid },
        { id: 'staff-rep', label: 'Complaints & Support', icon: MessageSquare },
      ];
    }

    if (currentRole === 'kitchen_staff') {
      return [{ id: 'staff-kitchen', label: 'Kitchen Queue', icon: ChefHat }];
    }

    if (currentRole === 'cashier') {
      return [{ id: 'staff-cashier', label: 'Cashier & Shifts', icon: Banknote }];
    }

    if (currentRole === 'floor_staff') {
      return [{ id: 'staff-floor', label: 'Floor Tables Grid', icon: LayoutGrid }];
    }

    if (currentRole === 'branch_representative') {
      return [{ id: 'staff-rep', label: 'Support & Queries', icon: MessageSquare }];
    }

    return [{ id: 'staff-kitchen', label: 'Operations Dashboard', icon: ChefHat }];
  };

  const navItems = getNavItems();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Collapsible Left Sidebar */}
      <aside
        style={{
          width: collapsed ? '72px' : '260px',
          backgroundColor: 'var(--bg-card)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s ease',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 100,
        }}
      >
        {/* Sidebar Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#FFFFFF',
                  padding: '2px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  Foodies<span style={{ color: 'var(--primary)' }}>Staff</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>OPERATIONS HUB</div>
              </div>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              padding: '6px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              margin: collapsed ? '0 auto' : '0',
            }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav style={{ padding: '12px 8px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: active ? 'var(--primary)' : 'transparent',
                  color: active ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: active ? 700 : 600,
                  fontSize: '13.5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <Icon size={18} color={active ? '#FFFFFF' : 'var(--text-secondary)'} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Return to Customer App */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={() => {
              setCurrentRole('customer');
              onNavigate('home');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card-subtle)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <ExternalLink size={16} color="var(--primary)" />
            {!collapsed && <span>Customer Website</span>}
          </button>
        </div>
      </aside>

      {/* Main Staff Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Staff Top Bar */}
        <header
          style={{
            height: '60px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 90,
          }}
        >
          {/* Branch & Mode Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 700 }}>
              <MapPin size={16} color="var(--primary)" />
              <span>{currentBranch.name}</span>
            </div>

            {currentBranch.isBusy && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  backgroundColor: 'var(--status-preparing-bg)',
                  color: 'var(--status-preparing-text)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                BUSY MODE ACTIVE
              </span>
            )}
          </div>

          {/* User Profile & Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Role Badge */}
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                letterSpacing: '0.05em',
              }}
            >
              {currentRole.replace('_', ' ')}
            </span>

            {/* User Name */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
              {currentUser.name}
            </div>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} color="#FBBF24" />}
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
};
