'use client';

import React from 'react';
import { Clock, AlertTriangle, UtensilsCrossed, X, MapPin } from 'lucide-react';
import { Branch } from '@/types/cafe';

interface AllBranchesClosedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBrowseMenu?: () => void;
  branches?: Branch[];
  context?: 'home' | 'checkout_blocked';
}

export const AllBranchesClosedModal: React.FC<AllBranchesClosedModalProps> = ({
  isOpen,
  onClose,
  onBrowseMenu,
  branches = [],
  context = 'home',
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        backgroundColor: 'rgba(15, 23, 42, 0.58)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '22px',
          border: '1px solid #FECACA',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.24)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Accent Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #FEF2F2 0%, #FFF7ED 100%)',
            padding: '22px 24px 18px',
            borderBottom: '1px solid #FECACA',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '14px',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 6px 16px rgba(220, 38, 38, 0.28)',
              }}
            >
              <Clock size={23} />
            </div>
            <div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#DC2626',
                  backgroundColor: '#FEE2E2',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  marginBottom: '4px',
                }}
              >
                {context === 'checkout_blocked' ? 'Checkout Unavailable' : 'Late Night / Closed Notice'}
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: '18.5px',
                  fontWeight: 850,
                  color: '#0F172A',
                  fontFamily: 'Outfit, sans-serif',
                  lineHeight: 1.2,
                }}
              >
                All Branches Are Closed
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              border: '1px solid #E2E8F0',
              backgroundColor: '#FFFFFF',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p
            style={{
              margin: 0,
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: '#334155',
              fontWeight: 500,
            }}
          >
            {context === 'checkout_blocked'
              ? 'All Foodies Cafe branches are currently marked closed for the day or due to late-night closing hours. You cannot proceed after the menu page with checkout right now.'
              : 'All Foodies Cafe branches are currently closed for the day or due to late-night timing. You are welcome to explore our menu and categories, but you cannot proceed after the menu page with checkout until a branch reopens.'}
          </p>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FDE68A',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', lineHeight: 1.45 }}>
              Menu browsing is available, but checkout after the menu page is paused while all branches are closed.
            </span>
          </div>

          {branches.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                padding: '10px 12px',
                borderRadius: '12px',
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                Branch Status & Hours
              </div>
              {branches.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    padding: '4px 0',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#1E293B' }}>
                    <MapPin size={12} color="var(--primary)" />
                    {b.name}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626' }}>
                    Closed ({b.openingHours || '11:00 AM - 1:00 AM'})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 24px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {context === 'home' && onBrowseMenu && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onBrowseMenu();
              }}
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px var(--primary-glow)',
              }}
            >
              <UtensilsCrossed size={16} />
              <span>Browse Menu Only</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              flex: context === 'checkout_blocked' || !onBrowseMenu ? 1 : undefined,
              padding: '12px 18px',
              borderRadius: '12px',
              border: '1px solid #CBD5E1',
              backgroundColor: context === 'checkout_blocked' ? 'var(--primary)' : '#F8FAFC',
              color: context === 'checkout_blocked' ? '#FFFFFF' : '#334155',
              fontWeight: 800,
              fontSize: '13.5px',
              cursor: 'pointer',
            }}
          >
            {context === 'checkout_blocked' ? 'Understood, Back to Menu' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

