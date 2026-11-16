'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Mail, X, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { store } from '@/redux/store';
import { setCurrentUser as setReduxUser } from '@/redux/slices/uiSlice';
import { HistoricalLoadingModal } from '@/components/common/HistoricalLoadingModal';

interface CustomerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CustomerLoginModal: React.FC<CustomerLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { users, setCurrentUser, addToast } = useApp();
  const [authStep, setAuthStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
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

  const handleEmailChange = (val: string) => {
    setEmail(val);
  };

  const handleSendEmailCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      addToast({
        type: 'warning',
        title: 'Valid Gmail / Email Required',
        message: 'Please enter a valid Gmail address (e.g. name@gmail.com).',
      });
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      // Customer only submits email — server automatically dispatches using the cafe's central mail account
      const res = await fetch('/api/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          action: 'send',
          email: cleanEmail,
        }),
      });
      clearTimeout(timeoutId);

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
          message: 'A 4-digit code was sent. Please check your inbox!',
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
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError' || err?.message?.includes('aborted');
      if (isTimeout) {
        // Network timeout fallback: allow proceed with dev code
        const fallbackOtp = '5829';
        setSentOtp(fallbackOtp);
        setIsDevMode(true);
        setResendCountdown(30);
        setAuthStep('otp');
        setOtpCode('');
        addToast({
          type: 'info',
          title: 'Verification Code (Demo Mode) ✉️',
          message: `Request timed out. You can use demo verification code: ${fallbackOtp}.`,
        });
      } else {
        addToast({
          type: 'error',
          title: 'Email Delivery Failed',
          message: err.message || 'Could not send verification code. Please check your connection.',
        });
      }
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

      const usernamePart = cleanEmail.split('@')[0];
      const derivedName = usernamePart
        ? usernamePart.charAt(0).toUpperCase() + usernamePart.slice(1)
        : 'Customer';
      let customerName = existingProfile?.name || derivedName;
      if (customerName.toLowerCase() === 'guest customer') {
        customerName = derivedName;
      }
      const customerPhone = existingProfile?.phone || '';

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

          if (data.sessionToken) {
            localStorage.setItem('foodies_customer_session', data.sessionToken);
          }
          localStorage.setItem('foodies_customer_registry', JSON.stringify(registry));
          localStorage.setItem('foodies_customer_user', JSON.stringify(loggedUser));
          localStorage.setItem('foodies_customer_login_time', Date.now().toString());
        } catch (e) {}
      }

      setCurrentUser(loggedUser);
      store.dispatch(setReduxUser(loggedUser));

      addToast({
        type: 'success',
        title: 'Signed In Successfully! ✉️',
        message: existingProfile
          ? `Welcome back, ${customerName}!`
          : `Welcome to FoodiesCafe, ${customerName}!`,
      });

      setAuthStep('email');
      setOtpCode('');
      onSuccess?.();
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
    <>
    <div
      className="foodies-modal-overlay foodies-modal-centered"
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

      {/* Main Login Card - Fixed 420px height & 420px max-width for identical card size in both Gmail and OTP steps */}
      <div
        className="foodies-modal-card foodies-login-card"
        style={{
          position: 'relative',
          zIndex: 10,
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          border: '1.5px solid var(--border-color)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          width: '100%',
          maxWidth: '420px',
          height: '420px',
          minHeight: '420px',
          maxHeight: '420px',
          padding: '24px 26px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2, paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
              {authStep === 'email' ? 'Sign In' : 'Verify Code'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {authStep === 'email'
                ? 'Enter your Gmail to receive a code'
                : 'Check your Gmail for the 4-digit code'}
            </p>
          </div>
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

        {/* Step 1: Strictly Ask Only for Gmail */}
        {authStep === 'email' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendEmailCode();
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '18px',
              position: 'relative',
              zIndex: 1,
              flex: 1,
              padding: '10px 0',
            }}
          >
            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: '8px' }}>
                Gmail / Email Address <span style={{ color: 'var(--primary)' }}>*</span>
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                }}
              >
                <Mail size={18} color="var(--primary)" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="name@gmail.com"
                  autoFocus
                  style={{
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    fontSize: '14px',
                    fontWeight: 650,
                    color: 'var(--text-main)',
                    width: '100%',
                  }}
                />
              </div>
              <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '6px 0 0 2px' }}>
                We will automatically send a 4-digit code to this Gmail address.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
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
          /* Step 2: 4-digit Code Confirmation (Exact Same 420px Card Size) */
          <form
            onSubmit={handleVerifyOtp}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
              position: 'relative',
              zIndex: 1,
              flex: 1,
              padding: '6px 0',
            }}
          >
            {/* Notice showing the destination email and Spam reminder */}
            <div
              style={{
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Code sent to: <strong style={{ color: 'var(--primary)', wordBreak: 'break-all' }}>{email.trim().toLowerCase()}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  color: '#B45309',
                  backgroundColor: '#FEF3C7',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontWeight: 700,
                }}
              >
                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                <span>Can&apos;t find it? Check <strong>Spam folder</strong>.</span>
              </div>
            </div>

            {/* Dev Mode Banner (only if simulated in development) */}
            {isDevMode && sentOtp ? (
              <div
                style={{
                  backgroundColor: '#FFF7ED',
                  border: '1px dashed #F97316',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#9A3412',
                  fontWeight: 750,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <span>Demo Code:</span>
                <span style={{ fontSize: '16px', letterSpacing: '3px', fontWeight: 900, color: '#EA580C' }}>{sentOtp}</span>
              </div>
            ) : null}

            <div>
              <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', textAlign: 'center' }}>
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
                  padding: '10px 14px',
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
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 850,
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
              <span>{loading ? 'Verifying...' : 'Confirm Code & Sign In'}</span>
            </button>

            {/* 30-Second Resend Countdown */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                disabled={resendCountdown > 0 || loading}
                onClick={handleSendEmailCode}
                style={{
                  background: 'none',
                  border: 'none',
                  color: resendCountdown > 0 ? 'var(--text-muted)' : 'var(--primary)',
                  fontSize: '11.5px',
                  cursor: resendCountdown > 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RefreshCw size={11} />
                <span>
                  {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend Code'}
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
                Change Gmail
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
    <HistoricalLoadingModal visible={loading} />
    </>
  );
};
