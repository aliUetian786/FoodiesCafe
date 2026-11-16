'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ToastContainer } from '@/components/common/ToastContainer';

// Staff & Management Frontend Components (Isolated in src/staff/)
import { StaffAuth } from '@/staff/StaffAuth';
import { StaffLayout } from '@/staff/StaffLayout';
import { KitchenQueueScreen } from '@/staff/KitchenQueue';
import { CashierScreen } from '@/staff/CashierDesk';
import { CashierOrdersScreen } from '@/staff/CashierOrders';
import { FloorTablesScreen } from '@/staff/FloorTables';
import { BranchManagerScreen } from '@/staff/BranchManagerDashboard';
import { BranchStaffManagementScreen } from '@/staff/BranchStaffManagement';
import { OwnerOverviewScreen } from '@/staff/OwnerOverview';
import { BranchesStaffScreen } from '@/staff/BranchesAndStaff';
import { MenuPricesScreen } from '@/staff/MenuAndPrices';
import { ReportsScreen } from '@/staff/ReportsAndReconciliation';
import { AuditLogScreen } from '@/staff/AuditLogView';
import { CustomersOrdersScreen } from '@/staff/CustomersAndOrders';
import { AnnouncementsBoardScreen } from '@/staff/AnnouncementsBoard';
import { Smartphone } from 'lucide-react';
import { useHasMounted } from '@/lib/useHasMounted';
import { AppBootSplash } from '@/components/common/AppBootSplash';

function getFirstViewForRole(role: string): string {
  switch (role) {
    case 'platform_owner':
      return 'mgmt-overview';
    case 'branch_manager':
      return 'staff-manager';
    case 'kitchen_staff':
      return 'staff-kitchen';
    case 'cashier':
      return 'staff-cashier';
    case 'floor_staff':
      return 'staff-floor-server';
    default:
      return 'staff-kitchen';
  }
}

function StaffPortalMainPageInner() {
  const { currentRole, setCurrentRole, currentUser, setCurrentUser } = useApp();

  // Staff session max duration: 4-8 hours (8 hours = 8 * 60 * 60 * 1000 ms)
  const STAFF_SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

  // Whenever entering staff portal or logging in:
  // ALWAYS open the first option for that staff profile, never the last open option
  const [currentView, setCurrentView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('foodies_staff_user');
      const savedRole = localStorage.getItem('foodies_staff_role');
      const savedLoginTime = localStorage.getItem('foodies_staff_login_time');

      // Check if session has expired (> 8 hours)
      const isExpired = savedLoginTime ? (Date.now() - Number(savedLoginTime) > STAFF_SESSION_MAX_AGE_MS) : false;
      if (isExpired) {
        localStorage.removeItem('foodies_staff_view');
        localStorage.removeItem('foodies_staff_user');
        localStorage.removeItem('foodies_staff_role');
        localStorage.removeItem('foodies_staff_login_time');
        return 'staff-auth';
      }

      // If there is an authenticated staff session, start strictly on the first option of that profile
      if (savedUser && savedRole && savedRole !== 'customer') {
        localStorage.removeItem('foodies_staff_view');
        return getFirstViewForRole(savedRole);
      }
    }
    return 'staff-auth';
  });

  // Verify and re-hydrate staff session on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedStaffUser = localStorage.getItem('foodies_staff_user');
    const savedStaffRole = localStorage.getItem('foodies_staff_role');
    const savedLoginTime = localStorage.getItem('foodies_staff_login_time');

    // Check if session has expired (> 8 hours)
    const isExpired = savedLoginTime ? (Date.now() - Number(savedLoginTime) > STAFF_SESSION_MAX_AGE_MS) : false;
    if (isExpired) {
      localStorage.removeItem('foodies_staff_view');
      localStorage.removeItem('foodies_staff_user');
      localStorage.removeItem('foodies_staff_role');
      localStorage.removeItem('foodies_staff_login_time');
      handleNavigate('staff-auth');
      return;
    }

    if (savedStaffUser && savedStaffRole && savedStaffRole !== 'customer') {
      try {
        const parsed = JSON.parse(savedStaffUser);
        if (parsed && parsed.role && parsed.role !== 'customer') {
          if (currentUser.id !== parsed.id || currentUser.role !== parsed.role) {
            setCurrentUser(parsed);
          }
          if (currentRole !== parsed.role) {
            setCurrentRole(parsed.role as any);
          }
          return;
        }
      } catch (e) {}
    }

    // If no valid staff session exists and view is not staff-auth, redirect to login
    if (currentView !== 'staff-auth') {
      handleNavigate('staff-auth');
    }
  }, []);

  // Whenever any staff member logs in to any staff ID, signs up, or switches profile:
  // strictly enforce opening the first option for each profile rather than the last previous option
  const lastStaffSessionRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (currentUser && currentUser.role && currentUser.role !== 'customer' && currentUser.id !== 'user-guest') {
      const effectiveRole = currentRole || currentUser.role;
      const sessionKey = `${currentUser.id}_${effectiveRole}`;
      if (lastStaffSessionRef.current !== sessionKey) {
        // Staff account changed, fresh login, or profile switched -> always open first option
        const firstView = getFirstViewForRole(effectiveRole);
        handleNavigate(firstView);
      }
      lastStaffSessionRef.current = sessionKey;
    } else {
      lastStaffSessionRef.current = null;
    }
  }, [currentUser?.id, currentUser?.role, currentRole]);

  const handleNavigate = (view: string) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      if (view === 'staff-auth') {
        localStorage.removeItem('foodies_staff_view');
        localStorage.removeItem('foodies_staff_user');
        localStorage.removeItem('foodies_staff_role');
        localStorage.removeItem('foodies_staff_login_time');
      } else {
        // Clear any stored last view so future logins/sessions always start at first option
        localStorage.removeItem('foodies_staff_view');
      }
    }
  };

  // Staff screens router
  const renderStaffContent = () => {
    switch (currentView) {
      // Staff Operations
      case 'staff-kitchen':
        return <KitchenQueueScreen key={currentView} />;
      case 'staff-cashier':
        return <CashierScreen key={currentView} />;
      case 'staff-cashier-tables':
        return <FloorTablesScreen key={currentView} initialView="tables" />;
      case 'staff-cashier-orders':
        return <CashierOrdersScreen key={currentView} />;
      case 'staff-cashier-history':
      case 'staff-orders':
        return <CustomersOrdersScreen key={currentView} isBranchOrders={true} title="Orders" />;
      case 'staff-floor':
        return <FloorTablesScreen key={currentView} initialView="tables" />;
      case 'staff-floor-server':
        return <FloorTablesScreen key={currentView} initialView="server_orders" />;
      case 'staff-floor-orders':
        return <CashierOrdersScreen key={currentView} isFloorStaff={true} />;
      case 'staff-rider':
      case 'staff-rider-route':
      case 'staff-rider-history':
        return (
          <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', margin: '20px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Smartphone size={32} color="#2563EB" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 8px' }}>
              Rider Profile is Mobile App Exclusive 📱
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto 20px', lineHeight: 1.5 }}>
              Delivery orders, GPS turn-by-turn navigation, and cash collections are operated exclusively through the Foodies Mobile Application.
            </p>
          </div>
        );
      case 'staff-manager':
        return <BranchManagerScreen key={currentView} onNavigate={handleNavigate} />;
      case 'staff-manager-accounts':
        return <BranchStaffManagementScreen key={currentView} />;

      // Owner & Central Management
      case 'mgmt-overview':
        return <OwnerOverviewScreen key={currentView} onNavigate={handleNavigate} />;
      case 'mgmt-branches':
        return <BranchesStaffScreen key={currentView} />;
      case 'mgmt-menu':
        return <MenuPricesScreen key={currentView} />;
      case 'mgmt-reports':
        return <ReportsScreen key={currentView} />;
      case 'mgmt-audit':
        return <AuditLogScreen key={currentView} />;
      case 'mgmt-announcements':
        return <AnnouncementsBoardScreen key={currentView} />;
      case 'mgmt-customers':
      case 'mgmt-customers-pending':
        return (
          <CustomersOrdersScreen
            key={currentView}
            initialStatus={currentView.includes('pending') ? 'pending' : 'all'}
          />
        );

      default:
        return <KitchenQueueScreen key={currentView} />;
    }
  };

  // 1. Staff Authentication Portal (Login & Register for Staff only)
  if (currentView === 'staff-auth') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <StaffAuth
          onSuccess={(role) => {
            const firstView = getFirstViewForRole(role);
            handleNavigate(firstView);
          }}
        />
        <ToastContainer />
      </div>
    );
  }

  const isManager = currentRole === 'branch_manager';

  // 2. Staff Operations & Management Workspace
  return (
    <div
      style={{
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <StaffLayout currentView={currentView} onNavigate={handleNavigate}>
        {renderStaffContent()}
      </StaffLayout>

      {/* Global Toast Alerts */}
      <ToastContainer />
    </div>
  );
}

/** Deterministic first paint: see useHasMounted for why the app renders only after mount. */
export default function StaffPortalMainPage() {
  const mounted = useHasMounted();
  if (!mounted) return <AppBootSplash label="Opening staff operations…" />;
  return <StaffPortalMainPageInner />;
}
