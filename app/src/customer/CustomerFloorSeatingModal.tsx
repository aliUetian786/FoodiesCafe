'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { X, Armchair, Layers, Check } from 'lucide-react';

interface CustomerFloorSeatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTableNumber: string;
  onSelectTable: (tableNumber: string) => void;
}

export const CustomerFloorSeatingModal: React.FC<CustomerFloorSeatingModalProps> = ({
  isOpen,
  onClose,
  selectedTableNumber,
  onSelectTable,
}) => {
  const { tables, floors, currentBranchId, currentBranch } = useApp();

  const floorList = floors && floors.length > 0 ? floors : ['Ground Floor (Main Dining)'];
  const [activeFloor, setActiveFloor] = useState<string>(floorList[0]);

  if (!isOpen) return null;

  const branchTables = tables.filter((t) => t.branchId === currentBranchId);
  const freeFloorTables = branchTables.filter(
    (t) => (t.floor || 'Ground Floor (Main Dining)') === activeFloor && t.status === 'available'
  );

  return (
    <div
      className="foodies-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(26, 26, 26, 0.7)',
        backdropFilter: 'blur(8px)',
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
          maxWidth: '560px',
          maxHeight: 'min(520px, 92vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: 'clamp(10px, 2.5vw, 14px) clamp(14px, 3.5vw, 20px)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
            flexShrink: 0,
          }}
        >
          <h3 style={{ fontSize: '17px', fontWeight: 850, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
            Free Tables
          </h3>

          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Floor Selection Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px clamp(12px, 3vw, 18px)',
            backgroundColor: 'var(--bg-card-subtle)',
            borderBottom: '1px solid var(--border-color)',
            overflowX: 'auto',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginRight: '2px' }}>
            <Layers size={14} color="var(--primary)" />
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-muted)',
              }}
            >
              Floor:
            </span>
          </div>

          {floorList.map((fl) => (
            <button
              key={fl}
              onClick={() => setActiveFloor(fl)}
              style={{
                padding: '4px clamp(8px, 2vw, 12px)',
                borderRadius: 'var(--radius-full)',
                backgroundColor: activeFloor === fl ? 'var(--primary)' : 'var(--bg-card)',
                color: activeFloor === fl ? '#FFFFFF' : 'var(--text-main)',
                border: activeFloor === fl ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                fontWeight: 800,
                fontSize: 'clamp(11px, 2.5vw, 12px)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {fl.split('(')[0].trim()}
            </button>
          ))}
        </div>

        {/* Tables Seating Grid - Shrinks table cards to fit floor, scrolls ONLY if available tables exceed popup capacity */}
        <div
          style={{
            flex: 1,
            overflowY: freeFloorTables.length > 18 ? 'auto' : 'hidden',
            padding: 'clamp(12px, 3vw, 18px)',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {freeFloorTables.length === 0 ? (
            <div style={{ textAlign: 'center', margin: 'auto', padding: '24px 12px', color: 'var(--text-muted)' }}>
              <Armchair size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: 'clamp(12px, 2.8vw, 13.5px)', fontWeight: 600, margin: 0 }}>
                No free tables available on {activeFloor.split('(')[0].trim()}.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(48px, 12vw, 64px), 1fr))',
                gap: 'clamp(6px, 1.8vw, 8px)',
                alignContent: 'start',
              }}
            >
              {freeFloorTables.map((table) => {
                const isSelected = selectedTableNumber === table.number;

                return (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => {
                      onSelectTable(table.number);
                      onClose();
                    }}
                    style={{
                      height: 'clamp(36px, 8vw, 44px)',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                      color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                      fontFamily: 'Outfit, sans-serif',
                      fontWeight: 900,
                      fontSize: 'clamp(12px, 3vw, 14px)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isSelected ? '0 4px 14px var(--primary-glow)' : 'var(--shadow-sm)',
                      transition: 'all 0.15s ease',
                      padding: '0 4px',
                    }}
                  >
                    {table.number}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '10px clamp(14px, 3.5vw, 20px)',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 'clamp(11.5px, 2.5vw, 12.5px)', color: 'var(--text-secondary)' }}>
            Selected: <strong style={{ color: 'var(--text-main)' }}>{selectedTableNumber || 'None'}</strong>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '12.5px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Check size={14} />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
