'use client';

import React, { useState } from 'react';
import { MenuItem, OrderItem } from '@/types/cafe';
import { useApp } from '@/context/AppContext';
import { X, Plus, Minus, Check, ShoppingBag } from 'lucide-react';

interface ItemDetailModalProps {
  item: MenuItem | null;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, onClose }) => {
  const { addToCart, currentBranchId } = useApp();

  const [selectedSizeIndex, setSelectedSizeIndex] = useState(0);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

  if (!item) return null;

  // Calculate pricing
  const isAvailableInBranch = item.branchAvailability[currentBranchId] ?? item.isAvailable;
  const sizeDelta = item.sizes && item.sizes.length > 0 ? item.sizes[selectedSizeIndex].priceDelta : 0;
  const extrasTotal = (item.extras || [])
    .filter((e) => selectedExtras.includes(e.name))
    .reduce((sum, e) => sum + e.price, 0);

  const unitPrice = item.basePrice + sizeDelta + extrasTotal;
  const totalPrice = unitPrice * quantity;

  const handleToggleExtra = (extraName: string) => {
    if (selectedExtras.includes(extraName)) {
      setSelectedExtras((prev) => prev.filter((e) => e !== extraName));
    } else {
      setSelectedExtras((prev) => [...prev, extraName]);
    }
  };

  const handleAddToCart = () => {
    const orderItem: OrderItem = {
      id: `oi-${Date.now()}`,
      menuItemId: item.id,
      name: item.name,
      size: item.sizes && item.sizes.length > 0 ? item.sizes[selectedSizeIndex].name : undefined,
      extras: selectedExtras.length > 0 ? [...selectedExtras] : undefined,
      instructions: instructions.trim() ? instructions.trim() : undefined,
      unitPrice,
      quantity,
      isAddOn: false,
    };

    addToCart(orderItem);
    onClose();
  };

  return (
    <div
      className="foodies-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        className="foodies-modal-card"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          width: '100%',
          maxWidth: '520px',
          maxHeight: 'min(540px, 94vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 20,
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={15} />
        </button>

        {/* Food Photography */}
        <div style={{ height: 'clamp(90px, 16vh, 140px)', width: '100%', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
          <div style={{ position: 'absolute', bottom: '10px', left: '16px', right: '16px', color: '#FFFFFF' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, backgroundColor: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
              {item.category}
            </span>
            <h2 style={{ fontSize: 'clamp(16px, 3.5vw, 20px)', fontWeight: 800, marginTop: '4px', color: '#FFFFFF', margin: 0 }}>
              {item.name}
            </h2>
          </div>
        </div>

        {/* Unscrollable Customization Content */}
        <div style={{ padding: 'clamp(8px, 1.8vw, 14px)', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 1.4vw, 10px)', flex: 1, justifyContent: 'space-between' }}>
          <p style={{ fontSize: 'clamp(11px, 2.2vw, 12px)', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {item.description}
          </p>

          {/* Size Options (Radio) */}
          {item.sizes && item.sizes.length > 0 && (
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                Select Portion Size
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(item.sizes.length, 3)}, 1fr)`, gap: '6px' }}>
                {item.sizes.map((size, idx) => (
                  <div
                    key={size.name}
                    onClick={() => setSelectedSizeIndex(idx)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '5px 6px',
                      borderRadius: '8px',
                      backgroundColor: selectedSizeIndex === idx ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                      border: selectedSizeIndex === idx ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: 'clamp(11px, 2.4vw, 12px)', fontWeight: 700, color: 'var(--text-main)' }}>
                      {size.name}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '1px' }}>
                      {size.priceDelta > 0 ? `+Rs. ${size.priceDelta}` : 'Included'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extras / Add-ons (Checkboxes) */}
          {item.extras && item.extras.length > 0 && (
            <div>
              <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>
                Extras & Complements
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(item.extras.length, 2)}, 1fr)`, gap: '6px' }}>
                {item.extras.map((extra) => {
                  const isChecked = selectedExtras.includes(extra.name);
                  return (
                    <div
                      key={extra.name}
                      onClick={() => handleToggleExtra(extra.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        backgroundColor: isChecked ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                        border: isChecked ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 'clamp(10.5px, 2.2vw, 11.5px)', fontWeight: 650, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {extra.name}
                      </span>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--primary)', flexShrink: 0 }}>
                        +{extra.price}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          <div>
            <label style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '3px' }}>
              Kitchen Notes
            </label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Mild spice, extra crispy, less oil..."
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: 'clamp(11px, 2.4vw, 12px)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Modal Footer with Stepper & Add Button */}
        <div
          style={{
            padding: '8px clamp(12px, 2.5vw, 16px)',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          {/* Stepper */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-full)',
              padding: '4px 8px',
            }}
          >
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              style={{ color: quantity <= 1 ? 'var(--text-muted)' : 'var(--text-main)', cursor: quantity <= 1 ? 'default' : 'pointer' }}
            >
              <Minus size={13} />
            </button>
            <span style={{ fontWeight: 800, fontSize: '13px', minWidth: '16px', textAlign: 'center' }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              style={{ color: 'var(--text-main)', cursor: 'pointer' }}
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={!isAvailableInBranch}
            style={{
              flex: 1,
              padding: 'clamp(8px, 1.8vw, 11px) 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isAvailableInBranch ? 'var(--primary)' : 'var(--text-muted)',
              color: '#FFFFFF',
              fontSize: 'clamp(12px, 2.5vw, 13px)',
              fontWeight: 800,
              cursor: isAvailableInBranch ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: isAvailableInBranch ? '0 4px 14px var(--primary-glow)' : 'none',
            }}
          >
            <ShoppingBag size={15} />
            <span>
              {isAvailableInBranch
                ? `Add to cart — Rs. ${totalPrice.toLocaleString()}`
                : 'Item Unavailable in this Branch'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
