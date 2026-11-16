'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Role } from '@/types/cafe';
import {
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  Banknote,
  LayoutGrid,
  BarChart3,
  Building2,
  Users,
  UtensilsCrossed,
  Utensils,
  FileSpreadsheet,
  FileClock,
  UserCheck,
  LogOut,
  MapPin,
  ShoppingBag,
  Bike,
  Navigation,
  Clock,
  User,
  Edit,
  X,
  Menu,
  Mail,
  KeyRound,
  CheckCircle2,
  Send,
  ExternalLink,
  Sparkles,
  Bell,
  Megaphone,
} from 'lucide-react';
import { StoreMapModal } from '../customer/StoreMapModal';
import { BranchShutdownModal } from '../components/common/BranchShutdownModal';
import { NotificationCenterModal } from '../components/common/NotificationCenterModal';
import { BranchScheduleEditor } from '@/staff/BranchScheduleEditor';

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
    currentRole,
    setCurrentRole,
    currentUser,
    setCurrentUser,
    currentBranch,
    allowRepresentativeMenuEdit,
    orders,
    refundRequests,
    pendingApprovalRequests,
    users,
    addToast,
    shutdownModalState,
    closeShutdownModal,
    confirmShutdownKeepProcessing,
    confirmShutdownCancelOrders,
    unreadNotificationsCount,
    openNotificationModal,
  } = useApp();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [staffProfileModalOpen, setStaffProfileModalOpen] = useState(false);
  const [staffStoreMapModalOpen, setStaffStoreMapModalOpen] = useState(false);
  const [staffStoreMapInEdit, setStaffStoreMapInEdit] = useState(false);

  // Close mobile sidebar on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Automated Mailer Configuration State (Owner & Manager Only)
  const [staffMailConfigOpen, setStaffMailConfigOpen] = useState(false);
  const [mailServerConfig, setMailServerConfig] = useState<{ isConfigured: boolean; accountPreview: string | null } | null>(null);
  const [mailInputUser, setMailInputUser] = useState('');
  const [mailInputKey, setMailInputKey] = useState('');
  const [mailSaveLoading, setMailSaveLoading] = useState(false);
  const [mailTestEmail, setMailTestEmail] = useState('');
  const [mailTestLoading, setMailTestLoading] = useState(false);
  const [mailTestResult, setMailTestResult] = useState<{ success: boolean; message: string } | null>(null);

  React.useEffect(() => {
    if (staffProfileModalOpen || staffMailConfigOpen) {
      fetch('/api/auth/email')
        .then((r) => r.json())
        .then((d) => setMailServerConfig({ isConfigured: !!d.isConfigured, accountPreview: d.accountPreview }))
        .catch(() => {});
    }
  }, [staffProfileModalOpen, staffMailConfigOpen]);

  // Determine effective staff role, prioritizing currentRole, then currentUser.role, then foodies_staff_role
  const effectiveRole: Role = (() => {
    if (typeof window !== 'undefined') {
      const savedLoginTime = localStorage.getItem('foodies_staff_login_time');
      // 8-hour shift max session duration
      if (savedLoginTime && Date.now() - Number(savedLoginTime) > 8 * 60 * 60 * 1000) {
        localStorage.removeItem('foodies_staff_user');
        localStorage.removeItem('foodies_staff_role');
        localStorage.removeItem('foodies_staff_view');
        localStorage.removeItem('foodies_staff_login_time');
        return 'customer' as Role;
      }
    }
    if (currentRole && currentRole !== 'customer') return currentRole;
    if (currentUser?.role && currentUser.role !== 'customer') return currentUser.role;
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem('foodies_staff_role');
      if (savedRole && savedRole !== 'customer') return savedRole as Role;
      const savedUser = localStorage.getItem('foodies_staff_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.role && parsed.role !== 'customer') return parsed.role as Role;
        } catch (e) {}
      }
    }
    return 'branch_manager';
  })();

  // Keep state currentRole aligned with effectiveRole
  React.useEffect(() => {
    if (currentRole !== effectiveRole && effectiveRole !== 'customer') {
      setCurrentRole(effectiveRole);
    }
  }, [currentRole, effectiveRole, setCurrentRole]);

  const isManagerOrOwner =
    effectiveRole === 'branch_manager' ||
    effectiveRole === 'platform_owner' ||
    currentUser?.role === 'branch_manager' ||
    currentUser?.role === 'platform_owner';

  // Subordinates under this branch manager
  const subordinateRoles = ['cashier', 'kitchen_staff', 'floor_staff', 'delivery_staff'];
  const branchSubordinates = (users || []).filter(
    (u) => (!u.branchId || u.branchId === currentBranch.id) && subordinateRoles.includes(u.role)
  );
  const suspendedStaffCount = branchSubordinates.filter((u) => u.status === 'suspended').length;

  const handleStaffSignOut = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('foodies_staff_user');
      localStorage.removeItem('foodies_staff_role');
      localStorage.removeItem('foodies_staff_view');
      localStorage.removeItem('foodies_staff_login_time');
    }
    setCurrentRole('customer');
    setCurrentUser({
      id: 'user-guest',
      name: 'Guest Customer',
      phone: '',
      email: '',
      role: 'customer',
      status: 'active',
    });
    setMobileSidebarOpen(false);
    onNavigate('staff-auth');
  };

  // Active session revocation: if current staff user is suspended, deactivated, or edited, auto-handle
  React.useEffect(() => {
    // Guard: ignore if customer or guest
    if (!currentUser || currentUser.role === 'customer' || currentUser.name === 'Guest Customer') {
      return;
    }
    // Only Platform Owner cannot be auto-revoked by themselves
    if (currentUser.role === 'platform_owner') {
      return;
    }
    const freshUser = (users || []).find(
      (u) =>
        u.id === currentUser.id ||
        (u.email && currentUser.email && u.email.toLowerCase() === currentUser.email.toLowerCase())
    );
    if (!freshUser) {
      addToast({
        type: 'error',
        title: 'Session Terminated 🚫',
        message: 'Your staff account was removed by management. You have been logged out.',
      });
      handleStaffSignOut();
    } else if (freshUser.status !== 'active') {
      addToast({
        type: 'error',
        title: `Account Access Revoked (${freshUser.status.toUpperCase()}) 🚫`,
        message: `Your staff account has been ${freshUser.status.toUpperCase()} by management. Access is revoked immediately.`,
      });
      handleStaffSignOut();
    } else {
      // If active staff details (role, branch, name) were updated by the Owner
      if (
        freshUser.name !== currentUser.name ||
        freshUser.role !== currentUser.role ||
        freshUser.branchId !== currentUser.branchId ||
        freshUser.phone !== currentUser.phone
      ) {
        setCurrentUser({ ...currentUser, ...freshUser });
        if (freshUser.role !== currentUser.role) {
          setCurrentRole(freshUser.role);
          if (typeof window !== 'undefined') {
            localStorage.setItem('foodies_staff_role', freshUser.role);
            localStorage.setItem('foodies_staff_user', JSON.stringify({ ...currentUser, ...freshUser }));
          }
          addToast({
            type: 'info',
            title: 'Role Updated ℹ️',
            message: `Your account role was updated to ${freshUser.role.replace('_', ' ')}.`,
          });
        }
      }
    }
  }, [users, currentUser, onNavigate, setCurrentUser, addToast]);

  // Compute pending actions requiring manager attention
  const pendingRefundCount = refundRequests.filter(
    (r) => r.status === 'requested' && (!r.branchId || r.branchId === currentBranch.id)
  ).length;

  const pendingBannerApprovalCount = (pendingApprovalRequests || []).filter(
    (r) => r.status === 'pending'
  ).length;

  // Track seen incoming order IDs per order type page so badge shows count only for new incoming orders when page has not been opened
  const [seenIncomingOrderIds, setSeenIncomingOrderIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('foodies_rep_seen_order_ids');
        if (stored) return new Set(JSON.parse(stored));
      } catch {}
    }
    return new Set<string>();
  });

  // Whenever an order type view is active (opened), mark all current incoming orders of that type as seen
  useEffect(() => {
    let targetType: 'dine_in' | 'takeaway' | 'delivery' | null = null;
    if (currentView === 'staff-rep-dinein') targetType = 'dine_in';
    else if (currentView === 'staff-rep-takeaway') targetType = 'takeaway';
    else if (currentView === 'staff-rep-delivery') targetType = 'delivery';

    if (targetType) {
      setSeenIncomingOrderIds((prev) => {
        let hasNewSeen = false;
        const next = new Set(prev);
        orders.forEach((o) => {
          if (o.type === targetType && (o.status === 'placed' || o.status === 'accepted') && !next.has(o.id)) {
            next.add(o.id);
            hasNewSeen = true;
          }
        });
        if (hasNewSeen) {
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.setItem('foodies_rep_seen_order_ids', JSON.stringify(Array.from(next)));
            } catch {}
          }
          return next;
        }
        return prev;
      });
    }
  }, [currentView, orders]);

  // Compute new incoming orders that have not been opened yet for slide options
  const { newIncomingDineInCount, newIncomingTakeawayCount, newIncomingDeliveryCount } = useMemo(() => {
    let newDineIn = 0;
    let newTakeaway = 0;
    let newDelivery = 0;
    const branchId = currentBranch.id;

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (o.branchId && o.branchId !== branchId) continue;
      const isNewIncoming = o.status === 'placed' || o.status === 'accepted';
      if (!isNewIncoming) continue;

      if (!seenIncomingOrderIds.has(o.id)) {
        if (o.type === 'dine_in') {
          if (currentView !== 'staff-rep-dinein') newDineIn++;
        } else if (o.type === 'takeaway') {
          if (currentView !== 'staff-rep-takeaway') newTakeaway++;
        } else if (o.type === 'delivery') {
          if (currentView !== 'staff-rep-delivery') newDelivery++;
        }
      }
    }

    return {
      newIncomingDineInCount: newDineIn,
      newIncomingTakeawayCount: newTakeaway,
      newIncomingDeliveryCount: newDelivery,
    };
  }, [orders, currentBranch.id, seenIncomingOrderIds, currentView]);

  // Memoized live ready and active counts for branch (High-performance single pass)
  const { activeDineInCount, activeTakeawayCount, readyTakeawayCount, activeDeliveryCount, readyDeliveryCount } = useMemo(() => {
    let dineIn = 0;
    let takeawayActive = 0;
    let takeawayReady = 0;
    let deliveryActive = 0;
    let deliveryReady = 0;
    const branchId = currentBranch.id;

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (o.branchId && o.branchId !== branchId) continue;
      const isNotFinished = o.status !== 'completed' && o.status !== 'cancelled';

      if (o.type === 'dine_in' && isNotFinished) dineIn++;
      else if (o.type === 'takeaway') {
        if (isNotFinished) takeawayActive++;
        if (o.status === 'ready') takeawayReady++;
      } else if (o.type === 'delivery') {
        if (isNotFinished) deliveryActive++;
        if (o.status === 'ready' || o.status === 'out_for_delivery') deliveryReady++;
      }
    }

    return {
      activeDineInCount: dineIn,
      activeTakeawayCount: takeawayActive,
      readyTakeawayCount: takeawayReady,
      activeDeliveryCount: deliveryActive,
      readyDeliveryCount: deliveryReady,
    };
  }, [orders, currentBranch.id]);


  // Define sidebar menu items based on current role (Memoized for zero-lag navigation)
  const navItems = useMemo(() => {
    if (effectiveRole === 'platform_owner') {
      return [
        { id: 'mgmt-overview', label: 'Owner Overview', icon: BarChart3 },
        { id: 'mgmt-branches', label: 'Branches & Staff', icon: Building2 },
        { id: 'mgmt-menu', label: 'Menu & Prices', icon: UtensilsCrossed },
        { id: 'mgmt-reports', label: 'Financial & Cash Reports', icon: FileSpreadsheet },
        { id: 'mgmt-audit', label: 'Audit Log', icon: FileClock },
        { id: 'mgmt-customers', label: 'Customer Orders', icon: ShoppingBag },
        { id: 'mgmt-announcements', label: 'Announcements', icon: Megaphone },
      ];
    }

    if (effectiveRole === 'branch_manager') {
      return [
        {
          id: 'staff-manager',
          label: 'Overview',
          icon: BarChart3,
          canEdit: true,
        },
        {
          id: 'staff-manager-accounts',
          label: 'Staff Accounts',
          icon: Users,
          badge: branchSubordinates.length > 0 ? `${branchSubordinates.length} Staff` : undefined,
          actionRequired: suspendedStaffCount > 0 ? `${suspendedStaffCount}` : undefined,
          canEdit: true,
        },
        {
          id: 'mgmt-menu',
          label: 'Menu, Categories & Customer Services',
          icon: UtensilsCrossed,
          actionRequired: pendingBannerApprovalCount > 0 ? `${pendingBannerApprovalCount}` : undefined,
          canEdit: true,
        },
        {
          id: 'staff-cashier',
          label: 'Cash Desk Monitor',
          icon: Banknote,
          actionRequired: pendingRefundCount > 0 ? `${pendingRefundCount}` : undefined,
          canEdit: false,
        },
        {
          id: 'staff-floor',
          label: 'Waiter & Floor',
          icon: LayoutGrid,
          canEdit: false,
        },
        {
          id: 'staff-orders',
          label: 'Orders',
          icon: ShoppingBag,
          canEdit: false,
        },
        {
          id: 'mgmt-announcements',
          label: 'Announcements',
          icon: Megaphone,
          canEdit: true,
        },
      ];
    }

    if (effectiveRole === 'kitchen_staff') {
      return [{ id: 'staff-kitchen', label: 'Kitchen Queue', icon: ChefHat }];
    }

    if (effectiveRole === 'cashier') {
      const activeBranchOrdersCount = orders.filter((o) => {
        if (o.branchId && o.branchId !== currentBranch.id) return false;
        return o.status !== 'completed' && o.status !== 'cancelled';
      }).length;

      return [
        {
          id: 'staff-cashier',
          label: 'Cashier Desk',
          icon: Banknote,
        },
        {
          id: 'staff-cashier-orders',
          label: 'Orders Hub',
          icon: ShoppingBag,
          badge: activeBranchOrdersCount > 0 ? `${activeBranchOrdersCount}` : undefined,
        },
        {
          id: 'staff-cashier-history',
          label: 'Orders History',
          icon: FileClock,
        },
        { id: 'mgmt-menu', label: 'Menu & Prices', icon: UtensilsCrossed },
      ];
    }

    if (effectiveRole === 'floor_staff') {
      const floorOrdersCount = orders.filter((o) => {
        if (o.branchId && o.branchId !== currentBranch.id) return false;
        if (o.type !== 'dine_in') return false;
        const isFloorOrder =
          o.cashierId === currentUser.id ||
          o.customerId === currentUser.id ||
          o.isWalkIn === true ||
          !!o.tableNumber ||
          (o.notes && o.notes.toLowerCase().includes('walk-in')) ||
          (o.pickupTime && o.pickupTime.toLowerCase().includes('walk-in'));
        return isFloorOrder && o.status !== 'completed' && o.status !== 'cancelled';
      }).length;

      const serverOrdersCount = orders.filter((o) => {
        if (o.branchId && o.branchId !== currentBranch.id) return false;
        if (o.type !== 'dine_in') return false;
        return o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready' || o.status === 'served';
      }).length;

      return [
        {
          id: 'staff-floor-server',
          label: 'Order',
          icon: Bell,
          badge: serverOrdersCount > 0 ? `${serverOrdersCount}` : undefined,
        },
        { id: 'staff-floor', label: 'Floor Tables Grid', icon: LayoutGrid },
      ];
    }

    return [{ id: 'staff-kitchen', label: 'Operations Dashboard', icon: ChefHat }];
  }, [
    effectiveRole,
    orders,
    currentBranch.id,
    currentUser.id,
    activeTakeawayCount,
    readyTakeawayCount,
    activeDeliveryCount,
    readyDeliveryCount,
    activeDineInCount,
    newIncomingDineInCount,
    newIncomingTakeawayCount,
    newIncomingDeliveryCount,
  ]);

  return (
    <div
      className="staff-layout-root"
      style={{
        display: 'flex',
        minHeight: '100vh',
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-main)',
      }}
    >
      {/* ============ MOBILE LEFT SLIDE DRAWER (FOR SMALL SCREENS) ============ */}
      {/* Backdrop overlay */}
      <div
        onClick={() => setMobileSidebarOpen(false)}
        className="staff-mobile-drawer-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          backgroundColor: 'rgba(15, 12, 10, 0.55)',
          backdropFilter: 'blur(4px)',
          opacity: mobileSidebarOpen ? 1 : 0,
          pointerEvents: mobileSidebarOpen ? 'auto' : 'none',
          transition: 'opacity 0.28s cubic-bezier(0.2, 0.8, 0.25, 1)',
        }}
      />

      {/* Drawer Panel: smooth slide in from left and slide out to left */}
      <div
        className="staff-mobile-drawer-panel"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '230px',
          maxWidth: '65vw',
          backgroundColor: 'var(--bg-card)',
          zIndex: 10001,
          transform: mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.32s ease',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: mobileSidebarOpen ? '6px 0 36px rgba(0, 0, 0, 0.22)' : 'none',
          overflow: 'hidden',
        }}
      >
        {/* Drawer Header: Avatar / Staff info + Close Button X */}
        <div
          style={{
            height: '62px',
            boxSizing: 'border-box',
            borderBottom: '1px solid var(--border-color)',
            padding: '0 12px',
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
            color: '#FFFFFF',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          {/* Avatar Picture */}
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(255, 255, 255, 0.5)',
              flexShrink: 0,
            }}
          >
            <User size={18} color="#FFFFFF" />
          </div>

          {/* Account Details: Staff Name and Role */}
          <div style={{ flex: 1, minWidth: 0, paddingRight: '24px' }}>
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
              {(currentUser?.name || 'Staff Member').replace(/\s*\(.*?\)/g, '').trim()}
            </div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                opacity: 0.9,
                marginTop: '2px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {effectiveRole.replace(/_/g, ' ')} · {currentBranch.name.replace(' Branch', '')}
            </div>
          </div>

          {/* Close Button X */}
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
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

        {/* Section title */}
        <div style={{ padding: '14px 18px 6px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 850, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Staff Operations
          </span>
        </div>

        {/* Drawer Body: Navigation items */}
        <nav
          style={{
            flex: 1,
            padding: '4px 8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            overflowY: 'auto',
          }}
        >
          {navItems.map((item: any) => {
            const Icon = item.icon;
            const active = currentView === item.id || (item.id === 'mgmt-customers' && currentView.startsWith('mgmt-customers'));

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  setMobileSidebarOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: '9px 11px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: active ? 'var(--primary)' : item.actionRequired ? 'rgba(234, 88, 12, 0.08)' : 'var(--bg-card-subtle)',
                  color: active ? '#FFFFFF' : item.actionRequired ? 'var(--text-main)' : 'var(--text-main)',
                  fontWeight: active ? 800 : 650,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  border: active
                    ? '1px solid var(--primary)'
                    : item.actionRequired
                    ? '1.5px solid #EA580C'
                    : '1px solid var(--border-color)',
                  textAlign: 'left',
                  width: '100%',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Icon size={17} color={active ? '#FFFFFF' : item.actionRequired ? '#EA580C' : 'var(--text-main)'} />
                  {item.hasDot && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-3px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#DC2626',
                        border: '1.5px solid #FFFFFF',
                      }}
                    />
                  )}
                </div>

                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: '6px', minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>

                  {item.actionRequired ? (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 900,
                        padding: '1px 7px',
                        borderRadius: '10px',
                        background: active ? '#FFFFFF' : 'linear-gradient(135deg, #DC2626, #EA580C)',
                        color: active ? '#DC2626' : '#FFFFFF',
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '18px',
                        height: '18px',
                      }}
                    >
                      {item.actionRequired}
                    </span>
                  ) : item.badge ? (
                    <span
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: '10px',
                        backgroundColor: active ? '#FFFFFF' : 'var(--primary)',
                        color: active ? 'var(--primary)' : '#FFFFFF',
                        flexShrink: 0,
                      }}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Drawer Footer: Staff Sign Out */}
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
          <button
            type="button"
            onClick={handleStaffSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: '100%',
              padding: '8px 10px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              justifyContent: 'flex-start',
            }}
          >
            <LogOut size={15} color="var(--primary)" />
            <span>Staff Sign Out</span>
          </button>
        </div>
      </div>

      {/* Collapsible Left Sidebar (Desktop Only) */}
      <aside
        className="staff-desktop-sidebar"
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
        {/* Sidebar Header - Aligned to 60px Main Staff Header */}
        <div
          style={{
            height: '60px',
            boxSizing: 'border-box',
            padding: '0 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
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
          <style>{`
            @keyframes pulseActionReq {
              0%, 100% {
                transform: scale(1);
                box-shadow: 0 0 0 0 rgba(234, 88, 12, 0.7);
              }
              50% {
                transform: scale(1.04);
                box-shadow: 0 0 10px 3px rgba(234, 88, 12, 0.5);
              }
            }
          `}</style>


          {navItems.map((item: any, idx: number) => {
            const Icon = item.icon;
            const active = currentView === item.id || (item.id === 'mgmt-customers' && currentView.startsWith('mgmt-customers'));
            const isManager = currentRole === 'branch_manager';
            const canEdit = !isManager || item.canEdit !== false;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? `${item.label}${item.actionRequired ? ' - ⚠️ IMPORTANT ACTION REQUIRED' : ''}` : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: active ? 'var(--primary)' : item.actionRequired ? 'rgba(234, 88, 12, 0.06)' : 'transparent',
                  color: active ? '#FFFFFF' : item.actionRequired ? 'var(--text-main)' : 'var(--text-secondary)',
                  fontWeight: active ? 750 : 600,
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  position: 'relative',
                  border: active
                    ? '1px solid var(--primary)'
                    : item.actionRequired
                    ? '1.5px solid #EA580C'
                    : '1px solid transparent',
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Icon size={18} color={active ? '#FFFFFF' : item.actionRequired ? '#EA580C' : 'var(--text-secondary)'} />
                  {/* Pop up dot for option 4 or collapsed alert */}
                  {(item.hasDot || (collapsed && item.actionRequired)) && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-3px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#DC2626',
                        border: '1.5px solid #FFFFFF',
                        boxShadow: '0 0 0 2px rgba(220, 38, 38, 0.35)',
                        animation: 'pulseActionReq 1.8s infinite ease-in-out',
                      }}
                    />
                  )}
                </div>

                {!collapsed && (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, gap: '6px', minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span>{item.label}</span>
                      {isManager && !canEdit && (
                        <span
                          style={{
                            fontSize: '9.5px',
                            color: active ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)',
                            fontWeight: 600,
                          }}
                        >
                          (View)
                        </span>
                      )}
                    </span>

                    {/* Pop-up Sign for Important Action Required */}
                    {item.actionRequired ? (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 900,
                          padding: '1px 7px',
                          borderRadius: '10px',
                          background: active ? '#FFFFFF' : 'linear-gradient(135deg, #DC2626, #EA580C)',
                          color: active ? '#DC2626' : '#FFFFFF',
                          marginLeft: 'auto',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: active ? 'none' : '0 2px 8px rgba(234, 88, 12, 0.4)',
                          animation: 'pulseActionReq 1.8s infinite ease-in-out',
                          minWidth: '18px',
                          height: '18px',
                          flexShrink: 0,
                        }}
                        title="Pending Actions"
                      >
                        <span>{item.actionRequired}</span>
                      </span>
                    ) : item.badge ? (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '10px',
                          backgroundColor: active ? '#FFFFFF' : 'var(--primary)',
                          color: active ? 'var(--primary)' : '#FFFFFF',
                          marginLeft: 'auto',
                          flexShrink: 0,
                        }}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Staff Sign Out */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={handleStaffSignOut}
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
            <LogOut size={16} color="var(--primary)" />
            {!collapsed && <span>Staff Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Staff Container */}
      <div
        className="staff-layout-main-wrapper"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* Staff Top Bar */}
        <header
          className="staff-header-inner"
          style={{
            height: '60px',
            flexShrink: 0,
            boxSizing: 'border-box',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* 3 Horizontal Lines (Hamburger Menu) Button - Mobile Only */}
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="staff-mobile-menu-btn"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              aria-label="Open staff navigation menu"
            >
              <Menu size={20} strokeWidth={2.4} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 700 }}>
              <MapPin size={16} color="var(--primary)" />
              <span className="staff-header-branch-name">{currentBranch.name}</span>
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
                  whiteSpace: 'nowrap',
                }}
              >
                BUSY
              </span>
            )}
          </div>

          {/* User Profile (Status / Role before clean person's name at the very end of header) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {((currentUser?.role === 'platform_owner' || currentUser?.id === 'user-owner' || currentUser?.name?.includes('Jahangir')) && effectiveRole === 'branch_manager') && (
              <button
                onClick={() => {
                  setCurrentRole('platform_owner');
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('foodies_staff_role', 'platform_owner');
                  }
                  onNavigate('mgmt-overview');
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary)',
                  fontWeight: 750,
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>👑 Return to Owner Console</span>
              </button>
            )}

            {/* Single Notification Bell Button for all Staff */}
            <button
              type="button"
              onClick={() => openNotificationModal('inbox')}
              title="Open Notifications & Alerts"
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 11px',
                borderRadius: '8px',
                backgroundColor: unreadNotificationsCount > 0 ? '#FFF7ED' : 'var(--bg-card-subtle)',
                border: unreadNotificationsCount > 0 ? '1px solid #FDBA74' : '1px solid var(--border-color)',
                color: unreadNotificationsCount > 0 ? '#C2410C' : 'var(--text-main)',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              <Bell size={14} />
              <span className="staff-alerts-label">Alerts</span>
              {unreadNotificationsCount > 0 && (
                <span
                  style={{
                    minWidth: '18px',
                    height: '18px',
                    borderRadius: '9px',
                    backgroundColor: '#EA580C',
                    color: '#FFFFFF',
                    fontSize: '10px',
                    fontWeight: 900,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Quick Action: Edit Branch Location (Owner & Manager) */}
            {isManagerOrOwner && (
              <button
                type="button"
                onClick={() => {
                  setStaffStoreMapInEdit(true);
                  setStaffStoreMapModalOpen(true);
                }}
                title="Edit Branch Location & GPS"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(124, 58, 237, 0.08)',
                  border: '1px solid rgba(124, 58, 237, 0.25)',
                  color: '#7C3AED',
                  fontWeight: 750,
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <MapPin size={13} />
                <span className="staff-edit-branch-text">Edit Branch Location 📍</span>
              </button>
            )}

            {/* Interactive User Profile Trigger */}
            <button
              type="button"
              onClick={() => setStaffProfileModalOpen(true)}
              title="Click to view & edit your profile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-subtle)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {/* Status / Role Badge */}
              <span
                className="staff-role-badge"
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  letterSpacing: '0.04em',
                  border: '1px solid rgba(224, 122, 95, 0.25)',
                }}
              >
                {effectiveRole.replace(/_/g, ' ')}
              </span>

              {/* Person's Name without any brackets at the end of header */}
              <div className="staff-header-name" style={{ fontSize: '13.5px', fontWeight: 750, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                {(currentUser?.name || 'Staff Member').replace(/\s*\(.*?\)/g, '').trim()}
              </div>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content: Placed directly below the 60px header */}
        {(() => {
          const isManager = currentRole === 'branch_manager';

          return (
            <main
              className="staff-main-content"
              style={{
                flex: 1,
                padding: isManager ? '20px 24px' : '24px',
                overflowY: 'auto',
                overflowX: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 60px)',
                maxHeight: 'calc(100vh - 60px)',
                minHeight: 0,
                boxSizing: 'border-box',
                position: 'relative',
              }}
            >
              {children}
            </main>
          );
        })()}
      </div>

      {/* ============ STAFF PROFILE MODAL ============ */}
      {staffProfileModalOpen && (
        <div
          onClick={() => setStaffProfileModalOpen(false)}
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
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '24px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28)',
              maxWidth: '430px',
              width: '100%',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxSizing: 'border-box',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '4px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                Staff Profile
              </h3>

              <button
                type="button"
                onClick={() => setStaffProfileModalOpen(false)}
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
                <X size={15} />
              </button>
            </div>

            {/* Profile Information Summary */}
            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>Staff Name</span>
                <span style={{ fontSize: '13px', fontWeight: 850, color: 'var(--text-main)' }}>
                  {(currentUser?.name || 'Staff Member').replace(/\s*\(.*?\)/g, '').trim()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>System Role</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--primary-light)',
                    color: 'var(--primary)',
                  }}
                >
                  {currentRole.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>Active Branch</span>
                <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  {currentBranch.name} ({currentBranch.city})
                </span>
              </div>
              {currentUser?.phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 700 }}>Phone</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {currentUser.phone}
                  </span>
                </div>
              )}
            </div>

            {/* Branch opening schedule (manager: own branch, owner: all branches) */}
            <BranchScheduleEditor />

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setStaffProfileModalOpen(false)}
              style={{
                width: '100%',
                padding: '9px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontWeight: 750,
                fontSize: '12.5px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ============ STAFF AUTOMATED MAILER CONFIG MODAL ============ */}
      {staffMailConfigOpen && (
        <div
          onClick={() => setStaffMailConfigOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10050,
            backgroundColor: 'rgba(0,0,0,0.65)',
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
              backgroundColor: '#FFFFFF',
              borderRadius: '22px',
              border: '1.5px solid var(--border-color)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>
                Mailer Setup
              </h3>
              <button
                onClick={() => setStaffMailConfigOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Configure the cafe&apos;s central mail account once here. <strong>Customers will never need to enter keys</strong>; they simply enter their email and automatically receive verification codes!
            </div>

            {/* Quick 3-step banner */}
            <div
              style={{
                backgroundColor: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '11.5px',
                color: '#9A3412',
                lineHeight: 1.5,
              }}
            >
              <strong>Quick Gmail Setup (Takes 30 seconds):</strong><br/>
              1. Turn on 2-Step Verification on your Google account.<br/>
              2. Open{' '}
              <a
                href="https://myaccount.google.com/apppasswords"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#EA580C', fontWeight: 800, textDecoration: 'underline' }}
              >
                myaccount.google.com/apppasswords <ExternalLink size={10} style={{ display: 'inline' }} />
              </a>.<br/>
              3. Name it <strong>FoodiesCafe</strong> &rarr; click <strong>Create</strong> &rarr; copy the 16-letter code.
            </div>

            {/* Credentials Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Sender Email Account:
                </label>
                <input
                  type="email"
                  value={mailInputUser}
                  onChange={(e) => setMailInputUser(e.target.value)}
                  placeholder="e.g. foodiescafe.pk@gmail.com"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  16-Letter App Password / Key:
                </label>
                <input
                  type="password"
                  value={mailInputKey}
                  onChange={(e) => setMailInputKey(e.target.value)}
                  placeholder="abcd efgh ijkl mnop"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    letterSpacing: '1px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Live Delivery Test */}
            <div style={{ padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>
                Test Dispatch to Any Email:
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  value={mailTestEmail}
                  onChange={(e) => setMailTestEmail(e.target.value)}
                  placeholder="Recipient email to test..."
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px',
                    backgroundColor: '#FFFFFF',
                  }}
                />
                <button
                  type="button"
                  disabled={mailTestLoading}
                  onClick={async () => {
                    if (!mailTestEmail || !mailTestEmail.includes('@')) {
                      addToast({ type: 'warning', title: 'Email Required', message: 'Enter a valid recipient email to test.' });
                      return;
                    }
                    setMailTestLoading(true);
                    setMailTestResult(null);
                    try {
                      const res = await fetch('/api/auth/email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'test_account',
                          email: mailTestEmail.trim(),
                          clientMailConfig: mailInputUser && mailInputKey ? {
                            accountEmail: mailInputUser.trim(),
                            accountApiKey: mailInputKey.trim(),
                          } : undefined,
                        }),
                      });
                      const d = await res.json();
                      if (!res.ok) {
                        setMailTestResult({ success: false, message: d.error || 'Failed to send test email.' });
                      } else {
                        setMailTestResult({ success: true, message: d.message || 'Test email delivered!' });
                        addToast({ type: 'success', title: 'Test Delivered! ✉️', message: d.message });
                      }
                    } catch (e: any) {
                      setMailTestResult({ success: false, message: e.message || 'Network error.' });
                    } finally {
                      setMailTestLoading(false);
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#1E293B',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: mailTestLoading ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Send size={11} />
                  <span>{mailTestLoading ? 'Testing...' : 'Test Send'}</span>
                </button>
              </div>

              {mailTestResult && (
                <div
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    backgroundColor: mailTestResult.success ? '#F0FDF4' : '#FEF2F2',
                    border: `1px solid ${mailTestResult.success ? '#BBF7D0' : '#FECACA'}`,
                    color: mailTestResult.success ? '#166534' : '#991B1B',
                  }}
                >
                  {mailTestResult.message}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setStaffMailConfigOpen(false)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                type="button"
                disabled={mailSaveLoading}
                onClick={async () => {
                  if (!mailInputUser || !mailInputKey) {
                    addToast({
                      type: 'warning',
                      title: 'Credentials Required',
                      message: 'Please enter both your email address and 16-character App Password.',
                    });
                    return;
                  }
                  setMailSaveLoading(true);
                  try {
                    const res = await fetch('/api/auth/email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'save_server_config',
                        accountEmail: mailInputUser.trim(),
                        accountApiKey: mailInputKey.trim(),
                      }),
                    });
                    const d = await res.json();
                    if (!res.ok) {
                      throw new Error(d.error || 'Failed to save server credentials.');
                    }
                    addToast({
                      type: 'success',
                      title: 'Automated Mailer Activated! ✉️',
                      message: d.message,
                    });
                    setMailServerConfig({ isConfigured: true, accountPreview: mailInputUser });
                    setStaffMailConfigOpen(false);
                  } catch (err: any) {
                    addToast({
                      type: 'error',
                      title: 'Activation Failed',
                      message: err.message || 'Could not verify or save credentials.',
                    });
                  } finally {
                    setMailSaveLoading(false);
                  }
                }}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#EA580C',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: mailSaveLoading ? 'wait' : 'pointer',
                  boxShadow: '0 3px 12px rgba(234, 88, 12, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={14} />
                <span>{mailSaveLoading ? 'Verifying & Activating...' : 'Save & Activate for Customers'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ STORE MAP MODAL FOR STAFF CONSOLE ============ */}
      <StoreMapModal
        isOpen={staffStoreMapModalOpen}
        onClose={() => {
          setStaffStoreMapModalOpen(false);
          setStaffStoreMapInEdit(false);
        }}
        startInEditMode={staffStoreMapInEdit}
        initialEditingBranchId={currentBranch.id}
      />

      {/* ============ BRANCH SHUTDOWN CONFIRMATION MODAL ============ */}
      <BranchShutdownModal
        isOpen={shutdownModalState.isOpen}
        branch={shutdownModalState.branch}
        pendingOrders={shutdownModalState.pendingOrders}
        onCancelAction={closeShutdownModal}
        onContinueProcessing={confirmShutdownKeepProcessing}
        onCancelOrdersAndShut={confirmShutdownCancelOrders}
      />

      {/* ============ REAL-TIME NOTIFICATION CENTER MODAL ============ */}
      <NotificationCenterModal />
    </div>
  );
};
