'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Order, normalizeBranchId } from '@/types/cafe';
import {
  Bike,
  MapPin,
  Phone,
  Navigation,
  CheckCircle2,
  Clock,
  Banknote,
  CreditCard,
  Calendar,
  Search,
  X,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Package,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { HistoricalLoadingModal } from '@/components/common/HistoricalLoadingModal';

interface RiderDashboardProps {
  initialTab?: 'active' | 'history';
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10;
}

function getOrderCoords(order: Order, branchLat: number, branchLng: number): { lat: number; lng: number } {
  if (order.customerCoordinates && order.customerCoordinates.lat && order.customerCoordinates.lng) {
    return { lat: order.customerCoordinates.lat, lng: order.customerCoordinates.lng };
  }
  let hash = 0;
  const str = order.orderNumber || order.id || '1';
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const latOffset = (((Math.abs(hash) % 70) - 35) / 1000);
  const lngOffset = ((((Math.abs(hash) >> 3) % 70) - 35) / 1000);
  return { lat: branchLat + latOffset, lng: branchLng + lngOffset };
}

export const RiderDashboardScreen: React.FC<RiderDashboardProps> = ({ initialTab = 'active' }) => {
  const {
    currentUser,
    currentRole,
    users,
    orders,
    currentBranch,
    finishRiderDelivery,
    acceptRiderOrder,
    updateRiderAvailability,
    departRider,
    updateOrderStatus,
    addToast,
    fetchOlderOrders,
    isFetchingOlderOrders,
  } = useApp();

  const isManagerOrOwner = currentRole === 'branch_manager' || currentRole === 'platform_owner';

  // Get all branch delivery riders
  const branchRiders = useMemo(() => {
    return users.filter(
      (u) => u.role === 'delivery_staff' && (!u.branchId || u.branchId === currentBranch.id)
    );
  }, [users, currentBranch.id]);

  // Determine active rider viewing: if logged in as delivery_staff use currentUser, else default to first branch rider
  const [selectedRiderId, setSelectedRiderId] = useState<string>(() => {
    if (currentUser?.role === 'delivery_staff') return currentUser.id;
    return branchRiders[0]?.id || 'user-rider-1';
  });

  const activeRider = useMemo(() => {
    if (currentUser?.role === 'delivery_staff') {
      const match = users.find((u) => u.id === currentUser.id);
      return match || currentUser;
    }
    const match = users.find((u) => u.id === selectedRiderId);
    return match || branchRiders[0] || currentUser;
  }, [users, selectedRiderId, currentUser, branchRiders]);

  const isBusy = activeRider?.riderAvailability === 'busy';

  // Main Dashboard View Mode: 'active' (Live Deliveries) vs 'history' (Previous Days)
  const [mainView, setMainView] = useState<'active' | 'history'>('active');

  // Selected Order to Deliver Filter ('all' or specific order ID)
  const [selectedOrderToDeliverId, setSelectedOrderToDeliverId] = useState<string>('all');

  // Active Deliveries Filter Tabs: 'all' | 'cod' | 'paid' | 'delivered'
  const [activeFilter, setActiveFilter] = useState<'all' | 'cod' | 'paid' | 'delivered'>('all');

  // History Time Range Filter: 'today' | 'yesterday' | 'past_7_days' | 'all'
  const [historyRange, setHistoryRange] = useState<'today' | 'yesterday' | 'past_7_days' | 'all'>('today');
  const [historySearch, setHistorySearch] = useState('');

  // Selected Order for Menu Pop-up Modal
  const [selectedOrderMenu, setSelectedOrderMenu] = useState<Order | null>(null);

  // All orders belonging to this rider (or all branch delivery orders if manager viewing all)
  const riderOrders = useMemo(() => {
    const bId = normalizeBranchId(currentBranch.id);
    return orders.filter((o) => {
      if (o.type !== 'delivery') return false;
      if (o.branchId && bId && bId !== 'all' && normalizeBranchId(o.branchId) !== bId) return false;
      // Match by assigned rider ID
      return activeRider?.id ? o.assignedRiderId === activeRider.id : false;
    });
  }, [orders, activeRider?.id, currentBranch.id]);

  // Active / Ongoing deliveries for this rider
  const ongoingDeliveries = useMemo(() => {
    return riderOrders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  }, [riderOrders]);

  // Orders to deliver sorted by distance from branch (nearest first, farthest last)
  const sortedOrdersToDeliver = useMemo(() => {
    const bCoords = {
      lat: Number(currentBranch.latitude) || 31.5126,
      lng: Number(currentBranch.longitude) || 74.3436,
    };

    return [...ongoingDeliveries].map((ord) => {
      const oCoords = ord.customerCoordinates || { lat: 31.5204, lng: 74.3587 };
      const dist = calculateDistanceKm(bCoords.lat, bCoords.lng, oCoords.lat, oCoords.lng);
      return {
        order: ord,
        distanceKm: dist,
      };
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [ongoingDeliveries, currentBranch]);

  // Filtered active deliveries based on tab and horizontal row selection
  const filteredActiveDeliveries = useMemo(() => {
    let list = sortedOrdersToDeliver.map((s) => s.order);
    if (selectedOrderToDeliverId !== 'all') {
      list = list.filter((o) => o.id === selectedOrderToDeliverId);
    }
    return list.filter((o) => {
      const isCod = o.paymentMethod === 'COD' || o.paymentMethod?.toLowerCase().includes('cash');
      const isPaid = o.paymentStatus === 'paid' || (!isCod && o.paymentMethod !== 'COD');
      if (activeFilter === 'cod') return isCod && o.paymentStatus !== 'paid';
      if (activeFilter === 'paid') return isPaid;
      if (activeFilter === 'delivered') return o.status === 'completed';
      return true; // 'all'
    });
  }, [sortedOrdersToDeliver, selectedOrderToDeliverId, activeFilter]);

  const handleStartTrip = (ord: Order) => {
    updateOrderStatus(ord.id, 'out_for_delivery');
    const targetId = activeRider?.id || currentUser?.id;
    if (targetId) {
      updateRiderAvailability(targetId, 'busy');
    }
    addToast({
      type: 'info',
      title: 'Trip Started',
      message: `Order #${ord.orderNumber} picked up! Out for delivery 🛵`,
    });
  };

  // Delivered / Completed orders for history
  const historyOrders = useMemo(() => {
    const completed = riderOrders.filter((o) => o.status === 'completed');

    // Parse date filter
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterdayDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return completed.filter((o) => {
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matches =
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(q)) ||
          o.customerPhone.includes(q);
        if (!matches) return false;
      }

      if (historyRange === 'today') {
        return o.createdAt.includes(todayStr) || (o.deliveredAt && o.deliveredAt.slice(0, 10) === now.toISOString().slice(0, 10));
      }
      if (historyRange === 'yesterday') {
        return o.createdAt.includes(yesterdayStr);
      }
      if (historyRange === 'past_7_days') {
        // Look at order creation or delivery timestamp
        return true;
      }
      return true;
    });
  }, [riderOrders, historyRange, historySearch]);

  // Metrics for history
  const historyMetrics = useMemo(() => {
    const totalCount = historyOrders.length;
    const totalAmount = historyOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const codCollected = historyOrders
      .filter((o) => o.paymentMethod === 'COD' || o.paymentMethod?.toLowerCase().includes('cash'))
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
    return { totalCount, totalAmount, codCollected };
  }, [historyOrders]);

  // Google Maps Delivery Navigation Trigger (Rider delivery address navigation)
  const handleOpenGoogleMaps = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();

    const origin = {
      lat: Number(currentBranch.latitude) || 31.5126,
      lng: Number(currentBranch.longitude) || 74.3436,
    };

    let mapUrl = '';
    if (order.customerCoordinates && order.customerCoordinates.lat && order.customerCoordinates.lng) {
      mapUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${order.customerCoordinates.lat},${order.customerCoordinates.lng}`;
    } else if (order.deliveryAddress) {
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`;
    } else {
      mapUrl = `https://www.google.com/maps/search/?api=1&query=${origin.lat},${origin.lng}`;
    }

    window.open(mapUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        padding: 'clamp(16px, 2.5vw, 28px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '1300px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* ========================================================
          TOP HEADER & RIDER PROFILE BANNER
          ======================================================== */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '20px',
          border: '1.5px solid var(--border-color)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              backgroundColor: 'rgba(234, 88, 12, 0.12)',
              color: '#EA580C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(234, 88, 12, 0.2)',
            }}
          >
            <Bike size={28} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--text-main)' }}>
                {activeRider?.name || 'Rider Console'}
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 800,
                  backgroundColor:
                    activeRider?.riderAvailability === 'busy'
                      ? '#FEF3C7'
                      : activeRider?.riderAvailability === 'offline'
                      ? '#F1F5F9'
                      : '#DCFCE7',
                  color:
                    activeRider?.riderAvailability === 'busy'
                      ? '#B45309'
                      : activeRider?.riderAvailability === 'offline'
                      ? '#64748B'
                      : '#15803D',
                  border: `1px solid ${
                    activeRider?.riderAvailability === 'busy'
                      ? '#FDE68A'
                      : activeRider?.riderAvailability === 'offline'
                      ? '#CBD5E1'
                      : '#BBF7D0'
                  }`,
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor:
                      activeRider?.riderAvailability === 'busy'
                        ? '#D97706'
                        : activeRider?.riderAvailability === 'offline'
                        ? '#94A3B8'
                        : '#16A34A',
                  }}
                />
                {activeRider?.riderAvailability === 'busy'
                  ? 'On Delivery'
                  : activeRider?.riderAvailability === 'offline'
                  ? 'Shift Offline'
                  : 'Available for Deliveries'}
              </span>
            </div>

            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', gap: '12px' }}>
              <span>📍 {currentBranch.name}</span>
              <span>•</span>
              <span>📞 {activeRider?.phone || '+92 301 9991122'}</span>
              <span>•</span>
              <span>📦 {activeRider?.riderTotalDeliveries || ongoingDeliveries.length} Total Deliveries</span>
            </div>
          </div>
        </div>

        {/* Manager Rider Switcher & Interactive Duty State Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Duty State Switcher for Rider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Select Duty Status:
            </span>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-input)',
                padding: '3px',
                borderRadius: '12px',
                border: '1.5px solid var(--border-color)',
                gap: '4px',
              }}
            >
              {/* FREE / READY */}
              <button
                type="button"
                id="rider-duty-free-btn"
                onClick={() => {
                  const targetId = activeRider?.id || currentUser?.id;
                  if (targetId) updateRiderAvailability(targetId, 'available');
                }}
                style={{
                  padding: '6px 13px',
                  borderRadius: '9px',
                  border: 'none',
                  backgroundColor:
                    activeRider?.riderAvailability === 'available' || !activeRider?.riderAvailability
                      ? '#DCFCE7'
                      : 'transparent',
                  color:
                    activeRider?.riderAvailability === 'available' || !activeRider?.riderAvailability
                      ? '#15803D'
                      : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow:
                    activeRider?.riderAvailability === 'available' || !activeRider?.riderAvailability
                      ? '0 2px 6px rgba(22, 163, 74, 0.2)'
                      : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Free: Available to accept delivery assignments"
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                <span>🟢 Free</span>
              </button>

              {/* BUSY / ON DELIVERY */}
              <button
                type="button"
                id="rider-duty-busy-btn"
                onClick={() => {
                  const targetId = activeRider?.id || currentUser?.id;
                  if (targetId) updateRiderAvailability(targetId, 'busy');
                }}
                style={{
                  padding: '6px 13px',
                  borderRadius: '9px',
                  border: 'none',
                  backgroundColor: activeRider?.riderAvailability === 'busy' ? '#FEF3C7' : 'transparent',
                  color: activeRider?.riderAvailability === 'busy' ? '#B45309' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: activeRider?.riderAvailability === 'busy' ? '0 2px 6px rgba(180, 83, 9, 0.2)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Busy: Out for delivery, cannot receive new orders"
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D97706' }} />
                <span>🟠 Busy</span>
              </button>

              {/* OFFLINE */}
              <button
                type="button"
                id="rider-duty-offline-btn"
                onClick={() => {
                  const targetId = activeRider?.id || currentUser?.id;
                  if (targetId) updateRiderAvailability(targetId, 'offline');
                }}
                style={{
                  padding: '6px 13px',
                  borderRadius: '9px',
                  border: 'none',
                  backgroundColor: activeRider?.riderAvailability === 'offline' ? '#F1F5F9' : 'transparent',
                  color: activeRider?.riderAvailability === 'offline' ? '#475569' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: activeRider?.riderAvailability === 'offline' ? '0 2px 6px rgba(100, 116, 139, 0.2)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Offline: Off-duty or on break"
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#64748B' }} />
                <span>⚫ Offline</span>
              </button>
            </div>
          </div>

          {isManagerOrOwner && branchRiders.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Branch Rider:
              </span>
              <select
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {branchRiders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.riderAvailability === 'busy' ? 'Busy' : r.riderAvailability === 'offline' ? 'Offline' : 'Ready'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          NAVIGATION TABS: ACTIVE DELIVERIES VS MULTI-STOP ROUTE VS HISTORY
          ======================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1.5px solid var(--border-color)',
          paddingBottom: '8px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            id="rider-tab-active-btn"
            onClick={() => setMainView('active')}
            style={{
              padding: '9px 18px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: mainView === 'active' ? '#EA580C' : 'transparent',
              color: mainView === 'active' ? '#FFFFFF' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 850,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: mainView === 'active' ? '0 3px 12px rgba(234, 88, 12, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Package size={15} />
            <span>Active Deliveries ({ongoingDeliveries.length})</span>
          </button>

          <button
            type="button"
            id="rider-tab-history-btn"
            onClick={() => setMainView('history')}
            style={{
              padding: '9px 18px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: mainView === 'history' ? '#EA580C' : 'transparent',
              color: mainView === 'history' ? '#FFFFFF' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 850,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: mainView === 'history' ? '0 3px 12px rgba(234, 88, 12, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Calendar size={15} />
            <span>History of Previous Days</span>
          </button>
        </div>

        {/* Secondary Filters for Active Deliveries */}
        {mainView === 'active' && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(
              [
                { id: 'all', label: `All (${ongoingDeliveries.length})` },
                {
                  id: 'cod',
                  label: `Cash on Delivery (${
                    ongoingDeliveries.filter((o) => o.paymentMethod === 'COD' && o.paymentStatus !== 'paid').length
                  })`,
                },
                {
                  id: 'paid',
                  label: `Paid (${
                    ongoingDeliveries.filter((o) => o.paymentStatus === 'paid' || o.paymentMethod !== 'COD').length
                  })`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: `1.5px solid ${activeFilter === tab.id ? '#EA580C' : 'var(--border-color)'}`,
                  backgroundColor: activeFilter === tab.id ? '#FFF7ED' : 'var(--bg-card)',
                  color: activeFilter === tab.id ? '#EA580C' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* History Range Filters */}
        {mainView === 'history' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Option Before Dropdown */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '6px 12px',
              }}
            >
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search past orders..."
                style={{
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '12.5px',
                  width: '160px',
                  color: 'var(--text-main)',
                }}
              />
            </div>

            {/* Dropdown with options: Today, Yesterday, Past 7 Days, All Past Days */}
            <select
              id="rider-history-range-dropdown"
              value={historyRange}
              onChange={(e) => {
                const nextRange = e.target.value as 'today' | 'yesterday' | 'past_7_days' | 'all';
                setHistoryRange(nextRange);
                if (nextRange === 'yesterday') {
                  const yest = new Date();
                  yest.setDate(yest.getDate() - 1);
                  const yStr = yest.toISOString().slice(0, 10);
                  fetchOlderOrders(currentBranch?.id, 'yesterday', yStr, yStr);
                } else if (nextRange === 'past_7_days') {
                  fetchOlderOrders(currentBranch?.id, 'week');
                } else if (nextRange === 'all') {
                  fetchOlderOrders(currentBranch?.id, 'all');
                }
              }}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="past_7_days">Past 7 Days</option>
              <option value="all">All Past Days</option>
            </select>
          </div>
        )}
      </div>

      {/* Pop-up Circle Loading Sign when fetching past delivery records */}
      <HistoricalLoadingModal visible={Boolean(isFetchingOlderOrders)} />

      {/* Horizontal Scrollable Row: Orders to Deliver (Nearest to branch first) */}
      {mainView === 'active' && sortedOrdersToDeliver.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 850, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🛵</span> Orders to Deliver ({sortedOrdersToDeliver.length})
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 650 }}>
              Nearest to branch ➔ Farthest
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              paddingBottom: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedOrderToDeliverId('all')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: selectedOrderToDeliverId === 'all' ? '1.5px solid #EA580C' : '1px solid var(--border-color)',
                backgroundColor: selectedOrderToDeliverId === 'all' ? '#FFF7ED' : 'var(--bg-card-subtle)',
                color: selectedOrderToDeliverId === 'all' ? '#EA580C' : 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              All Active ({sortedOrdersToDeliver.length})
            </button>

            {sortedOrdersToDeliver.map(({ order, distanceKm }) => {
              const isSelected = selectedOrderToDeliverId === order.id;
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderToDeliverId(isSelected ? 'all' : order.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: isSelected ? '1.5px solid #EA580C' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? '#FFF7ED' : 'var(--bg-card-subtle)',
                    color: isSelected ? '#EA580C' : 'var(--text-main)',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  #{order.orderNumber} ({distanceKm} km)
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          ACTIVE DELIVERIES VIEW
          ======================================================== */}
      {mainView === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* DEPARTURE ACTION BANNER: Shown when rider has assigned orders and has not departed yet */}
          {!isBusy && ongoingDeliveries.length > 0 && (
            <div
              style={{
                backgroundColor: '#FFF7ED',
                border: '2px solid #EA580C',
                borderRadius: '18px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
                boxShadow: '0 4px 16px rgba(234, 88, 12, 0.12)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    backgroundColor: '#EA580C',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(234, 88, 12, 0.3)',
                  }}
                >
                  <Bike size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '15.5px', fontWeight: 900, color: '#9A3412', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Ready for Departure ({ongoingDeliveries.length} {ongoingDeliveries.length === 1 ? 'Order' : 'Orders'} Assigned)</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0' }}>
                      Status: Ready
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#C2410C', marginTop: '3px', lineHeight: 1.4 }}>
                    Customer Support can still assign or change your orders while you are at the branch.
                    <br />
                    <strong>Before you depart</strong>, click the button to set your status to <strong>Busy</strong> so Customer Support cannot assign any more orders to you.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const targetId = activeRider?.id || currentUser?.id;
                  if (targetId) {
                    departRider(targetId);
                  }
                }}
                style={{
                  padding: '11px 22px',
                  borderRadius: '12px',
                  backgroundColor: '#EA580C',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Bike size={18} />
                <span>🚀 Depart for Delivery (Mark Busy)</span>
              </button>
            </div>
          )}

          {/* ACTIVE TRIP BANNER: Shown when rider has departed and is busy delivering */}
          {isBusy && ongoingDeliveries.length > 0 && (
            <div
              style={{
                backgroundColor: '#EFF6FF',
                border: '2px solid #2563EB',
                borderRadius: '18px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
                boxShadow: '0 4px 16px rgba(37, 99, 235, 0.12)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '14px',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  }}
                >
                  <Bike size={24} />
                </div>
                <div>
                  <div style={{ fontSize: '15.5px', fontWeight: 900, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>En Route on Delivery Trip</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}>
                      Status: Busy ({ongoingDeliveries.length} {ongoingDeliveries.length === 1 ? 'Order' : 'Orders'} Remaining)
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#2563EB', marginTop: '3px' }}>
                    Customer Support sees you as <strong>Busy</strong> and cannot assign new orders. Finish deliveries below using OpenStreetMap directions.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = activeRider?.id || currentUser?.id;
                    if (targetId) {
                      updateRiderAvailability(targetId, 'available');
                    }
                  }}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#FFFFFF',
                    color: '#1E40AF',
                    border: '1.5px solid #BFDBFE',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>↩️ Return to Base (Mark Free)</span>
                </button>
              </div>
            </div>
          )}

          {filteredActiveDeliveries.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '20px',
                border: '1.5px dashed var(--border-color)',
              }}
            >
              <Bike size={44} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
                No Active Orders in this View
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                When Customer Support or the Branch Manager assigns a delivery order to you, it will appear here immediately!
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                gap: '18px',
              }}
            >
              {filteredActiveDeliveries.map((ord) => {
                const isCod = ord.paymentMethod === 'COD' || ord.paymentMethod?.toLowerCase().includes('cash');
                const isPaid = ord.paymentStatus === 'paid' || (!isCod && ord.paymentMethod !== 'COD');

                return (
                  <div
                    key={ord.id}
                    onClick={() => setSelectedOrderMenu(ord)}
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderRadius: '18px',
                      border: '1.5px solid var(--border-color)',
                      boxShadow: 'var(--shadow-sm)',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    }}
                  >
                    {/* Top Row: Order Number & Payment Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px', fontWeight: 900, color: '#EA580C' }}>
                            #{ord.orderNumber}
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '8px',
                              fontSize: '11px',
                              fontWeight: 800,
                              backgroundColor: (isBusy || ord.status === 'out_for_delivery') ? '#EFF6FF' : '#DCFCE7',
                              color: (isBusy || ord.status === 'out_for_delivery') ? '#1D4ED8' : '#166534',
                            }}
                          >
                            {isBusy || ord.status === 'out_for_delivery'
                              ? 'OUT FOR DELIVERY 🛵'
                              : ord.status === 'ready'
                              ? 'READY AT CAFE'
                              : ord.status === 'preparing'
                              ? 'COOKING IN KITCHEN'
                              : 'ASSIGNED • READY'}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {ord.createdAt}
                        </div>
                      </div>

                      {/* Payment Badge */}
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 850,
                          backgroundColor: isPaid ? '#DCFCE7' : '#FEF3C7',
                          color: isPaid ? '#15803D' : '#92400E',
                          border: `1px solid ${isPaid ? '#BBF7D0' : '#FDE68A'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {isPaid ? <CheckCircle2 size={11} /> : <Banknote size={11} />}
                        {isPaid ? 'PAID ONLINE' : `COD: Rs. ${Number(ord.total).toLocaleString()}`}
                      </span>
                    </div>

                    {/* Customer Details & Phone */}
                    <div
                      style={{
                        padding: '10px 12px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                          {ord.customerName}
                        </span>
                        <a
                          href={`tel:${ord.customerPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '8px',
                            backgroundColor: '#25D366',
                            color: '#FFFFFF',
                            fontSize: '11px',
                            fontWeight: 800,
                            textDecoration: 'none',
                          }}
                        >
                          <Phone size={11} />
                          <span>Call Customer</span>
                        </a>
                      </div>

                      {/* Delivery Address with Coordinates indicator */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <MapPin size={14} color="#EA580C" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span style={{ lineHeight: 1.4 }}>
                          {ord.deliveryAddress || 'Customer Address (Lahore)'}
                        </span>
                      </div>

                      {ord.customerCoordinates && (
                        <div style={{ fontSize: '10.5px', color: '#166534', fontWeight: 700, marginLeft: '20px' }}>
                          ✓ Exact GPS Pin Stored ({ord.customerCoordinates.lat.toFixed(4)}, {ord.customerCoordinates.lng.toFixed(4)})
                        </div>
                      )}
                    </div>

                    {/* Order Items Summary */}
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '11.5px', textTransform: 'uppercase' }}>
                        Order Items ({ord.items.length}):
                      </div>
                      <div style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        {ord.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                      </div>
                    </div>

                    {/* Card Actions: Mark Delivered + BOTTOM RIGHT "GET DIRECTION" BUTTON */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '4px',
                        paddingTop: '12px',
                        borderTop: '1px solid var(--border-color)',
                      }}
                    >
                      {/* Left: Accept Order, Pick Up & Start Trip, or Mark Paid & Delivered (only 1 step shown at a time) */}
                      {(!ord.riderStatus || ord.riderStatus === 'assigned') ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            acceptRiderOrder(ord.id);
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: '#2563EB',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>Accept Order ✓</span>
                        </button>
                      ) : ord.status !== 'out_for_delivery' && ord.riderStatus === 'accepted' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartTrip(ord);
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: '#F59E0B',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
                          }}
                        >
                          <Bike size={13} />
                          <span>Pick Up & Start Trip 🛵</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            finishRiderDelivery(ord.id, true);
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: '#16A34A',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>Mark Paid & Delivered ✓</span>
                        </button>
                      )}

                      {/* BOTTOM RIGHT CORNER: GET DIRECTION (Opens OpenStreetMap) */}
                      <button
                        type="button"
                        onClick={(e) => handleOpenGoogleMaps(ord, e)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: '1.5px solid #EA580C',
                          backgroundColor: '#FFF7ED',
                          color: '#EA580C',
                          fontSize: '12px',
                          fontWeight: 850,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(234, 88, 12, 0.15)',
                          transition: 'all 0.15s ease',
                        }}
                        title="Open direct live directions in Google Maps"
                      >
                        <Navigation size={13} />
                        <span>Google Maps 🗺️</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          HISTORY OF PREVIOUS DAYS VIEW
          ======================================================== */}
      {mainView === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* History Metrics Summary Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '16px 20px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800 }}>
                DELIVERIES COMPLETED
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                {historyMetrics.totalCount}
              </div>
              <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 700, marginTop: '2px' }}>
                ✓ 100% Successful Handover
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '16px 20px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800 }}>
                TOTAL ORDERS VALUE
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#EA580C', marginTop: '4px' }}>
                Rs. {historyMetrics.totalAmount.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Delivered across selected range
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                padding: '16px 20px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800 }}>
                CASH COLLECTED (COD)
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#16A34A', marginTop: '4px' }}>
                Rs. {historyMetrics.codCollected.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Till / Cash reconciliation total
              </div>
            </div>
          </div>

          {/* History Orders List */}
          {historyOrders.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '50px 20px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
              }}
            >
              <Calendar size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                No Past Deliveries in this Period
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Completed deliveries will automatically appear here with full timestamp and cash records.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historyOrders.map((ord) => (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrderMenu(ord)}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '14px',
                    border: '1px solid var(--border-color)',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        backgroundColor: '#DCFCE7',
                        color: '#16A34A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircle2 size={20} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--text-main)' }}>
                          #{ord.orderNumber}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          • {ord.customerName}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: ord.paymentMethod === 'COD' ? '#FEF3C7' : '#DCFCE7',
                            color: ord.paymentMethod === 'COD' ? '#92400E' : '#166534',
                          }}
                        >
                          {ord.paymentMethod === 'COD' ? 'COD' : 'Paid Online'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Delivered: {ord.completedAt || ord.createdAt} • 📍 {ord.deliveryAddress || 'Lahore'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: 'var(--text-main)' }}>
                        Rs. {Number(ord.total).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#16A34A', fontWeight: 700 }}>
                        Delivered ✓
                      </div>
                    </div>
                    <Eye size={16} color="var(--text-muted)" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          POP-UP SCREEN: ORDER MENU & COMPLETE DETAILS
          ======================================================== */}
      {selectedOrderMenu && (
        <div
          onClick={() => setSelectedOrderMenu(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(20, 16, 14, 0.72)',
            backdropFilter: 'blur(6px)',
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
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
                Order Details
              </h3>

              <button
                type="button"
                onClick={() => setSelectedOrderMenu(null)}
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

            {/* Customer & Location Box */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '14px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Customer: {selectedOrderMenu.customerName}
                </span>
                <a
                  href={`tel:${selectedOrderMenu.customerPhone}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#25D366',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  <Phone size={11} />
                  <span>{selectedOrderMenu.customerPhone}</span>
                </a>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <MapPin size={14} color="#EA580C" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{selectedOrderMenu.deliveryAddress || 'Lahore'}</span>
              </div>

              {selectedOrderMenu.notes && (
                <div style={{ fontSize: '11.5px', color: '#B45309', backgroundColor: '#FEF3C7', padding: '6px 10px', borderRadius: '8px' }}>
                  <strong>Notes:</strong> {selectedOrderMenu.notes}
                </div>
              )}
            </div>

            {/* Itemized Order Menu */}
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                Itemized Menu Items:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedOrderMenu.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      fontSize: '12.5px',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 800, color: '#EA580C', marginRight: '6px' }}>
                        {item.quantity}x
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                        {item.name}
                      </span>
                      {item.size && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                          ({item.size})
                        </span>
                      )}
                      {item.extras && item.extras.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          + {item.extras.join(', ')}
                        </div>
                      )}
                    </div>
                    <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                      Rs. {(Number(item.unitPrice) * Number(item.quantity)).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Subtotal:</span>
                <span>Rs. {Number(selectedOrderMenu.originalSubtotal || selectedOrderMenu.total).toLocaleString()}</span>
              </div>
              {Number(selectedOrderMenu.addOnSubtotal || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span>Add-ons:</span>
                  <span>Rs. {Number(selectedOrderMenu.addOnSubtotal).toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>
                <span>Total Amount:</span>
                <span style={{ color: '#EA580C' }}>Rs. {Number(selectedOrderMenu.total).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: selectedOrderMenu.paymentStatus === 'paid' ? '#16A34A' : '#D97706', fontWeight: 800, marginTop: '2px' }}>
                Payment: {selectedOrderMenu.paymentMethod} ({selectedOrderMenu.paymentStatus === 'paid' ? 'PAID' : 'COLLECT CASH'})
              </div>
            </div>

            {/* Modal Bottom Actions: Get Direction + Finish Delivery */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={(e) => handleOpenGoogleMaps(selectedOrderMenu, e)}
                style={{
                  flex: 1,
                  padding: '11px',
                  borderRadius: '10px',
                  border: '1.5px solid #EA580C',
                  backgroundColor: '#FFF7ED',
                  color: '#EA580C',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Navigation size={14} />
                <span>Google Maps 🗺️</span>
              </button>

              {selectedOrderMenu.status !== 'completed' && (!selectedOrderMenu.riderStatus || selectedOrderMenu.riderStatus === 'assigned') && (
                <button
                  type="button"
                  onClick={() => {
                    acceptRiderOrder(selectedOrderMenu.id);
                    setSelectedOrderMenu((prev) => (prev ? { ...prev, riderStatus: 'accepted' } : null));
                  }}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 12px rgba(37, 99, 235, 0.3)',
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>Accept Order ✓</span>
                </button>
              )}

              {selectedOrderMenu.status !== 'completed' && (selectedOrderMenu.riderStatus === 'accepted' || selectedOrderMenu.riderStatus === 'en_route') && (
                <button
                  type="button"
                  onClick={() => {
                    finishRiderDelivery(selectedOrderMenu.id, true);
                    setSelectedOrderMenu(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 3px 12px rgba(22, 163, 74, 0.3)',
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>Finish Delivery ✅</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
