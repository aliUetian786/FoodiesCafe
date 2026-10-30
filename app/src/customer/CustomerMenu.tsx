'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useApp, useAppSelector, selectCartCount, selectCartSubtotal } from '@/context/AppContext';
import { MenuItem } from '@/types/cafe';
import {
  Search,
  AlertTriangle,
  Clock,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Filter,
  Flame,
  CheckCircle,
  UtensilsCrossed,
  X,
} from 'lucide-react';

interface MenuScreenProps {
  onNavigate: (view: string) => void;
  onOpenCart: () => void;
  onProceedToCheckout?: () => void;
}

export const CustomerMenu: React.FC<MenuScreenProps> = ({ onNavigate, onOpenCart, onProceedToCheckout }) => {
  const {
    currentBranch,
    menuItems,
    currentBranchId,
    cart,
    categories: appCategories,
    addToCart,
    updateCartItemQty,
    menuSearchQuery,
    setMenuSearchQuery,
    currentUser,
    setCurrentUser,
    addToast,
  } = useApp();

  const searchQuery = menuSearchQuery;
  const categories = appCategories || [];
  const [selectedCategory, setSelectedCategory] = useState<string>(() => appCategories?.[0] || 'Appetizers');

  const categoryRowRef = useRef<HTMLDivElement>(null);
  const categoryBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isManualScrollRef = useRef(false);

  // Sync selectedCategory if initial appCategories loaded later
  useEffect(() => {
    if (appCategories && appCategories.length > 0) {
      if (!selectedCategory || !appCategories.includes(selectedCategory)) {
        setSelectedCategory(appCategories[0]);
      }
    }
  }, [appCategories, selectedCategory]);

  // Filtered items when searching
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Handle clicking a category tab: smooth scroll to that category section
  const handleCategoryClick = (cat: string) => {
    setSelectedCategory(cat);
    isManualScrollRef.current = true;

    const sectionEl = document.getElementById(`cat-section-${encodeURIComponent(cat)}`);
    if (sectionEl) {
      sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setTimeout(() => {
      isManualScrollRef.current = false;
    }, 850);
  };

  // Automatically scroll active category button into view horizontally whenever selectedCategory changes
  useEffect(() => {
    if (!selectedCategory) return;
    const btn = categoryBtnRefs.current[selectedCategory];
    const row = categoryRowRef.current;
    if (btn && row) {
      const scrollLeftTarget = btn.offsetLeft - row.offsetWidth / 2 + btn.offsetWidth / 2;
      row.scrollTo({
        left: Math.max(0, scrollLeftTarget),
        behavior: 'smooth',
      });
    }
  }, [selectedCategory]);

  // ScrollSpy: Automatically update category in top row as customer scrolls down
  // When a category's full item card is on display, color that category in the top row
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let ticking = false;

    const handleScroll = () => {
      if (isManualScrollRef.current) return;
      if (searchQuery.trim().length > 0) return;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const pureCats = appCategories || [];
          if (pureCats.length === 0) {
            ticking = false;
            return;
          }

          // When near the top, pick first category
          if (window.scrollY < 50) {
            setSelectedCategory((prev) => (prev !== pureCats[0] ? pureCats[0] : prev));
            ticking = false;
            return;
          }

          // Top boundary below sticky header (72px) + sticky category bar (~44px)
          const topBoundary = 118;
          // Bottom boundary of visible window (accounting for mobile checkout bar if present)
          const bottomBoundary = window.innerHeight - (cart.length > 0 ? 68 : 10);

          // Find all dish cards with a data-category attribute
          const cards = Array.from(
            document.querySelectorAll<HTMLElement>('.foodies-dish-card[data-category]')
          );

          let activeCat: string | null = null;

          // 1. Priority 1: Find the first dish card that is at FULL DISPLAY (its entire box is inside the viewport)
          for (const card of cards) {
            const rect = card.getBoundingClientRect();
            if (rect.top >= topBoundary - 6 && rect.bottom <= bottomBoundary + 6) {
              const cat = card.getAttribute('data-category');
              if (cat && pureCats.includes(cat)) {
                activeCat = cat;
                break;
              }
            }
          }

          // 2. Priority 2 (fallback during rapid scroll or between rows):
          // Find the card that has the largest visible vertical height in the viewport window
          if (!activeCat && cards.length > 0) {
            let maxVisibleHeight = 0;
            let bestCat: string | null = null;

            for (const card of cards) {
              const rect = card.getBoundingClientRect();
              const visibleTop = Math.max(rect.top, topBoundary);
              const visibleBottom = Math.min(rect.bottom, bottomBoundary);
              const visibleHeight = visibleBottom - visibleTop;

              if (visibleHeight > maxVisibleHeight) {
                maxVisibleHeight = visibleHeight;
                bestCat = card.getAttribute('data-category');
              }
            }

            if (bestCat && pureCats.includes(bestCat)) {
              activeCat = bestCat;
            }
          }

          if (activeCat) {
            setSelectedCategory((prev) => (prev !== activeCat ? activeCat : prev));
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [appCategories, searchQuery, cart.length]);

  // Handle smooth scroll when navigating to a specific dish from Home page
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const targetDishId = localStorage.getItem('foodies_target_item');
    if (targetDishId) {
      localStorage.removeItem('foodies_target_item');
      const targetItem = menuItems.find((i) => i.id === targetDishId);
      if (targetItem && targetItem.category) {
        setSelectedCategory(targetItem.category);
      }
      setTimeout(() => {
        const targetElement = document.getElementById(`menu-item-${targetDishId}`);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetElement.classList.add('highlight-target-dish');
          setTimeout(() => {
            targetElement.classList.remove('highlight-target-dish');
          }, 3000);
        }
      }, 350);
    } else {
      window.scrollTo(0, 0);
    }
  }, [menuItems]);

  // Redux Toolkit memoized selectors with direct React state fallback for zero-lag calculations
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const reduxCartCount = useAppSelector(selectCartCount);
  const reduxCartSubtotal = useAppSelector(selectCartSubtotal);
  const derivedCartCount = (cart || []).reduce((sum, i) => sum + (i.quantity || 1), 0);
  const derivedSubtotal = (cart || []).reduce((sum, i) => sum + (Number(i.unitPrice) || 0) * (i.quantity || 1), 0);

  const rawCartCount = reduxCartCount > 0 ? reduxCartCount : derivedCartCount;
  const rawCartSubtotal = reduxCartSubtotal > 0 ? reduxCartSubtotal : derivedSubtotal;
  const cartCount = mounted ? rawCartCount : 0;
  const cartSubtotal = mounted ? rawCartSubtotal : 0;

  // Snappy flying piece animation from clicked order item to header cart button
  const triggerFlyToCart = (
    e: React.MouseEvent,
    action: () => void,
    dishImage?: string
  ) => {
    e.stopPropagation();

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      action();
      return;
    }

    const cartBtn =
      document.querySelector<HTMLElement>('.header-cart-button') ||
      document.querySelector<HTMLElement>('.foodies-mobile-checkout-bar');

    if (!cartBtn) {
      action();
      return;
    }

    const sourceEl = (e.currentTarget as HTMLElement) || (e.target as HTMLElement);
    const srcRect = sourceEl.getBoundingClientRect();
    const destRect = cartBtn.getBoundingClientRect();

    const startX = srcRect.left + srcRect.width / 2;
    const startY = srcRect.top + srcRect.height / 2;
    const endX = destRect.left + destRect.width / 2;
    const endY = destRect.top + destRect.height / 2;

    const particle = document.createElement('div');
    particle.className = 'foodies-flying-piece';
    particle.style.position = 'fixed';
    particle.style.zIndex = '999999';
    particle.style.left = `${startX}px`;
    particle.style.top = `${startY}px`;
    particle.style.width = '24px';
    particle.style.height = '24px';
    particle.style.marginLeft = '-12px';
    particle.style.marginTop = '-12px';
    particle.style.borderRadius = '50%';
    particle.style.backgroundColor = 'var(--primary, #E53E3E)';
    particle.style.border = '2px solid #FFFFFF';
    particle.style.boxShadow = '0 4px 14px rgba(229, 62, 62, 0.6)';
    particle.style.pointerEvents = 'none';
    particle.style.display = 'flex';
    particle.style.alignItems = 'center';
    particle.style.justifyContent = 'center';
    particle.style.transition = 'all 420ms cubic-bezier(0.2, 0.8, 0.25, 1)';
    particle.style.transform = 'translate(0, 0) scale(1)';
    particle.style.opacity = '1';

    if (dishImage) {
      particle.style.backgroundImage = `url("${dishImage}")`;
      particle.style.backgroundSize = 'cover';
      particle.style.backgroundPosition = 'center';
    } else {
      particle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
    }

    document.body.appendChild(particle);

    // Force reflow
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    particle.offsetWidth;

    const deltaX = endX - startX;
    const deltaY = endY - startY;

    particle.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.35)`;
    particle.style.opacity = '0.7';

    let executed = false;
    const finish = () => {
      if (executed) return;
      executed = true;
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
      cartBtn.classList.remove('cart-bounce-pulse');
      // Force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      cartBtn.offsetWidth;
      cartBtn.classList.add('cart-bounce-pulse');

      action();
    };

    particle.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 450);
  };

  // Helper to render an individual item card
  const renderItemCard = (item: MenuItem) => {
    const isAvailable = item.branchAvailability[currentBranchId] ?? item.isAvailable;
    const rawPrice = item.branchPriceOverrides?.[currentBranchId] ?? item.basePrice;
    const displayPrice = Number(rawPrice) || 0;

    // Check if item is already in cart for this order
    const cartItem = cart.find((c) => c.menuItemId === item.id);
    const inCartQty = cartItem ? cartItem.quantity : 0;

    return (
      <div
        key={item.id}
        id={`menu-item-${item.id}`}
        data-category={item.category}
        className="foodies-dish-card"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: isAvailable ? '1px solid var(--border-color)' : '1px dashed var(--border-color)',
          overflow: 'hidden',
          boxShadow: isAvailable ? 'var(--shadow-md)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'default',
          opacity: isAvailable ? 1 : 0.6,
          filter: isAvailable ? 'none' : 'grayscale(70%)',
          position: 'relative',
        }}
      >
        {/* Photo & Category Badge */}
        <div className="dish-img-wrap" style={{ height: '190px', width: '100%', position: 'relative', overflow: 'hidden' }}>
          <img
            src={item.image}
            alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/food-biryani.jpg';
            }}
          />
          <span
            className="dish-cat-badge"
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(6px)',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            {item.category}
          </span>

          {/* Unavailable Badge */}
          {!isAvailable && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                backdropFilter: 'blur(2px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '13px',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-full)',
                  letterSpacing: '0.04em',
                }}
              >
                UNAVAILABLE IN THIS BRANCH
              </span>
            </div>
          )}
        </div>

        {/* Item Info */}
        <div className="dish-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <h3 className="dish-title" style={{ fontSize: 'clamp(13px, 1.8vw, 16px)', fontWeight: 700, color: 'var(--text-main)', margin: 0, lineHeight: 1.25 }}>
            {item.name}
          </h3>
          <p
            className="dish-desc"
            style={{
              fontSize: 'clamp(11.5px, 1.4vw, 13px)',
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

          {/* Pricing & Add/Quantity Controller Row (In same row below name) */}
          <div
            className="dish-action-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 'auto',
              paddingTop: '8px',
              gap: '4px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <div className="dish-price-block">
              <span className="dish-price-label" style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>
                Price (Cash)
              </span>
              <span className="dish-price" style={{ fontSize: 'clamp(12px, 1.8vw, 17px)', fontWeight: 800, color: 'var(--primary)', whiteSpace: 'nowrap', lineHeight: 1 }}>
                Rs. {displayPrice.toLocaleString()}
              </span>
            </div>

            {/* When not in cart: display "+ Add" button (desktop) / "Order" (mobile). When selected: order option appears as delete sign, quantity, plus sign */}
            {inCartQty === 0 ? (
              <button
                disabled={!isAvailable}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isAvailable) return;
                  triggerFlyToCart(e, () => {
                    addToCart({
                      id: `cart-${item.id}-${Date.now()}`,
                      menuItemId: item.id,
                      name: item.name,
                      unitPrice: displayPrice,
                      quantity: 1,
                      size: item.sizes?.[0]?.name || 'Standard',
                    });
                  }, item.image);
                }}
                className="dish-order-btn"
                style={{
                  height: '32px',
                  width: '96px',
                  boxSizing: 'border-box',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isAvailable ? 'var(--primary)' : 'var(--bg-card-subtle)',
                  color: isAvailable ? '#FFFFFF' : 'var(--text-muted)',
                  fontSize: 'clamp(11px, 1.5vw, 13px)',
                  fontWeight: 700,
                  cursor: isAvailable ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  boxShadow: isAvailable ? '0 4px 10px var(--primary-glow)' : 'none',
                  border: 'none',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {isAvailable ? (
                  <>
                    <Plus size={13} className="dish-btn-icon" />
                    <span>Order</span>
                  </>
                ) : (
                  <span
                    style={{
                      fontSize: 'clamp(10px, 1.3vw, 11px)',
                      fontWeight: 750,
                      color: 'var(--text-muted)',
                      lineHeight: 1,
                      letterSpacing: '0.01em',
                    }}
                  >
                    Out of Stock
                  </span>
                )}
              </button>
            ) : (
              <div
                className="dish-qty-stepper"
                onClick={(e) => e.stopPropagation()}
                style={{
                  height: '32px',
                  width: '96px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '2px',
                  backgroundColor: 'var(--bg-card-subtle)',
                  border: '1.5px solid var(--primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2px 4px',
                  boxShadow: '0 2px 8px var(--primary-glow)',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (cartItem) {
                      updateCartItemQty(cartItem.id, -1);
                    }
                  }}
                  className="dish-stepper-btn dish-stepper-dec"
                  aria-label={inCartQty === 1 ? 'Remove from cart' : 'Decrease quantity'}
                  title={inCartQty === 1 ? 'Remove from cart' : 'Decrease quantity'}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '5px',
                    backgroundColor: inCartQty === 1 ? '#FEF2F2' : '#FFFFFF',
                    border: inCartQty === 1 ? '1px solid #FCA5A5' : '1px solid var(--border-color)',
                    color: inCartQty === 1 ? '#DC2626' : 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 800,
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  {inCartQty === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                </button>

                <span
                  className="dish-qty-val"
                  style={{
                    fontSize: 'clamp(11px, 1.5vw, 13px)',
                    fontWeight: 800,
                    color: 'var(--primary)',
                    flex: 1,
                    textAlign: 'center',
                    userSelect: 'none',
                    lineHeight: 1,
                  }}
                >
                  {inCartQty}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (cartItem) {
                      triggerFlyToCart(e, () => {
                        updateCartItemQty(cartItem.id, 1);
                      }, item.image);
                    }
                  }}
                  className="dish-stepper-btn dish-stepper-inc"
                  aria-label="Increase quantity"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--primary)',
                    border: 'none',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 800,
                    boxShadow: '0 2px 6px var(--primary-glow)',
                    flexShrink: 0,
                  }}
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const menuBottomPadding = cartCount > 0 ? '80px' : '20px';

  return (
    <div
      className="foodies-menu-container"
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: `0 16px ${menuBottomPadding}`,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Category Filters Bar & Search Box: FULL LINE directly below the 72px fixed header (tight spacing) */}
      <div
        className="foodies-category-bar-full-line"
        style={{
          position: 'sticky',
          top: '72px', // In line with customer header bottom
          zIndex: 900,
          backgroundColor: 'var(--bg-main)',
          padding: '6px 0 8px',
          marginTop: 0,
          marginBottom: '14px',
          borderBottom: '1px solid var(--border-color)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
          width: '100%',
        }}
      >
        <div
          className="foodies-menu-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            width: '100%',
          }}
        >
          {/* Scrollable Category Filter Pills */}
          <div
            ref={categoryRowRef}
            style={{
              display: 'flex',
              gap: '8px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
              padding: '2px 0',
              flex: '1 1 auto',
              minWidth: 0,
            }}
          >
            {categories.map((cat) => (
              <button
                key={cat}
                ref={(el) => {
                  categoryBtnRefs.current[cat] = el;
                }}
                onClick={() => handleCategoryClick(cat)}
                style={{
                  padding: '8px 18px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-card)',
                  color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                  border: selectedCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  fontSize: '13px',
                  fontWeight: selectedCategory === cat ? 700 : 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  boxShadow: selectedCategory === cat ? '0 4px 10px var(--primary-glow)' : 'var(--shadow-sm)',
                  transition: 'all 0.18s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexShrink: 0,
                }}
              >
                <Flame size={14} />
                <span>{cat}</span>
              </button>
            ))}
          </div>

          {/* Menu Search Box (Right Side of Category Bar) */}
          <div
            className="foodies-menu-search-box"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-card)',
              border: '1.5px solid var(--border-color)',
              borderRadius: 'var(--radius-full)',
              padding: '7px 14px',
              width: '260px',
              minWidth: '200px',
              flexShrink: 0,
              boxShadow: 'var(--shadow-sm)',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease',
            }}
          >
            <Search size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
            <input
              type="text"
              value={menuSearchQuery}
              onChange={(e) => setMenuSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '13px',
                color: 'var(--text-main)',
                width: '100%',
                fontFamily: 'inherit',
                fontWeight: 650,
                padding: 0,
              }}
            />
            {menuSearchQuery && (
              <button
                type="button"
                onClick={() => setMenuSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two-Column Layout Below Categories: Dishes on Left, Static Checkout Card on Right */}
      <div className="foodies-menu-main-layout" style={{ display: 'flex', gap: '28px', alignItems: 'flex-start', width: '100%' }}>
        {/* Left Column: Menu Dishes (scrollable alongside checkout card) */}
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
          {searchQuery.trim().length > 0 ? (
            /* Search Query Mode: flat grid of results */
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
                  Showing <strong>{filteredItems.length}</strong> {filteredItems.length === 1 ? 'item' : 'items'} matching &ldquo;{searchQuery}&rdquo;
                </div>
                <button
                  onClick={() => setMenuSearchQuery('')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary)',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Clear Search
                </button>
              </div>
              {filteredItems.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px dashed var(--border-color)',
                  }}
                >
                  <UtensilsCrossed size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                    No dishes found
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)' }}>
                    Try searching for something else or browse our categories above.
                  </p>
                </div>
              ) : (
                <div className="foodies-menu-grid">
                  {filteredItems.map((item) => renderItemCard(item))}
                </div>
              )}
            </div>
          ) : (
            /* Default Mode: Category Sections for ScrollSpy */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
              {categories.map((cat) => {
                  const catItems = menuItems.filter((i) => i.category === cat);
                  if (catItems.length === 0) return null;

                  return (
                    <section
                      key={cat}
                      id={`cat-section-${encodeURIComponent(cat)}`}
                      style={{
                        scrollMarginTop: '128px',
                      }}
                    >
                      {/* Category Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingBottom: '12px',
                          marginBottom: '20px',
                          borderBottom: '2px solid var(--border-color)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--primary-glow)',
                              color: 'var(--primary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Flame size={18} />
                          </span>
                          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                            {cat}
                          </h2>
                        </div>

                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--bg-card-subtle)',
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          {catItems.length} {catItems.length === 1 ? 'Dish' : 'Dishes'}
                        </span>
                      </div>

                      {/* Grid of Dishes (3 items per row on desktop) */}
                      <div className="foodies-menu-grid">
                        {catItems.map((item) => renderItemCard(item))}
                      </div>
                    </section>
                  );
                })}
            </div>
          )}
        </div>

        {/* Right Column: Full Static Checkout Card below the category line */}
        <div
          className="desktop-checkout-column"
          style={{
            width: '350px',
            flexShrink: 0,
            position: 'sticky',
            top: '126px', // Pinned cleanly below the 72px fixed header + compact category bar
            zIndex: 850,
          }}
        >
          <div
            className="desktop-static-checkout"
            style={{
              width: '100%',
              height: '520px',
              minHeight: '380px',
              maxHeight: 'calc(100vh - 146px)',
              boxSizing: 'border-box',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
          {/* Card Header (Fixed) */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-card-subtle)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShoppingBag size={18} />
              </div>
              <div>
                <span style={{ fontWeight: 850, fontSize: '15px', color: 'var(--text-main)', display: 'block', lineHeight: 1.2 }}>
                  My Order
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>
                  Foodies Cafe
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 850,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: cartCount > 0 ? 'var(--primary)' : 'var(--bg-card)',
                color: cartCount > 0 ? '#FFFFFF' : 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
            >
              {cartCount > 0 ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : 'Empty'}
            </span>
          </div>

          {/* Card Body: Selected Items List (Empty state when 0 items, scrollable list when items added) */}
          <div
            style={{
              padding: '14px 16px',
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted)', margin: 'auto 0' }}>
                <ShoppingBag size={34} style={{ margin: '0 auto 8px', opacity: 0.35 }} />
                <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                  Your order is empty
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Click &ldquo;+ Add&rdquo; on any dish to start your order.
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    gap: '10px',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 800,
                        color: 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 800, marginTop: '2px' }}>
                      Rs. {(item.unitPrice * item.quantity).toLocaleString()}
                    </div>
                  </div>

                  {/* Quantity Controller: Minus replaced with Trash2 delete sign when quantity is 1 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => updateCartItemQty(item.id, -1)}
                      aria-label={item.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}
                      title={item.quantity === 1 ? 'Remove from cart' : 'Decrease quantity'}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: item.quantity === 1 ? '#FEF2F2' : 'var(--bg-card)',
                        border: item.quantity === 1 ? '1px solid #FCA5A5' : '1px solid var(--border-color)',
                        color: item.quantity === 1 ? '#DC2626' : 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontWeight: 800,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {item.quantity === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 850, minWidth: '18px', textAlign: 'center', color: 'var(--text-main)' }}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartItemQty(item.id, 1)}
                      aria-label="Increase quantity"
                      title="Increase quantity"
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--primary)',
                        border: 'none',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontWeight: 800,
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Static Bottom Line (Pinned to bottom of card, always visible) */}
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Total Payable:
              </span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>
                Rs. {cartSubtotal.toLocaleString()}
              </span>
            </div>

            {/* Static Checkout Clickable Button */}
            <button
              type="button"
              disabled={cartCount === 0}
              onClick={() => (onProceedToCheckout ? onProceedToCheckout() : onOpenCart())}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: cartCount > 0 ? 'var(--primary)' : 'var(--bg-card-subtle)',
                color: cartCount > 0 ? '#FFFFFF' : 'var(--text-muted)',
                border: 'none',
                fontWeight: 850,
                fontSize: '14px',
                cursor: cartCount > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: cartCount > 0 ? '0 4px 14px var(--primary-glow)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Proceed to Checkout</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Mobile Floating Checkout Line Bar (Appears when item is selected on mobile) */}
      {cartCount > 0 && (
        <div
          className="foodies-mobile-checkout-bar"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 999,
            backgroundColor: 'var(--bg-card)',
            borderTop: '2px solid var(--border-color)',
            boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.14)',
            padding: '12px 16px',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '15px',
                boxShadow: '0 2px 8px var(--primary-glow)',
              }}
            >
              {cartCount}
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>Total Order</div>
              <div style={{ fontSize: '16px', fontWeight: 900, color: 'var(--primary)' }}>
                Rs. {cartSubtotal.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => (onProceedToCheckout ? onProceedToCheckout() : onOpenCart())}
            style={{
              flex: 1,
              maxWidth: '220px',
              padding: '11px 18px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 850,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px var(--primary-glow)',
            }}
          >
            <span>Proceed to Checkout</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Responsive styles for progressive layout breakdown */}
      <style jsx>{`
        .foodies-menu-main-layout {
          display: flex;
          gap: 28px;
          align-items: flex-start;
          width: 100%;
        }

        .foodies-menu-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
        }

        .foodies-mobile-checkout-bar {
          display: none;
        }

        .dish-btn-text-desktop {
          display: inline;
        }

        .dish-btn-text-mobile {
          display: none;
        }

        .foodies-dish-card {
          cursor: default !important;
        }
        .foodies-dish-card:active {
          transform: none !important;
        }
        .dish-order-btn {
          cursor: pointer !important;
          transition: transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease !important;
        }
        .dish-order-btn:active {
          transform: scale(0.92) !important;
          box-shadow: 0 1px 4px var(--primary-glow) !important;
        }
        .dish-stepper-btn {
          cursor: pointer !important;
          transition: transform 0.15s ease, background-color 0.15s ease !important;
        }
        .dish-stepper-btn:active {
          transform: scale(0.90) !important;
        }

        /* 1) Intermediate width (861px - 1200px):
           Remove 3rd card of item (2 items in row) and shrink rest of 2 cards and checkout card */
        @media (max-width: 1200px) and (min-width: 861px) {
          .foodies-menu-main-layout {
            gap: 16px;
          }
          .foodies-menu-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 16px;
          }
          .desktop-checkout-column,
          .desktop-static-checkout {
            width: clamp(260px, 27vw, 320px) !important;
          }
          .foodies-dish-card .dish-content {
            padding: 12px 14px 14px !important;
          }
          .foodies-dish-card .dish-title {
            font-size: 14.5px !important;
          }
          .foodies-dish-card .dish-price {
            font-size: 14.5px !important;
          }
        }

        /* 2) When screen area becomes small (<= 860px):
           Remove checkout card entirely from side, only display the 2 item cards in blank space,
           and start shrinking them as screen boundary touches them.
           Mobile checkout bar appears at the bottom.
           Remove Description / Details, Category badge, and Price(Cash) label so only item name shows,
           with Rs. and + Order aligned in same row. */
        @media (max-width: 860px) {
          .foodies-menu-container {
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
          .foodies-category-bar-full-line {
            position: sticky !important;
            top: 72px !important;
            margin-top: 0 !important;
          }
          .desktop-checkout-column,
          .desktop-static-checkout {
            display: none !important;
          }
          .foodies-menu-main-layout {
            display: block;
          }
          .foodies-menu-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px;
          }
          .foodies-mobile-checkout-bar {
            display: flex !important;
          }
          .foodies-dish-card .dish-cat-badge {
            display: none !important;
          }
          .foodies-dish-card .dish-desc {
            display: none !important;
          }
          .foodies-dish-card .dish-price-label {
            display: none !important;
          }
          .foodies-dish-card .dish-content {
            padding: 10px 12px 12px !important;
          }
          .foodies-dish-card .dish-title {
            font-size: 13.5px !important;
          }
          .foodies-dish-card .dish-action-row {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            margin-top: auto !important;
            gap: 4px !important;
          }
          .foodies-dish-card .dish-price {
            font-size: 13.5px !important;
            white-space: nowrap !important;
          }
          .dish-order-btn,
          .dish-qty-stepper {
            width: 92px !important;
            height: 30px !important;
            min-width: 92px !important;
            max-width: 92px !important;
            box-sizing: border-box !important;
          }
          .dish-qty-stepper {
            padding: 2px 3px !important;
            gap: 2px !important;
          }
          .dish-stepper-btn {
            width: 22px !important;
            height: 22px !important;
          }
          .dish-qty-val {
            font-size: 12px !important;
            flex: 1 !important;
            text-align: center !important;
          }
        }

        /* 3) Mobile level (<= 640px):
           Remove all extra text from item pic other than name,
           below which there will be price, and in same row to price there will be order.
           When selected, order option appears as delete sign, quantity, plus sign with IDENTICAL box dimensions. */
        @media (max-width: 640px) {
          .foodies-menu-container {
            padding-top: 0 !important;
            margin-top: 0 !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
          }
          .foodies-category-bar-full-line {
            position: sticky !important;
            top: 72px !important;
            margin-top: 0 !important;
          }
          .foodies-menu-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }
          .foodies-dish-card .dish-img-wrap {
            height: 115px !important;
          }
          /* Remove all extra text other than name */
          .foodies-dish-card .dish-cat-badge {
            display: none !important;
          }
          .foodies-dish-card .dish-desc {
            display: none !important;
          }
          .foodies-dish-card .dish-price-label {
            display: none !important;
          }
          .foodies-dish-card .dish-content {
            padding: 6px 8px 8px !important;
            gap: 3px !important;
          }
          .foodies-dish-card .dish-title {
            font-size: 12px !important;
            line-height: 1.2 !important;
            font-weight: 750 !important;
            margin: 0 !important;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .foodies-dish-card .dish-action-row {
            margin-top: auto !important;
            padding-top: 4px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 2px !important;
            flex-wrap: nowrap !important;
          }
          .foodies-dish-card .dish-price {
            font-size: 12px !important;
            font-weight: 850 !important;
            white-space: nowrap !important;
          }
          .dish-btn-text-desktop {
            display: none !important;
          }
          .dish-btn-text-mobile {
            display: inline !important;
          }
          /* Box dimensions remain 100% identical between order button and stepper */
          .dish-order-btn,
          .dish-qty-stepper {
            width: 86px !important;
            height: 28px !important;
            min-width: 86px !important;
            max-width: 86px !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
          }
          .dish-order-btn {
            padding: 0 !important;
            font-size: 11px !important;
            border-radius: 6px !important;
            gap: 2px !important;
          }
          .dish-qty-stepper {
            padding: 2px 3px !important;
            gap: 2px !important;
            border-radius: 6px !important;
          }
          .dish-stepper-btn {
            width: 22px !important;
            height: 22px !important;
            border-radius: 4px !important;
          }
          .dish-stepper-btn svg {
            width: 10px !important;
            height: 10px !important;
          }
          .dish-qty-val {
            font-size: 11.5px !important;
            flex: 1 !important;
            text-align: center !important;
          }
        }

        /* 4) Extra small phones (<= 380px) */
        @media (max-width: 380px) {
          .foodies-menu-container {
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
          .foodies-category-bar-full-line {
            position: sticky !important;
            top: 72px !important;
            margin-top: 0 !important;
          }
          .foodies-dish-card .dish-content {
            padding: 5px 6px 6px !important;
          }
          .foodies-dish-card .dish-title {
            font-size: 11px !important;
          }
          .foodies-dish-card .dish-price {
            font-size: 11px !important;
          }
          /* Box dimensions remain 100% identical between order button and stepper */
          .dish-order-btn,
          .dish-qty-stepper {
            width: 78px !important;
            height: 26px !important;
            min-width: 78px !important;
            max-width: 78px !important;
            box-sizing: border-box !important;
            flex-shrink: 0 !important;
          }
          .dish-order-btn {
            padding: 0 !important;
            font-size: 10.5px !important;
            border-radius: 5px !important;
            gap: 1px !important;
          }
          .dish-qty-stepper {
            padding: 1px 2px !important;
            gap: 1px !important;
            border-radius: 5px !important;
          }
          .dish-stepper-btn {
            width: 19px !important;
            height: 19px !important;
            border-radius: 3px !important;
          }
          .dish-stepper-btn svg {
            width: 9px !important;
            height: 9px !important;
          }
          .dish-qty-val {
            font-size: 10.5px !important;
            flex: 1 !important;
            text-align: center !important;
          }
        @media (max-width: 640px) {
          .foodies-menu-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .foodies-menu-search-box {
            width: 100% !important;
          }
        }

        @keyframes dishPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(226, 27, 34, 0.7);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(226, 27, 34, 0);
            transform: scale(1.02);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(226, 27, 34, 0);
            transform: scale(1);
          }
        }

        .highlight-target-dish {
          animation: dishPulse 1.2s ease-in-out 2;
          border-color: var(--primary) !important;
        }
      `}</style>
    </div>
  );
};
