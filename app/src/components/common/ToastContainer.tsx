'use client';

import React, { useRef, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';

const DISMISS_DISTANCE = 90; // px to the right
const DISMISS_VELOCITY = 0.6; // px per ms (a quick flick also dismisses)

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '84px',
        right: '24px',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '380px',
        width: 'calc(100% - 48px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.slice(0, 1).map((toast) => (
        <SwipeableToast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

/** One toast: swipe it to the right (touch or mouse) to dismiss it, like a phone notification. */
function SwipeableToast({
  toast,
  onDismiss,
}: {
  toast: { id: string; type?: string; title?: string; message?: string };
  onDismiss: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const start = useRef<{ x: number; y: number; t: number; active: boolean } | null>(null);

  const icon = (() => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={20} color="#16A34A" />;
      case 'error':
        return <XCircle size={20} color="#DC2626" />;
      case 'warning':
        return <AlertCircle size={20} color="#D97706" />;
      default:
        return <Info size={20} color="#2563EB" />;
    }
  })();

  const dismissWithSlide = () => {
    setLeaving(true);
    setDx(480);
    window.setTimeout(onDismiss, 170);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return; // let the X button work normally
    start.current = { x: e.clientX, y: e.clientY, t: performance.now(), active: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const moveX = e.clientX - s.x;
    const moveY = e.clientY - s.y;
    if (!s.active) {
      if (Math.abs(moveX) < 8 || Math.abs(moveX) < Math.abs(moveY)) return; // vertical scroll wins
      s.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDx(Math.max(0, moveX));
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s || !s.active) return;
    const moveX = Math.max(0, e.clientX - s.x);
    const velocity = moveX / Math.max(1, performance.now() - s.t);
    if (moveX > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) dismissWithSlide();
    else setDx(0);
  };

  return (
    <div
      role="status"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
      style={{
        backgroundColor: 'var(--bg-card)',
        color: 'var(--text-main)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        animation: 'fadeIn 0.2s ease-out',
        pointerEvents: 'auto',
        touchAction: 'pan-y',
        userSelect: 'none',
        cursor: dx > 0 ? 'grabbing' : 'grab',
        transform: `translateX(${dx}px)`,
        opacity: Math.max(0, 1 - dx / 320),
        transition: start.current?.active && !leaving ? 'none' : 'transform 0.17s ease-out, opacity 0.17s ease-out',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{toast.title}</div>
        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
          {toast.message}
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        style={{
          color: 'var(--text-muted)',
          padding: '6px',
          borderRadius: '6px',
          cursor: 'pointer',
          minWidth: '32px',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
