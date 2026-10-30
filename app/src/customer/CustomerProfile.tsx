'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
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
} from 'lucide-react';

export const ProfileScreen: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const { addToast } = useApp();

  // Notification Preferences State (Editable by user)
  const [notifyReadySoon, setNotifyReadySoon] = useState(true);
  const [notifyEstimateChange, setNotifyEstimateChange] = useState(true);
  const [notifyAddonCutoff, setNotifyAddonCutoff] = useState(true);
  const [notifyDeals, setNotifyDeals] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);

  const [notificationsList, setNotificationsList] = useState([
    {
      id: '1',
      title: 'Welcome to FoodiesCafe',
      desc: 'Explore our authentic clay oven dum biryani and organic desi ghee Shinwari karahi.',
      time: 'Just now',
      type: 'confirmed',
      icon: <CheckCircle2 size={16} color="#16A34A" />,
    },
    {
      id: '2',
      title: 'Real-Time Order Tracking Active',
      desc: 'Track food live from kitchen preparation to table service or doorstep delivery.',
      time: 'Today',
      type: 'ready_soon',
      icon: <Clock size={16} color="var(--primary)" />,
    },
    {
      id: '3',
      title: 'Support & Help Desk Available',
      desc: 'Our branch representatives are online to assist with any questions or requests.',
      time: 'Today',
      type: 'support',
      icon: <MessageSquare size={16} color="#2563EB" />,
    },
  ]);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    addToast({
      type: 'success',
      title: 'Notification Settings Saved! 🔔',
      message: 'Your notification and alert preferences have been successfully updated.',
    });
  };

  const handleClearAll = () => {
    setNotificationsList([]);
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'var(--bg-card-subtle)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 850, margin: 0, color: 'var(--text-main)' }}>
                  Recent Notifications
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 650 }}>
                  {notificationsList.length} alert{notificationsList.length === 1 ? '' : 's'} logged
                </span>
              </div>
            </div>

            {notificationsList.length > 0 && (
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

          {notificationsList.length === 0 ? (
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
                When you place an order, live alerts and preparation status updates will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {notificationsList.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '14px',
                    borderRadius: '14px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-card)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {n.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.25 }}>
                        {n.title}
                      </div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 650, flexShrink: 0 }}>
                        {n.time}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.45 }}>
                      {n.desc}
                    </div>
                  </div>
                </div>
              ))}
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

          <form onSubmit={handleSavePreferences} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Toggle 1 */}
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
                  Food Ready Alerts (~10 Mins)
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Notify me when the kitchen starts plating my food so I can walk to the cafe.
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyReadySoon}
                onChange={(e) => setNotifyReadySoon(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            {/* Toggle 2 */}
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
                  Kitchen Prep Estimate Changes
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Alert me if rush hour or fresh batches change my order preparation time.
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyEstimateChange}
                onChange={(e) => setNotifyEstimateChange(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            {/* Toggle 3 */}
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
                  Add-on Window Cutoff Warning
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Remind me 5 minutes before the kitchen locks changes for additional sides or drinks.
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyAddonCutoff}
                onChange={(e) => setNotifyAddonCutoff(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            {/* Toggle 4 */}
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
                  Exclusive Deals & Chef Specials
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Receive limited-time discounts and seasonal specialty item alerts.
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyDeals}
                onChange={(e) => setNotifyDeals(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            {/* Toggle 5 */}
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
                  Email / Instant Order Notifications
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                  Send tax receipts, order confirmations, and cooking updates directly to your email address.
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', marginTop: '2px', cursor: 'pointer' }}
              />
            </label>

            <button
              type="submit"
              style={{
                marginTop: '10px',
                padding: '13px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '14.5px',
                fontWeight: 850,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 14px var(--primary-glow)',
                transition: 'transform 0.15s ease',
              }}
            >
              Save Notification Preferences
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
