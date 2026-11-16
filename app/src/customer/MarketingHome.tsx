'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { OrderType, Branch, MenuItem } from '@/types/cafe';
import {
  Flame,
  ArrowRight,
  Sparkles,
  Utensils,
  ShoppingBag,
  Bike,
  Plus,
  Minus,
  Trash2,
  Megaphone,
  Clock,
  MapPin,
  Tag,
  X,
  Check,
  Search,
  Navigation,
  CheckCircle2,
  Phone,
  Mail,
  ShieldCheck,
  BookmarkPlus,
  LocateFixed,
  Map as MapIcon,
  Bell,
  Edit3,
  Upload,
} from 'lucide-react';
import { OpenStreetMapView } from '@/components/common/OpenStreetMapView';
import { OsmMarkerItem, getOsmDirectionsUrl } from '@/utils/openStreetMap';
import { HOME_DEALS } from '@/lib/homeDeals';
import { resolveDishImage, PHOTOS } from '@/lib/dishImages';

interface MarketingHomeProps {
  onNavigate: (view: string) => void;
  onOpenItemModal?: (item: any) => void;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const PRESET_ZONES = [
  { name: 'Gulberg III', area: 'Main Boulevard, Gulberg III', lat: 31.5204, lng: 74.3587 },
  { name: 'DHA Phase 5', area: 'Sector C, DHA Phase 5', lat: 31.4704, lng: 74.4103 },
  { name: 'Johar Town', area: 'G1 Market, Johar Town', lat: 31.4697, lng: 74.2982 },
  { name: 'Model Town', area: 'Bank Square, Model Town', lat: 31.4875, lng: 74.3195 },
  { name: 'Mall Road', area: 'Shahrah-e-Quaid-e-Azam, Mall Road', lat: 31.5656, lng: 74.3142 },
];

export const MarketingHome: React.FC<MarketingHomeProps> = ({ onNavigate }) => {
  const {
    menuItems,
    branches,
    cart,
    addToCart,
    updateCartItemQty,
    removeFromCart,
    orderType,
    setOrderType,
    setHasConfirmedOrderType,
    currentBranch,
    currentBranchId,
    setCurrentBranchId,
    hasSelectedBranch,
    announcements,
    addAnnouncement,
    deleteAnnouncement,
    currentRole,
    customerCoordinates,
    setCustomerCoordinates,
    selectedDeliveryAddress,
    setSelectedDeliveryAddress,
    savedAddresses,
    addSavedAddress,
    deleteSavedAddress,
    detectAndStoreCurrentLocation,
    footerSettings,
    updateFooterSettings,
    heroBanners,
    dealCard,
    addToast,
  } = useApp();

  // Text announcements for the selected branch (plus all-branch ones), newest first.
  const visibleAnnouncements = useMemo(
    () =>
      (announcements || [])
        .filter((a) => !a.branchId || a.branchId === currentBranchId)
        .sort((a, b) => (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0))
        .slice(0, 6),
    [announcements, currentBranchId]
  );

  // Deal & Banner Photos synced with Browser Local Storage
  const [localDealPhotos, setLocalDealPhotos] = useState<string[]>(() => {
    const defaults = ['/food-biryani.jpg', '/hero-bg.jpg'];
    if (typeof window === 'undefined') return defaults;
    try {
      const raw = localStorage.getItem('foodies_local_deal_photos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    return defaults;
  });

  const [announcementPhotosMap, setAnnouncementPhotosMap] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem('foodies_announcement_photos');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // 2.5-Second Auto-Sliding Hero Carousel (Reads synced heroBanners & local photos instead of static external mocks)
  const BANNERS = useMemo(() => {
    const activeHero = (heroBanners || []).filter((b) => b.active !== false);
    if (activeHero.length > 0) {
      return activeHero.map((b) => ({
        title: b.title,
        subtitle: b.subtitle,
        tag: b.badge || 'CHEF SPECIAL',
        image: b.imageUrl || localDealPhotos[0] || '/hero-bg.jpg',
      }));
    }
    return [
      {
        title: dealCard?.title || 'Mutton Dum Biryani Special',
        subtitle: dealCard?.subtitle || 'Slow cooked in traditional copper degh with fragrant saffron',
        tag: dealCard?.tag || 'CHEF SPECIAL',
        image: dealCard?.imageUrl || localDealPhotos[0] || '/hero-bg.jpg',
      },
      {
        title: 'Fresh Kitchen Combos & Deals',
        subtitle: 'Ordered directly from your nearest Foodies Cafe branch',
        tag: 'HOT & SIZZLING',
        image: localDealPhotos[1] || '/food-biryani.jpg',
      },
    ];
  }, [heroBanners, dealCard, localDealPhotos]);

  const [activeBannerIndex, setActiveBannerIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % BANNERS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [BANNERS.length]);

  const activeBanner = BANNERS[activeBannerIndex % BANNERS.length] || BANNERS[0];

  // Screen width detection for responsive popup vs mobile bottom sheet
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 768 : true));
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Signature Specials items (First 4 menu items)
  // Signature dishes only — deal combos already have their own "Special Deals" row below.
  const featuredDishes = (() => {
    const isDeal = (m: (typeof menuItems)[number]) => /deal/i.test(m.category || '') || String(m.id).startsWith('deal');
    const dishes = menuItems.filter((m) => !isDeal(m) && m.isAvailable !== false);
    return (dishes.length >= 2 ? dishes : menuItems).slice(0, 4);
  })();

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1360px',
        margin: '0 auto',
        padding: isDesktop ? '20px 24px' : '14px 16px',
        paddingBottom: '80px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: isDesktop ? '24px' : '16px',
        fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* ================= 1. AUTO-SLIDING HERO ANNOUNCEMENT CAROUSEL (PURE IMAGES, NO TEXT OVERLAY) ================= */}
      <div
        onClick={() => onNavigate('menu')}
        style={{
          height: isDesktop ? '340px' : '200px',
          borderRadius: '18px',
          overflow: 'hidden',
          position: 'relative',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          backgroundColor: '#F8FAFC',
          transition: 'all 0.3s ease',
        }}
        title="View Foodies Cafe Menu"
      >
        <img
          src={activeBanner.image}
          alt="Foodies Cafe Announcement"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {/* Subtle Carousel Dots on Bottom Center */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            zIndex: 3,
          }}
        >
          {BANNERS.map((_, idx) => (
            <div
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setActiveBannerIndex(idx);
              }}
              style={{
                width: idx === activeBannerIndex ? '20px' : '7px',
                height: '7px',
                borderRadius: '4px',
                backgroundColor: idx === activeBannerIndex ? 'var(--primary)' : 'rgba(255, 255, 255, 0.75)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* ================= 2. TEXT ANNOUNCEMENTS (posted by owner / branch manager) ================= */}
      {visibleAnnouncements.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 10px', fontSize: isDesktop ? '20px' : '17px', fontWeight: 800, color: 'var(--text-main)' }}>
            Announcements
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(280px, 1fr))' : '1fr',
              gap: '12px',
            }}
          >
            {visibleAnnouncements.map((a) => {
              const color = a.badgeColor || '#EF4444';
              return (
                <div
                  key={a.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border-color)',
                    borderLeft: `4px solid ${color}`,
                    borderRadius: '14px',
                    padding: '12px 14px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}
                >
                  <span style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.04em', color, backgroundColor: `${color}14`, padding: '2px 8px', borderRadius: '999px' }}>
                    {(a.tag || 'ANNOUNCEMENT').toUpperCase()}
                  </span>
                  <div style={{ marginTop: '8px', fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', wordBreak: 'break-word' }}>{a.title}</div>
                  <div style={{ marginTop: '4px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {a.description}
                  </div>
                  {(a.validUntil || a.branchName) && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#64748B' }}>
                      {[a.branchName, a.validUntil].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 3. FEATURED SIGNATURE DISHES (SIGNATURE SPECIALS) ================= */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Flame size={18} color="var(--primary)" />
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 850,
                color: 'var(--text-main, #1E293B)',
              }}
            >
              Signature Specials
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('menu')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '12.5px',
              fontWeight: 750,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: 0,
            }}
          >
            <span>View Menu →</span>
          </button>
        </div>

        {/* Dishes Grid (Fits full horizontal screen width: 4 cols on laptop/desktop, 2 cols on mobile) */}
        <div
          className="mh-card-grid"
          style={{
            display: 'grid',
            width: '100%',
          }}
        >
          {featuredDishes.map((dish) => {
            const cartItemsForDish = cart.filter((ci) => ci.menuItemId === dish.id || ci.id === dish.id);
            const totalQtyInCart = cartItemsForDish.reduce((sum, ci) => sum + (ci.quantity || 1), 0);
            const dishPrice = hasSelectedBranch
              ? (dish.branchPriceOverrides?.[currentBranch.id] ?? dish.basePrice)
              : dish.basePrice;

            return (
              <div
                key={dish.id}
                style={{
                  backgroundColor: 'var(--bg-card, #FFFFFF)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color, #E2E8F0)',
                  boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.04))',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ width: '100%', height: isDesktop ? '145px' : '105px', minHeight: isDesktop ? '145px' : '105px', position: 'relative', overflow: 'hidden' }}>
                  <img
                    src={resolveDishImage(dish.image, dish.category, dish.id, dish.name)}
                    alt={dish.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      fontSize: '9.5px',
                      fontWeight: 850,
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      color: '#FFFFFF',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    {dish.category}
                  </span>
                </div>
                <div style={{ padding: isDesktop ? '11px 13px' : '8px 10px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, justifyContent: 'space-between' }}>
                  <div style={{ minHeight: 0 }}>
                    <div
                      style={{
                        fontSize: isDesktop ? '13.5px' : '12px',
                        fontWeight: 850,
                        color: 'var(--text-main, #1E293B)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      className="mh-card-title"
                      title={dish.name}
                    >
                      {dish.name}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted, #64748B)',
                        marginTop: '3px',
                        lineHeight: '14px',
                        maxHeight: '28px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {dish.description}
                    </div>
                  </div>

                  {/* Price & Add/Stepper Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-color, #F1F5F9)',
                      marginTop: '8px',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: isDesktop ? '13px' : '11.5px', fontWeight: 850, color: 'var(--text-main, #1E293B)' }}>
                      Rs. {dishPrice.toLocaleString()}
                    </span>

                    {/* Stepper if in cart, or 1-tap add */}
                    {totalQtyInCart > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: 'rgba(217, 101, 40, 0.08)',
                          borderRadius: '8px',
                          padding: '2px 4px',
                          border: '1px solid rgba(217, 101, 40, 0.25)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const firstItem = cartItemsForDish[0];
                            if (firstItem) {
                              if (firstItem.quantity <= 1) removeFromCart(firstItem.id);
                              else updateCartItemQty(firstItem.id, -1);
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            color: totalQtyInCart === 1 ? '#DC2626' : 'var(--primary)',
                          }}
                        >
                          {totalQtyInCart === 1 ? <Trash2 size={11} /> : <Minus size={11} />}
                        </button>
                        <span style={{ fontSize: '11px', fontWeight: 850, color: 'var(--primary)', minWidth: '14px', textAlign: 'center' }}>
                          {totalQtyInCart}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const firstItem = cartItemsForDish[0];
                            if (firstItem) updateCartItemQty(firstItem.id, 1);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--primary)',
                          }}
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          addToCart({
                            id: `cart-${dish.id}-${Date.now()}`,
                            menuItemId: dish.id,
                            name: dish.name,
                            unitPrice: dishPrice,
                            quantity: 1,
                            size: dish.sizes?.[0]?.name || 'Standard',
                          });
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          backgroundColor: 'rgba(217, 101, 40, 0.08)',
                          color: 'var(--primary)',
                          padding: '3px 8px',
                          borderRadius: '7px',
                          border: '1px solid rgba(217, 101, 40, 0.25)',
                          fontSize: '11px',
                          fontWeight: 750,
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={11} />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= 4. SPECIAL DEALS ONLY SECTION ================= */}
      <div style={{ marginTop: '8px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Tag size={18} color="var(--primary)" />
            <h3
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 850,
                color: 'var(--text-main, #1E293B)',
              }}
            >
              Special Deals
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('menu')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '12.5px',
              fontWeight: 750,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: 0,
            }}
          >
            <span>View All Deals →</span>
          </button>
        </div>

        {/* Deals List (Matches Signature Specials 4 cols on desktop, 2 cols on mobile) */}
        <div className="mh-card-grid" style={{ display: 'grid', width: '100%' }}>
          {(() => {
            // Deal ids & prices come from the shared catalog so the server accepts and prices them identically.
            const dealImages = [
              resolveDishImage(dealCard?.imageUrl || localDealPhotos[0], 'Deals', 'deal-home-1', HOME_DEALS[0].title),
              resolveDishImage(localDealPhotos[1], 'Deals', 'deal-home-2', HOME_DEALS[1].title),
              PHOTOS.burger,
              PHOTOS.bbqSkewers,
            ];
            const homeDealsList = HOME_DEALS.map((deal, idx) => ({
              ...deal,
              ...(idx === 0
                ? {
                    title: dealCard?.title || deal.title,
                    tag: dealCard?.tag || deal.tag,
                    description: dealCard?.subtitle || deal.description,
                  }
                : {}),
              image: dealImages[idx] || '/food-biryani.jpg',
            }));

            return homeDealsList.map((d) => (
              <div
                key={d.id}
                style={{
                  backgroundColor: 'var(--bg-card, #FFFFFF)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid var(--border-color, #E2E8F0)',
                  boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.04))',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: isDesktop ? '145px' : '105px',
                    minHeight: isDesktop ? '145px' : '105px',
                    position: 'relative',
                    overflow: 'hidden',
                    backgroundColor: '#F8FAFC',
                  }}
                >
                  <img
                    src={d.image}
                    alt={d.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'var(--primary)',
                      color: '#FFFFFF',
                      padding: '2px 7px',
                      borderRadius: '6px',
                      fontSize: '9.5px',
                      fontWeight: 850,
                      letterSpacing: '0.4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    <Tag size={10} color="#FFFFFF" />
                    <span>{d.tag}</span>
                  </div>
                </div>

                <div style={{ padding: isDesktop ? '11px 13px' : '8px 10px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, justifyContent: 'space-between' }}>
                  <div style={{ minHeight: 0 }}>
                    <div
                      style={{
                        fontSize: isDesktop ? '13.5px' : '12px',
                        fontWeight: 850,
                        color: 'var(--text-main, #1E293B)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      className="mh-card-title"
                      title={d.title}
                    >
                      {d.title}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted, #64748B)',
                        marginTop: '3px',
                        lineHeight: '14px',
                        maxHeight: '28px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {d.description}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-color, #F1F5F9)',
                      marginTop: '8px',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: isDesktop ? '13px' : '11.5px', fontWeight: 850, color: 'var(--text-main, #1E293B)' }}>
                      Rs. {d.price.toLocaleString()}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        addToCart({
                          id: `cart-${d.id}-${Date.now()}`,
                          menuItemId: d.id,
                          name: d.title,
                          unitPrice: d.price,
                          quantity: 1,
                          size: 'Deal Special',
                        });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        backgroundColor: 'rgba(217, 101, 40, 0.08)',
                        color: 'var(--primary)',
                        padding: '3px 8px',
                        borderRadius: '7px',
                        border: '1px solid rgba(217, 101, 40, 0.25)',
                        fontSize: '11px',
                        fontWeight: 750,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={11} />
                      <span>Order</span>
                    </button>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* ================= 5. RESPONSIVE WEB FOOTER (Below Announcements) ================= */}
      <footer
        style={{
          marginTop: isDesktop ? '16px' : '8px',
          backgroundColor: 'var(--bg-card, #FFFFFF)',
          border: '1.2px solid var(--border-color, #E2E8F0)',
          borderRadius: isDesktop ? '20px' : '14px',
          padding: isDesktop ? '36px 32px 24px' : '14px 14px 10px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.04))',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          width: '100%',
        }}
      >
        <div
          className="mh-footer-grid"
          style={{
            display: 'grid',
            marginBottom: isDesktop ? '28px' : '10px',
            width: '100%',
          }}
        >
          {/* Col 1: Brand Info & Halal Assurance */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? '10px' : '6px', marginBottom: isDesktop ? '12px' : '6px' }}>
              <img
                src="/logo.png"
                alt="Foodies Cafe"
                style={{ width: isDesktop ? '42px' : '22px', height: isDesktop ? '42px' : '22px', objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: isDesktop ? 900 : 750, fontSize: isDesktop ? '19px' : '12px', color: 'var(--text-main, #1E293B)' }}>
                  Foodies<span style={{ color: 'var(--primary)' }}>Cafe</span>
                </span>
                <div style={{ fontSize: isDesktop ? '11px' : '11.5px', color: 'var(--text-muted, #64748B)', fontWeight: isDesktop ? 700 : 500 }}>
                  Taste That Speaks
                </div>
              </div>
            </div>
            <p style={{ fontSize: isDesktop ? '12.5px' : '12px', color: 'var(--text-secondary, #475569)', lineHeight: 1.35, fontWeight: 400, margin: isDesktop ? '0 0 14px' : '0 0 6px' }}>
              Pakistan&apos;s premier multi-branch dining experience. Authentic Dum Biryani, sizzling karahis, gourmet burgers, and fresh shakes.
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: isDesktop ? '6px' : '4px',
                padding: isDesktop ? '4px 10px' : '2px 6px',
                borderRadius: '999px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                fontSize: isDesktop ? '11.5px' : '11.5px',
                fontWeight: isDesktop ? 800 : 650,
              }}
            >
              <ShieldCheck size={isDesktop ? 14 : 11} />
              <span>100% Halal Certified</span>
            </div>
          </div>

          {/* Col 2: Quick Navigation (Displayed ONLY on Desktop, removed for mobile phones per requirement) */}
          {isDesktop && (
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 850, marginBottom: '14px', color: 'var(--text-main, #1E293B)' }}>
                Quick Navigation
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', fontSize: '13px', color: 'var(--text-secondary, #475569)', fontWeight: 450 }}>
                <span
                  onClick={() => onNavigate('home')}
                  style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary, #475569)')}
                >
                  🏠 Home & Highlights
                </span>
                <span
                  onClick={() => onNavigate('menu')}
                  style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary, #475569)')}
                >
                  🍽️ Browse Full Menu
                </span>
                <span
                  onClick={() => onNavigate('table-qr')}
                  style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary, #475569)')}
                >
                  📷 Scan Table QR
                </span>
                <span
                  onClick={() => onNavigate('order-history')}
                  style={{ cursor: 'pointer', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary, #475569)')}
                >
                  📜 Order History
                </span>
              </div>
            </div>
          )}

          {/* Col 3: Branch Locations */}
          <div>
            <h4 style={{ fontSize: isDesktop ? '15px' : '14px', fontWeight: isDesktop ? 850 : 700, marginBottom: isDesktop ? '14px' : '6px', color: 'var(--text-main, #1E293B)' }}>
              Branch Locations
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '11px' : '5px', fontSize: isDesktop ? '12.5px' : '12px', color: 'var(--text-secondary, #475569)' }}>
              <div>
                <strong style={{ color: 'var(--text-main, #1E293B)', fontWeight: isDesktop ? 700 : 600, fontSize: isDesktop ? '12.5px' : '12px' }}>📍 Lahore (Flagship):</strong>
                <div style={{ fontSize: isDesktop ? '12px' : '11.5px', marginTop: '1px', lineHeight: 1.25 }}>Gulberg III, Lahore</div>
              </div>
              <div>
                <strong style={{ color: 'var(--text-main, #1E293B)', fontWeight: isDesktop ? 700 : 600, fontSize: isDesktop ? '12.5px' : '12px' }}>📍 Islamabad:</strong>
                <div style={{ fontSize: isDesktop ? '12px' : '11.5px', marginTop: '1px', lineHeight: 1.25 }}>F-7 Markaz, Islamabad</div>
              </div>
              <div>
                <strong style={{ color: 'var(--text-main, #1E293B)', fontWeight: isDesktop ? 700 : 600, fontSize: isDesktop ? '12.5px' : '12px' }}>📍 Karachi:</strong>
                <div style={{ fontSize: isDesktop ? '12px' : '11.5px', marginTop: '1px', lineHeight: 1.25 }}>Clifton Block 4, Karachi</div>
              </div>
            </div>
          </div>

          {/* Col 4: Customer Care & Hours */}
          <div>
            <h4 style={{ fontSize: isDesktop ? '15px' : '14px', fontWeight: isDesktop ? 850 : 700, marginBottom: isDesktop ? '14px' : '6px', color: 'var(--text-main, #1E293B)' }}>
              Customer Care & Hours
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '10px' : '4px', fontSize: isDesktop ? '12.5px' : '12px', color: 'var(--text-secondary, #475569)', fontWeight: 450 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? '8px' : '4px' }}>
                <Phone size={isDesktop ? 14 : 10} color="var(--primary)" />
                <span>Helpline: <strong style={{ fontWeight: isDesktop ? 750 : 600 }}>+92 42 3575 8899</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? '8px' : '4px' }}>
                <Mail size={isDesktop ? 14 : 10} color="var(--primary)" />
                <span>Email: <strong style={{ fontWeight: isDesktop ? 750 : 600 }}>support@foodiescafe.pk</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? '8px' : '4px' }}>
                <Clock size={isDesktop ? 14 : 10} color="var(--primary)" />
                <span>Daily: <strong style={{ fontWeight: isDesktop ? 750 : 600 }}>11:00 AM – 1:00 AM</strong></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? '8px' : '4px' }}>
                <Bike size={isDesktop ? 14 : 10} color="var(--primary)" />
                <span>Delivery: <strong style={{ fontWeight: isDesktop ? 750 : 600 }}>Up to 15 km</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Live Status Bar */}
        <div
          style={{
            borderTop: '1px solid var(--border-color, #E2E8F0)',
            paddingTop: isDesktop ? '18px' : '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: isDesktop ? '12px' : '12px',
            color: 'var(--text-muted, #64748B)',
            flexWrap: 'wrap',
            gap: isDesktop ? '10px' : '6px',
            fontWeight: 450,
          }}
        >
          <div>
            © 2026 FoodiesCafe Pakistan (Pvt.) Ltd. All Rights Reserved.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? '14px' : '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: isDesktop ? '8px' : '6px', height: isDesktop ? '8px' : '6px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
              <span>Real-time POS & Kitchen Sync Active</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
