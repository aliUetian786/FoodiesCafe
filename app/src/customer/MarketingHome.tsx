'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Interactive3DCard } from '@/components/common/Interactive3DCard';
import {
  QrCode,
  Utensils,
  MapPin,
  Clock,
  Banknote,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Phone,
  ShieldCheck,
  Flame,
  Plus,
  ShoppingBag,
} from 'lucide-react';

interface MarketingHomeProps {
  onNavigate: (view: string) => void;
  onOpenItemModal?: (item: any) => void;
}

export const MarketingHome: React.FC<MarketingHomeProps> = ({
  onNavigate,
  onOpenItemModal,
}) => {
  const {
    branches,
    menuItems,
    currentBranchId,
    setCurrentBranchId,
    footerSettings,
    heroBanners,
    dealCard,
    addToCart,
    addToast,
  } = useApp();

  const [currentSlide, setCurrentSlide] = useState(0);
  // Click handler for Deal Card: navigate directly to menu
  const handleDealClick = () => {
    onNavigate('menu');
  };

  // Click handler for Featured Menu Items: navigate directly to that item in menu page
  const handleItemCardClick = (item: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('foodies_target_item', item.id);
    }
    onNavigate('menu');
  };

  // Auto-transition hero banner every 5 seconds
  useEffect(() => {
    if (!heroBanners || heroBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroBanners]);

  const activeBanner =
    heroBanners && heroBanners.length > 0
      ? heroBanners[currentSlide % heroBanners.length]
      : {
          id: 'b-default',
          title: 'Eat Fresh & Healthy, Cooked with Passion',
          subtitle:
            'Authentic clay oven dum biryanis, organic desi ghee Shinwari karahi, and gourmet smash burgers across Lahore, Islamabad & Karachi.',
          badge: 'Multi-Branch Pakistani Fine Dining & Fast Casual',
          imageUrl: '/hero-bg.jpg',
          categoryLink: 'Biryani & Rice',
          active: true,
        };

  const featuredItems = menuItems.slice(0, 4);

  return (
    <div
      className="marketing-home-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(32px, 6vw, 64px)',
        paddingBottom: '80px',
        overflowX: 'hidden',
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
      }}
    >
      {/* HERO SECTION WITH CHANGEABLE PICTURES CAROUSEL & DEAL CARD */}
      <section
        style={{
          position: 'relative',
          minHeight: 'auto',
          borderRadius: 'clamp(16px, 3vw, 24px)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          padding: 'clamp(24px, 4vw, 50px) clamp(16px, 3.5vw, 36px)',
          margin: '16px auto 0',
          maxWidth: '1280px',
          width: 'calc(100% - clamp(16px, 3vw, 32px))',
          boxSizing: 'border-box',
          backgroundImage: `linear-gradient(to right, rgba(16, 13, 11, 0.94) 0%, rgba(16, 13, 11, 0.82) 55%, rgba(16, 13, 11, 0.45) 100%), url('${activeBanner.imageUrl}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-color)',
          transition: 'background-image 0.6s ease-in-out',
        }}
      >

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
            gap: 'clamp(24px, 4vw, 40px)',
            alignItems: 'center',
            width: '100%',
            zIndex: 10,
          }}
        >
          {/* Hero Left Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '590px', width: '100%' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'rgba(217, 101, 40, 0.25)',
                border: '1px solid rgba(217, 101, 40, 0.5)',
                color: '#FFA270',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                width: 'fit-content',
              }}
            >
              <Sparkles size={14} />
              <span>{activeBanner.badge}</span>
            </div>

            <h1
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: 'clamp(34px, 4.6vw, 50px)',
                fontWeight: 800,
                lineHeight: 1.15,
                color: '#FFFFFF',
                letterSpacing: '-0.03em',
                margin: 0,
              }}
            >
              {activeBanner.title}
            </h1>
          </div>

          {/* Hero Right: 3D Interactive Deal Card Showcase (Changeable) */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '420px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Interactive3DCard
                imageSrc={dealCard.imageUrl}
                title={dealCard.title}
                subtitle=""
                tag=""
                price={dealCard.price}
                onClick={handleDealClick}
              />
            </div>
          </div>
        </div>
      </section>

      {/* SWAPPED SECTION 1: FEATURED MENU ITEMS (Signatures & Best Sellers) FIRST */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', width: 'calc(100% - clamp(16px, 3vw, 32px))', boxSizing: 'border-box' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '28px',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                color: 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Signatures & Best Sellers
            </span>
            <h2 style={{ fontSize: 'clamp(22px, 4.5vw, 30px)', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              Craving Something Special?
            </h2>
          </div>
          <button
            onClick={() => onNavigate('menu')}
            className="home-view-full-menu-btn"
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontSize: '13.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              border: 'none',
              boxShadow: '0 4px 12px var(--primary-glow)',
            }}
          >
            <span>View Full Menu</span>
            <ArrowRight size={15} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
            gap: 'clamp(14px, 2.5vw, 24px)',
          }}
        >
          {featuredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemCardClick(item)}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-md)',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <div style={{ height: 'clamp(170px, 28vw, 220px)', width: '100%', position: 'relative', overflow: 'hidden' }}>
                <img
                  src={item.image}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    backdropFilter: 'blur(6px)',
                    color: '#FFFFFF',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                  }}
                >
                  {item.category}
                </span>

                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '16px 14px',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
                    color: '#FFFFFF',
                  }}
                >
                  <h4 style={{ fontSize: '16.5px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                    {item.name}
                  </h4>
                  <div style={{ fontSize: '12px', color: '#E2E8F0', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Order in Menu</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SWAPPED SECTION 2: HOW IT WORKS IN 3 EASY STEPS (Seamless Service Experience) SECOND */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', width: 'calc(100% - clamp(16px, 3vw, 32px))', boxSizing: 'border-box' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              color: 'var(--primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Seamless Service Experience
          </span>
          <h2
            style={{
              fontSize: 'clamp(22px, 4.5vw, 32px)',
              fontWeight: 800,
              color: 'var(--text-main)',
              marginTop: '6px',
            }}
          >
            How It Works in 3 Easy Steps
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(250px, 100%), 1fr))',
            gap: 'clamp(14px, 2.5vw, 24px)',
          }}
        >
          {/* Step 1 */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: 'clamp(20px, 3vw, 32px) clamp(16px, 2.5vw, 24px)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '16px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '20px',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              01
            </div>
            <h3 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-main)' }}>
              Choose Your Branch
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Select from Gulberg Lahore, F-7 Islamabad, or Clifton Karachi. View live menu availability, prep times, and current cafe busy status.
            </p>
          </div>

          {/* Step 2 */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: 'clamp(20px, 3vw, 32px) clamp(16px, 2.5vw, 24px)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '16px',
                backgroundColor: 'var(--accent-light)',
                color: '#B45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '20px',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              02
            </div>
            <h3 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-main)' }}>
              Customize & Place Order
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Pick sizes, extras, and spice levels. Choose Dine-in (with table number or QR scan) or Takeaway pickup time. Enjoy two-stage order editing flexibility!
            </p>
          </div>

          {/* Step 3 */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: 'clamp(20px, 3vw, 32px) clamp(16px, 2.5vw, 24px)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '16px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '20px',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              03
            </div>
            <h3 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-main)' }}>
              Pay Cash at the Cafe
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Receive live countdown notifications (&quot;food ready in ~10 mins, come now!&quot;). Settle in cash at the counter or table with printed itemized receipts.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="marketing-home-footer"
        style={{
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          padding: 'clamp(24px, 4vw, 42px) clamp(14px, 2.5vw, 24px) 20px',
          maxWidth: '1280px',
          margin: '0 auto',
          width: 'calc(100% - clamp(16px, 3vw, 32px))',
          boxSizing: 'border-box',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div className="foodies-footer-grid">
          {/* Column 1: Brand & Tagline (Quality multi-branch cafe) */}
          <div className="footer-col footer-brand-col">
            <div className="footer-brand-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <img src="/logo.png" alt="Foodies Cafe" className="footer-logo-img" style={{ width: 'clamp(24px, 3.5vw, 36px)', height: 'clamp(24px, 3.5vw, 36px)', objectFit: 'contain' }} />
              <span className="footer-brand-name" style={{ fontFamily: 'Outfit', fontWeight: 800 }}>
                Foodies<span style={{ color: 'var(--primary)' }}>Cafe</span>
              </span>
            </div>
            <p className="footer-text" style={{ color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
              {footerSettings.tagline}
            </p>
          </div>

          {/* Column 2: Quick Navigation */}
          <div className="footer-col footer-nav-col">
            <h4 className="footer-heading">
              Quick Navigation
            </h4>
            <div className="footer-nav-links">
              <span onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}>Home</span>
              <span onClick={() => onNavigate('menu')} style={{ cursor: 'pointer' }}>Browse Menu</span>
              <span onClick={() => onNavigate('support')} style={{ cursor: 'pointer' }}>Help & Support</span>
            </div>
          </div>

          {/* Column 3: Branch Locations (Removed at <= 860px to make space for other elements!) */}
          <div className="footer-col footer-branch-locations">
            <h4 className="footer-heading">
              Branch Locations
            </h4>
            <div className="footer-nav-links">
              <div>📍 <strong>Gulberg III:</strong> {footerSettings.addressLahore}</div>
              <div>📍 <strong>F-7 Markaz:</strong> {footerSettings.addressIslamabad}</div>
              <div>📍 <strong>Clifton Block 4:</strong> {footerSettings.addressKarachi}</div>
            </div>
          </div>

          {/* Column 4: Customer Support */}
          <div className="footer-col footer-support-col">
            <h4 className="footer-heading">
              Customer Support
            </h4>
            <div className="footer-nav-links">
              <div>📞 {footerSettings.helpline}</div>
              <div style={{ wordBreak: 'break-word' }}>✉️ {footerSettings.email}</div>
              <div>🕒 {footerSettings.hours}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div>{footerSettings.copyrightText}</div>
        </div>
      </footer>

      {/* Footer Responsive Pattern Styles */}
      <style jsx>{`
        .foodies-footer-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: clamp(16px, 2.5vw, 32px);
          margin-bottom: 24px;
          align-items: start;
        }

        .footer-brand-name {
          font-size: clamp(14px, 2vw, 18px);
        }

        .footer-heading {
          font-size: clamp(12.5px, 1.8vw, 15px);
          font-weight: 700;
          margin-bottom: 10px;
          color: var(--text-main);
          white-space: nowrap;
        }

        .footer-text,
        .footer-nav-links {
          font-size: clamp(10.5px, 1.4vw, 13px);
          color: var(--text-secondary);
          line-height: 1.45;
          display: flex;
          flex-direction: column;
          gap: clamp(4px, 1vw, 8px);
        }

        /* At screen size <= 860px (where desktop checkout card removes):
           1. Branch locations column is removed.
           2. Quick Navigation and Customer Support stay strictly IN LINE with Quality Multi-Branch Cafe tagline.
           3. Bottom padding collapses to 0 so the footer cleanly stops scrolling as soon as its bottom meets the viewport. */
        @media (max-width: 860px) {
          .marketing-home-container {
            padding-bottom: 0 !important;
          }
          .marketing-home-footer {
            margin-bottom: 0 !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            border-bottom: none !important;
            border-left: none !important;
            border-right: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 24px 16px 20px !important;
          }
          .footer-branch-locations {
            display: none !important;
          }
          .foodies-footer-grid {
            grid-template-columns: 1.15fr 0.95fr 1.15fr !important;
            gap: 12px !important;
            align-items: start !important;
            margin-bottom: 16px !important;
          }
        }

        @media (max-width: 580px) {
          .marketing-home-container {
            padding-bottom: 0 !important;
          }
          .marketing-home-footer {
            margin-bottom: 0 !important;
            padding: 18px 12px 16px !important;
          }
          .foodies-footer-grid {
            grid-template-columns: 1.1fr 0.95fr 1.15fr !important;
            gap: 8px !important;
            align-items: start !important;
            margin-bottom: 12px !important;
          }
          .footer-brand-name {
            font-size: 12.5px !important;
          }
          .footer-logo-img {
            width: 22px !important;
            height: 22px !important;
          }
          .footer-heading {
            font-size: 11px !important;
            margin-bottom: 6px !important;
            white-space: nowrap !important;
          }
          .footer-text,
          .footer-nav-links {
            font-size: 9.5px !important;
            line-height: 1.35 !important;
            gap: 4px !important;
          }
        }

        @media (max-width: 400px) {
          .marketing-home-container {
            padding-bottom: 0 !important;
          }
          .marketing-home-footer {
            margin-bottom: 0 !important;
            padding: 16px 8px 14px !important;
          }
          .foodies-footer-grid {
            grid-template-columns: 1.05fr 0.9fr 1.15fr !important;
            gap: 6px !important;
            margin-bottom: 10px !important;
          }
          .footer-brand-name {
            font-size: 11px !important;
          }
          .footer-logo-img {
            width: 18px !important;
            height: 18px !important;
          }
          .footer-heading {
            font-size: 9.5px !important;
            margin-bottom: 4px !important;
            letter-spacing: -0.2px !important;
            white-space: nowrap !important;
          }
          .footer-text,
          .footer-nav-links {
            font-size: 8.5px !important;
            line-height: 1.25 !important;
            gap: 3px !important;
          }
        }
      `}</style>
    </div>
  );
};
