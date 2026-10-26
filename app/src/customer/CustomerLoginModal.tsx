'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Mail, X, User, Check, RefreshCw } from 'lucide-react';

interface CustomerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerLoginModal: React.FC<CustomerLoginModalProps> = ({ isOpen, onClose }) => {
  const { users, setCurrentUser, addToast } = useApp();
  const [authStep, setAuthStep] = useState<'email' | 'otp'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sentOtp, setSentOtp] = useState('');
  const [emailToken, setEmailToken] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  // 30-Second countdown timer for resending Email OTP
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  if (!isOpen) return null;

  // Auto-detect saved profile whenever an email is typed
  const handleEmailChange = (val: string) => {
    setEmail(val);
    const cleanEmail = val.trim().toLowerCase();
    if (cleanEmail.includes('@') && cleanEmail.includes('.') && typeof window !== 'undefined') {
      try {
        const registry = JSON.parse(localStorage.getItem('foodies_customer_registry') || '{}');
        // Search by email in registry
        const matched = Object.values(registry).find(
          (u: any) => u.email && u.email.toLowerCase() === cleanEmail
        ) as any;
        if (matched?.name) {
          setName(matched.name);
          if (matched.phone) setPhone(matched.phone);
          return;
        }
      } catch (e) {}

      if (users) {
        const found = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
        if (found?.name) {
          setName(found.name);
          if (found.phone) setPhone(found.phone);
        }
      }
    }
  };

  const handleSendEmailCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      addToast({
        type: 'warning',
        title: 'Valid Email Required',
        message: 'Please enter a valid email address (e.g. name@example.com).',
      });
      return;
    }

    setLoading(true);
    try {
      // Customer only submits email — server automatically dispatches using the cafe's central mail account
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          email: cleanEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send verification email.');
      }

      setSentOtp(data.devCode || '');
      if (data.emailToken) setEmailToken(data.emailToken);
      setIsDevMode(!!data.isDevMode);
      setResendCountdown(30);
      setAuthStep('otp');
      setOtpCode('');

      if (data.isRealEmailSent) {
        addToast({
          type: 'success',
          title: 'Verification Code Sent! ✉️',
          message: `A 4-digit code was sent to ${cleanEmail}. Please check your inbox!`,
        });
      } else if (data.mailError) {
        addToast({
          type: 'warning',
          title: 'Email Delivery Notice ⚠️',
          message: data.mailError,
        });
      } else {
        addToast({
          type: 'info',
          title: 'Verification Code Generated ✉️',
          message: `Verification code is ${data.devCode}.`,
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Email Delivery Failed',
        message: err.message || 'Could not send verification code. Please check your connection.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();

    if (!otpCode.trim()) {
      addToast({
        type: 'warning',
        title: 'Code Required',
        message: 'Please enter the 4-digit code sent to your email.',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          email: cleanEmail,
          code: otpCode.trim(),
          emailToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid verification code.');
      }

      // Profile retrieval strictly based on email
      let existingProfile: any = null;
      if (typeof window !== 'undefined') {
        try {
          const registry = JSON.parse(localStorage.getItem('foodies_customer_registry') || '{}');
          existingProfile = Object.values(registry).find(
            (u: any) => u.email && u.email.toLowerCase() === cleanEmail
          );
        } catch (e) {}
      }
      if (!existingProfile && users) {
        existingProfile = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
      }

      let customerName = name.trim() || existingProfile?.name || cleanEmail.split('@')[0];
      if (!customerName || customerName.toLowerCase() === 'guest customer') {
        customerName = cleanEmail.split('@')[0] || 'Valued Customer';
      }
      const customerPhone = phone.trim() || existingProfile?.phone || '+92 300 1234567';

      const loggedUser = {
        id: existingProfile?.id || `cust-${Date.now().toString().slice(-6)}`,
        name: customerName,
        email: cleanEmail,
        phone: customerPhone,
        role: existingProfile?.role || ('customer' as const),
        status: existingProfile?.status || ('active' as const),
        noShowCount: existingProfile?.noShowCount || 0,
        address: existingProfile?.address || '',
      };

      // Save profile to customer registry and active session
      if (typeof window !== 'undefined') {
        try {
          const registry = JSON.parse(localStorage.getItem('foodies_customer_registry') || '{}');
          registry[cleanEmail] = loggedUser;
          const cleanPhone = customerPhone.replace(/\D/g, '').slice(-10);
          if (cleanPhone) registry[cleanPhone] = loggedUser;

          localStorage.setItem('foodies_customer_registry', JSON.stringify(registry));
          localStorage.setItem('foodies_customer_user', JSON.stringify(loggedUser));
        } catch (e) {}
      }

      setCurrentUser(loggedUser);

      addToast({
        type: 'success',
        title: 'Signed In Successfully! ✉️',
        message: existingProfile
          ? `Welcome back, ${customerName}!`
          : `Welcome to FoodiesCafe, ${customerName}!`,
      });

      setAuthStep('email');
      setOtpCode('');
      onClose();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Verification Failed',
        message: err.message || 'Invalid verification code.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="foodies-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      {/* Dark overlay backdrop with blur */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(20, 16, 14, 0.72)',
          backdropFilter: 'blur(8px)',
        }}
        onClick={onClose}
      />

      {/* Main Login Card */}
      <div
        className="foodies-modal-card"
        style={{
          position: 'relative',
          zIndex: 10,
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          width: '100%',
          maxWidth: '420px',
          maxHeight: 'min(580px, 94vh)',
          padding: 'clamp(22px, 4vw, 30px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(14px, 2.5vw, 20px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Cafe Logo background watermark */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <div
            style={{
              width: '85%',
              height: '85%',
              backgroundImage: "url('/logo.png')",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: 'contain',
              opacity: 0.16,
            }}
          />
        </div>

        {/* Card Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2, paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
            Sign In
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Step 1: Customer Name and Email */}
        {authStep === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendEmailCode();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1 }}
          >
            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Full Name <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>(Optional)</span>
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                }}
              >
                <User size={16} color="var(--primary)" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Shahwaiz Akram"
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '13.5px',
                    fontWeight: 650,
                    color: 'var(--text-main)',
                    width: '100%',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Email Address <span style={{ color: 'var(--primary)' }}>*</span>
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                }}
              >
                <Mail size={16} color="var(--primary)" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="name@example.com"
                  autoFocus
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '13.5px',
                    fontWeight: 650,
                    color: 'var(--text-main)',
                    width: '100%',
                  }}
                />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 2px' }}>
                We will automatically send a 4-digit code to this email.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px',
                padding: '13px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 800,
                border: 'none',
                boxShadow: 'var(--shadow-md)',
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
                opacity: loading ? 0.75 : 1,
              }}
            >
              <Mail size={16} />
              <span>{loading ? 'Sending Code...' : 'Send Verification Code'}</span>
            </button>
          </form>
        ) : (
          /* Step 2: 4-digit Code Confirmation */
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', zIndex: 1 }}>
            {/* Dev Mode Banner or Info Box */}
            {isDevMode && sentOtp ? (
              <div
                style={{
                  backgroundColor: '#FFF7ED',
                  border: '1.5px dashed #F97316',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: '#9A3412',
                  fontWeight: 750,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span>✉️ Demo Verification Code:</span>
                  <span style={{ fontSize: '18px', letterSpacing: '4px', fontWeight: 900, color: '#EA580C' }}>{sentOtp}</span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#1E40AF',
                  fontWeight: 650,
                }}
              >
                Verification code dispatched to <strong>{email}</strong>. Please check your inbox or spam.
              </div>
            )}

            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Enter 4-Digit Verification Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="e.g. 5829"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1.5px solid var(--primary)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  fontSize: '22px',
                  textAlign: 'center',
                  fontWeight: 900,
                  letterSpacing: '6px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '4px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 900,
                fontSize: '14px',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: loading ? 0.75 : 1,
              }}
            >
              <Check size={16} />
              <span>{loading ? 'Verifying Code...' : 'Confirm Code & Sign In'}</span>
            </button>

            {/* 30-Second Resend Countdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <button
                type="button"
                disabled={resendCountdown > 0 || loading}
                onClick={handleSendEmailCode}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCountdown > 0 ? 'var(--text-muted)' : 'var(--primary)',
                  fontSize: '12px',
                  cursor: resendCountdown > 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <RefreshCw size={12} />
                <span>
                  {resendCountdown > 0 ? `Resend Code in ${resendCountdown}s` : 'Resend Email Code ✉️'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAuthStep('email')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                Change Email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
