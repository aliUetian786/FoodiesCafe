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
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-xl)',
          width: '100%',
          maxWidth: '540px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            zIndex: 20,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={18} />
        </button>

        {/* Large Food Photography */}
        <div style={{ height: '240px', width: '100%', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
          <div style={{ position: 'absolute', bottom: '16px', left: '20px', right: '20px', color: '#FFFFFF' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'var(--primary)', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
              {item.category}
            </span>
            <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#FFFFFF', margin: 0 }}>
              {item.name}
            </h2>
          </div>
        </div>

        {/* Scrollable Customization Content */}
        <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {item.description}
          </p>

          {/* Size Options (Radio) */}
          {item.sizes && item.sizes.length > 0 && (
            <div>
              <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                Select Portion Size
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {item.sizes.map((size, idx) => (
                  <div
                    key={size.name}
                    onClick={() => setSelectedSizeIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: selectedSizeIndex === idx ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                      border: selectedSizeIndex === idx ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          border: '2px solid var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {selectedSizeIndex === idx && (
                          <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                        )}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {size.name}
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {size.priceDelta > 0 ? `+ Rs. ${size.priceDelta}` : 'Included'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extras / Add-ons (Checkboxes) */}
          {item.extras && item.extras.length > 0 && (
            <div>
              <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '8px' }}>
                Extras & Complements
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: isChecked ? 'var(--primary-light)' : 'var(--bg-card-subtle)',
                        border: isChecked ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            backgroundColor: isChecked ? 'var(--primary)' : 'transparent',
                            border: '2px solid var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isChecked && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {extra.name}
                        </span>
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                        + Rs. {extra.price}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Special Instructions */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '6px' }}>
              Special Kitchen Instructions
            </label>
            <textarea
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Mild spice, extra crispy naan, less oil..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '13.5px',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Modal Footer with Stepper & Add Button */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexShrink: 0,
          }}
        >
          {/* Stepper */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 12px',
            }}
          >
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              style={{ color: quantity <= 1 ? 'var(--text-muted)' : 'var(--text-main)', cursor: quantity <= 1 ? 'default' : 'pointer' }}
            >
              <Minus size={16} />
            </button>
            <span style={{ fontWeight: 800, fontSize: '15px', minWidth: '20px', textAlign: 'center' }}>
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => q + 1)}
              style={{ color: 'var(--text-main)', cursor: 'pointer' }}
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={!isAvailableInBranch}
            style={{
              flex: 1,
              padding: '13px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isAvailableInBranch ? 'var(--primary)' : 'var(--text-muted)',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 800,
              cursor: isAvailableInBranch ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: isAvailableInBranch ? '0 4px 14px var(--primary-glow)' : 'none',
            }}
          >
            <ShoppingBag size={18} />
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
