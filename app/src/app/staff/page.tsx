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
import { RepresentativeScreen } from '@/staff/RepresentativeInbox';
import { BranchManagerScreen } from '@/staff/BranchManagerDashboard';
import { BranchStaffManagementScreen } from '@/staff/BranchStaffManagement';
import { OwnerOverviewScreen } from '@/staff/OwnerOverview';
import { BranchesStaffScreen } from '@/staff/BranchesAndStaff';
import { MenuPricesScreen } from '@/staff/MenuAndPrices';
import { ReportsScreen } from '@/staff/ReportsAndReconciliation';
import { AuditLogScreen } from '@/staff/AuditLogView';
import { CustomersOrdersScreen } from '@/staff/CustomersAndOrders';
import { RiderDashboardScreen } from '@/staff/RiderDashboard';

export default function StaffPortalMainPage() {
  const { currentRole, setCurrentRole } = useApp();

  // Restore staff view from localStorage on refresh so data & screen do not go away
  const [currentView, setCurrentView] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('foodies_staff_view');
      if (saved && saved !== 'staff-auth') return saved;
    }
    return 'staff-auth';
  });

  const handleNavigate = (view: string) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      if (view === 'staff-auth') {
        localStorage.removeItem('foodies_staff_view');
      } else {
        localStorage.setItem('foodies_staff_view', view);
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
      case 'staff-cashier-orders':
        return <CashierOrdersScreen key={currentView} />;
      case 'staff-floor':
        return <FloorTablesScreen key={currentView} />;
      case 'staff-floor-orders':
        return <CashierOrdersScreen key={currentView} isFloorStaff={true} />;
      case 'staff-rep':
        return <RepresentativeScreen key="staff-rep" initialTab="support" />;
      case 'staff-rep-dinein':
        return <RepresentativeScreen key="staff-rep-dinein" initialTab="dine_in" />;
      case 'staff-rep-takeaway':
        return <RepresentativeScreen key="staff-rep-takeaway" initialTab="takeaway" />;
      case 'staff-rep-delivery':
        return <RepresentativeScreen key="staff-rep-delivery" initialTab="delivery" />;
      case 'staff-rider':
        return <RiderDashboardScreen key={currentView} initialTab="active" />;
      case 'staff-rider-history':
        return <RiderDashboardScreen key={currentView} initialTab="history" />;
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
      case 'mgmt-customers':
        return <CustomersOrdersScreen key={currentView} />;

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
            let nextView = 'staff-kitchen';
            if (role === 'platform_owner') {
              nextView = 'mgmt-overview';
            } else if (role === 'branch_manager') {
              nextView = 'staff-manager';
            } else if (role === 'delivery_staff') {
              nextView = 'staff-rider';
            } else if (role === 'cashier') {
              nextView = 'staff-cashier';
            } else if (role === 'floor_staff') {
              nextView = 'staff-floor';
            } else if (role === 'branch_representative') {
              nextView = 'staff-rep';
            }
            handleNavigate(nextView);
          }}
        />
        <ToastContainer />
      </div>
    );
  }

  const isManager = currentRole === 'branch_manager';
  const isStaticWorkspace =
    !isManager &&
    (currentView === 'staff-rep' ||
      currentView === 'staff-rep-dinein' ||
      currentView === 'staff-rep-takeaway' ||
      currentView === 'staff-rep-delivery');

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
