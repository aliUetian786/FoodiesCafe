'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { MapPin, Phone, Clock, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';

export const BranchesPage: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  const { branches, setCurrentBranchId } = useApp();

  return (
    <div style={{ maxWidth: '1100px', margin: '30px auto 60px', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
          Our Multi-Branch Network
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginTop: '8px' }}>
          Centrally managed with live table status and dedicated kitchen teams in 3 prime cities.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {branches.map((b) => (
          <div
            key={b.id}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '28px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {b.city} REGION
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  {b.name}
                </h3>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: b.isOpen ? 'var(--status-ready-bg)' : 'var(--status-cancelled-bg)',
                  color: b.isOpen ? 'var(--status-ready-text)' : 'var(--status-cancelled-text)',
                }}
              >
                {b.isOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <MapPin size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{b.address}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={17} color="var(--primary)" style={{ flexShrink: 0 }} />
                <span>{b.openingHours}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={17} color="var(--primary)" style={{ flexShrink: 0 }} />
                <span>{b.phone}</span>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--bg-card-subtle)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>⏱️ <strong>Est. Prep Time:</strong> {b.prepTimeEstimateMin} mins</div>
              <div>⚡ <strong>Full Edit Window:</strong> {b.fullEditWindowMin} mins after placing</div>
              <div>🔒 <strong>Add-ons Deadline:</strong> {b.stopAddOnsMinBeforeReady} mins before ready</div>
            </div>

            <button
              onClick={() => {
                setCurrentBranchId(b.id);
                onNavigate('menu');
              }}
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px var(--primary-glow)',
                marginTop: 'auto',
              }}
            >
              <span>Order from this Branch</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
