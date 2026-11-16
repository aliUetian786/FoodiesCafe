'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { getCancellationAttribution } from '@/types/cafe';
import { orderBelongsToCustomer } from '@/lib/orderOwnership';
import {
  Bell,
  Clock,
  CheckCircle2,
  Sparkles,
  Flame,
  ShieldCheck,
  MessageSquare,
  Volume2,
  Sliders,
  Trash2,
  XCircle,
  AlertTriangle,
  ShoppingBag,
  Receipt,
  CheckCheck,
  Utensils,
  Bike,
  ChefHat,
  Info,
  ArrowRight,
} from 'lucide-react';

export const ProfileScreen: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const {
    addToast,
    orders,
    currentUser,
    branches,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    openNotificationModal,
    myNotificationSettings,
    updateMyNotificationSettings,
    activeReceiverKey,
  } = useApp();

  const actorKey = currentUser?.id || 'user-guest';

  const cleanPhone = currentUser?.phone ? currentUser.phone.replace(/\D/g, '').slice(-10) : '';

  const customerRecentOrders = useMemo(() => {
    let pool = [...orders];
    if (typeof window !== 'undefined') {
      try {
        const localCached = JSON.parse(localStorage.getItem('foodies_customer_history_cache') || '[]');
        localCached.forEach((co: any) => {
          if (!pool.some((o) => o.id === co.id || o.orderNumber === co.orderNumber)) {
            pool.push(co);
          }
        });
      } catch (e) {}
    }

    return pool.filter((o) =>
      orderBelongsToCustomer(o, { ids: [currentUser?.id], emails: [currentUser?.email], phone: cleanPhone })
    ).slice(0, 5);
  }, [orders, currentUser, cleanPhone]);

  // Real Customer Receiver Notification Settings State
  const [localMySettings, setLocalMySettings] = useState(
    myNotificationSettings || {
      receiveNotifications: true,
      showLiveToast: true,
      mutedCategories: [],
      events: {
        orderPlaced: true,
        sentToKitchen: true,
        cooking: true,
        orderReady: true,
        outForDelivery: true,
        orderServed: true,
        orderCompleted: true,
        orderCancelled: true,
        waiterAssigned: true,
        riderAssigned: true,
        paymentReceived: true,
      },
    }
  );
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'takeaway' | 'dine_in' | 'delivery' | 'unread'>('all');

  useEffect(() => {
    if (myNotificationSettings) {
      setLocalMySettings((prev) => ({
        ...prev,
        ...myNotificationSettings,
        events: {
          ...prev.events,
          ...(myNotificationSettings.events || {}),
        },
      }));
    }
  }, [myNotificationSettings]);

  const filteredLiveNotifs = useMemo(() => {
    return notifications.filter((n) => {
      if (notifFilter === 'unread') return !(n.readBy || []).includes(actorKey);
      if (notifFilter === 'all') return true;
      return n.category === notifFilter;
    });
  }, [notifications, notifFilter, actorKey]);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrefs(true);
    try {
      await updateMyNotificationSettings(localMySettings, activeReceiverKey);
      addToast({
        type: 'success',
        title: 'Notification Settings Saved!',
        message: 'Your personal notification rules have been saved and applied immediately.',
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Failed to Save',
        message: 'Could not save notification preferences.',
      });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleClearAll = () => {
    clearNotifications();
    addToast({
      type: 'info',
      title: 'Notifications Cleared',
      message: 'All recent notification records have been cleared.',
    });
  };

  return (
    <div style={{ maxWidth: '960px', margin: '28px auto 90px', padding: '0 clamp(12px, 3vw, 20px)', width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
          Notification Preferences & Alerts
        </h1>
      </div>

      {/* Recent Orders & Live Status Section */}
      {customerRecentOrders.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            padding: '22px 24px',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(217, 101, 40, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingBag size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 850, margin: 0, color: 'var(--text-main)' }}>
                  Recent Orders & Live Status
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Live status of your recent dining and delivery orders
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('order-history')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                color: 'var(--primary)',
                fontSize: '12px',
                fontWeight: 750,
                cursor: 'pointer',
              }}
            >
              <Receipt size={13} />
              <span>Full Order History</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {customerRecentOrders.map((ord) => {
              const isCancelled = ord.status === 'cancelled';
              const cancelAttr = isCancelled ? getCancellationAttribution(ord) : null;
              const isCompleted = ['completed', 'delivered', 'served'].includes(ord.status);
              const branchObj = branches.find((b) => b.id === ord.branchId);

              return (
                <div
                  key={ord.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '14px',
                    backgroundColor: isCancelled ? '#FEF2F2' : 'var(--bg-card-subtle)',
                    border: `1px solid ${isCancelled ? '#FCA5A5' : 'var(--border-color)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        backgroundColor: isCancelled ? '#FEE2E2' : '#FFFFFF',
                        color: isCancelled ? '#DC2626' : 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isCancelled ? <XCircle size={18} /> : <Clock size={18} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 850, fontSize: '13.5px', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                          #{ord.orderNumber}
                        </span>
                        <span style={{ fontSize: '11px', padding: '1.5px 7px', borderRadius: '5px', backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                          {ord.type.replace('_', ' ')}
                        </span>
                        {branchObj && (
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            • {branchObj.name}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11.5px', color: isCancelled ? '#991B1B' : 'var(--text-secondary)', marginTop: '2px' }}>
                        {isCancelled
                          ? (cancelAttr?.isCustomer
                              ? 'Cancelled by you before fulfillment.'
                              : (cancelAttr?.badge === 'CANCELLED (BRANCH CLOSED)'
                                  ? 'Cancelled: Branch closed offline before fulfillment.'
                                  : 'Cancelled by cafe staff before fulfillment.'))
                          : `${ord.items.length} item(s) · Rs. ${ord.total.toLocaleString()}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 800,
                        backgroundColor: isCancelled ? '#FEE2E2' : isCompleted ? '#DCFCE7' : '#FEF3C7',
                        color: isCancelled ? '#DC2626' : isCompleted ? '#166534' : '#92400E',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {isCancelled ? (cancelAttr?.badge || 'CANCELLED') : ord.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Left Card on Desktop / Top on Mobile: Recent Notification Feed */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            padding: '24px',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#FFF7ED', color: '#EA580C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 850, margin: 0, color: 'var(--text-main)' }}>
                  Live Notifications ({unreadNotificationsCount} unread)
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 650 }}>
                  {notifications.length} live alert{notifications.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => openNotificationModal('inbox')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: '#FFF7ED',
                  border: '1px solid #FED7AA',
                  color: '#EA580C',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Bell size={13} />
                <span>Open Modal</span>
              </button>

              {unreadNotificationsCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllNotificationsRead()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    color: '#16A34A',
                    fontSize: '11.5px',
                    fontWeight: 750,
                    cursor: 'pointer',
                  }}
                >
                  <CheckCheck size={13} />
                  <span>Mark Read</span>
                </button>
              )}

              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    fontSize: '11.5px',
                    fontWeight: 750,
                    cursor: 'pointer',
                  }}
                >
                  <Trash2 size={13} />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'takeaway', label: 'Takeaway' },
                { id: 'dine_in', label: 'Dine-In' },
                { id: 'delivery', label: 'Delivery' },
                { id: 'unread', label: 'Unread' },
              ] as const
            ).map((chip) => {
              const active = notifFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setNotifFilter(chip.id)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    border: active ? '1px solid #EA580C' : '1px solid var(--border-color)',
                    backgroundColor: active ? '#EA580C' : 'var(--bg-card-subtle)',
                    color: active ? '#FFFFFF' : 'var(--text-secondary)',
                    fontSize: '11px',
                    fontWeight: 750,
                    cursor: 'pointer',
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {filteredLiveNotifs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '48px 20px',
                borderRadius: '16px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px dashed var(--border-color)',
              }}
            >
              <Bell size={40} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                No Active Notifications
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                When you place an order, Takeaway counter alerts & live preparation updates appear here automatically.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredLiveNotifs.map((n) => {
                const isUnread = !(n.readBy || []).includes(actorKey);
                return (
                  <div
                    key={n.id}
                    onClick={() => isUnread && markNotificationRead(n.id)}
                    style={{
                      padding: '14px',
                      borderRadius: '14px',
                      backgroundColor: isUnread ? '#FFFBF7' : 'var(--bg-card-subtle)',
                      border: isUnread ? '1px solid #FDBA74' : '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      cursor: isUnread ? 'pointer' : 'default',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-card)',
                        color: n.category === 'takeaway' ? '#EA580C' : n.category === 'delivery' ? '#16A34A' : 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {n.category === 'takeaway' ? (
                        <ShoppingBag size={16} />
                      ) : n.category === 'dine_in' ? (
                        <Utensils size={16} />
                      ) : n.category === 'delivery' ? (
                        <Bike size={16} />
                      ) : n.category === 'kitchen' ? (
                        <ChefHat size={16} />
                      ) : n.type === 'success' ? (
                        <CheckCircle2 size={16} color="#16A34A" />
                      ) : (
                        <Info size={16} color="var(--primary)" />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.25 }}>
                          {n.title}
                        </div>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 650, flexShrink: 0 }}>
                          {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.45 }}>
                        {n.message}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', backgroundColor: '#F1F5F9', color: '#475569', textTransform: 'uppercase' }}>
                          {n.category.replace('_', ' ')}
                        </span>
                        {n.orderNumber && (
                          <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '6px', backgroundColor: '#FFF7ED', color: '#C2410C', fontFamily: 'monospace' }}>
                            #{n.orderNumber}
                          </span>
                        )}
                        {n.senderName && (
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                            • From {n.senderName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Card on Desktop / Bottom on Mobile: Edit Notification Preferences Form */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            padding: '24px',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sliders size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 850, margin: 0, color: 'var(--text-main)' }}>
                Edit Notification Settings
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 650 }}>
                Choose which alerts to receive on this device
              </span>
            </div>
          </div>

          <form onSubmit={handleSavePreferences} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Master Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: localMySettings.receiveNotifications !== false ? '#F0FDF4' : '#FEF2F2',
                  border: localMySettings.receiveNotifications !== false ? '1.5px solid #86EFAC' : '1px solid #FECACA',
                  cursor: 'pointer',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: localMySettings.receiveNotifications !== false ? '#15803D' : '#DC2626' }}>
                    Receive Notifications
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Master alert toggle</div>
                </div>
                <input
                  type="checkbox"
                  checked={localMySettings.receiveNotifications !== false}
                  onChange={(e) =>
                    setLocalMySettings((prev) => ({
                      ...prev,
                      receiveNotifications: e.target.checked,
                    }))
                  }
                  style={{ width: '18px', height: '18px', accentColor: '#16A34A', cursor: 'pointer' }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  backgroundColor: localMySettings.showLiveToast !== false ? '#EFF6FF' : '#F8FAFC',
                  border: localMySettings.showLiveToast !== false ? '1.5px solid #93C5FD' : '1px solid #E2E8F0',
                  cursor: 'pointer',
                  gap: '8px',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: localMySettings.showLiveToast !== false ? '#1D4ED8' : '#64748B' }}>
                    Live Pop-up Alerts
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Floating toast alerts</div>
                </div>
                <input
                  type="checkbox"
                  checked={localMySettings.showLiveToast !== false}
                  onChange={(e) =>
                    setLocalMySettings((prev) => ({
                      ...prev,
                      showLiveToast: e.target.checked,
                    }))
                  }
                  style={{ width: '18px', height: '18px', accentColor: '#2563EB', cursor: 'pointer' }}
                />
              </label>
            </div>

            <div style={{ fontSize: '12px', fontWeight: 850, color: 'var(--text-main)', marginTop: '4px' }}>
              Order Lifecycle Events (Uncheck any event to stop receiving it):
            </div>

            {/* Event 1: Order Placed */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  1. Order Placed / Confirmed
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Alerts you immediately when your checkout order is received and confirmed.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localMySettings.events?.orderPlaced !== false}
                onChange={(e) =>
                  setLocalMySettings((prev) => ({
                    ...prev,
                    events: { ...prev.events, orderPlaced: e.target.checked },
                  }))
                }
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            {/* Event 2: Cooking */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  2. Preparing / Cooking in Kitchen
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Alerts you when kitchen chefs begin cooking your fresh meal.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localMySettings.events?.cooking !== false}
                onChange={(e) =>
                  setLocalMySettings((prev) => ({
                    ...prev,
                    events: { ...prev.events, cooking: e.target.checked },
                  }))
                }
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            {/* Event 3: Order Ready */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  3. Order Ready (Counter Pickup / Table / Dispatch)
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Alerts you when Takeaway food is hot at the counter or dine-in is ready to serve.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localMySettings.events?.orderReady !== false}
                onChange={(e) =>
                  setLocalMySettings((prev) => ({
                    ...prev,
                    events: { ...prev.events, orderReady: e.target.checked },
                  }))
                }
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            {/* Event 4: Out for Delivery */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  4. Out for Delivery (Rider en route)
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Alerts you with rider name when your delivery order is on the way to your door.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localMySettings.events?.outForDelivery !== false}
                onChange={(e) =>
                  setLocalMySettings((prev) => ({
                    ...prev,
                    events: { ...prev.events, outForDelivery: e.target.checked },
                  }))
                }
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            {/* Event 5: Delivered / Completed */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  5. Order Delivered / Completed / Received
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Confirms meal hand-off, receipt completion, and loyalty records.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localMySettings.events?.orderCompleted !== false}
                onChange={(e) =>
                  setLocalMySettings((prev) => ({
                    ...prev,
                    events: { ...prev.events, orderCompleted: e.target.checked },
                  }))
                }
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            {/* Event 6: Cancelled */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  6. Order Cancelled
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Alerts you immediately if an order is cancelled with cancellation details.
                </div>
              </div>
              <input
                type="checkbox"
                checked={localMySettings.events?.orderCancelled !== false}
                onChange={(e) =>
                  setLocalMySettings((prev) => ({
                    ...prev,
                    events: { ...prev.events, orderCancelled: e.target.checked },
                  }))
                }
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            {/* Event 7: Exclusive Deals */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  7. Exclusive Deals & Chef Announcements
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Special branch promotions, deals, and chef announcements.
                </div>
              </div>
              <input
                type="checkbox"
                checked={!localMySettings.mutedCategories?.includes('promo')}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setLocalMySettings((prev) => {
                    const currentMuted = Array.isArray(prev.mutedCategories) ? prev.mutedCategories : [];
                    return {
                      ...prev,
                      mutedCategories: isChecked
                        ? currentMuted.filter((c) => c !== 'promo')
                        : [...currentMuted.filter((c) => c !== 'promo'), 'promo'],
                    };
                  });
                }}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            <button
              type="submit"
              disabled={isSavingPrefs}
              style={{
                marginTop: '10px',
                padding: '13px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isSavingPrefs ? '#FDBA74' : 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '14.5px',
                fontWeight: 850,
                border: 'none',
                cursor: isSavingPrefs ? 'wait' : 'pointer',
                boxShadow: '0 4px 14px var(--primary-glow)',
                transition: 'transform 0.15s ease',
              }}
            >
              {isSavingPrefs ? 'Saving Settings...' : 'Save Notification Preferences'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
