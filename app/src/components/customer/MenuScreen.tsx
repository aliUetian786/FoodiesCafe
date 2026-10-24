'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { MenuItem } from '@/types/cafe';
import { ItemDetailModal } from '@/components/customer/ItemDetailModal';
import {
  Search,
  AlertTriangle,
  Clock,
  Plus,
  ShoppingBag,
  ArrowRight,
  Filter,
  Flame,
  CheckCircle,
} from 'lucide-react';

interface MenuScreenProps {
  onNavigate: (view: string) => void;
  onOpenCart: () => void;
}

export const MenuScreen: React.FC<MenuScreenProps> = ({ onNavigate, onOpenCart }) => {
  const { currentBranch, menuItems, currentBranchId, cart } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeModalItem, setActiveModalItem] = useState<MenuItem | null>(null);

  const categories = [
    'All',
    'Biryani & Rice',
    'Karahi & Handi',
    'BBQ & Kebabs',
    'Burgers & Fast Food',
    'Breads & Sides',
    'Beverages & Desserts',
  ];

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);
  const cartSubtotal = cart.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px 100px' }}>
      {/* Branch Header & Operational Alerts */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                CURRENT BRANCH MENU
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: currentBranch.isOpen ? 'var(--status-ready-bg)' : 'var(--status-cancelled-bg)',
                  color: currentBranch.isOpen ? 'var(--status-ready-text)' : 'var(--status-cancelled-text)',
                }}
              >
                {currentBranch.isOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px', margin: 0 }}>
              {currentBranch.name}
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {currentBranch.address} · Est. Prep Time: {currentBranch.prepTimeEstimateMin} mins
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '12.5px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Clock size={16} color="var(--primary)" />
            <span>
              Full-edit: <strong>{currentBranch.fullEditWindowMin}m</strong> · Add-ons cutoff: <strong>{currentBranch.stopAddOnsMinBeforeReady}m</strong> before ready
            </span>
          </div>
        </div>

        {/* Branch Closed or Busy Mode Banner (PRD Requirement) */}
        {!currentBranch.isOpen ? (
          <div
            style={{
              marginTop: '16px',
              backgroundColor: 'var(--status-cancelled-bg)',
              color: 'var(--status-cancelled-text)',
              border: '1px solid var(--status-cancelled-text)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <AlertTriangle size={20} />
            <span>This branch is currently closed for the night. You can view the menu, but ordering is paused until opening hours.</span>
          </div>
        ) : currentBranch.isBusy ? (
          <div
            style={{
              marginTop: '16px',
              backgroundColor: 'var(--status-preparing-bg)',
              color: 'var(--status-preparing-text)',
              border: '1px solid var(--status-preparing-text)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '14px',
              fontWeight: 600,
            }}
          >
            <Clock size={20} />
            <span>
              <strong>Orders paused / longer prep time active:</strong> Kitchen is currently busy. Orders may require 15-20 additional minutes to prepare.
            </span>
          </div>
        ) : null}
      </div>

      {/* Search Bar & Category Filters (Sticky) */}
      <div
        style={{
          position: 'sticky',
          top: '68px',
          zIndex: 90,
          backgroundColor: 'var(--bg-main)',
          padding: '12px 0 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-full)',
            padding: '10px 18px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search freshly made biryanis, karahis, kebabs, sides..."
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '14px',
              color: 'var(--text-main)',
              width: '100%',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Sticky Category Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: selectedCategory === cat ? 'var(--primary)' : 'var(--bg-card)',
                color: selectedCategory === cat ? '#FFFFFF' : 'var(--text-secondary)',
                border: selectedCategory === cat ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                fontSize: '13px',
                fontWeight: selectedCategory === cat ? 700 : 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: selectedCategory === cat ? '0 4px 10px var(--primary-glow)' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Item Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px',
          marginTop: '28px',
        }}
      >
        {filteredItems.map((item) => {
          const isAvailable = item.branchAvailability[currentBranchId] ?? item.isAvailable;
          const displayPrice = item.branchPriceOverrides?.[currentBranchId] ?? item.basePrice;

          return (
            <div
              key={item.id}
              onClick={() => isAvailable && setActiveModalItem(item)}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: isAvailable ? '1px solid var(--border-color)' : '1px dashed var(--border-color)',
                overflow: 'hidden',
                boxShadow: isAvailable ? 'var(--shadow-md)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                cursor: isAvailable ? 'pointer' : 'not-allowed',
                opacity: isAvailable ? 1 : 0.6,
                filter: isAvailable ? 'none' : 'grayscale(70%)',
                position: 'relative',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              {/* Photo & Category Badge */}
              <div style={{ height: '190px', width: '100%', position: 'relative', overflow: 'hidden' }}>
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
              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  {item.name}
                </h3>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.45,
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {item.description}
                </p>

                {/* Pricing & Add Button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 'auto',
                    paddingTop: '12px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                      Price (Cash)
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
                      Rs. {displayPrice.toLocaleString()}
                    </span>
                  </div>

                  <button
                    disabled={!isAvailable}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isAvailable) setActiveModalItem(item);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isAvailable ? 'var(--primary)' : 'var(--bg-card-subtle)',
                      color: isAvailable ? '#FFFFFF' : 'var(--text-muted)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: isAvailable ? '0 4px 10px var(--primary-glow)' : 'none',
                    }}
                  >
                    {isAvailable ? (
                      <>
                        <Plus size={15} />
                        <span>Add</span>
                      </>
                    ) : (
                      <span>Out of Stock</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Cart Summary Bar on Mobile (PRD Requirement) */}
      {cartCount > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '76px',
            left: '16px',
            right: '16px',
            zIndex: 8000,
            maxWidth: '540px',
            margin: '0 auto',
            backgroundColor: 'var(--primary)',
            color: '#FFFFFF',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={onOpenCart}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '14px',
              }}
            >
              {cartCount}
            </div>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>Items in Cart</div>
              <div style={{ fontSize: '17px', fontWeight: 800 }}>Rs. {cartSubtotal.toLocaleString()}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '14px' }}>
            <span>Review & Checkout</span>
            <ArrowRight size={18} />
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {activeModalItem && (
        <ItemDetailModal item={activeModalItem} onClose={() => setActiveModalItem(null)} />
      )}
    </div>
  );
};
