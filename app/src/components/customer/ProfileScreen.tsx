'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Lock,
  Bell,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const ProfileScreen: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const { currentUser, setCurrentUser, addToast } = useApp();

  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone);
  const [email, setEmail] = useState(currentUser.email);
  const [address, setAddress] = useState(currentUser.address || 'House 14, Street 9, Model Town, Lahore');
  const [password, setPassword] = useState('••••••••');
  const [deactivationRequested, setDeactivationRequested] = useState(false);

  // Notification Preferences
  const [notifyReadySoon, setNotifyReadySoon] = useState(true);
  const [notifyEstimateChange, setNotifyEstimateChange] = useState(true);
  const [notifyAddonCutoff, setNotifyAddonCutoff] = useState(true);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUser({
      ...currentUser,
      name,
      phone,
      email,
      address,
    });
    addToast({
      type: 'success',
      title: 'Profile Updated',
      message: 'Your personal information has been saved.',
    });
  };

  const notificationsList = [
    { id: '1', title: 'Food Ready in ~10 Mins', desc: 'Order #FC-8492 is in final cooking phase at Gulberg branch. You can start coming to the cafe.', time: '10 mins ago', type: 'ready_soon' },
    { id: '2', title: 'Add-on Window Expiring in 5 Mins', desc: 'Last chance to add more naan, drinks or sides to Order #FC-8492.', time: '15 mins ago', type: 'addon' },
    { id: '3', title: 'Order Confirmed by Kitchen', desc: 'Order #FC-8492 accepted by Chef Ustaad Aslam.', time: '20 mins ago', type: 'confirmed' },
    { id: '4', title: 'Support Ticket Reply Received', desc: 'Rep Zara Noor replied to Ticket #TKT-1042.', time: '25 mins ago', type: 'support' },
  ];

  return (
    <div style={{ maxWidth: '900px', margin: '24px auto 80px', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h1 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Customer Profile & Notification Center
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Manage your verified contact details, addresses, and order alerts.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Left Column: Personal Information Form */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            padding: '24px',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Personal Details</h3>

          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Full Name
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                <User size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--text-main)', width: '100%' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Verified Phone Number
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                <Phone size={16} color="var(--text-muted)" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--text-main)', width: '100%' }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Email Address
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                <Mail size={16} color="var(--text-muted)" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--text-main)', width: '100%' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Primary Delivery Address (Lahore)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                <MapPin size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--text-main)', width: '100%' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                Account Password
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
                <Lock size={16} color="var(--text-muted)" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--text-main)', width: '100%' }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                marginTop: '6px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Update Profile Details
            </button>
          </form>

          {/* PRD Non-negotiable: NO DELETE ACCOUNT OPTION */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              🛡️ <strong>Account Policy:</strong> In compliance with cash-only cafe fraud prevention, direct customer account deletion is omitted.
            </div>
            {!deactivationRequested ? (
              <button
                type="button"
                onClick={() => {
                  setDeactivationRequested(true);
                  addToast({
                    type: 'info',
                    title: 'Deactivation Requested',
                    message: 'Your deactivation request was submitted to the platform administrator for review.',
                  });
                }}
                style={{
                  marginTop: '10px',
                  fontSize: '12.5px',
                  color: 'var(--text-secondary)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Request account deactivation for admin review
              </button>
            ) : (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#EA580C', fontWeight: 700 }}>
                ⏳ Deactivation request pending administrator review.
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Notifications & Preferences */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Preferences */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Notification Preferences</h3>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13.5px', cursor: 'pointer' }}>
              <span>&ldquo;Ready in ~10 mins, come now!&rdquo; alerts</span>
              <input
                type="checkbox"
                checked={notifyReadySoon}
                onChange={(e) => setNotifyReadySoon(e.target.checked)}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13.5px', cursor: 'pointer' }}>
              <span>Kitchen preparation estimate adjustments</span>
              <input
                type="checkbox"
                checked={notifyEstimateChange}
                onChange={(e) => setNotifyEstimateChange(e.target.checked)}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13.5px', cursor: 'pointer' }}>
              <span>Add-on window closing warnings</span>
              <input
                type="checkbox"
                checked={notifyAddonCutoff}
                onChange={(e) => setNotifyAddonCutoff(e.target.checked)}
              />
            </label>
          </div>

          {/* In-app Notification Feed */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '24px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Recent Notification Feed</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notificationsList.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-main)' }}>
                      {n.title}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{n.time}</span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                    {n.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
