'use client';

import React from 'react';
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
} from 'lucide-react';

interface MarketingHomeProps {
  onNavigate: (view: string) => void;
  onOpenItemModal?: (item: any) => void;
}

export const MarketingHome: React.FC<MarketingHomeProps> = ({
  onNavigate,
  onOpenItemModal,
}) => {
  const { branches, menuItems, currentBranchId, setCurrentBranchId } = useApp();

  const featuredItems = menuItems.slice(0, 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '64px', paddingBottom: '80px' }}>
      {/* HERO SECTION */}
      <section
        style={{
          position: 'relative',
          minHeight: '620px',
          borderRadius: '24px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          padding: '60px 40px',
          margin: '20px auto 0',
          maxWidth: '1280px',
          width: 'calc(100% - 32px)',
          backgroundImage: `linear-gradient(to right, rgba(20, 17, 15, 0.94) 0%, rgba(20, 17, 15, 0.8) 55%, rgba(20, 17, 15, 0.4) 100%), url('/hero-bg.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '40px',
            alignItems: 'center',
            width: '100%',
            zIndex: 10,
          }}
        >
          {/* Hero Left Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '580px' }}>
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
              <span>Multi-Branch Pakistani Fine Dining & Fast Casual</span>
            </div>

            <h1
              style={{
                fontFamily: 'Outfit, sans-serif',
                fontSize: ' clamp(36px, 5vw, 54px)',
                fontWeight: 800,
                lineHeight: 1.1,
                color: '#FFFFFF',
                letterSpacing: '-0.03em',
                margin: 0,
              }}
            >
              Eat Fresh & Healthy,{' '}
              <span style={{ color: 'var(--primary)', textShadow: '0 0 30px rgba(217,101,40,0.5)' }}>
                Cooked with Passion.
              </span>
            </h1>

            <p style={{ fontSize: '16px', lineHeight: 1.6, color: '#D6CEC7', margin: 0 }}>
              Authentic clay oven dum biryanis, organic desi ghee Shinwari karahi, and gourmet smash burgers across Lahore, Islamabad & Karachi. Order ahead from home or scan your table QR code inside the cafe.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#FCD34D',
                fontSize: '13.5px',
                fontWeight: 700,
              }}
            >
              <Banknote size={18} />
              <span>CASH ONLY — Pay cash at the cafe with complete peace of mind</span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '6px' }}>
              <button
                onClick={() => onNavigate('menu')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 28px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--primary)',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: 800,
                  boxShadow: '0 8px 24px var(--primary-glow)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease',
                }}
              >
                <Utensils size={18} />
                <span>Order Now</span>
                <ArrowRight size={16} />
              </button>

              <button
                onClick={() => onNavigate('table-qr')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '14px 24px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <QrCode size={18} color="#FBBF24" />
                <span>Scan Table QR</span>
              </button>
            </div>
          </div>

          {/* Hero Right: 3D Interactive Card Showcase */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ maxWidth: '420px', width: '100%' }}>
              <Interactive3DCard
                imageSrc="/food-biryani.jpg"
                title="Royal Chicken Dum Biryani"
                subtitle="Slow-steamed in copper handi with saffron & house spices"
                price="Rs. 650"
                tag="🌟 TODAY'S CHEF SPECIAL"
                onClick={() => onNavigate('menu')}
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (3 STEPS) */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', width: 'calc(100% - 32px)' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
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
              fontSize: '32px',
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
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Step 1 */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '32px 24px',
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
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '22px',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              01
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
              Choose Your Branch
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Select from Gulberg Lahore, F-7 Islamabad, or Clifton Karachi. View live menu availability, prep times, and current cafe busy status.
            </p>
          </div>

          {/* Step 2 */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '32px 24px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                backgroundColor: 'var(--accent-light)',
                color: '#B45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '22px',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              02
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
              Customize & Place Order
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Pick sizes, extras, and spice levels. Choose Dine-in (with table number or QR scan) or Takeaway pickup time. Enjoy two-stage order editing flexibility!
            </p>
          </div>

          {/* Step 3 */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              padding: '32px 24px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '22px',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              03
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
              Pay Cash at the Cafe
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Receive live countdown notifications (&quot;food ready in ~10 mins, come now!&quot;). Settle in cash at the counter or table with printed itemized receipts.
            </p>
          </div>
        </div>
      </section>

      {/* BRANCH PICKER CARDS */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', width: 'calc(100% - 32px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
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
              Locate Our Cafes
            </span>
            <h2 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              Select a Branch to Order
            </h2>
          </div>
          <button
            onClick={() => onNavigate('branches')}
            style={{
              color: 'var(--primary)',
              fontSize: '14px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>View Branch Details</span>
            <ArrowRight size={16} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {branches.map((b) => {
            const isSelected = b.id === currentBranchId;
            return (
              <div
                key={b.id}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  padding: '24px',
                  boxShadow: isSelected ? '0 10px 30px var(--primary-glow)' : 'var(--shadow-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      {b.name}
                    </h3>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {b.city}, Pakistan
                    </div>
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
                    {b.isOpen ? 'OPEN NOW' : 'CLOSED'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={16} color="var(--primary)" />
                    <span>{b.address}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} color="var(--primary)" />
                    <span>{b.openingHours}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Phone size={16} color="var(--primary)" />
                    <span>{b.phone}</span>
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: 'var(--bg-card-subtle)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    🍽️ Dine-in
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: 'var(--bg-card-subtle)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    🛍️ Takeaway
                  </span>
                  {b.isBusy && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--status-preparing-bg)',
                        color: 'var(--status-preparing-text)',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      ⚠️ Busy: +15m Prep
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    setCurrentBranchId(b.id);
                    onNavigate('menu');
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '12px 18px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-card-subtle)',
                    color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{isSelected ? 'Browse Menu' : 'Select This Branch'}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* FEATURED MENU ITEMS */}
      <section style={{ maxWidth: '1280px', margin: '0 auto', width: 'calc(100% - 32px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
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
            <h2 style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
              Craving Something Special?
            </h2>
          </div>
          <button
            onClick={() => onNavigate('menu')}
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
            }}
          >
            <span>View Full Menu</span>
            <ArrowRight size={15} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '24px',
          }}
        >
          {featuredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (onOpenItemModal) onOpenItemModal(item);
                else onNavigate('menu');
              }}
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
              <div style={{ height: '180px', width: '100%', position: 'relative', overflow: 'hidden' }}>
                <img
                  src={item.image}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
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
              </div>

              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <h4 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  {item.name}
                </h4>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {item.description}
                </p>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 'auto',
                    paddingTop: '10px',
                  }}
                >
                  <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--primary)' }}>
                    Rs. {item.basePrice.toLocaleString()}
                  </span>
                  <button
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      fontSize: '12.5px',
                      fontWeight: 700,
                    }}
                  >
                    + Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-card)',
          padding: '48px 24px 24px',
          maxWidth: '1280px',
          margin: '0 auto',
          width: 'calc(100% - 32px)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '32px',
            marginBottom: '40px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <img src="/logo.png" alt="Foodies Cafe" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
              <span style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '18px' }}>
                Foodies<span style={{ color: 'var(--primary)' }}>Cafe</span>
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Quality multi-branch cafe experience in Pakistan. Authentic recipes, spotless kitchens, and friendly hospitality.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>
              Quick Navigation
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span onClick={() => onNavigate('home')} style={{ cursor: 'pointer' }}>Home</span>
              <span onClick={() => onNavigate('menu')} style={{ cursor: 'pointer' }}>Browse Menu</span>
              <span onClick={() => onNavigate('table-qr')} style={{ cursor: 'pointer' }}>Scan Table QR</span>
              <span onClick={() => onNavigate('branches')} style={{ cursor: 'pointer' }}>Our Branches</span>
              <span onClick={() => onNavigate('about')} style={{ cursor: 'pointer' }}>About Us</span>
              <span onClick={() => onNavigate('support')} style={{ cursor: 'pointer' }}>Customer Help & Complaints</span>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>
              Branch Locations
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div>📍 <strong>Gulberg III:</strong> Mian Mehmood Ali Kasoori Rd, Lahore</div>
              <div>📍 <strong>F-7 Markaz:</strong> College Road, Islamabad</div>
              <div>📍 <strong>Clifton Block 4:</strong> 26th Street, Karachi</div>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>
              Customer Support
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div>📞 Helpline: +92 42 111-FOODIES</div>
              <div>✉️ feedback@foodiescafe.pk</div>
              <div>🕒 Daily 11:00 AM - 1:00 AM</div>
            </div>
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>© 2026 FoodiesCafe Pakistan. All Rights Reserved.</div>
        </div>
      </footer>
    </div>
  );
};
