'use client';

import React from 'react';

interface HistoricalLoadingModalProps {
  visible: boolean;
  title?: string;
  message?: string;
}

// Minimal loader: just a fast-rotating circular arc, no background card.
export const HistoricalLoadingModal: React.FC<HistoricalLoadingModalProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <svg
        width="44"
        height="44"
        viewBox="0 0 50 50"
        style={{ animation: 'foodiesCircleSpin 0.55s linear infinite', willChange: 'transform' }}
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="#E07A5F"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray="90 150"
        />
      </svg>
    </div>
  );
};
