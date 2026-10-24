'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { PlayCircle, ChevronUp, ChevronDown, CheckCircle, Sparkles } from 'lucide-react';

interface FlowSwitcherProps {
  onNavigate: (view: string) => void;
  onOpenCart?: () => void;
}

export const FlowSwitcher: React.FC<FlowSwitcherProps> = ({ onNavigate, onOpenCart }) => {
  const [minimized, setMinimized] = useState(false);
  const { setCurrentRole, addToCart, menuItems, orders } = useApp();

  const handleFlow1 = () => {
    // Flow 1: browse menu -> cart -> place order -> track order
    setCurrentRole('customer');
    onNavigate('menu');
  };

  const handleFlow2 = () => {
    // Flow 2: scan QR -> reserved-table message & options
    setCurrentRole('customer');
    onNavigate('table-qr');
  };

  const handleFlow3 = () => {
    // Flow 3: edit order in stage 1 vs stage 2
    setCurrentRole('customer');
    onNavigate('order-edit');
  };

  const handleFlow4 = () => {
    // Flow 4: kitchen marks order ready -> cashier records cash
    setCurrentRole('kitchen_staff');
    onNavigate('staff-kitchen');
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9000,
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        padding: minimized ? '6px 14px' : '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backdropFilter: 'blur(12px)',
        transition: 'all 0.2s ease',
        maxWidth: '92vw',
        overflowX: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
        <Sparkles size={16} color="var(--primary)" />
        <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '0.04em' }}>
          PROTOTYPE FLOWS:
        </span>
      </div>

      {!minimized && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
          <button
            onClick={handleFlow1}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>1️⃣ Menu → Checkout → Track</span>
          </button>

          <button
            onClick={handleFlow2}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>2️⃣ QR Scan → Reserved Alert</span>
          </button>

          <button
            onClick={handleFlow3}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>3️⃣ Edit Stage 1 vs Stage 2</span>
          </button>

          <button
            onClick={handleFlow4}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>4️⃣ Kitchen Ready → Cashier Cash</span>
          </button>
        </div>
      )}

      <button
        onClick={() => setMinimized(!minimized)}
        style={{
          padding: '4px',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          borderRadius: '4px',
        }}
        title={minimized ? 'Expand flows' : 'Collapse flows'}
      >
        {minimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </div>
  );
};
