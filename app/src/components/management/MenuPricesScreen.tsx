'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { MenuItem } from '@/types/cafe';
import { ModalConfirmation } from '@/components/common/ModalConfirmation';
import {
  UtensilsCrossed,
  PlusCircle,
  Edit2,
  DollarSign,
  CheckCircle,
  XCircle,
  Sparkles,
} from 'lucide-react';

export const MenuPricesScreen: React.FC = () => {
  const { menuItems, branches, updateMenuItemPrice, addToast } = useApp();

  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [newPriceInput, setNewPriceInput] = useState<number>(0);
  const [priceChangeModal, setPriceChangeModal] = useState<{ item: MenuItem; oldPrice: number; newPrice: number } | null>(null);

  const handleStartPriceEdit = (item: MenuItem) => {
    setEditingItem(item);
    setNewPriceInput(item.basePrice);
  };

  const handleSavePriceClick = () => {
    if (!editingItem) return;
    setPriceChangeModal({
      item: editingItem,
      oldPrice: editingItem.basePrice,
      newPrice: newPriceInput,
    });
  };

  const handleConfirmedPriceChange = () => {
    if (!priceChangeModal) return;
    updateMenuItemPrice(priceChangeModal.item.id, priceChangeModal.newPrice);
    addToast({
      type: 'success',
      title: 'Master Price Updated',
      message: `${priceChangeModal.item.name} updated to Rs. ${priceChangeModal.newPrice.toLocaleString()}. Written to Audit Log.`,
    });
    setPriceChangeModal(null);
    setEditingItem(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
          Master Menu & Price Override Management
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          Central pricing authority (owner only) · Snapshot isolation ensures historical receipts remain unchanged
        </p>
      </div>

      {/* Master Menu Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-card-subtle)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '14px 18px' }}>Dish / Product</th>
              <th style={{ padding: '14px 18px' }}>Category</th>
              <th style={{ padding: '14px 18px' }}>Master Base Price</th>
              <th style={{ padding: '14px 18px' }}>Branch Availabilities</th>
              <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={item.image} alt={item.name} style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {item.sizes?.length ? `${item.sizes.length} sizes` : 'Standard size'} · {item.extras?.length || 0} extras
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                  {item.category}
                </td>
                <td style={{ padding: '14px 18px', fontWeight: 800, color: 'var(--primary)', fontSize: '15px' }}>
                  Rs. {item.basePrice.toLocaleString()}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {branches.map((b) => {
                      const avail = item.branchAvailability[b.id] ?? true;
                      return (
                        <span
                          key={b.id}
                          title={`${b.name}: ${avail ? 'Available' : 'Unavailable'}`}
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: avail ? '#DCFCE7' : '#FEE2E2',
                            color: avail ? '#15803D' : '#B91C1C',
                          }}
                        >
                          {b.city.slice(0, 3)}: {avail ? '✓' : '✗'}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                  <button
                    onClick={() => handleStartPriceEdit(item)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-main)',
                      fontWeight: 600,
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Edit2 size={13} color="var(--primary)" />
                    <span>Change Price</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Price Edit Drawer / Modal */}
      {editingItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: 'var(--radius-lg)', maxWidth: '440px', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Adjust Master Base Price</h3>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{editingItem.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current Base Price: Rs. {editingItem.basePrice.toLocaleString()}</div>
            </div>

            <div>
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                New Base Price in Pakistani Rupees (Rs.)
              </label>
              <input
                type="number"
                value={newPriceInput}
                onChange={(e) => setNewPriceInput(parseInt(e.target.value) || 0)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button onClick={() => setEditingItem(null)} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--bg-card-subtle)' }}>
                Cancel
              </button>
              <button onClick={handleSavePriceClick} style={{ flex: 1, padding: '10px', borderRadius: '6px', backgroundColor: 'var(--primary)', color: '#FFFFFF', fontWeight: 700 }}>
                Review & Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Popup for Price Change (PRD Section F16) */}
      {priceChangeModal && (
        <ModalConfirmation
          isOpen={true}
          onClose={() => setPriceChangeModal(null)}
          onConfirm={handleConfirmedPriceChange}
          title="Confirm Master Price Update?"
          message={`You are modifying the price for "${priceChangeModal.item.name}". This action will be permanently recorded in the Audit Log.`}
          details={`Old Price: Rs. ${priceChangeModal.oldPrice.toLocaleString()} → New Price: Rs. ${priceChangeModal.newPrice.toLocaleString()}`}
          confirmText="Yes, apply price"
          cancelText="No, cancel"
        />
      )}
    </div>
  );
};
