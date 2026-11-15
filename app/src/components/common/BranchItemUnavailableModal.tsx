'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { AlertTriangle, MapPin, X, Trash2 } from 'lucide-react';

export const BranchItemUnavailableModal: React.FC = () => {
  const { branchUnavailableModal, closeBranchUnavailableModal, cart, removeFromCart } = useApp();

  if (!branchUnavailableModal || !branchUnavailableModal.visible) {
    return null;
  }

  const { branchName, itemNames } = branchUnavailableModal;

  const hasItemInCart = cart && cart.some((c) =>
    itemNames.some((n) => n.toLowerCase() === c.name.toLowerCase())
  );

  const handleRemoveFromCart = () => {
    itemNames.forEach((n) => {
      const found = cart.find((c) => c.name.toLowerCase() === n.toLowerCase());
      if (found) {
        removeFromCart(found.id);
      }
    });
    closeBranchUnavailableModal();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeInModal 0.2s ease-out',
      }}
      onClick={closeBranchUnavailableModal}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '18px',
          padding: '24px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          border: '1.5px solid #FCD34D',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '12px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close icon top-right */}
        <button
          onClick={closeBranchUnavailableModal}
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--text-muted)',
            borderRadius: '6px',
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Warning Icon Circle */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '28px',
            backgroundColor: '#FEF3C7',
            border: '2px solid #FDE68A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '2px',
          }}
        >
          <AlertTriangle size={30} color="#D97706" />
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '17px',
            fontWeight: 800,
            color: '#1F2937',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Item Not Available at this Branch
        </h3>

        {/* Branch Location Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: '#FEF2F2',
            padding: '4px 12px',
            borderRadius: '20px',
            border: '1px solid #FECACA',
            fontSize: '12px',
            fontWeight: 750,
            color: 'var(--primary)',
          }}
        >
          <MapPin size={13} color="var(--primary)" />
          <span>{branchName}</span>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '13px',
            color: '#4B5563',
            margin: '4px 0 0 0',
            lineHeight: 1.45,
          }}
        >
          The selected item is currently out of stock or not served at this branch:
        </p>

        {/* Unavailable items list */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            margin: '4px 0',
            maxHeight: '130px',
            overflowY: 'auto',
          }}
        >
          {itemNames.map((name, i) => (
            <div
              key={i}
              style={{
                backgroundColor: '#FEE2E2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 750,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>•</span>
              <span style={{ flex: 1 }}>{name}</span>
            </div>
          ))}
        </div>

        {/* Available elsewhere callout */}
        <div
          style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            padding: '10px 14px',
            borderRadius: '10px',
            width: '100%',
            boxSizing: 'border-box',
            textAlign: 'left',
          }}
        >
          <p style={{ margin: 0, fontSize: '12px', color: '#166534', lineHeight: 1.45 }}>
            💡 <strong>Available elsewhere:</strong> This item is available at our other branches across Pakistan!
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '8px' }}>
          {hasItemInCart && (
            <button
              type="button"
              onClick={handleRemoveFromCart}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#FEE2E2',
                border: '1px solid #FCA5A5',
                color: '#DC2626',
                fontWeight: 750,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Trash2 size={14} />
              <span>Remove from Cart</span>
            </button>
          )}

          <button
            type="button"
            onClick={closeBranchUnavailableModal}
            style={{
              flex: 1,
              padding: '11px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 10px var(--primary-glow)',
            }}
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};

