'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Phone, Mail, Lock, User, KeyRound, CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react';

interface AuthScreenProps {
  initialTab?: 'login' | 'register';
  onNavigate: (view: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ initialTab = 'login', onNavigate }) => {
  const { setCurrentUser, addToast } = useApp();
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);

  // Form fields
  const [identifier, setIdentifier] = useState('03015551234');
  const [password, setPassword] = useState('••••••••');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Verification step for registration
  const [regStep, setRegStep] = useState<'details' | 'verify'>('details');
  const [otpCode, setOtpCode] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUser({
      id: 'cust-demo',
      name: 'Zeeshan Ahmed',
      phone: '+92 301 5551234',
      email: 'zeeshan@example.com',
      address: 'House 14, Street 9, Model Town, Lahore',
      role: 'customer',
      status: 'active',
      noShowCount: 0,
    });
    addToast({
      type: 'success',
      title: 'Welcome Back!',
      message: 'Logged in as Zeeshan Ahmed. Happy ordering!',
    });
    onNavigate('menu');
  };

  const handleStartRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      addToast({
        type: 'warning',
        title: 'Missing Details',
        message: 'Please provide both your name and Pakistani mobile number.',
      });
      return;
    }
    setRegStep('verify');
    addToast({
      type: 'info',
      title: 'Email Code Sent',
      message: `A 4-digit verification code has been sent to ${email || 'your email'}. (Use demo code: 7890)`,
    });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUser({
      id: `cust-${Date.now()}`,
      name,
      phone,
      email: email || 'user@foodiescafe.pk',
      address: 'Lahore, Pakistan',
      role: 'customer',
      status: 'active',
      noShowCount: 0,
    });
    addToast({
      type: 'success',
      title: 'Account Verified!',
      message: 'Your FoodiesCafe account has been successfully created.',
    });
    onNavigate('menu');
  };

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '40px auto 80px',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Header with Logo */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 12px',
              borderRadius: '16px',
              backgroundColor: '#FFFFFF',
              padding: '6px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <img src="/logo.png" alt="Foodies Cafe" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            {tab === 'login' ? 'Welcome Back' : 'Create Customer Account'}
          </h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {tab === 'login'
              ? 'Log in to track orders, dine-in at tables & edit meals'
              : 'Sign up with phone verification for cash-only cafe orders'}
          </p>
        </div>

        {/* Tab Toggle */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-card-subtle)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            onClick={() => {
              setTab('login');
              setRegStep('details');
            }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: tab === 'login' ? 'var(--bg-card)' : 'transparent',
              color: tab === 'login' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: tab === 'login' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer',
            }}
          >
            Login
          </button>
          <button
            onClick={() => setTab('register')}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: tab === 'register' ? 'var(--bg-card)' : 'transparent',
              color: tab === 'register' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '14px',
              boxShadow: tab === 'register' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer',
            }}
          >
            Register
          </button>
        </div>

        {/* LOGIN FORM */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Phone Number or Email
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                }}
              >
                <Phone size={18} color="var(--text-muted)" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="0300 1234567 or email"
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '14px',
                    color: 'var(--text-main)',
                    width: '100%',
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <span
                  onClick={() =>
                    addToast({
                      type: 'info',
                      title: 'Reset Password',
                      message: 'Password reset link sent to your registered contact.',
                    })
                  }
                  style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Forgot password?
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                }}
              >
                <Lock size={18} color="var(--text-muted)" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '14px',
                    color: 'var(--text-main)',
                    width: '100%',
                  }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                marginTop: '8px',
                padding: '13px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '15px',
                fontWeight: 700,
                boxShadow: '0 4px 14px var(--primary-glow)',
                cursor: 'pointer',
              }}
            >
              Log In to Account
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {tab === 'register' && (
          <>
            {regStep === 'details' ? (
              <form onSubmit={handleStartRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                    Full Name *
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                    }}
                  >
                    <User size={18} color="var(--text-muted)" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Ali Raza"
                      style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--text-main)', width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                    Pakistani Mobile Number (for verification) *
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                    }}
                  >
                    <Phone size={18} color="var(--text-muted)" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0300 1234567"
                      style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--text-main)', width: '100%' }}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                    Email Address (Optional)
                  </label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                    }}
                  >
                    <Mail size={18} color="var(--text-muted)" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ali@example.com"
                      style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', color: 'var(--text-main)', width: '100%' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  style={{
                    marginTop: '8px',
                    padding: '13px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px var(--primary-glow)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>Continue to Phone Verification</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            ) : (
              /* Verification Step */
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ backgroundColor: 'var(--primary-light)', padding: '14px', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px dashed var(--primary)' }}>
                  <ShieldCheck size={28} color="var(--primary)" style={{ margin: '0 auto 6px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                    Enter 4-Digit Verification Code
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Sent to <strong>{phone}</strong> (Demo code: 7890)
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'var(--bg-input)',
                    border: '2px solid var(--primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                  }}
                >
                  <input
                    type="text"
                    maxLength={4}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="7 8 9 0"
                    style={{
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '24px',
                      fontWeight: 800,
                      letterSpacing: '0.4em',
                      textAlign: 'center',
                      color: 'var(--text-main)',
                      width: '160px',
                    }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setRegStep('details')}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '13.5px',
                      fontWeight: 600,
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 2,
                      padding: '12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: 700,
                      boxShadow: '0 4px 14px var(--primary-glow)',
                    }}
                  >
                    Confirm & Finish Registration
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* Security Policy Notice: No Delete Account */}
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '16px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          🔒 Cash-only abuse prevention: Phone verification required. Per cafe policy, customer accounts are verified and cannot be self-deleted (deactivation request available via profile).
        </div>
      </div>
    </div>
  );
};
