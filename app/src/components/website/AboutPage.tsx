'use client';

import React from 'react';
import { ShieldCheck, Heart, Sparkles, Award, Coffee, UtensilsCrossed } from 'lucide-react';

export const AboutPage: React.FC<{ onNavigate: (v: string) => void }> = ({ onNavigate }) => {
  return (
    <div style={{ maxWidth: '1000px', margin: '30px auto 60px', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <Sparkles size={16} />
          <span>Our Story & Philosophy</span>
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: 800, marginTop: '8px', color: 'var(--text-main)' }}>
          Authentic Pakistani Culinary Heritage
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '680px', margin: '12px auto 0', lineHeight: 1.6 }}>
          Founded with a simple vision: to bring honest, authentic Pakistani flavors, pure desi ghee preparations, and genuine hospitality under one clean, modern roof.
        </p>
      </div>

      <div style={{ borderRadius: '20px', overflow: 'hidden', height: '360px', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-color)' }}>
        <img src="/hero-bg.jpg" alt="Restaurant Interior" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '28px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <UtensilsCrossed size={22} />
          </div>
          <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '8px' }}>Purity in Every Handi</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            We source 100% halal fresh poultry and beef daily from vetted organic suppliers. Never frozen, never compromised. Cooked in pure desi ghee and pressed cold oils.
          </p>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '28px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <ShieldCheck size={22} />
          </div>
          <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '8px' }}>Open Kitchen & Hygiene</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Our open kitchen displays state-of-the-art stainless steel workspaces, copper handis, and temperature-controlled storage ensuring immaculate food safety.
          </p>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '28px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <Heart size={22} />
          </div>
          <h3 style={{ fontSize: '19px', fontWeight: 700, marginBottom: '8px' }}>Warm Family Ambiance</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Spacious family halls, dedicated prayer spaces, clean restrooms, and friendly attendants across all Lahore, Islamabad, and Karachi locations.
          </p>
        </div>
      </div>

      <div style={{ backgroundColor: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-lg)', padding: '36px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px' }}>Ready to Experience Foodies Cafe?</h2>
        <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto 24px' }}>
          Explore our seasonal specialties or scan your on-table QR code when dining in.
        </p>
        <button
          onClick={() => onNavigate('menu')}
          style={{
            padding: '12px 28px',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: '14px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 6px 18px var(--primary-glow)',
          }}
        >
          View Full Menu & Order
        </button>
      </div>
    </div>
  );
};
