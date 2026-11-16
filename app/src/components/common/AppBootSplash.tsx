import React from 'react';

/**
 * Lightweight branded splash shown for the first paint (server HTML + hydration),
 * before the stateful app renders on the client. Pure CSS, no state.
 */
export function AppBootSplash({ label = 'Preparing your table…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        backgroundColor: 'var(--bg-main)',
        padding: '24px',
      }}
    >
      <div
        style={{
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 900,
          fontSize: '34px',
          letterSpacing: '-0.03em',
          color: 'var(--text-main)',
          lineHeight: 1,
        }}
      >
        Foodies<span style={{ color: 'var(--primary)' }}>Cafe</span>
      </div>
      <div className="app-boot-spinner" aria-hidden="true" />
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
